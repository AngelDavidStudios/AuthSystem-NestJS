import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator';
import { OrganizationRepo } from './organization.repo';
import { AuditRepo } from '../vacation/audit.repo';
import {
  ROOT,
  type OrganizationNode,
  type TreeNode,
} from './organization.types';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly repo: OrganizationRepo,
    private readonly audit: AuditRepo,
  ) {}

  async createNode(
    params: {
      userId: string;
      userEmail: string;
      userName: string;
      supervisorId?: string;
      position: string;
      department: string;
    },
    user: CurrentUserData,
  ): Promise<{ message: string; node: OrganizationNode }> {
    // Un usuario solo puede tener un nodo en el árbol.
    const existing = await this.repo.getByUserId(params.userId);
    if (existing) {
      throw new BadRequestException(
        'Este usuario ya tiene un nodo en la organización',
      );
    }

    const supervisorId = normalizeSupervisor(params.supervisorId);
    let level = 0;
    if (supervisorId !== ROOT) {
      const supervisor = await this.repo.getById(supervisorId);
      if (!supervisor) {
        throw new BadRequestException('El supervisor indicado no existe');
      }
      level = supervisor.level + 1;
    }

    const now = new Date().toISOString();
    const node: OrganizationNode = {
      id: randomUUID(),
      userId: params.userId,
      userEmail: params.userEmail,
      userName: params.userName,
      supervisorId,
      position: params.position,
      department: params.department,
      level,
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.put(node);
    await this.writeAudit('HIERARCHY_CREATED', node.id, user, {
      userId: node.userId,
      supervisorId,
    });

    return { message: 'Nodo creado correctamente', node };
  }

  async updateNode(
    params: {
      id: string;
      supervisorId?: string;
      position?: string;
      department?: string;
    },
    user: CurrentUserData,
  ): Promise<{ message: string }> {
    const nodes = await this.repo.getAll();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const node = byId.get(params.id);
    if (!node) {
      throw new NotFoundException('Nodo no encontrado');
    }

    if (params.position !== undefined) node.position = params.position;
    if (params.department !== undefined) node.department = params.department;

    const changed = new Set<OrganizationNode>([node]);
    if (params.supervisorId !== undefined) {
      this.applyReparent(node, params.supervisorId, byId);
      recomputeLevels(nodes, byId).forEach((n) => changed.add(n));
    }
    node.updatedAt = new Date().toISOString();

    await Promise.all([...changed].map((n) => this.repo.put(n)));
    await this.writeAudit('HIERARCHY_UPDATED', node.id, user, {
      supervisorId: node.supervisorId,
    });

    return { message: 'Nodo actualizado correctamente' };
  }

  async assignSupervisor(
    id: string,
    supervisorId: string,
    user: CurrentUserData,
  ): Promise<{ message: string }> {
    const nodes = await this.repo.getAll();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const node = byId.get(id);
    if (!node) {
      throw new NotFoundException('Nodo no encontrado');
    }

    this.applyReparent(node, supervisorId, byId);
    node.updatedAt = new Date().toISOString();
    const changed = recomputeLevels(nodes, byId);
    changed.add(node);

    await Promise.all([...changed].map((n) => this.repo.put(n)));
    await this.writeAudit('HIERARCHY_UPDATED', node.id, user, {
      supervisorId: node.supervisorId,
    });

    return { message: 'Supervisor asignado correctamente' };
  }

  async deleteNode(
    id: string,
    user: CurrentUserData,
  ): Promise<{ message: string }> {
    const node = await this.repo.getById(id);
    if (!node) {
      throw new NotFoundException('Nodo no encontrado');
    }
    // No borrar un nodo con subordinados (dejaría huérfanos): reasignar primero.
    const subordinates = await this.repo.getBySupervisorId(id);
    if (subordinates.length > 0) {
      throw new BadRequestException(
        `No se puede eliminar: el nodo tiene ${subordinates.length} subordinado(s). Reasígnalos primero.`,
      );
    }

    await this.repo.delete(id);
    await this.writeAudit('HIERARCHY_DELETED', id, user, {
      userId: node.userId,
    });

    return { message: 'Nodo eliminado correctamente' };
  }

  async getNode(id: string): Promise<{ node: OrganizationNode }> {
    const node = await this.repo.getById(id);
    if (!node) {
      throw new NotFoundException('Nodo no encontrado');
    }
    return { node };
  }

  async getNodeByUserId(userId: string): Promise<{ node: OrganizationNode }> {
    const node = await this.repo.getByUserId(userId);
    if (!node) {
      throw new NotFoundException('Este usuario no tiene un nodo asignado');
    }
    return { node };
  }

  async getSubordinates(
    id: string,
  ): Promise<{ subordinates: OrganizationNode[] }> {
    const subordinates = await this.repo.getBySupervisorId(id);
    return { subordinates };
  }

  async getTree(): Promise<{
    nodes: OrganizationNode[];
    tree: TreeNode[];
  }> {
    const nodes = await this.repo.getAll();
    return { nodes, tree: buildTree(nodes) };
  }

  // ---- helpers ----------------------------------------------------------

  /** Valida y aplica el cambio de supervisor sobre `node` (en memoria). */
  private applyReparent(
    node: OrganizationNode,
    rawSupervisorId: string,
    byId: Map<string, OrganizationNode>,
  ): void {
    const supervisorId = normalizeSupervisor(rawSupervisorId);
    if (supervisorId !== ROOT) {
      if (supervisorId === node.id) {
        throw new BadRequestException(
          'Un nodo no puede ser su propio supervisor',
        );
      }
      if (!byId.has(supervisorId)) {
        throw new BadRequestException('El supervisor indicado no existe');
      }
      if (isAncestor(node.id, supervisorId, byId)) {
        throw new BadRequestException(
          'No se puede crear un ciclo en la jerarquía',
        );
      }
    }
    node.supervisorId = supervisorId;
  }

  private writeAudit(
    action: 'HIERARCHY_CREATED' | 'HIERARCHY_UPDATED' | 'HIERARCHY_DELETED',
    entityId: string,
    user: CurrentUserData,
    details?: Record<string, unknown>,
  ): Promise<unknown> {
    return this.audit.write({
      action,
      entityType: 'OrganizationNode',
      entityId,
      userId: user.sub,
      userEmail: user.email ?? '',
      details,
    });
  }
}

