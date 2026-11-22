/**
 * M3U Editor masaustu uygulamasi — Electron ana sureci.
 *
 * Web surumuyle ayni kod calisir: arka uc (Express + gomulu PostgreSQL) ayri
 * bir yardimci surecte acilir, pencere onun 127.0.0.1 uzerindeki adresini
 * yukler. Veriler kullanicinin uygulama verisi klasorundedir:
 *   Windows: %APPDATA%\M3U Editor     Linux: ~/.config/M3U Editor
 */
const { app, BrowserWindow, Menu, dialog, shell, utilityProcess, session } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { loadSecrets, loadSettings, saveSettings } = require('./store');
const { freePort } = require('./ports');
const { createTranslator } = require('./i18n');

const PRODUCT_NAME = 'M3U Editor';
const PROJECT_URL = 'https://github.com/fyildirim-debug/M3uEditor';
const DEFAULT_APP_PORT = 47821;
const DEFAULT_DB_PORT = 47822;
const SHUTDOWN_TIMEOUT_MS = 20_000;
// Ilk acilista veritabani kurulumu dahil. Asilirsa acilis ekraninda sonsuza
// kadar beklemek yerine gunluk klasorunu gosteren bir hata verilir.
const STARTUP_TIMEOUT_MS = 180_000;

app.setName(PRODUCT_NAME);
if (process.platform === 'win32') app.setAppUserModelId('com.arnexlab.m3ueditor');

// Ikinci kopya ayni veritabanini acmaya calisirdi; mevcut pencere one getirilir.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

const userData = app.getPath('userData');
const dataDir = path.join(userData, 'data');
const logDir = path.join(userData, 'logs');

let t = createTranslator('en');
let settings = null;
let backend = null;
let backendReady = false;
let appUrl = null;
let mainWindow = null;
let splashWindow = null;
let quitting = false;
// Yalnizca bu surecte ve arka uc surecinde bilinir; pencere icerigine verilmez.
const desktopLoginToken = crypto.randomBytes(32).toString('hex');
let signingIn = null;
let autoSignInAttempts = [];

/**
 * Yerel hesaba oturum acar ve yenileme cerezini pencerenin oturumuna yazar.
 * Masaustunde kayit/giris ekrani gosterilmez: veriler zaten bu bilgisayarda.
 */
function signInLocally() {
  if (signingIn) return signingIn;
  signingIn = (async () => {
    const response = await fetch(`${appUrl}/api/auth/desktop-session`, {
      method: 'POST',
      headers: { 'x-desktop-token': desktopLoginToken, 'user-agent': `${PRODUCT_NAME} Desktop` },
    });
    if (!response.ok) throw new Error(`Yerel oturum açılamadı (HTTP ${response.status})`);
    const cookie = response.headers.getSetCookie().find((line) => line.startsWith('m3u_refresh='));
    if (!cookie) throw new Error('Yerel oturum çerezi alınamadı');
    const value = decodeURIComponent(cookie.slice('m3u_refresh='.length).split(';')[0]);
    const maxAge = Number((/max-age=(\d+)/i.exec(cookie) || [])[1]) || 7 * 24 * 3600;
    await session.defaultSession.cookies.set({
      url: `${appUrl}/api/auth`,
      name: 'm3u_refresh',
      value,
      path: '/api/auth',
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      expirationDate: Math.floor(Date.now() / 1000) + maxAge,
    });
  })().finally(() => { signingIn = null; });
  return signingIn;
}

/** Paketlenmis uygulamada sunucu ve arayuz app icinde; gelistirmede depo kokunde. */
function resolveRuntimePaths() {
  if (app.isPackaged) {
    const root = app.getAppPath();
    return { serverRoot: path.join(root, 'server'), frontendDir: path.join(root, 'renderer') };
  }
  const repo = path.resolve(__dirname, '..', '..');
  return { serverRoot: repo, frontendDir: path.join(repo, 'frontend', 'dist') };
}

