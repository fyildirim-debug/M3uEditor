# Proje Notları
**Güncelleme:** 2026-03-09

## 🔧 Teknik
### API
**Auth:**
- POST /api/auth/register - Kullanıcı kaydı
- POST /api/auth/login - JWT token döner

**Channels:**
- GET /api/playlists/:id/channels - Kanal listesi (auth required)
- PUT /api/channels/:id - Kanal güncelle
- DELETE /api/channels/:id - Kanal sil
- PUT /api/channels/:id/order - Sıralama güncelle
- POST /api/channels/bulk - Toplu işlemler

**Diğer:**
- /api/categories, /api/import, /api/epg, /api/export, /api/playlists
- GET /health - Health check

### DB
**Tablolar:**
- users (id, email, password_hash)
- playlists (id, user_id, name, ...)
- categories (id, playlist_id, name, ...)
- channels (id, playlist_id, category_id, name, logo_url, stream_url, epg_channel_id, sort_order, original_name, extras:jsonb)
- epg_sources, epg_channels, epg_programs

**İlişkiler:**
- channels.playlist_id → playlists.id (CASCADE DELETE)
- channels.category_id → categories.id (SET NULL)
- UNIQUE (playlist_id, stream_url)

**Indexes:**
- idx_channels_playlist_id, idx_channels_category_id
- idx_channels_playlist_sort (playlist_id, sort_order)
- idx_channels_name_trgm (GIN trigram - fuzzy search)

## 📐 Kurallar
### Kod
- Express middleware: CORS, JSON (50mb limit), static files
- JWT auth middleware tüm protected routes'larda
- Error handler ve 404 handler
- Knex migrations: src/models/migrations/

### Güvenlik
- JWT authentication (jsonwebtoken)
- bcryptjs password hashing
- Auth middleware: token validation
- CORS enabled

### İş
- Channels unique per (playlist_id, stream_url)
- Playlist silinince channels cascade delete
- Category silinince channel.category_id SET NULL
- Sort order default: 0
- Extras field: JSONB for flexible data

## 🔐 Servisler
**XtreamClient:**
- Timeout: 120s (büyük kanal listeleri için)
- Retry: 3 attempts, exponential backoff (2s base delay)
- Desteklenen tipler: live, VOD, series
- Methods: authenticate(), getLiveStreams(), getVodStreams(), getSeriesStreams(), getAllChannels()

**Parsers:**
- M3UParser: M3U dosya parsing
- M3UFormatter: M3U format oluşturma
- EPGParser: EPG XML parsing

**Services:**
- AuthService, CategoryService, ChannelService, EPGService
- ExportService, ImportService, PlaylistService

## 🚨 Uyarılar
- XtreamClient: Sağlayıcı limiti aşmak için kategori bazlı çekme kullanılıyor
- PostgreSQL pg_trgm extension gerekli (fuzzy search için)
- Docker: DB health check 5s interval, 5 retries
- Migration otomatik: docker-compose startup'ta `knex migrate:latest`

## 📝 Notlar
- Frontend: Vue 3 SPA, client-side routing (index.html fallback)
- Test: Jest + Supertest + Fast-check (property-based)
- Dev mode: `npm run dev` (--watch flag)
- Production: Docker Compose (port 80 → 3000)
- DB connection pool: min 2, max 10 (production)
