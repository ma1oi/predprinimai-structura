export interface YandexWikiSyncStatus {
  configured: boolean;
  syncing: boolean;
  lastSyncedAt: string | null;
  total: number;
  added: number;
  error: string;
  url: string | null;
}
