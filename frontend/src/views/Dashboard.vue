<template>
  <div class="dashboard">
    <div class="dash-header">
      <div>
        <h1 class="dash-title">{{ t('dashboard.title') }}</h1>
        <p class="dash-subtitle">{{ t('dashboard.subtitle') }}</p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" @click="showM3uImport = true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
          {{ t('m3uImport.title') }}
        </button>
        <button class="btn btn-secondary" @click="openXtream">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {{ t('xtream.importTitle') }}
        </button>
        <button class="btn btn-primary" @click="showCreate = true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {{ t('playlist.newPlaylist') }}
        </button>
      </div>
    </div>

    <!-- Stats bar -->
    <div v-if="!loading && playlists.length > 0" class="stats-bar">
      <div class="stat-item">
        <span class="stat-value">{{ playlists.length }}</span>
        <span class="stat-label">{{ t('dashboard.statsPlaylist') }}</span>
      </div>
      <div class="stat-sep"></div>
      <div class="stat-item">
        <span class="stat-value">{{ totalChannels }}</span>
        <span class="stat-label">{{ t('dashboard.statsTotalChannels') }}</span>
      </div>
      <div class="stat-sep"></div>
      <div class="stat-item">
        <span class="stat-value">{{ lastUpdated }}</span>
        <span class="stat-label">{{ t('dashboard.statsLastUpdated') }}</span>
      </div>
    </div>

    <!-- Plan Usage Bar -->
    <div v-if="!loading && playlists.length > 0" class="plan-usage-bar">
      <div class="plan-usage-left">
        <span class="plan-badge" :class="'plan-' + currentPlan">{{ currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1) }}</span>
        <span class="plan-usage-text">{{ t('dashboard.playlistUsage', { current: playlists.length, max: maxPlaylists }) }}</span>
        <div class="plan-progress-wrap">
          <div class="plan-progress-bar" :style="{ width: playlistUsagePercent + '%' }" :class="{ warn: playlistUsagePercent > 80 }"></div>
        </div>
      </div>
      <router-link v-if="currentPlan !== 'business'" to="/pricing" class="btn btn-ghost btn-sm plan-upgrade-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        {{ t('dashboard.upgrade') }}
      </router-link>
    </div>

    <div v-if="loading" class="skeleton-grid">
      <div v-for="i in 6" :key="i" class="skeleton skeleton-card"></div>
    </div>

    <!-- Empty State / Onboarding -->
    <div v-else-if="playlists.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      </div>
      <h3>{{ t('dashboard.noPlaylists') }}</h3>
      <p>{{ t('dashboard.createFirstHint') }}</p>

      <!-- Onboarding Steps -->
      <div class="onboard-steps">
        <div class="onboard-step">
          <div class="onboard-num">1</div>
          <div class="onboard-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </div>
          <h4>{{ t('dashboard.onboardStep1Title') }}</h4>
          <p>{{ t('dashboard.onboardStep1Desc') }}</p>
        </div>
        <div class="onboard-connector">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </div>
        <div class="onboard-step">
          <div class="onboard-num">2</div>
          <div class="onboard-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
          <h4>{{ t('dashboard.onboardStep2Title') }}</h4>
          <p>{{ t('dashboard.onboardStep2Desc') }}</p>
        </div>
        <div class="onboard-connector">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </div>
        <div class="onboard-step">
          <div class="onboard-num">3</div>
          <div class="onboard-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          </div>
          <h4>{{ t('dashboard.onboardStep3Title') }}</h4>
          <p>{{ t('dashboard.onboardStep3Desc') }}</p>
        </div>
      </div>

      <div class="onboard-actions">
        <button class="btn btn-secondary" @click="openXtream">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {{ t('xtream.importTitle') }}
        </button>
        <button class="btn btn-ghost" @click="showM3uImport = true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
          {{ t('m3uImport.title') }}
        </button>
      </div>
    </div>

    <!-- Playlist Grid -->
    <div v-else class="playlist-grid">
      <div v-for="pl in playlists" :key="pl.id" class="pl-card" @click="$router.push('/playlist/' + pl.id)">
        <div class="pl-card-top">
          <div class="pl-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </div>
          <div class="pl-card-menu" @click.stop>
            <button class="btn btn-ghost btn-icon-sm" @click="startEdit(pl)" :data-tooltip="t('common.edit')" :aria-label="t('common.edit')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon-sm" @click="confirmDelete(pl)" :data-tooltip="t('common.delete')" :aria-label="t('common.delete')" style="color:var(--danger)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
        <h3 class="pl-name">{{ pl.name }}</h3>

        <!-- Channel progress bar -->
        <div class="pl-channel-progress">
          <div class="pl-progress-header">
            <span>{{ pl.channel_count || 0 }} / {{ maxChannelsPerPlaylist }} {{ t('common.channel') }}</span>
          </div>
          <div class="pl-progress-track">
            <div class="pl-progress-fill" :style="{ width: getChannelPercent(pl) + '%' }" :class="{ warn: getChannelPercent(pl) > 80 }"></div>
          </div>
        </div>

        <!-- Stream type badges -->
        <div class="pl-meta">
          <span class="badge badge-accent">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {{ formatDate(pl.created_at) }}
          </span>
          <span v-if="hasStreamType(pl, 'live')" class="badge badge-stream badge-live">Live</span>
          <span v-if="hasStreamType(pl, 'vod')" class="badge badge-stream badge-vod">VOD</span>
          <span v-if="hasStreamType(pl, 'series')" class="badge badge-stream badge-series">Series</span>
        </div>

        <div class="pl-card-footer">
          <span class="pl-time-ago">{{ getRelativeTime(pl.updated_at || pl.created_at) }}</span>
          <span class="pl-open-label">{{ t('common.edit') }}</span>
          <svg class="pl-arrow-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </div>
      </div>
    </div>

    <!-- Create Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
          <div class="modal">
            <div class="modal-header">
              <h3>{{ t('playlist.createTitle') }}</h3>
              <button class="btn btn-ghost btn-icon-sm" @click="showCreate = false">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="form-group">
              <label>{{ t('playlist.nameLabel') }}</label>
              <input class="input" v-model="newName" placeholder="Orn: Ana Liste, Spor Kanallari..." @keyup.enter="createPlaylist" autofocus />
            </div>
            <div class="modal-actions">
              <button class="btn btn-secondary" @click="showCreate = false">{{ t('common.cancel') }}</button>
              <button class="btn btn-primary" @click="createPlaylist" :disabled="!newName.trim()">{{ t('common.create') }}</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Edit Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="editingPl" class="modal-overlay" @click.self="editingPl = null">
          <div class="modal">
            <div class="modal-header">
              <h3>{{ t('playlist.editTitle') }}</h3>
              <button class="btn btn-ghost btn-icon-sm" @click="editingPl = null">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="form-group">
              <label>{{ t('playlist.nameLabel') }}</label>
              <input class="input" v-model="editName" @keyup.enter="updatePlaylist" />
            </div>
            <div class="modal-actions">
              <button class="btn btn-secondary" @click="editingPl = null">{{ t('common.cancel') }}</button>
              <button class="btn btn-primary" @click="updatePlaylist" :disabled="!editName.trim()">{{ t('common.save') }}</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Confirm -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="deletingPl" class="modal-overlay" @click.self="deletingPl = null">
          <div class="modal">
            <div class="modal-header">
              <h3>{{ t('playlist.deleteTitle') }}</h3>
              <button class="btn btn-ghost btn-icon-sm" @click="deletingPl = null">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="delete-warning">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <p>"<strong>{{ deletingPl.name }}</strong>" {{ t('playlist.deleteConfirm') }}</p>
            </div>
            <div class="modal-actions">
              <button class="btn btn-secondary" @click="deletingPl = null">{{ t('common.cancel') }}</button>
              <button class="btn btn-danger" @click="deletePlaylist">{{ t('common.permanently_delete') }}</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Xtream Import Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showXtreamModal" class="modal-overlay" @click.self="showXtreamModal = false">
          <div class="modal" style="max-width:500px">
            <div class="modal-header">
              <h3>{{ t('xtream.importTitle') }}</h3>
              <button class="btn btn-ghost btn-icon-sm" @click="showXtreamModal = false">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="form-group">
              <label>{{ t('xtream.autoFillLabel') }} <span style="font-weight:400;color:var(--text-muted)">({{ t('common.optional') }})</span></label>
              <input class="input" v-model="m3uUrlInput" @input="parseM3uUrl" placeholder="http://example.com:8080/get.php?username=xxx&password=yyy&type=m3u_plus" />
              <div v-if="m3uUrlParsed" class="parse-success">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                {{ t('xtream.autoFilled') }}
              </div>
              <div v-if="m3uUrlInput && !m3uUrlParsed && m3uUrlInput.length > 10" class="parse-error">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                {{ t('xtream.autoFillFailed') }}
              </div>
            </div>
            <div class="url-divider"><span>{{ t('xtream.manualEntry') }}</span></div>
            <div class="form-group"><label>{{ t('xtream.serverUrl') }}</label><input class="input" v-model="xtreamForm.serverUrl" placeholder="http://example.com:8080" /></div>
            <div class="form-group"><label>{{ t('xtream.username') }}</label><input class="input" v-model="xtreamForm.username" /></div>
            <div class="form-group"><label>{{ t('xtream.password') }}</label><input class="input" v-model="xtreamForm.password" /></div>
            <div class="form-group">
              <label>{{ t('xtream.streamTypes') }}</label>
              <div class="stream-type-group">
                <label class="stream-type-label"><input type="checkbox" value="live" v-model="xtreamForm.streamTypes" /> {{ t('xtream.typeLive') }}</label>
                <label class="stream-type-label"><input type="checkbox" value="vod" v-model="xtreamForm.streamTypes" /> {{ t('xtream.typeVod') }}</label>
                <label class="stream-type-label"><input type="checkbox" value="series" v-model="xtreamForm.streamTypes" /> {{ t('xtream.typeSeries') }}</label>
              </div>
            </div>
            <div v-if="importResult" class="result-box success">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              {{ t('toast.importSuccess', { channels: importResult.totalChannels, categories: importResult.totalCategories, duration: (importResult.duration / 1000).toFixed(1) }) }}
            </div>
            <div v-if="importError" class="result-box error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              {{ importError }}
            </div>
            <div class="modal-actions">
              <button class="btn btn-secondary" @click="showXtreamModal = false">{{ t('common.close') }}</button>
              <button class="btn btn-primary" @click="doXtreamImport" :disabled="importing || !xtreamForm.serverUrl || !xtreamForm.username || !xtreamForm.password || !xtreamForm.streamTypes.length">
                <span v-if="importing" class="spinner" style="width:14px;height:14px"></span>
                {{ importing ? t('common.importing') : t('common.import') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- M3U Import Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showM3uImport" class="modal-overlay" @click.self="showM3uImport = false">
          <div class="modal-content">
            <h3 class="modal-title">{{ t('m3uImport.title') }}</h3>
            <div class="form-group">
              <label>{{ t('m3uImport.fromUrl') }}</label>
              <input class="input" v-model="m3uImportForm.url" :placeholder="t('m3uImport.urlPlaceholder')" />
            </div>
            <div class="url-divider"><span>{{ t('common.or') }}</span></div>
            <div class="form-group">
              <label>{{ t('m3uImport.fromFile') }}</label>
              <input type="file" accept=".m3u,.m3u8,.txt" @change="onM3uFileSelect" class="input" />
            </div>
            <div class="form-group">
              <label>{{ t('m3uImport.playlistName') }}</label>
              <input class="input" v-model="m3uImportForm.name" :placeholder="t('m3uImport.namePlaceholder')" />
            </div>
            <div v-if="m3uImportResult" class="result-box success">
              {{ t('toast.importSuccess', { channels: m3uImportResult.totalChannels, categories: m3uImportResult.totalCategories, duration: (m3uImportResult.duration / 1000).toFixed(1) }) }}
            </div>
            <div v-if="m3uImportError" class="result-box error">{{ m3uImportError }}</div>
            <div class="modal-actions">
              <button class="btn btn-secondary" @click="showM3uImport = false">{{ t('common.close') }}</button>
              <button class="btn btn-primary" @click="doM3uImport" :disabled="m3uImporting || (!m3uImportForm.url && !m3uImportForm.content)">
                <span v-if="m3uImporting" class="spinner" style="width:14px;height:14px"></span>
                {{ m3uImporting ? t('common.importing') : t('common.import') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { useI18n } from '../langs/useI18n'
import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

const toast = inject('toast')
const playlists = ref([])
const loading = ref(true)
const showCreate = ref(false)
const newName = ref('')
const editingPl = ref(null)
const editName = ref('')
const deletingPl = ref(null)

const totalChannels = computed(() =>
  playlists.value.reduce((sum, pl) => sum + (pl.channel_count || 0), 0)
)

const lastUpdated = computed(() => {
  if (!playlists.value.length) return '-'
  const latest = playlists.value
    .map(pl => new Date(pl.updated_at || pl.created_at))
    .sort((a, b) => b - a)[0]
  return formatDate(latest)
})

// Plan limits
const planLimits = {
  free: { playlists: 3, channels: 500 },
  pro: { playlists: 10, channels: 5000 },
  business: { playlists: 999, channels: 999999 }
}

const currentPlan = computed(() => {
  return authStore.user?.plan || 'free'
})

const maxPlaylists = computed(() => planLimits[currentPlan.value]?.playlists || 3)
const maxChannelsPerPlaylist = computed(() => planLimits[currentPlan.value]?.channels || 500)

const playlistUsagePercent = computed(() => {
  return Math.min((playlists.value.length / maxPlaylists.value) * 100, 100)
})

function getChannelPercent(pl) {
  return Math.min(((pl.channel_count || 0) / maxChannelsPerPlaylist.value) * 100, 100)
}

function hasStreamType(pl, type) {
  if (!pl.xtream_stream_types) return false
  if (Array.isArray(pl.xtream_stream_types)) return pl.xtream_stream_types.includes(type)
  if (typeof pl.xtream_stream_types === 'string') return pl.xtream_stream_types.includes(type)
  return false
}

function getRelativeTime(dateStr) {
  if (!dateStr) return ''
  const now = Date.now()
  const diff = now - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return t('dashboard.justNow')
  if (minutes < 60) return t('dashboard.minutesAgo', { n: minutes })
  if (hours < 24) return t('dashboard.hoursAgo', { n: hours })
  return t('dashboard.daysAgo', { n: days })
}

// Xtream import state
const showXtreamModal = ref(false)
const xtreamForm = ref({ serverUrl: '', username: '', password: '', streamTypes: ['live'] })
const importing = ref(false)
const importResult = ref(null)
const importError = ref('')

onMounted(loadPlaylists)

async function loadPlaylists() {
  loading.value = true
  try {
    const { data } = await api.get('/playlists')
    playlists.value = data
  } catch { toast(t('toast.playlistsLoadError'), 'error') }
  finally { loading.value = false }
}

async function createPlaylist() {
  if (!newName.value.trim()) return
  try {
    await api.post('/playlists', { name: newName.value.trim() })
    newName.value = ''
    showCreate.value = false
    toast(t('toast.playlistCreated'), 'success')
    loadPlaylists()
  } catch (e) { toast(e.response?.data?.error?.message || 'Hata', 'error') }
}

function startEdit(pl) { editingPl.value = pl; editName.value = pl.name }

async function updatePlaylist() {
  if (!editName.value.trim()) return
  try {
    await api.put('/playlists/' + editingPl.value.id, { name: editName.value.trim() })
    editingPl.value = null
    toast(t('toast.updated'), 'success')
    loadPlaylists()
  } catch (e) { toast(e.response?.data?.error?.message || 'Hata', 'error') }
}

function confirmDelete(pl) { deletingPl.value = pl }

async function deletePlaylist() {
  try {
    await api.delete('/playlists/' + deletingPl.value.id)
    deletingPl.value = null
    toast(t('toast.deleted'), 'success')
    loadPlaylists()
  } catch (e) { toast(e.response?.data?.error?.message || 'Hata', 'error') }
}

function formatDate(d) {
  if (!d) return ''
  const locale = localStorage.getItem('app_lang') === 'en' ? 'en-US' : 'tr-TR'
  return new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

// M3U URL parse state
const m3uUrlInput = ref('')
const m3uUrlParsed = ref(false)

function parseM3uUrl() {
  m3uUrlParsed.value = false
  const url = m3uUrlInput.value.trim()
  if (!url) return

  try {
    const parsed = new URL(url)
    const params = parsed.searchParams
    const username = params.get('username')
    const password = params.get('password')

    if (username && password) {
      xtreamForm.value.serverUrl = `${parsed.protocol}//${parsed.host}`
      xtreamForm.value.username = username
      xtreamForm.value.password = password
      m3uUrlParsed.value = true
      return
    }

    const pathParts = parsed.pathname.split('/').filter(Boolean)
    if (pathParts.length >= 3) {
      const startIdx = pathParts[0] === 'live' ? 1 : 0
      if (pathParts.length > startIdx + 1) {
        xtreamForm.value.serverUrl = `${parsed.protocol}//${parsed.host}`
        xtreamForm.value.username = pathParts[startIdx]
        xtreamForm.value.password = pathParts[startIdx + 1]
        m3uUrlParsed.value = true
      }
    }
  } catch {}
}

function openXtream() {
  showXtreamModal.value = true
  importResult.value = null
  importError.value = ''
  xtreamForm.value = { serverUrl: '', username: '', password: '', streamTypes: ['live'] }
  m3uUrlInput.value = ''
  m3uUrlParsed.value = false
}

async function doXtreamImport() {
  importing.value = true; importResult.value = null; importError.value = ''
  try {
    const { data } = await api.post('/import/xtream', xtreamForm.value)
    importResult.value = data
    toast(`${data.totalChannels} ${t('common.channel')} ${t('common.import').toLowerCase()}`, 'success')
    await loadPlaylists()
    setTimeout(() => {
      showXtreamModal.value = false
      if (data.playlistId) {
        router.push('/playlist/' + data.playlistId)
      }
    }, 2000)
  } catch (e) {
    importError.value = e.response?.data?.error?.message || t('toast.connectionError')
  } finally { importing.value = false }
}

// M3U Import
const showM3uImport = ref(false)
const m3uImportForm = ref({ url: '', content: '', name: '' })
const m3uImporting = ref(false)
const m3uImportResult = ref(null)
const m3uImportError = ref('')

function onM3uFileSelect(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => { m3uImportForm.value.content = reader.result }
  reader.readAsText(file)
  if (!m3uImportForm.value.name) {
    m3uImportForm.value.name = file.name.replace(/\.(m3u8?|txt)$/i, '')
  }
}

async function doM3uImport() {
  m3uImporting.value = true; m3uImportResult.value = null; m3uImportError.value = ''
  try {
    const payload = { playlistName: m3uImportForm.value.name || 'M3U Import' }
    if (m3uImportForm.value.content) {
      payload.m3uContent = m3uImportForm.value.content
    } else {
      payload.m3uUrl = m3uImportForm.value.url
    }
    const { data } = await api.post('/import/m3u', payload)
    m3uImportResult.value = data
    toast(t('toast.importSuccess', { channels: data.totalChannels, categories: data.totalCategories, duration: (data.duration / 1000).toFixed(1) }), 'success')
    await loadPlaylists()
    setTimeout(() => {
      showM3uImport.value = false
      if (data.playlistId) router.push('/playlist/' + data.playlistId)
    }, 2000)
  } catch (e) {
    m3uImportError.value = e.response?.data?.error?.message || t('toast.genericError')
  } finally { m3uImporting.value = false }
}
</script>

<style scoped>
.dashboard { padding: 36px 32px; max-width: 1200px; margin: 0 auto; animation: fadeIn 0.3s ease; }
.dash-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; gap: 16px; flex-wrap: wrap; }
.dash-title { font-size: 26px; font-weight: 700; letter-spacing: -0.6px; }
.dash-subtitle { color: var(--text-secondary); font-size: 13px; margin-top: 5px; line-height: 1.5; }

/* Stats bar */
.stats-bar {
  display: flex; align-items: center; gap: 0;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 14px 24px;
  margin-bottom: 16px;
  width: fit-content;
  animation: fadeIn 0.3s ease;
}
.stat-item { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0 20px; }
.stat-item:first-child { padding-left: 0; }
.stat-item:last-child { padding-right: 0; }
.stat-value { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; color: var(--text-primary); }
.stat-label { font-size: 11px; color: var(--text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.4px; }
.stat-sep { width: 1px; height: 36px; background: var(--border-light); flex-shrink: 0; }

/* Plan Usage Bar */
.plan-usage-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 12px 20px;
  margin-bottom: 28px;
  animation: fadeIn 0.3s ease 0.1s both;
}

.plan-usage-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.plan-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 3px 10px;
  border-radius: 12px;
  white-space: nowrap;
}

.plan-free {
  background: rgba(100, 116, 139, 0.15);
  color: #94a3b8;
  border: 1px solid rgba(100, 116, 139, 0.2);
}

.plan-pro {
  background: rgba(99, 102, 241, 0.15);
  color: #a5b4fc;
  border: 1px solid rgba(99, 102, 241, 0.25);
}

.plan-business {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.plan-usage-text {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
  white-space: nowrap;
}

.plan-progress-wrap {
  flex: 1;
  max-width: 200px;
  height: 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  overflow: hidden;
}

.plan-progress-bar {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 0.5s ease;
}

.plan-progress-bar.warn {
  background: #f59e0b;
}

.plan-upgrade-btn {
  gap: 6px;
  color: var(--accent) !important;
  white-space: nowrap;
}

/* Skeleton grid */
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.skeleton.skeleton-card { height: 168px; }
.playlist-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.pl-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 22px; cursor: pointer;
  transition: all var(--transition); animation: fadeIn 0.3s ease;
  position: relative; overflow: hidden;
}
.pl-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, var(--accent), #7c3aed);
  opacity: 0; transition: opacity var(--transition);
}
.pl-card:hover {
  border-color: rgba(99,102,241,0.35);
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(99,102,241,0.1);
}
.pl-card:hover::before { opacity: 1; }
.pl-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.pl-icon {
  width: 42px; height: 42px;
  background: linear-gradient(135deg, var(--accent-soft) 0%, rgba(124,58,237,0.12) 100%);
  border-radius: 11px;
  border: 1px solid rgba(99,102,241,0.15);
  display: flex; align-items: center; justify-content: center;
  color: var(--accent-hover);
  transition: all var(--transition);
}
.pl-card:hover .pl-icon {
  background: linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(124,58,237,0.18) 100%);
  border-color: rgba(99,102,241,0.25);
}
.pl-card-menu { display: flex; gap: 2px; opacity: 0; transition: opacity var(--transition); }
.pl-card:hover .pl-card-menu { opacity: 1; }
.pl-name { font-size: 16px; font-weight: 600; margin-bottom: 10px; letter-spacing: -0.2px; }

/* Channel progress */
.pl-channel-progress {
  margin-bottom: 12px;
}

.pl-progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}

