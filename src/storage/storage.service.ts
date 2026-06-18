import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator';
import { AuditRepo } from '../vacation/audit.repo';
import type { Env } from '../config/env.schema';

const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];
const UPLOAD_URL_TTL = 300; // 5 min — ventana para que el navegador haga el PUT
const GET_URL_TTL = 900; // 15 min — vida de la URL de visualización (<img src>)
const ADMIN_GROUP = 'Admins';
const MANAGER_GROUP = 'Managers';

/**
 * Almacenamiento de fotos de perfil en S3 vía el BFF (patrón presigned URL).
 *
 * El navegador NUNCA habla con AWS directamente: el BFF firma una URL temporal
 * y el cliente hace PUT/GET contra S3 con ella. El bucket es privado (block
 * public access ON); las lecturas también van firmadas. La key es
 * determinística — `profile-pictures/<username>` — así que no hace falta una
 * tabla de metadata: la existencia se comprueba con HeadObject y el content-type
 * vive en el propio objeto S3. Identidad = `username` Cognito (igual que el
 * resto del módulo de vacaciones), de modo que un usuario solo puede
 * escribir/borrar SU propia key (derivada de la sesión, no de un parámetro).
 */
@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly audit: AuditRepo,
  ) {
    this.s3 = new S3Client({
      region: config.get('AWS_REGION', { infer: true }),
    });
    this.bucket = config.get('S3_BUCKET_PROFILE_PICTURES', { infer: true });
  }

  /** Presigned PUT para que el usuario suba su propia foto directamente a S3. */
  async getUploadUrl(
    contentType: string,
    user: CurrentUserData,
  ): Promise<{ uploadUrl: string; contentType: string }> {
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new BadRequestException(
        'Tipo de archivo no permitido. Solo: JPG, PNG, GIF, WEBP',
      );
    }
    const username = this.identityOf(user);
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.keyFor(username),
        ContentType: contentType,
      }),
      { expiresIn: UPLOAD_URL_TTL },
    );

    await this.audit.write({
      action: 'PROFILE_PICTURE_UPDATED',
      entityType: 'User',
      entityId: username,
      userId: user.sub,
      userEmail: user.email ?? '',
    });

    return { uploadUrl, contentType };
  }

  /** Presigned GET de la foto del usuario actual (null si no tiene). */
  async getMyPictureUrl(
    user: CurrentUserData,
  ): Promise<{ url: string | null }> {
    return { url: await this.signGetIfExists(this.identityOf(user)) };
  }

  /** Presigned GET de la foto de otro usuario — solo Admins/Managers. */
  async getUserPictureUrl(
    username: string,
    user: CurrentUserData,
  ): Promise<{ url: string | null }> {
    this.assertManagerOrAdmin(user);
    return { url: await this.signGetIfExists(username) };
  }

  /** Borra la foto del usuario actual. */
  async delete(user: CurrentUserData): Promise<{ message: string }> {
    const username = this.identityOf(user);
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.keyFor(username),
      }),
    );
    await this.audit.write({
      action: 'PROFILE_PICTURE_DELETED',
      entityType: 'User',
      entityId: username,
      userId: user.sub,
      userEmail: user.email ?? '',
    });
    return { message: 'Foto de perfil eliminada' };
  }

  // ---- helpers ----------------------------------------------------------

  /**
   * Firma un GET si el objeto existe. HeadObject devuelve 404 (NotFound) cuando
   * el usuario no tiene foto → null; cualquier otro error (p.ej. permisos) se
   * propaga para no enmascarar fallos reales de infraestructura.
   */
  private async signGetIfExists(username: string): Promise<string | null> {
    const Key = this.keyFor(username);
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key }));
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key }),
      { expiresIn: GET_URL_TTL },
    );
  }

  /** Identidad del módulo: `username` Cognito (cae a `sub` si faltara). */
  private identityOf(user: CurrentUserData): string {
    return user.username ?? user.sub;
  }

  private keyFor(username: string): string {
    return `profile-pictures/${username}`;
  }

  private assertManagerOrAdmin(user: CurrentUserData): void {
    if (
      !user.groups.includes(ADMIN_GROUP) &&
      !user.groups.includes(MANAGER_GROUP)
    ) {
      throw new ForbiddenException('Requiere rol de administrador o manager');
    }
  }
}

/** Detecta el 404 de HeadObject (objeto inexistente) en el SDK v3. */
function isNotFound(error: unknown): boolean {
  const e = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404;
}