// ---- funciones puras -----------------------------------------------------

function normalizeSupervisor(supervisorId?: string): string {
  if (!supervisorId || supervisorId === ROOT) return ROOT;
  return supervisorId;
}

/** ¿`ancestorId` es ancestro de `nodeId`? (sirve para detectar ciclos). */
function isAncestor(
  ancestorId: string,
  nodeId: string,
  byId: Map<string, OrganizationNode>,
): boolean {
  const seen = new Set<string>();
  let current = byId.get(nodeId);
  while (current && current.supervisorId !== ROOT && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.supervisorId === ancestorId) return true;
    current = byId.get(current.supervisorId);
  }
  return false;
}

/** Recalcula `level` de todo el bosque; devuelve los nodos cuyo nivel cambió. */
function recomputeLevels(
  nodes: OrganizationNode[],
  byId: Map<string, OrganizationNode>,
): Set<OrganizationNode> {
  const changed = new Set<OrganizationNode>();
  const levelOf = (
    node: OrganizationNode,
    seen = new Set<string>(),
  ): number => {
    if (
      node.supervisorId === ROOT ||
      !byId.has(node.supervisorId) ||
      seen.has(node.id)
    ) {
      return 0;
    }
    seen.add(node.id);
    return levelOf(byId.get(node.supervisorId)!, seen) + 1;
  };
  for (const node of nodes) {
    const level = levelOf(node);
    if (node.level !== level) {
      node.level = level;
      changed.add(node);
    }
  }
  return changed;
}

/** Construye el bosque (raíces con `children[]`) a partir de la lista plana. */
function buildTree(nodes: OrganizationNode[]): TreeNode[] {
  const byId = new Map<string, TreeNode>(
    nodes.map((n) => [n.id, { ...n, children: [] }]),
  );
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    const parent =
      node.supervisorId !== ROOT ? byId.get(node.supervisorId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
