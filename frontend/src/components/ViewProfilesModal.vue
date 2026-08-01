<template>
  <EditorFeatureModal :title="t('viewProfiles.title')" wide @close="$emit('close')">
    <p class="vp-description">{{ t('viewProfiles.description') }}</p>

    <!-- Mevcut gizli kategori durumunu yeni gorunum olarak kaydet -->
    <div class="vp-create-row">
      <input v-model="newViewName" class="input" :placeholder="t('viewProfiles.namePlaceholder')" @keyup.enter="createFromCurrent" />
      <button class="btn btn-primary btn-sm" type="button" :disabled="!newViewName.trim() || busy" @click="createFromCurrent">
        <span v-if="busyAction === 'create'" class="spinner spinner-sm"></span>
        {{ t('viewProfiles.createFromCurrent') }}
      </button>
    </div>

    <div v-if="loading" class="vp-state" role="status"><span class="spinner"></span> {{ t('common.loading') }}</div>
    <div v-else-if="views.length === 0" class="vp-state">{{ t('viewProfiles.empty') }}</div>

    <ul v-else class="vp-list">
      <li v-for="view in views" :key="view.id" class="vp-item">
        <div class="vp-item-main">
          <template v-if="renamingId === view.id">
            <input v-model="renameValue" class="input" @keyup.enter="saveRename(view)" @keyup.esc="renamingId = null" />
            <button class="btn btn-primary btn-sm" type="button" :disabled="!renameValue.trim() || busy" @click="saveRename(view)">{{ t('common.save') }}</button>
            <button class="btn btn-ghost btn-sm" type="button" @click="renamingId = null">{{ t('common.cancel') }}</button>
          </template>
          <template v-else>
            <span class="vp-item-name">{{ view.name }}</span>
            <span class="vp-item-count">{{ t('viewProfiles.hiddenCount', { count: (view.hidden_category_ids || []).length }) }}</span>
          </template>
        </div>
        <div class="vp-item-actions">
          <button class="btn btn-secondary btn-sm" type="button" :disabled="busy" @click="applyView(view)">
            <span v-if="busyAction === `apply-${view.id}`" class="spinner spinner-sm"></span>
            {{ t('viewProfiles.apply') }}
          </button>
          <button class="btn btn-secondary btn-sm" type="button" :disabled="busy" :title="t('viewProfiles.saveCurrentHint')" @click="saveCurrentToView(view)">
            {{ t('viewProfiles.saveCurrent') }}
          </button>
          <button class="btn btn-ghost btn-sm" type="button" :disabled="busy" @click="startRename(view)">{{ t('viewProfiles.rename') }}</button>
          <template v-if="confirmDeleteId === view.id">
            <button class="btn btn-danger btn-sm" type="button" :disabled="busy" @click="removeView(view)">{{ t('viewProfiles.deleteConfirmButton') }}</button>
            <button class="btn btn-ghost btn-sm" type="button" :disabled="busy" @click="confirmDeleteId = null">{{ t('common.cancel') }}</button>
          </template>
          <button v-else class="btn btn-ghost btn-sm vp-danger" type="button" :disabled="busy" @click="confirmDeleteId = view.id">{{ t('viewProfiles.delete') }}</button>
        </div>
      </li>
    </ul>

    <template #actions>
      <button class="btn btn-secondary" type="button" @click="$emit('close')">{{ t('common.close') }}</button>
    </template>
  </EditorFeatureModal>
</template>

<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import api from '../api'
import { useI18n } from '../langs/useI18n'
import EditorFeatureModal from './EditorFeatureModal.vue'

const props = defineProps({
  playlistId: { type: String, required: true },
  // Guncel kategori listesi; is_hidden durumunu gorunume yazmak ve
  // gorunumu kategorilere uygulamak icin kullanilir.
  categories: { type: Array, default: () => [] }
})
const emit = defineEmits(['close', 'applied'])

const toast = inject('toast')
const { t } = useI18n()

const views = ref([])
const loading = ref(true)
const newViewName = ref('')
const renamingId = ref(null)
const renameValue = ref('')
const confirmDeleteId = ref(null)
const busyAction = ref('')
const busy = computed(() => Boolean(busyAction.value))

