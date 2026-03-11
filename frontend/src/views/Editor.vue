<template>
  <div class="editor" v-if="!pageLoading">
    <div class="editor-body">
      <!-- Left nav sidebar -->
      <nav class="nav-sidebar">
        <div class="nav-section">
          <div class="nav-section-header" @click="navChannelsOpen = !navChannelsOpen">
            <span class="nav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg></span>
            <span class="nav-section-title">Kanallar</span>
            <svg :class="['nav-chevron', { open: navChannelsOpen }]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div v-if="navChannelsOpen" class="nav-items">
            <div :class="['nav-item', { active: activeView === 'basic' }]" @click="activeView = 'basic'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Kanal Editörü
            </div>
            <div :class="['nav-item', { active: activeView === 'sort' }]" @click="activeView = 'sort'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/></svg> Sıralama
            </div>
            <div :class="['nav-item', { active: activeView === 'epg' }]" @click="activeView = 'epg'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> EPG Editörü
            </div>
            <div :class="['nav-item', { active: activeView === 'category' }]" @click="activeView = 'category'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> Kategori Editörü
            </div>
            <div :class="['nav-item', { active: activeView === 'update' }]" @click="activeView = 'update'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg> Güncelle
            </div>
          </div>
        </div>
        <div class="nav-bottom">
          <div class="nav-item" @click="$router.push('/dashboard')">
            <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Dashboard
          </div>
          <div class="nav-item" @click="doExport">
            <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> M3U İndir
          </div>
          <div class="nav-item" @click="doShare">
            <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Paylaş
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg> Xtream İçe Aktar
            </button>
          </div>
        </div>

        <div class="content-split">
          <!-- Center: accordion categories + channels -->
          <div class="center-panel">
            <!-- BASIC EDITOR VIEW -->
            <template v-if="activeView === 'basic'">
              <div class="editor-split">
                <!-- Sol: Kategori Sidebar -->
                <div class="cat-sidebar">
                  <div class="cat-sidebar-header">
                    <span class="cat-sidebar-title">Kategoriler</span>
                    <button class="btn btn-ghost btn-icon-sm" @click="showCatCreate = true" title="Yeni Kategori">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                  </div>
                  <div class="cat-sidebar-list">
                    <div :class="['cat-sb-item', { active: !selectedCatId }]" @click="selectCategory(null)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>
                      <span class="cat-sb-name">Tüm Kanallar</span>
                      <span class="cat-sb-count">{{ totalChannelCount }}</span>
                    </div>
                    <div v-for="cat in categories" :key="cat.id"
                      :class="['cat-sb-item', { active: selectedCatId === cat.id, 'cat-sb-hidden': hiddenCats.has(cat.id) }]"
                      @click="selectCategory(cat.id)">
                      <input v-if="inlineEditCatId === cat.id"
                        class="cat-sb-input"
                        v-model="inlineEditName"
                        @blur="saveInlineEdit(cat)"
                        @keyup.enter="saveInlineEdit(cat)"
                        @keyup.escape="inlineEditCatId = null"
                        @click.stop
                        autofocus />
                      <span v-else class="cat-sb-name" @dblclick.stop="startInlineEdit(cat)">{{ cat.name }}</span>
                      <span class="cat-sb-count">{{ cat.channel_count || 0 }}</span>
                      <div class="cat-sb-actions">
                        <button class="cat-sb-btn" @click.stop="toggleCatHidden(cat.id)" :title="hiddenCats.has(cat.id) ? 'Göster' : 'Gizle'">
                          <svg v-if="!hiddenCats.has(cat.id)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        </button>
                        <button class="cat-sb-btn" @click.stop="startInlineEdit(cat)" title="Yeniden Adlandır">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="cat-sb-btn cat-sb-btn-danger" @click.stop="confirmDeleteCat(cat)" title="Sil">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Sağ: Kanal Listesi -->
                <div class="channel-main">
                  <div v-if="selectedIds.size > 0" class="bulk-bar">
                    <span class="badge badge-accent">{{ selectedIds.size }} seçili</span>
                    <button class="btn btn-secondary btn-xs" @click="showBulkMove = true">Taşı</button>
                    <button class="btn btn-danger btn-xs" @click="bulkDelete">Sil</button>
                  </div>
                  <div v-if="channelsLoading" class="center-loading"><span class="spinner"></span></div>
                  <div v-else-if="channels.length === 0 && !search" class="center-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>
                    <p>{{ selectedCatId ? 'Bu kategoride kanal yok' : 'Henüz kanal yok. Xtream ile içe aktar.' }}</p>
                  </div>
                  <div v-else-if="channels.length === 0 && search" class="center-empty">
                    <p>Sonuç bulunamadı</p>
                  </div>
                  <div v-else class="channel-table-wrap">
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
                              <span v-else class="row-logo-fb"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg></span>
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
              </div>
            </template>

            <!-- SORT VIEW -->
            <template v-if="activeView === 'sort'">
              <div class="view-header">
                <h3>Sıralama</h3>
                <p class="view-desc">Sol panelden kategori seç → sağda kanalları sürükle</p>
              </div>
              <div class="sort-panels">
                <!-- Sol: Kategoriler -->
                <div class="sort-panel sort-panel-cats">
                  <div class="sort-panel-title">Kategoriler</div>
                  <div class="sort-list">
                    <div v-for="(cat, idx) in categories" :key="cat.id"
                      :class="['sort-item', { 'sort-item-active': sortSelectedCat?.id === cat.id }]"
                      draggable="true"
                      @dragstart="sortDragIdx = idx"
                      @dragover.prevent
                      @drop="catDrop(idx)"
                      @click="selectSortCat(cat)">
                      <svg class="sort-handle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1" fill="currentColor" stroke="none"/></svg>
                      <span class="sort-name">{{ cat.name }}</span>
                      <span class="sort-count">{{ cat.channel_count || 0 }}</span>
                    </div>
                  </div>
                </div>
                <!-- Sağ: Kanallar -->
                <div class="sort-panel sort-panel-channels">
                  <div class="sort-panel-title">
                    {{ sortSelectedCat ? sortSelectedCat.name + ' Kanalları' : 'Kategori seçin' }}
                  </div>
                  <div v-if="!sortSelectedCat" class="sort-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/></svg>
                    <span>Sol panelden bir kategori seçin</span>
                  </div>
                  <div v-else-if="sortCatLoading" class="sort-empty"><span class="spinner"></span></div>
                  <div v-else-if="sortCatChannels.length === 0" class="sort-empty">Bu kategoride kanal yok</div>
                  <div v-else class="sort-list">
                    <div v-for="(ch, idx) in sortCatChannels" :key="ch.id" class="sort-item"
                      draggable="true"
                      @dragstart="sortChanDragIdx = idx"
                      @dragover.prevent
                      @drop="chanDrop(idx)">
                      <svg class="sort-handle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1" fill="currentColor" stroke="none"/></svg>
                      <img v-if="ch.logo_url" :src="ch.logo_url" class="sort-ch-logo" @error="$event.target.style.display='none'" />
                      <span class="sort-name">{{ ch.name }}</span>
                      <span class="sort-count">#{{ idx + 1 }}</span>
                    </div>
                  </div>
                </div>
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Otomatik EPG Eşleştir
                  </button>
                  <span v-if="matchResult" class="badge badge-success">{{ matchResult.matched }} eşleştirildi</span>
                </div>
              </div>
              <!-- EPG Calendar / Program Guide -->
              <div class="epg-calendar">
                <div class="view-header" style="margin-top:20px">
                  <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:6px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> EPG Program Rehberi</h3>
                  <p class="view-desc">Kanal seçerek yayın akışını görüntüle</p>
                </div>
                <div class="epg-channel-select">
                  <select class="input" v-model="epgSelectedChannelId" @change="loadEpgPrograms">
                    <option :value="null">Kanal seçin...</option>
                    <option v-for="ch in allChannels" :key="ch.id" :value="ch.id">{{ ch.name }}</option>
                  </select>
                </div>
                <div v-if="epgPrograms.length" class="epg-timeline">
                  <div v-for="p in epgPrograms" :key="p.id" :class="['epg-program', { live: isProgramLive(p) }]">
                    <div class="epg-prog-header">
                      <div class="epg-prog-time">{{ formatTime(p.start_time) }} - {{ formatTime(p.end_time) }}</div>
                      <span v-if="isProgramLive(p)" class="badge badge-danger" style="font-size:10px">LIVE</span>
                    </div>
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  <span class="cat-editor-name">{{ cat.name }}</span>
                  <span class="cat-editor-count">{{ cat.channel_count || 0 }} kanal</span>
                  <div class="cat-editor-actions">
                    <button class="btn btn-ghost btn-xs" @click="startEditCat(cat)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Düzenle</button>
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
                <!-- Saved Xtream source card -->
                <div v-if="savedXtream" class="xtream-source-card">
                  <div class="xtream-source-header">
                    <div class="xtream-source-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
                    </div>
                    <div class="xtream-source-info">
                      <div class="xtream-source-title">Xtream Codes Kaynağı</div>
                      <div class="xtream-source-detail">{{ savedXtream.username }} @ {{ savedXtream.serverUrl }}</div>
                    </div>
                    <span class="badge badge-success" style="font-size:10px">Bağlı</span>
                  </div>
                  <div class="xtream-source-meta" v-if="savedXtream.lastSynced">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Son güncelleme: {{ new Date(savedXtream.lastSynced).toLocaleString('tr-TR') }}
                  </div>
                  <div class="xtream-source-actions">
                    <button class="btn btn-primary" @click="doSync" :disabled="syncing" style="flex:1">
                      <span v-if="syncing" class="spinner" style="width:14px;height:14px"></span>
                      <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                      {{ syncing ? 'Güncelleniyor...' : 'Kanalları Güncelle' }}
                    </button>
                    <button class="btn btn-secondary" @click="openXtream" title="Farklı hesapla içe aktar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Değiştir
                    </button>
                  </div>
                </div>

                <!-- No saved source -->
                <div v-else class="xtream-no-source">
                  <div class="xtream-no-source-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
                  </div>
                  <p>Kayıtlı Xtream Codes kaynağı yok</p>
                  <button class="btn btn-primary" @click="openXtream">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Xtream Codes Ekle
                  </button>
                </div>

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
                <div v-if="editForm.logo_url" class="ep-logo-preview" @click="triggerLogoUpload" title="Logo yükle">
                  <img :src="editForm.logo_url" @error="$event.target.style.display='none'" />
                  <div class="ep-logo-overlay">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </div>
                </div>
                <div v-else class="ep-logo-placeholder ep-logo-upload" @click="triggerLogoUpload" title="Logo yükle">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span class="ep-logo-upload-hint">Yükle</span>
                </div>
                <input ref="logoFileInput" type="file" accept="image/*" style="display:none" @change="handleLogoUpload" />
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
              <!-- EPG Section -->
              <div v-if="editingChannel.epg_channel_id && getCurrentAndNext().length" class="ep-epg-section">
                <div class="ep-epg-header">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span>Yayın Akışı</span>
                </div>
                <div class="ep-epg-list">
                  <div v-for="(prog, idx) in getCurrentAndNext()" :key="prog.id" class="ep-epg-item">
                    <div class="ep-epg-item-header">
                      <span class="ep-epg-time">{{ formatTime(prog.start_time) }}</span>
                      <span v-if="idx === 0 && isProgramLive(prog)" class="badge badge-danger" style="font-size:9px;padding:2px 6px">LIVE</span>
                      <span v-else-if="idx === 1" class="badge badge-accent" style="font-size:9px;padding:2px 6px">NEXT</span>
                    </div>
                    <div class="ep-epg-title">{{ prog.title }}</div>
                    <div v-if="prog.description" class="ep-epg-desc">{{ prog.description }}</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="ep-btn-row">
              <button class="btn btn-success" @click="saveChannel" style="flex:1">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Kaydet
              </button>
              <button class="btn btn-secondary" @click="resetChannel" :title="editingChannel.original_name ? 'Xtream orijinaline sıfırla' : 'Orijinal yok'">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
              <button class="btn btn-danger" @click="deleteChannel(editingChannel)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
          </aside>
          <aside class="edit-panel edit-panel-empty" v-else>
            <div class="ep-empty">
              <div class="ep-empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg></div>
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
const logoFileInput = ref(null)
const logoUploading = ref(false)

