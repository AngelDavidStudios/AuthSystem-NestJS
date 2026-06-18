import { mockClient } from 'aws-sdk-client-mock';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../src/storage/storage.service';
import { AuditRepo } from '../../src/vacation/audit.repo';
import type { CurrentUserData } from '../../src/auth/decorators/current-user.decorator';
import type { Env } from '../../src/config/env.schema';

// getSignedUrl es una función libre del presigner → se mockea con jest.
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async () => 'https://signed.example/url'),
}));
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Mock = mockClient(S3Client);

const BUCKET = 'wfn-profile-pictures';

const USER: CurrentUserData = {
  sub: 'sub-123',
  email: 'user@example.com',
  username: 'jdoe',
  groups: ['Users'],
};
const ADMIN: CurrentUserData = { ...USER, username: 'boss', groups: ['Admins'] };

function makeService(): { service: StorageService; audit: AuditRepo } {
  const config = {
    get: (key: keyof Env) =>
      key === 'AWS_REGION'
        ? 'us-east-1'
        : key === 'S3_BUCKET_PROFILE_PICTURES'
          ? BUCKET
          : undefined,
  } as unknown as ConfigService<Env, true>;
  const audit = { write: jest.fn().mockResolvedValue(undefined) } as unknown as AuditRepo;
  return { service: new StorageService(config, audit), audit };
}

describe('StorageService (S3 profile pictures)', () => {
  beforeEach(() => {
    s3Mock.reset();
    (getSignedUrl as jest.Mock).mockClear();
    (getSignedUrl as jest.Mock).mockResolvedValue('https://signed.example/url');
  });

  describe('getUploadUrl', () => {
    it('firma un PUT para la key del usuario y audita', async () => {
      const { service, audit } = makeService();
      const result = await service.getUploadUrl('image/png', USER);

      expect(result).toEqual({
        uploadUrl: 'https://signed.example/url',
        contentType: 'image/png',
      });
      // La key se deriva del username de sesión, no de un parámetro.
      const [, command] = (getSignedUrl as jest.Mock).mock.calls[0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toMatchObject({
        Bucket: BUCKET,
        Key: 'profile-pictures/jdoe',
        ContentType: 'image/png',
      });
      expect(audit.write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PROFILE_PICTURE_UPDATED',
          entityId: 'jdoe',
        }),
      );
    });

    it('rechaza un content-type no permitido', async () => {
      const { service } = makeService();
      await expect(
        service.getUploadUrl('application/pdf', USER),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(getSignedUrl).not.toHaveBeenCalled();
    });
  });

  describe('getMyPictureUrl', () => {
    it('devuelve una GET URL firmada cuando el objeto existe', async () => {
      const { service } = makeService();
      s3Mock.on(HeadObjectCommand).resolves({});
      const result = await service.getMyPictureUrl(USER);

      expect(result).toEqual({ url: 'https://signed.example/url' });
      const [, command] = (getSignedUrl as jest.Mock).mock.calls[0];
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(command.input).toMatchObject({ Key: 'profile-pictures/jdoe' });
    });

    it('devuelve null cuando no hay foto (HeadObject 404)', async () => {
      const { service } = makeService();
      s3Mock
        .on(HeadObjectCommand)
        .rejects(Object.assign(new Error('not found'), { name: 'NotFound' }));
      const result = await service.getMyPictureUrl(USER);

      expect(result).toEqual({ url: null });
      expect(getSignedUrl).not.toHaveBeenCalled();
    });

    it('propaga errores que no son 404', async () => {
      const { service } = makeService();
      s3Mock
        .on(HeadObjectCommand)
        .rejects(Object.assign(new Error('denied'), { name: 'AccessDenied' }));
      await expect(service.getMyPictureUrl(USER)).rejects.toThrow('denied');
    });
  });

  describe('getUserPictureUrl', () => {
    it('un usuario normal no puede ver la foto de otros', async () => {
      const { service } = makeService();
      await expect(
        service.getUserPictureUrl('someone', USER),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('un admin firma la GET de la key del usuario consultado', async () => {
      const { service } = makeService();
      s3Mock.on(HeadObjectCommand).resolves({});
      const result = await service.getUserPictureUrl('jdoe', ADMIN);

      expect(result).toEqual({ url: 'https://signed.example/url' });
      const [, command] = (getSignedUrl as jest.Mock).mock.calls[0];
      expect(command.input).toMatchObject({ Key: 'profile-pictures/jdoe' });
    });
  });

  describe('delete', () => {
    it('borra la key del usuario actual y audita', async () => {
      const { service, audit } = makeService();
      s3Mock.on(DeleteObjectCommand).resolves({});
      const result = await service.delete(USER);

      expect(result).toEqual({ message: 'Foto de perfil eliminada' });
      const call = s3Mock.commandCalls(DeleteObjectCommand)[0];
      expect(call.args[0].input).toMatchObject({
        Bucket: BUCKET,
        Key: 'profile-pictures/jdoe',
      });
      expect(audit.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PROFILE_PICTURE_DELETED' }),
      );
    });
  });
});
