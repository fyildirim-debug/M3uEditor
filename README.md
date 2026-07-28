# M3U Playlist Editor

A self-hosted IPTV playlist manager for importing, editing, organizing, exporting, and sharing M3U/Xtream playlists. It includes a responsive Vue interface, XMLTV guide support, multi-user isolation, and a production Docker stack.

## Update notes / Güncelleme notları — 2026-07-28

### English

- **Large Xtream imports:** Replaced serial category-by-category downloads with one bulk request per content type, two-type parallel downloads, bounded fallback for missing categories, bulk category creation, and 1,000-row PostgreSQL upserts. The default response and Node memory limits now support playlists around 150,000 Live/VOD/Series entries.
- **Security hardening:** Added rotating `HttpOnly` refresh sessions, encrypted provider credentials, hashed sensitive tokens, tenant ownership checks, SSRF-resistant remote fetching with DNS pinning and redirect validation, safer upload validation, structured error handling, and hardened browser security headers.
- **Reliability:** Improved Xtream synchronization identity, stale-channel protection, M3U escaping, EPG source isolation, pagination validation, timezone-aware guide queries, and production-safe startup validation.
- **Frontend and accessibility:** Refined the responsive application shell and editor, session recovery, protected routing, keyboard focus trapping, accessible dialogs, empty/error states, and cache behavior.
- **Deployment and quality:** Upgraded to Node.js 22, added reproducible lockfiles, non-root read-only containers, private PostgreSQL networking, health checks, automatic migrations, lint/build validation, dependency audits, and GitHub Actions CI.
- **Verification:** 253 backend tests pass; frontend lint and production build pass; backend and frontend high-severity dependency audits report no vulnerabilities.

### Türkçe

- **Büyük Xtream aktarımları:** Kategori kategori seri indirme kaldırıldı; içerik türü başına tek toplu istek, iki türü paralel indirme, eksik kategoriler için kontrollü geri dönüş, toplu kategori oluşturma ve 1.000 satırlık PostgreSQL upsert paketleri eklendi. Varsayılan yanıt ve Node bellek sınırları yaklaşık 150.000 Canlı TV/VOD/Dizi içeren listeleri destekleyecek şekilde yükseltildi.
- **Güvenlik sıkılaştırması:** Dönen `HttpOnly` yenileme oturumları, şifreli sağlayıcı bilgileri, hash’lenmiş hassas tokenlar, kullanıcı sahipliği kontrolleri, DNS sabitleme ve yönlendirme doğrulamalı SSRF koruması, güvenli dosya doğrulama, yapılandırılmış hata yönetimi ve tarayıcı güvenlik başlıkları eklendi.
- **Güvenilirlik:** Xtream senkronizasyon kimliği, eski kanal silme koruması, M3U kaçış kuralları, EPG kaynak izolasyonu, sayfalama doğrulaması, saat dilimine duyarlı rehber sorguları ve production başlangıç kontrolleri iyileştirildi.
- **Arayüz ve erişilebilirlik:** Responsive uygulama kabuğu ve editör, oturum kurtarma, korumalı rotalar, klavye odak kilidi, erişilebilir diyaloglar, boş/hata durumları ve önbellek davranışı geliştirildi.
- **Dağıtım ve kalite:** Node.js 22’ye geçildi; tekrarlanabilir lockfile’lar, root olmayan salt-okunur container’lar, dışarı açılmayan PostgreSQL, sağlık kontrolleri, otomatik migration, lint/build doğrulaması, bağımlılık denetimleri ve GitHub Actions CI eklendi.
- **Doğrulama:** 253 backend testi, frontend lint ve production build başarılıdır; backend ve frontend yüksek önem seviyeli bağımlılık denetimlerinde açık bulunmamıştır.

## Highlights

- Xtream Codes imports for Live TV, VOD, and Series
- Local or remote M3U import and escaped M3U export
- XMLTV sources, source-scoped channel matching, and timezone-aware guide views
- Category and channel sorting, bulk operations, logo uploads, search, and metadata
- Short-lived access tokens with rotating HttpOnly refresh sessions
- Turkish and English interface, light/dark/system themes, keyboard navigation, and mobile layouts
- PostgreSQL migrations, structured logs, health checks, CI, and hardened containers

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

Copy `.env.example` to `.env`, then set the database and application values. In particular, replace these with independently generated secrets of at least 32 characters:

```env
JWT_SECRET=replace-with-a-long-random-secret
CREDENTIAL_ENCRYPTION_KEY=replace-with-another-long-random-secret
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
- Uploaded logos are size-limited and validated by image signatures; SVG uploads are not accepted.
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
tests/                Jest unit and property tests
```

## License

MIT © Furkan Yıldırım. See [LICENSE](LICENSE).