// Nav
const activeView = ref('basic')
const navChannelsOpen = ref(true)

// Accordion
const openAccordions = ref(new Set())
const accChannels = reactive({})
const categoriesWithChannels = computed(() => categories.value)

// Sort
let sortDragIdx = null
const sortSelectedCat = ref(null)
const sortCatChannels = ref([])
const sortCatLoading = ref(false)
let sortChanDragIdx = null

// Category editor
const showCatCreate = ref(false)
const newCatName = ref('')
const editingCat = ref(null)
const editCatName = ref('')
const deletingCat = ref(null)
const hiddenCats = ref(new Set())
const inlineEditCatId = ref(null)
const inlineEditName = ref('')

// Xtream
const showXtreamModal = ref(false)
const xtreamForm = ref({ serverUrl: '', username: '', password: '' })
const importing = ref(false)
const importResult = ref(null)
const importError = ref('')
const savedXtream = ref(null) // { serverUrl, username, lastSynced }
const syncing = ref(false)

// EPG
const epgSources = ref([])
const newEpgUrl = ref('')
const addingEpg = ref(false)
const autoMatching = ref(false)
const matchResult = ref(null)
const epgSelectedChannelId = ref(null)
const epgPrograms = ref([])
const allChannels = ref([])
const editChannelEpg = ref([])

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
    if (pl?.xtream_server_url) {
      savedXtream.value = { serverUrl: pl.xtream_server_url, username: pl.xtream_username, lastSynced: pl.last_synced_at }
    }
    categories.value = catRes.data
    await loadChannels()
    await loadTotalCount()
  } catch { toast('Yüklenirken hata oluştu', 'error') }
  finally { pageLoading.value = false }
})

