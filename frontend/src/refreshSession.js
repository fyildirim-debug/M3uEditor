import axios from 'axios'

// Sunucu her yenilemede oturumu dondurur (rotation) ve eski oturumu iptal eder;
// eski refresh cookie'si tekrar kullanilirsa butun oturum ailesi "reuse" sayilip
// kapatilir. Bu yuzden:
//  - ayni sekmede ayni anda yalnizca TEK yenileme istegi ucar (paylasilan promise),
//  - sekmeler arasi yenileme bir kilitle siraya sokulur (navigator.locks; HTTP
//    uzerindeki LAN kurulumlarinda bu API yok, localStorage tabanli mutex devreye girer),
//  - yeni token BroadcastChannel (yoksa `storage` olayi) ile diger sekmelere
//    dagitilir; onlar kendi yenilemelerini yapmak yerine bu token'i benimser.

const LOCK_NAME = 'm3u-session-refresh'
const CHANNEL_NAME = 'm3u-session'
const STORAGE_LOCK_KEY = 'm3u-session-refresh-lock'
const STORAGE_BROADCAST_KEY = 'm3u-session-broadcast'
const EXPIRY_SKEW_MS = 30_000
const TAB_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

let pending

function safeSession(action) {
  try { return action(window.sessionStorage) } catch { return null }
}

export function getStoredToken() {
  return safeSession(storage => storage.getItem('token')) || ''
}

function readStoredUser() {
  try { return JSON.parse(safeSession(storage => storage.getItem('user')) || 'null') } catch { return null }
}

/** JWT'nin `exp` alanini (ms) dondurur; cozumlenemezse null. Imza dogrulanmaz. */
export function tokenExpiresAt(token) {
  if (typeof token !== 'string') return null
  const part = token.split('.')[1]
  if (!part) return null
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')
    const payload = JSON.parse(atob(base64))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

/** Token en az `skewMs` daha gecerliyse true. */
export function isTokenFresh(token, skewMs = EXPIRY_SKEW_MS) {
  const expiresAt = tokenExpiresAt(token)
  return expiresAt !== null && expiresAt - skewMs > Date.now()
}

/** Yeni oturumu bu sekmeye yazar ve store'a haber verir. */
export function applySession(data) {
  if (!data?.token) return
  safeSession((storage) => {
    storage.setItem('token', data.token)
    if (data.user) storage.setItem('user', JSON.stringify(data.user))
  })
  window.dispatchEvent(new CustomEvent('auth:refreshed', { detail: data }))
}

// ── Sekmeler arasi paylasim ──────────────────────────────────────
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL_NAME) : null

function sameUser(incomingUser) {
  const current = readStoredUser()
  if (!current?.id || !incomingUser?.id) return true
  return String(current.id) === String(incomingUser.id)
}

function receiveShared(message) {
  if (!message || message.from === TAB_ID) return
  if (message.type === 'token') {
    if (message.to) return // baska bir sekmenin istegine verilen yanit
    // Oturumu olmayan (cikis yapmis) sekme baskasinin token'ini kendiliginden almaz.
    if (!getStoredToken() || !message.token || !sameUser(message.user)) return
    if (message.token === getStoredToken()) return
    applySession({ token: message.token, user: message.user })
  } else if (message.type === 'request' && channel) {
    const token = getStoredToken()
    if (isTokenFresh(token)) channel.postMessage({ type: 'token', from: TAB_ID, to: message.from, token, user: readStoredUser() })
  }
}

function publish(data) {
  const message = { type: 'token', from: TAB_ID, token: data.token, user: data.user || null }
  if (channel) {
    try { channel.postMessage(message) } catch { /* kapali kanal */ }
    return
  }
  try {
    localStorage.setItem(STORAGE_BROADCAST_KEY, JSON.stringify({ ...message, at: Date.now() }))
    localStorage.removeItem(STORAGE_BROADCAST_KEY)
  } catch { /* depolama kapali */ }
}

