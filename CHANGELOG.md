# Changelog — VaxPass

All notable changes to this project are documented here.  
Format: **Added** · **Changed** · **Fixed** · **Known Issues**

Versioning: `MAJOR.MINOR.PATCH`  
When bumping the version, update **both** `web/package.json` and `web/src/version.ts`.

---

## [0.1.4] — 2026-06-09 · Disease risk maps, entry requirements, PHR cross-device fixes

### Added
- **Firestore-backed disease risk maps** — Admins can now view and edit country-level risk data (High / Medium risk country lists + a clinical note) per vaccine directly inside the Admin Library editor. Data is stored in a new `Disease_Risk/{entryId}` collection keyed by vaccine library entry ID. The `DiseaseRiskMap` component fetches Firestore first and falls back to the bundled static data if no document exists.
- **Animal vaccine risk maps** — The geographic risk map panel is now rendered for all vaccine categories, including animal/veterinary entries. Previously it was hidden for the `animal` category. Twelve new static entries were added to `diseaseRiskData.ts` covering FMD, BVD, IBR, Newcastle Disease, Avian Influenza (H5N1), PRRS, Classical Swine Fever, Bovine Brucellosis, Equine Influenza, Equine Herpesvirus (EHV), Canine Distemper, Canine Parvovirus, Feline Panleukopenia, and Leptospirosis.
- **Risk map editor on Admin Animal Library** — `AdminAnimalLibraryPage` gained the same collapsible risk map editor (GeoTagInput for High/Medium countries + note field + Save/Clear) as the human vaccine admin page.
- **Entry requirement countries on vaccine library** — Two new fields on `VaccineLibraryEntry`: `entryRequirementCountries` (comma-separated country list, e.g. `"Kenya, Ghana, Brazil"`) and `entryRequirementNote` (optional clarification). Editable by admins in `AdminLibraryPage` via a GeoTagInput tag widget inside an amber-coloured "Entry Requirements" section.
- **Entry requirement banner in Library Detail** — When `entryRequirementCountries` is set, a prominent 🛂 amber banner appears near the top of the `LibraryDetail` card listing which countries require proof of this vaccine for entry, plus any note.
- **`isEntryRequirement` flag on vaccine records** — When a user adds a vaccine from the library, `isEntryRequirement: true` is written to both `User_Data/{uid}/Vaccines/{id}` and `Public_Vaccines/{id}` if the library entry has entry-requirement countries. The `PublicVerifyPage` now checks this flag first (before the legacy keyword fallback) to categorise vaccines under "Entry Requirements" on the scanned QR page, ensuring the flag is accurate even for vaccines with uncommon names.
- **"Add to…" destination selector on Library entries** — Library detail now shows a multi-destination dropdown ("Add to…") instead of a single "Add to My Vaccines" button when the page has multiple destinations (self, dependants, pets, farm animals, herds). Destinations are grouped with section headings when more than one type is present. No-destination state shows a contextual empty message per category.
- **Device ID for PHR requests** — A stable `vaxpass_device_id` key is now stored in `localStorage` on each device. This ID is included in every PHR auth request document in Firestore (`requestingDeviceId` field).