// Load EPG sources and all channels when switching to epg view
watch(activeView, v => { if (v === 'epg') { loadEpgSources(); loadAllChannels() } })

// Load EPG data when editing channel changes
watch(editingChannel, ch => { if (ch) loadEditChannelEpg() })

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

async function resetChannel() {
  if (!editingChannel.value) return
  try {
    const { data } = await api.post(`/channels/${editingChannel.value.id}/reset`)
    editForm.value = { name: data.name, logo_url: data.logo_url || '', epg_channel_id: data.epg_channel_id || '', category_id: data.category_id || null, stream_url: data.stream_url || '' }
    editingChannel.value = data
    toast('Xtream orijinaline döndürüldü', 'success')
    loadChannels()
  } catch (e) { toast(e.response?.data?.error?.message || 'Sıfırlama hatası', 'error') }
}

function triggerLogoUpload() {
  logoFileInput.value?.click()
}

async function handleLogoUpload(event) {
  const file = event.target.files?.[0]
  if (!file || !editingChannel.value) return
  if (file.size > 2 * 1024 * 1024) { toast('Resim 2MB\'dan büyük olamaz', 'error'); return }

  logoUploading.value = true
  try {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const { data } = await api.post(`/channels/${editingChannel.value.id}/logo`, { imageData: e.target.result })
        editForm.value.logo_url = data.logo_url || ''
        editingChannel.value = { ...editingChannel.value, logo_url: data.logo_url }
        toast('Logo yüklendi', 'success')
      } catch (err) { toast(err.response?.data?.error?.message || 'Logo yükleme hatası', 'error') }
      finally { logoUploading.value = false }
    }
    reader.readAsDataURL(file)
  } catch { logoUploading.value = false }
  // Reset file input so same file can be re-selected
  event.target.value = ''
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
    // Identify source categories before moving
    const affectedCats = new Set()
    for (const chId of selectedIds.value) {
      // Find channel in accordion cache to get its current category
      for (const catId in accChannels) {
        const ch = accChannels[catId]?.find(c => c.id === chId)
        if (ch) affectedCats.add(catId)
      }
    }
    // Add target category to affected list
    affectedCats.add(bulkTargetCat.value)

    await api.post('/channels/bulk', { action: 'move', channelIds: [...selectedIds.value], targetCategoryId: bulkTargetCat.value })
    showBulkMove.value = false; selectedIds.value = new Set(); toast('Taşındı', 'success')

    // Clear cached accordion data for all affected categories
    for (const catId of affectedCats) {
      delete accChannels[catId]
    }

    loadChannels(); loadCategories()

    // Reload accordion channels for affected categories that are currently open
    for (const catId of openAccordions.value) {
      if (affectedCats.has(catId)) {
        loadAccChannels(catId)
      }
    }
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
function toggleCatHidden(catId) { const s = new Set(hiddenCats.value); s.has(catId) ? s.delete(catId) : s.add(catId); hiddenCats.value = s }
function startInlineEdit(cat) { inlineEditCatId.value = cat.id; inlineEditName.value = cat.name }
async function saveInlineEdit(cat) {
  if (!inlineEditName.value.trim() || inlineEditName.value === cat.name) { inlineEditCatId.value = null; return }
  try { await api.put(`/categories/${cat.id}`, { name: inlineEditName.value.trim() }); toast('Yeniden adlandırıldı', 'success'); loadCategories() }
  catch (e) { toast(e.response?.data?.error?.message || 'Hata', 'error') }
  finally { inlineEditCatId.value = null }
}
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

