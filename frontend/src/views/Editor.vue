<template>
  <div class="editor" v-if="!pageLoading">
    <div class="editor-body">
      <!-- Left nav sidebar -->
      <nav class="nav-sidebar">
        <div class="nav-section">
          <div class="nav-section-header" @click="navChannelsOpen = !navChannelsOpen">
            <span class="nav-icon">📺</span>
            <span class="nav-section-title">Kanallar</span>
            <svg :class="['nav-chevron', { open: navChannelsOpen }]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div v-if="navChannelsOpen" class="nav-items">
            <div :class="['nav-item', { active: activeView === 'basic' }]" @click="activeView = 'basic'">
              <span class="nav-item-icon">✏️</span> Kanal Editörü
            </div>
            <div :class="['nav-item', { active: activeView === 'sort' }]" @click="activeView = 'sort'">
              <span class="nav-item-icon">↕️</span> Sıralama
            </div>
            <div :class="['nav-item', { active: activeView === 'logo' }]" @click="activeView = 'logo'">
              <span class="nav-item-icon">🖼️</span> Logo Editörü
            </div>
            <div :class="['nav-item', { active: activeView === 'epg' }]" @click="activeView = 'epg'">
              <span class="nav-item-icon">📅</span> EPG Editörü
            </div>
            <div :class="['nav-item', { active: activeView === 'category' }]" @click="activeView = 'category'">
              <span class="nav-item-icon">📁</span> Kategori Editörü
            </div>
            <div :class="['nav-item', { active: activeView === 'update' }]" @click="activeView = 'update'">
              <span class="nav-item-icon">🔄</span> Güncelle
            </div>
          </div>
        </div>
        <div class="nav-bottom">
          <div class="nav-item" @click="$router.push('/dashboard')">
            <span class="nav-item-icon">←</span> Dashboard
          </div>
          <div class="nav-item" @click="doExport">
            <span class="nav-item-icon">📥</span> M3U İndir
          </div>
          <div class="nav-item" @click="doShare">
            <span class="nav-item-icon">🔗</span> Paylaş
          </div>
        </div>
      </nav>

      <!-- Main content area -->
      <div class="main-area">
        <!-- Top bar -->
        <div class="top-bar">
          <div class="top-bar-left">
            <h2 class="playlist-title">{{ playlistName }}</h2>
            <span class="channel-count-badge">{{ totalChannelCount }} kanal</span>
          </div>
          <div class="top-bar-right">
            <div class="search-box">
              <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input class="search-input" v-model="search" placeholder="Kanal ara..." @input="debouncedSearch" />
            </div>
            <button class="btn btn-secondary btn-sm" @click="openXtream">
              <span>📡</span> Xtream İçe Aktar
            </button>
          </div>
        </div>

        <div class="content-split">
          <!-- Center: accordion categories + channels -->
          <div class="center-panel">
            <!-- BASIC EDITOR VIEW -->
            <template v-if="activeView === 'basic'">
              <div v-if="selectedIds.size > 0" class="bulk-bar">
                <span class="badge badge-accent">{{ selectedIds.size }} seçili</span>
                <button class="btn btn-secondary btn-xs" @click="showBulkMove = true">Taşı</button>
                <button class="btn btn-danger btn-xs" @click="bulkDelete">Sil</button>
              </div>
              <div v-if="channelsLoading" class="center-loading"><span class="spinner"></span></div>
              <div v-else-if="channels.length === 0 && !search" class="center-empty">
                <p>Henüz kanal yok. Xtream ile içe aktar.</p>
              </div>
              <div v-else-if="channels.length === 0 && search" class="center-empty">
                <p>Sonuç bulunamadı</p>
              </div>
              <div v-else class="accordion-list">
                <!-- Tüm Kanallar (when no category filter) -->
                <div v-if="!selectedCatId" class="accordion-group" v-for="cat in categoriesWithChannels" :key="cat.id">
                  <div class="accordion-header" @click="toggleAccordion(cat.id)">
                    <svg :class="['acc-arrow', { open: openAccordions.has(cat.id) }]" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    <span class="acc-title">{{ cat.name }}</span>
                    <span class="acc-count">({{ cat.channel_count || 0 }})</span>
                  </div>
                  <div v-if="openAccordions.has(cat.id)" class="accordion-body">
                    <div v-if="!accChannels[cat.id]" class="acc-loading"><span class="spinner-sm"></span></div>
                    <table v-else-if="accChannels[cat.id].length" class="ch-table">
                      <thead>
                        <tr>
                          <th class="th-check"><input type="checkbox" @change="toggleSelectCat(cat.id)" :checked="isCatAllSelected(cat.id)" /></th>
                          <th class="th-num">#</th>
                          <th class="th-name">Ad</th>
                          <th class="th-url">URL</th>
                          <th class="th-epg">EPG</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="(ch, idx) in accChannels[cat.id]" :key="ch.id"
                          :class="{ selected: selectedIds.has(ch.id), editing: editingChannel?.id === ch.id }"
                          @click="startEditChannel(ch)">
                          <td class="td-check" @click.stop><input type="checkbox" :checked="selectedIds.has(ch.id)" @change="toggleSelect(ch.id)" /></td>
                          <td class="td-num">{{ idx + 1 }}</td>
                          <td class="td-name">
                            <div class="ch-name-cell">
                              <img v-if="ch.logo_url" :src="ch.logo_url" class="row-logo" @error="$event.target.style.display='none'" />
                              <span v-else class="row-logo-fb">📺</span>
                              <span>{{ ch.name }}</span>
                            </div>
                          </td>
                          <td class="td-url"><span class="url-text">{{ shortenUrl(ch.stream_url) }}</span></td>
                          <td class="td-epg">{{ ch.epg_channel_id || '-' }}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div v-else class="acc-empty">Bu kategoride kanal yok</div>
                  </div>
                </div>
                <!-- Filtered by category -->
                <div v-if="selectedCatId">
                  <table class="ch-table">
                    <thead>
                      <tr>
                        <th class="th-check"><input type="checkbox" @change="toggleSelectAll" :checked="allSelected" /></th>
                        <th class="th-num">#</th>
                        <th class="th-name">Ad</th>
                        <th class="th-url">URL</th>
                        <th class="th-epg">EPG</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(ch, idx) in channels" :key="ch.id"
                        :class="{ selected: selectedIds.has(ch.id), editing: editingChannel?.id === ch.id }"
                        @click="startEditChannel(ch)">
                        <td class="td-check" @click.stop><input type="checkbox" :checked="selectedIds.has(ch.id)" @change="toggleSelect(ch.id)" /></td>
                        <td class="td-num">{{ (page - 1) * 50 + idx + 1 }}</td>
                        <td class="td-name">
                          <div class="ch-name-cell">
                            <img v-if="ch.logo_url" :src="ch.logo_url" class="row-logo" @error="$event.target.style.display='none'" />
                            <span v-else class="row-logo-fb">📺</span>
                            <span>{{ ch.name }}</span>
                          </div>
                        </td>
                        <td class="td-url"><span class="url-text">{{ shortenUrl(ch.stream_url) }}</span></td>
                        <td class="td-epg">{{ ch.epg_channel_id || '-' }}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div v-if="totalPages > 1" class="ch-pagination">
                    <button class="btn btn-secondary btn-sm" :disabled="page <= 1" @click="page--; loadChannels()">←</button>
                    <span class="page-info">{{ page }} / {{ totalPages }}</span>
                    <button class="btn btn-secondary btn-sm" :disabled="page >= totalPages" @click="page++; loadChannels()">→</button>
                  </div>
                </div>
              </div>
            </template>

            <!-- SORT VIEW -->
            <template v-if="activeView === 'sort'">
              <div class="view-header">
                <h3>Kanal Sıralama</h3>
                <p class="view-desc">Kategorileri sürükleyerek sıralayabilirsin</p>
              </div>
              <div class="sort-list">
                <div v-for="(cat, idx) in categories" :key="cat.id" class="sort-item"
                  draggable="true" @dragstart="sortDragIdx = idx" @dragover.prevent @drop="catDrop(idx)">
                  <span class="sort-handle">⠿</span>
                  <span class="sort-name">{{ cat.name }}</span>
                  <span class="sort-count">{{ cat.channel_count || 0 }} kanal</span>
                </div>
              </div>
            </template>

            <!-- LOGO EDITOR VIEW -->
            <template v-if="activeView === 'logo'">
              <div class="view-header">
                <h3>Logo Editörü</h3>
                <p class="view-desc">Kanal logolarını toplu düzenle</p>
              </div>
              <div class="logo-grid">
                <div v-for="ch in channels" :key="ch.id" class="logo-card" @click="startEditChannel(ch)">
                  <div class="logo-card-img">
                    <img v-if="ch.logo_url" :src="ch.logo_url" @error="$event.target.style.display='none'" />
                    <span v-else class="logo-card-fb">📺</span>
                  </div>
                  <span class="logo-card-name">{{ ch.name }}</span>
                </div>
              </div>
              <div v-if="totalPages > 1" class="ch-pagination">
                <button class="btn btn-secondary btn-sm" :disabled="page <= 1" @click="page--; loadChannels()">←</button>
                <span class="page-info">{{ page }} / {{ totalPages }}</span>
                <button class="btn btn-secondary btn-sm" :disabled="page >= totalPages" @click="page++; loadChannels()">→</button>
              </div>
            </template>

            <!-- EPG EDITOR VIEW -->
            <template v-if="activeView === 'epg'">
              <div class="view-header">
                <h3>EPG Editörü</h3>
                <p class="view-desc">EPG kaynaklarını yönet ve kanallarla eşleştir</p>
              </div>
              <div class="epg-section">
                <div class="epg-add-row">
                  <input class="input" v-model="newEpgUrl" placeholder="https://epg-source.com/guide.xml" style="flex:1" />
                  <button class="btn btn-primary btn-sm" @click="addEpgSource" :disabled="addingEpg || !newEpgUrl.trim()">
                    <span v-if="addingEpg" class="spinner" style="width:14px;height:14px"></span>
                    EPG Ekle
                  </button>
                </div>
                <div v-if="epgSources.length" class="epg-source-list">
                  <div v-for="s in epgSources" :key="s.id" class="epg-source-item">
                    <span class="epg-source-url">{{ s.url }}</span>
                    <span class="epg-source-date">{{ formatDate(s.last_fetched_at || s.created_at) }}</span>
                  </div>
                </div>
                <div v-else class="epg-no-source">Henüz EPG kaynağı eklenmedi</div>
                <div class="epg-actions-row">
                  <button class="btn btn-secondary btn-sm" @click="doAutoMatch" :disabled="autoMatching">
                    <span v-if="autoMatching" class="spinner" style="width:14px;height:14px"></span>
                    🔗 Otomatik EPG Eşleştir
                  </button>
                  <span v-if="matchResult" class="badge badge-success">{{ matchResult.matched }} eşleştirildi</span>
                </div>
              </div>
              <!-- EPG Calendar / Program Guide -->
              <div class="epg-calendar">
                <div class="view-header" style="margin-top:20px">
                  <h3>📅 EPG Program Rehberi</h3>
                  <p class="view-desc">Kanal seçerek yayın akışını görüntüle</p>
                </div>
                <div class="epg-channel-select">
                  <select class="input" v-model="epgSelectedChannelId" @change="loadEpgPrograms">
                    <option :value="null">Kanal seçin...</option>
                    <option v-for="ch in channels" :key="ch.id" :value="ch.id">{{ ch.name }}</option>
                  </select>
                </div>
                <div v-if="epgPrograms.length" class="epg-timeline">
                  <div v-for="p in epgPrograms" :key="p.id" class="epg-program">
                    <div class="epg-prog-time">{{ formatTime(p.start_time) }} - {{ formatTime(p.end_time) }}</div>
                    <div class="epg-prog-title">{{ p.title }}</div>
                    <div v-if="p.description" class="epg-prog-desc">{{ p.description }}</div>
                  </div>
                </div>
                <div v-else-if="epgSelectedChannelId" class="epg-no-data">Bu kanal için EPG verisi bulunamadı</div>
              </div>
            </template>

            <!-- CATEGORY EDITOR VIEW -->
            <template v-if="activeView === 'category'">
              <div class="view-header">
                <h3>Kategori Editörü</h3>
                <div class="view-header-actions">
                  <button class="btn btn-primary btn-sm" @click="showCatCreate = true">+ Yeni Kategori</button>
                </div>
              </div>
              <div class="cat-editor-list">
                <div v-for="cat in categories" :key="cat.id" class="cat-editor-item">
                  <span class="cat-editor-icon">📁</span>
                  <span class="cat-editor-name">{{ cat.name }}</span>
                  <span class="cat-editor-count">{{ cat.channel_count || 0 }} kanal</span>
                  <div class="cat-editor-actions">
                    <button class="btn btn-ghost btn-xs" @click="startEditCat(cat)">✏️ Düzenle</button>
                    <button class="btn btn-ghost btn-xs" style="color:var(--danger)" @click="confirmDeleteCat(cat)">🗑 Sil</button>
                  </div>
                </div>
              </div>
            </template>

            <!-- UPDATE VIEW -->
            <template v-if="activeView === 'update'">
              <div class="view-header">
                <h3>Güncelle</h3>
                <p class="view-desc">Xtream Codes kaynağından kanalları yeniden çek</p>
              </div>
              <div class="update-panel">
                <button class="btn btn-primary" @click="openXtream" style="width:100%">
                  📡 Xtream Codes İçe Aktar / Güncelle
                </button>
                <div class="update-info">
                  <div class="update-stat">
                    <span class="update-stat-label">Toplam Kanal</span>
                    <span class="update-stat-value">{{ totalChannelCount }}</span>
                  </div>
                  <div class="update-stat">
                    <span class="update-stat-label">Kategori</span>
                    <span class="update-stat-value">{{ categories.length }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Right: Edit panel (always visible) -->
          <aside class="edit-panel" v-if="editingChannel">
            <div class="ep-header">
              <h3>Kanal Düzenle</h3>
              <button class="btn btn-ghost btn-icon-sm" @click="editingChannel = null">✕</button>
            </div>
            <div class="ep-body">
              <div class="ep-logo-area">
                <div v-if="editForm.logo_url" class="ep-logo-preview">
                  <img :src="editForm.logo_url" @error="$event.target.style.display='none'" />
                </div>
                <div v-else class="ep-logo-placeholder">📺</div>
              </div>
              <div class="ep-form">
                <div class="form-group"><label>Kanal Adı</label><input class="input" v-model="editForm.name" /></div>
                <div class="form-row">
                  <div class="form-group" style="flex:1"><label>EPG ID</label><input class="input" v-model="editForm.epg_channel_id" placeholder="Opsiyonel" /></div>
                </div>
                <div class="form-group"><label>Logo URL</label><input class="input" v-model="editForm.logo_url" placeholder="https://..." /></div>
                <div class="form-group"><label>Stream URL</label><input class="input" v-model="editForm.stream_url" /></div>
                <div class="form-group"><label>Kategori</label>
                  <select class="input" v-model="editForm.category_id">
                    <option :value="null">Kategorisiz</option>
                    <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
                  </select>
                </div>
              </div>
              <div class="ep-btn-row">
                <button class="btn btn-success" @click="saveChannel" style="flex:1">💾 Kaydet</button>
                <button class="btn btn-danger" @click="deleteChannel(editingChannel)" style="flex:1">🗑 Sil</button>
              </div>
            </div>
          </aside>
          <aside class="edit-panel edit-panel-empty" v-else>
            <div class="ep-empty">
              <div class="ep-empty-icon">📺</div>
              <p>Düzenlemek için bir kanal seçin</p>
              <span class="ep-empty-hint">{{ totalChannelCount }} kanal mevcut</span>
            </div>
          </aside>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <Teleport to="body">
      <div v-if="showXtreamModal" class="modal-overlay" @click.self="showXtreamModal = false">
        <div class="modal" style="max-width:500px">
          <div class="modal-header"><h3>Xtream Codes İçe Aktar</h3>
            <button class="btn btn-ghost btn-icon-sm" @click="showXtreamModal = false">✕</button>
          </div>
          <div class="form-group"><label>Sunucu URL</label><input class="input" v-model="xtreamForm.serverUrl" placeholder="http://example.com:8080" /></div>
          <div class="form-group"><label>Kullanıcı Adı</label><input class="input" v-model="xtreamForm.username" /></div>
          <div class="form-group"><label>Şifre</label><input class="input" type="password" v-model="xtreamForm.password" /></div>
          <div v-if="importResult" class="result-box success">
            {{ importResult.totalChannels }} kanal, {{ importResult.totalCategories }} kategori içe aktarıldı ({{ (importResult.duration / 1000).toFixed(1) }}s)
          </div>
          <div v-if="importError" class="result-box error">{{ importError }}</div>
          <div class="modal-actions">
            <button class="btn btn-secondary" @click="showXtreamModal = false">Kapat</button>
            <button class="btn btn-primary" @click="doXtreamImport" :disabled="importing || !xtreamForm.serverUrl || !xtreamForm.username || !xtreamForm.password">
              <span v-if="importing" class="spinner" style="width:14px;height:14px"></span>
              {{ importing ? 'İçe aktarılıyor...' : 'İçe Aktar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="showBulkMove" class="modal-overlay" @click.self="showBulkMove = false">
        <div class="modal">
          <div class="modal-header"><h3>Kanalları Taşı</h3><button class="btn btn-ghost btn-icon-sm" @click="showBulkMove = false">✕</button></div>
          <div class="form-group"><label>Hedef Kategori</label>
            <select class="input" v-model="bulkTargetCat">
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" @click="showBulkMove = false">İptal</button>
            <button class="btn btn-primary" @click="doBulkMove" :disabled="!bulkTargetCat">Taşı</button>
          </div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="showCatCreate" class="modal-overlay" @click.self="showCatCreate = false">
        <div class="modal">
          <div class="modal-header"><h3>Yeni Kategori</h3><button class="btn btn-ghost btn-icon-sm" @click="showCatCreate = false">✕</button></div>
          <div class="form-group"><label>Kategori Adı</label><input class="input" v-model="newCatName" @keyup.enter="createCategory" autofocus /></div>
          <div class="modal-actions"><button class="btn btn-secondary" @click="showCatCreate = false">İptal</button><button class="btn btn-primary" @click="createCategory" :disabled="!newCatName.trim()">Oluştur</button></div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="editingCat" class="modal-overlay" @click.self="editingCat = null">
        <div class="modal">
          <div class="modal-header"><h3>Kategori Düzenle</h3><button class="btn btn-ghost btn-icon-sm" @click="editingCat = null">✕</button></div>
          <div class="form-group"><label>Kategori Adı</label><input class="input" v-model="editCatName" @keyup.enter="updateCategory" /></div>
          <div class="modal-actions"><button class="btn btn-secondary" @click="editingCat = null">İptal</button><button class="btn btn-primary" @click="updateCategory" :disabled="!editCatName.trim()">Kaydet</button></div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="deletingCat" class="modal-overlay" @click.self="deletingCat = null">
        <div class="modal">
          <div class="modal-header"><h3>Kategori Sil</h3><button class="btn btn-ghost btn-icon-sm" @click="deletingCat = null">✕</button></div>
          <p style="font-size:13px;color:var(--text-secondary)">"{{ deletingCat.name }}" kategorisini silmek istediğine emin misin?</p>
          <div class="modal-actions"><button class="btn btn-secondary" @click="deletingCat = null">İptal</button><button class="btn btn-danger" @click="doDeleteCat">Sil</button></div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="shareUrl" class="modal-overlay" @click.self="shareUrl = null">
        <div class="modal">
          <div class="modal-header"><h3>Paylaşım Linki</h3><button class="btn btn-ghost btn-icon-sm" @click="shareUrl = null">✕</button></div>
          <div class="form-group"><input class="input" :value="shareUrl" readonly @click="$event.target.select()" /></div>
          <p style="font-size:12px;color:var(--text-muted)">Bu linki IPTV oynatıcına ekleyebilirsin.</p>
          <div class="modal-actions"><button class="btn btn-primary" @click="copyShare">Kopyala</button><button class="btn btn-secondary" @click="shareUrl = null">Kapat</button></div>
        </div>
      </div>
    </Teleport>
  </div>
  <div v-else class="editor-loading"><span class="spinner spinner-lg"></span></div>
</template>

<script setup>
import { ref, reactive, onMounted, inject, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api'

const route = useRoute()
const toast = inject('toast')
const playlistId = route.params.id

const pageLoading = ref(true)
const playlistName = ref('')
const categories = ref([])
const channels = ref([])
const channelsLoading = ref(false)
const selectedCatId = ref(null)
const search = ref('')
const page = ref(1)
const totalPages = ref(1)
const totalChannelCount = ref(0)
const tableTotal = ref(0)
const selectedIds = ref(new Set())
const editingChannel = ref(null)
const editForm = ref({})

// Nav
const activeView = ref('basic')
const navChannelsOpen = ref(true)

// Accordion
const openAccordions = ref(new Set())
const accChannels = reactive({})
const categoriesWithChannels = computed(() => categories.value)

// Sort
let sortDragIdx = null

// Category editor
const showCatCreate = ref(false)
const newCatName = ref('')
const editingCat = ref(null)
const editCatName = ref('')
const deletingCat = ref(null)

// Xtream
const showXtreamModal = ref(false)
const xtreamForm = ref({ serverUrl: '', username: '', password: '' })
const importing = ref(false)
const importResult = ref(null)
const importError = ref('')

// EPG
const epgSources = ref([])
const newEpgUrl = ref('')
const addingEpg = ref(false)
const autoMatching = ref(false)
const matchResult = ref(null)
const epgSelectedChannelId = ref(null)
const epgPrograms = ref([])

// Bulk
const showBulkMove = ref(false)
const bulkTargetCat = ref(null)
const shareUrl = ref(null)

let searchTimer = null

const allSelected = computed(() => channels.value.length > 0 && channels.value.every(ch => selectedIds.value.has(ch.id)))

onMounted(async () => {
  try {
    const [plRes, catRes] = await Promise.all([
      api.get('/playlists'),
      api.get(`/playlists/${playlistId}/categories`)
    ])
    const pl = plRes.data.find(p => String(p.id) === String(playlistId))
    playlistName.value = pl?.name || 'Playlist'
    categories.value = catRes.data
    await loadChannels()
    await loadTotalCount()
  } catch { toast('Yüklenirken hata oluştu', 'error') }
  finally { pageLoading.value = false }
})

// Load EPG sources when switching to epg view
watch(activeView, v => { if (v === 'epg') loadEpgSources() })

async function loadChannels() {
  channelsLoading.value = true
  try {
    const params = { page: page.value, limit: 50 }
    if (search.value) params.search = search.value
    if (selectedCatId.value) params.categoryId = selectedCatId.value
    const { data } = await api.get(`/playlists/${playlistId}/channels`, { params })
    channels.value = data.channels || data
    totalPages.value = data.totalPages || 1
    tableTotal.value = data.total || channels.value.length
    if (!selectedCatId.value && !search.value) totalChannelCount.value = data.total || channels.value.length
  } catch { toast('Kanallar yüklenemedi', 'error') }
  finally { channelsLoading.value = false }
}

async function loadTotalCount() {
  try {
    const { data } = await api.get(`/playlists/${playlistId}/channels`, { params: { page: 1, limit: 1 } })
    totalChannelCount.value = data.total || 0
  } catch {}
}

async function loadCategories() {
  try { const { data } = await api.get(`/playlists/${playlistId}/categories`); categories.value = data } catch {}
}

async function loadAccChannels(catId) {
  try {
    const { data } = await api.get(`/playlists/${playlistId}/channels`, { params: { categoryId: catId, limit: 500 } })
    accChannels[catId] = data.channels || data
  } catch { accChannels[catId] = [] }
}

function toggleAccordion(catId) {
  const s = new Set(openAccordions.value)
  if (s.has(catId)) { s.delete(catId) } else { s.add(catId); if (!accChannels[catId]) loadAccChannels(catId) }
  openAccordions.value = s
}

function selectCategory(id) {
  selectedCatId.value = id; page.value = 1; selectedIds.value = new Set(); editingChannel.value = null; loadChannels()
}

function debouncedSearch() { clearTimeout(searchTimer); searchTimer = setTimeout(() => { page.value = 1; loadChannels() }, 300) }
function toggleSelect(id) { const s = new Set(selectedIds.value); if (s.has(id)) s.delete(id); else s.add(id); selectedIds.value = s }
function toggleSelectAll() { if (allSelected.value) selectedIds.value = new Set(); else selectedIds.value = new Set(channels.value.map(ch => ch.id)) }
function toggleSelectCat(catId) {
  const chs = accChannels[catId] || []
  const allIn = chs.every(ch => selectedIds.value.has(ch.id))
  const s = new Set(selectedIds.value)
  if (allIn) { chs.forEach(ch => s.delete(ch.id)) } else { chs.forEach(ch => s.add(ch.id)) }
  selectedIds.value = s
}
function isCatAllSelected(catId) { const chs = accChannels[catId] || []; return chs.length > 0 && chs.every(ch => selectedIds.value.has(ch.id)) }

function shortenUrl(url) { if (!url) return '-'; try { return url.length > 60 ? '...' + url.slice(-50) : url } catch { return url } }

function startEditChannel(ch) {
  editingChannel.value = ch
  editForm.value = { name: ch.name, logo_url: ch.logo_url || '', epg_channel_id: ch.epg_channel_id || '', category_id: ch.category_id || null, stream_url: ch.stream_url || '' }
}

async function saveChannel() {
  try {
    await api.put(`/channels/${editingChannel.value.id}`, editForm.value)
    toast('Kanal güncellendi', 'success'); editingChannel.value = null
    loadChannels(); loadCategories(); loadTotalCount()
    for (const catId of openAccordions.value) loadAccChannels(catId)
  } catch (e) { toast(e.response?.data?.error?.message || 'Hata', 'error') }
}

async function deleteChannel(ch) {
  if (!confirm(`"${ch.name}" kanalını silmek istediğine emin misin?`)) return
  try {
    await api.delete(`/channels/${ch.id}`)
    if (editingChannel.value?.id === ch.id) editingChannel.value = null
    toast('Silindi', 'success'); loadChannels(); loadCategories(); loadTotalCount()
    for (const catId of openAccordions.value) loadAccChannels(catId)
  } catch { toast('Silinemedi', 'error') }
}

async function bulkDelete() {
  if (!confirm(`${selectedIds.value.size} kanalı silmek istediğine emin misin?`)) return
  try {
    for (const id of selectedIds.value) await api.delete(`/channels/${id}`)
    selectedIds.value = new Set(); toast('Silindi', 'success')
    loadChannels(); loadCategories(); loadTotalCount()
    for (const catId of openAccordions.value) loadAccChannels(catId)
  } catch { toast('Hata', 'error') }
}

async function doBulkMove() {
  try {
    await api.post('/channels/bulk', { action: 'move', channelIds: [...selectedIds.value], targetCategoryId: bulkTargetCat.value })
    showBulkMove.value = false; selectedIds.value = new Set(); toast('Taşındı', 'success')
    loadChannels(); loadCategories()
    for (const catId of openAccordions.value) loadAccChannels(catId)
  } catch (e) { toast(e.response?.data?.error?.message || 'Hata', 'error') }
}

async function createCategory() {
  if (!newCatName.value.trim()) return
  try { await api.post(`/playlists/${playlistId}/categories`, { name: newCatName.value.trim() }); newCatName.value = ''; showCatCreate.value = false; toast('Oluşturuldu', 'success'); loadCategories() }
  catch (e) { toast(e.response?.data?.error?.message || 'Hata', 'error') }
}
function startEditCat(cat) { editingCat.value = cat; editCatName.value = cat.name }
async function updateCategory() {
  if (!editCatName.value.trim()) return
  try { await api.put(`/categories/${editingCat.value.id}`, { name: editCatName.value.trim() }); editingCat.value = null; toast('Güncellendi', 'success'); loadCategories() }
  catch (e) { toast(e.response?.data?.error?.message || 'Hata', 'error') }
}
function confirmDeleteCat(cat) { deletingCat.value = cat }
async function doDeleteCat() {
  try { await api.delete(`/categories/${deletingCat.value.id}`); if (selectedCatId.value === deletingCat.value?.id) selectedCatId.value = null; deletingCat.value = null; toast('Silindi', 'success'); loadCategories(); loadChannels() }
  catch (e) { toast(e.response?.data?.error?.message || 'Hata', 'error') }
}

async function catDrop(idx) {
  if (sortDragIdx === null || sortDragIdx === idx) return
  const cat = categories.value[sortDragIdx]
  try { await api.put(`/categories/${cat.id}/order`, { newPosition: idx }); loadCategories() }
  catch { toast('Sıralama hatası', 'error') }
  sortDragIdx = null
}

function openXtream() { showXtreamModal.value = true; importResult.value = null; importError.value = '' }
async function doXtreamImport() {
  importing.value = true; importResult.value = null; importError.value = ''
  try {
    const { data } = await api.post(`/playlists/${playlistId}/import/xtream`, xtreamForm.value)
    importResult.value = data; toast(`${data.totalChannels} kanal içe aktarıldı`, 'success')
    loadCategories(); loadChannels(); loadTotalCount()
    for (const catId of openAccordions.value) loadAccChannels(catId)
  } catch (e) { importError.value = e.response?.data?.error?.message || 'Bağlantı hatası.' }
  finally { importing.value = false }
}

async function loadEpgSources() { try { const { data } = await api.get('/epg/sources'); epgSources.value = data } catch {} }
async function addEpgSource() {
  if (!newEpgUrl.value.trim()) return; addingEpg.value = true
  try { const { data } = await api.post('/epg/sources', { url: newEpgUrl.value.trim() }); toast(`EPG eklendi: ${data.channelCount} kanal`, 'success'); newEpgUrl.value = ''; loadEpgSources() }
  catch (e) { toast(e.response?.data?.error?.message || 'EPG hatası', 'error') }
  finally { addingEpg.value = false }
}
async function doAutoMatch() {
  autoMatching.value = true
  try { const { data } = await api.post(`/playlists/${playlistId}/epg/auto-match`); matchResult.value = data; toast(`${data.matched} eşleştirildi`, 'success') }
  catch { toast('Eşleştirme hatası', 'error') }
  finally { autoMatching.value = false }
}
async function loadEpgPrograms() {
  if (!epgSelectedChannelId.value) { epgPrograms.value = []; return }
  try { const { data } = await api.get(`/channels/${epgSelectedChannelId.value}/epg/preview`); epgPrograms.value = data }
  catch { epgPrograms.value = [] }
}

async function doExport() {
  try {
    const { data } = await api.get(`/playlists/${playlistId}/export`, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([data])); const a = document.createElement('a'); a.href = url; a.download = 'playlist.m3u'; a.click(); URL.revokeObjectURL(url)
    toast('M3U indirildi', 'success')
  } catch { toast('İndirme hatası', 'error') }
}
async function doShare() {
  try { const { data } = await api.post(`/playlists/${playlistId}/share`); shareUrl.value = window.location.origin + '/api/shared/' + data.token }
  catch (e) { toast(e.response?.data?.error?.message || 'Paylaşım hatası', 'error') }
}
function copyShare() { navigator.clipboard.writeText(shareUrl.value); toast('Kopyalandı', 'success') }
function formatDate(d) { if (!d) return ''; return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) }
function formatTime(d) { if (!d) return ''; return new Date(d).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) }
</script>

<style scoped>
.editor { display: flex; flex-direction: column; height: 100vh; }
.editor-loading { display: flex; align-items: center; justify-content: center; height: 100vh; }
.editor-body { display: flex; flex: 1; overflow: hidden; }

/* Left nav sidebar */
.nav-sidebar {
  width: 220px; min-width: 220px; background: var(--bg-secondary);
  border-right: 1px solid var(--border); display: flex; flex-direction: column;
  padding: 8px 0;
}
.nav-section { margin-bottom: 4px; }
.nav-section-header {
  display: flex; align-items: center; gap: 8px; padding: 10px 16px;
  cursor: pointer; font-size: 14px; font-weight: 600; color: var(--text-primary);
  transition: background 0.15s;
}
.nav-section-header:hover { background: var(--bg-hover); }
.nav-icon { font-size: 16px; }
.nav-section-title { flex: 1; }
.nav-chevron { transition: transform 0.2s; color: var(--text-muted); }
.nav-chevron.open { transform: rotate(180deg); }
.nav-items { padding: 2px 0; }
.nav-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 16px 8px 28px;
  cursor: pointer; font-size: 13px; color: var(--text-secondary);
  transition: all 0.15s; border-left: 3px solid transparent;
}
.nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.nav-item.active { background: var(--accent-soft); color: var(--accent-hover); border-left-color: var(--accent); font-weight: 500; }
.nav-item-icon { font-size: 14px; width: 20px; text-align: center; }
.nav-bottom { margin-top: auto; border-top: 1px solid var(--border); padding-top: 8px; }
.nav-bottom .nav-item { padding-left: 16px; }

/* Main area */
.main-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.top-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px; background: var(--bg-secondary); border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.top-bar-left { display: flex; align-items: center; gap: 10px; }
.playlist-title { font-size: 15px; font-weight: 600; }
.channel-count-badge { font-size: 11px; color: var(--text-muted); background: var(--bg-tertiary); padding: 2px 8px; border-radius: 10px; }
.top-bar-right { display: flex; align-items: center; gap: 8px; }
.search-box { position: relative; }
.search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
.search-input {
  padding: 7px 12px 7px 32px; background: var(--bg-primary); border: 1px solid var(--border);
  border-radius: var(--radius); color: var(--text-primary); font-size: 12px; width: 220px;
}
.search-input:focus { outline: none; border-color: var(--accent); }
.search-input::placeholder { color: var(--text-muted); }

.content-split { display: flex; flex: 1; overflow: hidden; }

/* Center panel */
.center-panel { flex: 1; overflow-y: auto; padding: 0; background: var(--bg-primary); }
.center-loading { display: flex; justify-content: center; padding: 60px; }
.center-empty { display: flex; flex-direction: column; align-items: center; padding: 60px; color: var(--text-muted); font-size: 13px; }

/* View headers */
.view-header { padding: 16px 20px 8px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.view-header h3 { font-size: 15px; font-weight: 600; }
.view-desc { font-size: 12px; color: var(--text-muted); width: 100%; }
.view-header-actions { display: flex; gap: 6px; }

/* Accordion */
.accordion-list { }
.accordion-group { border-bottom: 1px solid var(--border); }
.accordion-header {
  display: flex; align-items: center; gap: 8px; padding: 10px 16px;
  cursor: pointer; font-size: 13px; transition: background 0.15s; user-select: none;
}
.accordion-header:hover { background: var(--bg-hover); }
.acc-arrow { transition: transform 0.2s; color: var(--text-muted); flex-shrink: 0; }
.acc-arrow.open { transform: rotate(90deg); }
.acc-title { font-weight: 500; flex: 1; }
.acc-count { font-size: 11px; color: var(--text-muted); }
.accordion-body { background: var(--bg-secondary); border-top: 1px solid var(--border); }
.acc-loading { padding: 12px 20px; }
.acc-empty { padding: 12px 20px; font-size: 12px; color: var(--text-muted); }

/* Bulk bar */
.bulk-bar { display: flex; align-items: center; gap: 6px; padding: 8px 16px; background: var(--bg-secondary); border-bottom: 1px solid var(--border); }

/* Channel table */
.ch-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.ch-table thead { position: sticky; top: 0; z-index: 2; background: var(--bg-tertiary); }
.ch-table th {
  padding: 6px 10px; text-align: left; font-weight: 600; font-size: 10px;
  color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border);
}
.ch-table td { padding: 5px 10px; border-bottom: 1px solid var(--border); }
.ch-table tbody tr { cursor: pointer; transition: background 0.1s; }
.ch-table tbody tr:hover { background: var(--bg-hover); }
.ch-table tbody tr.selected { background: var(--accent-soft); }
.ch-table tbody tr.editing { background: var(--accent-soft); border-left: 3px solid var(--accent); }
.th-check, .td-check { width: 32px; text-align: center; }
.td-check input, .th-check input { accent-color: var(--accent); cursor: pointer; }
.th-num, .td-num { width: 40px; color: var(--text-muted); text-align: center; }
.ch-name-cell { display: flex; align-items: center; gap: 6px; }
.row-logo { width: 22px; height: 22px; border-radius: 3px; object-fit: cover; flex-shrink: 0; }
.row-logo-fb { font-size: 14px; width: 22px; text-align: center; flex-shrink: 0; }
.td-name { font-weight: 500; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.td-url { max-width: 200px; }
.url-text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted); font-size: 11px; }
.td-epg { color: var(--text-muted); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.ch-pagination {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  padding: 8px; border-top: 1px solid var(--border); background: var(--bg-secondary);
}
.page-info { font-size: 12px; color: var(--text-secondary); }

/* Sort view */
.sort-list { padding: 8px 16px; }
.sort-item {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius);
  margin-bottom: 4px; cursor: grab; transition: background 0.15s;
}
.sort-item:hover { background: var(--bg-hover); }
.sort-handle { color: var(--text-muted); font-size: 16px; cursor: grab; }
.sort-name { flex: 1; font-size: 13px; font-weight: 500; }
.sort-count { font-size: 11px; color: var(--text-muted); }

