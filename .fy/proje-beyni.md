# M3U Playlist Editor
**Tarih:** 2026-07-18 (tam inceleme — v1.6.3.0)

## Ozet
IPTV playlist yonetimi icin full-stack, self-hosted, %100 ucretsiz (MIT) uygulama. Xtream Codes API entegrasyonu (live/VOD/series), M3U import/export, EPG yonetimi, metadata (film/dizi), trigram fuzzy search ve bulk islemler. Vue 3 SPA + Express REST API + PostgreSQL. `xtreamcodesapitom3u` projesinin devami. Surum: v1.6.3.0. Premium/plan sistemi kaldirildi (migration 016).

## Yapi
- Kok: package.json, knexfile.js, docker-compose.yml, Dockerfile, dev.sh/bat, start.sh/bat, scripts/seed-demo.js
- Backend (src/):
  - controllers/ (9): auth, category, channel, epg, export, import, admin, playlist + index
  - services/ (9): Auth, Category, Channel, EPG, Export, Import, Playlist, Email, XtreamClient
  - routes/ (8): auth, categories, channels, epg, export, import, playlists, admin
  - parsers/ (3): M3UParser, M3UFormatter, EPGParser (regex tabanli XMLTV + streaming)
  - models/migrations/ (16): users, playlists, categories, channels, epg_*, pg_trgm, text alterations, stream_type, v1_6, admin_and_plans, drop_plan_columns
  - middleware/: auth (JWT Bearer), admin, errorHandler + notFound
  - config/: database (Knex), jwt, index (KULLANILMIYOR — olu kod)
  - utils/: AppError (10 hata kodu + createAppError factory)
- Frontend (frontend/src/) ~5400 satir:
  - views/ (12): Landing(226), Login(259), Dashboard(900), Editor(2372 — god component), Account(214), Admin(751 — ROUTE YOK, erisilemez), ForgotPassword, ResetPassword, Terms, Privacy, NotFound
  - stores/: auth.js (Pinia, 77L)
  - router.js (hash history, guard localStorage okuyor)
  - api.js (Axios + refresh-token interceptor, 71L)
  - langs/: useI18n.js, tr.json/en.json (363 key, tam parite), config.json
  - composables/: useTheme
- Tests (tests/unit/): 21 dosya, ~271 test (264 passed, 7 failed — test-result.txt)

## Teknoloji
**Backend:** Node.js 20 + Express 4.21 + PostgreSQL 16 + Knex 3.1 + Pino 10 + Nodemailer 8 + helmet 8 + express-rate-limit 8 + bcryptjs + jsonwebtoken 9 + uuid 11
**Frontend:** Vue 3.5 + Vite 6 + Pinia 3 + Vue Router 4 + Axios (vanilla CSS, Tailwind yok)
**Auth:** JWT access (24h) + DB'de saklanan random refresh token (7 gun) + bcrypt
**Arama:** PostgreSQL pg_trgm (trigram % + ILIKE)
**i18n:** Custom zero-dep (TR/EN, dot-notation, interpolasyon)
**DevOps:** Docker Compose (db + api + frontend nginx, production profili), multi-stage Dockerfile
**Test:** Jest 29 + Supertest 7 + fast-check (property-based). cross-env NODE_OPTIONS localstorage.