async function selectSortCat(cat) {
  sortSelectedCat.value = cat
  sortCatLoading.value = true
  try {
    const { data } = await api.get(`/playlists/${playlistId}/channels`, { params: { categoryId: cat.id, limit: 1000 } })
    sortCatChannels.value = data.channels || data
  } catch { toast('Kanallar yüklenemedi', 'error') }
  finally { sortCatLoading.value = false }
}

async function chanDrop(idx) {
  if (sortChanDragIdx === null || sortChanDragIdx === idx) return
  const ch = sortCatChannels.value[sortChanDragIdx]
  const moved = sortCatChannels.value.splice(sortChanDragIdx, 1)[0]
  sortCatChannels.value.splice(idx, 0, moved)
  sortChanDragIdx = null
  try { await api.put(`/channels/${ch.id}/order`, { newPosition: idx }) }
  catch { toast('Kanal sıralama hatası', 'error') }
}

function openXtream() { showXtreamModal.value = true; importResult.value = null; importError.value = '' }
async function doXtreamImport() {
  importing.value = true; importResult.value = null; importError.value = ''
  try {
    const { data } = await api.post(`/playlists/${playlistId}/import/xtream`, xtreamForm.value)
    importResult.value = data; toast(`${data.totalChannels} kanal içe aktarıldı`, 'success')
    // Refresh saved xtream info
    const plRes = await api.get('/playlists')
    const pl = plRes.data.find(p => String(p.id) === String(playlistId))
    if (pl?.xtream_server_url) savedXtream.value = { serverUrl: pl.xtream_server_url, username: pl.xtream_username, lastSynced: pl.last_synced_at }
    loadCategories(); loadChannels(); loadTotalCount()
    for (const catId of openAccordions.value) loadAccChannels(catId)
  } catch (e) { importError.value = e.response?.data?.error?.message || 'Bağlantı hatası.' }
  finally { importing.value = false }
}
async function doSync() {
  syncing.value = true
  try {
    const { data } = await api.post(`/playlists/${playlistId}/sync`)
    toast(`Güncellendi: +${data.added} eklendi, ${data.updated} güncellendi, ${data.removed} silindi`, 'success')
    const plRes = await api.get('/playlists')
    const pl = plRes.data.find(p => String(p.id) === String(playlistId))
    if (pl?.last_synced_at) savedXtream.value = { ...savedXtream.value, lastSynced: pl.last_synced_at }
    loadCategories(); loadChannels(); loadTotalCount()
  } catch (e) { toast(e.response?.data?.error?.message || 'Güncelleme hatası', 'error') }
  finally { syncing.value = false }
}

