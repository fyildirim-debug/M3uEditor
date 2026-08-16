<template>
  <EditorFeatureModal :title="t('nav.downloadM3u')" wide @close="$emit('close')">
    <!-- M3U bolumu: her zaman gorunur, Xtream baglantisi gerektirmez -->
    <section class="m3u-section">
      <h4 class="section-title">{{ t('xtreamOutput.m3uSection') }}</h4>
      <p class="feature-description">{{ t('xtreamOutput.m3uSectionDesc') }}</p>
      <div v-if="views.length > 0" class="view-select-row">
        <label for="m3u-view-select">{{ t('viewProfiles.selectView') }}</label>
        <select id="m3u-view-select" v-model="selectedViewId" class="input">
          <option value="">{{ t('viewProfiles.noView') }}</option>
          <option v-for="view in views" :key="view.id" :value="view.id">{{ view.name }}</option>
        </select>
      </div>
      <button class="btn btn-primary" type="button" :disabled="downloadingM3u" @click="downloadM3u">
        <span v-if="downloadingM3u" class="spinner spinner-sm"></span>
        {{ downloadingM3u ? t('common.loading') : t('nav.downloadM3u') }}
      </button>
    </section>

    <div v-if="loading" class="state-panel" role="status" aria-live="polite">
      <span class="spinner"></span>
      <span>{{ t('common.loading') }}</span>
    </div>

    <div v-else-if="loadError" class="state-panel state-panel-error" role="alert">
      <p>{{ loadError }}</p>
      <button class="btn btn-secondary btn-sm" type="button" @click="loadOutput">
        {{ t('xtreamOutput.retry') }}
      </button>
    </div>

    <template v-else-if="!output.enabled">
      <h4 class="section-title">{{ t('xtreamOutput.xtreamSection') }}</h4>
      <p class="feature-description">{{ t('xtreamOutput.disabledDescription') }}</p>
      <div class="empty-state">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="m8 12 2.5 2.5L16 9" />
        </svg>
        <button class="btn btn-primary" type="button" :disabled="isBusy" @click="enableOutput">
          <span v-if="action === 'enable'" class="spinner spinner-sm"></span>
          {{ action === 'enable' ? t('xtreamOutput.enabling') : t('xtreamOutput.enable') }}
        </button>
      </div>
    </template>

    <template v-else>
      <h4 class="section-title">{{ t('xtreamOutput.xtreamSection') }}</h4>
      <div class="status-row">
        <span class="status-dot" aria-hidden="true"></span>
        <span>{{ t('xtreamOutput.active') }}</span>
      </div>
      <p class="feature-description">{{ t('xtreamOutput.credentialsDescription') }}</p>

      <div class="credential-list">
        <div class="credential-group">
          <label for="xtream-output-server">{{ t('xtreamOutput.serverUrl') }}</label>
          <div class="credential-row">
            <input id="xtream-output-server" class="input" :value="output.serverUrl" readonly @click="$event.currentTarget.select()" />
            <button class="btn btn-secondary btn-sm" type="button" :disabled="!output.serverUrl" @click="copyValue(output.serverUrl)">
              {{ t('common.copy') }}
            </button>
          </div>
        </div>

        <div class="credential-group">
          <label for="xtream-output-username">{{ t('xtreamOutput.username') }}</label>
          <div class="credential-row">
            <input id="xtream-output-username" class="input" :value="output.username || ''" readonly @click="$event.currentTarget.select()" />
            <button class="btn btn-secondary btn-sm" type="button" :disabled="!output.username" @click="copyValue(output.username)">
              {{ t('common.copy') }}
            </button>
          </div>
        </div>

        <div class="credential-group">
          <label v-if="password" for="xtream-output-password">{{ t('xtreamOutput.password') }}</label>
          <span v-else class="credential-label">{{ t('xtreamOutput.password') }}</span>
          <template v-if="password">
            <div class="credential-row">
              <input id="xtream-output-password" class="input" :value="password" readonly autocomplete="off" @click="$event.currentTarget.select()" />
              <button class="btn btn-secondary btn-sm" type="button" @click="copyValue(password)">
                {{ t('common.copy') }}
              </button>
            </div>
            <button class="btn btn-ghost btn-sm regenerate-button" type="button" :disabled="isBusy" @click="confirmation = 'regenerate'">
              {{ t('xtreamOutput.regenerate') }}
            </button>
          </template>
          <div v-else class="password-unavailable">
            <p>{{ t('xtreamOutput.passwordUnavailable') }}</p>
            <button class="btn btn-secondary btn-sm" type="button" :disabled="isBusy" @click="confirmation = 'regenerate'">
              {{ t('xtreamOutput.regenerate') }}
            </button>
          </div>
        </div>
      </div>

      <div class="alternative-section">
        <h4>{{ t('xtreamOutput.alternativeUrls') }}</h4>
        <div class="credential-group">
          <label for="xtream-output-m3u">{{ t('xtreamOutput.m3uUrl') }}</label>
          <div class="credential-row">
            <input id="xtream-output-m3u" class="input" :value="output.m3uUrl" readonly @click="$event.currentTarget.select()" />
            <button class="btn btn-secondary btn-sm" type="button" :disabled="!output.m3uUrl" @click="copyValue(output.m3uUrl)">
              {{ t('common.copy') }}
            </button>
          </div>
        </div>
        <div class="credential-group">
          <label for="xtream-output-xmltv">{{ t('xtreamOutput.xmltvUrl') }}</label>
          <div class="credential-row">
            <input id="xtream-output-xmltv" class="input" :value="output.xmltvUrl" readonly @click="$event.currentTarget.select()" />
            <button class="btn btn-secondary btn-sm" type="button" :disabled="!output.xmltvUrl" @click="copyValue(output.xmltvUrl)">
              {{ t('common.copy') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="manualCopyValue" class="manual-copy" role="alert">
        <strong>{{ t('xtreamOutput.manualCopyTitle') }}</strong>
        <p>{{ t('xtreamOutput.manualCopyInstruction') }}</p>
        <textarea ref="manualCopyInput" :value="manualCopyValue" class="input" rows="3" readonly @focus="$event.currentTarget.select()"></textarea>
      </div>

      <div v-if="confirmation === 'regenerate'" class="confirmation-panel" role="alert">
        <strong>{{ t('xtreamOutput.regenerateTitle') }}</strong>
        <p>{{ t('xtreamOutput.regenerateWarning') }}</p>
        <div class="confirmation-actions">
          <button class="btn btn-secondary btn-sm" type="button" :disabled="isBusy" @click="confirmation = ''">{{ t('common.cancel') }}</button>
          <button class="btn btn-danger btn-sm" type="button" :disabled="isBusy" @click="regeneratePassword">
            <span v-if="action === 'regenerate'" class="spinner spinner-sm"></span>
            {{ action === 'regenerate' ? t('xtreamOutput.regenerating') : t('xtreamOutput.confirmRegenerate') }}
          </button>
        </div>
      </div>

      <div v-if="confirmation === 'disable'" class="confirmation-panel" role="alert">
        <strong>{{ t('xtreamOutput.disableTitle') }}</strong>
        <p>{{ t('xtreamOutput.disableWarning') }}</p>
        <div class="confirmation-actions">
          <button class="btn btn-secondary btn-sm" type="button" :disabled="isBusy" @click="confirmation = ''">{{ t('common.cancel') }}</button>
          <button class="btn btn-danger btn-sm" type="button" :disabled="isBusy" @click="disableOutput">
            <span v-if="action === 'disable'" class="spinner spinner-sm"></span>
            {{ action === 'disable' ? t('xtreamOutput.disabling') : t('xtreamOutput.confirmDisable') }}
          </button>
        </div>
      </div>

      <section class="help-section" :aria-label="t('xtreamOutput.setupTitle')">
        <h4>{{ t('xtreamOutput.setupTitle') }}</h4>
        <ol>
          <li>{{ t('xtreamOutput.setupStep1') }}</li>
          <li>{{ t('xtreamOutput.setupStep2') }}</li>
          <li>{{ t('xtreamOutput.setupStep3') }}</li>
        </ol>
      </section>

      <div class="security-warning" role="note">
        <strong>{{ t('xtreamOutput.securityTitle') }}</strong>
        <p>{{ t('xtreamOutput.securityWarning') }}</p>
      </div>
    </template>

    <template #actions>
      <button v-if="output.enabled && !loadError" class="btn btn-danger" type="button" :disabled="isBusy" @click="confirmation = 'disable'">
        {{ t('xtreamOutput.disable') }}
      </button>
      <button class="btn btn-secondary" type="button" :disabled="isBusy" @click="$emit('close')">{{ t('common.close') }}</button>
    </template>
  </EditorFeatureModal>
</template>

<script setup>
import { computed, inject, nextTick, onMounted, ref } from 'vue'
import api from '../api'
import { useI18n } from '../langs/useI18n'
import EditorFeatureModal from './EditorFeatureModal.vue'

const props = defineProps({
  playlistId: { type: String, required: true },
  hiddenCount: { type: Number, default: 0 }
})
defineEmits(['close'])

const toast = inject('toast')
const { t } = useI18n()

const output = ref(createEmptyOutput())
const password = ref('')
const loading = ref(true)
const loadError = ref('')
const action = ref('')
const confirmation = ref('')
const manualCopyValue = ref('')
const manualCopyInput = ref(null)
const downloadingM3u = ref(false)
// Gorunum sablonlari: indirirken opsiyonel gorunum secimi
const views = ref([])
const selectedViewId = ref('')
const isBusy = computed(() => Boolean(action.value))

async function loadViews() {
  try {
    const { data } = await api.get(`/playlists/${props.playlistId}/views`)
    views.value = data
  } catch {
    // Gorunumler yuklenemezse indirme gorunumsuz calismaya devam eder.
    views.value = []
  }
}

async function downloadM3u() {
  if (downloadingM3u.value) return
  downloadingM3u.value = true
  try {
    const { data } = await api.get(`/playlists/${props.playlistId}/export`, {
      responseType: 'blob',
      params: selectedViewId.value ? { viewId: selectedViewId.value } : {}
    })
    const url = URL.createObjectURL(new Blob([data]))
    const a = document.createElement('a')
    a.href = url
    a.download = 'playlist.m3u'
    a.click()
    URL.revokeObjectURL(url)
    toast(props.hiddenCount > 0 ? t('toast.m3uDownloadedExcluded') : t('toast.m3uDownloaded'), 'success')
  } catch (error) {
    toast(error.response?.data?.error?.message || t('toast.downloadError'), 'error')
  } finally {
    downloadingM3u.value = false
  }
}

function createEmptyOutput() {
  return {
    enabled: false,
    username: null,
    serverUrl: '',
    playerApiUrl: '',
    xmltvUrl: '',
    m3uUrl: '',
    createdAt: null
  }
}

function applyOutput(data) {
  output.value = { ...createEmptyOutput(), ...(data || {}), enabled: Boolean(data?.enabled) }
  password.value = data?.password || ''
}

function getErrorMessage(error, fallbackKey) {
  if (error.response?.status === 404) return t('xtreamOutput.notFound')
  return error.response?.data?.error?.message || t(fallbackKey)
}

async function loadOutput() {
  loading.value = true
  loadError.value = ''
  password.value = ''
  manualCopyValue.value = ''
  try {
    const { data } = await api.get(`/playlists/${props.playlistId}/xtream-output`)
    applyOutput(data)
  } catch (error) {
    loadError.value = getErrorMessage(error, 'xtreamOutput.loadError')
    toast(loadError.value, 'error')
  } finally {
    loading.value = false
  }
}

async function enableOutput() {
  action.value = 'enable'
  try {
    const { data } = await api.post(`/playlists/${props.playlistId}/xtream-output`)
    applyOutput(data)
    toast(t('xtreamOutput.enabledSuccess'), 'success')
  } catch (error) {
    toast(getErrorMessage(error, 'xtreamOutput.enableError'), 'error')
  } finally {
    action.value = ''
  }
}

async function regeneratePassword() {
  action.value = 'regenerate'
  try {
    const { data } = await api.post(`/playlists/${props.playlistId}/xtream-output/regenerate`)
    applyOutput(data)
    confirmation.value = ''
    toast(t('xtreamOutput.regeneratedSuccess'), 'success')
  } catch (error) {
    toast(getErrorMessage(error, 'xtreamOutput.regenerateError'), 'error')
  } finally {
    action.value = ''
  }
}

async function disableOutput() {
  action.value = 'disable'
  try {
    const { data } = await api.delete(`/playlists/${props.playlistId}/xtream-output`)
    applyOutput(data)
    confirmation.value = ''
    toast(t('xtreamOutput.disabledSuccess'), 'success')
  } catch (error) {
    toast(getErrorMessage(error, 'xtreamOutput.disableError'), 'error')
  } finally {
    action.value = ''
  }
}

async function copyValue(value) {
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    manualCopyValue.value = ''
    toast(t('toast.copied'), 'success')
  } catch {
    manualCopyValue.value = value
    toast(t('xtreamOutput.copyFailed'), 'error')
    await nextTick()
    manualCopyInput.value?.focus()
    manualCopyInput.value?.select()
  }
}

onMounted(() => { loadOutput(); loadViews() })
</script>

<style scoped>
.feature-description { margin: 0 0 16px; color: var(--text-muted); font-size: 12px; line-height: 1.5; }
.section-title { margin: 0 0 8px; font-size: 13px; font-weight: 600; }
.m3u-section { margin-bottom: 20px; padding-bottom: 18px; border-bottom: 1px solid var(--border); }
.m3u-section .feature-description { margin-bottom: 10px; }
.view-select-row { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; max-width: 320px; }
.view-select-row label { color: var(--text-muted); font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
.state-panel, .empty-state { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 140px; color: var(--text-muted); font-size: 13px; }
.state-panel-error { flex-direction: column; padding: 18px; color: var(--danger); text-align: center; }
.state-panel-error p { margin: 0; }
.empty-state { flex-direction: column; }
.empty-state svg { color: var(--accent); }
.status-row { display: flex; align-items: center; gap: 7px; margin-bottom: 8px; color: var(--success); font-size: 12px; font-weight: 600; }
.status-dot { width: 8px; height: 8px; background: var(--success); border-radius: 50%; box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 18%, transparent); }
.credential-list, .alternative-section { display: flex; flex-direction: column; gap: 14px; }
.credential-group label, .credential-label { display: block; margin-bottom: 5px; color: var(--text-muted); font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
.credential-row { display: flex; gap: 8px; }
.credential-row .input { min-width: 0; }
.field-hint { display: block; margin-top: 5px; color: var(--text-muted); font-size: 12px; line-height: 1.5; }
.field-hint-important { color: var(--warning); }
.regenerate-button { margin-top: 5px; }
.password-unavailable { padding: 12px; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: var(--radius-md); }
.password-unavailable p { margin: 0 0 10px; color: var(--text-muted); font-size: 12px; line-height: 1.5; }
.alternative-section, .help-section, .security-warning { margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--border); }
.alternative-section h4, .help-section h4 { margin: 0 0 12px; font-size: 13px; }
.manual-copy, .confirmation-panel, .security-warning { margin-top: 16px; padding: 14px; border: 1px solid var(--border); border-radius: var(--radius-md); }
.manual-copy { border-color: var(--warning); background: color-mix(in srgb, var(--warning) 8%, transparent); }
.manual-copy p, .confirmation-panel p, .security-warning p { margin: 5px 0 10px; color: var(--text-muted); font-size: 12px; line-height: 1.5; }
.manual-copy textarea { resize: vertical; }
.confirmation-panel { border-color: var(--danger); background: color-mix(in srgb, var(--danger) 8%, transparent); }
.confirmation-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.help-section ol { margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 12px; line-height: 1.8; }
.security-warning { border-color: var(--warning); background: color-mix(in srgb, var(--warning) 8%, transparent); }
.security-warning strong { color: var(--warning); }
.security-warning p { margin-bottom: 0; }
@media (max-width: 520px) {
  .credential-row { align-items: stretch; flex-direction: column; }
}
</style>
