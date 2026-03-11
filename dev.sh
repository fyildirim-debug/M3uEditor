#!/usr/bin/env bash
# ─────────────────────────────────────────────
#  M3U Editor — Geliştirme Başlatıcı
#  Kullanım: ./dev.sh
# ─────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_LOG="$SCRIPT_DIR/.fy/backend.log"
FRONTEND_LOG="$SCRIPT_DIR/.fy/frontend.log"
PID_FILE="$SCRIPT_DIR/.fy/dev.pid"

# Renkler
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

mkdir -p "$SCRIPT_DIR/.fy"

# ── Temizlik ──────────────────────────────────
cleanup() {
  echo -e "\n${YELLOW}Durduruluyor...${RESET}"
  if [ -f "$PID_FILE" ]; then
    while IFS= read -r pid; do
      kill "$pid" 2>/dev/null && echo -e "  ${RED}✕${RESET} PID $pid durduruldu"
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi
  echo -e "${GREEN}✓ Tüm servisler durduruldu.${RESET}"
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── .env kontrolü ─────────────────────────────
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  echo -e "${YELLOW}⚠  .env bulunamadı, .env.example'dan kopyalanıyor...${RESET}"
  cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
  echo -e "${CYAN}   → .env oluşturuldu. DB bilgilerini kontrol et!${RESET}"
fi

# ── Node modules kontrolü ─────────────────────
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  echo -e "${CYAN}Backend bağımlılıkları yükleniyor...${RESET}"
  npm install --prefix "$SCRIPT_DIR" --silent
fi

if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
  echo -e "${CYAN}Frontend bağımlılıkları yükleniyor...${RESET}"
  npm install --prefix "$SCRIPT_DIR/frontend" --silent
fi

# ── PostgreSQL (Docker) ───────────────────────
ensure_postgres() {
  echo -e "${CYAN}▶ PostgreSQL kontrol ediliyor...${RESET}"

  if ! command -v docker &>/dev/null; then
    echo -e "${RED}✕ Docker bulunamadı!${RESET}"
    echo -e "${YELLOW}  Kurmak icin: curl -fsSL https://get.docker.com | sudo sh${RESET}"
    echo -e "${YELLOW}  Veya: https://docs.docker.com/get-docker/${RESET}"
    exit 1
  fi

  # Docker daemon calisiyor mu?
  if ! docker info &>/dev/null 2>&1; then
    echo -e "${YELLOW}  Docker daemon baslatiliyor...${RESET}"

    # Once rootless Docker dene (sudo gerektirmez)
    if systemctl --user start docker 2>/dev/null; then
      sleep 2
    else
      # Sistem geneli Docker'i sudo ile baslat
      echo -e "${YELLOW}  sudo systemctl start docker calistiriliyor...${RESET}"
      echo -e "${YELLOW}  (Sudosuz Docker icin: sudo usermod -aG docker \$USER && newgrp docker)${RESET}"
      sudo systemctl start docker 2>/dev/null || true
    fi

    # Hazir olmasini bekle (max 10 saniye)
    DOCKER_READY=0
    for i in $(seq 1 10); do
      sleep 1
      if docker info &>/dev/null 2>&1; then
        DOCKER_READY=1
        break
      fi
    done

    if [ $DOCKER_READY -eq 0 ]; then
      echo -e "${RED}✕ Docker daemon baslatılamadı!${RESET}"
      echo -e "${YELLOW}  Manuel olarak calistirin: sudo systemctl start docker${RESET}"
      exit 1
    fi
  fi

  # PostgreSQL container calisiyor mu?
  if ! docker compose -f "$SCRIPT_DIR/docker-compose.yml" ps db 2>/dev/null | grep -qE "running|Up"; then
    echo -e "${YELLOW}  PostgreSQL container baslatiliyor...${RESET}"
    docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d db 2>&1 | grep -v "^$" || true
  fi

  # PostgreSQL hazir olana kadar bekle (max 30 saniye)
  echo -e "${YELLOW}  PostgreSQL hazir olana kadar bekleniyor...${RESET}"
  PG_READY=0
  for i in $(seq 1 30); do
    sleep 1
    DB_CONTAINER=$(docker compose -f "$SCRIPT_DIR/docker-compose.yml" ps -q db 2>/dev/null)
    if [ -n "$DB_CONTAINER" ] && docker exec "$DB_CONTAINER" pg_isready -U postgres -q 2>/dev/null; then
      PG_READY=1
      break
    fi
  done

  if [ $PG_READY -eq 0 ]; then
    echo -e "${RED}✕ PostgreSQL baslatılamadı!${RESET}"
    echo -e "${YELLOW}  Son loglar:${RESET}"
    docker compose -f "$SCRIPT_DIR/docker-compose.yml" logs db 2>/dev/null | tail -15
    exit 1
  fi

  echo -e "${GREEN}✓ PostgreSQL hazir${RESET}  (localhost:5432)"
}

ensure_postgres

# ── Baslik ────────────────────────────────────
clear
echo -e "${BOLD}${CYAN}"
echo "  ███╗   ███╗██████╗ ██╗   ██╗"
echo "  ████╗ ████║╚════██╗██║   ██║"
echo "  ██╔████╔██║ █████╔╝██║   ██║"
echo "  ██║╚██╔╝██║ ╚═══██╗██║   ██║"
echo "  ██║ ╚═╝ ██║██████╔╝╚██████╔╝"
echo "  ╚═╝     ╚═╝╚═════╝  ╚═════╝ "
echo -e "${RESET}${BOLD}       M3U Playlist Editor — Dev${RESET}"
echo ""

# ── DB migration ──────────────────────────────
echo -e "${CYAN}▶ DB migration calistiriliyor...${RESET}"
if ! NODE_ENV=development node -e "
  require('dotenv').config({ path: '$SCRIPT_DIR/.env' });
  const knex = require('$SCRIPT_DIR/node_modules/knex');
  const config = require('$SCRIPT_DIR/knexfile');
  const db = knex(config.development);
  db.migrate.latest().then(() => { console.log('Migration OK'); process.exit(0); })
    .catch(e => { console.error('Migration hatasi:', e.message); process.exit(1); });
" 2>&1; then
  echo -e "${YELLOW}  Migration hata verdi, devam ediliyor...${RESET}"
fi

# ── Backend baslat ────────────────────────────
echo -e "${CYAN}▶ Backend baslatiliyor${RESET}  (port 3000)"
node --watch "$SCRIPT_DIR/src/index.js" \
  > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$PID_FILE"

# Backend hazir olana kadar bekle (max 10 saniye)
BACKEND_READY=0
for i in $(seq 1 20); do
  sleep 0.5
  if grep -q "running on port\|listening\|started\|Server" "$BACKEND_LOG" 2>/dev/null; then
    BACKEND_READY=1
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo -e "${RED}✕ Backend baslatılamadı! Log:${RESET}"
    cat "$BACKEND_LOG"
    exit 1
  fi
done

# ── Frontend baslat ───────────────────────────
echo -e "${CYAN}▶ Frontend baslatiliyor${RESET} (port 5173)"
npm run dev --prefix "$SCRIPT_DIR/frontend" \
  > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" >> "$PID_FILE"

# Frontend hazir olana kadar bekle (max 15 saniye)
for i in $(seq 1 30); do
  sleep 0.5
  if grep -q "Local\|localhost\|ready" "$FRONTEND_LOG" 2>/dev/null; then
    break
  fi
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo -e "${RED}✕ Frontend baslatılamadı! Log:${RESET}"
    cat "$FRONTEND_LOG"
    exit 1
  fi
done

echo ""
echo -e "${GREEN}${BOLD}✓ Servisler calisiyor${RESET}"
echo -e "  ${BOLD}PostgreSQL →${RESET}  localhost:5432"
echo -e "  ${BOLD}Backend    →${RESET}  http://localhost:3000"
echo -e "  ${BOLD}Frontend   →${RESET}  http://localhost:5173"
echo ""
echo -e "${YELLOW}Loglar:${RESET}"
echo -e "  Backend  → .fy/backend.log"
echo -e "  Frontend → .fy/frontend.log"
echo ""
echo -e "${YELLOW}Durdurmak icin:${RESET} Ctrl+C"
echo "──────────────────────────────────"

# ── Canli log ─────────────────────────────────
tail -f "$BACKEND_LOG" "$FRONTEND_LOG" &
TAIL_PID=$!
echo "$TAIL_PID" >> "$PID_FILE"

wait $BACKEND_PID $FRONTEND_PID
