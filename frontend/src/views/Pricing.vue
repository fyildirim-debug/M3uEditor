<template>
  <div class="pricing-page">
    <div class="pricing-container">
      <!-- Header -->
      <div class="pricing-header">
        <h1 class="pricing-gradient-title">{{ t('pricing2.title') }}</h1>
        <p class="pricing-subtitle">{{ t('pricing2.subtitle') }}</p>
      </div>

      <!-- Billing Toggle -->
      <div class="billing-toggle">
        <span :class="{ active: !isAnnual }">{{ t('pricing2.monthly') }}</span>
        <button class="toggle-switch" :class="{ toggled: isAnnual }" @click="isAnnual = !isAnnual" aria-label="Toggle billing period">
          <span class="toggle-knob"></span>
        </button>
        <span :class="{ active: isAnnual }">{{ t('pricing2.annual') }}</span>
        <span v-if="isAnnual" class="discount-badge">{{ t('pricing2.annualDiscount') }}</span>
      </div>

      <!-- Pricing Cards -->
      <div class="pricing-grid">
        <!-- Free -->
        <div class="pricing-card">
          <div class="pricing-card-inner">
            <div class="pricing-card-header">
              <h3>{{ t('pricing2.free') }}</h3>
              <div class="pricing-price">
                <span class="price-amount">$0</span>
                <span class="price-period">/ {{ t('pricing2.month') }}</span>
              </div>
            </div>
            <ul class="pricing-features">
              <li class="included">
                <svg class="feat-icon check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                {{ t('pricing2.freePlaylists') }}
              </li>
              <li class="included">
                <svg class="feat-icon check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                {{ t('pricing2.freeChannels') }}
              </li>
              <li class="included">
                <svg class="feat-icon check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                {{ t('pricing2.freeFeatures') }}
              </li>
              <li class="included">
                <svg class="feat-icon check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                {{ t('pricing2.freeM3u') }}
              </li>
              <li class="excluded">
                <svg class="feat-icon x" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                {{ t('pricing2.proEpg') }}
              </li>
              <li class="excluded">
                <svg class="feat-icon x" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                {{ t('pricing2.bizApi') }}
              </li>
            </ul>
            <router-link to="/login" class="btn btn-secondary pricing-cta">
              {{ t('pricing2.ctaFree') }}
            </router-link>
          </div>
        </div>

        <!-- Pro (Featured) -->
        <div class="pricing-card pricing-card-featured">
          <div class="pricing-popular-badge">
            <span class="badge-dot"></span>
            {{ t('pricing2.popular') }}
          </div>
          <div class="pricing-card-inner">
            <div class="pricing-card-header">
              <h3>{{ t('pricing2.pro') }}</h3>
              <div class="pricing-price">
                <span v-if="isAnnual" class="price-original">${{ monthlyPrices.pro }}</span>
                <span class="price-amount">${{ isAnnual ? annualPrices.pro : monthlyPrices.pro }}</span>
                <span class="price-period">/ {{ t('pricing2.month') }}</span>
              </div>
              <div v-if="isAnnual" class="price-annual-note">
                ${{ (annualPrices.pro * 12).toFixed(0) }} / {{ t('pricing2.perYear') }}
              </div>
            </div>
            <ul class="pricing-features">
              <li class="included">
                <svg class="feat-icon check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                {{ t('pricing2.proPlaylists') }}
              </li>
              <li class="included">
                <svg class="feat-icon check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                {{ t('pricing2.proChannels') }}
              </li>
              <li class="included">
                <svg class="feat-icon check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                {{ t('pricing2.proEpg') }}
              </li>
              <li class="included">
                <svg class="feat-icon check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                {{ t('pricing2.proMeta') }}
              </li>
              <li class="included">
                <svg class="feat-icon check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                {{ t('pricing2.proSupport') }}
              </li>
              <li class="excluded">
                <svg class="feat-icon x" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                {{ t('pricing2.bizApi') }}
              </li>
            </ul>
            <router-link to="/login" class="btn btn-primary pricing-cta">
              {{ t('pricing2.ctaPro') }}
            </router-link>
          </div>
        </div>

        <!-- Business -->
        <div class="pricing-card">
          <div class="pricing-card-inner">
            <div class="pricing-card-header">
              <h3>{{ t('pricing2.business') }}</h3>
              <div class="pricing-price">
                <span v-if="isAnnual" class="price-original">${{ monthlyPrices.biz }}</span>
                <span class="price-amount">${{ isAnnual ? annualPrices.biz : monthlyPrices.biz }}</span>
                <span class="price-period">/ {{ t('pricing2.month') }}</span>
              </div>
              <div v-if="isAnnual" class="price-annual-note">
                ${{ (annualPrices.biz * 12).toFixed(0) }} / {{ t('pricing2.perYear') }}
              </div>
            </div>
            <ul class="pricing-features">
              <li class="included">
                <svg class="feat-icon check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                {{ t('pricing2.bizPlaylists') }}
              </li>
              <li class="included">
                <svg class="feat-icon check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                {{ t('pricing2.bizChannels') }}
              </li>
              <li class="included">
                <svg class="feat-icon check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                {{ t('pricing2.bizApi') }}
              </li>
              <li class="included">
                <svg class="feat-icon check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                {{ t('pricing2.bizSupport') }}
              </li>
              <li class="included">
                <svg class="feat-icon check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                {{ t('pricing2.bizWhitelabel') }}
              </li>
              <li class="included">
                <svg class="feat-icon check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                {{ t('pricing2.proEpg') }}
              </li>
            </ul>
            <a href="mailto:info@m3ueditor.com" class="btn btn-secondary pricing-cta">
              {{ t('pricing2.ctaBusiness') }}
            </a>
          </div>
        </div>
      </div>

      <!-- Feature Comparison Table -->
      <div class="comparison-section">
        <button class="comparison-toggle" @click="showComparison = !showComparison">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          {{ t('pricing2.featureComparison') }}
          <svg class="chevron" :class="{ open: showComparison }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <Transition name="expand">
          <div v-if="showComparison" class="comparison-table-wrap">
            <table class="comparison-table">
              <thead>
                <tr>
                  <th></th>
                  <th>{{ t('pricing2.free') }}</th>
                  <th class="th-featured">{{ t('pricing2.pro') }}</th>
                  <th>{{ t('pricing2.business') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in comparisonRows" :key="row.key">
                  <td class="feature-name">{{ row.label }}</td>
                  <td>
                    <span v-if="typeof row.free === 'boolean'" :class="row.free ? 'comp-check' : 'comp-x'">
                      <svg v-if="row.free" width="16" height="16" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                      <svg v-else width="16" height="16" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </span>
                    <span v-else class="comp-text">{{ row.free }}</span>
                  </td>
                  <td class="td-featured">
                    <span v-if="typeof row.pro === 'boolean'" :class="row.pro ? 'comp-check' : 'comp-x'">
                      <svg v-if="row.pro" width="16" height="16" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                      <svg v-else width="16" height="16" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </span>
                    <span v-else class="comp-text">{{ row.pro }}</span>
                  </td>
                  <td>
                    <span v-if="typeof row.biz === 'boolean'" :class="row.biz ? 'comp-check' : 'comp-x'">
                      <svg v-if="row.biz" width="16" height="16" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                      <svg v-else width="16" height="16" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </span>
                    <span v-else class="comp-text">{{ row.biz }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Transition>
      </div>

      <!-- FAQ Section -->
      <div class="faq-section">
        <h2 class="faq-title">{{ t('pricing2.faq') }}</h2>
        <div class="faq-list">
          <div v-for="i in 4" :key="i" class="faq-item" :class="{ open: openFaq === i }">
            <button class="faq-question" @click="openFaq = openFaq === i ? null : i">
              <span>{{ t(`pricing2.faq${i}q`) }}</span>
              <svg class="faq-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <Transition name="faq-expand">
              <div v-if="openFaq === i" class="faq-answer">
                <p>{{ t(`pricing2.faq${i}a`) }}</p>
              </div>
            </Transition>
          </div>
        </div>
      </div>

      <!-- Back link -->
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
import { ref, computed } from 'vue'
import { useI18n } from '../langs/useI18n'

const { t } = useI18n()

const isAnnual = ref(false)
const showComparison = ref(false)
const openFaq = ref(null)

const monthlyPrices = { pro: '9.99', biz: '24.99' }
const annualPrices = {
  pro: (9.99 * 0.8).toFixed(2),
  biz: (24.99 * 0.8).toFixed(2)
}

const comparisonRows = computed(() => [
  { key: 'playlists', label: 'Playlist Limiti', free: '3', pro: '10', biz: 'Sinirsiz' },
  { key: 'channels', label: 'Kanal Limiti', free: '500', pro: '5.000', biz: 'Sinirsiz' },
  { key: 'epg', label: 'EPG', free: false, pro: true, biz: true },
  { key: 'metadata', label: 'Metadata', free: false, pro: true, biz: true },
  { key: 'm3u', label: 'M3U Import', free: true, pro: true, biz: true },
  { key: 'share', label: 'Paylasim', free: false, pro: true, biz: true },
  { key: 'api', label: 'API Erisimi', free: false, pro: false, biz: true },
  { key: 'support', label: 'Destek', free: 'Topluluk', pro: 'Oncelikli', biz: 'Ozel' }
])
</script>

<style scoped>
.pricing-page {
  min-height: 100vh;
  padding: 80px 24px 60px;
  animation: fadeIn 0.4s ease;
}

.pricing-container {
  max-width: 1100px;
  margin: 0 auto;
}

/* Header */
.pricing-header {
  text-align: center;
  margin-bottom: 40px;
}

.pricing-gradient-title {
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -1.5px;
  margin-bottom: 12px;
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--accent) 50%, #7c3aed 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.pricing-subtitle {
  font-size: 16px;
  color: var(--text-secondary);
  max-width: 440px;
  margin: 0 auto;
  line-height: 1.6;
}

/* Billing Toggle */
.billing-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 48px;
}

.billing-toggle > span:not(.discount-badge) {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-muted);
  transition: color 0.2s ease;
}

