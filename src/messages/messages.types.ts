/** Tipos del módulo de mensajes seguros (reportes confidenciales A → B). */

export const MESSAGE_TYPES = [
  'incident',
  'evaluation',
  'alert',
  'special-request',
] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const CONFIDENTIALITY_LEVELS = [
  'normal',
  'confidential',
  'very-confidential',
] as const;
export type ConfidentialityLevel = (typeof CONFIDENTIALITY_LEVELS)[number];

export const MESSAGE_STATUSES = ['unread', 'read'] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

/**
 * Registro tal cual se persiste en DynamoDB (`wfn-secure-messages`).
 * Los metadatos quedan legibles (se muestran en la bandeja sin descifrar);
 * el contenido sensible vive solo dentro de `encryptedPayload` (cifrado con la
 * data key, que a su vez está cifrada por KMS en `encryptedDataKey`).
 */
export interface SecureMessageRecord {
  messageId: string;
  // --- metadatos visibles en la bandeja (sin decrypt) ---
  subject: string;
  type: MessageType;
  confidentialityLevel: ConfidentialityLevel;
  sentBy: string;
  sentByName: string;
  sentAt: string;
  status: MessageStatus;
  // --- contenido cifrado (opaco fuera del BFF) ---
  encryptedPayload: string;
  encryptedDataKey: string;
}

/** Vista de bandeja: metadatos sin los campos cifrados. */
export type SecureMessageSummary = Omit<
  SecureMessageRecord,
  'encryptedPayload' | 'encryptedDataKey'
>;

/**
 * Contenido completo que el remitente captura en el formulario; es exactamente
 * el JSON que se cifra y, al descifrar, lo que Sistema B muestra.
 */
export interface SecureMessageContent {
  subject: string;
  type: MessageType;
  employee: string;
  eventDate: string;
  confidentialityLevel: ConfidentialityLevel;
  description: string;
  sentBy: string;
  sentByName: string;
  sentAt: string;
}