.pl-progress-header span {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

.pl-progress-track {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  overflow: hidden;
}

.pl-progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.5s ease;
  min-width: 2px;
}

.pl-progress-fill.warn {
  background: #f59e0b;
}

/* Stream type badges */
.badge-stream {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 8px;
  border-radius: 10px;
}

.badge-live {
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.badge-vod {
  background: rgba(59, 130, 246, 0.12);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.badge-series {
  background: rgba(168, 85, 247, 0.12);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.2);
}

.pl-meta { display: flex; gap: 8px; flex-wrap: wrap; }
.pl-card-footer {
  margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border);
  display: flex; align-items: center; gap: 6px;
}
.pl-time-ago {
  font-size: 11px;
  color: var(--text-muted);
  opacity: 0.7;
}
.pl-open-label { font-size: 12px; font-weight: 500; color: var(--text-muted); transition: color var(--transition); flex: 1; text-align: right; }
.pl-arrow-icon { color: var(--text-muted); transition: all var(--transition); }
.pl-card:hover .pl-open-label { color: var(--accent-hover); }
.pl-card:hover .pl-arrow-icon { color: var(--accent-hover); transform: translateX(3px); }

/* Empty State & Onboarding */
.empty-state {
  text-align: center; padding: 80px 20px;
  animation: fadeIn 0.4s ease;
}
.empty-icon {
  width: 88px; height: 88px; margin: 0 auto 24px;
  background: linear-gradient(135deg, var(--accent-soft) 0%, rgba(124,58,237,0.1) 100%);
  border-radius: 24px;
  border: 1px solid rgba(99,102,241,0.15);
  display: flex; align-items: center; justify-content: center;
  color: var(--accent-hover);
  box-shadow: 0 8px 32px rgba(99,102,241,0.1);
}
.empty-state h3 { font-size: 20px; font-weight: 700; margin-bottom: 10px; letter-spacing: -0.3px; }
.empty-state p { color: var(--text-secondary); font-size: 14px; max-width: 380px; margin: 0 auto; line-height: 1.6; }

