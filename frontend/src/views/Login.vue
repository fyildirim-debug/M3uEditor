<template>
  <div class="auth-page">
    <div class="auth-bg"></div>
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-logo">
          <div class="logo-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
          </div>
          <h1 class="auth-title">M3U Playlist Editor</h1>
          <p class="auth-subtitle">{{ isRegister ? t('auth.subtitleRegister') : t('auth.subtitleLogin') }}</p>
        </div>

        <div v-if="error" class="auth-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          {{ error }}
        </div>

        <form @submit.prevent="handleSubmit" class="auth-form">
          <div class="form-group">
            <label>{{ t('auth.email') }}</label>
            <div class="input-wrapper">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              <input class="input input-with-icon" type="email" v-model="email" placeholder="ornek@email.com" required autocomplete="email" />
            </div>
          </div>

          <div class="form-group">
            <label>{{ t('auth.password') }}</label>
            <div class="input-wrapper">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <input class="input input-with-icon" :type="showPass ? 'text' : 'password'" v-model="password" placeholder="En az 6 karakter" required minlength="6" />
              <button type="button" class="pass-toggle" @click="showPass = !showPass" tabindex="-1">
                <svg v-if="!showPass" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              </button>
            </div>
            <div v-if="isRegister && password.length > 0" class="password-strength">
              <div class="strength-bar">
                <div class="strength-fill" :style="{ width: strengthPercent + '%' }" :class="strengthClass"></div>
              </div>
              <span class="strength-text" :class="strengthClass">{{ strengthLabel }}</span>
            </div>
          </div>

          <div v-if="isRegister" class="form-group">
            <label>{{ t('auth.confirmPassword') }}</label>
            <div class="input-wrapper">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <input
                class="input input-with-icon"
                :class="{ 'input-error': confirmPassword && confirmPassword !== password }"
                :type="showPass ? 'text' : 'password'"
                v-model="confirmPassword"
                placeholder="Şifreyi tekrar gir"
                required
              />
            </div>
            <p v-if="confirmPassword && confirmPassword !== password" class="field-error">{{ t('auth.passwordMismatch') }}</p>
          </div>

          <router-link v-if="!isRegister" to="/forgot-password" style="display:block;text-align:right;font-size:12px;color:var(--accent);text-decoration:none;margin-top:-4px;margin-bottom:8px">{{ t('forgotPw.link') }}</router-link>
          <button class="btn btn-primary btn-submit" type="submit" :disabled="loading || (isRegister && (!confirmPassword || confirmPassword !== password))">
            <span v-if="loading" class="spinner" style="width:16px;height:16px;border-width:2px"></span>
            <template v-else>
              <svg v-if="!isRegister" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            </template>
            {{ isRegister ? t('auth.createAccount') : t('auth.login') }}
          </button>
        </form>

        <div class="auth-divider"><span>{{ t('auth.divider') }}</span></div>

        <p class="auth-toggle">
          {{ isRegister ? t('auth.hasAccount') : t('auth.noAccount') }}
          <a @click="isRegister = !isRegister; error = ''; confirmPassword = ''">
            {{ isRegister ? t('auth.login') : t('auth.freeSignup') }}
          </a>
        </p>
      </div>
      <p class="auth-footer">M3U Playlist Editor &copy; 2025</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useI18n } from '../langs/useI18n'

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()
const toast = inject('toast')

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const isRegister = ref(false)
const loading = ref(false)
const error = ref('')
const showPass = ref(false)

const strengthPercent = computed(() => {
  const p = password.value
  if (!p) return 0
  let score = 0
  if (p.length >= 6) score += 25
  if (p.length >= 10) score += 25
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score += 25
  if (/[0-9]/.test(p) || /[^A-Za-z0-9]/.test(p)) score += 25
  return score
})

const strengthClass = computed(() => {
  if (strengthPercent.value <= 25) return 'weak'
  if (strengthPercent.value <= 50) return 'fair'
  if (strengthPercent.value <= 75) return 'good'
  return 'strong'
})

