import { BadRequestException } from '@nestjs/common';
import { MessagesController } from '../../src/messages/messages.controller';
import { MessagesService } from '../../src/messages/messages.service';
import type { MessageActionDto } from '../../src/messages/dto/message-action.dto';
import type { CurrentUserData } from '../../src/auth/decorators/current-user.decorator';

const USER: CurrentUserData = {
  sub: 's',
  email: 'ana@x.com',
  username: 'ana',
  groups: ['Users'],
};

const SEND_DTO: Partial<MessageActionDto> = {
  action: 'send',
  subject: 'Incidente',
  type: 'incident',
  employee: 'Juan Pérez',
  eventDate: '2026-06-19',
  confidentialityLevel: 'confidential',
  description: 'Detalle',
};

function makeController() {
  const service = {
    send: jest.fn().mockResolvedValue('send'),
    list: jest.fn().mockResolvedValue('list'),
    decrypt: jest.fn().mockResolvedValue('decrypt'),
    delete: jest.fn().mockResolvedValue('delete'),
  } as unknown as MessagesService;
  return { controller: new MessagesController(service), service };
}

const dispatch = (dto: Partial<MessageActionDto>) =>
  makeController().controller.dispatch(dto as MessageActionDto, USER);

describe('MessagesController (dispatch POST /messages)', () => {
  it('send delega con el payload mapeado y el usuario de sesión', async () => {
    const { controller, service } = makeController();
    await controller.dispatch(SEND_DTO as MessageActionDto, USER);
    expect(service.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Incidente',
        employee: 'Juan Pérez',
        confidentialityLevel: 'confidential',
      }),
      USER,
    );
  });

  it('rutea cada acción a su método de service', async () => {
    expect(await dispatch(SEND_DTO)).toBe('send');
    expect(await dispatch({ action: 'list' })).toBe('list');
    expect(await dispatch({ action: 'decrypt', messageId: 'm1' })).toBe(
      'decrypt',
    );
    expect(await dispatch({ action: 'delete', messageId: 'm1' })).toBe(
      'delete',
    );
  });

  it('decrypt delega solo el messageId (sin usuario)', async () => {
    const { controller, service } = makeController();
    await controller.dispatch({ action: 'decrypt', messageId: 'm1' }, USER);
    expect(service.decrypt).toHaveBeenCalledWith('m1');
  });

  it('delete delega messageId + usuario (authz en el service)', async () => {
    const { controller, service } = makeController();
    await controller.dispatch({ action: 'delete', messageId: 'm1' }, USER);
    expect(service.delete).toHaveBeenCalledWith('m1', USER);
  });

  it('lanza BadRequest si falta un parámetro requerido por la acción', () => {
    expect(() => dispatch({ action: 'decrypt' })).toThrow(BadRequestException);
    expect(() => dispatch({ action: 'delete' })).toThrow(BadRequestException);
    expect(() => dispatch({ action: 'send', subject: 'x' })).toThrow(
      BadRequestException,
    );
  });
});
