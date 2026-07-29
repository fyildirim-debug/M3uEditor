<template>
  <div class="legal-page">
    <div class="legal-container">
      <h1>{{ t('legal.termsTitle') }}</h1>
      <p class="legal-date">{{ t('legal.lastUpdated') }}</p>

      <section>
        <h2>{{ t('legal.terms.generalTitle') }}</h2>
        <p>{{ t('legal.terms.generalBody') }}</p>
      </section>

      <section>
        <h2>{{ t('legal.terms.serviceTitle') }}</h2>
        <p>{{ t('legal.terms.serviceBody') }}</p>
      </section>

      <section>
        <h2>{{ t('legal.terms.responsibilityTitle') }}</h2>
        <p>{{ t('legal.terms.responsibilityBody') }}</p>
      </section>

      <section>
        <h2>{{ t('legal.terms.contentTitle') }}</h2>
        <p>{{ t('legal.terms.contentBody') }}</p>
      </section>

      <section>
        <h2>{{ t('legal.terms.terminationTitle') }}</h2>
        <p>{{ t('legal.terms.terminationBody') }}</p>
      </section>

      <section>
        <h2>{{ t('legal.terms.changesTitle') }}</h2>
        <p>{{ t('legal.terms.changesBody') }}</p>
      </section>

      <div class="legal-back">
        <router-link to="/" class="btn btn-ghost">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          {{ t('legal.home') }}
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
.legal-page {
  min-height: 100vh;
  padding: 80px 24px 60px;
  animation: fadeIn 0.4s ease;
}

.legal-container {
  max-width: 720px;
  margin: 0 auto;
}

.legal-container h1 {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.5px;
  margin-bottom: 6px;
  color: var(--text-primary);
}

.legal-date {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 40px;
}

.legal-container section {
  margin-bottom: 28px;
}

.legal-container h2 {
  font-size: 16px;
  font-weight: 650;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.legal-container p {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.75;
}

.legal-back {
  margin-top: 40px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}
</style>