### Fixed
- **Private Health link missing from desktop sidebar on non-localhost devices** — The "Private Health" nav link in `SideNav` was gated on `getSHQuickAccess(uid)`, which reads a `localStorage` key. On the phone (or any device that hadn't explicitly toggled the setting), that key was absent, hiding the link entirely. The guard was removed — the link now always appears for personal-mode users. The setting toggle inside the Private Health section still controls the home-screen quick-access tile independently.
- **PHR cross-device — PIN never saves when accessing over LAN HTTP** — `window.crypto.subtle` (used by `hashPin` for SHA-256) is only available in secure contexts (HTTPS or `localhost`). When accessing the dev server via a LAN IP address (e.g. `http://192.168.x.x:5173`), it is `undefined`, causing `savePin` to throw silently — the PIN was never persisted, so every session restarted at "Create a PIN". Fixed by adding a pure-JS FNV-1a fallback in `hashPin` for non-secure contexts (prefixed `'fb:'` so hashes set in HTTP-dev and HTTPS-prod never cross-verify). A `try/catch` was also added to `handleSetupConfirm` so any future `savePin` failure surfaces as an on-screen error instead of a silent hang.
- **PHR cross-device — Approval banner showing on the requesting device** — `listenForPendingPHRRequests` queries all `status == 'pending'` docs for a UID, so both the requesting phone and the approving computer received the banner. Fixed by storing `requestingDeviceId` (from the new device ID utility) in the Firestore request doc, then filtering it out in `PHRApprovalBanner` — only sessions with a different device ID see the banner.

### Changed
- `DiseaseRiskMap` now accepts an `entryId` prop; it fetches `Disease_Risk/{entryId}` from Firestore on mount and uses the result in preference to the static `getRiskForDisease` lookup.
- `Disease_Risk/{entryId}` Firestore collection added to rules: `allow read: if true; allow write: if isAdmin()`.

---

## [0.1.3] — 2026-06-09 · Private Health Records, STI Library, SH verification, auto-lock

### Added
- **Private Health Records module** — a PIN-protected section for recording and tracking sexual health test results (`/health/sexual`). Completely separate from the main vaccine record flow.
- **STI Library** (`STI_Library` Firestore collection) — 11 pre-seeded condition entries: HIV, Chlamydia, Gonorrhoea, Syphilis, Herpes (HSV-1/2), HPV, Hepatitis B, Hepatitis C, Trichomoniasis, Mycoplasma, Pubic Lice. Each entry includes: `condition`, `name`, `curability` (`curable` / `clearable` / `lifelong`), `shortDescription`, `symptoms`, `transmission`, `treatment`, `preventionTips`, `whenToTest`, `resources` (linked references), `Created`, `Updated`.
- **STI Library page** (`/health/sexual/library`) — browsable, filterable library of all STI/BBV conditions. Accessible without PIN from within the Private Health section.
- **Curability classification** — three-tier system: `curable` (fully eliminable), `clearable` (manageable/suppressive but not eradicated), `lifelong` (chronic). Affects how `overallStatus` is computed: only `curable` positive results that are old are superseded by newer negatives.
- **SH record verification** — same practitioner verification flow as vaccines. Users can request validation from a practitioner via their email address. On approval, `authentication_level` (1–5) is set on the SH record using the same honour chain logic. `ValidationRequest.record_type` field added (`'vaccine' | 'sexual_health'`) to allow a single `Validation_Requests` collection to handle both.
- **Validation Inbox type badges** — Inbox list items now show a coloured chip: violet `🔒 Private Health` or blue `💉 Vaccine`, making it easy to distinguish request types at a glance.
- **Clinic & practitioner selectors on Add SH Record** — `AddSexualHealthRecordPage` now uses `ClinicCombobox` and `PractitionerCombobox` (same components as the vaccine form) instead of free-text fields. Saves `clinicId` / `practitionerId` alongside display names.
- **Auto-lock on navigation** — the entire Private Health section locks the moment the user navigates away from `/health/sexual/*`. Returning to any route under that path requires PIN re-entry. Implemented via a `SexualHealthLayout` wrapper component using React Router nested routes and a `useEffect` cleanup.
- **QR share for SH records** — users can enable sharing of selected SH records via a unique QR link. Config options: show/hide condition names, show/hide medication, custom message. Share token is generated on first enable and persists.

### Fixed
- **SH settings reverting on exit** — `updateSHConfig` was calling `updateDoc(ref, { sexualHealthConfig: partialUpdates })` which **replaces** the entire nested object in Firestore (not merging). Each toggle was destroying `shareToken`, `showConditionNames`, `showMedication` etc. Fixed by using dot-notation field paths so each field is patched independently:
  ```
  { 'sexualHealthConfig.shareEnabled': true }  // correct — only patches one field
  ```
- **Firestore rules** — added `STI_Library/{entryId}` rule: `allow read: if isSignedIn(); allow write: if isAdmin()`. **Note: rules must be published via Firebase Console to take effect.**

### Changed
- `validationService.ts` `approveValidation` and `rejectValidation` now branch on `record_type`. SH approvals update `User_Data/{uid}/SexualHealth/{id}`; vaccine approvals update `User_Data/{uid}/Vaccines/{id}` and `Public_Vaccines/{id}` as before.
- `ValidationRequest` type now includes optional `record_type?: 'vaccine' | 'sexual_health'` field. Absence defaults to `'vaccine'` for backward compatibility.

---

## [0.1.2] — 2026-06-04 · Clinic/practitioner approval auto-link, admin edit mode, notifications

### Added
- **Admin edit before approving** — Pending Clinics, Practitioners, and Vaccines each have a ✏️ pencil button in the detail panel header. Clicking it switches to an inline edit mode (blue-tinted form) where the admin can correct any field — name, phone, address, category, disease target, etc. — before approving. Changes are applied to the Firestore record and the user's vaccine record in a single action. "Cancel edit" reverts to read-only view without saving.
- **Vaccine saved on clinic/practitioner request** — When a user submits a "Request to add clinic" or "Request to add practitioner" while filling in a vaccine form, the vaccine record is now saved automatically at that moment. The record ID is stored inside the pending request document (`vaccineContext.userVaccineRecordId`).
- **Approval auto-links the clinic/practitioner** — When an admin approves the clinic or practitioner request, the system finds the user's already-saved vaccine record by ID and patches its `Clinic` or `Doctor` field directly. No duplicate record is created; no manual re-entry required. Falls back to creating a new record for legacy pending requests that pre-date this change.
- **User notifications** — In-app notification system (`User_Notifications/{uid}/items`):
  - Approval of a clinic, practitioner, or vaccine request creates an in-app notification with context-appropriate message.
  - Rejection of any request sends both an in-app notification and a push notification (via FCM through the GitHub Actions notifier) with the admin's rejection reason.
- **Notifications page** (`/notifications`) — lists all in-app notifications for the current user, newest first. Approval entries show a green check; rejections show a red X. Vaccine approval cards link directly to the vaccine record. All notifications marked read on page open.
- **Yellow unread dot on profile icon** — A yellow dot badge appears on the Profile tab in the bottom nav when the user has unread notifications.
- **Notifications button in Profile** — "🔔 Notifications" button with unread count badge added to the Profile page, linking to `/notifications`.

### Fixed
- **Auth blank screen after Google sign-in** — New accounts no longer get stuck on an infinite spinner after Google sign-in. Navigation to `/` now fires only after the full `onAuthStateChanged` + `loadProfile` cycle completes, not immediately after `signInWithPopup` resolves.
- **Profile picture leak between accounts** — New accounts now start with a blank profile image (`Profile_Image: ''`) rather than inheriting the Google account's photo URL. The silhouette placeholder displays correctly for accounts without a photo.
- **Firestore rules** — Added read/write rules for `User_Notifications/{uid}/items` (owner read, owner mark-read, admin create). Added admin create permission on `User_Data/{uid}/Vaccines` for auto-vaccine creation on pending approval.
- **Request success message** — When a vaccine was saved alongside a pending clinic/practitioner request, the modal success screen now reads *"Your vaccine record has been saved. Once approved, it will be automatically linked."* instead of the generic approval-only message.

---

## [0.1.1] — 2026-06-03 · Resizable UI, column resize, header consistency

### Added
- **Resizable sidebar** — left navigation panel is now drag-to-resize (min 180 px, max 400 px, default 240 px); width is persisted to `localStorage` (`sidebarWidth`). Increased default width from 224 px (`w-56`) to 240 px for better readability.
- **Resizable split panes** — new shared `ResizableSplitPane` component replaces all fixed-width `w-80` master-detail splits. Drag handle between panels; each page remembers its own preferred width via `localStorage`:
  - `splitPane:myVaccines`, `splitPane:library`
  - `splitPane:adminClinics`, `splitPane:adminPractitioners`, `splitPane:adminLibrary`, `splitPane:adminNotifications`
  - `splitPane:adminFeedNews`, `splitPane:adminFeedSponsored`, `splitPane:adminFeedCrawler`
- **Farm table drag-to-resize columns** — every column header has a drag handle; column widths are persisted to `localStorage` (`farm_table_col_widths_v1`). Double-click a resize handle to reset that column to its default width. "Reset widths" button added to the column settings sheet.

### Changed
- **Clinic dropdown** — removed the 10-result cap (`.slice(0, 10)`) from `ClinicCombobox`; now shows all matching clinics. Added `userCountry` prop: clinics matching the user's country float to the top of the results. Updated all 7 pages that use the combobox to pass `userCountry` from `profile.currentCountry` / `profile.Passport_Issuing_Country`.
- **Practitioner dropdown** — also removed the 10-result cap; full list is now searchable.

### Fixed
- **Back button position** — `max-w-* mx-auto` was mistakenly applied to the inner flex row of sticky headers, causing back buttons to float inward on wide screens. Removed from: `VaccineDetailPage`, `LibraryDetailPage`, `ShareInvitesPage`, and `PageShell` (which covers `PassportPage`, `ValidationInboxPage`, `PeerVerificationInboxPage`, `ProfilePage`).
- **Back button arrow size** — standardised all page-header back-button chevrons to `w-5 h-5 text-gray-600 dark:text-gray-400`, `strokeWidth={2}`, button padding `p-2 -ml-2`. Previously inconsistent across `VaccinesListPage` (blue, `strokeWidth={2.5}`), `LibraryPage` desktop panel (`w-4 h-4`), `FarmPage` / `AddFarmAnimalPage` / `FarmImportPage` / `FarmAnimalDetailPage` (`p-1.5 -ml-1.5`), `VaccinationReportPage` and `CalendarPage` (rounded hover buttons).
- **Page title text size** — standardised all sticky-header `<h1>` titles to `text-lg font-semibold` for single-line headers and `text-base font-semibold` for two-line farm headers (title + subtitle). Previously inconsistent: some were `text-base`, some `font-bold`, some missing a size class entirely, and some used `uppercase tracking-wide`. Pages fixed: `VaccinesListPage`, `PetVaccineDetailPage`, `DependentVaccineDetailPage`, `AddVaccinePage`, `AddDependentVaccinePage`, `AddPetVaccinePage`, `AddFarmAnimalVaccinePage`, `VaccineDetailPage`, `LibraryDetailPage`, `ShareInvitesPage`, `LibraryPage` (desktop panel), `AddFarmAnimalPage`, `FarmImportPage`, `FarmPage`.

### Known Issues
- None tracked at this time

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

## Issues & Backlog

Open issues, planned features, and the shipped-items reference have moved to **[BACKLOG.md](./BACKLOG.md)**.
