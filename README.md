# M3U Playlist Editor

A self-hosted IPTV playlist manager for importing, editing, organizing, exporting, and sharing M3U/Xtream playlists. It includes a responsive Vue interface, XMLTV guide support, multi-user isolation, and a production Docker stack.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-43853d.svg)](https://nodejs.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-42b883.svg)](https://vuejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13%2B-336791.svg)](https://www.postgresql.org/)
[![100% Free](https://img.shields.io/badge/100%25-FREE-success.svg)](#)

![M3U Playlist Editor – Landing](screenshot/main.png)

## Release notes

Every release is documented in [CHANGELOG.md](CHANGELOG.md), including the audit
finding each change closes.

## Highlights

- Xtream Codes imports for Live TV, VOD, and Series
- Local or remote M3U import and escaped M3U export
- XMLTV sources, source-scoped channel matching, and timezone-aware guide views
- Category and channel sorting, bulk operations, logo uploads, search, and metadata
- Short-lived access tokens with rotating HttpOnly refresh sessions
- Turkish and English interface, light/dark/system themes, keyboard navigation, and mobile layouts
- PostgreSQL migrations, structured logs, health checks, CI, and hardened containers

## Screenshots

### Landing page
Clean entry page with theme-aware hero, language switcher and direct GitHub link.

![Landing page](screenshot/main.png)

### My Playlists
Dashboard showing all playlists with channel counts, stream-type badges (LIVE / VOD / SERIES), creation dates and quick actions for editing or deleting.

![Playlists dashboard](screenshot/playlists.png)

### Xtream Codes import
One-step connect flow. Auto-fills server URL, username and password by parsing a regular `get.php?...` M3U URL, or fill the fields manually. Pick which content types to pull.

![Xtream Codes import](screenshot/addplaylists.png)

### Channel Editor (Live)
Three-pane editor: stream-type sidebar, category list, channels table, and an edit panel for the selected channel (logo upload, EPG ID, stream URL, category).

![Channel editor – Live channels](screenshot/editor.png)

### Movie Editor (VOD)
The same editor specialized for movies — separate categories, channel-count badges per category, and a metadata "Fetch Info" action that hydrates titles from external sources.

![Movie editor](screenshot/movieeditor.png)

### EPG Editor
Multi-day TV-guide grid. Add XMLTV sources, auto-match channels by `tvg-id`, then visually inspect the programme schedule per channel.

![EPG editor](screenshot/epgeditor.png)

### Drag-and-drop sorting
Reorder categories on the left, then drag channels on the right. Order is persisted instantly.

![Sorting view](screenshot/shorting.png)

### Account settings
Profile summary, theme switcher (System / Dark / Light) and password change.

![Account settings](screenshot/account.png)

## Requirements

- Node.js 22 or newer
- PostgreSQL 13 or newer (PostgreSQL 16 is used by Docker and CI)
- npm 10 or newer

## Local development

```bash
git clone https://github.com/fyildirim-debug/M3uEditor.git
cd M3uEditor
npm ci
cd frontend
npm ci
cd ..
```

Copy `.env.example` to `.env`, then set the database and application values.
`JWT_SECRET` and `CREDENTIAL_ENCRYPTION_KEY` must be two independently generated
values of at least 32 characters. Production startup rejects the shipped
placeholders, short values, low-entropy values, and reusing one value for both:

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "CREDENTIAL_ENCRYPTION_KEY=$(openssl rand -hex 32)"
```

Create the database and start the application:

```bash
npm run migrate
npm run dev
```

In a second terminal:

```bash
cd frontend
npm run dev
```

The frontend defaults to `http://localhost:5173`; the API and health endpoint default to `http://localhost:3000` and `http://localhost:3000/health`.

## Creating the first admin

First create a regular user account in the application, then grant admin rights to that registered email address:

```bash
npm run make-admin -- <email>
```

On a Docker setup, run the same command inside the API container:

```bash
docker compose exec api npm run make-admin -- <email>
```

Append `--revoke` to the command to remove the privilege.

## Registration and password recovery

Set `ALLOW_REGISTRATION=false` to stop new accounts from being created. The default is `true` for backward compatibility. So a fresh install never locks itself out, the first user can register even when the flag is off while the `users` table is empty; registrations after the first user are rejected. The unauthenticated `GET /api/auth/registration-status` endpoint returns only the current state as `{ "allowed": boolean }`.

When SMTP is not configured, reset a registered user's password to a strong, randomly generated value:

```bash
npm run reset-password -- <email>
```

Append `--password <value>` to set a specific password. All of the user's active sessions are revoked when the password is reset. On a Docker setup, run the command inside the API container:

```bash
docker compose exec api npm run reset-password -- <email>
```

## Docker deployment

Create `.env` from `.env.example`. Generate the two secrets independently — do not reuse one value for both, and do not ship the placeholders:

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "CREDENTIAL_ENCRYPTION_KEY=$(openssl rand -hex 32)"
```

```env
DB_PASSWORD=a-strong-database-password
JWT_SECRET=<output of the first command>
CREDENTIAL_ENCRYPTION_KEY=<output of the second command>
APP_URL=https://m3u.example.com
CORS_ORIGIN=https://m3u.example.com
HTTP_PORT=8080
```

Then run:

```bash
docker compose up -d --build
docker compose ps
```

### TLS is required and is not included

**The Compose stack serves plain HTTP only. It has no TLS listener, certificate, or HTTP-to-HTTPS redirect.** Exposing that port directly to a network you do not control lets anyone on the path read login credentials, bearer tokens, and provider stream URLs, or modify responses. Refresh cookies are marked `Secure` in production, so sessions will not survive a direct HTTP deployment either.

Terminate TLS in front of the stack and keep the container port private:

- Bind the published port to loopback (`HTTP_PORT=8080` and a `127.0.0.1:8080:80` mapping), or attach the frontend to an internal Docker network reachable only by your proxy.
- Put Caddy, Traefik, nginx, or a cloud load balancer in front, terminating HTTPS on 443 and redirecting 80 to 443.
- Forward `X-Forwarded-For` and `X-Forwarded-Proto` from that proxy, and keep `TRUST_PROXY` set to the number of proxies in front of the API — rate limiting keys on the client IP derived from those headers.
- Enable HSTS at the proxy only after HTTPS is verified end to end.

A LAN-only deployment behind a firewall is the one case where plain HTTP is defensible, and even then any client on that LAN can read the traffic.

The API container applies pending migrations before startup. PostgreSQL is not exposed to the host. Uploaded logos and database files use named volumes. The API runs as a non-root user with a read-only root filesystem; the frontend is served by Nginx with security and cache headers.

Private-network remote URLs are blocked by default to prevent SSRF. Only set `ALLOW_PRIVATE_NETWORK_URLS=true` when importing from a trusted service on your own network and after understanding the exposure.

### Large Xtream providers

Xtream imports use one bulk stream request per selected content type and download two content types concurrently. If a provider omits categories from a bulk response, only the missing categories are fetched with bounded concurrency. Channel writes use 1,000-row PostgreSQL batches.

The Docker defaults are sized for playlists with roughly 150,000 Live/VOD/Series entries:

```env
MAX_XTREAM_BYTES=268435456
XTREAM_CATEGORY_CONCURRENCY=8
XTREAM_TYPE_CONCURRENCY=2
NODE_MAX_OLD_SPACE_MB=1536
```

Lower the concurrency values if a provider rate-limits parallel requests. Increase `MAX_XTREAM_BYTES` and `NODE_MAX_OLD_SPACE_MB` together only when a single provider response exceeds the defaults and the host has sufficient memory.

## Xtream Codes output

A playlist can be exposed as an Xtream Codes output via `POST /api/playlists/:id/xtream-output` on the authenticated management API. The response contains the server address, a random username, and a random password to enter into the player. The password is stored AES-256-GCM encrypted and is always shown in plain text to its owner; the configuration — including the password — is returned by every `GET`. `POST /api/playlists/:id/xtream-output/regenerate` immediately invalidates the old password, and `DELETE /api/playlists/:id/xtream-output` turns player access off.

In TiviMate, IPTV Smarters, and similar clients, use `APP_URL` as the server address and the username and password from the activation response. Supported root paths are `/player_api.php`, `/xmltv.php`, `/get.php`, `/live/`, `/movie/`, and `/series/`. Because series data is stored per series rather than per episode, the Xtream response exposes one playable synthetic season/episode per series.

**Security note:** Playback paths do not proxy the stream; they redirect with `302` to the channel's stored upstream address. That address may contain the upstream provider's username and password by Xtream protocol design. Sharing Xtream output credentials therefore effectively shares the provider account and every stream URL in the edited playlist. Share only with people you trust, and revoke access by disabling the output or regenerating the password.

## Verification

```bash
npm run check
npm run test:ci
npm audit --audit-level=high

cd frontend
npm run check
npm audit --audit-level=high
```

CI additionally starts PostgreSQL, applies every migration, verifies the Compose configuration, and builds the production frontend.

## Security model

- Passwords use bcrypt with cost factor 12.
- Access tokens expire after 15 minutes by default and are rejected unless they carry a valid issuer, audience, expiry, and session id; every request revalidates the session against the database, so logout and password changes take effect immediately.
- Refresh tokens are random, hashed at rest, rotated on use, and delivered in `HttpOnly`, `SameSite=Strict` cookies. Replaying an already-rotated token revokes the entire session family, so a stolen token cannot outlive its detection.
- Login, registration, password reset, session refresh, and password-protected share downloads each have their own rate limit; the share limiter is keyed per token so one link cannot exhaust another's budget.
- Writable channel fields are length- and type-checked, and control characters are rejected so exported M3U output cannot be injected with extra lines.
- Saved Xtream passwords and EPG source URLs use AES-256-GCM authenticated encryption. Note that Xtream stream URLs embed the provider username and password by protocol design, so every imported channel row — and every exported or shared M3U — still contains those credentials in clear text. Encrypting the credential column does not protect them from someone who can read the database, a backup, or a shared playlist.
- Share and password-reset tokens are stored as hashes; protected shares use bcrypt passwords.
- Remote M3U, XMLTV, metadata, and stream checks resolve DNS before connection, reject private/reserved addresses, revalidate redirects, enforce timeouts, and cap response sizes.
- Tenant ownership is checked before playlist, category, channel, EPG, upload, export, and admin mutations.
- Uploaded logos are size-limited and validated by image signatures; SVG uploads are not accepted. The cacheable `/logos` route is intentionally unauthenticated, but local logo files are removed when their channel, playlist, or account is deleted, and when a local logo is replaced by an external URL. Run `node scripts/cleanup-logos.js` for a dry-run orphan report or add `--delete` to remove reported orphan files.
- Production startup refuses to boot on missing, short, placeholder, low-entropy, or identical secrets.
- Transport security is **not** provided by this stack; see [TLS is required and is not included](#tls-is-required-and-is-not-included).

Do not commit `.env`, database dumps, exported playlists, or provider credentials. Rotate both application secrets when an environment may have been exposed; existing encrypted credentials must be re-entered after rotating `CREDENTIAL_ENCRYPTION_KEY`.

## Project layout

```text
src/
  config/             Environment, database, JWT, and logger
  controllers/        HTTP request handlers
  middleware/         Authentication, admin, and errors
  models/migrations/  PostgreSQL schema migrations
  parsers/            M3U and XMLTV parsing/formatting
  routes/             Express routers
  services/           Authentication, import, EPG, and domain logic
  utils/              Encryption, SSRF-safe fetch, and validation
frontend/src/         Vue application
screenshot/           UI screenshots used in this README
tests/                Jest unit and property tests
```

## Latest updates

### v1.8.0.0 — 2026-08-01

- **Category-selective sync with a report.** Updating a playlist now asks which
  categories to pull — previous selections come pre-checked, provider-new
  categories are badged "New", and unselected categories are never added (a
  long-standing bug imported them anyway). A report lists added categories,
  new channel names, and updated/removed counts. Per-type selection is
  optional; untouched types are preserved.
- **Xtream output password always visible.** The output password is stored
  AES-256-GCM encrypted (new migration) and shown to its owner on every view,
  with one-click regeneration that instantly invalidates the old password.
  M3U download and Xtream credentials now live in a single "Download Channel
  List" modal.
- **EPG scales to 55k+ channels.** The guide loads channels in pages with
  infinite scroll instead of freezing the browser, program descriptions are
  fetched lazily only when a program is opened, and grid hour lines moved from
  24 DOM nodes per channel to one CSS background.
- **Modal and rendering fixes.** Child component updates suppressed by a toast
  in the same render flush (modals stuck open), playlist deletion of 55k
  channels down from ~13 s to ~0.06 s with spinner feedback, EPG controls
  removed from movie/series editing, and the Xtream import wizard gained a
  Cancel button, a 150 s timeout, and backdrop-click protection.

See [CHANGELOG.md](CHANGELOG.md) for the full history.

## License

MIT © Furkan Yıldırım. See [LICENSE](LICENSE).
