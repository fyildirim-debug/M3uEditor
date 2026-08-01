# Changelog

All notable changes to this project are documented here. Dates are ISO-8601.
Versions follow the four-part scheme recorded in `.fy/version.json`.

## [1.9.0.0] — 2026-08-01

Automation release. The editor can now keep playlists fresh on a schedule,
snapshost and restore user edits, check whether streams are alive, merge
multiple providers into one playlist, and filter what ever enters the library.

### Added

- **Scheduled auto-sync.** Playlists and EPG sources accept a refresh interval
  (off / 6h / 12h / 24h / 48h / weekly). A lightweight scheduler ticks every
  minute and syncs due playlists using the same category-selection semantics as
  manual sync (new provider categories are not auto-added), with optional
  pre-sync backup. `PUT /api/playlists/:id/sync-settings` and
  `PUT /api/epg/sources/:id/refresh-settings`.
- **Backup / restore.** One-click gzip snapshots (playlist + categories +
  channels including every user edit) stored on disk with metadata in the new
  `backups` table, automatic retention of the last 10 per playlist, download,
  restore onto a new or existing playlist, and automatic cleanup when the
  playlist is deleted. `GET/POST /api/playlists/:id/backups`,
  `GET /api/backups/:id/download`, `POST /api/backups/:id/restore`,
  `DELETE /api/backups/:id`.
- **Stream health scanning.** `POST /api/playlists/:id/health-scan` walks every
  channel with SSRF-safe HEAD/Range requests (10-way concurrency, 8 s timeout,
  100-row batched writes), records `last_checked_at`/`last_check_ok`/
  `last_check_status`, and reports live progress. The channel table shows
  per-channel health dots; new `dead`/`unchecked` filters surface the results.
- **Regex filter rules.** Ordered include/exclude rules over channel name,
  category, or stream URL, validated with `safe-regex2` and applied before every
  sync/import upsert — excluded records never reach the database. Rules are
  manageable from the Update view with a live pattern tester.
  `GET/POST /api/playlists/:id/filter-rules`, `PUT/DELETE /api/filter-rules/:id`.
- **Multiple Xtream sources per playlist.** Additional provider accounts
  (`playlist_sources` table) sync into the same playlist; same-named categories
  merge naturally. `POST /api/playlists/:id/sync-all` reconciles every source in
  sequence and only removes stale channels when all sources of a type complete,
  so one failing provider cannot delete another's channels.
- **Advanced channel filters.** `?filter=missing_logo|missing_epg|
  duplicate_name|dead|unchecked` on the channel list, with a dropdown and a
  filtered-result counter in the editor.
- **EPG source library.** Built-in iptv-org catalogue: browse countries and
  guide sources, search, and add a source in one click (24 h in-memory cache).
  `GET /api/epg-library/countries`, `GET /api/epg-library/guides`.
- **Saved EPG match profiles.** Auto-match now accepts strip prefixes/suffixes
  and ignore words; profiles are saved per playlist and re-runnable with mapped
  counts and last-run tracking. `GET/POST /api/playlists/:id/epg-profiles`,
  `POST /api/epg-profiles/:id/run`.
- **View profiles.** Named hidden-category sets per playlist; apply a profile
  to re-hide categories instantly, and pick a profile when downloading M3U so
  the export excludes its hidden categories. `GET/POST /api/playlists/:id/views`.
- **Quick wins:** up/down move buttons for sorting on mobile, keyboard
  shortcuts (`/` search, `g`+letter view switching), editor view/stream type in
  the URL (deep link survives reload), styled ConfirmModal replacing every
  native `confirm()`, share-link revocation (`DELETE /api/playlists/:id/share`),
  Xtream credential editing on the playlist, session management
  (`GET/DELETE /api/auth/sessions`) in Account settings, theme switcher in the
  header, and real import progress via `GET /api/import/jobs/active` polling
  instead of a simulated bar.

### Fixed

- Filtered channels were previously indistinguishable in search results — the
  filtered count now renders next to the total.

## [1.8.0.0] — 2026-08-01

Sync experience release. The update flow now mirrors the import wizard —
category selection with previous choices remembered and provider-new categories
badged — and ends with a detailed report. Xtream output credentials are now
visible to their owner at all times. Large-playlist EPG no longer freezes the
browser.

### Added

