// Espejo de Module_WFN-One/src/services/userManagementApi.ts (CognitoUser).
// El SPA consume este objeto crudo sin transformarlo.
export interface CognitoUser {
  username: string;
  email?: string;
  preferredUsername?: string;
  name?: string;
  status: string;
  enabled: boolean;
  createdAt?: string;
  groups: string[];
}
