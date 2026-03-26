<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-card">
        <h2>{{ t('forgotPw.title') }}</h2>
        <p class="auth-subtitle">{{ t('forgotPw.subtitle') }}</p>
        <div v-if="sent" class="success-msg">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <p>{{ t('forgotPw.sent') }}</p>
        </div>
        <form v-else @submit.prevent="handleSubmit">
          <div v-if="error" class="auth-error">{{ error }}</div>
          <div class="form-group">
            <label>{{ t('auth.email') }}</label>
            <input class="input" type="email" v-model="email" :placeholder="t('auth.emailPlaceholder')" required />
          </div>
          <button class="btn btn-primary" type="submit" :disabled="loading" style="width:100%;margin-top:12px">
            {{ loading ? t('common.loading') : t('forgotPw.submit') }}
          </button>
        </form>
        <div style="text-align:center;margin-top:16px">
          <router-link to="/login" style="color:var(--accent);text-decoration:none;font-size:13px">{{ t('forgotPw.backToLogin') }}</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import api from '../api'
import { useI18n } from '../langs/useI18n'
const { t } = useI18n()
const email = ref('')
const loading = ref(false)
const sent = ref(false)
const error = ref('')

async function handleSubmit() {
  loading.value = true; error.value = ''
  try {
    await api.post('/auth/forgot-password', { email: email.value })
    sent.value = true
  } catch (e) {
    error.value = e.response?.data?.error?.message || t('toast.genericError')
  } finally { loading.value = false }
}
</script>

<style scoped>
.auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at top, rgba(99,102,241,0.08) 0%, transparent 50%), var(--bg-primary); }
.auth-container { width: 100%; max-width: 400px; padding: 16px; }
.auth-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: 32px; }
.auth-card h2 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
.auth-subtitle { color: var(--text-secondary); font-size: 13px; margin-bottom: 24px; }
.auth-error { background: var(--danger-soft); color: var(--danger); padding: 10px 14px; border-radius: var(--radius); font-size: 13px; margin-bottom: 16px; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.success-msg { text-align: center; padding: 20px 0; }
.success-msg p { margin-top: 12px; color: var(--text-secondary); font-size: 14px; }
</style>