async function loadAllChannels() {
  try { const { data } = await api.get(`/playlists/${playlistId}/channels`, { params: { limit: 10000 } }); allChannels.value = data.channels || data }
  catch { allChannels.value = [] }
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
async function loadEditChannelEpg() {
  if (!editingChannel.value?.id) { editChannelEpg.value = []; return }
  try { const { data } = await api.get(`/channels/${editingChannel.value.id}/epg/preview`); editChannelEpg.value = data }
  catch { editChannelEpg.value = [] }
}
function isProgramLive(prog) {
  const now = new Date()
  return new Date(prog.start_time) <= now && now <= new Date(prog.end_time)
}
function getCurrentAndNext() {
  const now = new Date()
  const upcoming = editChannelEpg.value.filter(p => new Date(p.start_time) >= now || isProgramLive(p))
  return upcoming.slice(0, 3)
}

async function doExport() {
  try {
    const params = {}
    if (hiddenCats.value.size > 0) params.excludeCategories = [...hiddenCats.value].join(',')
    const { data } = await api.get(`/playlists/${playlistId}/export`, { responseType: 'blob', params })
    const url = URL.createObjectURL(new Blob([data])); const a = document.createElement('a'); a.href = url; a.download = 'playlist.m3u'; a.click(); URL.revokeObjectURL(url)
    const hiddenCount = hiddenCats.value.size
    toast(hiddenCount > 0 ? `M3U indirildi (${hiddenCount} kategori hariç)` : 'M3U indirildi', 'success')
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
.editor { display: flex; flex-direction: column; height: calc(100vh - var(--header-height, 52px)); }
.editor-loading { display: flex; align-items: center; justify-content: center; height: calc(100vh - var(--header-height, 52px)); }
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
  transition: all 0.15s; border-left: 2px solid transparent;
  border-radius: 0 6px 6px 0; margin-right: 8px;
}
.nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.nav-item.active {
  background: var(--accent-soft); color: var(--accent-hover);
  border-left-color: var(--accent); font-weight: 500;
}
.nav-item-icon { flex-shrink: 0; width: 18px; display: flex; align-items: center; justify-content: center; }
.nav-bottom { margin-top: auto; border-top: 1px solid var(--border); padding: 8px 0; }
.nav-bottom .nav-item { padding-left: 16px; margin-right: 8px; }

/* Main area */
.main-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; min-width: 0; }
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

.content-split { display: flex; flex: 1; overflow: hidden; min-height: 0; }

/* Center panel */
.center-panel { flex: 1; overflow: hidden; padding: 0; background: var(--bg-primary); display: flex; flex-direction: column; }
.center-loading { display: flex; justify-content: center; padding: 60px; }
.center-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 60px; color: var(--text-muted); font-size: 13px; }

