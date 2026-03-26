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
              <span class="stat-label">Playlist</span>
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
            <label class="form-label">{{ t('account.currentPassword') }}</label>
            <input class="input" type="password" v-model="pwForm.current" required />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('account.newPassword') }}</label>
            <input class="input" type="password" v-model="pwForm.newPw" minlength="6" required />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('account.confirmNewPassword') }}</label>
            <input class="input" type="password" v-model="pwForm.confirm" minlength="6" required />
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
            <label class="form-label">{{ t('account.newEmail') }}</label>
            <input class="input" type="email" v-model="emailForm.newEmail" required />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('account.passwordRequired') }}</label>
            <input class="input" type="password" v-model="emailForm.password" required />
          </div>
          <div v-if="emailError" class="form-error">{{ emailError }}</div>
          <button class="btn btn-primary" type="submit" :disabled="emailLoading">
            {{ emailLoading ? t('common.loading') : t('account.changeEmail') }}
          </button>
        </form>
      </div>

      <!-- Delete Account -->
      <div class="account-section danger-zone">
        <h2 class="section-title danger-title">{{ t('account.deleteAccount') }}</h2>
        <div class="card danger-card">
          <p class="danger-text">{{ t('account.deleteWarning') }}</p>
          <form @submit.prevent="handleDeleteAccount" class="delete-form">
            <input class="input" type="password" v-model="deletePassword" :placeholder="t('account.passwordRequired')" required />
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
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useI18n } from '../langs/useI18n'
import { useTheme } from '../composables/useTheme'

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()
const toast = inject('toast')
const { theme, setTheme } = useTheme()

const user = auth.user
const profile = ref(null)

const pwForm = ref({ current: '', newPw: '', confirm: '' })
const pwLoading = ref(false)
const pwError = ref('')

const emailForm = ref({ newEmail: '', password: '' })
const emailLoading = ref(false)
const emailError = ref('')

const deletePassword = ref('')
const deleteLoading = ref(false)

onMounted(async () => {
  try { profile.value = await auth.getProfile() } catch {}
})

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
.profile-avatar { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--accent-hover)); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 1.2rem; color: white; flex-shrink: 0; }
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
</style>
