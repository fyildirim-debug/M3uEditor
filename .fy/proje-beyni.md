# M3U Playlist Editor
**Tarih:** 2026-11-22 (tam denetim + duzeltme turu sonrasi; ayrinti `.fy/denetim-2026-11-22.md`)

## Ozet
IPTV playlist yonetimi icin full-stack, self-hosted, %100 ucretsiz (MIT) uygulama.
Xtream Codes API entegrasyonu (live/VOD/series), M3U import/export, XMLTV export,
EPG yonetimi, film/dizi metadata, trigram fuzzy arama, toplu islemler, zamanlanmis
otomasyon (sync/yedek/saglik taramasi) ve kullanicinin kendi OpenAI-uyumlu
saglayicisiyla calisan **162 aracli yapay zeka asistani**.
Vue 3 SPA + Express REST API + PostgreSQL. `xtreamcodesapitom3u` projesinin devami.

## Konumlandirma
"Xtream ve M3U kaynaklarini kendi sunucunda duzenle, eslestir ve
Jellyfin/Plex/Emby/TiviMate icin temiz M3U + XMLTV uret."
Bu proje bir **katalog duzenleyici**dir; tuner emulasyonu, proxy/buffer, DVR veya
transcoding YOKTUR (Threadfin/xTeVe/Dispatcharr bu isi yapar).

## Yapi (~46k satir / 222 dosya, lock haric ~37k)
- Kok: package.json, knexfile.js, docker-compose{,.dokploy,.dev-ports}.yml,
  Dockerfile, CHANGELOG.md, dev.sh/bat, start.sh/bat
- `scripts/`: check-syntax, seed-demo, make-admin, reset-password, cleanup-logos
- Backend (`src/`):
  - `controllers/` 17 adet: auth, category, channel, epg, epgLibrary, export,
    import, admin, playlist, source, streamHealth, view, filterRule, backup,
    xtreamOutput, **ai**
  - `services/` 21 adet: Auth, Category, Channel, EPG, EpgLibrary, Export,
    XMLTVExport, XtreamOutput, Import, Playlist, PlaylistSource, Email,
    XtreamClient, **Scheduler**, **Backup**, **StreamHealth**, **FilterRule**,
    **View**, **AIService** + `ai/helpers.js` + `ai/tools/` (8 modul)
  - `routes/` 17 dosya, hepsi `/api` uzerine monte (+ `/api/admin`, kok Xtream)
  - `parsers/` M3UParser, M3UFormatter, EPGParser, XMLTVFormatter
  - `models/migrations/` **28 adet**
  - `middleware/` auth (JWT + oturum dogrulama), admin, errorHandler
  - `utils/` AppError, crypto (AES-256-GCM), safeFetch (SSRF korumali),
    validation, urls, logoStorage
- Frontend (`frontend/src/`): 11 view + 13 component (AiAssistant, AiSettingsForm,
  MarkdownText, XtreamImportWizard, XtreamOutputModal, ViewProfilesModal ...),
  tek Pinia store (auth), hash router, custom zero-dep i18n (TR/EN 774-774)
- Testler: `tests/unit/` + `tests/integration/` — **55 suite / 736 test**
  (728 gecer, 8 yalnizca `RUN_DB_TESTS=1` ile calisan DB testi)

## Teknoloji
**Backend:** Node.js 22+ / Express 4.21 / PostgreSQL 16 / Knex 3.1 / Pino /
Nodemailer / helmet / express-rate-limit / bcryptjs / jsonwebtoken / safe-regex2 /
ipaddr.js / uuid
**Frontend:** Vue 3.5 + Vite + Pinia + Vue Router + axios (vanilla CSS)
**Auth:** JWT access (15 dk, iss+aud+exp+sid zorunlu, her istekte DB oturum
dogrulamasi) + HttpOnly SameSite=Strict refresh cookie (7 gun, rotasyonlu,
aile bazli yeniden-kullanim tespiti)
**Arama:** pg_trgm (trigram + ILIKE)
**DevOps:** Docker Compose (db + api + frontend nginx), kaynak limitleri,
salt-okunur konteynerler, GitHub Actions CI

## Onemli sozlesmeler (degistirirken dikkat)
- **Siralama komsu tabanlidir**, indeks degil:
  `PUT /api/channels/:id/order {afterChannelId|beforeChannelId}` ve kategori
  esdegeri. Indeks tabanli sozlesmeye GERI DONME.
- **Toptan silme reddedilir** (`skippedRemovalTypes`) — ancak esik su an yalnizca
  %100 kayip; oransal esige cikarilmali (bkz. denetim K5).
- **Xtream tur durumu aciktir.** `getAllChannels` her tur icin
  `{type, status: complete|failed}` doner; yalnizca `complete` turler uzlastirilir.
