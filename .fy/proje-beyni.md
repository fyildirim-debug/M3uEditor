# M3U Playlist Editor
**Tarih:** 2026-07-28 (v1.7.0.0 sertlestirme surumu sonrasi tam inceleme)

## Ozet
IPTV playlist yonetimi icin full-stack, self-hosted, %100 ucretsiz (MIT) uygulama.
Xtream Codes API entegrasyonu (live/VOD/series), M3U import/export, **XMLTV export**,
EPG yonetimi, film/dizi metadata, trigram fuzzy arama ve toplu islemler.
Vue 3 SPA + Express REST API + PostgreSQL. `xtreamcodesapitom3u` projesinin devami.

## Konumlandirma
"Xtream ve M3U kaynaklarini kendi sunucunda duzenle, eslestir ve
Jellyfin/Plex/Emby/TiviMate icin temiz M3U + XMLTV uret."
Bu proje bir **katalog duzenleyici**dir; tuner emulasyonu, proxy/buffer, DVR veya
transcoding YOKTUR (Threadfin/xTeVe/Dispatcharr bu isi yapar). Rakip
karsilastirmasi `.reports/02-*` icinde.

## Yapi
- Kok: package.json, knexfile.js, docker-compose.yml, Dockerfile, CHANGELOG.md,
  dev.sh/bat, start.sh/bat
- `scripts/`: check-syntax, seed-demo, **make-admin**, **cleanup-logos**
- Backend (`src/`):
  - `controllers/` auth, category, channel, epg, export, import, admin, playlist
  - `services/` Auth, Category, Channel, EPG, Export, **XMLTVExport**, Import,
    Playlist, Email, XtreamClient
  - `routes/` auth, categories, channels, epg, export, import, playlists, admin
  - `parsers/` M3UParser, M3UFormatter, EPGParser, **XMLTVFormatter**
  - `models/migrations/` 18 adet
  - `middleware/` auth (JWT + oturum dogrulama), admin, errorHandler
  - `utils/` AppError, crypto (AES-256-GCM), safeFetch (SSRF korumali), validation,
    **logoStorage**
- Frontend (`frontend/src/`): 12 view + `components/` (AddChannel, StreamTest,
  BulkRename, BulkUpdate, SharePlaylist, EditorFeatureModal), Pinia store,
  hash router, custom zero-dep i18n
- Testler: `tests/unit/` + `tests/helpers/authToken.js` — **32 suite / 381 test**

## Teknoloji
**Backend:** Node.js 22+ / Express 4.21 / PostgreSQL 16 / Knex 3.1 / Pino /
Nodemailer / helmet / express-rate-limit / bcryptjs / jsonwebtoken / uuid
**Frontend:** Vue 3.5 + Vite + Pinia + Vue Router (vanilla CSS)
**Auth:** JWT access (15 dk, iss+aud+exp+sid zorunlu, her istekte DB oturum
dogrulamasi) + HttpOnly SameSite=Strict refresh cookie (7 gun, rotasyonlu,
**aile bazli yeniden-kullanim tespiti**)
**Arama:** pg_trgm (trigram + ILIKE)
**DevOps:** Docker Compose (db + api + frontend nginx), kaynak limitleri,
salt-okunur konteynerler, GitHub Actions CI

## Onemli sozlesmeler (degistirirken dikkat)
- **Siralama komsu tabanlidir**, indeks degil:
  `PUT /api/channels/:id/order {afterChannelId|beforeChannelId}` ve kategori
  esdegeri. Indeks tabanli sozlesmeye GERI DONME — sayfalama/filtre/kirpma
  altinda kacinilmaz olarak bozulur.
- **Toptan silme reddedilir.** Bir icerik turunun mevcut kayitlarinin TAMAMINI
  silecek uzlastirma, saglayici arizasindan ayirt edilemedigi icin atlanir ve
  raporlanir (`skippedRemovalTypes`). Ayni felsefe EPG'de de gecerli: rehberi
  bosaltacak veya yarisindan fazlasini kaybettirecek yenileme `force` olmadan
  uygulanmaz.
- **Xtream tur durumu aciktir.** `getAllChannels` her tur icin
  `{type, status: complete|failed}` doner; yalnizca `complete` turler uzlastirilir.
  Hatalari bos diziye cevirme.
- **sort_order islemleri kume tabanlidir** (ROW_NUMBER / unnest WITH ORDINALITY).
  Satir basina UPDATE dongusune donme.
- **Uzak istekler tek mutlak butce tasir** (`deadline` + paylasilan `byteBudget`);
  yonlendirme ve retry basina sifirlama yapma.
- **Kanal metin alanlari `validateChannelUpdates` ile sinirlanir** (bayt siniri,
  tip, kontrol karakteri reddi). Kolonlar `text` oldugu icin sinir uygulama
  katmanindadir.
- **XMLTV kanal id'leri M3U `tvg-id` ile birebir ayni olmalidir**; aksi halde
  eslesme tuketici tarafta sessizce kirilir.

## Veritabani (8 tablo)
users, sessions (family_id / replaced_by_id / revoke_reason), playlists,
categories, channels, epg_sources, epg_channels, epg_programs

## Bilinen sinirlar (bilincli, v1.8+ icin)
1. **Series ogeleri episode degildir.** `get_series` ust kayitlari kanal gibi
   saklanir; `get_series_info` episode listesi kalici hale getirilmez.
2. **Xtream kimlik bilgileri stream URL'lerinde acik.** Protokol geregi; sifreli
   kolon bunu korumaz. README'de acikca yaziyor.
3. **Uzun isler hala istek omrune bagli.** Eszamanlilik ve iptal eklendi ama
   kalici bir is kuyrugu (SSE ilerleme, yeniden baslatmaya dayanikli) yok.
4. **Snapshot/undo yok.** Destructive akislar geri alinamaz (toptan silme
   korumasi kismen telafi eder).
5. **Rehber gorunumu sanallastirilmis degil** — cok buyuk playlist'lerde tarayici
   zorlanir.
6. **TLS bu yigin tarafindan saglanmaz** — ters proxy zorunlu (README).

## Denetim raporlari
`.reports/` (gitignore'da, yerelde durur):
- `01-stability-performance.md` — 37 bulgu
- `02-ozellikler-yol-haritasi.md` — envanter, rakip analizi, 30+ oneri, yol haritasi
- `03-security-tests.md` — 12 bulgu, dogrulanmis RCE/SQLi/IDOR/XSS yok

## Dogrulama komutlari
```
npm run check && npm run test:ci        # 32 suite / 381 test
npm audit --audit-level=high            # 0
cd frontend && npm run lint && npm run build
node frontend/src/langs/check-parity.js # TR/EN 482-482
npm run make-admin -- <email>
node scripts/cleanup-logos.js           # --delete ile siler
```
