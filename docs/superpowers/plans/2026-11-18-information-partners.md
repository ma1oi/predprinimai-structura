# Information partners

**Goal:** Place an «Информационные партнеры» section immediately below registration, using expert-style names/jobs with circular photos and social links, in a slow continuous marquee.

**Approach:** Add independent information-partner records (name, job, uploaded photo, social URL, published flag, explicit order) and an admin tab following the existing partner editor. Use existing private upload/auth/revision patterns. Publish only complete enabled cards; no fabricated blogger data. An empty list hides the entire section. No pause button is shown; the social label is centered independently from the arrow. The marquee pauses on hover/focus, respects reduced motion and hidden/offscreen state, and keeps only original cards in keyboard/screen-reader navigation.

- [x] Validate and persist information partners, covering unsafe URLs/paths, publication, conflicts and damaged storage.
- [x] Add authenticated admin CRUD and public published API, admin navigation and circular image preview.
- [x] Add responsive marquee below the form with name, job and social links; support motion/accessibility states.
- [x] Verify backend tests, lint/typecheck/build, admin CRUD/uploads and desktop/mobile/reduced-motion rendering with isolated fixture data.

Verification: 39 tests, typecheck and lint passed. Production build completed after retrying an existing Next.js security-upgrade nudge; the reported vulnerability should be addressed separately. Browser QA used isolated records and temporary uploads, verifying CRUD/reload/order/publication, 401/409/400, below-form placement, circular photos, animation and pause, keyboard/reduced-motion/single/empty states at1440/390, and no overflow or browser errors. Test uploads were removed. Fresh review found no actionable issues.
