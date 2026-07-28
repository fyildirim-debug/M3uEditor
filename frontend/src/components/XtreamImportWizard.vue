<template>
  <EditorFeatureModal :title="t('xtream.importTitle')" :close-disabled="previewing || importing" wide @close="requestClose">
    <div class="wizard" :aria-busy="previewing || importing">
      <div class="step-header">
        <span class="step-count">{{ t('xtreamWizard.stepIndicator', { current: currentStep, total: TOTAL_STEPS }) }}</span>
        <ol class="step-dots" :aria-label="t('xtreamWizard.stepProgressLabel')">
          <li
            v-for="step in TOTAL_STEPS"
            :key="step"
            :class="{ active: step === currentStep, complete: step < currentStep }"
            :aria-current="step === currentStep ? 'step' : undefined"
          >
            <span class="step-dot">{{ step }}</span>
            <span class="sr-only">{{ stepTitle(step) }}</span>
          </li>
        </ol>
      </div>

      <h4 ref="stepHeading" class="step-title" tabindex="-1">{{ stepTitle(currentStep) }}</h4>

      <form
        v-if="currentStep === 1"
        id="xtream-credentials-form"
        class="credentials-form"
        @submit.prevent="loadPreview"
      >
        <p class="step-description">{{ t('xtreamWizard.credentialsDescription') }}</p>
        <div class="form-group">
          <label for="xtream-wizard-server">{{ t('xtream.serverUrl') }}</label>
          <input
            id="xtream-wizard-server"
            v-model="form.serverUrl"
            class="input"
            type="url"
            required
            autocomplete="url"
            :placeholder="t('xtream.serverPlaceholder')"
            autofocus
          />
        </div>
        <div class="form-group">
          <label for="xtream-wizard-username">{{ t('xtream.username') }}</label>
          <input
            id="xtream-wizard-username"
            v-model="form.username"
            class="input"
            required
            autocomplete="username"
          />
        </div>
        <div class="form-group">
          <label for="xtream-wizard-password">{{ t('xtream.password') }}</label>
          <input
            id="xtream-wizard-password"
            v-model="form.password"
            class="input"
            type="password"
            required
            autocomplete="new-password"
          />
        </div>

        <div v-if="previewError" class="result-box error" role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <span>{{ previewError }}</span>
        </div>
      </form>

      <div v-else class="type-step">
        <div class="type-toggle-row">
          <div>
            <label class="toggle-label" :for="`xtream-type-${currentType}`">
              {{ t('xtreamWizard.includeType', { type: currentTypeLabel }) }}
            </label>
            <p class="toggle-description">{{ t('xtreamWizard.typeToggleDescription') }}</p>
          </div>
          <div class="toggle-control">
            <span :class="['toggle-state', { enabled: currentTypeState.enabled }]">
              {{ currentTypeState.enabled ? t('xtreamWizard.enabled') : t('xtreamWizard.disabled') }}
            </span>
            <input
              :id="`xtream-type-${currentType}`"
              v-model="currentTypeState.enabled"
              class="switch-input"
              type="checkbox"
              role="switch"
              :disabled="!currentTypeState.available"
              :aria-describedby="!currentTypeState.available ? `xtream-type-error-${currentType}` : undefined"
            />
          </div>
        </div>

        <div
          v-if="!currentTypeState.available"
          :id="`xtream-type-error-${currentType}`"
          class="result-box error"
          role="alert"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>{{ currentTypeState.error || t('xtreamWizard.typeUnavailable', { type: currentTypeLabel }) }}</span>
        </div>

        <fieldset class="category-fieldset" :class="{ dimmed: !currentTypeState.enabled }" :disabled="!currentTypeState.enabled">
          <legend class="sr-only">{{ t('xtreamWizard.categorySelectionLabel', { type: currentTypeLabel }) }}</legend>

          <div class="search-group">
            <label :for="`xtream-category-search-${currentType}`">
              {{ t('xtreamWizard.searchLabel', { type: currentTypeLabel }) }}
            </label>
            <input
              :id="`xtream-category-search-${currentType}`"
              v-model="searches[currentType]"
              class="input"
              type="search"
              autocomplete="off"
              :placeholder="t('xtreamWizard.searchPlaceholder')"
            />
          </div>

          <div class="category-toolbar">
            <div class="category-actions">
              <button class="btn btn-secondary btn-sm" type="button" :disabled="filteredCategories.length === 0" @click="selectVisible">
                {{ t('xtreamWizard.selectAll') }}
              </button>
              <button class="btn btn-ghost btn-sm" type="button" :disabled="currentTypeState.selected.size === 0" @click="deselectAll">
                {{ t('xtreamWizard.deselectAll') }}
              </button>
            </div>
            <span class="selected-counter" aria-live="polite">
              {{ t('xtreamWizard.selectedCounter', { selected: currentTypeState.selected.size, total: currentTypeState.categories.length }) }}
            </span>
          </div>

          <p v-if="activeSearch" class="filter-hint">
            {{ t('xtreamWizard.filteredSelectHint', { count: filteredCategories.length }) }}
          </p>

          <div class="category-list" tabindex="0">
            <ul v-if="filteredCategories.length">
              <li
                v-for="category in filteredCategories"
                :key="category.id"
                v-memo="[category.id, category.name, currentTypeState.selected.has(category.id), currentTypeState.enabled]"
                class="category-row"
              >
                <input
                  :id="categoryInputId(category.id)"
                  type="checkbox"
                  :checked="currentTypeState.selected.has(category.id)"
                  @change="setCategorySelected(category.id, $event.target.checked)"
                />
                <label :for="categoryInputId(category.id)">{{ category.name || t('xtreamWizard.unnamedCategory', { id: category.id }) }}</label>
              </li>
            </ul>
            <p v-else class="empty-categories">{{ activeSearch ? t('common.noResults') : t('xtreamWizard.noCategories') }}</p>
          </div>
        </fieldset>

        <section v-if="currentStep === TOTAL_STEPS" class="summary" :aria-label="t('xtreamWizard.summaryTitle')">
          <h5>{{ t('xtreamWizard.summaryTitle') }}</h5>
          <ul>
            <li v-for="type in TYPE_ORDER" :key="type">
              <span>{{ typeLabel(type) }}</span>
              <span>
                <strong :class="{ 'summary-enabled': typeState[type].enabled }">
                  {{ typeState[type].enabled ? t('xtreamWizard.enabled') : t('xtreamWizard.disabled') }}
                </strong>
                · {{ t('xtreamWizard.summaryCount', { selected: typeState[type].selected.size, total: typeState[type].categories.length }) }}
              </span>
            </li>
          </ul>
          <p v-if="!canImport" class="selection-warning" role="alert">{{ importValidationMessage }}</p>
        </section>

        <div v-if="importing" class="import-progress" role="status" aria-live="polite">
          <div class="progress-stage">
            <span class="spinner spinner-sm" aria-hidden="true"></span>
            <span>{{ t(importStageKey) }}</span>
            <span class="progress-percent">{{ Math.round(importProgress) }}%</span>
          </div>
          <div class="progress-track"><div class="progress-fill" :style="{ width: `${importProgress}%` }"></div></div>
          <p>{{ t('xtream.progressHint') }}</p>
        </div>

        <div v-if="importResult" class="result-box success" role="status" aria-live="polite">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span>{{ importResultMessage }}</span>
        </div>

        <div v-if="importError" class="result-box error" role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <span>{{ importError }}</span>
        </div>
      </div>
    </div>

    <template #actions>
      <button class="btn btn-secondary" type="button" :disabled="previewing || importing" @click="requestClose">
        {{ t('common.close') }}
      </button>
      <button v-if="currentStep > 1 && !importResult" class="btn btn-secondary" type="button" :disabled="importing" @click="goBack">
        {{ t('common.previous') }}
      </button>
      <button
        v-if="currentStep === 1"
        class="btn btn-primary"
        type="submit"
        form="xtream-credentials-form"
        :disabled="previewing || !credentialsValid"
      >
        <span v-if="previewing" class="spinner spinner-sm" aria-hidden="true"></span>
        {{ previewing ? t('xtreamWizard.loadingCategories') : t('xtreamWizard.continue') }}
      </button>
      <button v-else-if="currentStep < TOTAL_STEPS" class="btn btn-primary" type="button" @click="goForward">
        {{ t('common.next') }}
      </button>
      <button
        v-else-if="!importResult"
        class="btn btn-primary"
        type="button"
        :disabled="importing || !canImport"
        @click="runImport"
      >
        <span v-if="importing" class="spinner spinner-sm" aria-hidden="true"></span>
        {{ importing ? t('common.importing') : t('common.import') }}
      </button>
    </template>
  </EditorFeatureModal>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref } from 'vue'
