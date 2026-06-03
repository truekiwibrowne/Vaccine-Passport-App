# Changelog — VaxPass

All notable changes to this project are documented here.  
Format: **Added** · **Changed** · **Fixed** · **Known Issues**

Versioning: `MAJOR.MINOR.PATCH`  
When bumping the version, update **both** `web/package.json` and `web/src/version.ts`.

---

## [0.1.0] — 2026-06-02 · Initial tracked release

### Added
- **Unified Vaccine Library** (`Vaccine_Library` Firestore collection) covering all categories:
  - `human_adult` — standard adult vaccines
  - `human_child` — paediatric vaccines
  - `animal` — veterinary vaccines (pets, livestock, farm animals)
  - Category filter chips in the Admin Library tab (All / Adults / Children / Animals)
- **Farm Management** — livestock vaccination register with:
  - Configurable table columns (show/hide, drag-to-reorder via ▲/▼, persisted to `localStorage`)
  - Available columns: Tag, Name, Species, Breed, Sex, Date of Birth, Herd, Paddock, Chip ID, National ID, Weight, Purpose, Status
  - Grouped display by herd/flock with herd-level checkbox selection
  - Bulk select → Share (email invite) and Bulk Edit (herd, paddock, status)
  - CSV export and import
  - QR code vaccination passport per animal
  - Shareable access links with `ShareManageModal`
- **Admin Panel** (admin users only, gated by `profile.Admin === true`):
  - Tab navigation: Clinics, Practitioners, Library, Notifications, Feed
  - Desktop split-pane layout (list left, edit/detail right) on all tabs
  - Independent panel scrolling on desktop (`h-screen` container)
  - **Clinics tab** — add, edit, delete, mark as verified
  - **Practitioners tab** — manage verification levels (0–4) for the Honour Verification Chain
  - **Library tab** — search and edit all vaccine library entries across all categories
  - **Notifications tab** — compose and send push notifications to all users or segments
  - **Feed tab** — manage news posts and promoted/sponsored content
- **Honour Verification Chain** — a practitioner's verification level (0–4) determines the trust level assigned to vaccines they approve (`authentication_level = min(practitioner_level + 1, 5)`)
- **Pet management** — vaccine records for pets linked to unified library, species-aware vaccine filtering
- **Dependents management** — vaccine records for children, filtered to `human_child` library entries only
- **Push notifications** — FCM integration with permission request flow in Profile
- **Version display** in Profile page footer (`v0.1.0 · Released 2026-06-02`)
- **Dark mode** toggle in Profile settings

### Changed
- Admin Library tab now shows all vaccines (adults, children, animals) in one list with category filter chips — the separate Animals tab has been removed
- `AddPetVaccinePage` and `AddFarmAnimalVaccinePage` both now source from the unified `Vaccine_Library` (filtered to `category === 'animal'`) instead of the old empty `Animal_Vaccine_Library` collection
- `AddDependentVaccinePage` now filters the library to `human_child` entries only
- Admin Panel outer container changed from `min-h-screen` → `h-screen overflow-hidden` to enable independent split-pane scrolling
- All admin detail panels had `max-w-lg` / `max-w-2xl` width caps removed so they fill available desktop space

### Fixed
- **Farm dashboard tile** — folder icons no longer bleed outside tile boundary (removed negative margin)
- **Home page** — top tile now has correct top gap matching spacing between tiles
- **FAB "Scan Animal Tag"** — now opens the device camera via a hidden `<input capture="environment">` instead of navigating to Farm Management
- **Farm Management header** — action button labels (Select, Export, Import, Add Animal) now hidden on mobile to prevent title squashing; icons remain visible
- **Farm Management desktop columns** — Name, Sex, and Date of Birth are now shown on `lg:` screens (previously only Tag, Species, Breed, Status were shown)
- **Validation Inbox** — added back navigation button (was missing)
- **Farm Management selection mode** — Cancel button added to the bottom action bar in both the empty-selection and has-selection states; previously the only Cancel was a small text button in the top-left header
- **Library right panel** — removed `max-w-2xl` cap that was causing excessive whitespace on wide screens
- **Admin split-pane panels** — all tabs now correctly support independent left/right panel scrolling

### Known Issues
- None tracked at this time

---

## Version Bump Checklist

When releasing a new version:

1. Update `"version"` in `web/package.json`
2. Update `APP_VERSION` and `RELEASE_DATE` in `web/src/version.ts`
3. Add a new `## [x.y.z]` section at the top of this file
4. Commit with message: `chore: bump version to x.y.z`

---

## Issue Tracker

> Open issues are listed here. Move to the relevant version's **Fixed** section once resolved.

| # | Area | Description | Priority |
|---|------|-------------|----------|
| — | — | No open issues at this time | — |

---

## Backlog / Planned Features

| Area | Description |
|------|-------------|
| Farm | Animal weight tracking chart over time |
| Farm | Vet appointment scheduling |
| Pets | Vet appointment reminders |
| Library | Admin bulk-import vaccines from CSV |
| Passport | PDF export of full vaccination record |
| Sharing | Role-based access (view-only vs edit) for shared animals/pets |
| Notifications | Scheduled / recurring vaccine reminder notifications |
| General | Offline support / service worker caching for vaccine records |
