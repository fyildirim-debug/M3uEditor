<template>
  <div class="landing">
    <!-- Hero -->
    <section class="hero">
      <div class="hero-glow glow-accent"></div>
      <div class="hero-glow-2 glow-accent"></div>
      <div class="hero-content">
        <div class="hero-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          <span>M3U Editor</span>
        </div>
        <h1 class="hero-title">{{ t('landing.heroTitle') }}</h1>
        <p class="hero-subtitle">{{ t('landing.heroSubtitle') }}</p>
        <div class="hero-actions">
          <router-link v-if="auth.isLoggedIn" to="/dashboard" class="btn btn-primary btn-lg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
            Dashboard'a Git
          </router-link>
          <router-link v-else to="/login" class="btn btn-primary btn-lg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            {{ t('landing.ctaStart') }}
          </router-link>
          <router-link to="/pricing" class="btn btn-secondary btn-lg">
            {{ t('landing.ctaPlans') }}
          </router-link>
        </div>
        <div class="hero-stats">
          <div class="hero-stat">
            <span class="hero-stat-num">6+</span>
            <span class="hero-stat-label">{{ t('landing.featXtream').split(' ')[0] }}</span>
          </div>
          <div class="hero-stat-sep"></div>
          <div class="hero-stat">
            <span class="hero-stat-num">M3U</span>
            <span class="hero-stat-label">Import / Export</span>
          </div>
          <div class="hero-stat-sep"></div>
          <div class="hero-stat">
            <span class="hero-stat-num">EPG</span>
            <span class="hero-stat-label">TV Guide</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section class="features-section" id="features">
      <div class="section-container">
        <div class="features-grid">
          <div class="feature-card card">
            <div class="feature-icon feature-icon-indigo">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
            <h3>{{ t('landing.featXtream') }}</h3>
            <p>{{ t('landing.featXtreamDesc') }}</p>
          </div>
          <div class="feature-card card">
            <div class="feature-icon feature-icon-purple">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
            </div>
            <h3>{{ t('landing.featM3u') }}</h3>
            <p>{{ t('landing.featM3uDesc') }}</p>
          </div>
          <div class="feature-card card">
            <div class="feature-icon feature-icon-blue">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
            </div>
            <h3>{{ t('landing.featEpg') }}</h3>
            <p>{{ t('landing.featEpgDesc') }}</p>
          </div>
          <div class="feature-card card">
            <div class="feature-icon feature-icon-emerald">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </div>
            <h3>{{ t('landing.featBulk') }}</h3>
            <p>{{ t('landing.featBulkDesc') }}</p>
          </div>
          <div class="feature-card card">
            <div class="feature-icon feature-icon-amber">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/></svg>
            </div>
            <h3>{{ t('landing.featVod') }}</h3>
            <p>{{ t('landing.featVodDesc') }}</p>
          </div>
          <div class="feature-card card">
            <div class="feature-icon feature-icon-rose">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </div>
            <h3>{{ t('landing.featShare') }}</h3>
            <p>{{ t('landing.featShareDesc') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section class="how-section">
      <div class="section-container">
        <h2 class="section-title">{{ t('landing.howTitle') }}</h2>
        <div class="steps-grid">
          <div class="step-card">
            <div class="step-number">1</div>
            <h3>{{ t('landing.step1') }}</h3>
            <p>{{ t('landing.step1Desc') }}</p>
          </div>
          <div class="step-connector">
            <svg width="40" height="12" viewBox="0 0 40 12" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round"><line x1="0" y1="6" x2="34" y2="6"/><polyline points="30 2 36 6 30 10"/></svg>
          </div>
          <div class="step-card">
            <div class="step-number">2</div>
            <h3>{{ t('landing.step2') }}</h3>
            <p>{{ t('landing.step2Desc') }}</p>
          </div>
          <div class="step-connector">
            <svg width="40" height="12" viewBox="0 0 40 12" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round"><line x1="0" y1="6" x2="34" y2="6"/><polyline points="30 2 36 6 30 10"/></svg>
          </div>
          <div class="step-card">
            <div class="step-number">3</div>
            <h3>{{ t('landing.step3') }}</h3>
            <p>{{ t('landing.step3Desc') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing preview -->
    <section class="pricing-preview-section">
      <div class="section-container pricing-preview">
        <div class="pricing-preview-content">
          <h2>{{ t('pricing2.title') }}</h2>
          <p>{{ t('pricing2.subtitle') }}</p>
        </div>
        <router-link to="/pricing" class="btn btn-primary btn-lg">
          {{ t('landing.ctaPlans') }}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </router-link>
      </div>
    </section>

    <!-- Footer -->
    <footer class="landing-footer">
      <div class="section-container footer-inner">
        <div class="footer-brand">
          <div class="logo-mark" style="width:28px;height:28px;border-radius:7px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </div>
          <span class="footer-brand-text">M3U Editor</span>
        </div>
        <nav class="footer-links">
          <router-link to="/pricing">{{ t('pricing2.title') }}</router-link>
          <router-link to="/terms">{{ t('legal.termsTitle') }}</router-link>
          <router-link to="/privacy">{{ t('legal.privacyTitle') }}</router-link>
        </nav>
        <p class="footer-copy">&copy; {{ new Date().getFullYear() }} M3U Editor. {{ t('landing.footerRights') }}</p>
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
  overflow-x: hidden;
}

/* ── Hero ────────────────────────────────────── */
.hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 52px);
  padding: 80px 24px 60px;
  text-align: center;
  overflow: hidden;
}

.hero-glow {
  position: absolute;
  top: -200px;
  left: 50%;
  transform: translateX(-50%);
  width: 800px;
  height: 800px;
  background: radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 65%);
  pointer-events: none;
}

