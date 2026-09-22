import axios from 'axios'

let pending

// Cookies are shared across tabs; serialize rotation across every refresh entry.
export function refreshSession(timeout = 8000) {
  if (pending) return pending
  const request = () => axios.post('/api/auth/refresh', {}, { withCredentials: true, timeout })
  pending = (navigator.locks
    ? navigator.locks.request('m3u-session-refresh', request)
    : request()).finally(() => { pending = undefined })
  return pending
}
