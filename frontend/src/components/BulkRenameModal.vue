<template>
  <EditorFeatureModal :title="t('bulkRename.title')" wide @close="$emit('close')">
    <p class="feature-description">{{ t('bulkRename.selection', { count: channelIds.length }) }}</p>
    <div class="form-grid">
      <div class="form-group">
        <label for="bulk-rename-find">{{ t('bulkRename.find') }}</label>
        <input id="bulk-rename-find" v-model="find" class="input" :placeholder="t('bulkRename.findPlaceholder')" autocomplete="off" />
      </div>
      <div class="form-group">
        <label for="bulk-rename-replace">{{ t('bulkRename.replace') }}</label>
        <input id="bulk-rename-replace" v-model="replace" class="input" :placeholder="t('bulkRename.replacePlaceholder')" autocomplete="off" />
      </div>
    </div>
    <label class="check-row">
      <input v-model="useRegex" type="checkbox" />
      <span>{{ t('bulkRename.useRegex') }}</span>
    </label>

    <div v-if="previewed" class="preview-panel">
      <div class="preview-summary">{{ t('bulkRename.affected', { count: preview.affected }) }}</div>
      <p v-if="preview.affected === 0" class="empty-preview">{{ t('bulkRename.noChanges') }}</p>
      <div v-else class="preview-list">
        <div v-for="sample in preview.samples" :key="sample.id" class="preview-item">
          <span class="before">{{ sample.before }}</span>
          <span class="arrow" aria-hidden="true">→</span>
          <span class="after">{{ sample.after }}</span>
        </div>
      </div>
      <p v-if="preview.affected > preview.samples.length" class="sample-note">
        {{ t('bulkRename.sampleLimit', { shown: preview.samples.length, affected: preview.affected }) }}
      </p>
    </div>
    <p v-else class="feature-hint">{{ t('bulkRename.previewRequired') }}</p>

    <template #actions>
      <button class="btn btn-secondary" type="button" :disabled="loading" @click="$emit('close')">{{ t('common.cancel') }}</button>
      <button class="btn btn-secondary" type="button" :disabled="!find || loading" @click="loadPreview">
        <span v-if="previewing" class="spinner spinner-sm"></span>
        {{ t('bulkRename.preview') }}
      </button>
      <button class="btn btn-primary" type="button" :disabled="!previewIsCurrent || preview.affected === 0 || loading" @click="applyRename">
        <span v-if="applying" class="spinner spinner-sm"></span>
        {{ t('bulkRename.apply') }}
      </button>
    </template>
  </EditorFeatureModal>
</template>

<script setup>
import { computed, inject, ref, watch } from 'vue'
import api from '../api'
import { useI18n } from '../langs/useI18n'
import EditorFeatureModal from './EditorFeatureModal.vue'

const props = defineProps({ channelIds: { type: Array, required: true } })
const emit = defineEmits(['close', 'applied'])
const toast = inject('toast')
const { t } = useI18n()

const find = ref('')
const replace = ref('')
const useRegex = ref(false)
const previewing = ref(false)
const applying = ref(false)
const previewed = ref(false)
const preview = ref({ affected: 0, samples: [] })
const loading = computed(() => previewing.value || applying.value)
const currentSignature = computed(() => JSON.stringify(payload()))
const previewSignature = ref('')
const previewIsCurrent = computed(() => previewed.value && previewSignature.value === currentSignature.value)

watch([find, replace, useRegex], () => {
  previewed.value = false
  previewSignature.value = ''
  preview.value = { affected: 0, samples: [] }
})

function payload() {
  return { channelIds: props.channelIds, find: find.value, replace: replace.value, useRegex: useRegex.value }
}

async function loadPreview() {
  const requestedSignature = currentSignature.value
  previewing.value = true
  try {
    const { data } = await api.post('/channels/bulk-rename/preview', payload())
    if (requestedSignature !== currentSignature.value) return
    preview.value = data
    previewSignature.value = requestedSignature
    previewed.value = true
  } catch (error) {
    toast(error.response?.data?.error?.message || t('common.error'), 'error')
  } finally {
    previewing.value = false
  }
}

async function applyRename() {
  applying.value = true
  try {
    const { data } = await api.post('/channels/bulk-rename', payload())
    toast(t('bulkRename.result', data), 'success')
    emit('applied', data)
    emit('close')
  } catch (error) {
    toast(error.response?.data?.error?.message || t('common.error'), 'error')
  } finally {
    applying.value = false
  }
}
</script>

<style scoped>
.feature-description, .feature-hint, .sample-note, .empty-preview { color: var(--text-muted); font-size: 12px; line-height: 1.5; }
.feature-description { margin: 0 0 16px; }
.feature-hint { margin: 14px 0 0; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-group { margin-bottom: 14px; }
.form-group label { display: block; margin-bottom: 5px; color: var(--text-muted); font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
.check-row { display: inline-flex; align-items: center; gap: 8px; color: var(--text-secondary); font-size: 13px; cursor: pointer; }
.preview-panel { margin-top: 16px; overflow: hidden; border: 1px solid var(--border-light); border-radius: var(--radius); }
.preview-summary { padding: 10px 12px; color: var(--text-primary); background: var(--bg-tertiary); font-size: 12px; font-weight: 600; }
.preview-list { max-height: 320px; overflow-y: auto; }
.preview-item { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 10px; align-items: center; padding: 9px 12px; border-top: 1px solid var(--border); font-size: 12px; }
.preview-item span:not(.arrow) { overflow-wrap: anywhere; }
.before { color: var(--text-muted); text-decoration: line-through; }
.after { color: #6ee7b7; }
.arrow { color: var(--accent); }
.empty-preview, .sample-note { margin: 0; padding: 12px; }
.sample-note { border-top: 1px solid var(--border); }
@media (max-width: 600px) {
  .form-grid { grid-template-columns: 1fr; gap: 0; }
  .preview-item { grid-template-columns: minmax(0, 1fr); gap: 4px; }
  .arrow { transform: rotate(90deg); width: min-content; }
}
</style>
