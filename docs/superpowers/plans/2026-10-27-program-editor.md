# Program editor implementation plan

**Goal:** Edit the complete festival agenda and each item's own speaker in one admin tab with the existing carousel speaker editor.

**Architecture:** Extend the current versioned program-speakers JSON document with event title, time and description. Preserve stable IDs and existing photo paths, migrate legacy documents in memory, and retain atomic saves with revision conflicts. The public schedule reads this same document on desktop and mobile.

**Decisions:** Each agenda item has independent speaker data, as requested. Carousel cards remain independently editable within the same admin tab. Existing content remains intact. Order is explicit and editable; times must be valid increasing intervals, but different events may overlap if an editor chooses them.

- [x] Add regression coverage for legacy migration, creating/removing/reordering items, time validation, empty agenda and concurrent saves.
- [x] Extend program types and storage, keeping the existing authenticated endpoints and upload flow.
- [x] Add title, description, start/end time, add/delete/reorder controls to the program editor; combine admin navigation with carousel editor.
- [x] Render the stored agenda in both responsive layouts, including empty state and derived day start/end.
- [x] Run tests, lint, typecheck, build, and browser checks for admin persistence and desktop/mobile schedule.

Verification: 29 tests passed; lint and production build passed. Isolated browser checks passed for create/edit/reorder/save/reload/delete, revision conflicts, empty agenda and desktop/mobile layouts. Fresh code review found a request-size mismatch; fixed with a bounded 1 MiB allowance for the program endpoint and regression coverage. No remaining important findings.