.billing-toggle > span.active {
  color: var(--text-primary);
  font-weight: 600;
}

.toggle-switch {
  position: relative;
  width: 48px;
  height: 26px;
  background: var(--bg-tertiary, rgba(255,255,255,0.08));
  border: 1px solid var(--border);
  border-radius: 13px;
  cursor: pointer;
  transition: all 0.25s ease;
  padding: 0;
}

.toggle-switch.toggled {
  background: var(--accent);
  border-color: var(--accent);
}

.toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  background: white;
  border-radius: 50%;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.toggle-switch.toggled .toggle-knob {
  transform: translateX(22px);
}

.discount-badge {
  font-size: 11px;
  font-weight: 700;
  color: #10b981;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.2);
  padding: 3px 10px;
  border-radius: 20px;
  animation: fadeIn 0.3s ease;
}

/* Pricing Grid */
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  align-items: start;
  margin-bottom: 56px;
}

.pricing-card {
  position: relative;
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  border: 1px solid var(--border);
  transition: all 0.3s ease;
}

.pricing-card:hover {
  border-color: rgba(99,102,241,0.2);
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}

.pricing-card-inner {
  padding: 32px 28px;
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Featured card */
.pricing-card-featured {
  border-color: var(--accent);
  transform: translateY(-8px);
  box-shadow:
    0 0 0 1px rgba(99,102,241,0.3),
    0 8px 40px rgba(99,102,241,0.15),
    0 0 80px rgba(99,102,241,0.06);
}

.pricing-card-featured:hover {
  border-color: var(--accent);
  box-shadow:
    0 0 0 1px rgba(99,102,241,0.4),
    0 12px 48px rgba(99,102,241,0.2),
    0 0 100px rgba(99,102,241,0.08);
}

/* Popular badge */
.pricing-popular-badge {
  position: absolute;
  top: -13px;
  left: 50%;
  transform: translateX(-50%);
  padding: 5px 18px;
  background: linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%);
  color: white;
  font-size: 11.5px;
  font-weight: 700;
  border-radius: 20px;
  white-space: nowrap;
  box-shadow: 0 4px 16px rgba(99,102,241,0.4);
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 1;
}

