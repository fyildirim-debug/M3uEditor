<template>
  <div class="ai-settings-form">
    <p class="ai-hint">{{ t('ai.settingsHint') }}</p>

    <div class="form-group">
      <label class="form-label" :for="id('base-url')">{{ t('ai.baseUrl') }}</label>
      <input :id="id('base-url')" v-model="form.baseUrl" class="input" placeholder="https://api.openai.com/v1" autocomplete="off" spellcheck="false" />
    </div>

    <div class="form-group">
      <label class="form-label" :for="id('api-key')">{{ t('ai.apiKey') }}</label>
      <input :id="id('api-key')" v-model="form.apiKey" class="input" type="password" :placeholder="settings.hasApiKey ? t('ai.apiKeySaved') : 'sk-…'" autocomplete="off" />
    </div>

    <div class="form-group">
      <label class="form-label" :for="id('model')">{{ t('ai.model') }}</label>
      <div class="ai-model-row">
        <select v-if="models.length" :id="id('model')" v-model="form.model" class="input">
          <option v-for="model in models" :key="model" :value="model">{{ model }}</option>
        </select>
        <input v-else :id="id('model')" v-model="form.model" class="input" :placeholder="t('ai.modelPlaceholder')" autocomplete="off" />
        <button class="btn btn-secondary btn-sm" type="button" :disabled="loadingModels" @click="fetchModels">
          <span v-if="loadingModels" class="spinner spinner-sm"></span>
          {{ t('ai.fetchModels') }}
        </button>
      </div>
    </div>

    <div class="ai-settings-grid">
      <div class="form-group">
        <label class="form-label" :for="id('temperature')">{{ t('ai.temperature') }}</label>
        <input :id="id('temperature')" v-model.number="form.temperature" class="input" type="number" min="0" max="2" step="0.1" />
      </div>
      <div class="form-group">
        <label class="form-label" :for="id('max-steps')">{{ t('ai.maxSteps') }}</label>
        <input :id="id('max-steps')" v-model.number="form.maxSteps" class="input" type="number" min="1" max="25" />
      </div>
    </div>

    <label class="ai-check">
      <input v-model="form.allowDestructive" type="checkbox" />
      <span>{{ t('ai.allowDestructive') }}</span>
    </label>

    <label class="ai-check" :class="{ 'ai-check-disabled': !form.allowDestructive }">
      <input v-model="form.requireApproval" type="checkbox" :disabled="!form.allowDestructive" />
      <span>{{ t('ai.requireApproval') }}</span>
    </label>
    <p class="ai-hint ai-hint-tight">{{ t('ai.requireApprovalHint') }}</p>

    <div class="form-group">
      <label class="form-label" :for="id('system-prompt')">{{ t('ai.systemPrompt') }}</label>
      <textarea :id="id('system-prompt')" v-model="form.systemPrompt" class="input ai-textarea" rows="3" :placeholder="t('ai.systemPromptPlaceholder')"></textarea>
    </div>

    <div class="ai-settings-actions">
      <button v-if="showCancel" class="btn btn-secondary btn-sm" type="button" @click="$emit('cancel')">{{ t('common.cancel') }}</button>
      <button class="btn btn-primary btn-sm" type="button" :disabled="saving" @click="save">
        <span v-if="saving" class="spinner spinner-sm"></span>
        {{ t('common.save') }}
      </button>
    </div>

    <button class="ai-capabilities-toggle" type="button" @click="toggleCapabilities">
      {{ t('ai.capabilities', { count: capabilities.length || '…' }) }}
    </button>
    <template v-if="showCapabilities">
      <p class="ai-hint">{{ t('ai.capabilitiesNote', { sent: sentPerRequest, total: capabilities.length }) }}</p>
      <ul class="ai-capabilities">
        <li v-for="capability in capabilities" :key="capability.name">
          <code>{{ capability.name }}<span v-if="capability.destructive" class="ai-cap-danger">•</span></code>
          <span>{{ capability.description }}</span>
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup>
import { reactive, ref, inject, onMounted } from 'vue'
import api from '../api'
import { useI18n } from '../langs/useI18n'

const props = defineProps({
  showCancel: { type: Boolean, default: false },
  // Ayni sayfada iki kopya bulunabilecegi icin (panel + hesap sayfasi)
  // etiket/alan kimlikleri onekle ayrilir.
  idPrefix: { type: String, default: 'ai' },
})
const emit = defineEmits(['saved', 'cancel'])

