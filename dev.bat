@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

:: ─────────────────────────────────────────────
::  M3U Editor — Gelistirme Baslatici (Windows)
::  Kullanim: dev.bat
:: ─────────────────────────────────────────────

set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "FRONTEND_DIR=%SCRIPT_DIR%\frontend"
set "FY_DIR=%SCRIPT_DIR%\.fy"
set "BACKEND_LOG=%FY_DIR%\backend.log"
set "FRONTEND_LOG=%FY_DIR%\frontend.log"

if not exist "%FY_DIR%" mkdir "%FY_DIR%"

:: ── .env kontrolu ───────────────────────────
if not exist "%SCRIPT_DIR%\.env" (
    echo ! .env bulunamadi, .env.example'dan kopyalaniyor...
    copy "%SCRIPT_DIR%\.env.example" "%SCRIPT_DIR%\.env" >nul
    echo   → .env olusturuldu. DB bilgilerini kontrol et!
)

:: ── Node modules kontrolu ───────────────────
if not exist "%SCRIPT_DIR%\node_modules" (
    echo Backend bagimliliklari yukleniyor...
    cd /d "%SCRIPT_DIR%" && npm install --silent
)

if not exist "%FRONTEND_DIR%\node_modules" (
    echo Frontend bagimliliklari yukleniyor...
    cd /d "%FRONTEND_DIR%" && npm install --silent
)

:: ── PostgreSQL (Docker) ─────────────────────
echo.
echo + PostgreSQL kontrol ediliyor...

where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo   X Docker bulunamadi!
    echo   https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo   Docker Desktop calismiyor, baslatiliyor...
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

:: PostgreSQL container kontrol
docker compose -f "%SCRIPT_DIR%\docker-compose.yml" ps db 2>nul | findstr /i "running Up" >nul 2>&1
if %errorlevel% neq 0 (
    echo   PostgreSQL container baslatiliyor...
    docker compose -f "%SCRIPT_DIR%\docker-compose.yml" up -d db
)

:: PostgreSQL hazir olana kadar bekle (max 30 saniye)
echo   PostgreSQL hazir olana kadar bekleniyor...
set "PG_READY=0"
for /l %%i in (1,1,30) do (
    timeout /t 1 /nobreak >nul
    for /f "tokens=*" %%a in ('docker compose -f "%SCRIPT_DIR%\docker-compose.yml" ps -q db 2^>nul') do (
        docker exec %%a pg_isready -U postgres -q >nul 2>&1
        if !errorlevel! equ 0 (
            set "PG_READY=1"
            goto :pg_ok
        )
    )
)
if "!PG_READY!"=="0" (
    echo   X PostgreSQL baslatilamadi!
    docker compose -f "%SCRIPT_DIR%\docker-compose.yml" logs db 2>nul
    pause
    exit /b 1
)
:pg_ok
echo   + PostgreSQL hazir (localhost:5432)

:: ── Banner ──────────────────────────────────
cls
echo.
echo   ███╗   ███╗██████╗ ██╗   ██╗
echo   ████╗ ████║╚════██╗██║   ██║
echo   ██╔████╔██║ █████╔╝██║   ██║
echo   ██║╚██╔╝██║ ╚═══██╗██║   ██║
echo   ██║ ╚═╝ ██║██████╔╝╚██████╔╝
echo   ╚═╝     ╚═╝╚═════╝  ╚═════╝
echo.
echo        M3U Playlist Editor — Dev
echo.

:: ── DB migration ────────────────────────────
echo + DB migration calistiriliyor...
cd /d "%SCRIPT_DIR%"
call npm run migrate --silent >nul 2>&1
if %errorlevel% equ 0 (
    echo   + Migration tamamlandi
) else (
    echo   ! Migration hata verdi, devam ediliyor...
)

:: ── Backend baslat ──────────────────────────
echo.
echo + Backend baslatiliyor (port 3000)
cd /d "%SCRIPT_DIR%"
start /b "" cmd /c "node --watch src/index.js > "%BACKEND_LOG%" 2>&1"

:: Backend hazir olmasini bekle (max 10sn)
set "BE_READY=0"
for /l %%i in (1,1,20) do (
    timeout /t 1 /nobreak >nul
    findstr /i "listening started running Server" "%BACKEND_LOG%" >nul 2>&1
    if !errorlevel! equ 0 (
        set "BE_READY=1"
        goto :be_ok
    )
)
:be_ok

:: ── Frontend baslat ─────────────────────────
echo + Frontend baslatiliyor (port 5173)
cd /d "%FRONTEND_DIR%"
start /b "" cmd /c "npm run dev > "%FRONTEND_LOG%" 2>&1"

:: Frontend hazir olmasini bekle (max 15sn)
set "FE_READY=0"
for /l %%i in (1,1,30) do (
    timeout /t 1 /nobreak >nul
    findstr /i "Local localhost ready" "%FRONTEND_LOG%" >nul 2>&1
    if !errorlevel! equ 0 (
        set "FE_READY=1"
        goto :fe_ok
    )
)
:fe_ok

:: ── Ozet ────────────────────────────────────
echo.
echo + Servisler calisiyor
echo   PostgreSQL →  localhost:5432
echo   Backend    →  http://localhost:3000
echo   Frontend   →  http://localhost:5173
echo.
echo Loglar:
echo   Backend  → .fy\backend.log
echo   Frontend → .fy\frontend.log
echo.
echo Durdurmak icin: Ctrl+C veya bu pencereyi kapatin
echo ──────────────────────────────────────────
echo.

:: ── Canli log ───────────────────────────────
:: Windows'ta tail -f yerine PowerShell ile canli log
start /b "" powershell -NoProfile -Command "Get-Content '%BACKEND_LOG%','%FRONTEND_LOG%' -Wait -ErrorAction SilentlyContinue"

:: Acik kal
echo Cikis icin herhangi bir tusa basin...
pause >nul

:: Temizlik
echo.
echo Servisler durduruluyor...
taskkill /f /fi "WINDOWTITLE eq node*" >nul 2>&1
for /f "tokens=2" %%a in ('tasklist /fi "IMAGENAME eq node.exe" /fo list 2^>nul ^| findstr "PID"') do (
    wmic process where "ProcessId=%%a and CommandLine like '%%src/index.js%%'" call terminate >nul 2>&1
)
echo + Tum servisler durduruldu.
