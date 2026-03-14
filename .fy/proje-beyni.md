# M3U Playlist Editor
**Tarih:** 2026-03-14

## Ozet
IPTV playlist yonetimi icin full-stack uygulama. Xtream Codes API entegrasyonu, M3U parse/export, EPG yonetimi, fuzzy search ve bulk islemler ile kapsamli kanal duzenleme sunar. Vue 3 SPA frontend + Express REST API backend + PostgreSQL veritabani.

## Yapi
- Kok: package.json, knexfile.js, docker-compose.yml, Dockerfile, dev.sh, start.sh
- Backend (src/):
  - controllers/ (8): auth, category, channel, epg, export, import, playlist + index
  - services/ (8): Auth, Category, Channel, EPG, Export, Import, Playlist, XtreamClient
  - routes/ (7): auth, categories, channels, epg, export, import, playlists
  - parsers/ (3): M3UParser, M3UFormatter, EPGParser
  - models/migrations/ (11): users, playlists, categories, channels, epg_sources/channels/programs, pg_trgm, text alterations
  - middleware/: auth (JWT), errorHandler
  - config/: database (Knex), jwt, index
  - utils/: AppError
- Frontend (frontend/src/):
  - views/ (3): Login.vue, Dashboard.vue, Editor.vue (ana sayfa ~39K token)
  - stores/: auth.js (Pinia)
  - router.js (hash history, auth guard)
  - api.js (Axios)
  - style.css
- Tests (tests/unit/): 21 test dosyasi (Jest + Supertest + fast-check property testing)

## Teknoloji
**Backend:** Node.js + Express 4 + PostgreSQL 16 + Knex ORM
**Frontend:** Vue 3 + Vite 6 + Pinia 3 + Vue Router 4 + Axios
**Auth:** JWT (jsonwebtoken) + bcryptjs
**Arama:** PostgreSQL pg_trgm (trigram fuzzy search + ILIKE)
**DevOps:** Docker Compose (db + api + frontend profilleri), PostgreSQL 16 Alpine
**Test:** Jest 29 + Supertest 7 + fast-check (property-based testing)

## Ozellikler
- Xtream Codes API entegrasyonu (auth, live/VOD/series, kategori bazli cekim, retry + exponential backoff)
- Xtream sync: mevcut playlisti guncellerken kullanici duzenlenmelerini koruma (ON CONFLICT DO UPDATE CASE mantigi)
- M3U URL yapistirma ile Xtream bilgilerini otomatik parse etme (frontend-side URL parsing)
- M3U playlist import/export ve streaming parser (async generator)
- EPG (Electronic Program Guide) kaynak ve program yonetimi
- Kanal CRUD + bulk update/move/delete + drag-drop siralama
- Kategori yonetimi (olustur, duzenle, sil, siralama)
- Trigram fuzzy search (similarity + ILIKE)
- JWT authentication + route guard
- Dashboard: playlist CRUD, istatistikler, skeleton loading
- Editor: 5 gorunum (Kanal Editoru, Siralama, EPG, Kategori, Guncelle) + M3U indirme + paylasim linki
- Docker containerization (production profili)
- Kanal reset: orijinal Xtream degerlerine geri donme

## Veritabani Tablolari
users, playlists (xtream credentials dahil), categories, channels (original_name/logo, sort_order, extras), epg_sources, epg_channels, epg_programs

## API Endpoints
- POST /api/auth/register, /login
- GET/POST/PUT/DELETE /api/playlists
- GET/PUT/DELETE /api/channels, /api/channels/bulk, /api/channels/search, /api/channels/order
- GET/POST/PUT/DELETE /api/categories
- POST /api/import/xtream, /api/import/sync
- GET /api/export/:playlistId
- GET/POST /api/epg

## Istatistik
Backend: 50 JS dosya | Frontend: 9 dosya (3 Vue, 6 JS/CSS) | Test: 21 dosya | Migration: 11 | Toplam: ~90 dosya