import api from '../api'
import { useI18n } from '../langs/useI18n'
import EditorFeatureModal from './EditorFeatureModal.vue'

const props = defineProps({
  playlistId: { type: [String, Number], default: null }
})

const emit = defineEmits(['close', 'imported'])
const { t } = useI18n()

const TOTAL_STEPS = 4
const TYPE_ORDER = ['live', 'series', 'vod']
const form = reactive({ serverUrl: '', username: '', password: '' })
const currentStep = ref(1)
const stepHeading = ref(null)
const preview = ref(null)
const previewing = ref(false)
const previewError = ref('')
const importing = ref(false)
const importResult = ref(null)
const importError = ref('')
const importProgress = ref(0)
const importStageKey = ref('xtream.stageConnecting')
const searches = reactive({ live: '', series: '', vod: '' })
const typeState = reactive({
  live: createTypeState(),
  series: createTypeState(),
  vod: createTypeState()
})
let importProgressTimer = null

function createTypeState() {
  return { available: false, enabled: false, categories: [], selected: new Set(), error: '' }
}

const credentialsValid = computed(() => Boolean(
  form.serverUrl.trim() && form.username.trim() && form.password
))

const currentType = computed(() => TYPE_ORDER[currentStep.value - 2] || 'live')
const currentTypeState = computed(() => typeState[currentType.value])
const currentTypeLabel = computed(() => typeLabel(currentType.value))
const activeSearch = computed(() => searches[currentType.value].trim())
const filteredCategories = computed(() => {
  const categories = currentTypeState.value.categories
  const query = activeSearch.value.toLocaleLowerCase()
  if (!query) return categories
  return categories.filter(category => category.searchName.includes(query))
})

