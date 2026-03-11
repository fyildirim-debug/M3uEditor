#!/bin/bash

# ─────────────────────────────────────────
#  M3U Editor — Geliştirme Başlatıcı
# ─────────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
LOG_DIR="$ROOT_DIR/.logs"
BACKEND_PID=""
FRONTEND_PID=""

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

mkdir -p "$LOG_DIR"

cleanup() {
  echo -e "\n${YELLOW}Durduruluyor...${NC}"
  [[ -n "$BACKEND_PID" ]]  && kill "$BACKEND_PID"  2>/dev/null
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null
  wait 2>/dev/null
  echo -e "${GREEN}Tüm servisler durduruldu.${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

print_banner() {
  echo -e "${CYAN}${BOLD}"
  echo "  ███╗   ███╗██████╗ ██╗   ██╗    ███████╗██████╗ "
  echo "  ████╗ ████║╚════██╗██║   ██║    ██╔════╝██╔══██╗"
  echo "  ██╔████╔██║ █████╔╝██║   ██║    █████╗  ██║  ██║"
  echo "  ██║╚██╔╝██║ ╚═══██╗██║   ██║    ██╔══╝  ██║  ██║"
  echo "  ██║ ╚═╝ ██║██████╔╝╚██████╔╝    ███████╗██████╔╝"
  echo "  ╚═╝     ╚═╝╚═════╝  ╚═════╝     ╚══════╝╚═════╝ "
  echo -e "${NC}"
  echo -e "${BOLD}  M3U Playlist Editor — Geliştirme Modu${NC}"
  echo -e "  ─────────────────────────────────────────"
}

check_docker() {
  if ! command -v docker &>/dev/null; then
    echo -e "  ${RED}✗ Docker bulunamadı!${NC}"
    echo -e "  ${YELLOW}  Kurmak için: curl -fsSL https://get.docker.com | sudo sh${NC}"
    exit 1
  fi

  if ! docker info &>/dev/null; then
    echo -e "  ${YELLOW}→ Docker daemon başlatılıyor...${NC}"

    # Önce rootless Docker dene (sudo gerektirmez)
    if ! systemctl --user start docker 2>/dev/null; then
      # Sistem geneli Docker — sudo gerekebilir
      echo -e "  ${YELLOW}  (İpucu: sudo usermod -aG docker \$USER && newgrp docker ile sudosuz çalışabilirsin)${NC}"
      sudo systemctl start docker 2>/dev/null || true
    fi

    for i in {1..10}; do
      sleep 1
      if docker info &>/dev/null; then
        echo -e "  ${GREEN}✔ Docker hazır${NC}"
        return
      fi
    done

    echo -e "  ${RED}✗ Docker başlatılamadı!${NC}"
    echo -e "  ${YELLOW}  Manuel: sudo systemctl start docker${NC}"
    exit 1
  fi
}

check_postgres() {
  echo -e "\n${BLUE}${BOLD}[0/4] PostgreSQL (Docker) kontrol ediliyor...${NC}"
  check_docker

  # Zaten ayakta mı?
  if docker compose -f "$ROOT_DIR/docker-compose.yml" ps db 2>/dev/null | grep -q "running\|Up"; then
    echo -e "  ${GREEN}✔ PostgreSQL container zaten çalışıyor${NC}"
    return
  fi

  echo -e "  ${YELLOW}→ PostgreSQL container başlatılıyor...${NC}"
  docker compose -f "$ROOT_DIR/docker-compose.yml" up -d db

  # Healthcheck'i bekle (max 30sn)
  for i in {1..30}; do
    sleep 1
    STATUS=$(docker compose -f "$ROOT_DIR/docker-compose.yml" ps db --format json 2>/dev/null \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Health','') if isinstance(d,dict) else d[0].get('Health',''))" 2>/dev/null)
    if [[ "$STATUS" == "healthy" ]]; then
      echo -e "  ${GREEN}✔ PostgreSQL hazır${NC} ${CYAN}→ localhost:5432${NC}"
      return
    fi
    # pg_isready fallback
    if docker exec "$(docker compose -f "$ROOT_DIR/docker-compose.yml" ps -q db)" \
        pg_isready -U postgres -q 2>/dev/null; then
      echo -e "  ${GREEN}✔ PostgreSQL hazır${NC} ${CYAN}→ localhost:5432${NC}"
      return
    fi
  done

  echo -e "  ${RED}✗ PostgreSQL başlatılamadı!${NC}"
  docker compose -f "$ROOT_DIR/docker-compose.yml" logs db | tail -20
  exit 1
}

check_env() {
  if [[ ! -f "$ROOT_DIR/.env" ]]; then
    echo -e "${YELLOW}⚠  .env bulunamadı, .env.example kopyalanıyor...${NC}"
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    echo -e "${GREEN}✔  .env oluşturuldu. Gerekirse düzenleyin.${NC}"
  fi
}

check_deps() {
  echo -e "\n${BLUE}${BOLD}[1/4] Bağımlılıklar kontrol ediliyor...${NC}"

  if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
    echo -e "  ${YELLOW}→ Backend bağımlılıkları yükleniyor...${NC}"
    cd "$ROOT_DIR" && npm install --silent
    echo -e "  ${GREEN}✔ Backend hazır${NC}"
  else
    echo -e "  ${GREEN}✔ Backend bağımlılıkları mevcut${NC}"
  fi

  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    echo -e "  ${YELLOW}→ Frontend bağımlılıkları yükleniyor...${NC}"
    cd "$FRONTEND_DIR" && npm install --silent
    echo -e "  ${GREEN}✔ Frontend hazır${NC}"
  else
    echo -e "  ${GREEN}✔ Frontend bağımlılıkları mevcut${NC}"
  fi
}

run_migrations() {
  echo -e "\n${BLUE}${BOLD}[2/4] DB migration çalıştırılıyor...${NC}"
  cd "$ROOT_DIR"
  if npm run migrate --silent 2>&1; then
    echo -e "  ${GREEN}✔ Migration tamamlandı${NC}"
  else
    echo -e "  ${RED}✗ Migration başarısız!${NC}"
    echo -e "  ${YELLOW}  .env dosyasındaki DB bağlantı bilgilerini kontrol edin.${NC}"
    exit 1
  fi
}

start_backend() {
  echo -e "\n${BLUE}${BOLD}[3/4] Backend başlatılıyor...${NC}"
  cd "$ROOT_DIR"
  node --watch src/index.js > "$LOG_DIR/backend.log" 2>&1 &
  BACKEND_PID=$!

  # Hazır olmasını bekle (max 10sn)
  for i in {1..20}; do
    sleep 0.5
    if grep -q "listening\|started\|running\|Server" "$LOG_DIR/backend.log" 2>/dev/null; then
      break
    fi
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
      echo -e "  ${RED}✗ Backend başlatılamadı! Log:${NC}"
      cat "$LOG_DIR/backend.log"
      exit 1
    fi
  done

  echo -e "  ${GREEN}✔ Backend çalışıyor${NC} ${CYAN}→ http://localhost:3000${NC}"
  echo -e "  ${YELLOW}  Log: .logs/backend.log${NC}"
}

start_frontend() {
  echo -e "\n${BLUE}${BOLD}[4/4] Frontend başlatılıyor...${NC}"
  cd "$FRONTEND_DIR"
  npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
  FRONTEND_PID=$!

  # Hazır olmasını bekle (max 15sn)
  for i in {1..30}; do
    sleep 0.5
    if grep -q "Local\|localhost\|ready" "$LOG_DIR/frontend.log" 2>/dev/null; then
      break
    fi
    if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
      echo -e "  ${RED}✗ Frontend başlatılamadı! Log:${NC}"
      cat "$LOG_DIR/frontend.log"
      exit 1
    fi
  done

  FRONTEND_URL=$(grep -oP 'http://localhost:\d+' "$LOG_DIR/frontend.log" | head -1)
  echo -e "  ${GREEN}✔ Frontend çalışıyor${NC} ${CYAN}→ ${FRONTEND_URL:-http://localhost:5173}${NC}"
  echo -e "  ${YELLOW}  Log: .logs/frontend.log${NC}"
}

print_summary() {
  echo -e "\n  ─────────────────────────────────────────"
  echo -e "  ${GREEN}${BOLD}✔ Tüm servisler hazır!${NC}"
  echo -e ""
  echo -e "  ${BOLD}Backend  API${NC}  →  ${CYAN}http://localhost:3000${NC}"
  echo -e "  ${BOLD}Frontend App${NC}  →  ${CYAN}http://localhost:5173${NC}"
  echo -e ""
  echo -e "  ${YELLOW}Durdurmak için: Ctrl+C${NC}"
  echo -e "  ─────────────────────────────────────────\n"
}

# ─── Ana Akış ───
print_banner
check_postgres
check_env
check_deps
run_migrations
start_backend
start_frontend
print_summary

# Süreçler çalıştığı sürece bekle
wait "$BACKEND_PID" "$FRONTEND_PID"
