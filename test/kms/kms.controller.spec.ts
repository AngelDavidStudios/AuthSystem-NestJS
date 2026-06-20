import { KmsController } from '../../src/kms/kms.controller';
import { KmsService } from '../../src/kms/kms.service';

function makeController() {
  const service = {
    encrypt: jest
      .fn()
      .mockResolvedValue({ encryptedPayload: 'ep', encryptedDataKey: 'edk' }),
    decrypt: jest.fn().mockResolvedValue('plaintext'),
  } as unknown as KmsService;
  return { controller: new KmsController(service), service };
}

describe('KmsController', () => {
  it('encrypt delega el payload en el service', async () => {
    const { controller, service } = makeController();
    const result = await controller.encrypt({ payload: 'hello' });
    expect(service.encrypt).toHaveBeenCalledWith('hello');
    expect(result).toEqual({ encryptedPayload: 'ep', encryptedDataKey: 'edk' });
  });

  it('decrypt pasa payload + dataKey y envuelve el resultado', async () => {
    const { controller, service } = makeController();
    const result = await controller.decrypt({
      encryptedPayload: 'ep',
      encryptedDataKey: 'edk',
    });
    expect(service.decrypt).toHaveBeenCalledWith('ep', 'edk');
    expect(result).toEqual({ payload: 'plaintext' });
  });
});
