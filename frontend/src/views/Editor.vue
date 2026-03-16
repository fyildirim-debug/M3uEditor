<template>
  <div class="editor" v-if="!pageLoading">
    <div class="editor-body">
      <!-- Left nav sidebar -->
      <nav class="nav-sidebar">
        <!-- Canli Kanallar -->
        <div class="nav-section">
          <div :class="['nav-section-header', { 'nav-section-active': activeStreamType === 'live' }]" @click="toggleStreamSection('live')">
            <span class="nav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg></span>
            <span class="nav-section-title">{{ t('nav.liveChannels') }}</span>
            <span v-if="streamTypeCounts.live" class="nav-section-count">{{ streamTypeCounts.live }}</span>
            <svg :class="['nav-chevron', { open: activeStreamType === 'live' }]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div v-if="activeStreamType === 'live'" class="nav-items">
            <div :class="['nav-item', { active: activeView === 'basic' }]" @click="activeView = 'basic'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> {{ t('nav.channelEditor') }}
            </div>
            <div :class="['nav-item', { active: activeView === 'sort' }]" @click="activeView = 'sort'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/></svg> {{ t('nav.sorting') }}
            </div>
            <div :class="['nav-item', { active: activeView === 'epg' }]" @click="activeView = 'epg'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> {{ t('nav.epgEditor') }}
            </div>
            <div :class="['nav-item', { active: activeView === 'category' }]" @click="activeView = 'category'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> {{ t('nav.categoryEditor') }}
            </div>
            <div :class="['nav-item', { active: activeView === 'update' }]" @click="activeView = 'update'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg> {{ t('nav.update') }}
            </div>
          </div>
        </div>
        <!-- Filmler -->
        <div class="nav-section">
          <div :class="['nav-section-header', { 'nav-section-active': activeStreamType === 'vod' }]" @click="toggleStreamSection('vod')">
            <span class="nav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/></svg></span>
            <span class="nav-section-title">{{ t('nav.movies') }}</span>
            <span v-if="streamTypeCounts.vod" class="nav-section-count">{{ streamTypeCounts.vod }}</span>
            <svg :class="['nav-chevron', { open: activeStreamType === 'vod' }]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div v-if="activeStreamType === 'vod'" class="nav-items">
            <div :class="['nav-item', { active: activeView === 'basic' }]" @click="activeView = 'basic'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> {{ t('nav.channelEditor') }}
            </div>
            <div :class="['nav-item', { active: activeView === 'sort' }]" @click="activeView = 'sort'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/></svg> {{ t('nav.sorting') }}
            </div>
            <div :class="['nav-item', { active: activeView === 'category' }]" @click="activeView = 'category'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> {{ t('nav.categoryEditor') }}
            </div>
          </div>
        </div>
        <!-- Diziler -->
        <div class="nav-section">
          <div :class="['nav-section-header', { 'nav-section-active': activeStreamType === 'series' }]" @click="toggleStreamSection('series')">
            <span class="nav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg></span>
            <span class="nav-section-title">{{ t('nav.series') }}</span>
            <span v-if="streamTypeCounts.series" class="nav-section-count">{{ streamTypeCounts.series }}</span>
            <svg :class="['nav-chevron', { open: activeStreamType === 'series' }]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div v-if="activeStreamType === 'series'" class="nav-items">
            <div :class="['nav-item', { active: activeView === 'basic' }]" @click="activeView = 'basic'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> {{ t('nav.channelEditor') }}
            </div>
            <div :class="['nav-item', { active: activeView === 'sort' }]" @click="activeView = 'sort'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/></svg> {{ t('nav.sorting') }}
            </div>
            <div :class="['nav-item', { active: activeView === 'category' }]" @click="activeView = 'category'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> {{ t('nav.categoryEditor') }}
            </div>
          </div>
        </div>
        <div class="nav-bottom">
          <div class="nav-item" @click="$router.push('/dashboard')">
            <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> {{ t('nav.dashboard') }}
          </div>
          <div class="nav-item" @click="doExport">
            <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> {{ t('nav.downloadM3u') }}
          </div>
          <div class="nav-item" @click="doShare">
            <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> {{ t('nav.share') }}
          </div>
        </div>
      </nav>

      <!-- Main content area -->
      <div class="main-area">
        <!-- Top bar -->
        <div class="top-bar">
          <div class="top-bar-left">
            <h2 class="playlist-title">{{ playlistName }}</h2>
            <span class="channel-count-badge">{{ totalChannelCount }} {{ t('common.channel') }}</span>
          </div>
          <div class="top-bar-right">
            <div class="search-box">
              <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input class="search-input" v-model="search" :placeholder="t('editor.searchPlaceholder')" @input="debouncedSearch" />
            </div>
            <button class="btn btn-secondary btn-sm" @click="openXtream">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg> {{ t('xtream.importTitle') }}
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
                    <span class="cat-sidebar-title">{{ t('common.categories') }}</span>
                    <button class="btn btn-ghost btn-icon-sm" @click="showCatCreate = true" :title="t('editor.newCategory')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                  </div>
                  <div class="cat-sidebar-list">
                    <div :class="['cat-sb-item', { active: !selectedCatId }]" @click="selectCategory(null)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>
                      <span class="cat-sb-name">{{ t('editor.allChannels') }}</span>
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
                        <button class="cat-sb-btn" @click.stop="toggleCatHidden(cat.id)" :title="hiddenCats.has(cat.id) ? t('editor.showCategory') : t('editor.hideCategory')">
                          <svg v-if="!hiddenCats.has(cat.id)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        </button>
                        <button class="cat-sb-btn" @click.stop="startInlineEdit(cat)" :title="t('editor.rename')">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="cat-sb-btn cat-sb-btn-danger" @click.stop="confirmDeleteCat(cat)" :title="t('common.delete')">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Sağ: Kanal Listesi -->
                <div class="channel-main">
                  <div v-if="selectedIds.size > 0" class="bulk-bar">
                    <span class="badge badge-accent">{{ selectedIds.size }} {{ t('common.selected') }}</span>
                    <button class="btn btn-secondary btn-xs" @click="showBulkMove = true">{{ t('common.move') }}</button>
                    <button class="btn btn-danger btn-xs" @click="bulkDelete">{{ t('common.delete') }}</button>
                  </div>
                  <div v-if="channelsLoading" class="center-loading"><span class="spinner"></span></div>
                  <div v-else-if="channels.length === 0 && !search" class="center-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>
                    <p>{{ selectedCatId ? t('editor.noChannelsInCat') : t('editor.noChannels') }}</p>
                  </div>
                  <div v-else-if="channels.length === 0 && search" class="center-empty">
                    <p>{{ t('common.noResults') }}</p>
                  </div>
                  <div v-else class="channel-table-wrap">
                    <table class="ch-table">
                      <thead>
                        <tr>
                          <th class="th-check"><input type="checkbox" @change="toggleSelectAll" :checked="allSelected" /></th>
                          <th class="th-num">#</th>
                          <th class="th-name">{{ t('table.name') }}</th>
                          <th class="th-url">{{ t('table.url') }}</th>
                          <th class="th-epg">{{ t('table.epg') }}</th>
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
                              <img v-if="ch.logo_url" :src="ch.logo_url" class="row-logo" loading="lazy" @error="$event.target.style.display='none'" />
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
                <h3>{{ t('sort.title') }}</h3>
                <p class="view-desc">{{ t('sort.instruction') }}</p>
              </div>
              <div class="sort-panels">
                <!-- Sol: Kategoriler -->
                <div class="sort-panel sort-panel-cats">
                  <div class="sort-panel-title">{{ t('common.categories') }}</div>
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
                    {{ sortSelectedCat ? sortSelectedCat.name + ' ' + t('common.channels') : t('sort.selectCategory') }}
                  </div>
                  <div v-if="!sortSelectedCat" class="sort-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/></svg>
                    <span>{{ t('sort.selectFromLeft') }}</span>
                  </div>
                  <div v-else-if="sortCatLoading" class="sort-empty"><span class="spinner"></span></div>
                  <div v-else-if="sortCatChannels.length === 0" class="sort-empty">{{ t('sort.noChannels') }}</div>
                  <div v-else class="sort-list">
                    <div v-for="(ch, idx) in sortVisibleChannels" :key="ch.id" class="sort-item"
                      draggable="true"
                      @dragstart="sortChanDragIdx = idx"
                      @dragover.prevent
                      @drop="chanDrop(idx)">
                      <svg class="sort-handle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1" fill="currentColor" stroke="none"/></svg>
                      <img v-if="ch.logo_url" :src="ch.logo_url" class="sort-ch-logo" loading="lazy" @error="$event.target.style.display='none'" />
                      <span class="sort-name">{{ ch.name }}</span>
                      <span class="sort-count">#{{ idx + 1 }}</span>
                    </div>
                    <button v-if="sortRenderCount < sortCatChannels.length" class="btn btn-secondary btn-sm load-more-btn" @click="sortRenderCount += SORT_RENDER_LIMIT">
                      {{ t('common.showMore', { count: sortCatChannels.length - sortRenderCount }) }}
                    </button>
                  </div>
                </div>
              </div>
            </template>

            <!-- EPG EDITOR VIEW -->
            <template v-if="activeView === 'epg'">
              <!-- EPG Top Bar: Tabs + Actions -->
              <div class="epg-topbar">
                <div class="epg-tabs">
                  <button :class="['epg-tab', { active: epgTab === 'guide' }]" @click="epgTab = 'guide'">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                    {{ t('epg.guideTab') }}
                  </button>
                  <button :class="['epg-tab', { active: epgTab === 'sources' }]" @click="epgTab = 'sources'">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/></svg>
                    {{ t('epg.sourcesTab') }}
                    <span v-if="epgSources.length" class="epg-tab-badge">{{ epgSources.length }}</span>
                  </button>
                </div>
                <div class="epg-topbar-actions">
                  <button v-if="epgTab === 'guide'" class="btn btn-secondary btn-sm" @click="doAutoMatch" :disabled="autoMatching || !epgSources.length">
                    <span v-if="autoMatching" class="spinner" style="width:13px;height:13px"></span>
                    <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    {{ t('epg.autoMatch') }}
                  </button>
                  <span v-if="matchResult" class="badge badge-success">{{ matchResult.matched }}/{{ matchResult.total }}</span>
                </div>
              </div>

              <!-- TAB: TV Guide Grid -->
              <div v-if="epgTab === 'guide'" class="epg-guide-wrap">
                <!-- Date Navigation -->
                <div class="epg-date-nav">
                  <button class="epg-date-btn" @click="changeGuideDate(-1)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <div class="epg-date-pills">
                    <button v-for="d in guideDateOptions" :key="d.value"
                      :class="['epg-date-pill', { active: guideDate === d.value, today: d.isToday }]"
                      @click="guideDate = d.value; loadGuide()">
                      <span class="epg-date-day">{{ d.dayName }}</span>
                      <span class="epg-date-num">{{ d.dayNum }}</span>
                    </button>
                  </div>
                  <button class="epg-date-btn" @click="changeGuideDate(1)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>

                <!-- Guide Grid -->
                <div v-if="guideLoading" class="epg-guide-loading">
                  <span class="spinner"></span>
                  <span>{{ t('epg.loadingGuide') }}</span>
                </div>
                <div v-else-if="guideChannels.length === 0" class="epg-guide-empty">
                  <div class="epg-guide-empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  </div>
                  <p>{{ t('epg.noData') }}</p>
                  <span class="epg-guide-empty-hint">{{ t('epg.emptyHint') }}</span>
                </div>
                <div v-else class="epg-grid-container" ref="epgGridRef">
                  <!-- Time Header -->
                  <div class="epg-grid-corner">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <div class="epg-time-header" ref="epgTimeHeaderRef">
                    <div class="epg-time-track" :style="{ width: guideTrackWidth + 'px' }">
                      <div v-for="h in 24" :key="h" class="epg-time-slot" :style="{ left: ((h-1) * hourWidth) + 'px', width: hourWidth + 'px' }">
                        <span class="epg-time-label">{{ String(h-1).padStart(2,'0') }}:00</span>
                      </div>
                      <!-- Now indicator in header -->
                      <div v-if="isGuideToday" class="epg-now-marker-top" :style="{ left: nowOffset + 'px' }"></div>
                    </div>
                  </div>
                  <!-- Channel Rows -->
                  <div class="epg-channel-col" ref="epgChannelColRef">
                    <div v-for="ch in guideChannels" :key="ch.id" class="epg-ch-row-label">
                      <img v-if="ch.logo_url" :src="ch.logo_url" class="epg-ch-logo" loading="lazy" @error="$event.target.style.display='none'" />
                      <div v-else class="epg-ch-logo-fb">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>
                      </div>
                      <span class="epg-ch-name">{{ ch.name }}</span>
                    </div>
                  </div>
                  <div class="epg-grid-body" ref="epgGridBodyRef" @scroll="onGridScroll">
                    <div class="epg-grid-track" :style="{ width: guideTrackWidth + 'px' }">
                      <div v-for="ch in guideChannels" :key="ch.id" class="epg-grid-row">
                        <!-- Hour grid lines -->
                        <div v-for="h in 24" :key="'g'+h" class="epg-grid-line" :style="{ left: ((h-1) * hourWidth) + 'px' }"></div>
                        <!-- Program blocks -->
                        <div v-for="prog in ch.programs" :key="prog.id"
                          :class="['epg-prog-block', { live: isProgramLive(prog), past: isProgramPast(prog) }]"
                          :style="getProgramStyle(prog)"
                          @click="showProgramDetail(prog, ch)"
                          :title="prog.title">
                          <span class="epg-prog-block-title">{{ prog.title }}</span>
                          <span class="epg-prog-block-time">{{ formatTime(prog.start_time) }}</span>
                        </div>
                        <!-- Empty state for row -->
                        <div v-if="!ch.programs.length" class="epg-row-empty">{{ t('epg.rowEmpty') }}</div>
                      </div>
                      <!-- Now indicator line -->
                      <div v-if="isGuideToday" class="epg-now-line" :style="{ left: nowOffset + 'px' }">
                        <div class="epg-now-dot"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- TAB: Sources Management -->
              <div v-if="epgTab === 'sources'" class="epg-sources-wrap">
                <!-- Add Source -->
                <div class="epg-add-card">
                  <div class="epg-add-card-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </div>
                  <div class="epg-add-card-body">
                    <div class="epg-add-card-title">{{ t('epg.addSourceTitle') }}</div>
                    <div class="epg-add-card-desc">{{ t('epg.addSourceDesc') }}</div>
                    <div class="epg-add-input-row">
                      <input class="input" v-model="newEpgUrl" placeholder="https://epg-source.com/guide.xml" @keyup.enter="addEpgSource" />
                      <button class="btn btn-primary btn-sm" @click="addEpgSource" :disabled="addingEpg || !newEpgUrl.trim()">
                        <span v-if="addingEpg" class="spinner" style="width:13px;height:13px"></span>
                        <span v-else>{{ t('common.add') }}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Source List -->
                <div v-if="epgSources.length" class="epg-source-cards">
                  <div v-for="s in epgSources" :key="s.id" class="epg-src-card">
                    <div class="epg-src-card-header">
                      <div :class="['epg-src-status', 'status-' + s.status]">
                        <svg v-if="s.status === 'active'" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
                        <svg v-else-if="s.status === 'error'" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
                        <svg v-else width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
                      </div>
                      <div class="epg-src-info">
                        <div class="epg-src-url">{{ s.url }}</div>
                        <div class="epg-src-meta">
                          <span :class="['epg-src-badge', 'badge-' + s.status]">{{ s.status === 'active' ? t('epg.statusActive') : s.status === 'error' ? t('epg.statusError') : t('epg.statusPending') }}</span>
                          <span v-if="s.last_fetched_at" class="epg-src-date">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            {{ formatDateTime(s.last_fetched_at) }}
                          </span>
                        </div>
                      </div>
                      <div class="epg-src-actions">
                        <button class="epg-src-btn" @click="refreshEpgSource(s)" :disabled="s._refreshing" :title="t('common.refresh')">
                          <span v-if="s._refreshing" class="spinner" style="width:12px;height:12px"></span>
                          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                        </button>
                        <button class="epg-src-btn epg-src-btn-danger" @click="deleteEpgSource(s)" :title="t('common.delete')">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="epg-no-sources">
                  <div class="epg-no-sources-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/></svg>
                  </div>
                  <p>{{ t('epg.noSources') }}</p>
                  <span>{{ t('epg.addSourcesHint') }}</span>
                </div>
              </div>
            </template>

            <!-- CATEGORY EDITOR VIEW -->
            <template v-if="activeView === 'category'">
              <div class="view-header">
                <h3>{{ t('categoryEditor.title') }}</h3>
                <div class="view-header-actions">
                  <button class="btn btn-primary btn-sm" @click="showCatCreate = true">{{ t('categoryEditor.newCategory') }}</button>
                </div>
              </div>
              <div class="cat-editor-list">
                <div v-for="cat in categories" :key="cat.id" class="cat-editor-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  <span class="cat-editor-name">{{ cat.name }}</span>
                  <span class="cat-editor-count">{{ cat.channel_count || 0 }} {{ t('common.channel') }}</span>
                  <div class="cat-editor-actions">
                    <button class="btn btn-ghost btn-xs" @click="startEditCat(cat)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> {{ t('common.edit') }}</button>
                    <button class="btn btn-ghost btn-xs" style="color:var(--danger)" @click="confirmDeleteCat(cat)">{{ t('common.delete') }}</button>
                  </div>
                </div>
              </div>
            </template>

            <!-- UPDATE VIEW -->
            <template v-if="activeView === 'update'">
              <div class="view-header">
                <h3>{{ t('updateView.title') }}</h3>
                <p class="view-desc">{{ t('updateView.subtitle') }}</p>
              </div>
              <div class="update-panel">
                <!-- Saved Xtream source card -->
                <div v-if="savedXtream" class="xtream-source-card">
                  <div class="xtream-source-header">
                    <div class="xtream-source-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
                    </div>
                    <div class="xtream-source-info">
                      <div class="xtream-source-title">{{ t('xtream.sourceTitle') }}</div>
                      <div class="xtream-source-detail">{{ savedXtream.username }} @ {{ savedXtream.serverUrl }}</div>
                    </div>
                    <span class="badge badge-success" style="font-size:10px">{{ t('status.connected') }}</span>
                  </div>
                  <div class="xtream-source-meta" v-if="savedXtream.lastSynced">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {{ t('xtream.lastSynced') }} {{ new Date(savedXtream.lastSynced).toLocaleString() }}
                  </div>
                  <div class="xtream-source-actions">
                    <button class="btn btn-primary" @click="doSync" :disabled="syncing" style="flex:1">
                      <span v-if="syncing" class="spinner" style="width:14px;height:14px"></span>
                      <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                      {{ syncing ? t('xtream.updating') : t('xtream.updateChannels') }}
                    </button>
                    <button class="btn btn-secondary" @click="openXtream" :title="t('xtream.changeAccount')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      {{ t('common.change') }}
                    </button>
                  </div>
                </div>

                <!-- No saved source -->
                <div v-else class="xtream-no-source">
                  <div class="xtream-no-source-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
                  </div>
                  <p>{{ t('xtream.noSource') }}</p>
                  <button class="btn btn-primary" @click="openXtream">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    {{ t('xtream.addXtream') }}
                  </button>
                </div>

                <div class="update-info">
                  <div class="update-stat">
                    <span class="update-stat-label">{{ t('updateView.totalChannels') }}</span>
                    <span class="update-stat-value">{{ totalChannelCount }}</span>
                  </div>
                  <div class="update-stat">
                    <span class="update-stat-label">{{ t('common.category') }}</span>
                    <span class="update-stat-value">{{ categories.length }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Right: Edit panel (always visible) -->
          <aside class="edit-panel" v-if="editingChannel">
            <div class="ep-header">
              <h3>{{ t('editPanel.title') }}</h3>
              <button class="btn btn-ghost btn-icon-sm" @click="editingChannel = null">✕</button>
            </div>
            <div class="ep-body">
              <div class="ep-logo-area">
                <div v-if="editForm.logo_url" class="ep-logo-preview" @click="triggerLogoUpload" :title="t('editPanel.uploadLogo')">
                  <img :src="editForm.logo_url" @error="$event.target.style.display='none'" />
                  <div class="ep-logo-overlay">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </div>
                </div>
                <div v-else class="ep-logo-placeholder ep-logo-upload" @click="triggerLogoUpload" :title="t('editPanel.uploadLogo')">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span class="ep-logo-upload-hint">{{ t('common.upload') }}</span>
                </div>
                <input ref="logoFileInput" type="file" accept="image/*" style="display:none" @change="handleLogoUpload" />
              </div>
              <div class="ep-form">
                <div class="form-group epg-ac-wrap">
                  <label>{{ t('editPanel.channelName') }}</label>
                  <input class="input" v-model="editForm.name" @input="onNameInput" @focus="onNameFocus" @blur="onNameBlur" autocomplete="off" />
                  <!-- EPG Autocomplete Dropdown -->
                  <div v-if="epgAcResults.length > 0 && epgAcOpen" class="epg-ac-dropdown">
                    <div v-for="epgCh in epgAcResults" :key="epgCh.channel_id" class="epg-ac-item" @mousedown.prevent="selectEpgChannel(epgCh)">
                      <img v-if="epgCh.icon_url" :src="epgCh.icon_url" class="epg-ac-logo" @error="$event.target.style.display='none'" />
                      <div v-else class="epg-ac-logo-fb">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>
                      </div>
                      <div class="epg-ac-info">
                        <span class="epg-ac-name">{{ epgCh.display_name }}</span>
                        <span class="epg-ac-id">{{ epgCh.channel_id }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group epg-ac-wrap" style="flex:1">
                    <label>{{ t('editPanel.epgId') }}</label>
                    <input class="input" v-model="editForm.epg_channel_id" :placeholder="t('common.optional')" @input="onEpgIdInput" @focus="onEpgIdFocus" @blur="onEpgIdBlur" autocomplete="off" />
                    <div v-if="epgIdAcResults.length > 0 && epgIdAcOpen" class="epg-ac-dropdown">
                      <div v-for="epgCh in epgIdAcResults" :key="epgCh.channel_id" class="epg-ac-item" @mousedown.prevent="selectEpgFromId(epgCh)">
                        <img v-if="epgCh.icon_url" :src="epgCh.icon_url" class="epg-ac-logo" @error="$event.target.style.display='none'" />
                        <div v-else class="epg-ac-logo-fb">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>
                        </div>
                        <div class="epg-ac-info">
                          <span class="epg-ac-name">{{ epgCh.display_name }}</span>
                          <span class="epg-ac-id">{{ epgCh.channel_id }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <!-- EPG Logo Çekme Seçeneği -->
                <div v-if="epgSelectedIcon" class="epg-logo-offer">
                  <div class="epg-logo-offer-preview">
                    <img :src="epgSelectedIcon" class="epg-logo-offer-img" @error="epgSelectedIcon = null" />
                  </div>
                  <div class="epg-logo-offer-info">
                    <span class="epg-logo-offer-label">{{ t('editPanel.epgLogoAvailable') }}</span>
                    <button class="btn btn-accent btn-xs" @click="applyEpgLogo">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      {{ t('editPanel.getLogoFromEpg') }}
                    </button>
                  </div>
                </div>
                <div class="form-group"><label>{{ t('editPanel.logoUrl') }}</label><input class="input" v-model="editForm.logo_url" placeholder="https://..." /></div>
                <div class="form-group"><label>{{ t('editPanel.streamUrl') }}</label><input class="input" v-model="editForm.stream_url" /></div>
                <div class="form-group"><label>{{ t('common.category') }}</label>
                  <select class="input" v-model="editForm.category_id">
                    <option :value="null">{{ t('common.uncategorized') }}</option>
                    <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
                  </select>
                </div>
              </div>
              <!-- EPG Section -->
              <div v-if="editingChannel.epg_channel_id && getCurrentAndNext().length" class="ep-epg-section">
                <div class="ep-epg-header">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span>{{ t('editPanel.broadcast') }}</span>
                </div>
                <div class="ep-epg-list">
                  <div v-for="(prog, idx) in getCurrentAndNext()" :key="prog.id" class="ep-epg-item">
                    <div class="ep-epg-item-header">
                      <span class="ep-epg-time">{{ formatTime(prog.start_time) }}</span>
                      <span v-if="idx === 0 && isProgramLive(prog)" class="badge badge-danger" style="font-size:9px;padding:2px 6px">{{ t('epg.live') }}</span>
                      <span v-else-if="idx === 1" class="badge badge-accent" style="font-size:9px;padding:2px 6px">{{ t('epg.next') }}</span>
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
                {{ t('common.save') }}
              </button>
              <button class="btn btn-secondary" @click="resetChannel" :title="editingChannel.original_name ? t('editPanel.resetToOriginal') : t('editPanel.noOriginal')">
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
              <p>{{ t('editor.selectChannelToEdit') }}</p>
              <span class="ep-empty-hint">{{ t('editor.channelsAvailable', { count: totalChannelCount }) }}</span>
            </div>
          </aside>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <Teleport to="body">
      <div v-if="showXtreamModal" class="modal-overlay" @click.self="showXtreamModal = false">
        <div class="modal" style="max-width:500px">
          <div class="modal-header"><h3>{{ t('xtream.importTitle') }}</h3>
            <button class="btn btn-ghost btn-icon-sm" @click="showXtreamModal = false">✕</button>
          </div>
          <div class="form-group"><label>{{ t('xtream.serverUrl') }}</label><input class="input" v-model="xtreamForm.serverUrl" placeholder="http://example.com:8080" /></div>
          <div class="form-group"><label>{{ t('xtream.username') }}</label><input class="input" v-model="xtreamForm.username" /></div>
          <div class="form-group"><label>{{ t('xtream.password') }}</label><input class="input" type="password" v-model="xtreamForm.password" /></div>
          <div class="form-group">
            <label>{{ t('xtream.streamTypes') }}</label>
            <div class="stream-type-group">
              <label class="stream-type-label"><input type="checkbox" value="live" v-model="xtreamForm.streamTypes" /> {{ t('xtream.typeLive') }}</label>
              <label class="stream-type-label"><input type="checkbox" value="vod" v-model="xtreamForm.streamTypes" /> {{ t('xtream.typeVod') }}</label>
              <label class="stream-type-label"><input type="checkbox" value="series" v-model="xtreamForm.streamTypes" /> {{ t('xtream.typeSeries') }}</label>
            </div>
          </div>
          <div v-if="importResult" class="result-box success">
            {{ t('toast.importSuccess', { channels: importResult.totalChannels, categories: importResult.totalCategories, duration: (importResult.duration / 1000).toFixed(1) }) }}
          </div>
          <div v-if="importError" class="result-box error">{{ importError }}</div>
          <div class="modal-actions">
            <button class="btn btn-secondary" @click="showXtreamModal = false">{{ t('common.close') }}</button>
            <button class="btn btn-primary" @click="doXtreamImport" :disabled="importing || !xtreamForm.serverUrl || !xtreamForm.username || !xtreamForm.password || !xtreamForm.streamTypes.length">
              <span v-if="importing" class="spinner" style="width:14px;height:14px"></span>
              {{ importing ? t('common.importing') : t('common.import') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="showBulkMove" class="modal-overlay" @click.self="showBulkMove = false">
        <div class="modal">
          <div class="modal-header"><h3>{{ t('bulkMove.title') }}</h3><button class="btn btn-ghost btn-icon-sm" @click="showBulkMove = false">✕</button></div>
          <div class="form-group"><label>{{ t('bulkMove.targetCategory') }}</label>
            <select class="input" v-model="bulkTargetCat">
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" @click="showBulkMove = false">{{ t('common.cancel') }}</button>
            <button class="btn btn-primary" @click="doBulkMove" :disabled="!bulkTargetCat">{{ t('common.move') }}</button>
          </div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="showCatCreate" class="modal-overlay" @click.self="showCatCreate = false">
        <div class="modal">
          <div class="modal-header"><h3>{{ t('categoryEditor.createTitle') }}</h3><button class="btn btn-ghost btn-icon-sm" @click="showCatCreate = false">✕</button></div>
          <div class="form-group"><label>{{ t('categoryEditor.nameLabel') }}</label><input class="input" v-model="newCatName" @keyup.enter="createCategory" autofocus /></div>
          <div class="modal-actions"><button class="btn btn-secondary" @click="showCatCreate = false">{{ t('common.cancel') }}</button><button class="btn btn-primary" @click="createCategory" :disabled="!newCatName.trim()">{{ t('common.create') }}</button></div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="editingCat" class="modal-overlay" @click.self="editingCat = null">
        <div class="modal">
          <div class="modal-header"><h3>{{ t('categoryEditor.editTitle') }}</h3><button class="btn btn-ghost btn-icon-sm" @click="editingCat = null">✕</button></div>
          <div class="form-group"><label>{{ t('categoryEditor.nameLabel') }}</label><input class="input" v-model="editCatName" @keyup.enter="updateCategory" /></div>
          <div class="modal-actions"><button class="btn btn-secondary" @click="editingCat = null">{{ t('common.cancel') }}</button><button class="btn btn-primary" @click="updateCategory" :disabled="!editCatName.trim()">{{ t('common.save') }}</button></div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="deletingCat" class="modal-overlay" @click.self="deletingCat = null">
        <div class="modal">
          <div class="modal-header"><h3>{{ t('categoryEditor.deleteTitle') }}</h3><button class="btn btn-ghost btn-icon-sm" @click="deletingCat = null">✕</button></div>
          <p style="font-size:13px;color:var(--text-secondary)">"{{ deletingCat.name }}" {{ t('categoryEditor.deleteConfirm') }}</p>
          <div class="modal-actions"><button class="btn btn-secondary" @click="deletingCat = null">{{ t('common.cancel') }}</button><button class="btn btn-danger" @click="doDeleteCat">{{ t('common.delete') }}</button></div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="shareUrl" class="modal-overlay" @click.self="shareUrl = null">
        <div class="modal">
          <div class="modal-header"><h3>{{ t('share.title') }}</h3><button class="btn btn-ghost btn-icon-sm" @click="shareUrl = null">✕</button></div>
          <div class="form-group"><input class="input" :value="shareUrl" readonly @click="$event.target.select()" /></div>
          <p style="font-size:12px;color:var(--text-muted)">{{ t('share.instruction') }}</p>
          <div class="modal-actions"><button class="btn btn-primary" @click="copyShare">{{ t('common.copy') }}</button><button class="btn btn-secondary" @click="shareUrl = null">{{ t('common.close') }}</button></div>
        </div>
      </div>
    </Teleport>
    <!-- EPG Program Detail Modal -->
    <Teleport to="body">
      <div v-if="selectedProgram" class="modal-overlay" @click.self="selectedProgram = null">
        <div class="modal epg-detail-modal">
          <div class="epg-detail-header">
            <div class="epg-detail-channel" v-if="selectedProgramChannel">
              <img v-if="selectedProgramChannel.logo_url" :src="selectedProgramChannel.logo_url" class="epg-detail-ch-logo" @error="$event.target.style.display='none'" />
              <span>{{ selectedProgramChannel.name }}</span>
            </div>
            <button class="btn btn-ghost btn-icon-sm" @click="selectedProgram = null">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="epg-detail-body">
            <div class="epg-detail-badge-row">
              <span v-if="isProgramLive(selectedProgram)" class="badge badge-danger">{{ t('epg.live') }}</span>
              <span class="badge badge-accent">
                {{ formatTime(selectedProgram.start_time) }} - {{ formatTime(selectedProgram.end_time) }}
              </span>
              <span class="badge" style="background:var(--bg-tertiary);color:var(--text-secondary)">
                {{ getProgramDuration(selectedProgram) }} {{ t('epg.durationSuffix') }}
              </span>
            </div>
            <h3 class="epg-detail-title">{{ selectedProgram.title }}</h3>
            <div v-if="isProgramLive(selectedProgram)" class="epg-detail-progress">
              <div class="progress">
                <div class="progress-fill" :style="{ width: getProgramProgress(selectedProgram) + '%' }"></div>
              </div>
              <span class="epg-detail-progress-text">%{{ getProgramProgress(selectedProgram) }}</span>
            </div>
            <p v-if="selectedProgram.description" class="epg-detail-desc">{{ selectedProgram.description }}</p>
            <p v-else class="epg-detail-no-desc">{{ t('epg.noDescription') }}</p>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
  <div v-else class="editor-loading"><span class="spinner spinner-lg"></span></div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, inject, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api'
import { useI18n } from '../langs/useI18n'

const route = useRoute()
const toast = inject('toast')
const { t } = useI18n()
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
const activeStreamType = ref('live')
const streamTypeCounts = ref({ live: 0, vod: 0, series: 0 })

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
const SORT_RENDER_LIMIT = 100
const sortRenderCount = ref(SORT_RENDER_LIMIT)
const sortVisibleChannels = computed(() => sortCatChannels.value.slice(0, sortRenderCount.value))

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
const xtreamForm = ref({ serverUrl: '', username: '', password: '', streamTypes: ['live'] })
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
// EPG Autocomplete (name field)
const epgAcResults = ref([])
const epgAcOpen = ref(false)
const epgSelectedIcon = ref(null)
let epgAcTimer = null
// EPG Autocomplete (EPG ID field)
const epgIdAcResults = ref([])
const epgIdAcOpen = ref(false)
let epgIdAcTimer = null
// EPG Guide
const epgTab = ref('guide')
const guideDate = ref(todayStr())
const guideChannels = ref([])
const guideLoading = ref(false)
const hourWidth = 240
const guideTrackWidth = 24 * hourWidth
const epgGridRef = ref(null)
const epgTimeHeaderRef = ref(null)
const epgChannelColRef = ref(null)
const epgGridBodyRef = ref(null)
const selectedProgram = ref(null)
const selectedProgramChannel = ref(null)
const nowOffset = ref(0)

function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
const isGuideToday = computed(() => guideDate.value === todayStr())
const guideDateOptions = computed(() => {
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

// Bulk
const showBulkMove = ref(false)
const bulkTargetCat = ref(null)
const shareUrl = ref(null)

let searchTimer = null

const allSelected = computed(() => channels.value.length > 0 && channels.value.every(ch => selectedIds.value.has(ch.id)))

function toggleStreamSection(type) {
  if (activeStreamType.value === type) return
  activeStreamType.value = type
  activeView.value = 'basic'
  selectedCatId.value = null
  editingChannel.value = null
  page.value = 1
  search.value = ''
  loadChannels()
  loadTotalCount()
  loadCategories()
}

async function loadStreamTypeCounts() {
  try {
    const [liveRes, vodRes, seriesRes] = await Promise.all([
      api.get(`/playlists/${playlistId}/channels`, { params: { limit: 1, streamType: 'live' } }),
      api.get(`/playlists/${playlistId}/channels`, { params: { limit: 1, streamType: 'vod' } }),
      api.get(`/playlists/${playlistId}/channels`, { params: { limit: 1, streamType: 'series' } })
    ])
    streamTypeCounts.value = {
      live: liveRes.data.total || 0,
      vod: vodRes.data.total || 0,
      series: seriesRes.data.total || 0
    }
  } catch {}
}

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
    await Promise.all([loadChannels(), loadTotalCount(), loadStreamTypeCounts()])
  } catch { toast(t('toast.loadError'), 'error') }
  finally { pageLoading.value = false }
})

// Load EPG sources and guide when switching to epg view
watch(activeView, v => { if (v === 'epg') { loadEpgSources(); loadGuide() } })

// Load EPG data when editing channel changes
watch(editingChannel, ch => { if (ch) loadEditChannelEpg() })

async function loadChannels() {
  channelsLoading.value = true
  try {
    const params = { page: page.value, limit: 50, streamType: activeStreamType.value }
    if (search.value) params.search = search.value
    if (selectedCatId.value) params.categoryId = selectedCatId.value
    const { data } = await api.get(`/playlists/${playlistId}/channels`, { params })
    channels.value = data.channels || data
    totalPages.value = data.totalPages || 1
    tableTotal.value = data.total || channels.value.length
    if (!selectedCatId.value && !search.value) totalChannelCount.value = data.total || channels.value.length
  } catch { toast(t('toast.channelsLoadError'), 'error') }
  finally { channelsLoading.value = false }
}

async function loadTotalCount() {
  try {
    const { data } = await api.get(`/playlists/${playlistId}/channels`, { params: { limit: 1, streamType: activeStreamType.value } })
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
  epgAcResults.value = []
  epgAcOpen.value = false
  epgIdAcResults.value = []
  epgIdAcOpen.value = false
  epgSelectedIcon.value = null
}

async function saveChannel() {
  try {
    await api.put(`/channels/${editingChannel.value.id}`, editForm.value)
    toast(t('toast.channelUpdated'), 'success'); editingChannel.value = null
    loadChannels(); loadCategories(); loadTotalCount()
    for (const catId of openAccordions.value) loadAccChannels(catId)
  } catch (e) { toast(e.response?.data?.error?.message || t('common.error'), 'error') }
}

async function deleteChannel(ch) {
  if (!confirm(`"${ch.name}" ${t('toast.deleteChannelConfirm', { count: 1 })}`)) return
  try {
    await api.delete(`/channels/${ch.id}`)
    if (editingChannel.value?.id === ch.id) editingChannel.value = null
    toast(t('toast.deleted'), 'success'); loadChannels(); loadCategories(); loadTotalCount()
    for (const catId of openAccordions.value) loadAccChannels(catId)
  } catch { toast(t('toast.deleteFailed'), 'error') }
}

async function resetChannel() {
  if (!editingChannel.value) return
  try {
    const { data } = await api.post(`/channels/${editingChannel.value.id}/reset`)
    editForm.value = { name: data.name, logo_url: data.logo_url || '', epg_channel_id: data.epg_channel_id || '', category_id: data.category_id || null, stream_url: data.stream_url || '' }
    editingChannel.value = data
    toast(t('toast.resetToOriginal'), 'success')
    loadChannels()
  } catch (e) { toast(e.response?.data?.error?.message || t('toast.resetError'), 'error') }
}

function triggerLogoUpload() {
  logoFileInput.value?.click()
}

async function handleLogoUpload(event) {
  const file = event.target.files?.[0]
  if (!file || !editingChannel.value) return
  if (file.size > 2 * 1024 * 1024) { toast(t('toast.imageTooLarge'), 'error'); return }

  logoUploading.value = true
  try {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const { data } = await api.post(`/channels/${editingChannel.value.id}/logo`, { imageData: e.target.result })
        editForm.value.logo_url = data.logo_url || ''
        editingChannel.value = { ...editingChannel.value, logo_url: data.logo_url }
        toast(t('toast.logoUploaded'), 'success')
      } catch (err) { toast(err.response?.data?.error?.message || t('toast.logoUploadError'), 'error') }
      finally { logoUploading.value = false }
    }
    reader.readAsDataURL(file)
  } catch { logoUploading.value = false }
  // Reset file input so same file can be re-selected
  event.target.value = ''
}

async function bulkDelete() {
  if (!confirm(t('toast.deleteChannelConfirm', { count: selectedIds.value.size }))) return
  try {
    for (const id of selectedIds.value) await api.delete(`/channels/${id}`)
    selectedIds.value = new Set(); toast(t('toast.deleted'), 'success')
    loadChannels(); loadCategories(); loadTotalCount()
    for (const catId of openAccordions.value) loadAccChannels(catId)
  } catch { toast(t('common.error'), 'error') }
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
    showBulkMove.value = false; selectedIds.value = new Set(); toast(t('toast.moved'), 'success')

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
  } catch (e) { toast(e.response?.data?.error?.message || t('common.error'), 'error') }
}

async function createCategory() {
  if (!newCatName.value.trim()) return
  try { await api.post(`/playlists/${playlistId}/categories`, { name: newCatName.value.trim() }); newCatName.value = ''; showCatCreate.value = false; toast(t('toast.created'), 'success'); loadCategories() }
  catch (e) { toast(e.response?.data?.error?.message || t('common.error'), 'error') }
}
function startEditCat(cat) { editingCat.value = cat; editCatName.value = cat.name }
async function updateCategory() {
  if (!editCatName.value.trim()) return
  try { await api.put(`/categories/${editingCat.value.id}`, { name: editCatName.value.trim() }); editingCat.value = null; toast(t('toast.updated'), 'success'); loadCategories() }
  catch (e) { toast(e.response?.data?.error?.message || t('common.error'), 'error') }
}
function confirmDeleteCat(cat) { deletingCat.value = cat }
function toggleCatHidden(catId) { const s = new Set(hiddenCats.value); s.has(catId) ? s.delete(catId) : s.add(catId); hiddenCats.value = s }
function startInlineEdit(cat) { inlineEditCatId.value = cat.id; inlineEditName.value = cat.name }
async function saveInlineEdit(cat) {
  if (!inlineEditName.value.trim() || inlineEditName.value === cat.name) { inlineEditCatId.value = null; return }
  try { await api.put(`/categories/${cat.id}`, { name: inlineEditName.value.trim() }); toast(t('toast.renamed'), 'success'); loadCategories() }
  catch (e) { toast(e.response?.data?.error?.message || t('common.error'), 'error') }
  finally { inlineEditCatId.value = null }
}
async function doDeleteCat() {
  try { await api.delete(`/categories/${deletingCat.value.id}`); if (selectedCatId.value === deletingCat.value?.id) selectedCatId.value = null; deletingCat.value = null; toast(t('toast.deleted'), 'success'); loadCategories(); loadChannels() }
  catch (e) { toast(e.response?.data?.error?.message || t('common.error'), 'error') }
}

async function catDrop(idx) {
  if (sortDragIdx === null || sortDragIdx === idx) return
  const cat = categories.value[sortDragIdx]
  try { await api.put(`/categories/${cat.id}/order`, { newPosition: idx }); loadCategories() }
  catch { toast(t('toast.sortingError'), 'error') }
  sortDragIdx = null
}

async function selectSortCat(cat) {
  sortSelectedCat.value = cat
  sortCatLoading.value = true
  sortRenderCount.value = SORT_RENDER_LIMIT
  try {
    const { data } = await api.get(`/playlists/${playlistId}/channels`, { params: { categoryId: cat.id, limit: 1000 } })
    sortCatChannels.value = data.channels || data
  } catch { toast(t('toast.channelsLoadError'), 'error') }
  finally { sortCatLoading.value = false }
}

async function chanDrop(idx) {
  if (sortChanDragIdx === null || sortChanDragIdx === idx) return
  const ch = sortCatChannels.value[sortChanDragIdx]
  const moved = sortCatChannels.value.splice(sortChanDragIdx, 1)[0]
  sortCatChannels.value.splice(idx, 0, moved)
  sortChanDragIdx = null
  try { await api.put(`/channels/${ch.id}/order`, { newPosition: idx }) }
  catch { toast(t('toast.sortingError'), 'error') }
}

function openXtream() { showXtreamModal.value = true; importResult.value = null; importError.value = '' }
async function doXtreamImport() {
  importing.value = true; importResult.value = null; importError.value = ''
  try {
    const { data } = await api.post(`/playlists/${playlistId}/import/xtream`, xtreamForm.value)
    importResult.value = data; toast(t('toast.importSuccess', { channels: data.totalChannels, categories: data.totalCategories, duration: (data.duration / 1000).toFixed(1) }), 'success')
    // Refresh saved xtream info
    const plRes = await api.get('/playlists')
    const pl = plRes.data.find(p => String(p.id) === String(playlistId))
    if (pl?.xtream_server_url) savedXtream.value = { serverUrl: pl.xtream_server_url, username: pl.xtream_username, lastSynced: pl.last_synced_at }
    loadCategories(); loadChannels(); loadTotalCount(); loadStreamTypeCounts()
    for (const catId of openAccordions.value) loadAccChannels(catId)
  } catch (e) { importError.value = e.response?.data?.error?.message || t('toast.connectionError') }
  finally { importing.value = false }
}
async function doSync() {
  syncing.value = true
  try {
    const { data } = await api.post(`/playlists/${playlistId}/sync`)
    toast(t('toast.syncResult', { added: data.added, updated: data.updated, removed: data.removed }), 'success')
    const plRes = await api.get('/playlists')
    const pl = plRes.data.find(p => String(p.id) === String(playlistId))
    if (pl?.last_synced_at) savedXtream.value = { ...savedXtream.value, lastSynced: pl.last_synced_at }
    loadCategories(); loadChannels(); loadTotalCount(); loadStreamTypeCounts()
  } catch (e) { toast(e.response?.data?.error?.message || t('toast.updateError'), 'error') }
  finally { syncing.value = false }
}

async function loadAllChannels() {
  try { const { data } = await api.get(`/playlists/${playlistId}/channels`, { params: { limit: 10000 } }); allChannels.value = data.channels || data }
  catch { allChannels.value = [] }
}
async function loadEpgSources() { try { const { data } = await api.get('/epg/sources'); epgSources.value = data } catch {} }
async function addEpgSource() {
  if (!newEpgUrl.value.trim()) return; addingEpg.value = true
  try { const { data } = await api.post('/epg/sources', { url: newEpgUrl.value.trim() }); toast(t('toast.epgAdded', { channels: data.channelCount, programs: data.programCount }), 'success'); newEpgUrl.value = ''; loadEpgSources(); loadGuide() }
  catch (e) { toast(e.response?.data?.error?.message || t('toast.epgError'), 'error') }
  finally { addingEpg.value = false }
}
async function refreshEpgSource(source) {
  source._refreshing = true
  try { const { data } = await api.post(`/epg/sources/${source.id}/refresh`); toast(t('toast.epgRefreshed', { channels: data.channelCount, programs: data.programCount }), 'success'); loadEpgSources(); loadGuide() }
  catch (e) { toast(e.response?.data?.error?.message || t('toast.epgRefreshError'), 'error') }
  finally { source._refreshing = false }
}
async function deleteEpgSource(source) {
  if (!confirm(t('toast.categoryDeleteConfirm'))) return
  try { await api.delete(`/epg/sources/${source.id}`); toast(t('toast.epgSourceDeleted'), 'success'); loadEpgSources(); loadGuide() }
  catch (e) { toast(e.response?.data?.error?.message || t('toast.deletionError'), 'error') }
}
async function doAutoMatch() {
  autoMatching.value = true
  try { const { data } = await api.post(`/playlists/${playlistId}/epg/auto-match`); matchResult.value = data; toast(t('toast.channelsMatched', { count: `${data.matched}/${data.total}` }), 'success'); loadGuide(); loadChannels() }
  catch { toast(t('toast.matchingError'), 'error') }
  finally { autoMatching.value = false }
}
async function loadGuide() {
  guideLoading.value = true
  try {
    const { data } = await api.get(`/playlists/${playlistId}/epg/guide`, { params: { date: guideDate.value } })
    guideChannels.value = data.channels || []
    updateNowOffset()
  } catch { guideChannels.value = [] }
  finally { guideLoading.value = false }
}
function changeGuideDate(delta) {
  const d = new Date(guideDate.value + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  guideDate.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  loadGuide()
}
function updateNowOffset() {
  const now = new Date()
  const mins = now.getHours() * 60 + now.getMinutes()
  nowOffset.value = (mins / 60) * hourWidth
}
function getProgramStyle(prog) {
  const start = new Date(prog.start_time)
  const end = new Date(prog.end_time || start)
  const dayStart = new Date(guideDate.value + 'T00:00:00')
  const startMins = Math.max(0, (start - dayStart) / 60000)
  const endMins = Math.min(1440, (end - dayStart) / 60000)
  const left = (startMins / 60) * hourWidth
  const width = Math.max(((endMins - startMins) / 60) * hourWidth, 30)
  return { left: left + 'px', width: width + 'px' }
}
function isProgramPast(prog) {
  return new Date(prog.end_time) < new Date()
}
function onGridScroll() {
  const body = epgGridBodyRef.value
  if (!body) return
  if (epgTimeHeaderRef.value) epgTimeHeaderRef.value.scrollLeft = body.scrollLeft
  if (epgChannelColRef.value) epgChannelColRef.value.scrollTop = body.scrollTop
}
function showProgramDetail(prog, ch) {
  selectedProgram.value = prog
  selectedProgramChannel.value = ch
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
function formatDateTime(d) { if (!d) return ''; return new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }
function getProgramDuration(prog) { return Math.round((new Date(prog.end_time) - new Date(prog.start_time)) / 60000) }
function getProgramProgress(prog) { const now = Date.now(); const s = new Date(prog.start_time).getTime(); const e = new Date(prog.end_time).getTime(); return Math.min(100, Math.max(0, Math.round(((now - s) / (e - s)) * 100))) }
// Update now offset every minute
let _nowTimer = setInterval(updateNowOffset, 60000)
onUnmounted(() => { if (_nowTimer) clearInterval(_nowTimer) })

async function doExport() {
  try {
    const params = {}
    if (hiddenCats.value.size > 0) params.excludeCategories = [...hiddenCats.value].join(',')
    const { data } = await api.get(`/playlists/${playlistId}/export`, { responseType: 'blob', params })
    const url = URL.createObjectURL(new Blob([data])); const a = document.createElement('a'); a.href = url; a.download = 'playlist.m3u'; a.click(); URL.revokeObjectURL(url)
    const hiddenCount = hiddenCats.value.size
    toast(hiddenCount > 0 ? t('toast.m3uDownloadedExcluded') : t('toast.m3uDownloaded'), 'success')
  } catch { toast(t('toast.downloadError'), 'error') }
}
async function doShare() {
  try { const { data } = await api.post(`/playlists/${playlistId}/share`); shareUrl.value = window.location.origin + '/api/shared/' + data.token }
  catch (e) { toast(e.response?.data?.error?.message || t('toast.shareError'), 'error') }
}
function copyShare() { navigator.clipboard.writeText(shareUrl.value); toast(t('toast.copied'), 'success') }
// EPG Autocomplete functions
function onNameInput() {
  clearTimeout(epgAcTimer)
  const q = editForm.value.name
  if (!q || q.trim().length < 2) { epgAcResults.value = []; return }
  epgAcTimer = setTimeout(async () => {
    try {
      const { data } = await api.get('/epg/channels/search', { params: { q: q.trim() } })
      epgAcResults.value = data || []
      epgAcOpen.value = true
    } catch { epgAcResults.value = [] }
  }, 300)
}
function onNameFocus() { if (epgAcResults.value.length > 0) epgAcOpen.value = true }
function onNameBlur() { setTimeout(() => { epgAcOpen.value = false }, 200) }
function selectEpgChannel(epgCh) {
  editForm.value.name = epgCh.display_name
  editForm.value.epg_channel_id = epgCh.channel_id
  epgAcResults.value = []
  epgAcOpen.value = false
  if (epgCh.icon_url) {
    epgSelectedIcon.value = epgCh.icon_url
  } else {
    epgSelectedIcon.value = null
  }
}
function applyEpgLogo() {
  if (epgSelectedIcon.value) {
    editForm.value.logo_url = epgSelectedIcon.value
    toast(t('toast.epgLogoApplied'), 'success')
  }
}
// EPG ID field autocomplete
function onEpgIdInput() {
  clearTimeout(epgIdAcTimer)
  const q = editForm.value.epg_channel_id
  if (!q || q.trim().length < 2) { epgIdAcResults.value = []; return }
  epgIdAcTimer = setTimeout(async () => {
    try {
      const { data } = await api.get('/epg/channels/search', { params: { q: q.trim() } })
      epgIdAcResults.value = data || []
      epgIdAcOpen.value = true
    } catch { epgIdAcResults.value = [] }
  }, 300)
}
function onEpgIdFocus() { if (epgIdAcResults.value.length > 0) epgIdAcOpen.value = true }
function onEpgIdBlur() { setTimeout(() => { epgIdAcOpen.value = false }, 200) }
function selectEpgFromId(epgCh) {
  editForm.value.epg_channel_id = epgCh.channel_id
  epgIdAcResults.value = []
  epgIdAcOpen.value = false
  if (epgCh.icon_url) {
    epgSelectedIcon.value = epgCh.icon_url
  }
}

function formatDate(d) { if (!d) return ''; return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }
function formatTime(d) { if (!d) return ''; return new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }
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
.load-more-btn { width: 100%; margin-top: 8px; }
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

/* ===== EPG TV GUIDE ===== */

/* Top bar with tabs */
.epg-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 16px; border-bottom: 1px solid var(--border);
  background: var(--bg-secondary); flex-shrink: 0;
}
.epg-tabs { display: flex; gap: 2px; }
.epg-tab {
  display: flex; align-items: center; gap: 6px; padding: 7px 14px;
  font-size: 12px; font-weight: 500; color: var(--text-secondary);
  background: transparent; border: none; border-radius: var(--radius);
  cursor: pointer; transition: all var(--transition); position: relative;
}
.epg-tab:hover { color: var(--text-primary); background: var(--bg-hover); }
.epg-tab.active {
  color: var(--accent-hover); background: var(--accent-soft);
  font-weight: 600;
}
.epg-tab-badge {
  font-size: 9px; font-weight: 700; background: var(--accent);
  color: white; border-radius: 10px; padding: 1px 5px; min-width: 16px;
  text-align: center; line-height: 1.4;
}
.epg-topbar-actions { display: flex; align-items: center; gap: 8px; }

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
  grid-row: 2; grid-column: 1;
  overflow: hidden; background: var(--bg-secondary);
  border-right: 1px solid var(--border); z-index: 2;
}
.epg-ch-row-label {
  display: flex; align-items: center; gap: 8px; padding: 0 10px;
  height: 52px; border-bottom: 1px solid var(--border);
  overflow: hidden;
}
.epg-ch-logo {
  width: 28px; height: 28px; border-radius: 6px; object-fit: cover;
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
  overflow: auto; position: relative;
}
.epg-grid-track { position: relative; min-height: 100%; }
.epg-grid-row {
  position: relative; height: 52px; border-bottom: 1px solid var(--border);
}
.epg-grid-line {
  position: absolute; top: 0; bottom: 0; width: 1px;
  background: var(--border); pointer-events: none;
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

/* ===== EPG Sources Tab ===== */
.epg-sources-wrap { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.epg-add-card {
  display: flex; gap: 14px; padding: 16px;
  background: var(--bg-secondary); border: 1px dashed var(--border-light);
  border-radius: var(--radius-lg); transition: border-color var(--transition);
}
.epg-add-card:hover { border-color: var(--accent); }
.epg-add-card-icon {
  width: 40px; height: 40px; border-radius: var(--radius);
  background: var(--accent-soft); color: var(--accent-hover);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.epg-add-card-body { flex: 1; min-width: 0; }
.epg-add-card-title { font-size: 13px; font-weight: 600; margin-bottom: 2px; }
.epg-add-card-desc { font-size: 11px; color: var(--text-muted); margin-bottom: 10px; }
.epg-add-input-row { display: flex; gap: 8px; }
.epg-add-input-row .input { flex: 1; }

/* Source cards */
.epg-source-cards { display: flex; flex-direction: column; gap: 8px; }
.epg-src-card {
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: var(--radius-lg); overflow: hidden;
  transition: border-color var(--transition);
}
.epg-src-card:hover { border-color: var(--border-light); }
.epg-src-card-header { display: flex; align-items: center; gap: 10px; padding: 12px 14px; }
.epg-src-status { flex-shrink: 0; }
.epg-src-status.status-active { color: var(--success); }
.epg-src-status.status-error { color: var(--danger); }
.epg-src-status.status-pending { color: var(--warning); }
.epg-src-info { flex: 1; min-width: 0; }
.epg-src-url {
  font-size: 12px; font-weight: 500; color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  margin-bottom: 4px;
}
.epg-src-meta { display: flex; align-items: center; gap: 8px; }
.epg-src-badge {
  font-size: 9px; font-weight: 600; padding: 2px 7px; border-radius: 10px;
  text-transform: uppercase; letter-spacing: 0.5px;
}
.epg-src-badge.badge-active { background: var(--success-soft); color: var(--success); }
.epg-src-badge.badge-error { background: var(--danger-soft); color: var(--danger); }
.epg-src-badge.badge-pending { background: var(--warning-soft); color: var(--warning); }
.epg-src-date { font-size: 10px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; }
.epg-src-actions { display: flex; gap: 4px; flex-shrink: 0; }
.epg-src-btn {
  width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--bg-tertiary); color: var(--text-secondary);
  cursor: pointer; transition: all var(--transition);
}
.epg-src-btn:hover { background: var(--bg-hover); color: var(--text-primary); border-color: var(--border-light); }
.epg-src-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.epg-src-btn-danger:hover { color: var(--danger); border-color: rgba(239,68,68,0.3); }

.epg-no-sources {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; padding: 48px 16px; text-align: center;
}
.epg-no-sources-icon { opacity: 0.15; }
.epg-no-sources p { font-size: 14px; color: var(--text-secondary); font-weight: 500; }
.epg-no-sources span { font-size: 12px; color: var(--text-muted); }

/* ===== EPG Program Detail Modal ===== */
.epg-detail-modal { max-width: 480px; }
.epg-detail-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px;
}
.epg-detail-channel {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 600; color: var(--text-secondary);
}
.epg-detail-ch-logo { width: 24px; height: 24px; border-radius: 6px; object-fit: cover; }
.epg-detail-body { padding: 0; }
.epg-detail-badge-row { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
.epg-detail-title { font-size: 18px; font-weight: 700; margin-bottom: 12px; line-height: 1.3; }
.epg-detail-progress { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.epg-detail-progress .progress { flex: 1; height: 6px; }
.epg-detail-progress-text { font-size: 11px; font-weight: 600; color: var(--accent-hover); min-width: 32px; }
.epg-detail-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
.epg-detail-no-desc { font-size: 13px; color: var(--text-muted); font-style: italic; }

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

/* EPG Autocomplete */
.epg-ac-wrap { position: relative; }
.epg-ac-dropdown {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 50;
  background: var(--bg-card); border: 1px solid var(--border-light);
  border-radius: var(--radius); box-shadow: var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.25));
  max-height: 240px; overflow-y: auto; margin-top: 2px;
}
.epg-ac-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px;
  cursor: pointer; transition: background 0.12s; border-bottom: 1px solid var(--border);
}
.epg-ac-item:last-child { border-bottom: none; }
.epg-ac-item:hover { background: var(--accent-soft); }
.epg-ac-logo {
  width: 28px; height: 28px; border-radius: 4px; object-fit: contain;
  background: var(--bg-secondary); flex-shrink: 0;
}
.epg-ac-logo-fb {
  width: 28px; height: 28px; border-radius: 4px; display: flex; align-items: center; justify-content: center;
  background: var(--bg-tertiary); color: var(--text-muted); flex-shrink: 0;
}
.epg-ac-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.epg-ac-name { font-size: 12px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.epg-ac-id { font-size: 10px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* EPG Logo Offer */
.epg-logo-offer {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px;
  background: var(--accent-soft); border: 1px solid rgba(99,102,241,0.2);
  border-radius: var(--radius); margin-bottom: 10px;
}
.epg-logo-offer-preview { flex-shrink: 0; }
.epg-logo-offer-img {
  width: 36px; height: 36px; border-radius: 6px; object-fit: contain;
  background: var(--bg-secondary); border: 1px solid var(--border);
}
.epg-logo-offer-info { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
.epg-logo-offer-label { font-size: 11px; color: var(--text-secondary); font-weight: 500; }
.btn-accent {
  background: var(--accent); color: #fff; border: none; font-size: 11px; font-weight: 500;
  padding: 4px 10px; border-radius: var(--radius); cursor: pointer;
  display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s;
}
.btn-accent:hover { background: var(--accent-hover); }

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

.nav-section-active { background: var(--bg-hover); border-left: 2px solid var(--accent); }
.nav-section-count { font-size: 11px; color: var(--text-muted); background: var(--bg-tertiary); padding: 1px 6px; border-radius: 8px; margin-left: auto; margin-right: 4px; }
.stream-type-group { display: flex; gap: 16px; margin-top: 4px; }
.stream-type-label { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; color: var(--text-secondary); }
.stream-type-label input[type="checkbox"] { accent-color: var(--accent); }
</style>
