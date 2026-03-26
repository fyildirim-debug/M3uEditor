<template>
  <div class="admin-page">
    <div class="admin-header">
      <h1>Admin Paneli</h1>
      <p class="admin-subtitle">Sistem yonetimi ve kullanici islemleri</p>
    </div>

    <!-- Stats Cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon users-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ stats.users }}</span>
          <span class="stat-label">Toplam Kullanici</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon playlists-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ stats.playlists }}</span>
          <span class="stat-label">Toplam Playlist</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon channels-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ stats.channels }}</span>
          <span class="stat-label">Toplam Kanal</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon new-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ stats.newUsersThisWeek }}</span>
          <span class="stat-label">Bu Hafta Yeni</span>
        </div>
      </div>
    </div>

    <!-- Plan Distribution -->
    <div class="plan-distribution" v-if="stats.planDistribution && stats.planDistribution.length">
      <h3>Plan Dagilimi</h3>
      <div class="plan-badges">
        <span v-for="p in stats.planDistribution" :key="p.plan" class="plan-badge" :class="'plan-' + p.plan">
          {{ p.plan.toUpperCase() }}: {{ p.count }}
        </span>
      </div>
    </div>

    <!-- User Table -->
    <div class="users-section">
      <div class="users-header">
        <h2>Kullanicilar</h2>
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="E-posta ile ara..."
            @input="debouncedSearch"
          />
        </div>
      </div>

      <div class="table-wrapper">
        <table class="users-table">
          <thead>
            <tr>
              <th>E-posta</th>
              <th>Plan</th>
              <th>Playlist</th>
              <th>Max Playlist</th>
              <th>Max Kanal</th>
              <th>Admin</th>
              <th>Kayit Tarihi</th>
              <th>Islemler</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td class="email-cell">{{ user.email }}</td>
              <td><span class="plan-tag" :class="'plan-' + (user.plan || 'free')">{{ (user.plan || 'free').toUpperCase() }}</span></td>
              <td>{{ user.playlist_count }}</td>
              <td>{{ user.max_playlists }}</td>
              <td>{{ user.max_channels_per_playlist }}</td>
              <td><span :class="user.is_admin ? 'badge-yes' : 'badge-no'">{{ user.is_admin ? 'Evet' : 'Hayir' }}</span></td>
              <td>{{ formatDate(user.created_at) }}</td>
              <td class="actions-cell">
                <button class="btn-edit" @click="openEditModal(user)" title="Duzenle">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn-delete" @click="confirmDelete(user)" title="Sil" :disabled="user.is_admin">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
              </td>
            </tr>
            <tr v-if="users.length === 0">
              <td colspan="8" class="empty-row">Kullanici bulunamadi</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="pagination" v-if="totalPages > 1">
        <button :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">Onceki</button>
        <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
        <button :disabled="currentPage >= totalPages" @click="goToPage(currentPage + 1)">Sonraki</button>
      </div>
    </div>

    <!-- Edit Modal -->
    <div class="modal-overlay" v-if="editModal.visible" @click.self="closeEditModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Kullanici Duzenle</h3>
          <button class="modal-close" @click="closeEditModal">&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-email">{{ editModal.user?.email }}</p>

          <div class="form-group">
            <label>Plan</label>
            <select v-model="editModal.form.plan">
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="business">Business</option>
            </select>
          </div>

          <div class="form-group">
            <label>Max Playlist</label>
            <input type="number" v-model.number="editModal.form.max_playlists" min="1" />
          </div>

          <div class="form-group">
            <label>Max Kanal / Playlist</label>
            <input type="number" v-model.number="editModal.form.max_channels_per_playlist" min="1" />
          </div>

          <div class="form-group">
            <label>Plan Bitis Tarihi</label>
            <input type="datetime-local" v-model="editModal.form.plan_expires_at" />
          </div>

          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" v-model="editModal.form.is_admin" />
              Admin Yetkisi
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="closeEditModal">Iptal</button>
          <button class="btn-save" @click="saveUser" :disabled="editModal.saving">
            {{ editModal.saving ? 'Kaydediliyor...' : 'Kaydet' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal-overlay" v-if="deleteModal.visible" @click.self="closeDeleteModal">
      <div class="modal-content modal-small">
        <div class="modal-header">
          <h3>Kullanici Sil</h3>
          <button class="modal-close" @click="closeDeleteModal">&times;</button>
        </div>
        <div class="modal-body">
          <p><strong>{{ deleteModal.user?.email }}</strong> kullanicisini silmek istediginize emin misiniz?</p>
          <p class="warning-text">Bu islem geri alinamaz. Kullanicinin tum playlist ve kanallari silinecektir.</p>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="closeDeleteModal">Iptal</button>
          <button class="btn-danger" @click="doDelete" :disabled="deleteModal.deleting">
            {{ deleteModal.deleting ? 'Siliniyor...' : 'Sil' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, inject } from 'vue';
import api from '../api';
import { useAuthStore } from '../stores/auth';

const toast = inject('toast');
const auth = useAuthStore();

const stats = reactive({
  users: 0,
  playlists: 0,
  channels: 0,
  newUsersThisWeek: 0,
  planDistribution: [],
});

const users = ref([]);
const currentPage = ref(1);
const totalPages = ref(1);
const searchQuery = ref('');
let searchTimeout = null;

const editModal = reactive({
  visible: false,
  user: null,
  saving: false,
  form: {
    plan: 'free',
    max_playlists: 3,
    max_channels_per_playlist: 500,
    is_admin: false,
    plan_expires_at: '',
  },
});

const deleteModal = reactive({
  visible: false,
  user: null,
  deleting: false,
});

onMounted(async () => {
  if (!auth.user?.is_admin) {
    toast?.error?.('Admin yetkisi gereklidir');
    return;
  }
  await Promise.all([fetchStats(), fetchUsers()]);
});

async function fetchStats() {
  try {
    const res = await api.get('/admin/stats');
    Object.assign(stats, res.data);
  } catch (err) {
    toast?.error?.('Istatistikler yuklenemedi');
  }
}

async function fetchUsers() {
  try {
    const params = { page: currentPage.value, limit: 20 };
    if (searchQuery.value) params.search = searchQuery.value;
    const res = await api.get('/admin/users', { params });
    users.value = res.data.users;
    totalPages.value = res.data.totalPages;
  } catch (err) {
    toast?.error?.('Kullanici listesi yuklenemedi');
  }
}

function debouncedSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentPage.value = 1;
    fetchUsers();
  }, 400);
}

