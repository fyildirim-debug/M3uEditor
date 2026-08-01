<template>
  <div class="account-page">
    <div class="account-container">
      <h1 class="account-title">{{ t('account.title') }}</h1>

      <!-- Profile Section -->
      <div class="account-section">
        <h2 class="section-title">{{ t('account.profile') }}</h2>
        <div class="profile-card card">
          <div class="profile-avatar">{{ user?.email?.[0]?.toUpperCase() || '?' }}</div>
          <div class="profile-info">
            <div class="profile-email">{{ user?.email }}</div>
            <div class="profile-meta" v-if="profile">
              {{ t('account.memberSince') }}: {{ formatDate(profile.created_at) }}
            </div>
          </div>
          <div class="profile-stats" v-if="profile">
            <div class="stat-item">
              <span class="stat-value">{{ profile.playlistCount }}</span>
              <span class="stat-label">{{ t('dashboard.statsPlaylist') }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ profile.channelCount }}</span>
              <span class="stat-label">{{ t('common.channels') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Theme Section -->
      <div class="account-section">
        <h2 class="section-title">{{ t('theme.dark') }} / {{ t('theme.light') }}</h2>
        <div class="theme-options">
          <button :class="['theme-btn', { active: theme === 'system' }]" @click="setTheme('system')">{{ t('theme.system') }}</button>
          <button :class="['theme-btn', { active: theme === 'dark' }]" @click="setTheme('dark')">{{ t('theme.dark') }}</button>
          <button :class="['theme-btn', { active: theme === 'light' }]" @click="setTheme('light')">{{ t('theme.light') }}</button>
        </div>
      </div>

      <!-- Change Password -->
      <div class="account-section">
        <h2 class="section-title">{{ t('account.changePassword') }}</h2>
        <form class="account-form card" @submit.prevent="handleChangePassword">
          <div class="form-group">
            <label class="form-label" for="current-password">{{ t('account.currentPassword') }}</label>
            <input id="current-password" class="input" type="password" v-model="pwForm.current" required autocomplete="current-password" />
          </div>
          <div class="form-group">
            <label class="form-label" for="new-password">{{ t('account.newPassword') }}</label>
            <input id="new-password" class="input" type="password" v-model="pwForm.newPw" minlength="10" required autocomplete="new-password" />
          </div>
          <div class="form-group">
            <label class="form-label" for="confirm-new-password">{{ t('account.confirmNewPassword') }}</label>
            <input id="confirm-new-password" class="input" type="password" v-model="pwForm.confirm" minlength="10" required autocomplete="new-password" />
          </div>
          <div v-if="pwError" class="form-error">{{ pwError }}</div>
          <button class="btn btn-primary" type="submit" :disabled="pwLoading">
            {{ pwLoading ? t('common.loading') : t('account.changePassword') }}
          </button>
        </form>
      </div>

      <!-- Change Email -->
      <div class="account-section">
        <h2 class="section-title">{{ t('account.changeEmail') }}</h2>
        <form class="account-form card" @submit.prevent="handleChangeEmail">
          <div class="form-group">
            <label class="form-label" for="new-email">{{ t('account.newEmail') }}</label>
            <input id="new-email" class="input" type="email" v-model="emailForm.newEmail" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label class="form-label" for="email-password">{{ t('account.passwordRequired') }}</label>
            <input id="email-password" class="input" type="password" v-model="emailForm.password" required autocomplete="current-password" />
          </div>
          <div v-if="emailError" class="form-error">{{ emailError }}</div>
          <button class="btn btn-primary" type="submit" :disabled="emailLoading">
            {{ emailLoading ? t('common.loading') : t('account.changeEmail') }}
          </button>
        </form>
      </div>

      <!-- Active Sessions -->
      <div class="account-section">
        <h2 class="section-title">{{ t('account.sessions') }}</h2>
        <div class="card sessions-card">
          <p class="sessions-desc">{{ t('account.sessionsDesc') }}</p>
          <div v-if="sessionsLoading" class="sessions-loading"><span class="spinner"></span></div>
          <ul v-else-if="sessions.length" class="session-list">
            <li v-for="s in sessions" :key="s.familyId" class="session-item">
              <div class="session-info">
                <div class="session-ua">
                  {{ s.userAgent || t('account.unknownDevice') }}
                  <span v-if="s.current" class="badge badge-success session-current">{{ t('account.currentDevice') }}</span>
                </div>
                <div class="session-meta">{{ s.ipAddress || '—' }} · {{ t('account.lastUsed') }}: {{ formatDateTime(s.lastUsedAt) }}</div>
              </div>
              <button v-if="!s.current" class="btn btn-danger btn-sm" :disabled="s._revoking" @click="revokeSession(s)">
                {{ t('account.revokeSession') }}
              </button>
            </li>
          </ul>
        </div>
      </div>

      <!-- Delete Account -->
      <div class="account-section danger-zone">
        <h2 class="section-title danger-title">{{ t('account.deleteAccount') }}</h2>
        <div class="card danger-card">
          <p class="danger-text">{{ t('account.deleteWarning') }}</p>
          <form @submit.prevent="handleDeleteAccount" class="delete-form">
            <input class="input" type="password" v-model="deletePassword" :placeholder="t('account.passwordRequired')" :aria-label="t('account.passwordRequired')" required autocomplete="current-password" />
            <button class="btn btn-danger" type="submit" :disabled="deleteLoading">
              {{ deleteLoading ? t('common.loading') : t('common.permanently_delete') }}
            </button>
          </form>
        </div>
      </div>

      <div class="back-link">
        <router-link to="/dashboard" class="btn btn-ghost">{{ t('nav.dashboard') }}</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, inject } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useI18n } from '../langs/useI18n'