const strengthLabel = computed(() => {
  if (strengthPercent.value <= 25) return t('passwordStrength.weak')
  if (strengthPercent.value <= 50) return t('passwordStrength.fair')
  if (strengthPercent.value <= 75) return t('passwordStrength.good')
  return t('passwordStrength.strong')
})

async function handleSubmit() {
  if (isRegister.value && password.value !== confirmPassword.value) {
    error.value = t('auth.passwordMismatch')
    return
  }
  loading.value = true
  error.value = ''
  try {
    if (isRegister.value) {
      await auth.register(email.value, password.value)
      toast(t('toast.accountCreated'), 'success')
    } else {
      await auth.login(email.value, password.value)
    }
    router.push('/dashboard')
  } catch (err) {
    error.value = err.response?.data?.error?.message || t('toast.genericError')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  padding: 20px; position: relative; overflow: hidden;
}
.auth-bg {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(124,58,237,0.06) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 80%, rgba(16,185,129,0.04) 0%, transparent 50%),
    var(--bg-primary);
}
.auth-container {
  position: relative; z-index: 1; width: 100%; max-width: 420px;
  display: flex; flex-direction: column; align-items: center;
}
.auth-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl); padding: 40px 36px;
  width: 100%; box-shadow: var(--shadow-lg);
  animation: fadeInScale 0.4s ease;
  backdrop-filter: blur(20px);
}
.auth-logo { text-align: center; margin-bottom: 32px; }
.logo-icon {
  width: 56px; height: 56px; margin: 0 auto 16px;
  background: linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%);
  border-radius: 16px; display: flex; align-items: center; justify-content: center;
  color: white; box-shadow: 0 4px 20px rgba(99,102,241,0.3);
}
.auth-title { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
.auth-subtitle { color: var(--text-secondary); font-size: 13px; margin-top: 6px; }
.auth-form { display: flex; flex-direction: column; gap: 18px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
.input-wrapper { position: relative; display: flex; align-items: center; }
.input-icon { position: absolute; left: 12px; color: var(--text-muted); pointer-events: none; }
.input-with-icon { padding-left: 38px; }
.pass-toggle {
  position: absolute; right: 10px; background: none; border: none;
  color: var(--text-muted); cursor: pointer; padding: 4px;
  transition: color var(--transition);
}
.pass-toggle:hover { color: var(--text-primary); }
.password-strength { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.strength-bar { flex: 1; height: 3px; background: var(--bg-hover); border-radius: 2px; overflow: hidden; }
.strength-fill { height: 100%; border-radius: 2px; transition: width 0.3s ease; }
.strength-fill.weak { background: var(--danger); }
.strength-fill.fair { background: var(--warning); }
.strength-fill.good { background: #3b82f6; }
.strength-fill.strong { background: var(--success); }
.strength-text { font-size: 11px; font-weight: 500; white-space: nowrap; }
.strength-text.weak { color: var(--danger); }
.strength-text.fair { color: var(--warning); }
.strength-text.good { color: #3b82f6; }
.strength-text.strong { color: var(--success); }
.field-error { font-size: 11px; color: var(--danger); margin-top: 2px; }
.btn-submit { width: 100%; padding: 12px; font-size: 14px; font-weight: 600; margin-top: 4px; }
.auth-divider {
  display: flex; align-items: center; gap: 12px; margin: 24px 0;
  color: var(--text-muted); font-size: 12px;
}
.auth-divider::before, .auth-divider::after {
  content: ''; flex: 1; height: 1px; background: var(--border);
}
.auth-toggle { text-align: center; font-size: 13px; color: var(--text-secondary); }
.auth-toggle a {
  color: var(--accent-hover); cursor: pointer; font-weight: 500;
  transition: color var(--transition);
}
.auth-toggle a:hover { color: white; }
.auth-error {
  display: flex; align-items: center; gap: 8px;
  background: var(--danger-soft); border: 1px solid rgba(239,68,68,0.2);
  color: #fca5a5; padding: 12px 14px; border-radius: var(--radius);
  font-size: 13px; margin-bottom: 8px; animation: fadeIn 0.2s ease;
}
.auth-footer { color: var(--text-muted); font-size: 11px; margin-top: 24px; }
</style>