/* Logo editor */
.logo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; padding: 12px 16px; }
.logo-card {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 8px; background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: var(--radius); cursor: pointer; transition: all 0.15s;
}
.logo-card:hover { border-color: var(--accent); background: var(--bg-hover); }
.logo-card-img { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; }
.logo-card-img img { width: 48px; height: 48px; border-radius: 6px; object-fit: cover; }
.logo-card-fb { font-size: 28px; }
.logo-card-name { font-size: 10px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; color: var(--text-secondary); }

/* EPG editor */
.epg-section { padding: 12px 20px; }
.epg-add-row { display: flex; gap: 8px; margin-bottom: 12px; }
.epg-source-list { border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 12px; }
.epg-source-item { display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--border); font-size: 12px; }
.epg-source-item:last-child { border-bottom: none; }
.epg-source-url { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; margin-right: 12px; }
.epg-source-date { color: var(--text-muted); }
.epg-no-source { font-size: 12px; color: var(--text-muted); padding: 8px 0; }
.epg-actions-row { display: flex; align-items: center; gap: 10px; }

.epg-calendar { padding: 0 20px 20px; }
.epg-channel-select { margin-bottom: 12px; max-width: 400px; }
.epg-timeline { border: 1px solid var(--border); border-radius: var(--radius); max-height: 400px; overflow-y: auto; }
.epg-program { padding: 10px 14px; border-bottom: 1px solid var(--border); }
.epg-program:last-child { border-bottom: none; }
.epg-prog-time { font-size: 11px; font-weight: 600; color: var(--accent-hover); margin-bottom: 2px; }
.epg-prog-title { font-size: 13px; font-weight: 500; }
.epg-prog-desc { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.epg-no-data { font-size: 12px; color: var(--text-muted); padding: 16px 0; text-align: center; }

/* Category editor */
.cat-editor-list { padding: 8px 16px; }
.cat-editor-item {
  display: flex; align-items: center; gap: 10px; padding: 10px 14px;
  background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius);
  margin-bottom: 4px;
}
.cat-editor-icon { font-size: 16px; }
.cat-editor-name { flex: 1; font-size: 13px; font-weight: 500; }
.cat-editor-count { font-size: 11px; color: var(--text-muted); }
.cat-editor-actions { display: flex; gap: 4px; }

