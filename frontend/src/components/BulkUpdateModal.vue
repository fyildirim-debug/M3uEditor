<template>
  <EditorFeatureModal :title="t('bulkUpdate.title')" wide @close="$emit('close')">
    <p class="feature-description">{{ t('bulkUpdate.selection', { count: channelIds.length }) }}</p>
    <div class="field-list">
      <div class="field-row">
        <label class="check-row"><input v-model="enabled.name" type="checkbox" /><span>{{ t('bulkUpdate.setName') }}</span></label>
        <input v-model="values.name" class="input" :disabled="!enabled.name" maxlength="500" :placeholder="t('bulkUpdate.namePlaceholder')" />
      </div>
      <div class="field-row">
        <label class="check-row"><input v-model="enabled.logo" type="checkbox" /><span>{{ t('bulkUpdate.setLogoUrl') }}</span></label>
        <input v-model="values.logo" class="input" type="url" :disabled="!enabled.logo" maxlength="5000" :placeholder="t('bulkUpdate.logoPlaceholder')" />
      </div>
      <div class="field-row">
        <label class="check-row"><input v-model="enabled.streamUrl" type="checkbox" /><span>{{ t('bulkUpdate.setStreamUrl') }}</span></label>
        <input v-model="values.streamUrl" class="input" type="url" :disabled="!enabled.streamUrl" maxlength="5000" :placeholder="t('bulkUpdate.streamUrlPlaceholder')" />
      </div>
      <div class="field-row">
        <label class="check-row"><input v-model="enabled.category" type="checkbox" /><span>{{ t('bulkUpdate.setCategory') }}</span></label>
        <select v-model="values.category" class="input" :disabled="!enabled.category">
          <option :value="null">{{ t('common.uncategorized') }}</option>
          <option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option>
        </select>
      </div>
    </div>
    <p class="feature-hint">{{ t('bulkUpdate.optionalFieldsHint') }}</p>

    <template #actions>
      <button class="btn btn-secondary" type="button" :disabled="saving" @click="$emit('close')">{{ t('common.cancel') }}</button>
      <button class="btn btn-primary" type="button" :disabled="!canApply || saving" @click="applyUpdate">
        <span v-if="saving" class="spinner spinner-sm"></span>
        {{ t('bulkUpdate.apply') }}
      </button>
    </template>
  </EditorFeatureModal>
</template>

<script setup>
import { computed, inject, reactive, ref } from 'vue'
import api from '../api'
import { useI18n } from '../langs/useI18n'
import EditorFeatureModal from './EditorFeatureModal.vue'

const props = defineProps({
  channelIds: { type: Array, required: true },
  categories: { type: Array, default: () => [] }
})
const emit = defineEmits(['close', 'applied'])
const toast = inject('toast')
const { t } = useI18n()

const enabled = reactive({ name: false, logo: false, streamUrl: false, category: false })
const values = reactive({ name: '', logo: '', streamUrl: '', category: null })
const saving = ref(false)
const canApply = computed(() => Object.values(enabled).some(Boolean)
  && (!enabled.name || Boolean(values.name.trim()))
  && (!enabled.streamUrl || Boolean(values.streamUrl.trim())))

async function applyUpdate() {
  const updates = {}
  if (enabled.name) updates.name = values.name.trim()
  if (enabled.logo) updates.logo_url = values.logo.trim()
  if (enabled.streamUrl) updates.stream_url = values.streamUrl.trim()
  if (enabled.category) updates.category_id = values.category

  saving.value = true
  try {
    const { data } = await api.post('/channels/bulk', { action: 'update', channelIds: props.channelIds, updates })
    toast(t('bulkUpdate.result', { count: data.updated }), 'success')
    emit('applied', data)
    emit('close')
  } catch (error) {
    toast(error.response?.data?.error?.message || t('common.error'), 'error')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.feature-description, .feature-hint { color: var(--text-muted); font-size: 12px; line-height: 1.5; }
.feature-description { margin: 0 0 16px; }
.feature-hint { margin: 12px 0 0; }
.field-list { display: flex; flex-direction: column; gap: 12px; }
.field-row { display: grid; grid-template-columns: minmax(150px, 0.7fr) minmax(0, 1.3fr); gap: 12px; align-items: center; }
.check-row { display: flex; align-items: center; gap: 8px; color: var(--text-secondary); font-size: 12px; font-weight: 600; cursor: pointer; }
@media (max-width: 600px) {
  .field-row { grid-template-columns: 1fr; gap: 6px; }
}
</style>