/* Onboarding steps */
.onboard-steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 36px auto 32px;
  max-width: 700px;
}

.onboard-step {
  flex: 1;
  max-width: 200px;
  padding: 20px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  position: relative;
  transition: all 0.2s ease;
}

.onboard-step:hover {
  border-color: rgba(99,102,241,0.3);
  transform: translateY(-2px);
}

.onboard-num {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 22px;
  height: 22px;
  background: var(--accent);
  color: white;
  font-size: 11px;
  font-weight: 700;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(99,102,241,0.3);
}

.onboard-icon {
  width: 44px;
  height: 44px;
  margin: 8px auto 12px;
  background: linear-gradient(135deg, var(--accent-soft) 0%, rgba(124,58,237,0.1) 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-hover);
}

.onboard-step h4 {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 4px;
  color: var(--text-primary);
}

.onboard-step p {
  font-size: 11.5px;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0;
  max-width: none;
}

.onboard-connector {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.onboard-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
  backdrop-filter: blur(4px);
}
.modal {
  background: var(--bg-secondary); border: 1px solid var(--border-light);
  border-radius: var(--radius-xl); padding: 28px; width: 90%; max-width: 460px;
  box-shadow: var(--shadow-lg), 0 0 0 1px rgba(255,255,255,0.03);
  animation: fadeInScale 0.25s ease;
}
.modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.modal-header h3 { font-size: 17px; font-weight: 600; }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 24px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
.delete-warning {
  display: flex; gap: 12px; align-items: flex-start;
  background: var(--danger-soft); border: 1px solid rgba(239,68,68,0.15);
  border-radius: var(--radius); padding: 14px; color: #fca5a5; font-size: 13px;
}
.delete-warning svg { flex-shrink: 0; margin-top: 1px; }
.delete-warning strong { color: var(--text-primary); }

