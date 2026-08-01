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

## İlk yöneticiyi oluşturma

Önce uygulamada normal bir kullanıcı hesabı oluşturun, ardından kayıtlı e-posta adresine yönetici yetkisi verin:

```bash
npm run make-admin -- <email>
```

Docker kurulumunda aynı komutu API container'ı içinde çalıştırın:

```bash
docker compose exec api npm run make-admin -- <email>
```

Yetkiyi geri almak için komutun sonuna `--revoke` ekleyin.

## Kayıt ve şifre kurtarma

Yeni hesap açılmasını durdurmak için `ALLOW_REGISTRATION=false` ayarlayın. Geriye dönük uyumluluk için varsayılan değer `true`'dur. Temiz kurulumun kilitlenmemesi amacıyla `users` tablosu boşken ilk kullanıcı, bu bayrak kapalı olsa bile kaydolabilir; ilk kullanıcıdan sonra kayıtlar reddedilir. Kimlik doğrulaması gerektirmeyen `GET /api/auth/registration-status` ucu yalnızca etkin durumu `{ "allowed": boolean }` biçiminde döndürür.

SMTP yapılandırılmadığında kayıtlı bir kullanıcının şifresini güçlü, rastgele üretilen bir değerle sıfırlayın:

```bash
npm run reset-password -- <e-posta>
```

Belirli bir şifre vermek için `--password <değer>` ekleyin. Şifre sıfırlandığında kullanıcının tüm aktif oturumları iptal edilir. Docker kurulumunda komutu API container'ı içinde çalıştırın:

```bash
docker compose exec api npm run reset-password -- <e-posta>
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

## Xtream Codes çıkışı

Bir playlist, kimlik doğrulamalı yönetim API'sindeki `POST /api/playlists/:id/xtream-output` isteğiyle Xtream Codes çıkışı olarak etkinleştirilebilir. Yanıtta player'a girilecek sunucu adresi, rastgele kullanıcı adı ve rastgele şifre bulunur. Şifre AES-256-GCM ile şifreli saklanır ve sahibine her zaman açık gösterilir; yapılandırma `GET` ile her görüntülendiğinde şifre de döner. `POST /api/playlists/:id/xtream-output/regenerate` eski şifreyi hemen geçersiz kılar, `DELETE /api/playlists/:id/xtream-output` ise player erişimini kapatır.

TiviMate, IPTV Smarters ve benzeri istemcilerde sunucu adresi olarak `APP_URL`, kullanıcı adı ve şifre olarak etkinleştirme yanıtındaki değerler kullanılır. Uyumlu kök yollar `/player_api.php`, `/xmltv.php`, `/get.php`, `/live/`, `/movie/` ve `/series/` şeklindedir. Dizi verisi uygulamada bölüm bazında değil dizi bazında tutulduğu için Xtream yanıtı her dizi için oynatılabilir tek bir sentetik sezon/bölüm sunar.

**Güvenlik notu:** Oynatma yolları akışı proxy'lemez; `302` ile kanalın kayıtlı yukarı akış adresine yönlendirir. Bu adres, Xtream protokolü gereği yukarı akış sağlayıcının kullanıcı adı ve şifresini içerebilir. Dolayısıyla Xtream çıkış bilgilerini paylaşmak, fiilen sağlayıcı hesabını ve düzenlenmiş playlist içindeki tüm akış adreslerini paylaşmak anlamına gelir. Yalnızca güvendiğiniz kişilerle paylaşın ve erişimi geri almak için çıkışı kapatın veya şifreyi yenileyin.

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

## License

MIT © Furkan Yıldırım. See [LICENSE](LICENSE).
