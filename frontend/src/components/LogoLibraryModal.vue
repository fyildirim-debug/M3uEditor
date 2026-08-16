<template>
  <EditorFeatureModal :title="t('logoLibrary.title')" wide @close="close">
    <div class="logo-wrap">
      <div class="logo-filters">
        <input
          ref="searchInput"
          v-model="query"
          class="input logo-search"
          type="search"
          :placeholder="t('logoLibrary.searchPlaceholder')"
          autocomplete="off"
          @keydown.esc="close"
        />
        <span v-if="total" class="logo-count">{{ t('logoLibrary.count', { count: total.toLocaleString() }) }}</span>
        <select v-model="group" class="input logo-group" :aria-label="t('logoLibrary.countryFilter')">
          <option value="">{{ t('logoLibrary.allGroups') }}</option>
          <optgroup v-if="countryGroups.length" :label="t('logoLibrary.countries')">
            <option v-for="item in countryGroups" :key="item.id" :value="item.id">{{ item.display }} ({{ item.count }})</option>
          </optgroup>
          <optgroup v-if="otherGroups.length" :label="t('logoLibrary.otherGroups')">
            <option v-for="item in otherGroups" :key="item.id" :value="item.id">{{ item.display }} ({{ item.count }})</option>
          </optgroup>
        </select>
      </div>

      <div class="logo-body">
        <div v-if="loading && !logos.length" class="logo-state"><span class="spinner"></span></div>
        <p v-else-if="error" class="logo-state logo-error">{{ error }}</p>
        <p v-else-if="!logos.length" class="logo-state">{{ query ? t('logoLibrary.noResults', { query }) : t('logoLibrary.typeToSearch') }}</p>

        <div v-else class="logo-grid">
          <button
            v-for="logo in logos"
            :key="logo.path"
            class="logo-card"
            type="button"
            :title="`${logo.name} · ${groupName(logo.group)}`"
            @click="choose(logo)"
          >
            <!-- Kutuphanede saydam PNG'ler var; koyu temada gorunmeleri icin
                 kart zemini acik tutuluyor. -->
            <span class="logo-thumb">
              <img :src="logo.url" :alt="logo.name" loading="lazy" @error="onImageError($event)" />
            </span>
            <span class="logo-name">{{ logo.name }}</span>
            <span class="logo-group-label">{{ groupName(logo.group) }}</span>
          </button>
        </div>

        <button v-if="logos.length && logos.length < total" class="btn btn-secondary btn-sm logo-more" type="button" :disabled="loading" @click="loadMore">
          <span v-if="loading" class="spinner spinner-sm"></span>
          {{ t('logoLibrary.loadMore') }}
        </button>
      </div>
    </div>
  </EditorFeatureModal>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import api from '../api'
import { useI18n } from '../langs/useI18n'
import EditorFeatureModal from './EditorFeatureModal.vue'

const props = defineProps({
  // Kanal adı: modal açılır açılmaz bununla arama yapılır.
  channelName: { type: String, default: '' },
})
const emit = defineEmits(['close', 'select'])

const { t, lang } = useI18n()

