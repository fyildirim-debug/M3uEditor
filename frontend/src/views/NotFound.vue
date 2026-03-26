<template>
  <div class="not-found">
    <div class="not-found-content">
      <div class="not-found-code">404</div>
      <h1>{{ t('notFound.title') }}</h1>
      <p>{{ t('notFound.desc') }}</p>
      <router-link to="/" class="btn btn-primary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        {{ t('notFound.goHome') }}
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '../langs/useI18n'

const { t } = useI18n()
</script>

<style scoped>
.not-found {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: fadeIn 0.4s ease;
}

.not-found-content {
  text-align: center;
}

.not-found-code {
  font-size: clamp(80px, 15vw, 140px);
  font-weight: 900;
  letter-spacing: -4px;
  line-height: 1;
  background: linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 16px;
  opacity: 0.85;
}

.not-found-content h1 {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.not-found-content p {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 32px;
  max-width: 360px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.6;
}
</style>