function goToPage(page) {
  currentPage.value = page;
  fetchUsers();
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function openEditModal(user) {
  editModal.user = user;
  editModal.form.plan = user.plan || 'free';
  editModal.form.max_playlists = user.max_playlists || 3;
  editModal.form.max_channels_per_playlist = user.max_channels_per_playlist || 500;
  editModal.form.is_admin = !!user.is_admin;
  editModal.form.plan_expires_at = user.plan_expires_at
    ? new Date(user.plan_expires_at).toISOString().slice(0, 16)
    : '';
  editModal.visible = true;
}

function closeEditModal() {
  editModal.visible = false;
  editModal.user = null;
  editModal.saving = false;
}

async function saveUser() {
  editModal.saving = true;
  try {
    const payload = {
      plan: editModal.form.plan,
      max_playlists: editModal.form.max_playlists,
      max_channels_per_playlist: editModal.form.max_channels_per_playlist,
      is_admin: editModal.form.is_admin,
      plan_expires_at: editModal.form.plan_expires_at || null,
    };
    await api.put(`/admin/users/${editModal.user.id}`, payload);
    toast?.success?.('Kullanici guncellendi');
    closeEditModal();
    await fetchUsers();
  } catch (err) {
    toast?.error?.(err.response?.data?.error?.message || 'Guncelleme basarisiz');
  } finally {
    editModal.saving = false;
  }
}

function confirmDelete(user) {
  deleteModal.user = user;
  deleteModal.visible = true;
}

function closeDeleteModal() {
  deleteModal.visible = false;
  deleteModal.user = null;
  deleteModal.deleting = false;
}

async function doDelete() {
  deleteModal.deleting = true;
  try {
    await api.delete(`/admin/users/${deleteModal.user.id}`);
    toast?.success?.('Kullanici silindi');
    closeDeleteModal();
    await Promise.all([fetchStats(), fetchUsers()]);
  } catch (err) {
    toast?.error?.(err.response?.data?.error?.message || 'Silme basarisiz');
  } finally {
    deleteModal.deleting = false;
  }
}
</script>

<style scoped>
.admin-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.admin-header {
  margin-bottom: 28px;
}

.admin-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary, #e4e4e7);
  margin: 0;
}

