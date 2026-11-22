<template>
  <div class="add-types-section">
    <h4 class="add-types-title">{{ t('filterRules.title') }}</h4>
    <p class="add-types-desc">{{ t('filterRules.desc') }}</p>

    <ul v-if="filterRules.length" class="filter-rule-list">
      <li v-for="(rule, idx) in filterRules" :key="rule.id" class="filter-rule-row" :class="{ 'filter-rule-disabled': !rule.enabled }">
        <span class="badge" :class="rule.exclude ? 'badge-danger' : 'badge-success'">{{ rule.exclude ? t('filterRules.exclude') : t('filterRules.include') }}</span>
        <span class="filter-rule-field">{{ t('filterRules.fields.' + rule.field) }}</span>
        <code class="filter-rule-pattern" :title="rule.pattern">{{ rule.pattern }}</code>
        <div class="filter-rule-actions">
          <button class="btn btn-ghost btn-icon-sm" type="button" :disabled="idx === 0" :title="t('filterRules.moveUp')" @click="moveFilterRule(rule, 'up')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button class="btn btn-ghost btn-icon-sm" type="button" :disabled="idx === filterRules.length - 1" :title="t('filterRules.moveDown')" @click="moveFilterRule(rule, 'down')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button class="btn btn-ghost btn-icon-sm" type="button" :title="rule.enabled ? t('filterRules.disable') : t('filterRules.enable')" @click="toggleFilterRule(rule)">
            <svg v-if="rule.enabled" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          </button>
          <button class="btn btn-ghost btn-icon-sm" type="button" :title="t('common.delete')" @click="deleteFilterRule(rule)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </li>
    </ul>
    <p v-else class="filter-rule-empty">{{ t('filterRules.empty') }}</p>

    <form class="filter-rule-form" @submit.prevent="addFilterRule">
      <select v-model="newRule.field" class="input filter-rule-select" :aria-label="t('filterRules.fieldLabel')">
        <option value="group">{{ t('filterRules.fields.group') }}</option>
        <option value="name">{{ t('filterRules.fields.name') }}</option>
        <option value="url">{{ t('filterRules.fields.url') }}</option>
      </select>
      <input v-model="newRule.pattern" class="input filter-rule-input" type="text" autocomplete="off" :placeholder="t('filterRules.patternPlaceholder')" />
      <select v-model="newRule.exclude" class="input filter-rule-select" :aria-label="t('filterRules.modeLabel')">
        <option :value="true">{{ t('filterRules.exclude') }}</option>
        <option :value="false">{{ t('filterRules.include') }}</option>
      </select>
      <button class="btn btn-secondary btn-sm" type="button" :disabled="!newRule.pattern.trim() || ruleTesting" @click="testFilterRule">
        <span v-if="ruleTesting" class="spinner" style="width:12px;height:12px"></span>
        {{ t('filterRules.test') }}
      </button>
      <button class="btn btn-primary btn-sm" type="submit" :disabled="!newRule.pattern.trim() || ruleSaving">
        <span v-if="ruleSaving" class="spinner" style="width:12px;height:12px"></span>
        {{ t('filterRules.add') }}
      </button>
    </form>
    <div v-if="ruleTestResult" class="filter-rule-test-result">
      <p class="filter-rule-test-summary">{{ t('filterRules.testSummary', { count: ruleTestResult.matches.length, sampled: ruleTestResult.sampled }) }}</p>
      <ul v-if="ruleTestResult.matches.length" class="filter-rule-test-matches">
        <li v-for="match in ruleTestResult.matches" :key="match.name">
          {{ match.name }} <span v-if="match.group" class="filter-rule-test-group">{{ match.group }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { inject, onMounted, reactive, ref } from 'vue'
import api from '../../api'
import { useI18n } from '../../langs/useI18n'
import { apiErrorMessage } from '../../utils/apiError'

/** Guncelleme gorunumundeki filtre kurallari bolumu: listeleme, ekleme, test, sira ve silme. */
const props = defineProps({
  playlistId: { type: String, required: true },
})
const { t } = useI18n()
const toast = inject('toast')

const filterRules = ref([])
const newRule = reactive({ field: 'group', pattern: '', exclude: true })
const ruleSaving = ref(false)
const ruleTesting = ref(false)
const ruleTestResult = ref(null)

// ---- Filtre kurallari ----
async function loadFilterRules() {
  try {
    const { data } = await api.get(`/playlists/${props.playlistId}/filter-rules`)
    filterRules.value = data
  } catch { filterRules.value = [] }
}

async function addFilterRule() {
  if (!newRule.pattern.trim() || ruleSaving.value) return
  ruleSaving.value = true
  ruleTestResult.value = null
  try {
    await api.post(`/playlists/${props.playlistId}/filter-rules`, {
      field: newRule.field,
      pattern: newRule.pattern.trim(),
      exclude: newRule.exclude,
    })
    newRule.pattern = ''
    toast(t('filterRules.added'), 'success')
    await loadFilterRules()
  } catch (e) { toast(apiErrorMessage(e, t, 'common.error'), 'error') }
  finally { ruleSaving.value = false }
}

async function deleteFilterRule(rule) {
  try {
    await api.delete(`/filter-rules/${rule.id}`)
    toast(t('filterRules.deleted'), 'success')
    await loadFilterRules()
  } catch (e) { toast(apiErrorMessage(e, t, 'common.error'), 'error') }
}

async function toggleFilterRule(rule) {
  try {
    await api.put(`/filter-rules/${rule.id}`, { enabled: !rule.enabled })
    await loadFilterRules()
  } catch (e) { toast(apiErrorMessage(e, t, 'common.error'), 'error') }
}

async function moveFilterRule(rule, direction) {
  try {
    await api.put(`/filter-rules/${rule.id}/order`, { direction })
    await loadFilterRules()
  } catch (e) { toast(apiErrorMessage(e, t, 'common.error'), 'error') }
}

async function testFilterRule() {
  if (!newRule.pattern.trim() || ruleTesting.value) return
  ruleTesting.value = true
  try {
    const { data } = await api.post(`/playlists/${props.playlistId}/filter-rules/test`, {
      field: newRule.field,
      pattern: newRule.pattern.trim(),
    })
    ruleTestResult.value = data
  } catch (e) {
    ruleTestResult.value = null
    toast(apiErrorMessage(e, t, 'common.error'), 'error')
  } finally { ruleTesting.value = false }
}

onMounted(loadFilterRules)
</script>

<style scoped>
/* Editor.vue ile ortak bolum kutusu */
.add-types-section {
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 16px; margin-bottom: 8px; margin-top: 8px;
}
.add-types-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.add-types-desc { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }

/* Filtre kurallari */
.filter-rule-list { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.filter-rule-row {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px;
  background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius);
}
.filter-rule-disabled { opacity: 0.5; }
.filter-rule-field { font-size: 11px; color: var(--text-muted); min-width: 56px; }
.filter-rule-pattern {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 12px; color: var(--text-primary); background: var(--bg-tertiary);
  padding: 2px 6px; border-radius: 4px;
}
.filter-rule-actions { display: flex; gap: 2px; flex-shrink: 0; }
.filter-rule-empty { font-size: 12px; color: var(--text-muted); margin-bottom: 12px; }
.filter-rule-form { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.filter-rule-select { width: auto; flex: 0 0 auto; }
.filter-rule-input { flex: 1; min-width: 140px; }
.filter-rule-test-result {
  margin-top: 10px; padding: 10px 12px; background: var(--bg-secondary);
  border: 1px solid var(--border); border-radius: var(--radius);
}
.filter-rule-test-summary { font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; }
.filter-rule-test-matches { list-style: none; margin: 0; padding: 0; font-size: 12px; display: flex; flex-direction: column; gap: 4px; }
.filter-rule-test-group { color: var(--text-muted); margin-left: 6px; }
</style>