const enabledTypes = computed(() => TYPE_ORDER.filter(type => typeState[type].enabled))
const enabledTypesHaveSelections = computed(() => enabledTypes.value.every((type) => {
  const state = typeState[type]
  return state.categories.length === 0 || state.selected.size > 0
}))
const canImport = computed(() => enabledTypes.value.length > 0 && enabledTypesHaveSelections.value)
const importValidationMessage = computed(() => (
  enabledTypes.value.length === 0
    ? t('xtreamWizard.enableOneType')
    : t('xtreamWizard.selectOneCategory')
))
const importResultMessage = computed(() => {
  const result = importResult.value
  if (!result) return ''
  return t('toast.importSuccess', {
    channels: result.totalChannels ?? 0,
    categories: result.totalCategories ?? 0,
    duration: ((Number(result.duration) || 0) / 1000).toFixed(1)
  })
})

function typeLabel(type) {
  return t({ live: 'xtream.typeLive', series: 'xtream.typeSeries', vod: 'xtream.typeVod' }[type])
}

function stepTitle(step) {
  return t([
    'xtreamWizard.credentialsTitle',
    'xtreamWizard.liveTitle',
    'xtreamWizard.seriesTitle',
    'xtreamWizard.moviesTitle'
  ][step - 1])
}

function categoryInputId(categoryId) {
  return `xtream-category-${currentType.value}-${categoryId}`
}

