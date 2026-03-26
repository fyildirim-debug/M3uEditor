<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-card">
        <h2>{{ t('resetPw.title') }}</h2>
        <div v-if="success" class="success-msg">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <p>{{ t('resetPw.success') }}</p>
          <router-link to="/login" class="btn btn-primary" style="margin-top:16px">{{ t('auth.login') }}</router-link>
        </div>
        <form v-else @submit.prevent="handleSubmit">
          <div v-if="error" class="auth-error">{{ error }}</div>
          <div class="form-group">
            <label>{{ t('account.newPassword') }}</label>
            <input class="input" type="password" v-model="password" minlength="6" required />
          </div>
          <div class="form-group">
            <label>{{ t('account.confirmNewPassword') }}</label>
            <input class="input" type="password" v-model="confirmPassword" minlength="6" required />
          </div>
          <button class="btn btn-primary" type="submit" :disabled="loading" style="width:100%;margin-top:12px">
            {{ loading ? t('common.loading') : t('resetPw.submit') }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api'
import { useI18n } from '../langs/useI18n'
const { t } = useI18n()
const route = useRoute()
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const success = ref(false)
const error = ref('')

async function handleSubmit() {
  if (password.value !== confirmPassword.value) { error.value = t('auth.passwordMismatch'); return }
  loading.value = true; error.value = ''
  try {
    const token = route.query.token
    if (!token) { error.value = 'Token bulunamadi'; return }
    await api.post('/auth/reset-password', { token, password: password.value })
    success.value = true
  } catch (e) {
    error.value = e.response?.data?.error?.message || t('toast.genericError')
  } finally { loading.value = false }
}
</script>

<style scoped>
.auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at top, rgba(99,102,241,0.08) 0%, transparent 50%), var(--bg-primary); }
.auth-container { width: 100%; max-width: 400px; padding: 16px; }
.auth-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: 32px; }
.auth-card h2 { font-size: 22px; font-weight: 700; margin-bottom: 20px; }
.auth-error { background: var(--danger-soft); color: var(--danger); padding: 10px 14px; border-radius: var(--radius); font-size: 13px; margin-bottom: 16px; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.success-msg { text-align: center; padding: 20px 0; }
.success-msg p { margin-top: 12px; color: var(--text-secondary); font-size: 14px; }
</style>
