export interface YandexDiskSyncStatus {
  configured: boolean;
  syncing: boolean;
  lastSyncedAt: string | null;
  total: number;
  error: string;
  url: string;
  path: string;
}
