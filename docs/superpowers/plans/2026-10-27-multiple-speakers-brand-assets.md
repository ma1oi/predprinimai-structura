# Multiple program speakers and brand assets

**Goal:** Use the supplied favicon/OG artwork and support multiple independent speakers for each lecture.

**Implementation:** Keep program items in the existing atomic versioned document; replace the single speaker fields with a `presenters` array (up to 20 per item). Read all legacy formats without rewriting them, retaining names, jobs, photo paths, titles, times and order. The admin provides add/remove controls and separate uploads per person; desktop/mobile render all filled presenters, hiding placeholders as before. Existing carousel management remains independent.

- [x] Add failing storage coverage for multiple presenters, validation, persistence and legacy migrations.
- [x] Update program storage/types, admin forms/uploads and public rendering; bound program requests at 4 MiB for supported maximum content.
- [x] Install supplied PNG favicon and OG artwork, including ICO/Apple icon variants and updated preview URL.
- [x] Verify tests, lint/build and browser CRUD, per-person uploads, responsive rendering and metadata assets; fresh review.

Verification: 30 tests passed, lint/typecheck and production build passed; fresh review had no actionable findings. Browser QA passed with two real independent uploads, save/reload, removing first/last presenter, retained lecture, desktop/mobile layouts, unique field IDs and no browser errors. Open Graph/Twitter/JSON-LD URLs and favicon/Apple/OG response bytes were verified. Temporary upload files were cleaned up.