function focusStepHeading() {
  nextTick(() => stepHeading.value?.focus())
}

function requestClose() {
  if (!previewing.value && !importing.value) emit('close')
}

function normalizeCategories(rawCategories) {
  if (!Array.isArray(rawCategories)) return []
  return rawCategories.map((category) => {
    const name = String(category.name ?? '')
    return {
      id: String(category.id),
      name,
      searchName: name.toLocaleLowerCase()
    }
  })
}

function applyPreview(data) {
  const hadPreview = Boolean(preview.value)
  for (const type of TYPE_ORDER) {
    const state = typeState[type]
    const providerType = data?.types?.[type] || {}
    const categories = normalizeCategories(providerType.categories)
    const wasAvailable = state.available
    const hadEveryCategorySelected = state.categories.length > 0 && state.selected.size === state.categories.length
    const previousSelection = new Set(state.selected)

    state.available = providerType.available === true
    state.enabled = state.available && (!hadPreview || !wasAvailable ? true : state.enabled)
    state.categories = categories
    state.error = providerType.error ? String(providerType.error) : ''

    if (!hadPreview || hadEveryCategorySelected) {
      state.selected = new Set(categories.map(category => category.id))
    } else {
      state.selected = new Set(categories.filter(category => previousSelection.has(category.id)).map(category => category.id))
    }
  }
  preview.value = data
}

function errorCode(error) {
  return error.response?.data?.error?.code || error.response?.data?.code || ''
}

function requestErrorMessage(error, phase) {
  const code = errorCode(error)
  const codeMessages = {
    XTREAM_AUTH_FAILED: 'xtreamWizard.authFailed',
    VALIDATION_ERROR: 'xtreamWizard.validationError',
    IMPORT_IN_PROGRESS: 'xtreamWizard.importInProgress',
    IMPORT_CAPACITY_REACHED: 'xtreamWizard.capacityReached'
  }
  if (codeMessages[code]) return t(codeMessages[code])
  if (phase === 'preview' && error.response?.status === 404) return t('xtreamWizard.previewUnavailable')
  if (phase === 'preview' && !error.response) return t('xtreamWizard.previewNetworkError')
  if (error.response?.status === 409) return t('xtreamWizard.importInProgress')
  if (error.response?.status === 503) return t('xtreamWizard.capacityReached')
  return t(phase === 'preview' ? 'xtreamWizard.previewError' : 'xtreamWizard.importError')
}

async function loadPreview() {
  if (!credentialsValid.value || previewing.value) return
  previewing.value = true
  previewError.value = ''
  try {
    const { data } = await api.post('/import/xtream/preview', {
      serverUrl: form.serverUrl.trim(),
      username: form.username.trim(),
      password: form.password
    })
    applyPreview(data)
    currentStep.value = 2
    focusStepHeading()
  } catch (error) {
    previewError.value = requestErrorMessage(error, 'preview')
  } finally {
    previewing.value = false
  }
}

function goBack() {
  if (currentStep.value <= 1) return
  currentStep.value--
  importError.value = ''
  focusStepHeading()
}

function goForward() {
  if (currentStep.value >= TOTAL_STEPS) return
  currentStep.value++
  importError.value = ''
  focusStepHeading()
}

function selectVisible() {
  for (const category of filteredCategories.value) currentTypeState.value.selected.add(category.id)
}

function deselectAll() {
  currentTypeState.value.selected.clear()
}

function setCategorySelected(categoryId, checked) {
  if (checked) currentTypeState.value.selected.add(categoryId)
  else currentTypeState.value.selected.delete(categoryId)
}

