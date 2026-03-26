# M3U Playlist Editor
**Tarih:** 2026-03-26

## Ozet
IPTV playlist yonetimi icin full-stack uygulama. Xtream Codes API entegrasyonu (live/VOD/series), M3U parse/export, EPG yonetimi, metadata (film/dizi bilgileri), fuzzy search ve bulk islemler ile kapsamli kanal duzenleme sunar. Vue 3 SPA frontend + Express REST API backend + PostgreSQL veritabani. Surum: v1.4.0.0.

## Yapi
- Kok: package.json, knexfile.js, docker-compose.yml, Dockerfile, dev.sh/bat, start.sh/bat
- Backend (src/):
  - controllers/ (8): auth, category, channel, epg, export, import, playlist + index
  - services/ (8): Auth, Category, Channel(314L), EPG(444L), Export, Import(291L), Playlist, XtreamClient(308L)
  - routes/ (7): auth, categories, channels, epg, export, import, playlists
  - parsers/ (3): M3UParser(195L), M3UFormatter(96L), EPGParser(246L)
  - models/migrations/ (12): users, playlists, categories, channels, epg_sources/channels/programs, pg_trgm, text alterations, stream_type
  - middleware/: auth (JWT), errorHandler
  - config/: database (Knex), jwt, index
  - utils/: AppError (10 hata kodu)
- Frontend (frontend/src/):
  - views/ (3): Login.vue(235L), Dashboard.vue(513L), Editor.vue(2116L — god component)
  - stores/: auth.js (Pinia, 34L)
  - router.js (hash history, auth guard)
  - api.js (Axios + 401 interceptor)
  - langs/: useI18n.js(61L), config.json, tr.json(280L), en.json(280L)
  - style.css (333L — tam design system)
- Tests (tests/unit/): 21 test dosyasi, 271 test (264 passed, 7 failed)

## Teknoloji
**Backend:** Node.js 20 + Express 4.21 + PostgreSQL 16 + Knex 3.1
**Frontend:** Vue 3.5 + Vite 6.3 + Pinia 3 + Vue Router 4 + Axios 1.7
**Auth:** JWT (jsonwebtoken 9) + bcryptjs
**Arama:** PostgreSQL pg_trgm (trigram fuzzy search + ILIKE)
**i18n:** Custom zero-dependency (TR/EN, dot-notation key, placeholder interpolation)
**DevOps:** Docker Compose (db + api + frontend), nginx reverse proxy, multi-stage Dockerfile
**Test:** Jest 29 + Supertest 7 + fast-check (property-based testing)

## Ozellikler
- Xtream Codes API: live/VOD/series import, kategori bazli cekim, retry + exponential backoff
- Xtream sync: kullanici duzenlemelerini koruyarak guncelleme (ON CONFLICT DO UPDATE CASE)
- Xtream metadata: film/dizi bilgileri (ozet, oyuncular, tur, puan, IMDB/TMDB ID)
- M3U URL parse (frontend) + import/export + streaming parser (async generator)
- EPG: kaynak yonetimi, XMLTV parse, auto-match (similarity), 24 saat grid gorunumu, now indicator
- Kanal CRUD + bulk update/move/delete + drag-drop siralama + logo upload (base64)
- Kategori yonetimi + stream_type bazli filtreleme (live/vod/series ayri)
- Sidebar: stream type bazli gruplama (Canli Kanallar, Filmler, Diziler)
- Editor: 5 gorunum (Kanal, Siralama, EPG, Kategori, Guncelle) + M3U indirme + paylasim linki
- EPG autocomplete + kanal adi/EPG ID onerisi + EPG logosunu alma
- Dashboard: playlist CRUD, istatistikler, skeleton loading
- JWT auth + route guard + 401 auto-redirect
- Docker containerization (production profili)
- Kanal reset: orijinal Xtream degerlerine geri donme
- Parola guc olceri (login sayfasi)

## Veritabani Tablolari (7)
users, playlists (xtream credentials + share_token + stream_types), categories (sort_order), channels (original_name/logo, sort_order, extras:jsonb, stream_type), epg_sources, epg_channels, epg_programs

## API Endpoints (30+)
- POST /api/auth/register, /login
- GET/POST/PUT/DELETE /api/playlists
- GET/PUT/DELETE /api/channels + /bulk, /order, /reset, /logo, /metadata
- GET/POST/PUT/DELETE /api/categories + /order
- POST /api/import/xtream (yeni + mevcut), /sync
- GET /api/export/:id, POST /share, GET /shared/:token (public)
- POST/GET/DELETE /api/epg/sources + /refresh, /channels/search, /auto-match, /guide, /preview, /assign

## Bilinen Sorunlar

### Kritik / Bug
1. EPGService.getGuide: `orderBy('position')` — kolon yok, `sort_order` olmali (runtime DB hatasi)
2. epg_programs.end_time NOT NULL ama parser null donebilir — insert hatasi riski

### Guvenlik
3. Stream URL'lerde Xtream sifresi plaintext (`/password/`) — DB'de ve frontend'e acik
4. `cors()` konfigurasyonsuz — tum origin'ler kabul
5. Auth endpoint'lerde rate limiting yok — brute-force riski
6. JWT secret fallback tutarsizligi (config/index.js vs config/jwt.js)
7. xtream_password_enc kolon adi yaniltici — aslinda plaintext

### Mimari
8. channelController.fetchMetadata: is mantigi + direkt DB erisimi controller'da (service'e tasimali)
9. epgController.listSources ve assignEpg: service katmanini bypass ediyor
10. Editor.vue 2116 satir god component — alt component'lere bolunmeli
11. Cift auth state: router guard localStorage, Pinia store ayri — 401 sonrasi tutarsizlik
12. ChannelService.search() var ama hicbir route'a baglanmamis
13. formatDate Dashboard'da hardcoded 'tr-TR' — dil bagimsiz degil

### Performans
14. EPGService.parseAndStore: programlari tek tek insert (batch yok)
15. EPGService.autoMatch: O(channels x epgChannels) — quadratic
16. XtreamClient.getAllChannels: kategori basina ayri API call (paralel degil)
17. updateOrder/delete: N ayri UPDATE sorgusu (bulk UPDATE yerine)
18. EPGParser.parse(): tum XML'i memory'ye yukluyor — buyuk XMLTV icin riskli

### Test
19. xtreamClient.test.js: 5 test basarisiz (yeni field'lar + retry mantigi)
20. app.test.js: 2 test basarisiz (SPA fallback 404'u override ediyor)

### Diger
21. nginx.conf'ta /logos proxy eksik (Vite config'te var, production'da calismiyor olabilir)
22. Migration 009 ve 011 tekrar — ayni kolonlari text'e cevirir
23. No helmet/security headers, no request logging (morgan), no graceful shutdown

## Istatistik
Backend: ~50 JS dosya | Frontend: ~15 dosya (3 Vue, 8 JS/JSON, 1 CSS) | Test: 21 dosya (271 test) | Migration: 12 | Toplam: ~100 dosya | Surum: v1.4.0.0 (15 release)