.badge-dot {
  width: 6px;
  height: 6px;
  background: white;
  border-radius: 50%;
  animation: pulse-dot 2s infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.4); }
}

/* Card header */
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

.price-original {
  font-size: 18px;
  color: var(--text-muted);
  text-decoration: line-through;
  margin-right: 4px;
}

.price-period {
  font-size: 14px;
  color: var(--text-muted);
  font-weight: 500;
}

.price-annual-note {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

/* Features */
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
}

.pricing-features li.included {
  color: var(--text-secondary);
}

.pricing-features li.excluded {
  color: var(--text-muted);
  opacity: 0.5;
}

.feat-icon {
  width: 16px;
  height: 16px;
  fill: none;
  stroke-width: 2.5;
  flex-shrink: 0;
}

.feat-icon.check {
  stroke: #10b981;
}

.feat-icon.x {
  stroke: var(--text-muted);
  stroke-width: 2;
}

/* CTA */
.pricing-cta {
  width: 100%;
  text-decoration: none;
  text-align: center;
}

/* Comparison Section */
.comparison-section {
  margin-bottom: 56px;
}

.comparison-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 auto;
  padding: 10px 20px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.comparison-toggle:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.comparison-toggle .chevron {
  transition: transform 0.3s ease;
  margin-left: 4px;
}