import { useTheme } from '../composables/useTheme'
import api from '../api'

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()
const toast = inject('toast')
const { theme, setTheme } = useTheme()

// storeToRefs olmadan `auth.user` anlik degeri kopyalar ve reaktiviteyi kaybeder;
// e-posta degistiginde baslikta eski adres gorunmeye devam ederdi.
const { user } = storeToRefs(auth)
const profile = ref(null)

const pwForm = ref({ current: '', newPw: '', confirm: '' })
const pwLoading = ref(false)
const pwError = ref('')

const emailForm = ref({ newEmail: '', password: '' })
const emailLoading = ref(false)
const emailError = ref('')

const deletePassword = ref('')
const deleteLoading = ref(false)

const sessions = ref([])
const sessionsLoading = ref(true)

onMounted(async () => {
  try { profile.value = await auth.getProfile() } catch {}
  loadSessions()
})

async function loadSessions() {
  sessionsLoading.value = true
  try { sessions.value = (await api.get('/auth/sessions')).data } catch { sessions.value = [] }
  finally { sessionsLoading.value = false }
}

async function revokeSession(s) {
  s._revoking = true
  try {
    await api.delete(`/auth/sessions/${s.familyId}`)
    toast(t('account.sessionRevoked'), 'success')
    sessions.value = sessions.value.filter(x => x.familyId !== s.familyId)
  } catch (e) {
    toast(e.response?.data?.error?.message || t('toast.genericError'), 'error')
  } finally {
    s._revoking = false
  }
}

function formatDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString()
}

async function handleChangePassword() {
  pwError.value = ''
  if (pwForm.value.newPw !== pwForm.value.confirm) {
    pwError.value = t('auth.passwordMismatch')
    return
  }
  pwLoading.value = true
  try {
    await auth.changePassword(pwForm.value.current, pwForm.value.newPw)
    toast(t('account.passwordChanged'), 'success')
    pwForm.value = { current: '', newPw: '', confirm: '' }
    router.push('/login')
  } catch (e) {
    pwError.value = e.response?.data?.error?.message || t('toast.genericError')
  } finally {
    pwLoading.value = false
  }
}

async function handleChangeEmail() {
  emailError.value = ''
  emailLoading.value = true
  try {
    await auth.changeEmail(emailForm.value.password, emailForm.value.newEmail)
    toast(t('account.emailChanged'), 'success')
    emailForm.value = { newEmail: '', password: '' }
  } catch (e) {
    emailError.value = e.response?.data?.error?.message || t('toast.genericError')
  } finally {
    emailLoading.value = false
  }
}

async function handleDeleteAccount() {
  deleteLoading.value = true
  try {
    await auth.deleteAccount(deletePassword.value)
    toast(t('account.accountDeleted'), 'success')
    router.push('/login')
  } catch (e) {
    toast(e.response?.data?.error?.message || t('toast.genericError'), 'error')
  } finally {
    deleteLoading.value = false
  }
}
</script>

<style scoped>
.account-page { padding: 2rem; max-width: 640px; margin: 0 auto; }
.account-title { font-size: 1.5rem; font-weight: 600; margin-bottom: 2rem; }
.account-section { margin-bottom: 2rem; }
.section-title { font-size: 0.9rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); margin-bottom: 0.75rem; }
.profile-card { display: flex; align-items: center; gap: 1rem; padding: 1.25rem; flex-wrap: wrap; }
.profile-avatar { width: 48px; height: 48px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 1.2rem; color: white; flex-shrink: 0; }
.profile-info { flex: 1; min-width: 150px; }
.profile-email { font-weight: 500; }
.profile-meta { font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px; }
.profile-stats { display: flex; gap: 1.5rem; }
.stat-item { text-align: center; }
.stat-value { display: block; font-size: 1.25rem; font-weight: 600; color: var(--accent); }
.stat-label { font-size: 0.75rem; color: var(--text-secondary); }
.account-form { padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
.form-group { display: flex; flex-direction: column; gap: 0.25rem; }
.form-label { font-size: 0.8rem; color: var(--text-secondary); }
.form-error { color: var(--danger); font-size: 0.8rem; }
.theme-options { display: flex; gap: 0.5rem; }
.theme-btn { padding: 0.5rem 1rem; border-radius: var(--radius); border: 1px solid var(--border-light); background: var(--bg-card); color: var(--text-primary); cursor: pointer; transition: var(--transition); font-size: 0.85rem; }
.theme-btn.active { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.theme-btn:hover { background: var(--bg-hover); }
.danger-zone { margin-top: 3rem; }
.danger-title { color: var(--danger); }
.danger-card { padding: 1.25rem; border: 1px solid var(--danger-soft); }
.danger-text { color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1rem; }
.delete-form { display: flex; gap: 0.75rem; }
.delete-form .input { flex: 1; }
.back-link { margin-top: 2rem; text-align: center; }
.sessions-card { padding: 1.25rem; }
.sessions-desc { color: var(--text-secondary); font-size: 0.85rem; margin: 0 0 1rem; }
.sessions-loading { display: flex; justify-content: center; padding: 1rem 0; }
.session-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
.session-item { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius); }
.session-info { flex: 1; min-width: 0; }
.session-ua { font-size: 0.85rem; font-weight: 500; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; word-break: break-word; }
.session-current { font-size: 0.65rem; flex-shrink: 0; }
.session-meta { font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px; }
</style>
