<template>
  <div id="app-root">
    <header v-if="auth.isLoggedIn" class="app-header">
      <router-link to="/dashboard" class="logo">
        <div class="logo-mark">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
        </div>
        <span class="logo-text">M3U Editor</span>
      </router-link>
      <nav class="header-nav">
        <router-link to="/dashboard" class="nav-link" active-class="active">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          Playlistler
        </router-link>
      </nav>
      <div class="header-right">
        <div class="user-info">
          <div class="user-avatar">{{ auth.user?.email?.charAt(0).toUpperCase() }}</div>
          <span class="user-email">{{ auth.user?.email }}</span>
        </div>
        <button class="btn btn-ghost btn-sm" @click="handleLogout">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Çıkış
        </button>
      </div>
    </header>
    <router-view />
    <Teleport to="body">
      <TransitionGroup name="toast" tag="div" class="toast-container">
        <div v-for="t in toasts" :key="t.id" :class="['toast', 'toast-' + t.type]">
          <svg v-if="t.type === 'success'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <svg v-else-if="t.type === 'error'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>{{ t.message }}</span>
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
  setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id) }, 3500)
}

provide('toast', showToast)

function handleLogout() {
  auth.logout()
  router.push('/login')
}
</script>

<style>
.app-header {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding: 0 20px; height: 52px;
  display: flex; align-items: center; gap: 24px;
  position: sticky; top: 0; z-index: 100;
  backdrop-filter: blur(12px);
}
.logo {
  display: flex; align-items: center; gap: 10px;
  text-decoration: none; flex-shrink: 0;
}
.logo-mark {
  width: 32px; height: 32px;
  background: linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%);
  border-radius: 9px; display: flex; align-items: center; justify-content: center;
  color: white; box-shadow: 0 2px 8px rgba(99,102,241,0.25);
}
.logo-text { font-size: 15px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.3px; }
.header-nav { display: flex; gap: 4px; flex: 1; }
.nav-link {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: 6px;
  font-size: 13px; font-weight: 500; color: var(--text-secondary);
  text-decoration: none; transition: all var(--transition);
}
.nav-link:hover { color: var(--text-primary); background: var(--bg-hover); }
.nav-link.active { color: var(--accent-hover); background: var(--accent-soft); }
.header-right { display: flex; align-items: center; gap: 12px; margin-left: auto; }
.user-info { display: flex; align-items: center; gap: 8px; }
.user-avatar {
  width: 28px; height: 28px;
  background: linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%);
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 600; color: white;
}
.user-email { font-size: 12px; color: var(--text-secondary); max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Toast */
.toast-container {
  position: fixed; top: 16px; right: 16px; z-index: 10000;
  display: flex; flex-direction: column; gap: 8px;
  pointer-events: none;
}
.toast {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 18px; border-radius: var(--radius-md);
  font-size: 13px; font-weight: 500; min-width: 300px;
  box-shadow: var(--shadow-lg); pointer-events: auto;
  backdrop-filter: blur(12px);
}
.toast-success { background: rgba(16,185,129,0.15); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.2); }
.toast-error { background: rgba(239,68,68,0.15); color: #fca5a5; border: 1px solid rgba(239,68,68,0.2); }
.toast-info { background: rgba(59,130,246,0.15); color: #93c5fd; border: 1px solid rgba(59,130,246,0.2); }
.toast-enter-active { animation: slideUp 0.3s ease; }
.toast-leave-active { transition: all 0.3s ease; }
.toast-leave-to { opacity: 0; transform: translateX(40px); }
</style>
