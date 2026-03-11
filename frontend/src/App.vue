<template>
  <div id="app-root">
    <header v-if="auth.isLoggedIn" class="app-header">
      <router-link to="/dashboard" class="logo" aria-label="Ana sayfa">
        <div class="logo-mark">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
        </div>
        <span class="logo-text">M3U Editor</span>
      </router-link>

      <div class="header-sep" aria-hidden="true"></div>

      <nav class="header-nav" aria-label="Ana navigasyon">
        <router-link to="/dashboard" class="nav-link" active-class="active">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
          Playlistler
        </router-link>
      </nav>

      <div class="header-right">
        <div class="header-status hide-mobile" aria-live="polite">
          <span class="status-dot" title="Sistem aktif" aria-label="Sistem aktif"></span>
          <span class="status-label">Aktif</span>
        </div>

        <div class="header-sep hide-mobile" aria-hidden="true"></div>

        <div class="user-menu" role="group" aria-label="Kullanici bilgisi">
          <div class="user-avatar" aria-hidden="true" title="{{ auth.user?.email }}">
            {{ auth.user?.email?.charAt(0).toUpperCase() }}
          </div>
          <span class="user-email hide-mobile">{{ auth.user?.email }}</span>
        </div>

        <button class="btn btn-ghost btn-sm logout-btn" @click="handleLogout" aria-label="Cikis yap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span class="hide-mobile">Cikis</span>
        </button>
      </div>
    </header>

    <router-view />

    <Teleport to="body">
      <TransitionGroup name="toast" tag="div" class="toast-container" aria-live="assertive" aria-atomic="true">
        <div
          v-for="t in toasts"
          :key="t.id"
          :class="['toast', 'toast-' + t.type]"
          role="alert"
          @click="dismissToast(t.id)"
        >
          <svg v-if="t.type === 'success'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <svg v-else-if="t.type === 'error'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>{{ t.message }}</span>
          <button class="toast-dismiss" aria-label="Bildirimi kapat">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </TransitionGroup>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, provide } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()
const router = useRouter()
const toasts = ref([])

function showToast(message, type = 'info') {
  const id = Date.now() + Math.random()
  toasts.value.push({ id, message, type })
  setTimeout(() => dismissToast(id), 4000)
}

function dismissToast(id) {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

provide('toast', showToast)

function handleLogout() {
  auth.logout()
  router.push('/login')
}
</script>

<style>
/* ── Header ─────────────────────────────────── */
.app-header {
  background: rgba(8, 10, 15, 0.9);
  border-bottom: 1px solid var(--border);
  padding: 0 20px;
  height: var(--header-height, 52px);
  display: flex; align-items: center; gap: 16px;
  position: sticky; top: 0; z-index: 200;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  box-shadow: 0 1px 0 rgba(99,102,241,0.06), 0 4px 24px rgba(0,0,0,0.35);
}

/* Logo */
.logo {
  display: flex; align-items: center; gap: 9px;
  text-decoration: none; flex-shrink: 0;
  border-radius: var(--radius);
  padding: 2px 4px 2px 2px;
  transition: background var(--transition);
}
.logo:hover { background: var(--bg-hover); }
.logo-mark {
  width: 32px; height: 32px;
  background: linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%);
  border-radius: 9px; display: flex; align-items: center; justify-content: center;
  color: white; flex-shrink: 0;
  box-shadow: 0 2px 10px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.15);
  transition: box-shadow var(--transition), transform var(--transition);
}
.logo:hover .logo-mark {
  box-shadow: 0 4px 18px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.2);
  transform: scale(1.06) rotate(-2deg);
}
.logo-text {
  font-size: 14.5px; font-weight: 700;
  color: var(--text-primary); letter-spacing: -0.35px;
}

/* Header separator */
.header-sep {
  width: 1px; height: 20px;
  background: var(--border-light);
  flex-shrink: 0;
}

