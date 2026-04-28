<template>
  <div class="landing">
    <section class="hero">
      <div class="hero-orb hero-orb--1"></div>
      <div class="hero-orb hero-orb--2"></div>

      <div class="hero-content">
        <div class="hero-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
          <span>{{ t('landing.badge') }}</span>
        </div>

        <h1 class="hero-title">{{ t('landing.title') }}</h1>
        <p class="hero-subtitle">{{ t('landing.subtitle') }}</p>

        <div class="hero-actions">
          <router-link v-if="auth.isLoggedIn" to="/dashboard" class="btn-cta btn-cta--primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
            {{ t('nav.dashboard') }}
          </router-link>
          <router-link v-else to="/login" class="btn-cta btn-cta--primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            {{ t('landing.ctaStart') }}
          </router-link>
          <a href="https://github.com/fyildirim-debug/M3uEditor" target="_blank" rel="noopener" class="btn-cta btn-cta--secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
            {{ t('landing.ctaGithub') }}
          </a>
        </div>

        <p class="hero-meta">{{ t('landing.meta') }}</p>
      </div>
    </section>

    <footer class="landing-footer">
      <div class="footer-inner">
        <span>&copy; {{ new Date().getFullYear() }} M3U Editor</span>
        <div class="footer-links">
          <router-link to="/terms">{{ t('legal.termsTitle') }}</router-link>
          <router-link to="/privacy">{{ t('legal.privacyTitle') }}</router-link>
          <a href="https://github.com/fyildirim-debug/M3uEditor" target="_blank" rel="noopener">GitHub</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { useI18n } from '../langs/useI18n'
import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
</script>

<style scoped>
.landing {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.hero {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  overflow: hidden;
}

.hero-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.35;
  pointer-events: none;
}
.hero-orb--1 {
  top: -120px; left: -100px;
  width: 380px; height: 380px;
  background: radial-gradient(circle, rgba(99,102,241,0.6), transparent 70%);
}
.hero-orb--2 {
  bottom: -160px; right: -120px;
  width: 420px; height: 420px;
  background: radial-gradient(circle, rgba(124,58,237,0.5), transparent 70%);
}
:global([data-theme="light"]) .hero-orb { opacity: 0.18; }

.hero-content {
  position: relative;
  max-width: 720px;
  text-align: center;
  z-index: 1;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--accent-soft);
  border: 1px solid rgba(99, 102, 241, 0.25);
  color: var(--accent-hover);
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 24px;
}

.hero-title {
  font-size: clamp(36px, 6vw, 56px);
  font-weight: 800;
  letter-spacing: -1.2px;
  line-height: 1.1;
  margin: 0 0 18px;
  color: var(--text-primary);
  background: linear-gradient(135deg, #ffffff 0%, #c7d2fe 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
:global([data-theme="light"]) .hero-title {
  background: none;
  -webkit-text-fill-color: currentColor;
  color: var(--text-primary);
}

.hero-subtitle {
  font-size: 17px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin: 0 auto 36px;
  max-width: 560px;
}

.hero-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 28px;
}

.btn-cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 22px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s, background 0.2s, border-color 0.2s;
  border: 1px solid transparent;
  white-space: nowrap;
}
.btn-cta--primary {
  background: linear-gradient(135deg, var(--accent), #7c3aed);
  color: #fff;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
}
.btn-cta--primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(99, 102, 241, 0.5);
}
.btn-cta--secondary {
  background: var(--bg-card);
  color: var(--text-primary);
  border-color: var(--border-light);
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.btn-cta--secondary:hover {
  background: var(--bg-card-hover);
  border-color: var(--accent);
  color: var(--accent);
  transform: translateY(-2px);
}
:global([data-theme="light"]) .btn-cta--secondary {
  border-color: rgba(0,0,0,0.15);
}

.hero-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
  letter-spacing: 0.3px;
}

.landing-footer {
  border-top: 1px solid var(--border);
  padding: 18px 24px;
  font-size: 12px;
  color: var(--text-muted);
}
.footer-inner {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.footer-links {
  display: flex;
  gap: 18px;
}
.footer-links a {
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.2s;
}
.footer-links a:hover {
  color: var(--text-primary);
}

@media (max-width: 600px) {
  .hero { padding: 60px 20px; }
  .footer-inner { flex-direction: column; text-align: center; }
}
</style>