.comparison-toggle .chevron.open {
  transform: rotate(180deg);
}

.comparison-table-wrap {
  margin-top: 20px;
  overflow-x: auto;
}

.comparison-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.comparison-table th,
.comparison-table td {
  padding: 12px 16px;
  text-align: center;
  border-bottom: 1px solid var(--border);
}

.comparison-table th {
  font-weight: 700;
  color: var(--text-primary);
  font-size: 13px;
  padding-bottom: 14px;
}

.comparison-table th.th-featured,
.comparison-table td.td-featured {
  background: rgba(99,102,241,0.04);
}

.feature-name {
  text-align: left !important;
  font-weight: 500;
  color: var(--text-secondary);
}

.comp-check svg {
  stroke: #10b981;
  fill: none;
  stroke-width: 2.5;
}

.comp-x svg {
  stroke: var(--text-muted);
  fill: none;
  stroke-width: 2;
  opacity: 0.4;
}

.comp-text {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

/* Expand transition */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}
.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 600px;
}

/* FAQ Section */
.faq-section {
  margin-bottom: 48px;
}

.faq-title {
  font-size: 22px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 28px;
  letter-spacing: -0.5px;
  color: var(--text-primary);
}

.faq-list {
  max-width: 680px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.faq-item {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  transition: border-color 0.2s ease;
}

.faq-item.open {
  border-color: rgba(99,102,241,0.3);
}

.faq-question {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  gap: 12px;
}

.faq-question:hover {
  color: var(--accent-hover);
}

.faq-chevron {
  flex-shrink: 0;
  transition: transform 0.3s ease;
  color: var(--text-muted);
}

.faq-item.open .faq-chevron {
  transform: rotate(180deg);
  color: var(--accent);
}

.faq-answer {
  padding: 0 20px 16px;
}

.faq-answer p {
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--text-secondary);
  margin: 0;
}

/* FAQ expand transition */
.faq-expand-enter-active,
.faq-expand-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}
.faq-expand-enter-from,
.faq-expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}
.faq-expand-enter-to,
.faq-expand-leave-from {
  opacity: 1;
  max-height: 200px;
}

/* Back */
.pricing-back {
  text-align: center;
  margin-top: 40px;
}

/* Responsive */
@media (max-width: 768px) {
  .pricing-grid {
    grid-template-columns: 1fr;
    max-width: 400px;
    margin: 0 auto 56px;
  }

  .pricing-card-featured {
    transform: none;
  }

  .pricing-page {
    padding: 48px 16px 40px;
  }

  .pricing-gradient-title {
    font-size: 28px;
  }

  .comparison-table {
    font-size: 12px;
  }

  .comparison-table th,
  .comparison-table td {
    padding: 10px 8px;
  }
}
</style>
