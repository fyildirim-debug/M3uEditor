<template>
  <div class="dashboard">
    <div class="dash-header">
      <div>
        <h1 class="dash-title">Playlistlerim</h1>
        <p class="dash-subtitle">M3U playlistlerini yönet, düzenle ve paylaş</p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" @click="openXtream">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Xtream İçe Aktar
        </button>
        <button class="btn btn-primary" @click="showCreate = true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Yeni Playlist
        </button>
      </div>
    </div>

    <div v-if="loading" class="dash-loading">
      <span class="spinner spinner-lg"></span>
    </div>

    <div v-else-if="playlists.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      </div>
      <h3>Henüz playlist yok</h3>
      <p>İlk playlistini oluştur ve Xtream Codes ile kanallarını içe aktar.</p>
      <button class="btn btn-primary" style="margin-top:20px" @click="showCreate = true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        İlk Playlistini Oluştur
      </button>
    </div>

    <div v-else class="playlist-grid">
      <div v-for="pl in playlists" :key="pl.id" class="pl-card" @click="$router.push('/playlist/' + pl.id)">
        <div class="pl-card-top">
          <div class="pl-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </div>
          <div class="pl-card-menu" @click.stop>
            <button class="btn btn-ghost btn-icon-sm" @click="startEdit(pl)" data-tooltip="Düzenle">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon-sm" @click="confirmDelete(pl)" data-tooltip="Sil" style="color:var(--danger)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
        <h3 class="pl-name">{{ pl.name }}</h3>
        <div class="pl-meta">
          <span class="badge badge-accent">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {{ formatDate(pl.created_at) }}
          </span>
        </div>
        <div class="pl-card-footer">
          <span class="pl-arrow">Düzenle →</span>
        </div>
      </div>
    </div>

    <!-- Create Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
          <div class="modal">
            <div class="modal-header">
              <h3>Yeni Playlist Oluştur</h3>
              <button class="btn btn-ghost btn-icon-sm" @click="showCreate = false">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="form-group">
              <label>Playlist Adı</label>
              <input class="input" v-model="newName" placeholder="Örn: Ana Liste, Spor Kanalları..." @keyup.enter="createPlaylist" autofocus />
            </div>
            <div class="modal-actions">
              <button class="btn btn-secondary" @click="showCreate = false">İptal</button>
              <button class="btn btn-primary" @click="createPlaylist" :disabled="!newName.trim()">Oluştur</button>
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
              <h3>Playlist Düzenle</h3>
              <button class="btn btn-ghost btn-icon-sm" @click="editingPl = null">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="form-group">
              <label>Playlist Adı</label>
              <input class="input" v-model="editName" @keyup.enter="updatePlaylist" />
            </div>
            <div class="modal-actions">
              <button class="btn btn-secondary" @click="editingPl = null">İptal</button>
              <button class="btn btn-primary" @click="updatePlaylist" :disabled="!editName.trim()">Kaydet</button>
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
              <h3>Playlist Sil</h3>
              <button class="btn btn-ghost btn-icon-sm" @click="deletingPl = null">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="delete-warning">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <p>"<strong>{{ deletingPl.name }}</strong>" playlistini ve tüm kanallarını kalıcı olarak silmek istediğine emin misin?</p>
            </div>
            <div class="modal-actions">
              <button class="btn btn-secondary" @click="deletingPl = null">İptal</button>
              <button class="btn btn-danger" @click="deletePlaylist">Kalıcı Olarak Sil</button>
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
              <h3>Xtream Codes İçe Aktar</h3>
              <button class="btn btn-ghost btn-icon-sm" @click="showXtreamModal = false">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">Xtream Codes sunucu bilgilerini girerek tüm kanalları (canlı TV, VOD, diziler) içe aktarabilirsin. Mevcut bir Xtream playlist'in varsa üzerine güncellenir.</p>
            <div class="form-group"><label>Sunucu URL</label><input class="input" v-model="xtreamForm.serverUrl" placeholder="http://example.com:8080" /></div>
            <div class="form-group"><label>Kullanıcı Adı</label><input class="input" v-model="xtreamForm.username" /></div>
            <div class="form-group"><label>Şifre</label><input class="input" type="password" v-model="xtreamForm.password" /></div>
            <div v-if="importResult" class="result-box success">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              {{ importResult.totalChannels }} kanal, {{ importResult.totalCategories }} kategori içe aktarıldı ({{ (importResult.duration / 1000).toFixed(1) }}s)
            </div>
            <div v-if="importError" class="result-box error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              {{ importError }}
            </div>
            <div class="modal-actions">
              <button class="btn btn-secondary" @click="showXtreamModal = false">Kapat</button>
              <button class="btn btn-primary" @click="doXtreamImport" :disabled="importing || !xtreamForm.serverUrl || !xtreamForm.username || !xtreamForm.password">
                <span v-if="importing" class="spinner" style="width:14px;height:14px"></span>
                {{ importing ? 'İçe aktarılıyor...' : 'İçe Aktar' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'

const router = useRouter()

const toast = inject('toast')
const playlists = ref([])
const loading = ref(true)
const showCreate = ref(false)
const newName = ref('')
const editingPl = ref(null)
const editName = ref('')
const deletingPl = ref(null)

// Xtream import state
const showXtreamModal = ref(false)
const xtreamForm = ref({ serverUrl: '', username: '', password: '' })
const importing = ref(false)
const importResult = ref(null)
const importError = ref('')

onMounted(loadPlaylists)

async function loadPlaylists() {
  loading.value = true
  try {
    const { data } = await api.get('/playlists')
    playlists.value = data
  } catch { toast('Playlistler yüklenemedi', 'error') }
  finally { loading.value = false }
}

async function createPlaylist() {
  if (!newName.value.trim()) return
  try {
    await api.post('/playlists', { name: newName.value.trim() })
    newName.value = ''
    showCreate.value = false
    toast('Playlist oluşturuldu', 'success')
    loadPlaylists()
  } catch (e) { toast(e.response?.data?.error?.message || 'Hata', 'error') }
}

function startEdit(pl) { editingPl.value = pl; editName.value = pl.name }

async function updatePlaylist() {
  if (!editName.value.trim()) return
  try {
    await api.put('/playlists/' + editingPl.value.id, { name: editName.value.trim() })
    editingPl.value = null
    toast('Güncellendi', 'success')
    loadPlaylists()
  } catch (e) { toast(e.response?.data?.error?.message || 'Hata', 'error') }
}

function confirmDelete(pl) { deletingPl.value = pl }

async function deletePlaylist() {
  try {
    await api.delete('/playlists/' + deletingPl.value.id)
    deletingPl.value = null
    toast('Silindi', 'success')
    loadPlaylists()
  } catch (e) { toast(e.response?.data?.error?.message || 'Hata', 'error') }
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Xtream import fonksiyonları
function openXtream() {
  showXtreamModal.value = true
  importResult.value = null
  importError.value = ''
  xtreamForm.value = { serverUrl: '', username: '', password: '' }
}

async function doXtreamImport() {
  importing.value = true; importResult.value = null; importError.value = ''
  try {
    const { data } = await api.post('/import/xtream', xtreamForm.value)
    importResult.value = data
    toast(`${data.totalChannels} kanal içe aktarıldı`, 'success')
    // Playlist listesini yenile
    await loadPlaylists()
    // 2 saniye sonra oluşturulan playlist'e yönlendir
    setTimeout(() => {
      showXtreamModal.value = false
      if (data.playlistId) {
        router.push('/playlist/' + data.playlistId)
      }
    }, 2000)
  } catch (e) {
    importError.value = e.response?.data?.error?.message || 'Bağlantı hatası. Sunucu URL, kullanıcı adı ve şifreyi kontrol et.'
  } finally { importing.value = false }
}
</script>

<style scoped>
.dashboard { padding: 32px; max-width: 1200px; margin: 0 auto; animation: fadeIn 0.3s ease; }
.dash-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 32px; }
.dash-title { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
.dash-subtitle { color: var(--text-secondary); font-size: 13px; margin-top: 4px; }
.dash-loading { display: flex; justify-content: center; padding: 80px; }
.playlist-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.pl-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 22px; cursor: pointer;
  transition: all var(--transition); animation: fadeIn 0.3s ease;
  position: relative;
}
.pl-card:hover {
  border-color: var(--accent); transform: translateY(-2px);
  box-shadow: var(--shadow-glow);
}
.pl-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.pl-icon {
  width: 40px; height: 40px;
  background: var(--accent-soft); border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: var(--accent-hover);
}
.pl-card-menu { display: flex; gap: 2px; opacity: 0; transition: opacity var(--transition); }
.pl-card:hover .pl-card-menu { opacity: 1; }
.pl-name { font-size: 16px; font-weight: 600; margin-bottom: 10px; letter-spacing: -0.2px; }
.pl-meta { display: flex; gap: 8px; flex-wrap: wrap; }
.pl-card-footer { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border); }
.pl-arrow { font-size: 12px; font-weight: 500; color: var(--text-muted); transition: color var(--transition); }
.pl-card:hover .pl-arrow { color: var(--accent-hover); }

.empty-state {
  text-align: center; padding: 80px 20px;
  animation: fadeIn 0.4s ease;
}
.empty-icon {
  width: 80px; height: 80px; margin: 0 auto 20px;
  background: var(--accent-soft); border-radius: 20px;
  display: flex; align-items: center; justify-content: center;
  color: var(--accent-hover);
}
.empty-state h3 { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
.empty-state p { color: var(--text-secondary); font-size: 14px; max-width: 400px; margin: 0 auto; }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
  backdrop-filter: blur(4px);
}
.modal {
  background: var(--bg-secondary); border: 1px solid var(--border-light);
  border-radius: var(--radius-xl); padding: 28px; width: 90%; max-width: 460px;
  box-shadow: var(--shadow-lg); animation: fadeInScale 0.25s ease;
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
</style>