/* Editor two-panel split (basic view) */
.editor-split { display: flex; height: 100%; overflow: hidden; }

/* Category sidebar */
.cat-sidebar { width: 220px; min-width: 180px; border-right: 1px solid var(--border); display: flex; flex-direction: column; background: var(--bg-secondary); flex-shrink: 0; }
.cat-sidebar-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; border-bottom: 1px solid var(--border);
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted);
  flex-shrink: 0;
}
.cat-sidebar-title { flex: 1; }
.cat-sidebar-list { flex: 1; overflow-y: auto; padding: 6px; }
.cat-sb-item {
  display: flex; align-items: center; gap: 6px; padding: 7px 8px;
  border-radius: var(--radius); cursor: pointer; font-size: 12px;
  color: var(--text-secondary); transition: all 0.15s; margin-bottom: 2px;
  border: 1px solid transparent; position: relative;
}
.cat-sb-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.cat-sb-item:hover .cat-sb-actions { opacity: 1; }
.cat-sb-item.active { background: var(--accent-soft); color: var(--accent-hover); border-color: rgba(99,102,241,0.2); font-weight: 500; }
.cat-sb-item.cat-sb-hidden { opacity: 0.45; }
.cat-sb-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cat-sb-count { font-size: 10px; color: var(--text-muted); background: var(--bg-tertiary); padding: 1px 6px; border-radius: 8px; flex-shrink: 0; }
.cat-sb-actions { display: flex; gap: 2px; opacity: 0; transition: opacity 0.15s; flex-shrink: 0; }
.cat-sb-btn {
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 4px; border: none; background: transparent;
  color: var(--text-muted); cursor: pointer; transition: all 0.15s;
}
.cat-sb-btn:hover { background: var(--bg-primary); color: var(--text-primary); }
.cat-sb-btn-danger:hover { color: var(--danger); }
.cat-sb-input {
  flex: 1; background: var(--bg-primary); border: 1px solid var(--accent);
  border-radius: 4px; padding: 2px 6px; font-size: 12px; color: var(--text-primary);
  outline: none; min-width: 0;
}

