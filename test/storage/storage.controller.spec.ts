import { BadRequestException } from '@nestjs/common';
import { StorageController } from '../../src/storage/storage.controller';
import { StorageService } from '../../src/storage/storage.service';
import type { StorageActionDto } from '../../src/storage/dto/storage-action.dto';
import type { CurrentUserData } from '../../src/auth/decorators/current-user.decorator';

const USER: CurrentUserData = {
  sub: 's',
  email: 'jdoe@example.com',
  username: 'jdoe',
  groups: ['Users'],
};

function makeController() {
  const service = {
    getUploadUrl: jest.fn().mockResolvedValue('getUploadUrl'),
    getMyPictureUrl: jest.fn().mockResolvedValue('get'),
    getUserPictureUrl: jest.fn().mockResolvedValue('getByUser'),
    delete: jest.fn().mockResolvedValue('delete'),
  } as unknown as StorageService;
  return { controller: new StorageController(service), service };
}

const dispatch = (dto: Partial<StorageActionDto>) =>
  makeController().controller.dispatch(dto as StorageActionDto, USER);

describe('StorageController (dispatch POST /storage)', () => {
  it('getUploadUrl pasa contentType + usuario', async () => {
    const { controller, service } = makeController();
    await controller.dispatch(
      { action: 'getUploadUrl', contentType: 'image/png' },
      USER,
    );
    expect(service.getUploadUrl).toHaveBeenCalledWith('image/png', USER);
  });

  it('get delega en getMyPictureUrl con el usuario de sesión', async () => {
    const { controller, service } = makeController();
    await controller.dispatch({ action: 'get' }, USER);
    expect(service.getMyPictureUrl).toHaveBeenCalledWith(USER);
  });

  it('getByUser pasa username objetivo + usuario', async () => {
    const { controller, service } = makeController();
    await controller.dispatch({ action: 'getByUser', username: 'other' }, USER);
    expect(service.getUserPictureUrl).toHaveBeenCalledWith('other', USER);
  });

  it('delete delega en delete con el usuario de sesión', async () => {
    const { controller, service } = makeController();
    await controller.dispatch({ action: 'delete' }, USER);
    expect(service.delete).toHaveBeenCalledWith(USER);
  });

  it('lanza BadRequest si falta un parámetro requerido', () => {
    expect(() => dispatch({ action: 'getUploadUrl' })).toThrow(
      BadRequestException,
    );
    expect(() => dispatch({ action: 'getByUser' })).toThrow(
      BadRequestException,
    );
  });
});
