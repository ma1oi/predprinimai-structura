export interface GoogleSheetsSyncStatus {
  configured: boolean;
  syncing: boolean;
  lastSyncedAt: string | null;
  total: number;
  error: string;
  url: string | null;
}
