import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))
  const token = ref(localStorage.getItem('token') || '')
  const refreshToken = ref(localStorage.getItem('refreshToken') || '')
  const isLoggedIn = computed(() => !!token.value)

  function _saveTokens(data) {
    token.value = data.token
    if (data.refreshToken) {
      refreshToken.value = data.refreshToken
      localStorage.setItem('refreshToken', data.refreshToken)
    }
    localStorage.setItem('token', data.token)
  }

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    _saveTokens(data)
    user.value = data.user
    localStorage.setItem('user', JSON.stringify(data.user))
  }

  async function register(email, password) {
    const { data } = await api.post('/auth/register', { email, password })
    _saveTokens(data)
    user.value = data.user
    localStorage.setItem('user', JSON.stringify(data.user))
  }

  async function refresh() {
    if (!refreshToken.value) return false
    try {
      const { data } = await api.post('/auth/refresh', { refreshToken: refreshToken.value })
      _saveTokens(data)
      return true
    } catch {
      logout()
      return false
    }
  }

  async function logout() {
    try { await api.post('/auth/logout') } catch {}
    token.value = ''
    refreshToken.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
  }

  async function changePassword(currentPassword, newPassword) {
    await api.put('/auth/password', { currentPassword, newPassword })
  }

  async function changeEmail(password, newEmail) {
    const { data } = await api.put('/auth/email', { password, newEmail })
    user.value = { ...user.value, email: data.email }
    localStorage.setItem('user', JSON.stringify(user.value))
  }

  async function deleteAccount(password) {
    await api.delete('/auth/account', { data: { password } })
    logout()
  }

  async function getProfile() {
    const { data } = await api.get('/auth/profile')
    return data
  }

  return { user, token, refreshToken, isLoggedIn, login, register, refresh, logout, changePassword, changeEmail, deleteAccount, getProfile }
})