.modal-enter-active { transition: all 0.25s ease; }
.modal-leave-active { transition: all 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal, .modal-leave-to .modal { transform: scale(0.95) translateY(10px); }

.result-box {
  display: flex; align-items: center; gap: 10px; padding: 12px 14px;
  border-radius: var(--radius); font-size: 13px; margin-top: 12px;
}
.result-box.success { background: var(--success-soft, rgba(16,185,129,0.1)); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.2); }
.result-box.error { background: var(--danger-soft, rgba(239,68,68,0.1)); color: #fca5a5; border: 1px solid rgba(239,68,68,0.2); }

.parse-success { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #6ee7b7; margin-top: 6px; }
.parse-error { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); margin-top: 6px; }
.url-divider { display: flex; align-items: center; gap: 12px; margin: 8px 0 16px; }
.url-divider::before, .url-divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
.url-divider span { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }

.stream-type-group { display: flex; gap: 16px; margin-top: 4px; }
.stream-type-label { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; color: var(--text-secondary); }
.stream-type-label input[type="checkbox"] { accent-color: var(--accent); }

/* Responsive */
@media (max-width: 640px) {
  .onboard-steps {
    flex-direction: column;
    gap: 12px;
  }
  .onboard-connector {
    transform: rotate(90deg);
  }
  .onboard-step {
    max-width: 100%;
  }
  .plan-usage-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .plan-usage-left {
    flex-wrap: wrap;
  }
  .plan-progress-wrap {
    max-width: 100%;
    width: 100%;
  }
}
</style>