function errorMessage(error) {
  return error.response?.data?.error?.message || t('viewProfiles.error')
}

function currentHiddenIds() {
  return props.categories.filter((cat) => cat.is_hidden).map((cat) => cat.id)
}

async function loadViews() {
  loading.value = true
  try {
    const { data } = await api.get(`/playlists/${props.playlistId}/views`)
    views.value = data
  } catch (error) {
    toast(errorMessage(error), 'error')
  } finally {
    loading.value = false
  }
}

async function createFromCurrent() {
  if (!newViewName.value.trim() || busy.value) return
  busyAction.value = 'create'
  try {
    const { data } = await api.post(`/playlists/${props.playlistId}/views`, {
      name: newViewName.value.trim(),
      hiddenCategoryIds: currentHiddenIds()
    })
    views.value = [...views.value, data]
    newViewName.value = ''
    toast(t('viewProfiles.created'), 'success')
  } catch (error) {
    toast(errorMessage(error), 'error')
  } finally {
    busyAction.value = ''
  }
}

function startRename(view) {
  renamingId.value = view.id
  renameValue.value = view.name
}

async function saveRename(view) {
  if (!renameValue.value.trim() || busy.value) return
  busyAction.value = `rename-${view.id}`
  try {
    const { data } = await api.put(`/views/${view.id}`, { name: renameValue.value.trim() })
    views.value = views.value.map((item) => (item.id === view.id ? data : item))
    renamingId.value = null
    toast(t('viewProfiles.updated'), 'success')
  } catch (error) {
    toast(errorMessage(error), 'error')
  } finally {
    busyAction.value = ''
  }
}

async function saveCurrentToView(view) {
  if (busy.value) return
  busyAction.value = `save-${view.id}`
  try {
    const { data } = await api.put(`/views/${view.id}`, { hiddenCategoryIds: currentHiddenIds() })
    views.value = views.value.map((item) => (item.id === view.id ? data : item))
    toast(t('viewProfiles.updated'), 'success')
  } catch (error) {
    toast(errorMessage(error), 'error')
  } finally {
    busyAction.value = ''
  }
}

async function removeView(view) {
  if (busy.value) return
  confirmDeleteId.value = null
  busyAction.value = `delete-${view.id}`
  try {
    await api.delete(`/views/${view.id}`)
    views.value = views.value.filter((item) => item.id !== view.id)
    toast(t('viewProfiles.deleted'), 'success')
  } catch (error) {
    toast(errorMessage(error), 'error')
  } finally {
    busyAction.value = ''
  }
}

/**
 * Secili gorunumu kategorilere yazar: gorunumdeki kategoriler gizlenir,
 * listede olmayanlar gorunur yapilir. Sadece durumu degisen kategorilere
 * istek atilir.
 */
async function applyView(view) {
  if (busy.value) return
  busyAction.value = `apply-${view.id}`
  const hiddenIds = new Set(Array.isArray(view.hidden_category_ids) ? view.hidden_category_ids : [])
  try {
    for (const cat of props.categories) {
      const desired = hiddenIds.has(cat.id)
      if (Boolean(cat.is_hidden) !== desired) {
        await api.put(`/categories/${cat.id}`, { is_hidden: desired })
      }
    }
    toast(t('viewProfiles.applied'), 'success')
    emit('applied')
  } catch (error) {
    toast(errorMessage(error), 'error')
  } finally {
    busyAction.value = ''
  }
}

onMounted(loadViews)
</script>

<style scoped>
.vp-description { margin: 0 0 14px; color: var(--text-muted); font-size: 12px; line-height: 1.5; }
.vp-create-row { display: flex; gap: 8px; margin-bottom: 16px; }
.vp-create-row .input { flex: 1; min-width: 0; }
.vp-state { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 80px; color: var(--text-muted); font-size: 13px; }
.vp-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.vp-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-md); flex-wrap: wrap; }
.vp-item-main { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
.vp-item-name { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-item-count { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.vp-item-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.vp-danger { color: var(--danger); }
@media (max-width: 520px) {
  .vp-item { align-items: stretch; flex-direction: column; }
}
</style>