.admin-subtitle {
  color: var(--text-secondary, #a1a1aa);
  margin: 4px 0 0 0;
  font-size: 0.9rem;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--card-bg, #1e1e2e);
  border: 1px solid var(--border-color, #2e2e3e);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  transition: border-color 0.2s;
}

.stat-card:hover {
  border-color: var(--accent, #6366f1);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.users-icon { background: rgba(99, 102, 241, 0.15); color: #6366f1; }
.playlists-icon { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.channels-icon { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
.new-icon { background: rgba(236, 72, 153, 0.15); color: #ec4899; }

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary, #e4e4e7);
}

.stat-label {
  font-size: 0.8rem;
  color: var(--text-secondary, #a1a1aa);
  margin-top: 2px;
}

/* Plan Distribution */
.plan-distribution {
  margin-bottom: 24px;
}

.plan-distribution h3 {
  font-size: 1rem;
  color: var(--text-secondary, #a1a1aa);
  margin: 0 0 10px 0;
}

.plan-badges {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.plan-badge {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
}

.plan-free { background: rgba(161, 161, 170, 0.15); color: #a1a1aa; }
.plan-pro { background: rgba(99, 102, 241, 0.15); color: #6366f1; }
.plan-business { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }

/* Users Section */
.users-section {
  background: var(--card-bg, #1e1e2e);
  border: 1px solid var(--border-color, #2e2e3e);
  border-radius: 12px;
  padding: 20px;
}

.users-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.users-header h2 {
  font-size: 1.2rem;
  color: var(--text-primary, #e4e4e7);
  margin: 0;
}

.search-box input {
  background: var(--input-bg, #16161e);
  border: 1px solid var(--border-color, #2e2e3e);
  border-radius: 8px;
  padding: 8px 14px;
  color: var(--text-primary, #e4e4e7);
  font-size: 0.85rem;
  width: 260px;
  outline: none;
  transition: border-color 0.2s;
}

.search-box input:focus {
  border-color: var(--accent, #6366f1);
}

.search-box input::placeholder {
  color: var(--text-secondary, #a1a1aa);
}

/* Table */
.table-wrapper {
  overflow-x: auto;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.users-table th {
  text-align: left;
  padding: 10px 12px;
  color: var(--text-secondary, #a1a1aa);
  font-weight: 600;
  border-bottom: 1px solid var(--border-color, #2e2e3e);
  white-space: nowrap;
}

.users-table td {
  padding: 10px 12px;
  color: var(--text-primary, #e4e4e7);
  border-bottom: 1px solid var(--border-color, rgba(46, 46, 62, 0.5));
}

.users-table tbody tr:hover {
  background: rgba(99, 102, 241, 0.04);
}

.email-cell {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plan-tag {
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-yes {
  color: #10b981;
  font-weight: 600;
}

.badge-no {
  color: var(--text-secondary, #a1a1aa);
}

.actions-cell {
  display: flex;
  gap: 6px;
}

.btn-edit,
.btn-delete {
  background: none;
  border: 1px solid var(--border-color, #2e2e3e);
  border-radius: 6px;
  padding: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-edit {
  color: #6366f1;
}

.btn-edit:hover {
  background: rgba(99, 102, 241, 0.1);
  border-color: #6366f1;
}

.btn-delete {
  color: #ef4444;
}

.btn-delete:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  border-color: #ef4444;
}

.btn-delete:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.empty-row {
  text-align: center;
  color: var(--text-secondary, #a1a1aa);
  padding: 32px 12px !important;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
}

.pagination button {
  background: var(--input-bg, #16161e);
  border: 1px solid var(--border-color, #2e2e3e);
  border-radius: 8px;
  padding: 8px 16px;
  color: var(--text-primary, #e4e4e7);
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.pagination button:hover:not(:disabled) {
  border-color: var(--accent, #6366f1);
}

.pagination button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.85rem;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--card-bg, #1e1e2e);
  border: 1px solid var(--border-color, #2e2e3e);
  border-radius: 14px;
  width: 440px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-small {
  width: 380px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border-color, #2e2e3e);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-primary, #e4e4e7);
}

.modal-close {
  background: none;
  border: none;
  color: var(--text-secondary, #a1a1aa);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-close:hover {
  color: var(--text-primary, #e4e4e7);
}

.modal-body {
  padding: 20px;
}

.modal-email {
  color: var(--text-secondary, #a1a1aa);
  font-size: 0.9rem;
  margin: 0 0 16px 0;
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-secondary, #a1a1aa);
  margin-bottom: 6px;
  font-weight: 500;
}

.form-group input[type="number"],
.form-group input[type="datetime-local"],
.form-group select {
  width: 100%;
  background: var(--input-bg, #16161e);
  border: 1px solid var(--border-color, #2e2e3e);
  border-radius: 8px;
  padding: 9px 12px;
  color: var(--text-primary, #e4e4e7);
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus {
  border-color: var(--accent, #6366f1);
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--text-primary, #e4e4e7);
  font-size: 0.85rem;
}

.checkbox-group input[type="checkbox"] {
  accent-color: var(--accent, #6366f1);
  width: 16px;
  height: 16px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color, #2e2e3e);
}

.btn-cancel {
  background: var(--input-bg, #16161e);
  border: 1px solid var(--border-color, #2e2e3e);
  border-radius: 8px;
  padding: 8px 18px;
  color: var(--text-primary, #e4e4e7);
  cursor: pointer;
  font-size: 0.85rem;
  transition: border-color 0.2s;
}

.btn-cancel:hover {
  border-color: var(--text-secondary, #a1a1aa);
}

.btn-save {
  background: var(--accent, #6366f1);
  border: none;
  border-radius: 8px;
  padding: 8px 22px;
  color: #fff;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: opacity 0.2s;
}

.btn-save:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger {
  background: #ef4444;
  border: none;
  border-radius: 8px;
  padding: 8px 22px;
  color: #fff;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: opacity 0.2s;
}

.btn-danger:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.warning-text {
  color: #ef4444;
  font-size: 0.8rem;
  margin-top: 8px;
}

/* Responsive */
@media (max-width: 768px) {
  .admin-page {
    padding: 16px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .users-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .search-box input {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