- **Category-selective sync.** `POST /api/playlists/:id/sync` accepts an optional
  `categories` selection, and `GET /api/playlists/:id/sync/preview` returns
  provider categories with `selected` (kept from previous choices, matching the
  importer's `VOD |`/`Series |` prefixed storage) and `isNew` flags. Previously
  sync silently imported every provider category, including ones the user had
  deliberately excluded at import time. The editor's Update view shows the
  selection panel and a report listing added categories and newly added channel
  names. Per-type selection is optional; unselected types are left untouched.
- **Xtream output password is always visible to its owner.** The password is now
  also stored AES-256-GCM encrypted (migration `20240101000021_add_output_password_enc`)
  alongside the existing hash used for player authentication, so
  `GET /api/playlists/:id/xtream-output` returns it and embeds it in the player
  URLs. Regeneration still invalidates the old password immediately. The editor
  combines M3U download and Xtream credentials into a single "Kanal Listesini
  İndir" modal.
- **EPG guide pagination.** `GET /api/playlists/:id/epg/guide` accepts
  `page`/`limit` (default 100) and returns `total`; the editor loads channels
  incrementally with infinite scroll and a loaded-count indicator. Guide rows no
  longer include program descriptions (up to 50 KB each) — they are fetched
  lazily via the new `GET /api/epg/programs/:id` when a program is opened. Grid
  hour lines moved from 24 DOM nodes per channel to a single CSS background,
  and off-screen rows skip rendering via `content-visibility`.

### Fixed

- **Child component DOM updates were suppressed when a toast fired in the same
  flush** (state changed, UI stayed stale — e.g. the playlist edit modal not
  closing after Save). `showToast` is now deferred to `nextTick` in `App.vue`.
- **Deleting a large playlist took ~13 s with no feedback** because logo cleanup
  issued a blind `unlink` for every channel × extension (222k syscalls at 55k
  channels). Cleanup now scans the upload directory once and only unlinks files
  that exist (~0.06 s), and the delete button shows a spinner and guards against
  double clicks.
- **EPG controls leaked into VOD/Series editing** (EPG id input, broadcast
  section, name autocomplete) — now limited to live TV.
- The Update view had no page scroll; category lists and action buttons below
  the fold were unreachable.
- The Xtream import wizard could trap the user with no way out: it now has a
  Cancel button with `AbortController`, a 150 s request timeout, and no longer
  closes on backdrop click (matching its multi-step, form-heavy nature).

### Changed

- `dev.sh` now includes `docker-compose.dev-ports.yml` when present so the
  development database port is published to loopback (the production compose
  file intentionally exposes none).

## [1.7.0.0] — 2026-07-28

Hardening release. The focus is data integrity, authentication strength, and
behaviour at provider scale rather than new surface area. Findings referenced as
`SPR-*` come from the stability/performance audit and `SEC-*` from the security
audit.

### Added

- **XMLTV output.** The application already downloaded, parsed, and matched EPG
  data, but exposed it to no consumer, so the delivery chain stopped at M3U.
  `GET /api/playlists/:id/xmltv` (authenticated) and `GET /api/shared/:token/xmltv`
  (reusing the existing share token, expiry, and password rules) now stream a
  guide, and shared M3U output carries an absolute `url-tvg` so players find it
  automatically. Channel ids are identical in both formats — otherwise matching
  breaks silently on the consumer side. `GET /api/playlists/:id/epg-coverage`
  reports how much of a playlist actually has guide data.
- **Features that existed only in the API are now in the editor:** adding a
  channel by hand, testing whether a stream is reachable, regex bulk rename,
  bulk field updates, and share links with an expiry and password. Bulk rename
  requires a preview first — `POST /api/channels/bulk-rename/preview` returns the
  first 20 before/after rows and writes nothing.
- `npm run make-admin -- <email>` grants (or, with `--revoke`, removes) admin
  rights. Without it the admin panel was unreachable after a fresh install,
  because `is_admin` defaults to false and nothing could set it.
- `node scripts/cleanup-logos.js` reports orphaned logo files (`--delete` removes
  them).

### Fixed — data loss

- **A transient Xtream failure no longer deletes channels (SPR-001).** VOD and
  series were treated as optional content types, and their errors were flattened
  into empty arrays. When live succeeded and VOD failed, the combined result was
  non-empty, so reconciliation classified every existing VOD row as stale and
  deleted it — together with any manual edits. `getAllChannels` now reports an
  explicit completion status per content type, only completed types are
  reconciled, and a partial sync no longer advances `last_synced_at`.
- **A reconciliation that would remove every row of a content type is refused.**
  A provider outage that returns `200` with an empty list is indistinguishable
  from a genuinely emptied catalogue, so the wholesale removal is skipped and
  reported. Partial removals still apply normally.
- **Xtream requests are no longer retried when retrying cannot help** — permanent
  `4xx` responses and invalid addresses fail immediately; `429` is still retried.

### Fixed — security

- **Access tokens are strictly validated (SEC-06).** The legacy fallback that
  accepted tokens without issuer, audience, or session id has been removed. Every
  request now revalidates the session against the database, so logout and
  password changes take effect immediately.
- **Refresh token reuse is detected (SEC-05).** Sessions carry a family id and a
  replacement pointer. Replaying an already-rotated token revokes the whole
  family, so a stolen token cannot outlive its detection.
- **Production refuses to start on weak secrets (SEC-04).** The documented
  `.env.example` placeholders were long enough to pass the old length check.
  Placeholder, low-entropy, short, and identical `JWT_SECRET` /
  `CREDENTIAL_ENCRYPTION_KEY` values are now rejected with actionable messages.
- **Dedicated rate limits (SEC-09)** for `/api/auth/refresh` (previously exempt)
  and for password-protected share downloads, which run a bcrypt comparison on
  every failed attempt. The share limiter is keyed per token hash plus client IP.
- **Account existence is no longer measurable through response timing (SEC-10).**
- **Writable channel fields are bounded and typed (SEC-01).** Columns are `text`,
  so a single request could previously write a multi-megabyte value to up to
  1,000 rows. Length, type, and control-character checks are enforced centrally,
  which also prevents newline injection into exported M3U output.
- **Remote fetches carry one absolute budget (SEC-02).** Each recursive redirect
  previously started a fresh timeout *and* a fresh byte allowance, and Xtream
  retried on top of that — one call could consume roughly five redirects × 120 s
  × three attempts while downloading a full size limit at every hop. A deadline
  and a shared byte counter now travel through DNS resolution, the whole redirect
  chain, retries, and the decompressed body.
- **Imports are bounded (SEC-02).** One job per user (`409`), a per-playlist lock,
  a global ceiling (`503`), a TTL, and cancellation when the client disconnects
  (`499`) — previously a proxy timeout cut the client off while the backend kept
  working.
- **Uploaded logos are deleted with their owner (SEC-11).** Files survived channel,
  playlist, and account deletion and stayed publicly readable at a guessable URL,
  so data a user believed erased remained available.
- Malformed request bodies and oversized payloads return `400`/`413` instead of
  `500` (SPR-023); logging out with only an access token now really revokes the
  session (SPR-036).

### Fixed — correctness

- **Channel and category ordering uses relative positions.** Drag-and-drop sent
  an index within one category (truncated to 500 rows) while the backend applied
  it as a playlist-global position, so moving a channel inside a category could
  reorder unrelated categories. The API now takes `{ afterChannelId }` or
  `{ beforeChannelId }` (and the category equivalents), which stays correct under
  pagination, filtering, and truncation. Failed drags roll the list back instead
  of silently leaving the UI out of sync, and a truncated sort view says so.
- Excluding a category from an export no longer also drops uncategorized
  channels (SPR-030).
- The stream reachability check no longer treats a `HEAD` response's
  `Content-Length` as an oversized body, which made every check fail (SPR-026).
- Bulk actions no longer include channels hidden by a page, content type, or
  search change, and a late channel response can no longer overwrite the current
  view (SPR-009, SPR-017).
- Changing an account e-mail updates the header immediately (SPR-033).

### Changed — performance

- **Sort order maintenance is set-based.** Reordering or deleting one channel
  issued one `UPDATE` per remaining row. At 20,000 channels, compaction went from
  2,805 ms to 353 ms over a local socket; against a remote database the gain is
  larger still, because 20,000 round trips become one statement (SPR-008).
- **The dashboard playlist list no longer aggregates every user's channels.** The
  grouped subquery scanned the whole `channels` table on each request; a lateral
  per-playlist count made a small account's query 6.3 ms → 0.1 ms while a 60,000
  channel neighbour existed, with identical results (SPR-015).
- **A truncated XMLTV response no longer replaces a working guide (SPR-024).** Only
  the opening `<tv` tag was required, so a proxy or provider returning an
  application-level truncated `200` had its partial prefix accepted and written
  over the existing guide. Document completeness is now validated, and a guide
  that would become empty or lose more than half its rows is refused unless the
  caller passes `force`.
- **EPG ingestion streams instead of buffering.** Peak RSS on a 150,000-programme,
  39 MB guide dropped from 309,828 KiB to 121,084 KiB (−60.9%), at a 14.5% time
  cost. Automatic channel matching went from 3,002 SQL statements to one, with
  identical results.

### Changed — operability

- The README now states plainly that the Compose stack terminates no TLS and
  documents the required reverse-proxy setup (SEC-03), and no longer implies that
  encrypting the stored Xtream password protects credentials that the protocol
  also embeds in every stream URL (SEC-07).
- Password reset requests are logged at error level when SMTP is unconfigured or
  delivery fails. The user-facing response stays generic to avoid disclosing
  account existence, so this log is the only signal an operator gets (SPR-027).
- Application start no longer inherits the 330 s import timeout, which could
  leave the page blank for minutes when the API was unreachable (SPR-021).
