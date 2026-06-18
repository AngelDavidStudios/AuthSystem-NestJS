// Tipos espejo del frontend (Module_WFN-One/src/types/organization.ts).
// El SPA consume estos objetos crudos sin transformarlos.

export interface OrganizationNode {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  // 'ROOT' para nodos raíz; el `id` del nodo supervisor para los demás.
  supervisorId: string;
  position: string;
  department: string;
  level: number;
  createdAt?: string;
  updatedAt?: string;
}

// Nodo enriquecido con hijos para la vista de árbol.
export interface TreeNode extends OrganizationNode {
  children: TreeNode[];
}

// Marcador de raíz para nodos sin supervisor.
export const ROOT = 'ROOT';