/* Update view */
.update-panel { padding: 16px 20px; }
.update-info { display: flex; gap: 16px; margin-top: 16px; }
.update-stat {
  flex: 1; background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 16px; text-align: center;
}
.update-stat-label { display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 4px; }
.update-stat-value { display: block; font-size: 24px; font-weight: 700; color: var(--accent-hover); }

/* Edit panel */
.edit-panel {
  width: 300px; min-width: 300px; background: var(--bg-secondary);
  border-left: 1px solid var(--border); display: flex; flex-direction: column;
}
.edit-panel-empty { justify-content: center; align-items: center; }
.ep-empty { text-align: center; color: var(--text-muted); }
.ep-empty-icon { font-size: 48px; margin-bottom: 12px; opacity: 0.3; }
.ep-empty p { font-size: 13px; margin-bottom: 4px; }
.ep-empty-hint { font-size: 11px; }
.ep-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--border); }
.ep-header h3 { font-size: 14px; font-weight: 600; }
.ep-body { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
.ep-logo-area { display: flex; justify-content: center; padding: 14px; }
.ep-logo-preview img { width: 64px; height: 64px; border-radius: 8px; object-fit: cover; background: var(--bg-tertiary); }
.ep-logo-placeholder { width: 64px; height: 64px; border-radius: 8px; background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center; font-size: 24px; }
.ep-form { flex: 1; padding: 0 14px 14px; }
.ep-form .form-group { margin-bottom: 10px; }
.ep-form .form-row { display: flex; gap: 8px; }
.ep-form label { display: block; font-size: 10px; font-weight: 600; color: var(--text-muted); margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
.ep-btn-row { display: flex; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--border); }

/* Modals */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
  backdrop-filter: blur(4px);
}
.modal {
  background: var(--bg-secondary); border: 1px solid var(--border-light);
  border-radius: var(--radius-xl); padding: 24px; width: 90%; max-width: 460px;
  box-shadow: var(--shadow-lg);
}
.modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.modal-header h3 { font-size: 16px; font-weight: 600; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }
.form-group { margin-bottom: 14px; }
.form-group label { display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
.result-box { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: var(--radius); font-size: 13px; margin-top: 12px; }
.result-box.success { background: var(--success-soft); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.2); }
.result-box.error { background: var(--danger-soft); color: #fca5a5; border: 1px solid rgba(239,68,68,0.2); }

.btn-success { background: #10b981; color: white; border: none; padding: 8px 14px; border-radius: var(--radius); cursor: pointer; font-size: 13px; font-weight: 500; }
.btn-success:hover { background: #059669; }

.spinner-sm { width: 14px; height: 14px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