- **sort_order islemleri kume tabanlidir** (ROW_NUMBER / unnest WITH ORDINALITY).
- **Uzak istekler tek mutlak butce tasir** (`deadline` + paylasilan `byteBudget`);
  yonlendirme ve retry basina sifirlama yapma. (Butce su an istemci basina, is
  basina degil — `syncAllSources` bunu katliyor.)
- **Kanal metin alanlari `validateChannelUpdates` ile sinirlanir.**
  `createChannel` bu sozlesmeyi atliyor (denetim ORTA).
- **XMLTV kanal id'leri M3U `tvg-id` ile birebir ayni olmalidir.**
- **AI kimligi yalnizca oturumdan gelir.** `sanitizeArgs` model argumanlarindaki
  `userId`/`is_admin` gibi anahtarlari ayiklar; katalogda yonetici araci yoktur.
  Bu sozlesmeyi bozma — IDOR savunmasinin tamami buna dayaniyor.
- **Tek izin kapisi `tools.execute()`.** `invoke_capability` de oradan gecer.
  Onay/yikici/adim kaydi kararlari `resolveCall()` ile sarmalanan GERCEK araca
  bakar. Yeni arac eklerken: veri kaybettiriyorsa `destructive: true`, kalici
  ve disa donukse `requiresApproval: true` (ya da args alan fonksiyon), gorev
  icinde calismamaliysa `taskRunAllowed: false`.
- **Gorev calistirmasi sinirlidir:** bagli listeden baskasina dokunamaz
  (`ctx.taskPlaylistId`), gorev kuramaz/degistiremez, yikici izni kullanici
  ayarini asamaz; yikici gorev listeye bagli olmak zorunda.
- **Kayitli gizli deger yalnizca kaydedildigi kokene gider**
  (`utils/origin.js#sameOrigin`): AI API anahtari ve Xtream parolasi.
- **Elle verilen EPG eslesmesi `channels.epg_locked=true`.** Otomatik eslestirme
  kilitli kanala hic dokunmaz, varsayilan olarak yalnizca bos olanlari doldurur.
  EPG yazan her yeni yol kilidi ayarlamali.
- **Sync kullanici siralamasini ve kategori tasimalarini korur**
  (`original_category_id`); yeni kanallar mevcut max sort_order'in sonuna eklenir.
- **Toptan silme esigi oransal:** >=20 kanalli bir turde %30'dan fazlasi
  kaybolacaksa o tur icin silme atlanir (`skippedRemovalTypes`).
- **Zamanlayici geri cekilmesi:** basarisiz sync/EPG `*_next_attempt_at` ile
  ustel bekler (5 dk - 24 sa); basarisizken sync oncesi yedek alinmaz.
  En kisa aralik `MIN_SYNC_INTERVAL_MINUTES` (15).
- **Yedek retention tur basina 10:** manual, pre-sync, scheduled, ai-task ayri.
- **Import kilidi `services/ImportJobs.js`'te ortak:** HTTP import, zamanlanmis
  sync ve geri yukleme ayni kilidi kullanir (geri yukleme mesgulse 409).

## Veritabani (16+ tablo)
users, sessions (family_id / replaced_by_id / revoke_reason), playlists,
categories, channels, epg_sources, epg_channels, epg_programs, playlist_sources,
filter_rules, backups, epg_match_profiles, playlist_views, ai_settings,
ai_conversations, ai_messages

## Yapay zeka asistani (v1.10)
- `POST /api/ai/chat` sunucu tarafinda OpenAI tarzi function-calling dongusu
  calistirir; adim siniri 1-25 (varsayilan 12).
- **162 arac = 159 alan araci + 3 meta** (playlists 22, categories 27,
  channels 37, epg 29, imports 21, exports 18, account 5 + search_capabilities,
  describe_capability, invoke_capability).
- `DEFAULT_TOOL_LIMIT=120` nedeniyle her turda ilk 117 alan araci + 3 meta
  gonderilir; kalan 42 arac yalnizca meta kesifle erisilebilir.
- API anahtari AES-256-GCM ile sifreli; istemciye yalnizca `hasApiKey` doner.
- Cikti `MarkdownText.vue` ile once kacislanip sonra etiketlenir — XSS yok.

## Denetimde dogrulanan guvenlik durumu (2026-11-22 itibariyla)
Temiz: SQLi, XSS, IDOR, RCE, XXE, path traversal, JWT alg confusion,
DNS rebinding, decimal/oktal IP bypass.
2026-11-22 turunda kapatilanlar: invoke_capability izin atlatmasi, gorevlerin
onay/yikici atlatmasi, Xtream parolasi ve AI anahtarinin baska kokene sizmasi,
cift onay, bozuk sohbet gecmisi, paylasim token'inin loglara dusmesi,
`TRUST_PROXY=true` cokmesi, npm audit (0 acik). Ayrinti: `.fy/denetim-2026-11-22.md`.

## Bilinen sinirlar (bilincli)
1. **Series ogeleri episode degildir.** `get_series` ust kayitlari kanal gibi
   saklanir; `get_series_info` episode listesi kalici hale getirilmez.