function splashHtml(text) {
  const safe = String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<style>
html,body{margin:0;height:100%;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#0f1117;color:#e6e8ef;}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;-webkit-app-region:drag;user-select:none}
.logo{width:64px;height:64px;border-radius:16px;background:#4f46e5;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(79,70,229,.35)}
h1{font-size:18px;margin:0;font-weight:600}
p{font-size:13px;margin:0;opacity:.7;min-height:18px}
.bar{width:180px;height:3px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden}
.bar i{display:block;width:40%;height:100%;background:#6366f1;animation:slide 1.2s ease-in-out infinite}
@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
</style></head><body>
<div class="logo"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
<h1>${PRODUCT_NAME}</h1><p id="s">${safe}</p><div class="bar"><i></i></div></body></html>`;
}

function showSplash() {
  splashWindow = new BrowserWindow({
    width: 380,
    height: 260,
    frame: false,
    resizable: false,
    show: false,
    backgroundColor: '#0f1117',
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: true },
  });
  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml(t('loading')))}`);
  splashWindow.once('ready-to-show', () => splashWindow?.show());
  splashWindow.on('closed', () => { splashWindow = null; });
}

function setSplashStatus(stage) {
  if (!splashWindow) return;
  const text = JSON.stringify(t(stage));
  splashWindow.webContents.executeJavaScript(`document.getElementById('s').textContent=${text}`).catch(() => {});
}

function isAppUrl(target) {
  try {
    return Boolean(appUrl) && new URL(target).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

function openExternalSafely(target) {
  try {
    const { protocol } = new URL(target);
    if (protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:') shell.openExternal(target);
  } catch { /* gecersiz adres: yok say */ }
}

function createMainWindow() {
  const bounds = settings.windowBounds || {};
  mainWindow = new BrowserWindow({
    width: bounds.width || 1360,
    height: bounds.height || 860,
    x: bounds.x,
    y: bounds.y,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: PRODUCT_NAME,
    backgroundColor: '#0f1117',
    autoHideMenuBar: process.platform !== 'darwin',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: true,
    },
  });
  if (bounds.maximized) mainWindow.maximize();

  // Uygulama disina giden her baglanti varsayilan tarayicida acilir; pencere
  // yalnizca kendi kokenini gosterir.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAppUrl(url)) openExternalSafely(url);
    return { action: 'deny' };
  });
  // Oturum dustugunde (cikis, suresi dolan cerez) giris ekrani yerine yerel
  // hesapla yeniden oturum acilir.
  mainWindow.webContents.on('did-navigate-in-page', (_event, url) => {
    if (!/#\/(login|register)\b/.test(url)) return;
    // Dongu korumasi: yerel oturum ise yaramiyorsa giris ekrani kalir.
    const now = Date.now();
    autoSignInAttempts = autoSignInAttempts.filter((at) => now - at < 60_000);
    if (autoSignInAttempts.length >= 2) return;
    autoSignInAttempts.push(now);
    signInLocally()
      // Yalnizca hash degisirse sayfa yeniden yuklenmez ve uygulama acilistaki
      // oturum yenilemesini yapmaz; tam yukleme icin sorgu dizesi degisir.
      .then(() => mainWindow?.loadURL(`${appUrl}/?t=${Date.now()}#/dashboard`))
      .catch(() => { /* giris ekrani gorunur kalir; gunlukte iz var */ });
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      openExternalSafely(url);
    }
  });

  const persistBounds = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const maximized = mainWindow.isMaximized();
    settings.windowBounds = { ...(maximized ? settings.windowBounds : mainWindow.getBounds()), maximized };
  };
  mainWindow.on('resize', persistBounds);
  mainWindow.on('move', persistBounds);
  mainWindow.on('close', () => {
    persistBounds();
    try { saveSettings(userData, settings); } catch { /* ayar yazilamadi: kritik degil */ }
  });
  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    splashWindow?.close();
  });
  // Hash router: oturum yoksa uygulama kendisi girise yonlendirir.
  mainWindow.loadURL(`${appUrl}/#/dashboard`);
}

