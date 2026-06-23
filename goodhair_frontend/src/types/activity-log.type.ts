export type ActivityAction = 'create' | 'update' | 'delete' | 'login';

export interface ActivityChange {
  label: string;
  from: string;
  to: string;
}

// Bản ghi cho list (không kèm changes — payload nhẹ).
export interface ActivityLogListItem {
  id: string;
  createdAt: string;
  actorName: string;
  actorRole: string | null;
  action: ActivityAction;
  module: string;
  entityType: string | null;
  targetLabel: string;
  hasChanges: boolean;
}

// Bản ghi chi tiết (gọi khi bấm xem chi tiết).
export interface ActivityLogDetail extends ActivityLogListItem {
  entityId: string | null;
  ipAddress: string | null;
  changes: ActivityChange[];
}
