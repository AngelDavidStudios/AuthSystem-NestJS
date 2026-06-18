// Tipos espejo del frontend (Module_WFN-One/src/types/vacation.ts + audit.ts).
// Mantener sincronizados: el SPA consume estos objetos crudos sin transformarlos.

export type VacationType =
  | 'VACATION'
  | 'PERSONAL_LEAVE'
  | 'SICK_LEAVE'
  | 'MATERNITY'
  | 'OTHER';

export type VacationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export const VACATION_TYPES: VacationType[] = [
  'VACATION',
  'PERSONAL_LEAVE',
  'SICK_LEAVE',
  'MATERNITY',
  'OTHER',
];

export interface VacationRequest {
  id: string;
  requesterId: string;
  requesterEmail: string;
  requesterName: string;
  supervisorId: string;
  supervisorEmail: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  type: VacationType;
  reason?: string;
  status: VacationStatus;
  supervisorComment?: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
}

// Lo que se persiste en `wfn-vacation-balances`: solo `totalDays` (asignado por
// admin). usedDays/pendingDays/availableDays se derivan al vuelo de las
// solicitudes para evitar desincronización.
export interface VacationBalanceRecord {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  totalDays: number;
  year: number;
  lastUpdated: string;
  updatedBy: string;
}

// Lo que devuelve la API (record + campos derivados).
export interface VacationBalance extends VacationBalanceRecord {
  usedDays: number;
  pendingDays: number;
  availableDays: number;
}

export type AuditAction =
  | 'REQUEST_CREATED'
  | 'REQUEST_APPROVED'
  | 'REQUEST_REJECTED'
  | 'REQUEST_CANCELLED'
  | 'HIERARCHY_CREATED'
  | 'HIERARCHY_UPDATED'
  | 'HIERARCHY_DELETED'
  | 'USER_ASSIGNED'
  | 'USER_CREATED'
  | 'USER_DELETED'
  | 'ROLE_ASSIGNED'
  | 'ROLE_REMOVED'
  | 'PASSWORD_RESET';

export type AuditEntityType = 'VacationRequest' | 'OrganizationNode' | 'User';

export interface AuditLog {
  id: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  userId: string;
  userEmail: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

// Subconjunto de un nodo organizacional que la creación de solicitudes necesita
// para resolver supervisor. El modelo completo vive en el módulo organization (F2).
export interface OrgNodeRef {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  supervisorId: string;
}

/** Días inclusive entre dos fechas (igual que `calculateDays` del frontend). */
export function calculateDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}
