<template>
  <div class="add-types-section">
    <h4 class="add-types-title">{{ t('multiSource.title') }}</h4>
    <p class="add-types-desc">{{ t('multiSource.desc') }}</p>

    <ul v-if="extraSources.length" class="source-list">
      <li v-for="source in extraSources" :key="source.id" class="source-row">
        <div class="source-info">
          <span class="source-label">{{ source.label || source.username }}</span>
          <span class="source-detail">{{ source.username }} @ {{ source.server_url }}</span>
        </div>
        <button class="btn btn-ghost btn-icon-sm" type="button" :title="t('common.delete')" @click="deleteSource(source)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </li>
    </ul>
    <p v-else class="filter-rule-empty">{{ t('multiSource.empty') }}</p>

    <form class="source-form" @submit.prevent="addSource">
      <input v-model="newSource.label" class="input" type="text" autocomplete="off" :placeholder="t('multiSource.labelPlaceholder')" />
      <input v-model="newSource.serverUrl" class="input" type="text" autocomplete="off" :placeholder="t('multiSource.serverPlaceholder')" required />
      <input v-model="newSource.username" class="input" type="text" autocomplete="off" :placeholder="t('multiSource.usernamePlaceholder')" required />
      <input v-model="newSource.password" class="input" type="password" autocomplete="new-password" :placeholder="t('multiSource.passwordPlaceholder')" required />
      <button class="btn btn-secondary btn-sm" type="submit" :disabled="sourceSaving || !newSource.serverUrl.trim() || !newSource.username.trim() || !newSource.password">
        <span v-if="sourceSaving" class="spinner" style="width:12px;height:12px"></span>
        {{ t('multiSource.add') }}
      </button>
    </form>

    <button class="btn btn-primary" type="button" style="margin-top:12px" :disabled="syncingAll || syncing" @click="syncAllSources">
      <span v-if="syncingAll" class="spinner" style="width:14px;height:14px"></span>
      <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
      {{ syncingAll ? t('multiSource.syncingAll') : t('multiSource.syncAll') }}
    </button>

    <div v-if="syncAllResult" class="sync-report" style="margin-top:12px">
      <h4 class="sync-report-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        {{ t('multiSource.reportTitle') }}
      </h4>
      <div class="sync-report-stats">
        <span class="badge badge-success">{{ t('updateView.addedCount', { count: syncAllResult.added }) }}</span>
        <span class="badge badge-accent">{{ t('updateView.updatedCount', { count: syncAllResult.updated }) }}</span>
        <span v-if="syncAllResult.removed" class="badge badge-danger">{{ t('updateView.removedCount', { count: syncAllResult.removed }) }}</span>
        <span v-if="syncAllResult.filteredOut" class="badge">{{ t('updateView.filteredOutCount', { count: syncAllResult.filteredOut }) }}</span>
      </div>
      <ul class="source-report-list">
        <li v-for="entry in syncAllResult.sources" :key="entry.sourceId || 'main'" class="source-report-row">
          <span class="source-report-label">{{ entry.label }}</span>
          <span v-if="entry.ok" class="source-report-ok">{{ t('multiSource.sourceOk', { added: entry.added, updated: entry.updated }) }}</span>
          <span v-else class="source-report-fail">{{ t('multiSource.sourceFailed', { error: entry.error }) }}</span>
        </li>
      </ul>
      <button class="btn btn-ghost btn-sm" type="button" @click="syncAllResult = null">{{ t('common.close') }}</button>
    </div>
  </div>
</template>

<script setup>
import { inject, onMounted, reactive, ref } from 'vue'
import api from '../../api'
import { useI18n } from '../../langs/useI18n'
import { apiErrorMessage } from '../../utils/apiError'

/**
 * Ek Xtream kaynaklari (coklu kaynak): listeleme, ekleme, silme ve hepsini esitleme.
 * Esitleme bitince `synced` yayilir; ust bilesen kanal/kategori listesini tazeler.
 */
const props = defineProps({
  playlistId: { type: String, required: true },
  // Ana Xtream esitlemesi suruyorsa toplu esitleme baslatilmaz.
  syncing: { type: Boolean, default: false },
})
const emit = defineEmits(['synced'])
const { t } = useI18n()
const toast = inject('toast')

const extraSources = ref([])
const newSource = reactive({ label: '', serverUrl: '', username: '', password: '' })
const sourceSaving = ref(false)
const syncingAll = ref(false)
const syncAllResult = ref(null)

// ---- Ek kaynaklar (coklu kaynak) ----
async function loadSources() {
  try {
    const { data } = await api.get(`/playlists/${props.playlistId}/sources`)
    extraSources.value = data
  } catch { extraSources.value = [] }
}

async function addSource() {
  if (sourceSaving.value) return
  sourceSaving.value = true
  try {
    await api.post(`/playlists/${props.playlistId}/sources`, {
      label: newSource.label.trim() || undefined,
      serverUrl: newSource.serverUrl.trim(),
      username: newSource.username.trim(),
      password: newSource.password,
    })
    newSource.label = ''; newSource.serverUrl = ''; newSource.username = ''; newSource.password = ''
    toast(t('multiSource.added'), 'success')
    await loadSources()
  } catch (e) { toast(apiErrorMessage(e, t, 'common.error'), 'error') }
  finally { sourceSaving.value = false }
}

async function deleteSource(source) {
  try {
    await api.delete(`/sources/${source.id}`)
    toast(t('multiSource.deleted'), 'success')
    await loadSources()
  } catch (e) { toast(apiErrorMessage(e, t, 'common.error'), 'error') }
}

async function syncAllSources() {
  if (syncingAll.value || props.syncing) return
  syncingAll.value = true
  syncAllResult.value = null
  try {
    const { data } = await api.post(`/playlists/${props.playlistId}/sync-all`)
    syncAllResult.value = data
    toast(t('multiSource.syncResult', { added: data.added, updated: data.updated, removed: data.removed }), data.failedSources ? 'error' : 'success')
    emit('synced', data)
  } catch (e) { toast(apiErrorMessage(e, t, 'toast.updateError'), 'error') }
  finally { syncingAll.value = false }
}

onMounted(loadSources)
</script>

<style scoped>
/* Editor.vue ile ortak bolum kutusu */
.add-types-section {
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 16px; margin-bottom: 8px; margin-top: 8px;
}
.add-types-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.add-types-desc { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }
.sync-report {
  margin-top: 14px; padding: 16px; border: 1px solid rgba(16,185,129,0.25);
  border-radius: var(--radius-lg); background: var(--bg-secondary);
}
.sync-report-title { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; font-size: 14px; font-weight: 600; }
.sync-report-stats { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.filter-rule-empty { font-size: 12px; color: var(--text-muted); margin-bottom: 12px; }

/* Ek kaynaklar */
.source-list { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.source-row {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px;
  background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius);
}
.source-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.source-label { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.source-detail { font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.source-form { display: flex; gap: 6px; flex-wrap: wrap; }
.source-form .input { flex: 1; min-width: 120px; }
.source-report-list { list-style: none; margin: 10px 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.source-report-row { display: flex; flex-direction: column; gap: 2px; font-size: 12px; }
.source-report-label { font-weight: 600; color: var(--text-primary); }
.source-report-ok { color: var(--success); }
.source-report-fail { color: var(--danger); }
</style>
