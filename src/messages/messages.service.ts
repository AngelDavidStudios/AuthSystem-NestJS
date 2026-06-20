import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator';
import { KmsService } from '../kms/kms.service';
import { MessagesRepo } from './messages.repo';
import type {
  ConfidentialityLevel,
  MessageType,
  SecureMessageContent,
  SecureMessageRecord,
  SecureMessageSummary,
} from './messages.types';

const ADMIN_GROUP = 'Admins';
const MANAGER_GROUP = 'Managers';

function canDelete(user: CurrentUserData): boolean {
  return (
    user.groups.includes(ADMIN_GROUP) || user.groups.includes(MANAGER_GROUP)
  );
}

/** Quita los campos cifrados de un registro para exponer solo metadatos. */
function toSummary(record: SecureMessageRecord): SecureMessageSummary {
  const { encryptedPayload: _p, encryptedDataKey: _k, ...summary } = record;
  return summary;
}

export interface SendMessageInput {
  subject: string;
  type: MessageType;
  employee: string;
  eventDate: string;
  confidentialityLevel: ConfidentialityLevel;
  description: string;
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly kms: KmsService,
    private readonly repo: MessagesRepo,
  ) {}

  /**
   * Encripta el reporte completo con KMS (envelope encryption) y persiste el
   * registro. Los campos sensibles (`employee`, `description`, `eventDate`) van
   * SOLO dentro del payload cifrado; los metadatos quedan legibles para la
   * bandeja. La identidad del remitente sale de la sesión, nunca del body.
   */
  async send(
    input: SendMessageInput,
    user: CurrentUserData,
  ): Promise<{ messageId: string; sentAt: string }> {
    const sentAt = new Date().toISOString();
    const sentBy = user.username ?? user.sub;
    const sentByName = user.name ?? user.username ?? user.email ?? sentBy;

    const content: SecureMessageContent = {
      subject: input.subject,
      type: input.type,
      employee: input.employee,
      eventDate: input.eventDate,
      confidentialityLevel: input.confidentialityLevel,
      description: input.description,
      sentBy,
      sentByName,
      sentAt,
    };

    const { encryptedPayload, encryptedDataKey } = await this.kms.encrypt(
      JSON.stringify(content),
    );

    const record: SecureMessageRecord = {
      messageId: randomUUID(),
      subject: input.subject,
      type: input.type,
      confidentialityLevel: input.confidentialityLevel,
      sentBy,
      sentByName,
      sentAt,
      status: 'unread',
      encryptedPayload,
      encryptedDataKey,
    };

    await this.repo.put(record);
    return { messageId: record.messageId, sentAt };
  }

  /** Bandeja: metadatos de todos los mensajes, sin descifrar nada. */
  async list(): Promise<{ messages: SecureMessageSummary[] }> {
    const records = await this.repo.list();
    return { messages: records.map(toSummary) };
  }

  /**
   * Abre un mensaje (estilo Outlook): descifra el payload con KMS, marca el
   * registro como leído y devuelve el contenido completo. Sistema B llama esto
   * automáticamente al seleccionar un mensaje en la bandeja.
   */
  async decrypt(
    messageId: string,
    _user: CurrentUserData,
  ): Promise<SecureMessageContent & { messageId: string; status: 'read' }> {
    const record = await this.repo.get(messageId);
    if (!record) {
      throw new NotFoundException('Mensaje no encontrado');
    }

    const plaintext = await this.kms.decrypt(
      record.encryptedPayload,
      record.encryptedDataKey,
    );

    let content: SecureMessageContent;
    try {
      content = JSON.parse(plaintext) as SecureMessageContent;
    } catch {
      throw new InternalServerErrorException(
        'El contenido descifrado no es un JSON válido',
      );
    }

    // Marca como leído (idempotente: solo reescribe si cambió el estado).
    if (record.status !== 'read') {
      await this.repo.put({ ...record, status: 'read' });
    }

    return { ...content, messageId, status: 'read' };
  }

  /** Elimina un mensaje. Solo Admins/Managers. */
  async delete(
    messageId: string,
    user: CurrentUserData,
  ): Promise<{ deleted: true }> {
    if (!canDelete(user)) {
      throw new ForbiddenException(
        'No tienes permiso para eliminar mensajes',
      );
    }
    const record = await this.repo.get(messageId);
    if (!record) {
      throw new NotFoundException('Mensaje no encontrado');
    }
    await this.repo.delete(messageId);
    return { deleted: true };
  }
}
