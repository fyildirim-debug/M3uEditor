<template>
  <EditorFeatureModal :title="t('addChannel.title')" @close="close">
    <p class="feature-description">{{ t('addChannel.description') }}</p>
    <div class="form-group">
      <label for="add-channel-name">{{ t('addChannel.name') }}</label>
      <input id="add-channel-name" v-model="form.name" class="input" :disabled="isCreated" maxlength="500" autocomplete="off" />
    </div>
    <div class="form-group">
      <label for="add-channel-url">{{ t('addChannel.streamUrl') }}</label>
      <input id="add-channel-url" v-model="form.streamUrl" class="input" type="url" :disabled="isCreated" maxlength="5000" :placeholder="t('addChannel.streamUrlPlaceholder')" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="add-channel-type">{{ t('addChannel.streamType') }}</label>
        <select id="add-channel-type" v-model="form.streamType" class="input" :disabled="isCreated">
          <option value="live">{{ t('xtream.typeLive') }}</option>
          <option value="vod">{{ t('xtream.typeVod') }}</option>
          <option value="series">{{ t('xtream.typeSeries') }}</option>
        </select>
      </div>
      <div class="form-group">
        <label for="add-channel-category">{{ t('common.category') }}</label>
        <select id="add-channel-category" v-model="form.categoryId" class="input" :disabled="isCreated">
          <option :value="null">{{ t('common.uncategorized') }}</option>
          <option v-for="category in availableCategories" :key="category.id" :value="category.id">{{ category.name }}</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label for="add-channel-logo">{{ t('addChannel.logoUrl') }}</label>
      <input id="add-channel-logo" v-model="form.logoUrl" class="input" type="url" :disabled="isCreated" maxlength="5000" :placeholder="t('addChannel.logoUrlPlaceholder')" />
    </div>
    <p v-if="!isCreated" class="feature-hint">{{ t('addChannel.testSavesFirst') }}</p>
    <p v-else class="saved-notice">{{ t('addChannel.savedForTesting') }}</p>
    <div v-if="testResult" class="test-result" :class="testResult.reachable ? 'success' : 'error'">
      <strong>{{ testResult.reachable ? t('streamTest.reachable') : t('streamTest.unreachable') }}</strong>
      <span v-if="testResult.status">{{ t('streamTest.status', { status: testResult.status }) }}</span>
      <span v-if="testResult.contentType">{{ t('streamTest.contentType', { contentType: testResult.contentType }) }}</span>
      <span v-if="testResult.error">{{ t('streamTest.error', { error: testResult.error }) }}</span>
    </div>

    <template #actions>
      <button class="btn btn-secondary" type="button" :disabled="busy" @click="close">
        {{ isCreated ? t('common.close') : t('common.cancel') }}
      </button>
      <button class="btn btn-secondary" type="button" :disabled="!isValid || busy" @click="testConnection">
        <span v-if="testing" class="spinner spinner-sm"></span>
        {{ testing ? t('streamTest.testing') : t('addChannel.testConnection') }}
      </button>
      <button class="btn btn-primary" type="button" :disabled="!isValid || busy" @click="save">
        <span v-if="saving" class="spinner spinner-sm"></span>
        {{ isCreated ? t('common.close') : t('common.save') }}
      </button>
    </template>
  </EditorFeatureModal>
</template>

<script setup>
import { computed, inject, onMounted, reactive, ref } from 'vue'
import api from '../api'
import { useI18n } from '../langs/useI18n'
import EditorFeatureModal from './EditorFeatureModal.vue'

const props = defineProps({
  playlistId: { type: String, required: true },
  categories: { type: Array, default: () => [] },
  initialStreamType: { type: String, default: 'live' }
})
const emit = defineEmits(['close', 'created'])

const toast = inject('toast')
const { t } = useI18n()
const form = reactive({
  name: '',
  streamUrl: '',
  streamType: props.initialStreamType,
  categoryId: null,
  logoUrl: ''
})
const saving = ref(false)
const testing = ref(false)
const createdChannel = ref(null)
const testResult = ref(null)
const availableCategories = ref(props.categories)

const isCreated = computed(() => Boolean(createdChannel.value?.id))
const busy = computed(() => saving.value || testing.value)
const isValid = computed(() => isCreated.value || Boolean(form.name.trim() && form.streamUrl.trim()))

onMounted(async () => {
  try {
    const { data } = await api.get(`/playlists/${props.playlistId}/categories`)
    availableCategories.value = data
  } catch {
    availableCategories.value = props.categories
  }
})

function close() { emit('close') }

async function ensureCreated() {
  if (createdChannel.value) return createdChannel.value
  const { data } = await api.post(`/playlists/${props.playlistId}/channels`, {
    name: form.name.trim(),
    streamUrl: form.streamUrl.trim(),
    streamType: form.streamType,
    categoryId: form.categoryId,
    logoUrl: form.logoUrl.trim() || null
  })
  createdChannel.value = data
  emit('created', data)
  toast(t('toast.channelCreated'), 'success')
  return data
}

async function save() {
  if (isCreated.value) { close(); return }
  saving.value = true
  try {
    await ensureCreated()
    close()
  } catch (error) {
    toast(error.response?.data?.error?.message || t('common.error'), 'error')
  } finally {
    saving.value = false
  }
}

async function testConnection() {
  testing.value = true
  testResult.value = null
  try {
    const channel = await ensureCreated()
    const { data } = await api.post(`/channels/${channel.id}/test`)
    testResult.value = data
  } catch (error) {
    testResult.value = { reachable: false, error: error.response?.data?.error?.message || t('common.error') }
  } finally {
    testing.value = false
  }
}
</script>

<style scoped>
.feature-description, .feature-hint { margin: 0 0 16px; color: var(--text-muted); font-size: 12px; line-height: 1.5; }
.feature-hint { margin-bottom: 0; }
.form-group { margin-bottom: 14px; }
.form-group label { display: block; margin-bottom: 5px; color: var(--text-muted); font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.saved-notice, .test-result {
  margin: 10px 0 0;
  padding: 10px 12px;
  border-radius: var(--radius);
  font-size: 12px;
}
.saved-notice { color: #6ee7b7; background: var(--success-soft); border: 1px solid rgba(16, 185, 129, 0.25); }
.test-result { display: flex; flex-wrap: wrap; gap: 6px 12px; border: 1px solid; word-break: break-word; }
.test-result.success { color: #6ee7b7; background: var(--success-soft); border-color: rgba(16, 185, 129, 0.25); }
.test-result.error { color: #fca5a5; background: var(--danger-soft); border-color: rgba(239, 68, 68, 0.25); }
@media (max-width: 600px) { .form-row { grid-template-columns: 1fr; gap: 0; } }
</style>
