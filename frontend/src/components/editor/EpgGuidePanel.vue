<template>
  <div class="epg-guide-wrap">
    <!-- Date Navigation -->
    <div class="epg-date-nav">
      <button type="button" class="epg-date-btn" :aria-label="t('epg.previousDay')" @click="changeDate(-1)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div class="epg-date-pills">
        <button v-for="d in dateOptions" :key="d.value" type="button"
          :class="['epg-date-pill', { active: guideDate === d.value, today: d.isToday }]"
          :aria-pressed="guideDate === d.value ? 'true' : 'false'"
          @click="selectDate(d.value)">
          <span class="epg-date-day">{{ d.dayName }}</span>
          <span class="epg-date-num">{{ d.dayNum }}</span>
        </button>
      </div>
      <button type="button" class="epg-date-btn" :aria-label="t('epg.nextDay')" @click="changeDate(1)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>

    <!-- Guide Grid -->
    <div v-if="loading" class="epg-guide-loading">
      <span class="spinner"></span>
      <span>{{ t('epg.loadingGuide') }}</span>
    </div>
    <div v-else-if="channels.length === 0" class="epg-guide-empty">
      <div class="epg-guide-empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      </div>
      <p>{{ t('epg.noData') }}</p>
      <span class="epg-guide-empty-hint">{{ t('epg.emptyHint') }}</span>
    </div>
    <template v-else>
      <!-- Bellek penceresi: ustten atilan kanallar geri yuklenebilir -->
      <div v-if="hasMoreAbove" class="epg-loading-more epg-load-earlier" role="status">
        <span v-if="loadingEarlier" class="spinner spinner-sm"></span>
        <span>{{ t('epg.windowRange', { from: windowStart + 1, to: windowEnd, total }) }}</span>
        <button type="button" class="btn btn-ghost btn-sm" :disabled="loadingEarlier || loadingMore" @click="loadEarlier">
          {{ t('epg.loadEarlier') }}
        </button>
      </div>
      <div class="epg-grid-container">
        <!-- Time Header -->
        <div class="epg-grid-corner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="epg-time-header" ref="timeHeaderRef">
          <div class="epg-time-track" :style="{ width: TRACK_WIDTH + 'px' }">
            <div v-for="h in 24" :key="h" class="epg-time-slot" :style="{ left: ((h-1) * HOUR_WIDTH) + 'px', width: HOUR_WIDTH + 'px' }">
              <span class="epg-time-label">{{ String(h-1).padStart(2,'0') }}:00</span>
            </div>
            <!-- Now indicator in header -->
            <div v-if="isToday" class="epg-now-marker-top" :style="{ left: nowOffset + 'px' }"></div>
          </div>
        </div>
        <!-- Channel Rows -->
        <div class="epg-channel-col" ref="channelColRef">
          <div v-for="ch in channels" :key="ch.id" class="epg-ch-row-label">
            <img v-if="canShowImage(ch.logo_url)" :src="ch.logo_url" class="epg-ch-logo" loading="lazy" :alt="t('accessibility.channelLogo', { name: ch.name })" @error="emit('image-error', ch.logo_url)" />
            <div v-else class="epg-ch-logo-fb">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>
            </div>
            <span class="epg-ch-name">{{ ch.name }}</span>
          </div>
        </div>
        <div class="epg-grid-body" ref="gridBodyRef" @scroll="onGridScroll">
          <div class="epg-grid-track" :style="{ width: TRACK_WIDTH + 'px' }">
            <div v-for="ch in channels" :key="ch.id" class="epg-grid-row">
              <!-- Program blocks -->
              <div v-for="prog in ch.programs" :key="prog.id"
                :class="['epg-prog-block', { live: isProgramLive(prog), past: isProgramPast(prog) }]"
                :style="getProgramStyle(prog)"
                @click="emit('select-program', prog, ch)"
                :title="prog.title">
                <span class="epg-prog-block-title">{{ prog.title }}</span>
                <span class="epg-prog-block-time">{{ formatTime(prog.start_time) }}</span>
              </div>
              <!-- Empty state for row -->
              <div v-if="!ch.programs.length" class="epg-row-empty">{{ t('epg.rowEmpty') }}</div>
            </div>
            <!-- Now indicator line -->
            <div v-if="isToday" class="epg-now-line" :style="{ left: nowOffset + 'px' }">
              <div class="epg-now-dot"></div>
            </div>
          </div>
        </div>
        <div v-if="loadingMore || windowEnd < total" class="epg-loading-more" role="status">
          <span v-if="loadingMore" class="spinner spinner-sm"></span>
          <span>{{ t('epg.loadedCount', { loaded: windowEnd, total }) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, markRaw, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import api from '../../api'
import { useI18n } from '../../langs/useI18n'

/**
 * EPG rehber izgarasi. Kanallar sayfa sayfa (100'er) yuklenir; bellekte en
 * fazla MAX_PAGES sayfalik bir pencere tutulur. Asagi kaydirildikca ustteki
 * sayfa atilir, yukari donuldugunde geri yuklenir — binlerce kanalli listede
 * DOM ve bellek sinirsiz buyumez. Program dizileri reaktif yapilmaz (markRaw):
 * salt okunur veriyi derin proxy'ye sarmak buyuk listelerde pahaliydi.
 */
const props = defineProps({
  playlistId: { type: String, required: true },
  // Ust bilesen her artirdiginda rehber bastan yuklenir (kaynak eklendi, eslestirme yapildi...).
  reloadKey: { type: Number, default: 0 },
  canShowImage: { type: Function, default: url => Boolean(url) },
})
const emit = defineEmits(['select-program', 'image-error'])
const { t } = useI18n()

const PAGE_SIZE = 100
const MAX_PAGES = 3
const HOUR_WIDTH = 240
const TRACK_WIDTH = 24 * HOUR_WIDTH
const ROW_HEIGHT = 52
const EDGE_PX = 400

const guideDate = ref(todayStr())
const chunks = shallowRef([]) // [{ page, rows }]
const total = ref(0)
const loading = ref(false)
const loadingMore = ref(false)
const loadingEarlier = ref(false)
const nowMs = ref(Date.now())
const nowOffset = ref(0)
const timeHeaderRef = ref(null)
const channelColRef = ref(null)
const gridBodyRef = ref(null)
let requestSeq = 0

const channels = computed(() => chunks.value.flatMap(chunk => chunk.rows))
const windowStart = computed(() => chunks.value.length ? (chunks.value[0].page - 1) * PAGE_SIZE : 0)
const windowEnd = computed(() => {
  const last = chunks.value.at(-1)
  return last ? (last.page - 1) * PAGE_SIZE + last.rows.length : 0
})
const hasMoreAbove = computed(() => windowStart.value > 0)

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
const isToday = computed(() => guideDate.value === todayStr())
const dateOptions = computed(() => {
  const days = []
  const dayNames = [t('days.sun'), t('days.mon'), t('days.tue'), t('days.wed'), t('days.thu'), t('days.fri'), t('days.sat')]
  const base = new Date(guideDate.value + 'T00:00:00')
  for (let i = -2; i <= 4; i++) {
    const d = new Date(base)
    d.setDate(d.getDate() + i)
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    days.push({ value: val, dayName: dayNames[d.getDay()], dayNum: d.getDate(), isToday: val === todayStr() })
  }
  return days
})

function freeze(rows) {
  return (rows || []).map(ch => markRaw({ ...ch, programs: markRaw(Array.isArray(ch.programs) ? ch.programs : []) }))
}

async function fetchPage(page) {
  const { data } = await api.get(`/playlists/${props.playlistId}/epg/guide`, {
    params: { date: guideDate.value, tzOffset: new Date().getTimezoneOffset(), page, limit: PAGE_SIZE }
  })
  return data
}

async function load() {
  const seq = ++requestSeq
  loading.value = true
  loadingMore.value = false
  loadingEarlier.value = false
  chunks.value = []
  total.value = 0
  try {
    const data = await fetchPage(1)
    if (seq !== requestSeq) return
    chunks.value = [{ page: 1, rows: freeze(data.channels) }]
    total.value = data.total || 0
    updateNow()
  } catch {
    if (seq === requestSeq) { chunks.value = []; total.value = 0 }
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function rowHeight() {
  return gridBodyRef.value?.querySelector('.epg-grid-row')?.offsetHeight || ROW_HEIGHT
}

async function shiftScroll(deltaRows) {
  const body = gridBodyRef.value
  if (!body || !deltaRows) return
  const delta = deltaRows * rowHeight()
  const before = body.scrollTop
  await nextTick()
  body.scrollTop = Math.max(0, before + delta)
  if (channelColRef.value) channelColRef.value.scrollTop = body.scrollTop
}

async function loadMore() {
  if (loading.value || loadingMore.value || loadingEarlier.value) return
  if (windowEnd.value >= total.value) return
  const seq = requestSeq
  const nextPage = chunks.value.at(-1).page + 1
  loadingMore.value = true
  try {
    const data = await fetchPage(nextPage)
    if (seq !== requestSeq) return
    const rows = freeze(data.channels)
    if (!rows.length) { total.value = windowEnd.value; return }
    let next = [...chunks.value, { page: nextPage, rows }]
    let dropped = 0
    if (next.length > MAX_PAGES) {
      dropped = next[0].rows.length
      next = next.slice(1)
    }
    chunks.value = next
    await shiftScroll(-dropped)
  } catch { /* sessiz: bir sonraki scroll'da tekrar dener */ }
  finally { if (seq === requestSeq) loadingMore.value = false }
}

async function loadEarlier() {
  if (loading.value || loadingMore.value || loadingEarlier.value || !hasMoreAbove.value) return
  const seq = requestSeq
  const prevPage = chunks.value[0].page - 1
  loadingEarlier.value = true
  try {
    const data = await fetchPage(prevPage)
    if (seq !== requestSeq) return
    const rows = freeze(data.channels)
    if (!rows.length) return
    let next = [{ page: prevPage, rows }, ...chunks.value]
    if (next.length > MAX_PAGES) next = next.slice(0, MAX_PAGES)
    chunks.value = next
    await shiftScroll(rows.length)
  } catch { /* sessiz */ }
  finally { if (seq === requestSeq) loadingEarlier.value = false }
}

function selectDate(value) {
  guideDate.value = value
  load()
}

function changeDate(delta) {
  const d = new Date(guideDate.value + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  selectDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
}

function updateNow() {
  const now = new Date()
  nowMs.value = now.getTime()
  nowOffset.value = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_WIDTH
}

function getProgramStyle(prog) {
  const start = new Date(prog.start_time)
  const end = new Date(prog.end_time || start)
  const dayStart = new Date(guideDate.value + 'T00:00:00')
  const startMins = Math.max(0, (start - dayStart) / 60000)
  const endMins = Math.min(1440, (end - dayStart) / 60000)
  const left = (startMins / 60) * HOUR_WIDTH
  const width = Math.max(((endMins - startMins) / 60) * HOUR_WIDTH, 30)
  return { left: left + 'px', width: width + 'px' }
}
function isProgramPast(prog) {
  return new Date(prog.end_time).getTime() < nowMs.value
}
function isProgramLive(prog) {
  return new Date(prog.start_time).getTime() <= nowMs.value && nowMs.value <= new Date(prog.end_time).getTime()
}
function formatTime(d) { if (!d) return ''; return new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }

function onGridScroll() {
  const body = gridBodyRef.value
  if (!body) return
  if (timeHeaderRef.value) timeHeaderRef.value.scrollLeft = body.scrollLeft
  if (channelColRef.value) channelColRef.value.scrollTop = body.scrollTop
  // Sona yaklasinca sonraki kanal sayfasini yukle (buyuk playlistlerde tumunu
  // tek seferde basmak tarayiciyi kilitler); basa donulunce atilan sayfayi geri getir.
  if (body.scrollTop + body.clientHeight > body.scrollHeight - EDGE_PX) loadMore()
  else if (body.scrollTop < EDGE_PX && hasMoreAbove.value) loadEarlier()
}

watch(() => props.reloadKey, () => load())

const nowTimer = setInterval(updateNow, 60000)
onMounted(load)
onUnmounted(() => {
  clearInterval(nowTimer)
  requestSeq++
})
</script>

<style scoped>
/* Date Navigation */
.epg-date-nav {
  display: flex; align-items: center; gap: 6px; padding: 10px 16px;
  border-bottom: 1px solid var(--border); background: var(--bg-secondary); flex-shrink: 0;
}
.epg-date-btn {
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: var(--radius-sm);
  color: var(--text-secondary); cursor: pointer; transition: all var(--transition); flex-shrink: 0;
}
.epg-date-btn:hover { background: var(--bg-hover); color: var(--text-primary); border-color: var(--border-light); }
.epg-date-pills { display: flex; gap: 4px; flex: 1; justify-content: center; overflow-x: auto; }
.epg-date-pill {
  display: flex; flex-direction: column; align-items: center; gap: 1px;
  padding: 5px 12px; border-radius: var(--radius); cursor: pointer;
  background: transparent; border: 1px solid transparent;
  transition: all var(--transition); min-width: 52px;
}
.epg-date-pill:hover { background: var(--bg-hover); border-color: var(--border); }
.epg-date-pill.active {
  background: var(--accent-soft); border-color: var(--accent);
  box-shadow: 0 0 12px rgba(99,102,241,0.15);
}
.epg-date-pill.today .epg-date-day { color: var(--accent-hover); }
.epg-date-pill.active .epg-date-day { color: var(--accent-hover); font-weight: 700; }
.epg-date-pill.active .epg-date-num { color: var(--text-primary); }
.epg-date-day { font-size: 10px; font-weight: 500; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; }
.epg-date-num { font-size: 15px; font-weight: 600; color: var(--text-secondary); line-height: 1.2; }

/* Guide states */
.epg-guide-wrap { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.epg-guide-loading {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; flex: 1; color: var(--text-muted); font-size: 13px;
}
.epg-guide-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; flex: 1; padding: 40px; text-align: center;
}
.epg-guide-empty-icon { opacity: 0.2; }
.epg-guide-empty p { font-size: 14px; color: var(--text-secondary); font-weight: 500; }
.epg-guide-empty-hint { font-size: 12px; color: var(--text-muted); max-width: 320px; line-height: 1.5; }

/* Grid Container - CSS Grid layout */
.epg-grid-container {
  flex: 1; display: grid; overflow: hidden;
  grid-template-columns: 180px 1fr;
  grid-template-rows: 36px 1fr;
}
.epg-grid-corner {
  grid-row: 1; grid-column: 1;
  background: var(--bg-tertiary); border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  color: var(--text-muted); z-index: 4;
}
.epg-time-header {
  grid-row: 1; grid-column: 2;
  overflow: hidden; background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border); z-index: 3; position: relative;
}
.epg-time-track { position: relative; height: 100%; }
.epg-time-slot {
  position: absolute; top: 0; height: 100%;
  border-left: 1px solid var(--border);
  display: flex; align-items: center; padding-left: 8px;
}
.epg-time-label { font-size: 10px; font-weight: 600; color: var(--text-muted); letter-spacing: 0.5px; }

/* Channel column */
.epg-channel-col {
  grid-row: 2; grid-column: 1; overflow-anchor: none;
  overflow: hidden; background: var(--bg-secondary);
  border-right: 1px solid var(--border); z-index: 2;
}
.epg-ch-row-label {
  display: flex; align-items: center; gap: 8px; padding: 0 10px;
  height: 52px; border-bottom: 1px solid var(--border);
  overflow: hidden;
}
.epg-ch-logo {
  width: 28px; height: 28px; border-radius: 6px; object-fit: contain;
  flex-shrink: 0; background: var(--bg-tertiary);
}
.epg-ch-logo-fb {
  width: 28px; height: 28px; border-radius: 6px; background: var(--bg-tertiary);
  display: flex; align-items: center; justify-content: center;
  color: var(--text-muted); flex-shrink: 0;
}
.epg-ch-name {
  font-size: 11px; font-weight: 500; color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* Grid body */
.epg-grid-body {
  grid-row: 2; grid-column: 2;
  /* Pencere kaydirilirken kaydirma telafisi elle yapilir; tarayicinin
     kaydirma sabitlemesi ikinci kez kaydirmasin. */
  overflow-anchor: none;
  overflow: auto; position: relative;
}
.epg-grid-track { position: relative; min-height: 100%; }
.epg-grid-row {
  position: relative; height: 52px; border-bottom: 1px solid var(--border);
  /* Saat cizgileri: kanal basina 24 DOM dugumu yerine tek arka plan */
  background-image: repeating-linear-gradient(to right, var(--border) 0, var(--border) 1px, transparent 1px, transparent 240px);
  /* Ekran disi satirlari render'dan atla (binlerce satirda fark yaratir) */
  content-visibility: auto; contain-intrinsic-size: 52px;
}
.epg-loading-more {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 10px; color: var(--text-muted); font-size: 12px;
  border-top: 1px solid var(--border);
}

/* Program blocks */
.epg-prog-block {
  position: absolute; top: 3px; bottom: 3px;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: 6px; padding: 4px 8px; cursor: pointer;
  overflow: hidden; display: flex; flex-direction: column; justify-content: center;
  transition: all 0.15s ease; z-index: 1;
}
.epg-prog-block:hover {
  background: var(--bg-card-hover); border-color: var(--border-light);
  z-index: 2; box-shadow: var(--shadow-sm);
  transform: scaleY(1.04);
}
.epg-prog-block.live {
  background: linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.05) 100%);
  border-color: rgba(239,68,68,0.3);
  box-shadow: 0 0 8px rgba(239,68,68,0.1);
}
.epg-prog-block.live:hover {
  border-color: rgba(239,68,68,0.5);
  box-shadow: 0 0 16px rgba(239,68,68,0.15);
}
.epg-prog-block.past { opacity: 0.45; }
.epg-prog-block-title {
  font-size: 11px; font-weight: 500; color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  line-height: 1.3;
}
.epg-prog-block-time {
  font-size: 9px; color: var(--text-muted); font-weight: 500;
}
.epg-row-empty {
  position: absolute; inset: 0; display: flex; align-items: center;
  justify-content: center; font-size: 11px; color: var(--text-muted);
}

/* Now indicator */
.epg-now-line {
  position: absolute; top: 0; bottom: 0; width: 2px;
  background: var(--danger); z-index: 10; pointer-events: none;
}
.epg-now-dot {
  position: absolute; top: -4px; left: -4px;
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--danger); box-shadow: 0 0 8px rgba(239,68,68,0.5);
}
.epg-now-marker-top {
  position: absolute; top: 0; bottom: 0; width: 2px;
  background: var(--danger); z-index: 5;
}

.epg-load-earlier { border-top: none; border-bottom: 1px solid var(--border); }
</style>
