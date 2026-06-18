import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator';
import { VacationRepo } from './vacation.repo';
import { AuditRepo } from './audit.repo';
import {
  calculateDays,
  type AuditLog,
  type VacationBalance,
  type VacationBalanceRecord,
  type VacationRequest,
  type VacationType,
} from './vacation.types';

const ADMIN_GROUP = 'Admins';
const MANAGER_GROUP = 'Managers';

function isAdmin(user: CurrentUserData): boolean {
  return user.groups.includes(ADMIN_GROUP);
}

function isApprover(user: CurrentUserData): boolean {
  return (
    user.groups.includes(ADMIN_GROUP) || user.groups.includes(MANAGER_GROUP)
  );
}

@Injectable()
export class VacationService {
  constructor(
    private readonly repo: VacationRepo,
    private readonly audit: AuditRepo,
  ) {}

  // ===================== Solicitudes =====================

  async createRequest(
    params: {
      startDate: string;
      endDate: string;
      type: VacationType;
      reason?: string;
      userId: string;
      userEmail: string;
      userName: string;
    },
    user: CurrentUserData,
  ): Promise<{ message: string; request: VacationRequest }> {
    // Anti-suplantación: solo puedes crear solicitudes a tu propio nombre.
    if (params.userId !== user.sub) {
      throw new ForbiddenException(
        'No puedes crear solicitudes para otro usuario',
      );
    }
    if (new Date(params.endDate) < new Date(params.startDate)) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la de inicio',
      );
    }

    const totalDays = calculateDays(params.startDate, params.endDate);

    // El usuario debe tener balance asignado y días disponibles suficientes.
    const balance = await this.computeBalance(params.userId);
    if (!balance) {
      throw new BadRequestException(
        'No tienes un balance de vacaciones asignado. Contacta a un administrador.',
      );
    }
    if (balance.availableDays < totalDays) {
      throw new BadRequestException(
        `Días insuficientes: disponibles ${balance.availableDays}, solicitados ${totalDays}`,
      );
    }

    // Resolver supervisor desde el árbol organizacional (si existe nodo).
    let supervisorId = '';
    let supervisorEmail = '';
    const node = await this.repo.getOrgNodeByUserId(params.userId);
    if (node?.supervisorId && node.supervisorId !== 'ROOT') {
      const supervisorNode = await this.repo.getOrgNodeById(node.supervisorId);
      if (supervisorNode) {
        supervisorId = supervisorNode.userId;
        supervisorEmail = supervisorNode.userEmail;
      }
    }

    const now = new Date().toISOString();
    const request: VacationRequest = {
      id: randomUUID(),
      requesterId: params.userId,
      requesterEmail: params.userEmail,
      requesterName: params.userName,
      supervisorId,
      supervisorEmail,
      startDate: params.startDate,
      endDate: params.endDate,
      totalDays,
      type: params.type,
      reason: params.reason,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.putRequest(request);
    await this.audit.write({
      action: 'REQUEST_CREATED',
      entityType: 'VacationRequest',
      entityId: request.id,
      userId: user.sub,
      userEmail: params.userEmail,
      details: { totalDays, type: params.type },
    });

    return { message: 'Solicitud creada correctamente', request };
  }

  async approveRequest(
    id: string,
    user: CurrentUserData,
    comment?: string,
  ): Promise<{ message: string }> {
    return this.resolveRequest(id, 'APPROVED', user, comment);
  }

  async rejectRequest(
    id: string,
    user: CurrentUserData,
    comment?: string,
  ): Promise<{ message: string }> {
    return this.resolveRequest(id, 'REJECTED', user, comment);
  }

  private async resolveRequest(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    user: CurrentUserData,
    comment?: string,
  ): Promise<{ message: string }> {
    const request = await this.repo.getRequest(id);
    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }
    // Solo el supervisor asignado o un aprobador (Admins/Managers).
    if (request.supervisorId !== user.sub && !isApprover(user)) {
      throw new ForbiddenException(
        'No tienes permiso para resolver esta solicitud',
      );
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        `La solicitud ya está ${request.status}, no se puede modificar`,
      );
    }

    const now = new Date().toISOString();
    const updated: VacationRequest = {
      ...request,
      status,
      supervisorComment: comment,
      updatedAt: now,
      resolvedAt: now,
    };
    await this.repo.putRequest(updated);
    await this.audit.write({
      action: status === 'APPROVED' ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED',
      entityType: 'VacationRequest',
      entityId: id,
      userId: user.sub,
      userEmail: user.email ?? '',
      details: { comment },
    });

    return {
      message:
        status === 'APPROVED' ? 'Solicitud aprobada' : 'Solicitud rechazada',
    };
  }

  async cancelRequest(
    id: string,
    user: CurrentUserData,
  ): Promise<{ message: string }> {
    const request = await this.repo.getRequest(id);
    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }
    if (request.requesterId !== user.sub) {
      throw new ForbiddenException('Solo puedes cancelar tus propias solicitudes');
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        'Solo se pueden cancelar solicitudes pendientes',
      );
    }

    const now = new Date().toISOString();
    await this.repo.putRequest({
      ...request,
      status: 'CANCELLED',
      updatedAt: now,
      resolvedAt: now,
    });
    await this.audit.write({
      action: 'REQUEST_CANCELLED',
      entityType: 'VacationRequest',
      entityId: id,
      userId: user.sub,
      userEmail: user.email ?? '',
    });

    return { message: 'Solicitud cancelada' };
  }

  async getRequest(
    id: string,
    user: CurrentUserData,
  ): Promise<{ request: VacationRequest }> {
    const request = await this.repo.getRequest(id);
    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }
    // Visible para el dueño, el supervisor asignado o un aprobador.
    const visible =
      request.requesterId === user.sub ||
      request.supervisorId === user.sub ||
      isApprover(user);
    if (!visible) {
      throw new ForbiddenException('No tienes acceso a esta solicitud');
    }
    return { request };
  }

  async getMyRequests(
    userId: string,
    user: CurrentUserData,
  ): Promise<{ requests: VacationRequest[] }> {
    if (userId !== user.sub && !isAdmin(user)) {
      throw new ForbiddenException('Solo puedes ver tus propias solicitudes');
    }
    const requests = await this.repo.getRequestsByRequester(userId);
    return { requests: sortByCreatedDesc(requests) };
  }

  async getPendingApprovals(
    supervisorId: string,
    user: CurrentUserData,
  ): Promise<{ requests: VacationRequest[] }> {
    if (supervisorId !== user.sub && !isApprover(user)) {
      throw new ForbiddenException(
        'No tienes permiso para ver estas aprobaciones',
      );
    }
    const requests = await this.repo.getRequestsBySupervisor(supervisorId);
    return {
      requests: sortByCreatedDesc(
        requests.filter((r) => r.status === 'PENDING'),
      ),
    };
  }

  async getAllRequests(
    user: CurrentUserData,
  ): Promise<{ requests: VacationRequest[] }> {
    this.assertAdmin(user);
    const requests = await this.repo.getAllRequests();
    return { requests: sortByCreatedDesc(requests) };
  }

  // ===================== Balances =====================

  async getBalance(
    userId: string,
    user: CurrentUserData,
  ): Promise<{ balance: VacationBalance }> {
    if (userId !== user.sub && !isAdmin(user)) {
      throw new ForbiddenException('Solo puedes ver tu propio balance');
    }
    const balance = await this.computeBalance(userId);
    if (!balance) {
      throw new NotFoundException(
        'No hay un balance asignado para este usuario',
      );
    }
    return { balance };
  }

  async setBalance(
    params: {
      userId: string;
      userEmail: string;
      userName: string;
      totalDays: number;
      adminUserId: string;
    },
    user: CurrentUserData,
  ): Promise<{ message: string; balance: VacationBalance }> {
    this.assertAdmin(user);
    if (params.totalDays < 0) {
      throw new BadRequestException('totalDays no puede ser negativo');
    }

    // No permitir asignar menos días de los ya consumidos (aprobados).
    const requests = await this.repo.getRequestsByRequester(params.userId);
    const usedDays = sumDays(requests, 'APPROVED');
    if (params.totalDays < usedDays) {
      throw new BadRequestException(
        `totalDays (${params.totalDays}) no puede ser menor a los días ya usados (${usedDays})`,
      );
    }

    const record: VacationBalanceRecord = {
      id: randomUUID(),
      userId: params.userId,
      userEmail: params.userEmail,
      userName: params.userName,
      totalDays: params.totalDays,
      year: new Date().getFullYear(),
      lastUpdated: new Date().toISOString(),
      updatedBy: params.adminUserId,
    };
    await this.repo.putBalance(record);

    const balance = deriveBalance(record, requests);
    return { message: 'Balance actualizado', balance };
  }

  async getAllBalances(
    user: CurrentUserData,
  ): Promise<{ balances: VacationBalance[] }> {
    this.assertAdmin(user);
    const [records, allRequests] = await Promise.all([
      this.repo.getAllBalances(),
      this.repo.getAllRequests(),
    ]);
    const balances = records.map((record) =>
      deriveBalance(
        record,
        allRequests.filter((r) => r.requesterId === record.userId),
      ),
    );
    return { balances };
  }

  // ===================== Auditoría =====================

  async getAuditLogs(
    filters: { actionFilter?: string; entityType?: string },
    user: CurrentUserData,
  ): Promise<{ logs: AuditLog[] }> {
    this.assertAdmin(user);
    const logs = await this.audit.list(filters);
    return { logs };
  }

  // ===================== Helpers =====================

  /** Carga el record persistido y lo enriquece con días derivados. */
  private async computeBalance(
    userId: string,
  ): Promise<VacationBalance | undefined> {
    const record = await this.repo.getBalance(userId);
    if (!record) return undefined;
    const requests = await this.repo.getRequestsByRequester(userId);
    return deriveBalance(record, requests);
  }

  private assertAdmin(user: CurrentUserData): void {
    if (!isAdmin(user)) {
      throw new ForbiddenException('Requiere rol de administrador');
    }
  }
}

// ---- funciones puras (fáciles de testear) --------------------------------

function sumDays(requests: VacationRequest[], status: VacationRequest['status']): number {
  return requests
    .filter((r) => r.status === status)
    .reduce((acc, r) => acc + r.totalDays, 0);
}

function deriveBalance(
  record: VacationBalanceRecord,
  requests: VacationRequest[],
): VacationBalance {
  const usedDays = sumDays(requests, 'APPROVED');
  const pendingDays = sumDays(requests, 'PENDING');
  return {
    ...record,
    usedDays,
    pendingDays,
    availableDays: record.totalDays - usedDays - pendingDays,
  };
}

function sortByCreatedDesc(requests: VacationRequest[]): VacationRequest[] {
  return [...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