function buildImportStages(types) {
  const stages = [
    { pct: 8, key: 'xtream.stageConnecting' },
    { pct: 15, key: 'xtream.stageAuth' },
    { pct: 25, key: 'xtream.stageCategories' }
  ]
  if (types.includes('live')) stages.push({ pct: 45, key: 'xtream.stageChannels' })
  if (types.includes('series')) stages.push({ pct: 65, key: 'xtream.stageSeries' })
  if (types.includes('vod')) stages.push({ pct: 80, key: 'xtream.stageVod' })
  stages.push({ pct: 90, key: 'xtream.stageProcessing' })
  stages.push({ pct: 95, key: 'xtream.stageSaving' })
  return stages
}

function startImportProgress(types) {
  const stages = buildImportStages(types)
  let stageIndex = 0
  importProgress.value = 0
  importStageKey.value = stages[0].key
  clearImportProgress()
  importProgressTimer = setInterval(() => {
    const target = stages[stageIndex].pct
    if (importProgress.value < target) {
      const delta = Math.max(0.4, (target - importProgress.value) * 0.06)
      importProgress.value = Math.min(target, importProgress.value + delta)
    } else if (stageIndex < stages.length - 1) {
      stageIndex++
      importStageKey.value = stages[stageIndex].key
    }
  }, 250)
}

function clearImportProgress() {
  if (!importProgressTimer) return
  clearInterval(importProgressTimer)
  importProgressTimer = null
}

async function runImport() {
  if (!canImport.value || importing.value) return
  const streamTypes = [...enabledTypes.value]
  const categories = Object.fromEntries(streamTypes.map(type => [type, [...typeState[type].selected]]))
  const endpoint = props.playlistId
    ? `/playlists/${props.playlistId}/import/xtream`
    : '/import/xtream'

  importing.value = true
  importResult.value = null
  importError.value = ''
  startImportProgress(streamTypes)
  try {
    const { data } = await api.post(endpoint, {
      serverUrl: form.serverUrl.trim(),
      username: form.username.trim(),
      password: form.password,
      playlistName: '',
      streamTypes,
      categories
    })
    clearImportProgress()
    importProgress.value = 100
    importStageKey.value = 'xtream.stageFinalizing'
    importResult.value = data
    emit('imported', data)
  } catch (error) {
    clearImportProgress()
    importError.value = requestErrorMessage(error, 'import')
  } finally {
    importing.value = false
  }
}

onBeforeUnmount(clearImportProgress)
</script>

