@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

:: ─────────────────────────────────────────
::  M3U Editor — Gelistirme Baslatici (Windows)
:: ─────────────────────────────────────────

set "ROOT_DIR=%~dp0"
set "ROOT_DIR=%ROOT_DIR:~0,-1%"
set "FRONTEND_DIR=%ROOT_DIR%\frontend"
set "LOG_DIR=%ROOT_DIR%\.logs"
set "BACKEND_PID="
set "FRONTEND_PID="

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

:: ─── Banner ───
echo.
echo   ███╗   ███╗██████╗ ██╗   ██╗    ███████╗██████╗
echo   ████╗ ████║╚════██╗██║   ██║    ██╔════╝██╔══██╗
echo   ██╔████╔██║ █████╔╝██║   ██║    █████╗  ██║  ██║
echo   ██║╚██╔╝██║ ╚═══██╗██║   ██║    ██╔══╝  ██║  ██║
echo   ██║ ╚═╝ ██║██████╔╝╚██████╔╝    ███████╗██████╔╝
echo   ╚═╝     ╚═╝╚═════╝  ╚═════╝     ╚══════╝╚═════╝
echo.
echo   M3U Playlist Editor — Gelistirme Modu
echo   ─────────────────────────────────────────
echo.

:: ─── [0/4] PostgreSQL (Docker) ───
echo [0/4] PostgreSQL (Docker) kontrol ediliyor...

where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo   X Docker bulunamadi! Docker Desktop yukleyin.
    echo   https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo   ! Docker Desktop calismiyor, baslatiliyor...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" 2>nul
    echo   Bekleniyor...
    set "DOCKER_READY=0"
    for /l %%i in (1,1,30) do (
        timeout /t 2 /nobreak >nul
        docker info >nul 2>&1
        if !errorlevel! equ 0 (
            set "DOCKER_READY=1"
            goto :docker_ok
        )
    )
    if "!DOCKER_READY!"=="0" (
        echo   X Docker baslatilamadi! Docker Desktop'i manuel acin.
        pause
        exit /b 1
    )
)
:docker_ok
echo   + Docker hazir

:: PostgreSQL container kontrol
docker compose -f "%ROOT_DIR%\docker-compose.yml" ps db 2>nul | findstr /i "running Up" >nul 2>&1
if %errorlevel% equ 0 (
    echo   + PostgreSQL container zaten calisiyor
) else (
    echo   → PostgreSQL container baslatiliyor...
    docker compose -f "%ROOT_DIR%\docker-compose.yml" up -d db

    echo   Healthcheck bekleniyor...
    set "PG_READY=0"
    for /l %%i in (1,1,30) do (
        timeout /t 1 /nobreak >nul
        for /f "tokens=*" %%a in ('docker compose -f "%ROOT_DIR%\docker-compose.yml" ps -q db 2^>nul') do (
            docker exec %%a pg_isready -U postgres -q >nul 2>&1
            if !errorlevel! equ 0 (
                set "PG_READY=1"
                goto :pg_ok
            )
        )
    )
    if "!PG_READY!"=="0" (
        echo   X PostgreSQL baslatilamadi!
        docker compose -f "%ROOT_DIR%\docker-compose.yml" logs db 2>nul
        pause
        exit /b 1
    )
)
:pg_ok
echo   + PostgreSQL hazir → localhost:5432

:: ─── .env kontrol ───
if not exist "%ROOT_DIR%\.env" (
    echo.
    echo   ! .env bulunamadi, .env.example kopyalaniyor...
    copy "%ROOT_DIR%\.env.example" "%ROOT_DIR%\.env" >nul
    echo   + .env olusturuldu. Gerekirse duzenleyin.
)

:: ─── [1/4] Bagimliliklar ───
echo.
echo [1/4] Bagimliliklar kontrol ediliyor...

if not exist "%ROOT_DIR%\node_modules" (
    echo   → Backend bagimliliklari yukleniyor...
    cd /d "%ROOT_DIR%" && call npm install --silent
    echo   + Backend hazir
) else (
    echo   + Backend bagimliliklari mevcut
)

if not exist "%FRONTEND_DIR%\node_modules" (
    echo   → Frontend bagimliliklari yukleniyor...
    cd /d "%FRONTEND_DIR%" && call npm install --silent
    echo   + Frontend hazir
) else (
    echo   + Frontend bagimliliklari mevcut
)

:: ─── [2/4] Migration ───
echo.
echo [2/4] DB migration calistiriliyor...
cd /d "%ROOT_DIR%"
call npm run migrate --silent >nul 2>&1
if %errorlevel% equ 0 (
    echo   + Migration tamamlandi
) else (
    echo   X Migration basarisiz!
    echo   .env dosyasindaki DB baglanti bilgilerini kontrol edin.
    pause
    exit /b 1
)

:: ─── [3/4] Backend ───
echo.
echo [3/4] Backend baslatiliyor...
cd /d "%ROOT_DIR%"
start /b "" cmd /c "node --watch src/index.js > "%LOG_DIR%\backend.log" 2>&1"

:: Backend hazir olmasini bekle (max 10sn)
set "BE_READY=0"
for /l %%i in (1,1,20) do (
    timeout /t 1 /nobreak >nul
    findstr /i "listening started running Server" "%LOG_DIR%\backend.log" >nul 2>&1
    if !errorlevel! equ 0 (
        set "BE_READY=1"
        goto :be_ok
    )
)
:be_ok
if "!BE_READY!"=="1" (
    echo   + Backend calisiyor → http://localhost:3000
) else (
    echo   ! Backend baslatildi ama hazir sinyali alinamadi
    echo   + Backend → http://localhost:3000
)
echo   Log: .logs\backend.log

:: ─── [4/4] Frontend ───
echo.
echo [4/4] Frontend baslatiliyor...
cd /d "%FRONTEND_DIR%"
start /b "" cmd /c "npm run dev > "%LOG_DIR%\frontend.log" 2>&1"

:: Frontend hazir olmasini bekle (max 15sn)
set "FE_READY=0"
for /l %%i in (1,1,30) do (
    timeout /t 1 /nobreak >nul
    findstr /i "Local localhost ready" "%LOG_DIR%\frontend.log" >nul 2>&1
    if !errorlevel! equ 0 (
        set "FE_READY=1"
        goto :fe_ok
    )
)
:fe_ok
if "!FE_READY!"=="1" (
    echo   + Frontend calisiyor → http://localhost:5173
) else (
    echo   ! Frontend baslatildi ama hazir sinyali alinamadi
    echo   + Frontend → http://localhost:5173
)
echo   Log: .logs\frontend.log

:: ─── Ozet ───
echo.
echo   ─────────────────────────────────────────
echo   + Tum servisler hazir!
echo.
echo   Backend  API  →  http://localhost:3000
echo   Frontend App  →  http://localhost:5173
echo.
echo   Durdurmak icin: Ctrl+C veya bu pencereyi kapatin
echo   ─────────────────────────────────────────
echo.

:: Acik kal, kullanici kapatana kadar bekle
echo Cikis icin herhangi bir tusa basin...
pause >nul

:: Temizlik: node ve vite processlerini durdur
echo Servisler durduruluyor...
taskkill /f /fi "WINDOWTITLE eq node*" >nul 2>&1
for /f "tokens=2" %%a in ('tasklist /fi "IMAGENAME eq node.exe" /fo list 2^>nul ^| findstr "PID"') do (
    wmic process where "ProcessId=%%a and CommandLine like '%%src/index.js%%'" call terminate >nul 2>&1
)
echo Tum servisler durduruldu.
