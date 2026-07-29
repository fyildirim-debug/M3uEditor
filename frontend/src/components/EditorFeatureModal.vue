<template>
  <Teleport to="body">
    <div v-focus-trap class="feature-overlay" @click.self="requestClose" @keydown.esc="requestClose">
      <section class="feature-modal" :class="{ 'feature-modal-wide': wide }" role="dialog" aria-modal="true" :aria-label="title">
        <header class="feature-header">
          <h3>{{ title }}</h3>
          <button class="btn btn-ghost btn-icon-sm" type="button" :aria-label="t('common.close')" :disabled="closeDisabled" @click="requestClose">✕</button>
        </header>
        <div class="feature-body"><slot /></div>
        <footer v-if="$slots.actions" class="feature-actions"><slot name="actions" /></footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { useI18n } from '../langs/useI18n'

const props = defineProps({
  title: { type: String, required: true },
  wide: { type: Boolean, default: false },
  closeDisabled: { type: Boolean, default: false }
})
const emit = defineEmits(['close'])

const { t } = useI18n()

function requestClose() {
  if (!props.closeDisabled) emit('close')
}
</script>

<style scoped>
.feature-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}
.feature-modal {
  width: min(100%, 480px);
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  padding: 24px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
}
.feature-modal-wide { width: min(100%, 720px); }
.feature-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}
.feature-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
.feature-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
@media (max-width: 600px) {
  .feature-modal { padding: 20px; }
}
</style>
