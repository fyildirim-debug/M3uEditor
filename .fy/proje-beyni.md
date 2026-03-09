# M3U Playlist Editor
**Tarih:** 2026-03-09

## Özet
IPTV playlist yönetimi için REST API ve Vue 3 frontend. M3U format desteği, EPG entegrasyonu ve Xtream Codes API client ile kapsamlı kanal yönetimi sağlar.

## Yapı
- Kök: package.json, knexfile.js, docker-compose.yml, Dockerfile
- Klasörler: src/ (backend), frontend/ (Vue 3 app), tests/ (Jest), public/ (static)

## Teknoloji
**Backend:** Node.js + Express + PostgreSQL + Knex
**Frontend:** Vue 3 + Vite + Pinia + Vue Router
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
Dosya: 50+ JS dosyalar, Teknoloji: Node.js + Express + Vue 3 + PostgreSQL