/* Nav */
.header-nav { display: flex; gap: 2px; flex: 1; }
.nav-link {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 11px; border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 500; color: var(--text-secondary);
  text-decoration: none; transition: all var(--transition);
  position: relative;
}
.nav-link:hover { color: var(--text-primary); background: var(--bg-hover); }
.nav-link.active {
  color: var(--accent-hover);
  background: var(--accent-soft);
}
.nav-link.active::after {
  content: '';
  position: absolute; bottom: -17px; left: 50%;
  transform: translateX(-50%);
  width: 16px; height: 2px;
  background: var(--accent);
  border-radius: 2px 2px 0 0;
}

/* Right side */
.header-right {
  display: flex; align-items: center; gap: 10px;
  margin-left: auto;
}

/* Status indicator */
.header-status {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 10px;
  background: rgba(16,185,129,0.06);
  border: 1px solid rgba(16,185,129,0.12);
  border-radius: 20px;
}
.status-dot {
  width: 6px; height: 6px;
  background: var(--success);
  border-radius: 50%;
  box-shadow: 0 0 6px rgba(16,185,129,0.6);
  animation: pulse 2.5s ease-in-out infinite;
  flex-shrink: 0;
}
.status-label {
  font-size: 11px; font-weight: 500;
  color: var(--success);
}

/* User menu */
.user-menu { display: flex; align-items: center; gap: 8px; }
.user-avatar {
  width: 28px; height: 28px;
  background: linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%);
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: white;
  box-shadow: 0 0 0 2px rgba(99,102,241,0.25), 0 2px 8px rgba(99,102,241,0.2);
  flex-shrink: 0; cursor: default;
}
.user-email {
  font-size: 12px; color: var(--text-secondary);
  max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* Logout */
.logout-btn {
  color: var(--text-muted);
  border: 1px solid transparent;
  transition: all var(--transition);
}
.logout-btn:hover {
  color: var(--danger);
  background: var(--danger-soft);
  border-color: rgba(239,68,68,0.15);
}

/* ── Toast ──────────────────────────────────── */
.toast-container {
  position: fixed; top: 16px; right: 16px; z-index: 10000;
  display: flex; flex-direction: column; gap: 8px;
  pointer-events: none;
  max-width: calc(100vw - 32px);
}
.toast {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 14px 11px 16px;
  border-radius: var(--radius-md);
  font-size: 13px; font-weight: 500;
  min-width: 280px; max-width: 400px;
  box-shadow: var(--shadow-lg), 0 0 0 1px rgba(255,255,255,0.04);
  pointer-events: auto;
  backdrop-filter: blur(20px);
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.toast:hover { transform: translateX(-2px); }
.toast-dismiss {
  margin-left: auto; flex-shrink: 0;
  background: none; border: none; cursor: pointer;
  color: inherit; opacity: 0.5; padding: 2px;
  border-radius: 3px;
  transition: opacity var(--transition);
  line-height: 1;
}
.toast-dismiss:hover { opacity: 1; }
.toast-success {
  background: rgba(16,185,129,0.13);
  color: #6ee7b7;
  border: 1px solid rgba(16,185,129,0.18);
}
.toast-error {
  background: rgba(239,68,68,0.13);
  color: #fca5a5;
  border: 1px solid rgba(239,68,68,0.18);
}
.toast-info {
  background: rgba(59,130,246,0.13);
  color: #93c5fd;
  border: 1px solid rgba(59,130,246,0.18);
}
.toast-enter-active { animation: slideInRight 0.28s cubic-bezier(0.34, 1.56, 0.64, 1); }
.toast-leave-active { transition: all 0.22s ease; }
.toast-leave-to { opacity: 0; transform: translateX(100%); }
.toast-move { transition: transform 0.25s ease; }

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(60px) scale(0.94); }
  to   { opacity: 1; transform: translateX(0) scale(1); }
}

/* ── Responsive ─────────────────────────────── */
@media (max-width: 640px) {
  .app-header { padding: 0 12px; gap: 10px; }
  .logo-text { display: none; }
  .header-sep { display: none; }
  .toast-container { left: 12px; right: 12px; }
  .toast { min-width: unset; width: 100%; }
}
</style>
