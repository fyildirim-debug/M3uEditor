<template>
  <div class="stream-test-control">
    <div class="stream-test-row">
      <button class="btn btn-secondary btn-sm" type="button" :disabled="testing" @click="testStream">
        <span v-if="testing" class="spinner spinner-sm"></span>
        {{ testing ? t('streamTest.testing') : t('streamTest.test') }}
      </button>
      <span v-if="hasUnsavedUrl" class="stream-test-hint">{{ t('streamTest.savedUrlHint') }}</span>
    </div>
    <div v-if="result" class="stream-result" :class="result.reachable ? 'success' : 'error'">
      <strong>{{ result.reachable ? t('streamTest.reachable') : t('streamTest.unreachable') }}</strong>
      <span v-if="result.status">{{ t('streamTest.status', { status: result.status }) }}</span>
      <span v-if="result.contentType">{{ t('streamTest.contentType', { contentType: result.contentType }) }}</span>
      <span v-if="result.error">{{ t('streamTest.error', { error: result.error }) }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import api from '../api'
import { useI18n } from '../langs/useI18n'

const props = defineProps({
  channelId: { type: String, required: true },
  hasUnsavedUrl: { type: Boolean, default: false }
})

const { t } = useI18n()
const testing = ref(false)
const result = ref(null)

watch(() => props.channelId, () => { result.value = null })

async function testStream() {
  testing.value = true
  result.value = null
  try {
    const { data } = await api.post(`/channels/${props.channelId}/test`)
    result.value = data
  } catch (error) {
    result.value = { reachable: false, error: error.response?.data?.error?.message || t('common.error') }
  } finally {
    testing.value = false
  }
}
</script>

<style scoped>
.stream-test-control { margin-top: -2px; margin-bottom: 14px; }
.stream-test-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.stream-test-hint { color: var(--text-muted); font-size: 11px; line-height: 1.4; }
.stream-result {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-top: 8px;
  padding: 9px 10px;
  border: 1px solid;
  border-radius: var(--radius);
  font-size: 11px;
  word-break: break-word;
}
.stream-result.success { color: #6ee7b7; background: var(--success-soft); border-color: rgba(16, 185, 129, 0.25); }
.stream-result.error { color: #fca5a5; background: var(--danger-soft); border-color: rgba(239, 68, 68, 0.25); }
</style>