function buildMenu() {
  const template = [
    {
      label: t('file'),
      submenu: [
        { label: t('openData'), click: () => shell.openPath(userData) },
        { label: t('openLogFolder'), click: () => shell.openPath(logDir) },
        { type: 'separator' },
        { label: t('exit'), role: 'quit' },
      ],
    },
    {
      label: t('edit'),
      submenu: [
        { label: t('undo'), role: 'undo' },
        { label: t('redo'), role: 'redo' },
        { type: 'separator' },
        { label: t('cut'), role: 'cut' },
        { label: t('copy'), role: 'copy' },
        { label: t('paste'), role: 'paste' },
        { label: t('selectAll'), role: 'selectAll' },
      ],
    },
    {
      label: t('view'),
      submenu: [
        { label: t('reload'), role: 'reload' },
        ...(app.isPackaged && !process.env.M3U_DESKTOP_DEVTOOLS ? [] : [{ label: t('devtools'), role: 'toggleDevTools' }]),
        { type: 'separator' },
        { label: t('zoomReset'), role: 'resetZoom' },
        { label: t('zoomIn'), role: 'zoomIn' },
        { label: t('zoomOut'), role: 'zoomOut' },
        { type: 'separator' },
        { label: t('fullscreen'), role: 'togglefullscreen' },
      ],
    },
    {
      label: t('help'),
      submenu: [
        { label: t('project'), click: () => shell.openExternal(PROJECT_URL) },
        {
          label: t('about'),
          click: () => dialog.showMessageBox(mainWindow || undefined, {
            type: 'info',
            title: PRODUCT_NAME,
            message: `${PRODUCT_NAME} ${app.getVersion()}`,
            detail: `${t('aboutDetail')}\n\n${t('alreadyRunningData')}: ${userData}\nElectron ${process.versions.electron} · Node ${process.versions.node}`,
          }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function fatal(message) {
  splashWindow?.close();
  const { response } = await dialog.showMessageBox({
    type: 'error',
    title: t('fatalTitle'),
    message: t('fatalTitle'),
    detail: `${message}\n\n${t('fatalDetail')}\n${logDir}`,
    buttons: [t('openLogs'), t('quit')],
    defaultId: 1,
    cancelId: 1,
  });
  if (response === 0) await shell.openPath(logDir);
  quitting = true;
  app.exit(1);
}

async function startBackend() {
  const { serverRoot, frontendDir } = resolveRuntimePaths();
  if (!fs.existsSync(path.join(frontendDir, 'index.html'))) {
    throw new Error(`Arayüz dosyaları bulunamadı: ${frontendDir}. Geliştirme ortamında önce "npm run build" (frontend) çalıştırın.`);
  }
  const secrets = loadSecrets(userData);
  const appPort = await freePort(settings.appPort || DEFAULT_APP_PORT);
  const dbPort = await freePort(settings.dbPort || DEFAULT_DB_PORT);
  // Ayni port tekrar kullanilsin: arayuz tercihleri (tema, dil) kokene bagli
  // tarayici deposunda tutuluyor, port degisirse sifirlanirdi.
  settings.appPort = appPort;
  settings.dbPort = dbPort;
  saveSettings(userData, settings);
  appUrl = `http://127.0.0.1:${appPort}`;

  backend = utilityProcess.fork(path.join(__dirname, 'server-entry.js'), [], {
    serviceName: `${PRODUCT_NAME} Server`,
    stdio: 'pipe',
  });
  const consoleLog = fs.createWriteStream(path.join(logDir, 'backend-console.log'), { flags: 'a' });
  backend.stdout?.pipe(consoleLog);
  backend.stderr?.pipe(consoleLog);

  const ready = new Promise((resolve, reject) => {
    backend.on('message', (message) => {
      if (message?.type === 'status') setSplashStatus(message.stage);
      else if (message?.type === 'ready') {
        backendReady = true;
        resolve();
      } else if (message?.type === 'fatal') reject(new Error(message.message));
    });
    const timer = setTimeout(() => {
      if (!backendReady) reject(new Error(`Uygulama ${STARTUP_TIMEOUT_MS / 1000} saniye içinde başlamadı.`));
    }, STARTUP_TIMEOUT_MS);
    timer.unref?.();
    backend.once('exit', (code) => {
      if (!backendReady) reject(new Error(`Arka plan hizmeti açılırken kapandı (kod ${code}).`));
    });
  });

  backend.on('exit', async (code) => {
    const wasReady = backendReady;
    backend = null;
    backendReady = false;
    if (quitting || !wasReady) return;
    // Calisirken coktu: kullaniciya soyle, yeniden baslatmayi teklif et.
    const { response } = await dialog.showMessageBox(mainWindow || undefined, {
      type: 'error',
      title: PRODUCT_NAME,
      message: t('crashed'),
      detail: `${t('fatalDetail')}\n${logDir}\n(exit ${code})`,
      buttons: [t('restart'), t('quit')],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) {
      app.relaunch();
    }
    quitting = true;
    app.exit(0);
  });

  backend.postMessage({
    type: 'start',
    config: {
      serverRoot,
      frontendDir,
      dataDir,
      logDir,
      pgDataDir: path.join(userData, 'pgdata'),
      appPort,
      dbPort,
      appUrl,
      secrets,
      desktopLoginToken,
      allowPrivateNetwork: settings.allowPrivateNetwork === true,
      aiProviderPrivateHosts: settings.aiProviderPrivateHosts || '',
      logLevel: settings.logLevel,
    },
  });

  try {
    await ready;
  } catch (error) {
    // Arka ucu (ve baslattigi veritabanini) kapatmadan cikilirsa veritabani
    // sahipsiz kalir; bir sonraki acilis onu durdurur ama temiz kapatmak daha iyi.
    quitting = true;
    await stopBackend();
    throw error;
  }
}

/** Arka ucu duzgun kapatir (sunucu -> veritabani). */
function stopBackend() {
  if (!backend) return Promise.resolve();
  const child = backend;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill();
      resolve();
    }, SHUTDOWN_TIMEOUT_MS);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.postMessage({ type: 'shutdown' });
  });
}

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.on('before-quit', (event) => {
  if (quitting) return;
  if (!backend) return;
  event.preventDefault();
  quitting = true;
  stopBackend().finally(() => app.exit(0));
});

app.on('window-all-closed', () => {
  app.quit();
});

// Uygulama icinde baska bir web icerigi acilmasin (ornegin bir iframe).
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault());
});

app.whenReady().then(async () => {
  t = createTranslator(app.getLocale());
  // Arayuz masaustunde calistigini buradan anlar ve giris/cikis, parola,
  // oturum ve kullanici yonetimi ogelerini gizler (frontend/src/desktop.js).
  app.userAgentFallback = `${app.userAgentFallback} M3UEditorDesktop/${app.getVersion()}`;
  fs.mkdirSync(logDir, { recursive: true });
  settings = loadSettings(userData);
  buildMenu();

  // Kamera, mikrofon, konum gibi izinler bu uygulamada hic gerekmiyor.
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === 'clipboard-sanitized-write' || permission === 'fullscreen');
  });

  showSplash();
  try {
    await startBackend();
  } catch (error) {
    await fatal(error?.message || String(error));
    return;
  }
  try {
    await signInLocally();
  } catch (error) {
    // Oturum acilamazsa uygulama yine acilir; kullanici giris ekranini gorur.
    fs.appendFileSync(path.join(logDir, 'desktop.log'), `[${new Date().toISOString()}] ${error.message}\n`);
  }
  createMainWindow();
});
