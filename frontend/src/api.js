import axios from 'axios'
import { refreshSession, getStoredToken } from './refreshSession'

const api = axios.create({ baseURL: '/api', withCredentials: true, timeout: 330000 })

function clearSession() {
  try {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
  } catch { /* depolama kapali */ }
  window.dispatchEvent(new CustomEvent('auth:cleared'))
}

function redirectToLogin() {
  const current = window.location.hash.replace(/^#/, '') || '/'
  if (current === '/login' || current.startsWith('/login?')) return
  const isPublic = current === '/' || current.startsWith('/terms') || current.startsWith('/privacy')
  window.location.hash = isPublic ? '#/login' : `#/login?redirect=${encodeURIComponent(current)}`
}

function bearerOf(request) {
  const header = request?.headers?.Authorization || request?.headers?.authorization || ''
  return String(header).replace(/^Bearer\s+/i, '')
}

api.interceptors.request.use((request) => {
  const token = getStoredToken()
  if (token) request.headers.Authorization = `Bearer ${token}`
  return request
})

api.interceptors.response.use(
  response => response,
  async (error) => {
    const originalRequest = error.config
    const url = String(originalRequest?.url || '')
    const isAuthEndpoint = url.includes('/auth/refresh') || url.includes('/auth/login')
    if (!originalRequest || error.response?.status !== 401 || isAuthEndpoint) return Promise.reject(error)

    // Istek yola ciktiktan sonra oturum yenilendiyse (bu sekmede ya da baska bir
    // sekmeden yayinla) eski token sunucuda iptal edilmistir. Yeniden yenilemek
    // oturumu bir kez daha dondurup diger bekleyen istekleri de dusururdu;
    // eldeki guncel token'la tekrar denemek yeterli.
    const current = getStoredToken()
    if (current && bearerOf(originalRequest) !== current && !originalRequest._staleRetry) {
      originalRequest._staleRetry = true
      originalRequest.headers.Authorization = `Bearer ${current}`
      return api(originalRequest)
    }

    if (originalRequest._retry) return Promise.reject(error)
    originalRequest._retry = true
    try {
      // refreshSession tek bir promise paylasir: ayni anda gelen tum 401'ler ayni yenilemeyi bekler.
      const { data } = await refreshSession()
      originalRequest.headers.Authorization = `Bearer ${data.token}`
      return api(originalRequest)
    } catch (refreshError) {
      if ([401, 403].includes(refreshError.response?.status)) {
        clearSession()
        redirectToLogin()
      }
      return Promise.reject(refreshError)
    }
  }
)

export default api
