import axios from 'axios'

const api = axios.create({ baseURL: '/api', withCredentials: true, timeout: 330000 })
let isRefreshing = false
let failedQueue = []

function processQueue(error, token = null) {
  for (const promise of failedQueue) error ? promise.reject(error) : promise.resolve(token)
  failedQueue = []
}

function clearSession() {
  sessionStorage.removeItem('token')
  sessionStorage.removeItem('user')
  window.dispatchEvent(new CustomEvent('auth:cleared'))
}

api.interceptors.request.use((request) => {
  const token = sessionStorage.getItem('token')
  if (token) request.headers.Authorization = `Bearer ${token}`
  return request
})

api.interceptors.response.use(
  response => response,
  async (error) => {
    const originalRequest = error.config
    const isAuthEndpoint = String(originalRequest?.url || '').includes('/auth/refresh') || String(originalRequest?.url || '').includes('/auth/login')
    if (error.response?.status !== 401 || originalRequest?._retry || isAuthEndpoint) return Promise.reject(error)

    if (isRefreshing) {
      return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
    }

    originalRequest._retry = true
    isRefreshing = true
    try {
      const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
      sessionStorage.setItem('token', data.token)
      if (data.user) sessionStorage.setItem('user', JSON.stringify(data.user))
      window.dispatchEvent(new CustomEvent('auth:refreshed', { detail: data }))
      processQueue(null, data.token)
      originalRequest.headers.Authorization = `Bearer ${data.token}`
      return api(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError)
      clearSession()
      if (window.location.hash !== '#/login') window.location.hash = '#/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)

export default api