## Ozellikler
- Xtream: live/VOD/series import, kategori bazli cekim, retry+backoff, sync (ON CONFLICT DO UPDATE — kullanici duzenlemesini korur), metadata (get_vod_info/get_series_info), otomatik xmltv.php EPG ekleme + auto-match
- M3U import (icerik/URL) + export (stream_type filtresi, kategori exclude) + streaming parser/formatter (async generator)
- EPG: kaynak yonetimi, batch insert (100'lu), auto-match (similarity 0.5+), gunluk guide grid, autocomplete
- Kanal CRUD + bulk update/move/delete + drag-drop siralama + logo upload (base64→dosya) + bulk rename (find/replace/regex) + stream test + manuel ekleme + reset (orijinal degerler)
- Kategori CRUD + siralama + stream_type filtreleme
- Editor: cok gorunum, M3U indirme, paylasim linki (sure + sifre)
- Auth: register/login/refresh/logout, sifre/e-posta degistirme, hesap silme, sifremi unuttum (SMTP), profil + istatistik
- Admin: getStats, listUsers, updateUser (is_admin), deleteUser — BACKEND VAR ama frontend route'u yok
- Dashboard: playlist CRUD, istatistik, skeleton loading, Xtream URL parse
- JWT guard + 401 refresh interceptor, dark/light/system tema, TR/EN

## Veritabani Tablolari (7)
users (email, password_hash, is_admin, email_verified_at, password_reset_*, refresh_token_*), playlists (xtream creds plaintext, share_token/expires/password, xtream_stream_types), categories (sort_order), channels (original_name/logo, sort_order, extras:jsonb, stream_type), epg_sources, epg_channels, epg_programs (end_time nullable — migration 013)

## API Endpoints (35+)
auth: register, login, refresh, logout, password, email, account(DELETE), profile, forgot-password, reset-password | playlists CRUD | channels CRUD + bulk, bulk-rename, order, reset, logo, metadata, test, manuel create | categories CRUD + order | import/xtream (yeni+mevcut), sync, m3u, add-types | export/:id, share, shared/:token(public) | epg sources CRUD + refresh, channels/search, auto-match, guide, preview, assign | admin stats/users

## COZULEN (eski ledger'da "acik" gorunuyordu)
- EPGService.getGuide artik orderBy('sort_order') (eski 'position' bug'i yok)
- epg_programs.end_time nullable (migration 013)
- CORS (CORS_ORIGIN), helmet, rate-limit, Pino, graceful shutdown, EPG batch insert — hepsi eklendi
- JWT secret fallback config/index.js ve config/jwt.js'te artik tutarli

## Bilinen Sorunlar (2026-07-18 inceleme — GUNCEL)

### Bug (gercek, acik)
1. **channelController.js:212** — rating operator onceligi hatasi: `movieInfo.rating || movieInfo.rating_5based ? String(...) : ...` → rating dolu olsa bile yok sayilip rating_5based'den (cogu 0) hesaplaniyor.
2. **frontend/api.js:38** — `isRefreshing` refresh token YOKKEN hic false'a donmuyor (satir 62-65 branch'inde finally yok) → sonraki 401'ler failedQueue'da asili kaliyor.
3. **frontend/api.js:44-65** — interceptor refresh ve zorunlu logout localStorage'i temizliyor ama Pinia store'u degil → cikistan sonra header "giris yapilmis" gosteriyor; auth.token bayat kaliyor.
4. **Admin.vue** — router.js'te /admin route'u YOK → admin paneli SPA'dan erisilemez (olu kod). Ayrica toast API uyumsuz (toast?.error?.() vs provide edilen showToast(msg,type)) → tum admin toast'lari sessiz no-op; panel %100 hardcoded Turkce (i18n yok).
5. **frontend nginx.conf** — /logos proxy yok → 2-container prod kurulumunda yuklenen logolar kirik (index.html donuyor).
6. **Account.vue:116** — `const user = auth.user` reaktiviteyi kaybediyor (storeToRefs yok); e-posta degisince UI guncellenmez.
7. **Editor.vue** — bulk delete N sirali await (bulk endpoint kullanmiyor); drag reorder hata durumunda geri alinmiyor; autocomplete timer'lar onUnmounted'da temizlenmiyor.

### Guvenlik
8. **trust proxy ayarli degil** (app.js) — nginx arkasinda rate-limit tum kullanicilari tek IP'de sayiyor.
9. **SSRF yuzeyi** — importFromM3U(m3uUrl), testStream, EPGService fetch kullanici URL'lerini dogrulamadan cekiyor.
10. **Xtream sifresi plaintext** — xtream_password_enc kolonu (yaniltici ad) ve stream URL'lerinde acik (IPTV'de kismen kacinilmaz).
11. **Token'lar localStorage'da** — access + refresh token XSS ile sizdirilalabilir.
12. **bulkUpdate/update IDOR** — category_id/epg_channel_id degistirilirken hedefin kullaniciya aitligi dogrulanmiyor (dusuk).
13. **Ilk admin bootstrap yok** — is_admin default false, promote edecek script/seed yok (elle DB).

### Mimari
14. Editor.vue 2372 satir god component (~90 ref, iki mukerrer autocomplete) — bolunmeli.
15. Uclu auth state: localStorage / Pinia / router guard (localStorage okuyor) + refresh mantigi api.js ve stores/auth.js'te cift.
16. channelController.fetchMetadata/bulkRename: is mantigi + dogrudan DB controller'da (service'e); epgController.listSources/assignEpg service bypass.
17. Iki frontend serve yolu: tek-container Dockerfile (express public/) vs docker-compose nginx frontend — kafa karistirici, /logos tutarsizligi buradan.

### Performans
18. EPGService.autoMatch: O(channels × epgChannels) + eslesmeler tek tek UPDATE.
19. XtreamClient.getAllChannels: kategori basina sirali API call (paralel degil).
20. ChannelService.updateOrder/delete: string-interpolate raw CASE UPDATE (parametreli degil; UUID'ler dogrulanmis, dusuk risk).
21. EPGParser.parse(): tum XML memory'de (buyuk XMLTV riski) — streaming parseStream var ama parseAndStore string parse kullaniyor.

### Test / Hijyen
22. test-result.txt: 7 fail — app.test.js 2 (SPA fallback /nonexistent 200 donuyor, test 404 bekliyor), xtreamClient.test.js 5 (yeni alan/retry uyumsuz).
23. Lokal ortamda devDeps (jest, cross-env) kurulu degil → npm test calismiyor.
24. Loglama tutarsiz: errorHandler ve EmailService Pino yerine console.error/warn.
25. Olu kod: ChannelService.search() route'a bagli degil; config/index.js hic import edilmiyor; migration 009 ve 011 neredeyse birebir mukerrer.
26. package-lock.json commit'lenmiyor (.gitignore) → tekrarlanabilir build yok; frontend/dist/index.html bayat artifact repo'da.

## Istatistik
Backend: ~55 JS dosya | Frontend: ~20 dosya (12 Vue) | Test: 21 dosya (271 test) | Migration: 16 | Surum: v1.6.3.0