if (typeof window !== 'undefined') {
  if (channel) channel.onmessage = event => receiveShared(event.data)
  else {
    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_BROADCAST_KEY || !event.newValue) return
      try { receiveShared(JSON.parse(event.newValue)) } catch { /* bozuk mesaj */ }
    })
  }
}

/**
 * Acik baska bir sekmede gecerli token varsa onu ister; boylece yeni sekme acmak
 * oturumu dondurup diger sekmeleri dusurmez. Yalnizca BroadcastChannel ile.
 */
export function askPeersForToken(waitMs = 150) {
  if (!channel) return Promise.resolve(null)
  return new Promise((resolve) => {
    const peer = new BroadcastChannel(CHANNEL_NAME)
    const finish = (value) => {
      clearTimeout(timer)
      peer.close()
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), waitMs)
    peer.onmessage = (event) => {
      const message = event.data
      if (message?.type === 'token' && message.to === TAB_ID && isTokenFresh(message.token)) {
        finish({ token: message.token, user: message.user })
      }
    }
    peer.postMessage({ type: 'request', from: TAB_ID })
  })
}

// ── Sekmeler arasi kilit ─────────────────────────────────────────
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function readStorageLock() {
  try { return JSON.parse(localStorage.getItem(STORAGE_LOCK_KEY) || 'null') } catch { return null }
}

/**
 * navigator.locks olmayan ortamlar (guvensiz baglam: http://192.168.x.x) icin
 * localStorage tabanli kaba bir mutex. Kilit sahibi `holdMs` icinde birakmazsa
 * (sekme kapandi, istek asili kaldi) suresi dolmus sayilir; en fazla `waitMs`
 * beklenir, sonra yine de devam edilir — kilit kolaylik icindir, kilitlenme
 * pahasina tutulmaz.
 */
export async function withStorageMutex(task, { holdMs = 15_000, waitMs = 12_000 } = {}) {
  let storageWorks = true
  try { localStorage.getItem(STORAGE_LOCK_KEY) } catch { storageWorks = false }
  if (!storageWorks) return task()

  const deadline = Date.now() + waitMs
  let acquired = false
  while (Date.now() < deadline) {
    const lock = readStorageLock()
    if (!lock || lock.expires <= Date.now()) {
      try { localStorage.setItem(STORAGE_LOCK_KEY, JSON.stringify({ owner: TAB_ID, expires: Date.now() + holdMs })) } catch { break }
      // Ayni anda yazan iki sekmeden yalnizca sonuncusu kazanir; kisa bekleyip dogrula.
      await sleep(30)
      if (readStorageLock()?.owner === TAB_ID) { acquired = true; break }
    }
    await sleep(100 + Math.random() * 100)
  }
  try {
    return await task()
  } finally {
    if (acquired && readStorageLock()?.owner === TAB_ID) {
      try { localStorage.removeItem(STORAGE_LOCK_KEY) } catch { /* yok say */ }
    }
  }
}

function withCrossTabLock(task) {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) return navigator.locks.request(LOCK_NAME, task)
  return withStorageMutex(task)
}

/**
 * Oturumu yeniler. Ayni sekmedeki tum cagiranlar ayni promise'i paylasir.
 * Kilit beklenirken baska sekme yenilediyse (token yayinla geldiyse) yeni istek
 * atilmaz, gelen token kullanilir. Basarili sonuc bu sekmeye yazilir ve yayinlanir.
 */
export function refreshSession(timeout = 8000) {
  if (pending) return pending
  const tokenBefore = getStoredToken()
  pending = withCrossTabLock(async () => {
    const current = getStoredToken()
    if (current && current !== tokenBefore && isTokenFresh(current)) {
      return { data: { token: current, user: readStoredUser() }, shared: true }
    }
    const response = await axios.post('/api/auth/refresh', {}, { withCredentials: true, timeout })
    applySession(response.data)
    publish(response.data)
    return response
  }).finally(() => { pending = undefined })
  return pending
}
