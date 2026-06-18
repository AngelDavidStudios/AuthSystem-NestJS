import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrganizationService } from '../../src/organization/organization.service';
import type { OrganizationRepo } from '../../src/organization/organization.repo';
import type { AuditRepo } from '../../src/vacation/audit.repo';
import type { CurrentUserData } from '../../src/auth/decorators/current-user.decorator';
import type { OrganizationNode } from '../../src/organization/organization.types';

const admin: CurrentUserData = {
  sub: 'admin-1',
  email: 'admin@x.com',
  groups: ['Admins'],
};

function node(over: Partial<OrganizationNode> = {}): OrganizationNode {
  return {
    id: 'n1',
    userId: 'u1',
    userEmail: 'u1@x.com',
    userName: 'U1',
    supervisorId: 'ROOT',
    position: 'Dev',
    department: 'Tech',
    level: 0,
    ...over,
  };
}

function makeRepo(over: Partial<jest.Mocked<OrganizationRepo>> = {}) {
  return {
    put: jest.fn(async (n: OrganizationNode) => n),
    getById: jest.fn(),
    getByUserId: jest.fn(async () => undefined),
    getBySupervisorId: jest.fn(async () => []),
    getAll: jest.fn(async () => []),
    delete: jest.fn(async () => undefined),
    ...over,
  } as unknown as jest.Mocked<OrganizationRepo>;
}

const makeAudit = () =>
  ({ write: jest.fn(async () => ({})) }) as unknown as jest.Mocked<AuditRepo>;

describe('OrganizationService', () => {
  describe('createNode', () => {
    const base = {
      userId: 'u2',
      userEmail: 'u2@x.com',
      userName: 'U2',
      position: 'Dev',
      department: 'Tech',
    };

    it('nodo raíz: supervisorId vacío → ROOT, level 0', async () => {
      const repo = makeRepo();
      const service = new OrganizationService(repo, makeAudit());

      const { node: created } = await service.createNode(base, admin);

      expect(created.supervisorId).toBe('ROOT');
      expect(created.level).toBe(0);
    });

    it('nodo hijo: level = supervisor.level + 1', async () => {
      const repo = makeRepo({
        getById: jest.fn(async () => node({ id: 'sup', level: 2 })),
      });
      const service = new OrganizationService(repo, makeAudit());

      const { node: created } = await service.createNode(
        { ...base, supervisorId: 'sup' },
        admin,
      );

      expect(created.level).toBe(3);
    });

    it('rechaza si el usuario ya tiene nodo', async () => {
      const repo = makeRepo({ getByUserId: jest.fn(async () => node()) });
      const service = new OrganizationService(repo, makeAudit());
      await expect(service.createNode(base, admin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza si el supervisor indicado no existe', async () => {
      const repo = makeRepo({ getById: jest.fn(async () => undefined) });
      const service = new OrganizationService(repo, makeAudit());
      await expect(
        service.createNode({ ...base, supervisorId: 'fantasma' }, admin),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTree', () => {
    it('arma el árbol con children[] desde la lista plana', async () => {
      const root = node({ id: 'A', supervisorId: 'ROOT', level: 0 });
      const child = node({ id: 'B', supervisorId: 'A', level: 1 });
      const grand = node({ id: 'C', supervisorId: 'B', level: 2 });
      const repo = makeRepo({
        getAll: jest.fn(async () => [grand, root, child]),
      });
      const service = new OrganizationService(repo, makeAudit());

      const { tree, nodes } = await service.getTree();

      expect(nodes).toHaveLength(3);
      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe('A');
      expect(tree[0].children[0].id).toBe('B');
      expect(tree[0].children[0].children[0].id).toBe('C');
    });
  });

  describe('assignSupervisor', () => {
    it('detecta ciclos (no puedes colgar un nodo de su descendiente)', async () => {
      const a = node({ id: 'A', supervisorId: 'ROOT', level: 0 });
      const b = node({ id: 'B', supervisorId: 'A', level: 1 });
      const repo = makeRepo({ getAll: jest.fn(async () => [a, b]) });
      const service = new OrganizationService(repo, makeAudit());

      await expect(service.assignSupervisor('A', 'B', admin)).rejects.toThrow(
        /ciclo/i,
      );
    });

    it('recalcula el nivel al reasignar supervisor', async () => {
      const a = node({ id: 'A', supervisorId: 'ROOT', level: 0 });
      const b = node({ id: 'B', supervisorId: 'ROOT', level: 0 });
      const repo = makeRepo({ getAll: jest.fn(async () => [a, b]) });
      const service = new OrganizationService(repo, makeAudit());

      await service.assignSupervisor('B', 'A', admin);

      expect(repo.put).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'B', supervisorId: 'A', level: 1 }),
      );
    });
  });

  describe('deleteNode', () => {
    it('bloquea el borrado si el nodo tiene subordinados', async () => {
      const repo = makeRepo({
        getById: jest.fn(async () => node({ id: 'A' })),
        getBySupervisorId: jest.fn(async () => [node({ id: 'B' })]),
      });
      const service = new OrganizationService(repo, makeAudit());
      await expect(service.deleteNode('A', admin)).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('elimina y audita si no hay subordinados', async () => {
      const audit = makeAudit();
      const repo = makeRepo({
        getById: jest.fn(async () => node({ id: 'A' })),
        getBySupervisorId: jest.fn(async () => []),
      });
      const service = new OrganizationService(repo, audit);

      await service.deleteNode('A', admin);

      expect(repo.delete).toHaveBeenCalledWith('A');
      expect(audit.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'HIERARCHY_DELETED' }),
      );
    });

    it('404 si el nodo no existe', async () => {
      const repo = makeRepo({ getById: jest.fn(async () => undefined) });
      const service = new OrganizationService(repo, makeAudit());
      await expect(service.deleteNode('x', admin)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