const { t } = useI18n()
const toast = inject('toast', () => {})

const settings = reactive({ configured: false, hasApiKey: false, model: null })
const form = reactive({ baseUrl: '', apiKey: '', model: '', temperature: 0.2, maxSteps: 12, allowDestructive: true, requireApproval: false, systemPrompt: '' })
const models = ref([])
const capabilities = ref([])
const sentPerRequest = ref(0)
const saving = ref(false)
const loadingModels = ref(false)
const showCapabilities = ref(false)

function id(name) {
  return `${props.idPrefix}-${name}`
}

async function load() {
  try {
    const { data } = await api.get('/ai/settings')
    Object.assign(settings, data)
    form.baseUrl = data.baseUrl || 'https://api.openai.com/v1'
    form.model = data.model || ''
    form.temperature = data.temperature ?? 0.2
    form.maxSteps = data.maxSteps ?? 12
    form.allowDestructive = data.allowDestructive !== false
    form.requireApproval = data.requireApproval === true
    form.systemPrompt = data.systemPrompt || ''
  } catch { /* oturum yoksa sessizce gec */ }
}

async function fetchModels() {
  loadingModels.value = true
  try {
    const { data } = await api.post('/ai/models', { baseUrl: form.baseUrl, apiKey: form.apiKey || undefined })
    models.value = data.models || []
    if (!models.value.length) toast(t('ai.noModels'), 'info')
    else if (!form.model || !models.value.includes(form.model)) form.model = models.value[0]
  } catch (error) {
    toast(error.response?.data?.error?.message || t('ai.modelsFailed'), 'error')
  } finally {
    loadingModels.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const payload = {
      baseUrl: form.baseUrl,
      model: form.model,
      temperature: form.temperature,
      maxSteps: form.maxSteps,
      allowDestructive: form.allowDestructive,
      requireApproval: form.allowDestructive && form.requireApproval,
      systemPrompt: form.systemPrompt,
    }
    // Anahtar alani bossa kayitli anahtar korunur.
    if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim()
    const { data } = await api.put('/ai/settings', payload)
    Object.assign(settings, data)
    form.apiKey = ''
    toast(t('ai.settingsSaved'), 'success')
    // Panel ve baslik rozeti ayni ayari paylasir; her kayitta senkronlanir.
    window.dispatchEvent(new CustomEvent('ai:settings-changed', { detail: data }))
    emit('saved', data)
  } catch (error) {
    toast(error.response?.data?.error?.message || t('ai.settingsFailed'), 'error')
  } finally {
    saving.value = false
  }
}

async function toggleCapabilities() {
  showCapabilities.value = !showCapabilities.value
  if (showCapabilities.value && !capabilities.value.length) {
    try {
      const { data } = await api.get('/ai/capabilities')
      capabilities.value = data.tools || []
      sentPerRequest.value = data.sentPerRequest || 0
    } catch { /* yetenek listesi kritik degil */ }
  }
}

onMounted(load)
defineExpose({ load })
</script>

<style scoped>
.ai-settings-form { display: flex; flex-direction: column; gap: 12px; }
.ai-hint { font-size: 12px; color: var(--text-secondary); line-height: 1.55; margin: 0; }
.form-group { display: flex; flex-direction: column; gap: 5px; }
.form-label { font-size: 12px; color: var(--text-secondary); }
.ai-settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.ai-model-row { display: flex; gap: 6px; align-items: center; }
.ai-model-row .input { flex: 1; min-width: 0; }
.ai-textarea { resize: vertical; font-family: inherit; }
.ai-check { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-secondary); cursor: pointer; }
.ai-check-disabled { opacity: 0.5; cursor: not-allowed; }
.ai-hint-tight { margin-top: -6px; }
.ai-settings-actions { display: flex; justify-content: flex-end; gap: 8px; }
.ai-capabilities-toggle {
  background: none; border: none; cursor: pointer; padding: 0;
  color: var(--accent-hover); font-size: 12px; text-align: left;
}
.ai-capabilities { list-style: none; display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; max-height: 260px; overflow-y: auto; }
.ai-capabilities li { display: flex; flex-direction: column; gap: 2px; font-size: 11.5px; color: var(--text-secondary); }
.ai-capabilities code { color: var(--text-primary); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.ai-cap-danger { color: var(--warning); margin-left: 4px; }
</style>
