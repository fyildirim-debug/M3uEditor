import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api'

function readUser() {
  try { return JSON.parse(sessionStorage.getItem('user') || 'null') } catch { return null }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref(readUser())
  const token = ref(sessionStorage.getItem('token') || '')
  const isLoggedIn = computed(() => Boolean(token.value))

  function saveSession(data) {
    token.value = data.token || ''
    if (data.user) user.value = data.user
    if (token.value) sessionStorage.setItem('token', token.value)
    if (user.value) sessionStorage.setItem('user', JSON.stringify(user.value))
  }

  function clearSession() {
    token.value = ''
    user.value = null
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
  }

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    saveSession(data)
  }

  async function register(email, password) {
    const { data } = await api.post('/auth/register', { email, password })
    saveSession(data)
  }

  async function refresh() {
    try {
      const { data } = await api.post('/auth/refresh', {})
      saveSession(data)
      return true
    } catch {
      clearSession()
      return false
    }
  }

  async function logout() {
    try { await api.post('/auth/logout') } catch {}
    clearSession()
  }

  async function changePassword(currentPassword, newPassword) {
    await api.put('/auth/password', { currentPassword, newPassword })
    clearSession()
  }

  async function changeEmail(password, newEmail) {
    const { data } = await api.put('/auth/email', { password, newEmail })
    user.value = { ...user.value, email: data.email }
    sessionStorage.setItem('user', JSON.stringify(user.value))
  }

  async function deleteAccount(password) {
    await api.delete('/auth/account', { data: { password } })
    clearSession()
  }

  async function getProfile() {
    const { data } = await api.get('/auth/profile')
    user.value = { ...user.value, id: data.id, email: data.email, is_admin: data.is_admin }
    sessionStorage.setItem('user', JSON.stringify(user.value))
    return data
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('auth:refreshed', event => saveSession(event.detail))
    window.addEventListener('auth:cleared', clearSession)
  }

  return { user, token, isLoggedIn, login, register, refresh, logout, changePassword, changeEmail, deleteAccount, getProfile, clearSession }
})
