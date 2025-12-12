export interface AdminUserPayload {
  userId: string;
  isActive?: boolean;
  isAdmin?: boolean;
  isSupport?: boolean;
  models?: string[];
  isAc?: boolean;
  allowedSpend?: number;
}

export interface AdminUserRecord {
  userId: string;
  active: boolean;
  admin: boolean;
  support: boolean;
  models: string[];
  isAc?: boolean;
  allowedSpend?: number;
  updatedAt?: string;
}

export interface AdminModelPayload {
  name: string;
  modelId: string;
  endpoint: string;
  reasoningEffort?: string;
  isVerify?: boolean;
  timeoutSec?: number;
}

export interface AdminModel {
  id: string;
  name: string;
  modelId: string;
  endpoint: string;
  reasoningEffort?: string;
  isVerify?: boolean;
  timeoutSec?: number;
  updatedAt?: string;
}

export interface AdminDefaultModelPayload {
  modelIds: string[];
  swarmGroup: string;
  orderNumber: number;
  allowedSpend?: number;
}

export interface AdminDefaultModel {
  id: string;
  modelIds: string[];
  swarmGroup: string;
  orderNumber: number;
  allowedSpend?: number;
  updatedAt?: string;
}

export interface AdminUserThreadStats {
  userId: string;
  statuses: Record<string, number>;
}

export interface AdminInitialResponse {
  users: AdminUserRecord[];
  models: AdminModel[];
  defaultModels: AdminDefaultModel[];
  threads?: AdminUserThreadStats[];
}