/* Channel main area */
.channel-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-primary); }
.channel-table-wrap { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }

/* View headers */
.view-header { padding: 16px 20px 8px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.view-header h3 { font-size: 15px; font-weight: 600; }
.view-desc { font-size: 12px; color: var(--text-muted); width: 100%; }
.view-header-actions { display: flex; gap: 6px; }

/* Accordion */
.accordion-list { display: flex; flex-direction: column; gap: 8px; padding: 8px; }
.accordion-group {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-md); overflow: hidden;
  transition: all var(--transition);
}
.accordion-group:hover { border-color: var(--border-light); box-shadow: var(--shadow-sm); }
.accordion-header {
  display: flex; align-items: center; gap: 10px; padding: 12px 16px;
  cursor: pointer; font-size: 13px; transition: all var(--transition); user-select: none;
  background: linear-gradient(135deg, transparent 0%, rgba(99,102,241,0.02) 100%);
}
.accordion-header:hover { background: var(--bg-hover); }
.accordion-header:active { transform: scale(0.995); }
.acc-arrow {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  color: var(--text-muted); flex-shrink: 0;
}
.acc-arrow.open { transform: rotate(90deg); color: var(--accent); }
.acc-title { font-weight: 600; flex: 1; color: var(--text-primary); }
.acc-count {
  font-size: 11px; font-weight: 500; color: var(--text-muted);
  background: var(--bg-tertiary); padding: 2px 8px; border-radius: 12px;
}
.accordion-body {
  background: var(--bg-secondary); border-top: 1px solid var(--border);
  animation: slideDown 0.2s ease;
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.acc-loading { padding: 16px 20px; display: flex; align-items: center; gap: 8px; color: var(--text-muted); }
.acc-empty { padding: 16px 20px; font-size: 12px; color: var(--text-muted); text-align: center; }

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
.sort-panels { display: flex; gap: 0; height: 100%; overflow: hidden; }
.sort-panel { display: flex; flex-direction: column; overflow: hidden; }
.sort-panel-cats { width: 240px; min-width: 180px; border-right: 1px solid var(--border); flex-shrink: 0; }
.sort-panel-channels { flex: 1; overflow: hidden; }
.sort-panel-title {
  padding: 10px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-muted); border-bottom: 1px solid var(--border);
  background: var(--bg-secondary); flex-shrink: 0;
}
.sort-list { padding: 8px; overflow-y: auto; flex: 1; }
.sort-item {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px;
  background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius);
  margin-bottom: 4px; cursor: grab; transition: background 0.15s, border-color 0.15s;
}
.sort-item:hover { background: var(--bg-hover); }
.sort-item-active { border-color: var(--accent) !important; background: var(--bg-hover) !important; }
.sort-handle { color: var(--text-muted); cursor: grab; flex-shrink: 0; transition: color 0.15s ease; }
.sort-item:hover .sort-handle { color: var(--text-secondary); }
.sort-name { flex: 1; font-size: 13px; font-weight: 500; }
.sort-count { font-size: 11px; color: var(--text-muted); min-width: 20px; text-align: right; }
.sort-ch-logo { width: 22px; height: 22px; object-fit: contain; border-radius: 3px; flex-shrink: 0; }
.sort-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; height: 200px; color: var(--text-muted); font-size: 13px;
}

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
.epg-program { padding: 10px 14px; border-bottom: 1px solid var(--border); transition: all var(--transition); }
.epg-program:last-child { border-bottom: none; }
.epg-program.live { background: var(--danger-soft); border-left: 3px solid var(--danger); }
.epg-prog-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.epg-prog-time { font-size: 11px; font-weight: 600; color: var(--accent-hover); }
.epg-prog-title { font-size: 13px; font-weight: 500; margin-bottom: 2px; }
.epg-prog-desc { font-size: 11px; color: var(--text-muted); margin-top: 2px; line-height: 1.4; }
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

