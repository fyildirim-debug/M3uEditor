# M3U Playlist Editor
**Tarih:** 2026-03-11

## Özet
IPTV playlist yönetimi için REST API ve Vue 3 frontend. M3U format desteği, EPG entegrasyonu ve Xtream Codes API client ile kapsamlı kanal yönetimi sağlar.

## Yapı
- Kök: package.json, knexfile.js, docker-compose.yml, Dockerfile
- Backend: src/ → controllers/, routes/, models/, services/, parsers/, middleware/, utils/
- Frontend: frontend/src/ → views/, stores/, router.js, App.vue
- Test: tests/ (Jest + Supertest + fast-check)

## Teknoloji
**Backend:** Node.js + Express + PostgreSQL + Knex ORM
**Frontend:** Vue 3 + Vite + Pinia + Vue Router
**Auth:** JWT + bcryptjs
**DevOps:** Docker Compose, PostgreSQL 16 Alpine

## Özellikler
- M3U playlist import/export ve parsing
- EPG (Electronic Program Guide) yönetimi
- Xtream Codes API entegrasyonu (live/VOD/series)
- JWT authentication ve kullanıcı yönetimi
- Fuzzy search (PostgreSQL trigram)
- Kanal kategorileme, sıralama ve bulk işlemler
- Docker containerization

## İstatistik
Dosya: 50+ JS/Vue dosyalar, Teknoloji: Node.js + Express + Vue 3 + PostgreSQL
