# Google Sheets and Yandex Wiki registration sync

**Goal:** Send registrations to both the existing Google spreadsheet and Yandex Wiki while preserving the local store as the source of truth.

**Approach:** Restore the previous dedicated Google tab exporter and official Google authentication library. Keep independent credentials, queues, statuses and manual sync buttons. Schedule both destinations after saving a registration; a failed provider must not prevent the other provider from running. Preserve existing remote rows and deduplicate by registration ID.

- [x] Restore Google exporter and regression tests; add coverage for independent success/failure and dual automatic dispatch.
- [x] Restore Google authentication/status/queue and connect both providers to registration submission and admin APIs.
- [x] Show independent Google/Wiki status panels and controls, document both configurations.
- [x] Verify tests, lint/typecheck/build, responsive admin UI and real configured service access without printing credentials or personal data.

Verification: 36 tests, lint/typecheck and production build passed. Dual sync test covers both provider failures, local persistence, retries and actual POST-after scheduling. Browser checks passed for separate controls/errors, 401/503, automatic status refresh and desktop/mobile layout. Real legacy Google auth/table access returned200; local record synced to both destinations, repeat added0 to each. Fresh review found stale busy status; fixed with bounded-lifetime polling and browser regression red/green verified. No remaining findings. Existing npm moderate advisories are confined to unchanged ExcelJS/uuid, not the restored authentication dependency.