/* Xtream source card */
.xtream-source-card {
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 16px; margin-bottom: 8px;
}
.xtream-source-header { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.xtream-source-icon {
  width: 40px; height: 40px; border-radius: var(--radius); background: var(--accent);
  display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0;
}
.xtream-source-info { flex: 1; min-width: 0; }
.xtream-source-title { font-size: 13px; font-weight: 600; margin-bottom: 2px; }
.xtream-source-detail { font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.xtream-source-meta { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-muted); margin-bottom: 12px; }
.xtream-source-actions { display: flex; gap: 8px; }

/* No source state */
.xtream-no-source {
  text-align: center; padding: 32px 16px; background: var(--bg-secondary);
  border: 1px dashed var(--border); border-radius: var(--radius-lg); margin-bottom: 8px;
}
.xtream-no-source-icon { opacity: 0.3; margin-bottom: 12px; display: flex; justify-content: center; }
.xtream-no-source p { font-size: 13px; color: var(--text-muted); margin-bottom: 16px; }

/* Edit panel */
.edit-panel {
  width: 300px; min-width: 300px; background: var(--bg-secondary);
  border-left: 1px solid var(--border); display: flex; flex-direction: column;
  overflow: hidden; min-height: 0; align-self: stretch;
}
.edit-panel-empty { justify-content: center; align-items: center; }
.ep-empty { text-align: center; color: var(--text-muted); }
.ep-empty-icon { font-size: 48px; margin-bottom: 12px; opacity: 0.3; }
.ep-empty p { font-size: 13px; margin-bottom: 4px; }
.ep-empty-hint { font-size: 11px; }
.ep-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--border); }
.ep-header h3 { font-size: 14px; font-weight: 600; }
.ep-body { flex: 1; overflow-y: auto; display: flex; flex-direction: column; min-height: 0; }
.ep-logo-area { display: flex; justify-content: center; padding: 14px; }
.ep-logo-preview {
  position: relative; cursor: pointer; width: 64px; height: 64px; border-radius: 8px; overflow: hidden;
}
.ep-logo-preview img {
  width: 64px; height: 64px; border-radius: 8px; object-fit: cover; background: var(--bg-tertiary);
  transition: filter 0.2s;
}
.ep-logo-preview:hover img { filter: blur(2px) brightness(0.6); }
.ep-logo-overlay {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.2s; background: rgba(0,0,0,0.4); border-radius: 8px;
}
.ep-logo-preview:hover .ep-logo-overlay { opacity: 1; }
.ep-logo-placeholder {
  width: 64px; height: 64px; border-radius: 8px; background: var(--bg-tertiary);
  display: flex; align-items: center; justify-content: center; font-size: 24px;
}
.ep-logo-upload {
  cursor: pointer; flex-direction: column; gap: 4px; border: 1.5px dashed var(--border);
  transition: border-color 0.2s, background 0.2s;
}
.ep-logo-upload:hover { border-color: var(--accent); background: var(--bg-primary); }
.ep-logo-upload-hint { font-size: 9px; color: var(--text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
.ep-form { flex: 1; padding: 0 14px 14px; }
.ep-form .form-group { margin-bottom: 10px; }
.ep-form .form-row { display: flex; gap: 8px; }
.ep-form label { display: block; font-size: 10px; font-weight: 600; color: var(--text-muted); margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
.ep-btn-row { display: flex; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--border); flex-shrink: 0; }

/* Edit panel EPG section */
.ep-epg-section { border-top: 1px solid var(--border); padding: 12px 14px; background: var(--bg-primary); }
.ep-epg-header { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
.ep-epg-list { display: flex; flex-direction: column; gap: 8px; }
.ep-epg-item { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 10px; }
.ep-epg-item-header { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
.ep-epg-time { font-size: 10px; font-weight: 600; color: var(--accent-hover); }
.ep-epg-title { font-size: 12px; font-weight: 500; margin-bottom: 2px; }
.ep-epg-desc { font-size: 10px; color: var(--text-muted); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

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
