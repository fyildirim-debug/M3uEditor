# Changelog

All notable changes to this project are documented here. Dates are ISO-8601.
Versions follow the four-part scheme recorded in `.fy/version.json`.

## [1.7.0.0] — unreleased

Hardening release. The focus is data integrity, authentication strength, and
behaviour at provider scale rather than new surface area. Findings referenced as
`SPR-*` come from the stability/performance audit and `SEC-*` from the security
audit.

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
