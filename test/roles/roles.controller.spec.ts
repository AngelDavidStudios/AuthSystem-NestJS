import { RolesController } from '../../src/roles/roles.controller';
import { RolesService } from '../../src/roles/roles.service';

function makeController() {
  const service = {
    listGroups: jest.fn().mockResolvedValue(['groups']),
    addUserToGroup: jest.fn().mockResolvedValue(undefined),
    removeUserFromGroup: jest.fn().mockResolvedValue(undefined),
    listGroupsForUser: jest.fn().mockResolvedValue(['userGroups']),
  } as unknown as RolesService;
  return { controller: new RolesController(service), service };
}

describe('RolesController', () => {
  it('list delega en listGroups', async () => {
    const { controller, service } = makeController();
    expect(await controller.list()).toEqual(['groups']);
    expect(service.listGroups).toHaveBeenCalled();
  });

  it('addUser pasa grupo + usuario', async () => {
    const { controller, service } = makeController();
    await controller.addUser('Admins', 'jdoe');
    expect(service.addUserToGroup).toHaveBeenCalledWith('Admins', 'jdoe');
  });

  it('removeUser pasa grupo + usuario', async () => {
    const { controller, service } = makeController();
    await controller.removeUser('Admins', 'jdoe');
    expect(service.removeUserFromGroup).toHaveBeenCalledWith('Admins', 'jdoe');
  });

  it('listForUser delega en listGroupsForUser', async () => {
    const { controller, service } = makeController();
    expect(await controller.listForUser('jdoe')).toEqual(['userGroups']);
    expect(service.listGroupsForUser).toHaveBeenCalledWith('jdoe');
  });
});