const query = ref(props.channelName || '')
const group = ref('')
const groups = ref([])
const logos = ref([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const searchInput = ref(null)
const PAGE_SIZE = 60

// Arayüz dili Türkçeyse eşit puanlı sonuçlarda Türkiye logoları öne alınır.
// Filtre değil, yalnızca sıralama tercihidir.
const preferGroup = lang?.value === 'tr' ? 'turkey' : ''

/**
 * Ülke adları kullanıcının dilinde gösterilir. Sunucu klasör adıyla birlikte
 * ISO ülke kodunu da veriyor; 60'ı aşkın ülke adını iki dile elle yazmak
 * yerine tarayıcının kendi ülke sözlüğü kullanılıyor.
 */
const regionNames = (() => {
  try {
    return new Intl.DisplayNames([lang.value || 'tr'], { type: 'region' })
  } catch {
    return null
  }
})()

function groupName(id) {
  const item = groups.value.find((row) => row.id === id)
  if (item?.code && regionNames) {
    try {
      return regionNames.of(item.code) || item.label
    } catch { /* bilinmeyen kod: etikete dus */ }
  }
  // Ülke olmayan gruplar (vod, nordic, world-europe…) kendi çevirisine düşer.
  const key = `logoLibrary.group_${String(id).replace(/-/g, '_')}`
  const translated = t(key)
  return translated === key ? (item?.label || id) : translated
}

const sortedGroups = computed(() => groups.value
  .map((item) => ({ ...item, display: groupName(item.id) }))
  .sort((a, b) => a.display.localeCompare(b.display, lang.value || 'tr')))
const countryGroups = computed(() => sortedGroups.value.filter((item) => item.kind === 'country'))
const otherGroups = computed(() => sortedGroups.value.filter((item) => item.kind !== 'country'))

let requestId = 0

async function fetchLogos({ append = false } = {}) {
  const current = ++requestId
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/logo-library/search', {
      params: {
        q: query.value || undefined,
        group: group.value || undefined,
        preferGroup: preferGroup || undefined,
        limit: PAGE_SIZE,
        offset: append ? logos.value.length : 0,
      },
    })
    // Yazmaya devam edildiyse eski cevap gelmiş olabilir; sonuncusu kazanır.
    if (current !== requestId) return
    logos.value = append ? [...logos.value, ...data.logos] : data.logos
    total.value = data.total
  } catch (requestError) {
    if (current !== requestId) return
    error.value = requestError.response?.data?.error?.message || t('logoLibrary.failed')
    if (!append) logos.value = []
  } finally {
    if (current === requestId) loading.value = false
  }
}

function loadMore() {
  fetchLogos({ append: true })
}

function onImageError(event) {
  // Kütüphanede olup CDN'de henüz yayılmamış bir dosya varsa kart boş kalmasın.
  event.target.closest('.logo-card')?.classList.add('logo-card-broken')
}

function choose(logo) {
  emit('select', logo)
}

function close() {
  emit('close')
}

// Her tuşa basışta filtrelenir. Kısa gecikme yalnızca hızlı yazarken arka
// arkaya istek yığmamak için; sonuçlar yerinde kalır, yenisi gelince değişir,
// bu yüzden yazarken ızgara boşalıp yanıp sönmez.
let debounce = null
watch([query, group], () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => fetchLogos(), 120)
})

onMounted(async () => {
  await nextTick()
  searchInput.value?.focus()
  searchInput.value?.select()
  fetchLogos()
  try {
    const { data } = await api.get('/logo-library/groups')
    groups.value = data.groups || []
  } catch { /* grup listesi olmadan da arama çalışır */ }
})
</script>

<style scoped>
.logo-wrap { display: flex; flex-direction: column; min-height: 340px; max-height: 62vh; }
.logo-filters { display: flex; align-items: center; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
.logo-count { font-size: 12px; color: var(--text-muted); flex-shrink: 0; }
.logo-search { flex: 1; min-width: 0; }
.logo-group { width: 220px; flex-shrink: 0; }

.logo-body { flex: 1; overflow-y: auto; padding-top: 14px; display: flex; flex-direction: column; gap: 12px; }
.logo-state { margin: auto; color: var(--text-secondary); font-size: 13px; text-align: center; }
.logo-error { color: var(--danger); }

.logo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 10px;
}
.logo-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 7px 6px 8px; cursor: pointer;
  background: var(--bg-tertiary); border: 1px solid var(--border);
  border-radius: var(--radius); transition: border-color var(--transition), transform var(--transition);
}
.logo-card:hover { border-color: var(--accent); transform: translateY(-2px); }
.logo-card-broken { opacity: 0.35; }
.logo-thumb {
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 62px; padding: 6px; border-radius: var(--radius-sm);
  /* Logoların çoğu saydam ve koyu renkli, yani koyu zeminde kaybolurlar; bu
     yüzden altlarına açık bir levha gerekiyor. Düz beyaz koyu arayüzde çok
     sert duruyordu — hafif gri, düşük kontrastlı bir levha hem logoyu
     okutuyor hem göze batmıyor. */
  background: #e7eaf0;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
}
/* Izgarada logolar kesilmesin: kutuya sığdırılır, taşan kırpılmaz. */
.logo-thumb img { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; }
.logo-name {
  font-size: 11.5px; color: var(--text-primary); text-align: center; line-height: 1.3;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.logo-group-label { font-size: 10px; color: var(--text-muted); }
.logo-more { align-self: center; }

@media (max-width: 640px) {
  .logo-filters { flex-direction: column; }
  .logo-group { width: 100%; }
  .logo-grid { grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); }
}
</style>
