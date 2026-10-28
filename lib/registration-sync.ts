import { googleSheetsConfigured, syncGoogleRegistrations } from "./registration-google-sync";
import { yandexWikiConfigured, syncYandexWikiRegistrations } from "./registration-wiki-sync";

export function registrationSyncConfigured() {
  return googleSheetsConfigured() || yandexWikiConfigured();
}

/** Each destination owns its queue and status; neither failure blocks the other. */
export async function syncRegistrationDestinations() {
  await Promise.allSettled([
    Promise.resolve().then(() => syncGoogleRegistrations()),
    Promise.resolve().then(() => syncYandexWikiRegistrations()),
  ]);
}