2. **Xtream kimlik bilgileri stream URL'lerinde acik.** Protokol geregi. Ancak
   paylasim linki (`/api/shared/:token`) bu URL'leri kimlik dogrulamasiz
   yayinliyor — Xtream cikisi bunu cozuyor ama paylasimda kullanilmiyor.
3. **Uzun isler hala istek omrune bagli.** Kalici bir is kuyrugu yok; import
   mutex'i sadece surec-ici Map'te ve HTTP yolunda (scheduler + AI onu atliyor).
4. **Snapshot/undo yok** — yedekleme kismen telafi ediyor.
5. **Rehber gorunumu sanallastirilmis degil** — cok buyuk playlist'lerde tarayici
   zorlanir; EPG rehberi render basina binlerce Date tahsis ediyor.
6. **TLS bu yigin tarafindan saglanmaz** — ters proxy zorunlu.
7. **Tek surec varsayimi:** rate limit sayaclari, import mutex'i, scheduler ve
   saglik taramasi kilidi bellekte; yatay olceklenemez.

## Dogrulama komutlari
```
npm run check && npm run test:ci        # 55 suite / 736 test
RUN_DB_TESTS=1 npm run test:ci -- --testPathPatterns=integration
npm audit --audit-level=high            # 0 acik
cd frontend && npm run check            # lint + build
cd frontend && npm audit --audit-level=high   # 0 acik
node frontend/src/langs/check-parity.js # TR/EN 848-848
npm run make-admin -- <email>
node scripts/cleanup-logos.js           # --delete ile siler
```
Not: `npm run test:property` `--passWithNoTests` ile calisir; depoda hic
`*.property.js` yok, `fast-check` kullanilmiyor.
Ajan worktree'leri `.claude/worktrees/` altindaysa jest'e
`--testPathIgnorePatterns /\.claude/` verin; yoksa onlarin testleri de kosar.

## Surum durumu
`package.json` x2 = **1.10.0**, `.fy/version.json` = 1.10.0.0; CHANGELOG'da
buyuk bir `[Unreleased]` bolumu var (surum numarasi verilmedi).

## Masaustu uygulamasi (desktop/)
Electron 45 kabugu; ayni src/ ve frontend kodu. Ana surec `desktop/main/main.js`,
arka uc `utilityProcess` icinde `server-entry.js` (gomulu PostgreSQL + Express).
- PostgreSQL: `@embedded-postgres/<platform>` 18.x ikilileri, kendi yoneticimiz
  `main/postgres.js` (initdb ICU, 127.0.0.1, soket kapali, pg_ctl stop -m fast;
  Windows'ta pg_ctl start). Kutuphanenin kendisi KULLANILMIYOR (Windows'ta
  taskkill /f ile olduruyor).
- Veri: userData (`~/.config/M3U Editor`, `%APPDATA%\M3U Editor`): pgdata/,
  data/, logs/, secrets.json (0600), settings.json. secrets.json kaybolursa
  sifreli Xtream parolalari cozulemez.
- Giris ekrani yok: ana surec DESKTOP_LOGIN_TOKEN ile
  `/api/auth/desktop-session` cagirip cerezi pencere oturumuna yazar.
- Portlar: 47821 (uygulama), 47822 (DB); doluysa rastgele, settings'e yazilir.
- Paket: `cd desktop && npm run dist:linux|dist:win`; prepare.js src+dist'i
  kopyalar, Linux'ta PG sembolik baglarini dosyaya cevirir, Windows'ta
  vcruntime140*.dll ekler. Desktop bagimliliklari kokle ESIT olmali
  (`npm run check-deps`). CI: `.github/workflows/desktop.yml`.
- YAYIN: surumu (package.json x3 + lockfile'lar + .fy/version.json + CHANGELOG)
  artirip `.github/release-notes/v<surum>.md` yazip main'e birlestirmek yeter;
  Desktop is akisi etiketi olusturup Releases'ta yayinlar. Bulut oturumu etiket
  ya da release olusturamiyor (proxy 403), bu yuzden yayin CI'dan yapiliyor.
- main korumali (ruleset "main koruması"): PR zorunlu, verify + images yesil.
- Dogrulama (bu ortamda): linux-unpacked + AppImage Xvfb altinda normal
  kullaniciyla acildi, ilk acilis/kalicilik/kill -9 sonrasi kurtarma/cikis
  sonrasi otomatik oturum test edildi. Windows yalnizca CI'da derlenir/test edilir.

## Dagitim notu
`SEARXNG_SECRET` artik ZORUNLU (`openssl rand -hex 32`); Dokploy ortaminda
tanimli degilse compose baslamaz. SearXNG imaji tarih etiketiyle sabit.
Migration 34 (zamanlayici/EPG kilidi) ve 40 (AI varsayilanlari) var; 35-39 bos.
