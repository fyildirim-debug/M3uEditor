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

  // Acilista calisir. Genel istemci zaman asimi buyuk import'lar icin 330 sn;
  // bu cagri o sureyi devralirsa API erisilemezken uygulama dakikalarca bos
  // ekranda kalir. Acilis yenilemesi kisa tutulur ve basarisizligi engel degildir.
  //
  // Oturum YALNIZCA sunucu kimlik bilgisini gecersiz saydiginda silinir.
  // Eskiden her hata oturumu siliyordu; sayfa her acilista yenileme istegi
  // attigi icin hiz siniri (429), gecici bir ag hatasi ya da 8 saniyelik zaman
  // asimi kullaniciyi elindeki gecerli oturumdan ediyordu — birkac kez F5
  // yapmak cikis yaptirmaya yetiyordu.
  async function refresh({ timeout = 8000 } = {}) {
    try {
      const { data } = await api.post('/auth/refresh', {}, { timeout })
      saveSession(data)
      return true
    } catch (error) {
      const status = error.response?.status
      if (status === 401 || status === 403) {
        clearSession()
        return false
      }
      // Ag/limit/sunucu hatasi: eldeki oturum korunur. Gercekten gecersizse
      // ilk API cagrisi 401 dondugunde arayuz zaten oturumu kapatiyor.
      return Boolean(token.value)
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
