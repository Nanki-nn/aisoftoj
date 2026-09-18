// 简化版：AI 功能已从开源版移除，此处仅保留 AdminUsers 页面所需的 mock 接口

export interface AdminAIRolloutStatuses {
  statuses: Record<string, boolean>;
  globally_enabled: boolean;
}

export async function getAdminAIRolloutStatuses(userIds: number[]): Promise<AdminAIRolloutStatuses> {
  return {
    statuses: {},
    globally_enabled: false,
  };
}

export async function enableAdminAIRolloutUser(userId: number): Promise<void> {
  // AI 功能已移除，空操作
}

export async function disableAdminAIRolloutUser(userId: number): Promise<void> {
  // AI 功能已移除，空操作
}