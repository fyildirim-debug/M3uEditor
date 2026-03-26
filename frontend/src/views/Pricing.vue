<template>
  <div class="pricing-page">
    <div class="pricing-container">
      <div class="pricing-header">
        <h1>{{ t('pricing2.title') }}</h1>
        <p>{{ t('pricing2.subtitle') }}</p>
      </div>

      <div class="pricing-grid">
        <!-- Free -->
        <div class="pricing-card card">
          <div class="pricing-card-header">
            <h3>{{ t('pricing2.free') }}</h3>
            <div class="pricing-price">
              <span class="price-amount">$0</span>
            </div>
          </div>
          <ul class="pricing-features">
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {{ t('pricing2.freePlaylists') }}
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {{ t('pricing2.freeChannels') }}
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {{ t('pricing2.freeFeatures') }}
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {{ t('pricing2.freeM3u') }}
            </li>
          </ul>
          <router-link to="/login" class="btn btn-secondary pricing-cta">
            {{ t('pricing2.ctaFree') }}
          </router-link>
        </div>

        <!-- Pro -->
        <div class="pricing-card pricing-card-featured card">
          <div class="pricing-popular-badge">{{ t('pricing2.popular') }}</div>
          <div class="pricing-card-header">
            <h3>{{ t('pricing2.pro') }}</h3>
            <div class="pricing-price">
              <span class="price-amount">$9.99</span>
              <span class="price-period">/ {{ t('pricing2.month') }}</span>
            </div>
          </div>
          <ul class="pricing-features">
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {{ t('pricing2.proPlaylists') }}
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {{ t('pricing2.proChannels') }}
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {{ t('pricing2.proEpg') }}
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {{ t('pricing2.proMeta') }}
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {{ t('pricing2.proSupport') }}
            </li>
          </ul>
          <router-link to="/login" class="btn btn-primary pricing-cta">
            {{ t('pricing2.ctaPro') }}
          </router-link>
        </div>

        <!-- Business -->
        <div class="pricing-card card">
          <div class="pricing-card-header">
            <h3>{{ t('pricing2.business') }}</h3>
            <div class="pricing-price">
              <span class="price-amount">$24.99</span>
              <span class="price-period">/ {{ t('pricing2.month') }}</span>
            </div>
          </div>
          <ul class="pricing-features">
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {{ t('pricing2.bizPlaylists') }}
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {{ t('pricing2.bizChannels') }}
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {{ t('pricing2.bizApi') }}
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {{ t('pricing2.bizSupport') }}
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {{ t('pricing2.bizWhitelabel') }}
            </li>
          </ul>
          <a href="mailto:info@m3ueditor.com" class="btn btn-secondary pricing-cta">
            {{ t('pricing2.ctaBusiness') }}
          </a>
        </div>
      </div>

      <div class="pricing-back">
        <router-link to="/" class="btn btn-ghost">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Ana Sayfa
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '../langs/useI18n'

const { t } = useI18n()
</script>

<style scoped>
.pricing-page {
  min-height: 100vh;
  padding: 80px 24px 60px;
  animation: fadeIn 0.4s ease;
}

.pricing-container {
  max-width: 1050px;
  margin: 0 auto;
}

.pricing-header {
  text-align: center;
  margin-bottom: 56px;
}

.pricing-header h1 {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -1px;
  margin-bottom: 10px;
  color: var(--text-primary);
}

.pricing-header p {
  font-size: 16px;
  color: var(--text-secondary);
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  align-items: start;
}

.pricing-card {
  position: relative;
  padding: 32px 28px;
  display: flex;
  flex-direction: column;
}

.pricing-card-featured {
  border-color: var(--accent);
  box-shadow: var(--shadow-glow-md);
  transform: scale(1.03);
}

.pricing-popular-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 16px;
  background: linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%);
  color: white;
  font-size: 11.5px;
  font-weight: 700;
  border-radius: 20px;
  white-space: nowrap;
  box-shadow: 0 2px 12px rgba(99,102,241,0.4);
}

.pricing-card-header {
  margin-bottom: 24px;
}

.pricing-card-header h3 {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.pricing-price {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.price-amount {
  font-size: 36px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -1px;
}

.price-period {
  font-size: 14px;
  color: var(--text-muted);
  font-weight: 500;
}

.pricing-features {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 28px;
  flex: 1;
}

.pricing-features li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13.5px;
  color: var(--text-secondary);
}

.pricing-cta {
  width: 100%;
  text-decoration: none;
  text-align: center;
}

.pricing-back {
  text-align: center;
  margin-top: 40px;
}

@media (max-width: 768px) {
  .pricing-grid {
    grid-template-columns: 1fr;
    max-width: 380px;
    margin: 0 auto;
  }

  .pricing-card-featured {
    transform: none;
  }

  .pricing-page {
    padding: 48px 16px 40px;
  }
}
</style>