.hero-glow-2 {
  position: absolute;
  bottom: -300px;
  right: -200px;
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 65%);
  pointer-events: none;
}

.hero-content {
  position: relative;
  z-index: 1;
  max-width: 700px;
  animation: fadeInScale 0.6s ease;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: var(--accent-soft);
  border: 1px solid rgba(99,102,241,0.2);
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-hover);
  margin-bottom: 28px;
}

.hero-title {
  font-size: clamp(32px, 5vw, 52px);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -1.5px;
  color: var(--text-primary);
  margin-bottom: 18px;
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--accent-hover) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: clamp(15px, 2vw, 18px);
  color: var(--text-secondary);
  line-height: 1.7;
  max-width: 560px;
  margin: 0 auto 36px;
}

.hero-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
}

.btn-lg {
  padding: 13px 28px;
  font-size: 14.5px;
  font-weight: 600;
  border-radius: var(--radius-md);
}

.hero-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-top: 56px;
  padding-top: 32px;
  border-top: 1px solid var(--border);
}

.hero-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.hero-stat-num {
  font-size: 20px;
  font-weight: 800;
  color: var(--accent-hover);
  letter-spacing: -0.5px;
}

.hero-stat-label {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}

.hero-stat-sep {
  width: 1px;
  height: 32px;
  background: var(--border-light);
}

/* ── Sections ────────────────────────────────── */
.section-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 24px;
}

.section-title {
  text-align: center;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
  margin-bottom: 48px;
  color: var(--text-primary);
}

/* ── Features ────────────────────────────────── */
.features-section {
  padding: 80px 0;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}

.feature-card {
  padding: 28px 24px;
  transition: all var(--transition);
}

.feature-card:hover {
  border-color: var(--accent-soft);
  transform: translateY(-3px);
  box-shadow: var(--shadow-glow);
}

.feature-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
}

.feature-icon-indigo { background: rgba(99,102,241,0.12); color: #818cf8; }
.feature-icon-purple { background: rgba(124,58,237,0.12); color: #a78bfa; }
.feature-icon-blue { background: rgba(59,130,246,0.12); color: #60a5fa; }
.feature-icon-emerald { background: rgba(16,185,129,0.12); color: #34d399; }
.feature-icon-amber { background: rgba(245,158,11,0.12); color: #fbbf24; }
.feature-icon-rose { background: rgba(244,63,94,0.12); color: #fb7185; }

.feature-card h3 {
  font-size: 15px;
  font-weight: 650;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.feature-card p {
  font-size: 13.5px;
  color: var(--text-secondary);
  line-height: 1.65;
}

/* ── How it works ────────────────────────────── */
.how-section {
  padding: 80px 0;
  border-top: 1px solid var(--border);
}

.steps-grid {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 12px;
}

.step-card {
  text-align: center;
  max-width: 220px;
}

.step-number {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%);
  color: white;
  font-size: 20px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  box-shadow: 0 4px 16px rgba(99,102,241,0.3);
}

.step-card h3 {
  font-size: 15px;
  font-weight: 650;
  margin-bottom: 6px;
  color: var(--text-primary);
}

.step-card p {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.step-connector {
  margin-top: 18px;
  flex-shrink: 0;
}

/* ── Pricing preview ─────────────────────────── */
.pricing-preview-section {
  padding: 60px 0;
}

.pricing-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
  padding: 40px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
}

.pricing-preview-content h2 {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 6px;
  color: var(--text-primary);
}

.pricing-preview-content p {
  font-size: 14px;
  color: var(--text-secondary);
}

/* ── Footer ──────────────────────────────────── */
.landing-footer {
  border-top: 1px solid var(--border);
  padding: 40px 0;
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 20px;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.footer-brand-text {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.footer-links {
  display: flex;
  gap: 24px;
}

.footer-links a {
  font-size: 13px;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color var(--transition);
}

.footer-links a:hover {
  color: var(--accent-hover);
}

.footer-copy {
  font-size: 12px;
  color: var(--text-muted);
  width: 100%;
  text-align: center;
  margin-top: 12px;
}

/* ── Responsive ──────────────────────────────── */
@media (max-width: 768px) {
  .features-grid {
    grid-template-columns: 1fr;
  }

  .steps-grid {
    flex-direction: column;
    align-items: center;
  }

  .step-connector {
    transform: rotate(90deg);
    margin: 4px 0;
  }

  .pricing-preview {
    flex-direction: column;
    text-align: center;
    padding: 28px 24px;
  }

  .footer-inner {
    flex-direction: column;
    text-align: center;
  }

  .footer-links {
    justify-content: center;
  }

  .hero-stats {
    gap: 16px;
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .features-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
