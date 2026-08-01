<template>
  <Teleport to="body">
    <div v-focus-trap class="confirm-overlay" @click.self="onCancel" @keydown.esc="onCancel">
      <div class="modal confirm-modal" role="dialog" aria-modal="true" :aria-label="title">
        <div class="modal-header">
          <h3>{{ title }}</h3>
          <button class="btn btn-ghost btn-icon-sm" type="button" :aria-label="t('common.close')" :disabled="loading" @click="onCancel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <p class="confirm-message">{{ message }}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" type="button" :disabled="loading" @click="onCancel">{{ cancelText || t('common.cancel') }}</button>
          <button :class="['btn', danger ? 'btn-danger' : 'btn-primary']" type="button" :disabled="loading" @click="$emit('confirm')">
            <span v-if="loading" class="spinner spinner-sm"></span>
            {{ confirmText || t('common.delete') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { useI18n } from '../langs/useI18n'

defineProps({
  title: { type: String, required: true },
  message: { type: String, required: true },
  confirmText: { type: String, default: '' },
  cancelText: { type: String, default: '' },
  danger: { type: Boolean, default: true },
  loading: { type: Boolean, default: false }
})
const emit = defineEmits(['confirm', 'cancel'])
const { t } = useI18n()

function onCancel() {
  emit('cancel')
}
</script>

<style scoped>
.confirm-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center; z-index: 1100;
  backdrop-filter: blur(4px); padding: 16px;
}
.confirm-modal {
  width: min(100%, 420px); padding: 20px;
  background: var(--bg-secondary); border: 1px solid var(--border-light);
  border-radius: var(--radius-xl); box-shadow: var(--shadow-lg);
}
.modal-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.modal-header h3 { margin: 0; font-size: 15px; font-weight: 600; }
.confirm-message { margin: 0 0 18px; color: var(--text-secondary); font-size: 13px; line-height: 1.55; word-break: break-word; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