<style scoped>
.wizard { min-height: 430px; }
.step-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.step-count { color: var(--text-muted); font-size: 12px; font-weight: 600; }
.step-dots { display: flex; gap: 8px; margin: 0; padding: 0; list-style: none; }
.step-dot {
  display: grid; place-items: center; width: 26px; height: 26px; border: 1px solid var(--border-light);
  border-radius: 50%; color: var(--text-muted); font-size: 11px; font-weight: 700;
}
.step-dots li.complete .step-dot { border-color: var(--accent); color: var(--accent-hover); }
.step-dots li.active .step-dot { border-color: var(--accent); background: var(--accent); color: white; }
.step-title { margin: 0 0 8px; font-size: 18px; }
.step-title:focus { outline: none; }
.step-description { margin: 0 0 20px; color: var(--text-secondary); font-size: 13px; line-height: 1.55; }
.form-group { margin-bottom: 16px; }
.form-group label,
.search-group label { display: block; margin-bottom: 6px; color: var(--text-secondary); font-size: 12px; font-weight: 600; }
.type-toggle-row {
  display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 14px 16px;
  border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--bg-primary);
}
.toggle-label { color: var(--text-primary); font-size: 14px; font-weight: 650; cursor: pointer; }
.toggle-description { margin: 4px 0 0; color: var(--text-muted); font-size: 11px; }
.toggle-control { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.toggle-state { color: var(--text-muted); font-size: 11px; font-weight: 700; }
.toggle-state.enabled { color: var(--success); }
.switch-input {
  appearance: none; position: relative; width: 42px; height: 24px; margin: 0; border: 1px solid var(--border-light);
  border-radius: 999px; background: var(--bg-tertiary); cursor: pointer; transition: background-color var(--transition), border-color var(--transition);
}
.switch-input::after {
  content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%;
  background: var(--text-muted); transition: transform var(--transition), background-color var(--transition);
}
.switch-input:checked { border-color: var(--accent); background: var(--accent); }
.switch-input:checked::after { transform: translateX(18px); background: white; }
.switch-input:focus-visible { outline: 3px solid var(--accent-soft); outline-offset: 2px; }
.switch-input:disabled { cursor: not-allowed; opacity: 0.5; }
.category-fieldset { min-width: 0; margin: 16px 0 0; padding: 0; border: 0; transition: opacity var(--transition); }
.category-fieldset.dimmed { opacity: 0.45; }
.search-group { margin-bottom: 12px; }
.category-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.category-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.selected-counter { color: var(--text-secondary); font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.filter-hint { margin: 0 0 8px; color: var(--accent-hover); font-size: 11px; line-height: 1.4; }
.category-list {
  height: min(280px, 35dvh); overflow-y: auto; overscroll-behavior: contain; border: 1px solid var(--border);
  border-radius: var(--radius); background: var(--bg-primary);
}
.category-list:focus-visible { outline: 3px solid var(--accent-soft); border-color: var(--accent); }
.category-list ul { margin: 0; padding: 4px; list-style: none; }
.category-row {
  display: flex; align-items: center; gap: 10px; min-height: 38px; padding: 7px 10px; border-radius: 6px;
  content-visibility: auto; contain-intrinsic-size: 38px;
}
.category-row:hover { background: var(--bg-hover); }
.category-row input { width: 16px; height: 16px; margin: 0; accent-color: var(--accent); flex-shrink: 0; }
.category-row input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.category-row label { flex: 1; color: var(--text-secondary); font-size: 13px; line-height: 1.35; cursor: pointer; }
.empty-categories { margin: 0; padding: 28px 16px; color: var(--text-muted); font-size: 13px; text-align: center; }
.summary { margin-top: 16px; padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--bg-primary); }
.summary h5 { margin: 0 0 10px; font-size: 13px; }
.summary ul { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.summary li { display: flex; justify-content: space-between; gap: 16px; color: var(--text-secondary); font-size: 12px; }
.summary li span:last-child { text-align: right; }
.summary strong { color: var(--text-muted); }
.summary strong.summary-enabled { color: var(--success); }
.selection-warning { margin: 10px 0 0; color: #fca5a5; font-size: 12px; }
.result-box { display: flex; align-items: flex-start; gap: 9px; margin-top: 14px; padding: 12px 14px; border-radius: var(--radius); font-size: 13px; line-height: 1.45; }
.result-box svg { flex-shrink: 0; margin-top: 1px; }
.result-box.success { border: 1px solid rgba(16, 185, 129, 0.2); background: var(--success-soft); color: #6ee7b7; }
.result-box.error { border: 1px solid rgba(239, 68, 68, 0.2); background: var(--danger-soft); color: #fca5a5; }
.import-progress { margin-top: 16px; padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-primary); }
.progress-stage { display: flex; align-items: center; gap: 10px; color: var(--text-secondary); font-size: 13px; }
.progress-stage > :nth-child(2) { flex: 1; }
.progress-percent { color: var(--text-primary); font-variant-numeric: tabular-nums; font-weight: 600; }
.progress-track { height: 6px; margin-top: 10px; overflow: hidden; border-radius: 999px; background: var(--border); }
.progress-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--accent), #6366f1); transition: width 0.2s linear; }
.import-progress p { margin: 8px 0 0; color: var(--text-muted); font-size: 11px; }
.spinner-sm { width: 14px; height: 14px; }
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
@media (max-width: 600px) {
  .wizard { min-height: 0; }
  .type-toggle-row, .category-toolbar, .summary li { align-items: flex-start; }
  .category-toolbar { flex-direction: column; }
  .selected-counter { white-space: normal; }
}
</style>
