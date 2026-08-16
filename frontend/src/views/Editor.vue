<template>
  <div class="editor" v-if="!pageLoading">
    <div class="editor-body">
      <!-- Left nav sidebar -->
      <nav class="nav-sidebar" :class="{ 'mobile-open': mobileNavOpen }" :aria-label="t('accessibility.editorSections')">
        <!-- Canli Kanallar -->
        <div class="nav-section">
          <div :class="['nav-section-header', { 'nav-section-active': activeStreamType === 'live' }]" role="button" tabindex="0" :aria-expanded="activeStreamType === 'live'" @click="toggleStreamSection('live')" @keydown.enter.space.prevent="toggleStreamSection('live')">
            <span class="nav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg></span>
            <span class="nav-section-title">{{ t('nav.liveChannels') }}</span>
            <span v-if="streamTypeCounts.live" class="nav-section-count">{{ streamTypeCounts.live }}</span>
            <svg :class="['nav-chevron', { open: activeStreamType === 'live' }]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div v-if="activeStreamType === 'live'" class="nav-items">
            <div :class="['nav-item', { active: activeView === 'basic' }]" role="button" tabindex="0" @click="activeView = 'basic'" @keydown.enter.space.prevent="activeView = 'basic'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> {{ t('nav.channelEditor') }}
            </div>
            <div :class="['nav-item', { active: activeView === 'sort' }]" role="button" tabindex="0" @click="activeView = 'sort'" @keydown.enter.space.prevent="activeView = 'sort'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/></svg> {{ t('nav.sorting') }}
            </div>
            <div :class="['nav-item', { active: activeView === 'epg' }]" role="button" tabindex="0" @click="activeView = 'epg'" @keydown.enter.space.prevent="activeView = 'epg'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> {{ t('nav.epgEditor') }}
            </div>
            <div :class="['nav-item', { active: activeView === 'category' }]" role="button" tabindex="0" @click="activeView = 'category'" @keydown.enter.space.prevent="activeView = 'category'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> {{ t('nav.categoryEditor') }}
            </div>
            <div :class="['nav-item', { active: activeView === 'update' }]" role="button" tabindex="0" @click="activeView = 'update'" @keydown.enter.space.prevent="activeView = 'update'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg> {{ t('nav.update') }}
            </div>
          </div>
        </div>
        <!-- Filmler -->
        <div class="nav-section">
          <div :class="['nav-section-header', { 'nav-section-active': activeStreamType === 'vod' }]" role="button" tabindex="0" :aria-expanded="activeStreamType === 'vod'" @click="toggleStreamSection('vod')" @keydown.enter.space.prevent="toggleStreamSection('vod')">
            <span class="nav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/></svg></span>
            <span class="nav-section-title">{{ t('nav.movies') }}</span>
            <span v-if="streamTypeCounts.vod" class="nav-section-count">{{ streamTypeCounts.vod }}</span>
            <svg :class="['nav-chevron', { open: activeStreamType === 'vod' }]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div v-if="activeStreamType === 'vod'" class="nav-items">
            <div :class="['nav-item', { active: activeView === 'basic' }]" role="button" tabindex="0" @click="activeView = 'basic'" @keydown.enter.space.prevent="activeView = 'basic'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> {{ t('nav.movieEditor') }}
            </div>
            <div :class="['nav-item', { active: activeView === 'sort' }]" role="button" tabindex="0" @click="activeView = 'sort'" @keydown.enter.space.prevent="activeView = 'sort'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/></svg> {{ t('nav.sorting') }}
            </div>
            <div :class="['nav-item', { active: activeView === 'category' }]" role="button" tabindex="0" @click="activeView = 'category'" @keydown.enter.space.prevent="activeView = 'category'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> {{ t('nav.categoryEditor') }}
            </div>
          </div>
        </div>
        <!-- Diziler -->
        <div class="nav-section">
          <div :class="['nav-section-header', { 'nav-section-active': activeStreamType === 'series' }]" role="button" tabindex="0" :aria-expanded="activeStreamType === 'series'" @click="toggleStreamSection('series')" @keydown.enter.space.prevent="toggleStreamSection('series')">
            <span class="nav-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg></span>
            <span class="nav-section-title">{{ t('nav.series') }}</span>
            <span v-if="streamTypeCounts.series" class="nav-section-count">{{ streamTypeCounts.series }}</span>
            <svg :class="['nav-chevron', { open: activeStreamType === 'series' }]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div v-if="activeStreamType === 'series'" class="nav-items">
            <div :class="['nav-item', { active: activeView === 'basic' }]" role="button" tabindex="0" @click="activeView = 'basic'" @keydown.enter.space.prevent="activeView = 'basic'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> {{ t('nav.seriesEditor') }}
            </div>
            <div :class="['nav-item', { active: activeView === 'sort' }]" role="button" tabindex="0" @click="activeView = 'sort'" @keydown.enter.space.prevent="activeView = 'sort'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/></svg> {{ t('nav.sorting') }}
            </div>
            <div :class="['nav-item', { active: activeView === 'category' }]" role="button" tabindex="0" @click="activeView = 'category'" @keydown.enter.space.prevent="activeView = 'category'">
              <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> {{ t('nav.categoryEditor') }}
            </div>
          </div>
        </div>
        <div class="nav-bottom">
          <div class="nav-item" role="button" tabindex="0" @click="$router.push('/dashboard')" @keydown.enter.space.prevent="$router.push('/dashboard')">
            <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> {{ t('nav.dashboard') }}
          </div>
          <div class="nav-item" role="button" tabindex="0" @click="showXtreamOutput = true" @keydown.enter.space.prevent="showXtreamOutput = true">
            <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> {{ t('nav.downloadM3u') }}
          </div>
          <div class="nav-item" role="button" tabindex="0" @click="doShare" @keydown.enter.space.prevent="doShare">
            <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> {{ t('nav.share') }}
          </div>
          <div class="nav-item" role="button" tabindex="0" @click="showViewProfiles = true" @keydown.enter.space.prevent="showViewProfiles = true">
            <svg class="nav-item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> {{ t('viewProfiles.title') }}
          </div>
        </div>
      </nav>
      <button v-if="mobileNavOpen" class="mobile-scrim" :aria-label="t('accessibility.closeMenu')" @click="mobileNavOpen = false"></button>

      <!-- Main content area -->
      <div class="main-area">
        <!-- Top bar -->
        <div class="top-bar">
          <div class="top-bar-left">
            <button class="mobile-menu-btn" :aria-label="t('accessibility.openEditorMenu')" @click="mobileNavOpen = true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
            </button>
            <h2 class="playlist-title">{{ playlistName }}</h2>
            <span class="channel-count-badge">{{ totalChannelCount }} {{ streamTypeLabel.unit }}</span>
            <span v-if="isResultFiltered" class="filter-count-badge">{{ t('advFilter.filteredCount', { count: tableTotal, unit: streamTypeLabel.unit }) }}</span>
          </div>
          <div class="top-bar-right">
            <button v-if="activeView === 'basic'" class="mobile-menu-btn" :aria-label="t('accessibility.openCategories')" @click="mobileCategoriesOpen = true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
            </button>
            <div class="search-box">
              <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input class="search-input" v-model="search" :aria-label="streamTypeLabel.search" :placeholder="streamTypeLabel.search" :title="t('keyboard.focusSearch')" @input="debouncedSearch" />
            </div>
            <select v-if="activeView === 'basic'" class="input adv-filter-select" v-model="activeFilter" :aria-label="t('advFilter.label')" @change="onFilterChange">
              <option v-for="opt in filterOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <span v-if="activeFilter" class="adv-filter-badge">
              {{ activeFilterLabel }}
              <button type="button" class="adv-filter-badge-clear" :aria-label="t('common.close')" @click="clearAdvFilter">×</button>
            </span>
            <button v-if="activeView === 'basic'" class="btn btn-secondary btn-sm health-scan-btn" :disabled="healthScan.running" :aria-label="t('streamHealth.scanButton')" @click="startHealthScan">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              <span class="health-scan-label">{{ healthScan.running ? t('streamHealth.scanning', { checked: healthScan.checked, total: healthScan.total }) : t('streamHealth.scanButton') }}</span>
            </button>
            <button v-if="activeView === 'basic'" class="btn btn-secondary btn-sm add-channel-btn" :aria-label="t('addChannel.title')" @click="showAddChannel = true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span class="add-channel-label">{{ t('addChannel.title') }}</span>
            </button>
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
                <div class="cat-sidebar" :class="{ 'mobile-open': mobileCategoriesOpen }">
                  <div class="cat-sidebar-header">
                    <span class="cat-sidebar-title">{{ t('common.categories') }}</span>
                    <button class="btn btn-ghost btn-icon-sm" @click="showCatCreate = true" :title="t('editor.newCategory')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                  </div>
                  <div class="cat-sidebar-list">
                    <div :class="['cat-sb-item', { active: !selectedCatId }]" role="button" tabindex="0" @click="selectCategory(null)" @keydown.enter.space.prevent="selectCategory(null)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>
                      <span class="cat-sb-name">{{ streamTypeLabel.all }}</span>
                      <span class="cat-sb-count">{{ totalChannelCount }}</span>
                    </div>
                    <div v-for="cat in categories" :key="cat.id" role="button" tabindex="0"
                      :class="['cat-sb-item', { active: selectedCatId === cat.id, 'cat-sb-hidden': cat.is_hidden }]"
                      @click="selectCategory(cat.id)" @keydown.enter.space.self.prevent="selectCategory(cat.id)">
                      <input v-if="inlineEditCatId === cat.id"
                        class="cat-sb-input"
                        v-model="inlineEditName"
                        @blur="saveInlineEdit(cat)"
                        @keyup.enter="saveInlineEdit(cat)"
                        @keyup.escape="inlineEditCatId = null"
                        @click.stop
                        :aria-label="t('accessibility.editCategoryName', { name: cat.name })"
                        autofocus />
                      <span v-else class="cat-sb-name" @dblclick.stop="startInlineEdit(cat)">{{ cat.name }}</span>
                      <span v-if="cat.is_hidden" class="cat-sb-hidden-badge" :title="t('editor.hiddenCategoryHint')">{{ t('editor.hiddenCategoryBadge') }}</span>
                      <span class="cat-sb-count">{{ cat.channel_count || 0 }}</span>
                      <div class="cat-sb-actions">
                        <button class="cat-sb-btn" @click.stop="toggleCatHidden(cat)" :title="cat.is_hidden ? t('editor.showCategory') : t('editor.hideCategory')" :aria-label="cat.is_hidden ? t('editor.showCategory') : t('editor.hideCategory')">
                          <svg v-if="!cat.is_hidden" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
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
                <button v-if="mobileCategoriesOpen" class="mobile-scrim category-scrim" :aria-label="t('accessibility.closeCategories')" @click="mobileCategoriesOpen = false"></button>

                <!-- Sağ: Kanal Listesi -->
                <div class="channel-main">
                  <div v-if="selectedIds.size > 0" class="bulk-bar">
                    <span class="badge badge-accent">{{ selectedIds.size }} {{ t('common.selected') }}</span>
                    <button class="btn btn-secondary btn-xs" @click="showBulkMove = true">{{ t('common.move') }}</button>
                    <button class="btn btn-secondary btn-xs" @click="showBulkUpdate = true">{{ t('bulkUpdate.title') }}</button>
                    <button class="btn btn-secondary btn-xs" @click="showBulkRename = true">{{ t('bulkRename.title') }}</button>
                    <button class="btn btn-danger btn-xs" @click="bulkDelete">{{ t('common.delete') }}</button>
                  </div>
                  <div v-if="channelsLoading" class="center-loading"><span class="spinner"></span></div>
                  <div v-else-if="channels.length === 0 && !search" class="center-empty">
                    <!-- Kategori icinde bos -->
                    <template v-if="selectedCatId">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                      <p>{{ t('editor.noChannelsInCat') }}</p>
                    </template>

                    <!-- Xtream VAR + tip henuz cekilmemis → tek buton ile cek -->
                    <template v-else-if="savedXtream && activeStreamType === 'vod' && !savedXtreamTypes.includes('vod')">
                      <div class="empty-smart">
                        <div class="empty-smart-icon vod">
                          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
                        </div>
                        <h3 class="empty-smart-title">{{ t('addTypes.emptyVod') }}</h3>
                        <button class="btn btn-primary" @click="doAddTypes(['vod'])" :disabled="addingTypes">
                          <span v-if="addingTypes" class="spinner" style="width:14px;height:14px"></span>
                          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          {{ addingTypes ? t('common.importing') : t('addTypes.fetchMovies') }}
                        </button>
                      </div>
                    </template>
                    <template v-else-if="savedXtream && activeStreamType === 'series' && !savedXtreamTypes.includes('series')">
                      <div class="empty-smart">
                        <div class="empty-smart-icon series">
                          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>
                        </div>
                        <h3 class="empty-smart-title">{{ t('addTypes.emptySeries') }}</h3>
                        <button class="btn btn-primary" @click="doAddTypes(['series'])" :disabled="addingTypes">
                          <span v-if="addingTypes" class="spinner" style="width:14px;height:14px"></span>
                          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          {{ addingTypes ? t('common.importing') : t('addTypes.fetchSeries') }}
                        </button>
                      </div>
                    </template>

                    <!-- Xtream VAR + tip cekilmis ama saglaycida icerik yok -->
                    <template v-else-if="savedXtream && (activeStreamType === 'vod' || activeStreamType === 'series') && savedXtreamTypes.includes(activeStreamType)">
                      <div class="empty-smart">
                        <div class="empty-smart-icon muted">
                          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        </div>
                        <h3 class="empty-smart-title">{{ t('addTypes.providerEmpty') }}</h3>
                        <p class="empty-smart-desc">{{ t('addTypes.providerEmptyDesc') }}</p>
                      </div>
                    </template>

                    <!-- Xtream YOK → kaynak secim ekrani -->
                    <template v-else-if="!selectedCatId && (activeStreamType !== 'live' || totalChannelCount === 0)">
                      <div class="empty-smart">
                        <div class="empty-smart-icon accent">
                          <svg v-if="activeStreamType === 'vod'" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
                          <svg v-else-if="activeStreamType === 'series'" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>
                          <svg v-else width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
                        </div>
                        <h3 class="empty-smart-title">{{ emptySmartTitle }}</h3>
                        <p class="empty-smart-desc">{{ t('addTypes.chooseSource') }}</p>

                        <div class="empty-smart-options">
                          <!-- Xtream Codes ile baglan -->
                          <div class="empty-option-card" role="button" tabindex="0" @click="openXtream" @keydown.enter.space.prevent="openXtream">
                            <div class="empty-option-icon xtream">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
                            </div>
                            <div class="empty-option-info">
                              <div class="empty-option-title">{{ t('addTypes.xtreamOption') }}</div>
                              <div class="empty-option-desc">{{ t('addTypes.xtreamOptionDesc') }}</div>
                            </div>
                            <svg class="empty-option-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                          </div>

                          <!-- M3U dosyasindan ice aktar -->
                          <div class="empty-option-card" role="button" tabindex="0" @click="showM3uImportInEditor = true" @keydown.enter.space.prevent="showM3uImportInEditor = true">
                            <div class="empty-option-icon m3u">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                            </div>
                            <div class="empty-option-info">
                              <div class="empty-option-title">{{ t('addTypes.m3uOption') }}</div>
                              <div class="empty-option-desc">{{ t('addTypes.m3uOptionDesc') }}</div>
                            </div>
                            <svg class="empty-option-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                          </div>
                        </div>
                      </div>
                    </template>

                    <!-- Fallback genel bos -->
                    <template v-else>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>
                      <p>{{ t('editor.noChannels') }}</p>
                    </template>
                  </div>
                  <div v-else-if="channels.length === 0 && search" class="center-empty">
                    <p>{{ t('common.noResults') }}</p>
                  </div>
                  <div v-else class="channel-table-wrap">
                    <table class="ch-table">
                      <thead>
                        <tr>
                          <th class="th-check"><input type="checkbox" :aria-label="t('accessibility.selectAllChannels')" @change="toggleSelectAll" :checked="allSelected" /></th>
                          <th class="th-num">#</th>
                          <th class="th-name">{{ t('table.name') }}</th>
                          <th class="th-url">{{ t('table.url') }}</th>
                          <th class="th-epg">{{ activeStreamType === 'live' ? t('table.epg') : t('metadata.genres') }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="(ch, idx) in channels" :key="ch.id" tabindex="0"
                          :class="{ selected: selectedIds.has(ch.id), editing: editingChannel?.id === ch.id }"
                          @click="startEditChannel(ch)" @keydown.enter.space.prevent="startEditChannel(ch)">
                          <td class="td-check" @click.stop><input type="checkbox" :aria-label="t('accessibility.selectChannel', { name: ch.name })" :checked="selectedIds.has(ch.id)" @change="toggleSelect(ch.id)" /></td>
                          <td class="td-num">{{ (page - 1) * 50 + idx + 1 }}</td>
                          <td class="td-name">
                            <div class="ch-name-cell">
                              <img v-if="ch.logo_url" :src="ch.logo_url" class="row-logo" loading="lazy" :alt="t('accessibility.channelLogo', { name: ch.name })" @error="$event.target.style.display='none'" />
                              <span v-else class="row-logo-fb"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg></span>
                              <span>{{ ch.name }}</span>
                              <span v-if="activeStreamType !== 'live' && (ch.extras?.year || ch.extras?.rating)" class="ch-meta-badges">
                                <span v-if="ch.extras?.year" class="ch-meta-year">{{ ch.extras.year }}</span>
                                <span v-if="ch.extras?.rating" class="ch-meta-rating">{{ ch.extras.rating }}</span>
                              </span>
                            </div>
                          </td>
                          <td class="td-url"><span class="url-text">{{ shortenUrl(ch.stream_url) }}</span></td>
                          <td v-if="activeStreamType === 'live'" class="td-epg"><span class="health-dot" :class="ch.last_checked_at ? (ch.last_check_ok ? 'health-ok' : 'health-dead') : 'health-unchecked'" :title="ch.last_checked_at ? (ch.last_check_ok ? (ch.last_check_status ? `HTTP ${ch.last_check_status} - ${t('streamHealth.ok')}` : t('streamHealth.ok')) : (ch.last_check_status ? `HTTP ${ch.last_check_status}` : t('streamHealth.dead'))) : t('streamHealth.unchecked')"></span>{{ ch.epg_channel_id || '-' }}</td>
                          <td v-else class="td-epg"><span class="health-dot" :class="ch.last_checked_at ? (ch.last_check_ok ? 'health-ok' : 'health-dead') : 'health-unchecked'" :title="ch.last_checked_at ? (ch.last_check_ok ? (ch.last_check_status ? `HTTP ${ch.last_check_status} - ${t('streamHealth.ok')}` : t('streamHealth.ok')) : (ch.last_check_status ? `HTTP ${ch.last_check_status}` : t('streamHealth.dead'))) : t('streamHealth.unchecked')"></span>{{ ch.extras?.genres?.slice(0,2).join(', ') || ch.extras?.genre || '-' }}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div v-if="totalPages > 1" class="ch-pagination">
                      <button class="btn btn-secondary btn-sm" :disabled="page <= 1" @click="goToPage(page - 1)">←</button>
                      <span class="page-info">{{ page }} / {{ totalPages }}</span>
                      <button class="btn btn-secondary btn-sm" :disabled="page >= totalPages" @click="goToPage(page + 1)">→</button>
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
                      <div class="sort-move">
                        <button class="sort-move-btn" type="button" :disabled="idx === 0" :aria-label="t('sort.moveUp')" :title="t('sort.moveUp')" @click.stop="moveSortCat(idx, -1)">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                        </button>
                        <button class="sort-move-btn" type="button" :disabled="idx === categories.length - 1" :aria-label="t('sort.moveDown')" :title="t('sort.moveDown')" @click.stop="moveSortCat(idx, 1)">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <!-- Sağ: Kanallar -->
                <div class="sort-panel sort-panel-channels">
                  <div class="sort-panel-title">
                    {{ sortSelectedCat ? sortSelectedCat.name + ' ' + t('common.channels') : t('sort.selectCategory') }}
                  </div>
                  <div v-if="sortCatTotal > sortCatChannels.length" class="sort-truncated-warning">
                    {{ t('sort.truncatedWarning', { limit: SORT_FETCH_LIMIT, total: sortCatTotal }) }}
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
                      <img v-if="ch.logo_url" :src="ch.logo_url" class="sort-ch-logo" loading="lazy" :alt="t('accessibility.channelLogo', { name: ch.name })" @error="$event.target.style.display='none'" />
                      <span class="sort-name">{{ ch.name }}</span>
                      <span class="sort-count">#{{ idx + 1 }}</span>
                      <div class="sort-move">
                        <button class="sort-move-btn" type="button" :disabled="idx === 0" :aria-label="t('sort.moveUp')" :title="t('sort.moveUp')" @click.stop="moveSortChan(idx, -1)">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                        </button>
                        <button class="sort-move-btn" type="button" :disabled="idx === sortCatChannels.length - 1" :aria-label="t('sort.moveDown')" :title="t('sort.moveDown')" @click.stop="moveSortChan(idx, 1)">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                      </div>
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
                  <button :class="['epg-tab', { active: epgTab === 'profiles' }]" @click="epgTab = 'profiles'">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8-5-3.6-5 3.6 1.9-5.8L4 8.8h6.1z"/></svg>
                    {{ t('epgProfiles.tab') }}
                    <span v-if="epgProfiles.length" class="epg-tab-badge">{{ epgProfiles.length }}</span>
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
                      <img v-if="ch.logo_url" :src="ch.logo_url" class="epg-ch-logo" loading="lazy" :alt="t('accessibility.channelLogo', { name: ch.name })" @error="$event.target.style.display='none'" />
                      <div v-else class="epg-ch-logo-fb">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>
                      </div>
                      <span class="epg-ch-name">{{ ch.name }}</span>
                    </div>
                  </div>
                  <div class="epg-grid-body" ref="epgGridBodyRef" @scroll="onGridScroll">
                    <div class="epg-grid-track" :style="{ width: guideTrackWidth + 'px' }">
                      <div v-for="ch in guideChannels" :key="ch.id" class="epg-grid-row">
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
                  <div v-if="guideLoadingMore || guideChannels.length < guideTotal" class="epg-loading-more" role="status">
                    <span v-if="guideLoadingMore" class="spinner spinner-sm"></span>
                    <span>{{ t('epg.loadedCount', { loaded: guideChannels.length, total: guideTotal }) }}</span>
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
                      <input class="input" type="url" v-model="newEpgUrl" :aria-label="t('epg.addSourceTitle')" :placeholder="t('epg.urlPlaceholder')" @keyup.enter="addEpgSource" />
                      <button class="btn btn-primary btn-sm" @click="addEpgSource" :disabled="addingEpg || !newEpgUrl.trim()">
                        <span v-if="addingEpg" class="spinner" style="width:13px;height:13px"></span>
                        <span v-else>{{ t('common.add') }}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Source Library (iptv-org) -->
                <div class="epg-add-card">
                  <div class="epg-add-card-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                  </div>
                  <div class="epg-add-card-body">
                    <div class="epg-add-card-title">{{ t('epgLibrary.title') }}</div>
                    <div class="epg-add-card-desc">{{ t('epgLibrary.desc') }}</div>
                    <div class="epg-add-input-row">
                      <select class="input epg-lib-country" v-model="libCountry" :aria-label="t('epgLibrary.countryLabel')">
                        <option value="">{{ t('epgLibrary.allCountries') }}</option>
                        <option v-for="c in libCountries" :key="c.code" :value="c.code">{{ c.flag }} {{ c.name }}</option>
                      </select>
                      <input class="input" type="search" v-model="libQuery" :aria-label="t('epgLibrary.searchPlaceholder')" :placeholder="t('epgLibrary.searchPlaceholder')" />
                    </div>
                    <div class="epg-lib-results">
                      <div v-if="libLoading" class="epg-lib-status"><span class="spinner" style="width:14px;height:14px"></span> {{ t('epgLibrary.loading') }}</div>
                      <div v-else-if="libError" class="epg-lib-status">
                        <span>{{ t('epgLibrary.loadError') }}</span>
                        <button class="btn btn-secondary btn-xs" @click="searchLibrary">{{ t('epgLibrary.retry') }}</button>
                      </div>
                      <div v-else-if="!libGuides.length" class="epg-lib-status">{{ t('epgLibrary.noResults') }}</div>
                      <div v-else class="epg-lib-list">
                        <div v-for="g in libGuides.slice(0, 50)" :key="g.site" class="epg-lib-item">
                          <div class="epg-lib-item-info">
                            <div class="epg-lib-item-name">{{ g.site }}</div>
                            <div class="epg-lib-item-meta">
                              <span>{{ t('epgLibrary.channelCount', { count: g.channelCount }) }}</span>
                              <span v-if="g.sampleChannels && g.sampleChannels.length" class="epg-lib-item-samples">{{ g.sampleChannels.join(', ') }}</span>
                            </div>
                          </div>
                          <button v-if="g.url" class="btn btn-primary btn-xs" @click="addFromLibrary(g)" :disabled="libAdding === g.site">
                            <span v-if="libAdding === g.site" class="spinner" style="width:12px;height:12px"></span>
                            <span v-else>{{ t('common.add') }}</span>
                          </button>
                          <span v-else class="epg-lib-no-url" :title="t('epgLibrary.noUrlHint')">{{ t('epgLibrary.noUrl') }}</span>
                        </div>
                      </div>
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
                    <div class="epg-src-autorefresh">
                      <label class="epg-src-autorefresh-label" :for="`epg-refresh-${s.id}`">{{ t('autoSync.epgRefresh') }}</label>
                      <select
                        :id="`epg-refresh-${s.id}`"
                        class="input epg-src-autorefresh-select"
                        :value="s.refresh_interval_minutes === null || s.refresh_interval_minutes === undefined ? '' : String(s.refresh_interval_minutes)"
                        :disabled="s._savingInterval"
                        @change="saveEpgRefreshInterval(s, $event.target.value)"
                      >
                        <option value="">{{ t('autoSync.off') }}</option>
                        <option value="360">{{ t('autoSync.every6h') }}</option>
                        <option value="720">{{ t('autoSync.every12h') }}</option>
                        <option value="1440">{{ t('autoSync.every24h') }}</option>
                        <option value="2880">{{ t('autoSync.every48h') }}</option>
                        <option value="10080">{{ t('autoSync.weekly') }}</option>
                      </select>
                      <span v-if="s._savingInterval" class="spinner" style="width:12px;height:12px"></span>
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

              <!-- TAB: Match Profiles -->
              <div v-if="epgTab === 'profiles'" class="epg-sources-wrap">
                <!-- Create Profile -->
                <div class="epg-add-card">
                  <div class="epg-add-card-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8-5-3.6-5 3.6 1.9-5.8L4 8.8h6.1z"/></svg>
                  </div>
                  <div class="epg-add-card-body">
                    <div class="epg-add-card-title">{{ t('epgProfiles.title') }}</div>
                    <div class="epg-add-card-desc">{{ t('epgProfiles.desc') }}</div>
                    <div class="epg-profile-form">
                      <input class="input" v-model="newProfile.name" :aria-label="t('epgProfiles.namePlaceholder')" :placeholder="t('epgProfiles.namePlaceholder')" @keyup.enter="createEpgProfile" />
                      <div class="epg-profile-fields">
                        <label class="epg-profile-field">
                          <span>{{ t('epgProfiles.prefixesLabel') }}</span>
                          <input class="input" v-model="newProfile.stripPrefixes" :placeholder="t('epgProfiles.prefixesPlaceholder')" @keyup.enter="createEpgProfile" />
                        </label>
                        <label class="epg-profile-field">
                          <span>{{ t('epgProfiles.suffixesLabel') }}</span>
                          <input class="input" v-model="newProfile.stripSuffixes" :placeholder="t('epgProfiles.suffixesPlaceholder')" @keyup.enter="createEpgProfile" />
                        </label>
                        <label class="epg-profile-field">
                          <span>{{ t('epgProfiles.ignoreLabel') }}</span>
                          <input class="input" v-model="newProfile.ignoreWords" :placeholder="t('epgProfiles.ignorePlaceholder')" @keyup.enter="createEpgProfile" />
                        </label>
                      </div>
                      <div class="epg-add-input-row">
                        <button class="btn btn-primary btn-sm" @click="createEpgProfile" :disabled="savingProfile || !newProfile.name.trim()">
                          <span v-if="savingProfile" class="spinner" style="width:13px;height:13px"></span>
                          <span v-else>{{ t('epgProfiles.create') }}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Profile List -->
                <div v-if="epgProfiles.length" class="epg-source-cards">
                  <div v-for="p in epgProfiles" :key="p.id" class="epg-src-card">
                    <div class="epg-src-card-header">
                      <div class="epg-src-info">
                        <div class="epg-src-url">{{ p.name }}</div>
                        <div class="epg-src-meta">
                          <span class="badge badge-success">{{ t('epgProfiles.matched', { count: p.mapped_count }) }}</span>
                          <span class="epg-src-date">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            {{ p.last_run_at ? t('epgProfiles.lastRun', { date: formatDateTime(p.last_run_at) }) : t('epgProfiles.neverRun') }}
                          </span>
                        </div>
                        <div v-if="profileSettingsSummary(p)" class="epg-profile-settings">{{ profileSettingsSummary(p) }}</div>
                      </div>
                      <div class="epg-src-actions">
                        <button class="epg-src-btn" @click="runEpgProfile(p)" :disabled="runningProfileId === p.id" :title="t('epgProfiles.run')">
                          <span v-if="runningProfileId === p.id" class="spinner" style="width:12px;height:12px"></span>
                          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </button>
                        <button class="epg-src-btn epg-src-btn-danger" @click="deleteEpgProfile(p)" :title="t('common.delete')">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="epg-no-sources">
                  <div class="epg-no-sources-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8-5-3.6-5 3.6 1.9-5.8L4 8.8h6.1z"/></svg>
                  </div>
                  <p>{{ t('epgProfiles.empty') }}</p>
                  <span>{{ t('epgProfiles.emptyHint') }}</span>
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
                  <span class="cat-editor-count">{{ cat.channel_count || 0 }} {{ streamTypeLabel.unit }}</span>
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
                    <button class="btn btn-primary" @click="startSyncPreview" :disabled="syncPreviewLoading || syncing" style="flex:1">
                      <span v-if="syncPreviewLoading || syncing" class="spinner" style="width:14px;height:14px"></span>
                      <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                      {{ syncPreviewLoading ? t('updateView.loadingCategories') : (syncing ? t('xtream.updating') : t('xtream.updateChannels')) }}
                    </button>
                    <button class="btn btn-secondary" @click="openXtream" :title="t('xtream.changeAccount')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      {{ t('common.change') }}
                    </button>
                    <button class="btn btn-secondary" @click="toggleAccountEdit" :title="t('xtream.accountEdit')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                      {{ t('xtream.accountEdit') }}
                    </button>
                  </div>

                  <!-- Xtream hesap duzenleme formu -->
                  <div v-if="accountEditOpen" class="account-edit-form">
                    <p class="account-edit-desc">{{ t('xtream.accountEditDesc') }}</p>
                    <div class="form-group">
                      <label for="ae-server">{{ t('xtream.serverUrl') }}</label>
                      <input id="ae-server" class="input" type="url" v-model="accountEditForm.serverUrl" />
                    </div>
                    <div class="form-group">
                      <label for="ae-username">{{ t('xtream.username') }}</label>
                      <input id="ae-username" class="input" v-model="accountEditForm.username" />
                    </div>
                    <div class="form-group">
                      <label for="ae-password">{{ t('xtream.password') }}</label>
                      <input id="ae-password" class="input" type="password" v-model="accountEditForm.password" :placeholder="t('xtream.passwordKeep')" autocomplete="new-password" />
                    </div>
                    <div class="account-edit-actions">
                      <button class="btn btn-secondary btn-sm" @click="accountEditOpen = false">{{ t('common.cancel') }}</button>
                      <button class="btn btn-primary btn-sm" :disabled="accountEditSaving || !accountEditForm.serverUrl.trim() || !accountEditForm.username.trim()" @click="saveAccountEdit">
                        <span v-if="accountEditSaving" class="spinner spinner-sm"></span>
                        {{ t('common.save') }}
                      </button>
                    </div>
                  </div>

                  <!-- Otomatik guncelleme ayarlari -->
                  <div class="auto-sync-section">
                    <div class="auto-sync-header">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      <span class="auto-sync-title">{{ t('autoSync.title') }}</span>
                    </div>
                    <div class="auto-sync-controls">
                      <select v-model="autoSyncInterval" class="input auto-sync-select" :disabled="autoSyncSaving" :aria-label="t('autoSync.interval')">
                        <option :value="null">{{ t('autoSync.off') }}</option>
                        <option :value="360">{{ t('autoSync.every6h') }}</option>
                        <option :value="720">{{ t('autoSync.every12h') }}</option>
                        <option :value="1440">{{ t('autoSync.every24h') }}</option>
                        <option :value="2880">{{ t('autoSync.every48h') }}</option>
                        <option :value="10080">{{ t('autoSync.weekly') }}</option>
                      </select>
                      <label class="auto-sync-backup">
                        <input type="checkbox" v-model="autoSyncBackup" :disabled="autoSyncSaving || autoSyncInterval === null" />
                        <span>{{ t('autoSync.backupBeforeSync') }}</span>
                      </label>
                      <button class="btn btn-secondary btn-sm" @click="saveAutoSync" :disabled="autoSyncSaving">
                        <span v-if="autoSyncSaving" class="spinner" style="width:12px;height:12px"></span>
                        {{ t('common.save') }}
                      </button>
                    </div>
                    <p v-if="autoSyncInterval !== null && savedXtream.lastSynced" class="auto-sync-hint">
                      {{ t('autoSync.lastRun') }}: {{ new Date(savedXtream.lastSynced).toLocaleString() }}
                    </p>
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

                <!-- Sync kategori secim paneli -->
                <div v-if="syncPreview" class="sync-select-panel">
                  <h4 class="sync-select-title">{{ t('updateView.selectTitle') }}</h4>
                  <p class="sync-select-desc">{{ t('updateView.selectDesc') }}</p>

                  <fieldset v-for="type in syncAvailableTypes" :key="type" class="sync-type-block" :disabled="syncing">
                    <legend class="sync-type-legend">{{ t({ live: 'xtream.typeLive', series: 'xtream.typeSeries', vod: 'xtream.typeVod' }[type]) }}</legend>

                    <div class="search-group" v-if="syncPreview.types[type].categories.length > 10">
                      <input v-model="syncSearches[type]" class="input" type="search" autocomplete="off" :placeholder="t('xtreamWizard.searchPlaceholder')" />
                    </div>

                    <div class="category-toolbar">
                      <div class="category-actions">
                        <button class="btn btn-secondary btn-sm" type="button" :disabled="syncFilteredCategories(type).length === 0" @click="syncSelectVisible(type)">
                          {{ t('xtreamWizard.selectAll') }}
                        </button>
                        <button class="btn btn-ghost btn-sm" type="button" :disabled="syncSelection[type].size === 0" @click="syncDeselectAll(type)">
                          {{ t('xtreamWizard.deselectAll') }}
                        </button>
                      </div>
                      <span class="selected-counter" aria-live="polite">
                        {{ t('xtreamWizard.selectedCounter', { selected: syncSelection[type].size, total: syncPreview.types[type].categories.length }) }}
                      </span>
                    </div>

                    <div class="category-list" tabindex="0">
                      <ul v-if="syncFilteredCategories(type).length">
                        <li v-for="cat in syncFilteredCategories(type)" :key="cat.id" class="category-row">
                          <input :id="`sync-cat-${type}-${cat.id}`" type="checkbox" :checked="syncSelection[type].has(cat.id)" @change="syncSetCategory(type, cat.id, $event.target.checked)" />
                          <label :for="`sync-cat-${type}-${cat.id}`">
                            {{ cat.name || t('xtreamWizard.unnamedCategory', { id: cat.id }) }}
                            <span v-if="cat.isNew" class="sync-new-badge">{{ t('updateView.newBadge') }}</span>
                          </label>
                        </li>
                      </ul>
                      <p v-else class="empty-categories">{{ syncSearches[type].trim() ? t('common.noResults') : t('xtreamWizard.noCategories') }}</p>
                    </div>
                  </fieldset>

                  <p v-if="!syncCanRun" class="selection-warning" role="alert">{{ t('updateView.selectOne') }}</p>

                  <div class="sync-select-actions">
                    <button class="btn btn-secondary" type="button" :disabled="syncing" @click="cancelSyncSelection">{{ t('common.cancel') }}</button>
                    <button class="btn btn-primary" type="button" :disabled="syncing || !syncCanRun" @click="doSync">
                      <span v-if="syncing" class="spinner" style="width:14px;height:14px"></span>
                      {{ syncing ? t('xtream.updating') : t('updateView.startUpdate') }}
                    </button>
                  </div>
                </div>

                <!-- Sync raporu -->
                <div v-if="syncResult" class="sync-report">
                  <h4 class="sync-report-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    {{ t('updateView.reportTitle') }}
                  </h4>
                  <div class="sync-report-stats">
                    <span class="badge badge-success">{{ t('updateView.addedCount', { count: syncResult.added }) }}</span>
                    <span class="badge badge-accent">{{ t('updateView.updatedCount', { count: syncResult.updated }) }}</span>
                    <span v-if="syncResult.removed" class="badge badge-danger">{{ t('updateView.removedCount', { count: syncResult.removed }) }}</span>
                    <span v-if="syncResult.filteredOut" class="badge">{{ t('updateView.filteredOutCount', { count: syncResult.filteredOut }) }}</span>
                  </div>

                  <div class="sync-report-section">
                    <h5>{{ t('updateView.addedCategories', { count: (syncResult.addedCategories || []).length }) }}</h5>
                    <div v-if="(syncResult.addedCategories || []).length" class="sync-report-tags">
                      <span v-for="name in syncResult.addedCategories" :key="name" class="sync-report-tag">{{ name }}</span>
                    </div>
                    <p v-else class="sync-report-empty">{{ t('updateView.noAddedCategories') }}</p>
                  </div>

                  <div class="sync-report-section">
                    <h5>{{ t('updateView.newChannels', { count: syncResult.added }) }}</h5>
                    <ul v-if="(syncResult.addedChannelNames || []).length" class="sync-report-channels">
                      <li v-for="name in syncResult.addedChannelNames" :key="name">{{ name }}</li>
                      <li v-if="syncResult.added > syncResult.addedChannelNames.length" class="sync-report-more">{{ t('updateView.andMore', { count: syncResult.added - syncResult.addedChannelNames.length }) }}</li>
                    </ul>
                    <p v-else class="sync-report-empty">{{ t('updateView.noNewChannels') }}</p>
                  </div>

                  <button class="btn btn-ghost btn-sm" type="button" @click="syncResult = null">{{ t('common.close') }}</button>
                </div>

                <!-- Add Stream Types Section -->
                <div v-if="savedXtream" class="add-types-section">
                  <h4 class="add-types-title">{{ t('addTypes.title') }}</h4>
                  <p class="add-types-desc">{{ t('addTypes.desc') }}</p>
                  <div class="add-types-current">
                    <span class="badge" :class="savedXtreamTypes.includes('live') ? 'badge-success' : 'badge-accent'" v-if="savedXtreamTypes.includes('live')">{{ t('xtream.typeLive') }}</span>
                    <span class="badge" :class="savedXtreamTypes.includes('vod') ? 'badge-success' : 'badge-accent'" v-if="savedXtreamTypes.includes('vod')">{{ t('xtream.typeVod') }}</span>
                    <span class="badge" :class="savedXtreamTypes.includes('series') ? 'badge-success' : 'badge-accent'" v-if="savedXtreamTypes.includes('series')">{{ t('xtream.typeSeries') }}</span>
                  </div>
                  <div class="add-types-buttons">
                    <button v-if="!savedXtreamTypes.includes('vod')"
                      class="btn btn-secondary" @click="doAddTypes(['vod'])" :disabled="addingTypes">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
                      {{ addingTypes ? t('common.importing') : t('addTypes.addMovies') }}
                    </button>
                    <button v-if="!savedXtreamTypes.includes('series')"
                      class="btn btn-secondary" @click="doAddTypes(['series'])" :disabled="addingTypes">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>
                      {{ addingTypes ? t('common.importing') : t('addTypes.addSeries') }}
                    </button>
                    <button v-if="!savedXtreamTypes.includes('vod') && !savedXtreamTypes.includes('series')"
                      class="btn btn-primary" @click="doAddTypes(['vod', 'series'])" :disabled="addingTypes">
                      <span v-if="addingTypes" class="spinner" style="width:14px;height:14px"></span>
                      {{ addingTypes ? t('common.importing') : t('addTypes.addBoth') }}
                    </button>
                  </div>
                  <div v-if="addTypesResult" class="result-box success" style="margin-top:12px">
                    {{ t('addTypes.result', { added: addTypesResult.added, types: addTypesResult.addedTypes.join(', '), duration: (addTypesResult.duration / 1000).toFixed(1) }) }}
                  </div>
                  <div v-if="savedXtreamTypes.includes('vod') && savedXtreamTypes.includes('series') && savedXtreamTypes.includes('live')" class="add-types-complete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    {{ t('addTypes.allAdded') }}
                  </div>
                </div>

                <!-- Filtre Kurallari -->
                <div class="add-types-section">
                  <h4 class="add-types-title">{{ t('filterRules.title') }}</h4>
                  <p class="add-types-desc">{{ t('filterRules.desc') }}</p>

                  <ul v-if="filterRules.length" class="filter-rule-list">
                    <li v-for="(rule, idx) in filterRules" :key="rule.id" class="filter-rule-row" :class="{ 'filter-rule-disabled': !rule.enabled }">
                      <span class="badge" :class="rule.exclude ? 'badge-danger' : 'badge-success'">{{ rule.exclude ? t('filterRules.exclude') : t('filterRules.include') }}</span>
                      <span class="filter-rule-field">{{ t('filterRules.fields.' + rule.field) }}</span>
                      <code class="filter-rule-pattern" :title="rule.pattern">{{ rule.pattern }}</code>
                      <div class="filter-rule-actions">
                        <button class="btn btn-ghost btn-icon-sm" type="button" :disabled="idx === 0" :title="t('filterRules.moveUp')" @click="moveFilterRule(rule, 'up')">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                        </button>
                        <button class="btn btn-ghost btn-icon-sm" type="button" :disabled="idx === filterRules.length - 1" :title="t('filterRules.moveDown')" @click="moveFilterRule(rule, 'down')">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        <button class="btn btn-ghost btn-icon-sm" type="button" :title="rule.enabled ? t('filterRules.disable') : t('filterRules.enable')" @click="toggleFilterRule(rule)">
                          <svg v-if="rule.enabled" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        </button>
                        <button class="btn btn-ghost btn-icon-sm" type="button" :title="t('common.delete')" @click="deleteFilterRule(rule)">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </li>
                  </ul>
                  <p v-else class="filter-rule-empty">{{ t('filterRules.empty') }}</p>

                  <form class="filter-rule-form" @submit.prevent="addFilterRule">
                    <select v-model="newRule.field" class="input filter-rule-select" :aria-label="t('filterRules.fieldLabel')">
                      <option value="group">{{ t('filterRules.fields.group') }}</option>
                      <option value="name">{{ t('filterRules.fields.name') }}</option>
                      <option value="url">{{ t('filterRules.fields.url') }}</option>
                    </select>
                    <input v-model="newRule.pattern" class="input filter-rule-input" type="text" autocomplete="off" :placeholder="t('filterRules.patternPlaceholder')" />
                    <select v-model="newRule.exclude" class="input filter-rule-select" :aria-label="t('filterRules.modeLabel')">
                      <option :value="true">{{ t('filterRules.exclude') }}</option>
                      <option :value="false">{{ t('filterRules.include') }}</option>
                    </select>
                    <button class="btn btn-secondary btn-sm" type="button" :disabled="!newRule.pattern.trim() || ruleTesting" @click="testFilterRule">
                      <span v-if="ruleTesting" class="spinner" style="width:12px;height:12px"></span>
                      {{ t('filterRules.test') }}
                    </button>
                    <button class="btn btn-primary btn-sm" type="submit" :disabled="!newRule.pattern.trim() || ruleSaving">
                      <span v-if="ruleSaving" class="spinner" style="width:12px;height:12px"></span>
                      {{ t('filterRules.add') }}
                    </button>
                  </form>
                  <div v-if="ruleTestResult" class="filter-rule-test-result">
                    <p class="filter-rule-test-summary">{{ t('filterRules.testSummary', { count: ruleTestResult.matches.length, sampled: ruleTestResult.sampled }) }}</p>
                    <ul v-if="ruleTestResult.matches.length" class="filter-rule-test-matches">
                      <li v-for="match in ruleTestResult.matches" :key="match.name">
                        {{ match.name }} <span v-if="match.group" class="filter-rule-test-group">{{ match.group }}</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <!-- Ek Kaynaklar (coklu kaynak) -->
                <div v-if="savedXtream" class="add-types-section">
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
              <button class="btn btn-ghost btn-icon-sm" :aria-label="t('accessibility.closeEditPanel')" @click="editingChannel = null">✕</button>
            </div>
            <div class="ep-body">
              <div class="ep-logo-area">
                <div v-if="editForm.logo_url" class="ep-logo-preview" role="button" tabindex="0" @click="triggerLogoUpload" @keydown.enter.space.prevent="triggerLogoUpload" :title="t('editPanel.uploadLogo')">
                  <img :src="editForm.logo_url" :alt="t('accessibility.channelLogo', { name: editingChannel.name })" @error="$event.target.style.display='none'" />
                  <div class="ep-logo-overlay">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </div>
                </div>
                <div v-else class="ep-logo-placeholder ep-logo-upload" role="button" tabindex="0" @click="triggerLogoUpload" @keydown.enter.space.prevent="triggerLogoUpload" :title="t('editPanel.uploadLogo')">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span class="ep-logo-upload-hint">{{ t('common.upload') }}</span>
                </div>
                <input ref="logoFileInput" type="file" accept="image/png,image/jpeg,image/gif,image/webp" style="display:none" @change="handleLogoUpload" />
              </div>
              <div class="ep-form">
                <div class="form-group epg-ac-wrap">
                  <label for="channel-name">{{ t('editPanel.channelName') }}</label>
                  <input id="channel-name" class="input" v-model="editForm.name" @input="onNameInput" @focus="onNameFocus" @blur="onNameBlur" autocomplete="off" />
                  <!-- EPG Autocomplete Dropdown -->
                  <div v-if="epgAcResults.length > 0 && epgAcOpen" class="epg-ac-dropdown" role="listbox">
                    <div v-for="epgCh in epgAcResults" :key="epgCh.source_id + ':' + epgCh.channel_id" class="epg-ac-item" role="option" tabindex="0" @mousedown.prevent="selectEpgChannel(epgCh)" @keydown.enter.space.prevent="selectEpgChannel(epgCh)">
                      <img v-if="epgCh.icon_url" :src="epgCh.icon_url" class="epg-ac-logo" alt="" @error="$event.target.style.display='none'" />
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
                <div class="form-row" v-if="activeStreamType === 'live'">
                  <div class="form-group epg-ac-wrap" style="flex:1">
                    <label for="channel-epg-id">{{ t('editPanel.epgId') }}</label>
                    <input id="channel-epg-id" class="input" v-model="editForm.epg_channel_id" :placeholder="t('common.optional')" @input="onEpgIdInput" @focus="onEpgIdFocus" @blur="onEpgIdBlur" autocomplete="off" />
                    <div v-if="epgIdAcResults.length > 0 && epgIdAcOpen" class="epg-ac-dropdown" role="listbox">
                      <div v-for="epgCh in epgIdAcResults" :key="epgCh.source_id + ':' + epgCh.channel_id" class="epg-ac-item" role="option" tabindex="0" @mousedown.prevent="selectEpgFromId(epgCh)" @keydown.enter.space.prevent="selectEpgFromId(epgCh)">
                        <img v-if="epgCh.icon_url" :src="epgCh.icon_url" class="epg-ac-logo" alt="" @error="$event.target.style.display='none'" />
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
                    <img :src="epgSelectedIcon" class="epg-logo-offer-img" :alt="t('accessibility.selectedEpgLogo')" @error="epgSelectedIcon = null" />
                  </div>
                  <div class="epg-logo-offer-info">
                    <span class="epg-logo-offer-label">{{ t('editPanel.epgLogoAvailable') }}</span>
                    <button class="btn btn-accent btn-xs" @click="applyEpgLogo">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      {{ t('editPanel.getLogoFromEpg') }}
                    </button>
                  </div>
                </div>
                <div class="form-group">
                  <label for="channel-logo-url">{{ t('editPanel.logoUrl') }}</label>
                  <div class="ep-input-action-wrap">
                    <input id="channel-logo-url" class="input ep-input-with-action" type="url" v-model="editForm.logo_url" :placeholder="t('editPanel.logoPlaceholder')" />
                    <button class="ep-input-action" type="button" :title="t('logoLibrary.openHint')" :aria-label="t('logoLibrary.openButton')" @click="openLogoLibrary">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="20.5" y1="20.5" x2="16.65" y2="16.65"/></svg>
                    </button>
                  </div>
                </div>
                <div class="form-group"><label for="channel-stream-url">{{ t('editPanel.streamUrl') }}</label><input id="channel-stream-url" class="input" type="url" v-model="editForm.stream_url" /></div>
                <StreamTestControl
                  :channel-id="editingChannel.id"
                  :has-unsaved-url="(editForm.stream_url || '') !== (editingChannel.stream_url || '')"
                />
                <div class="form-group"><label for="channel-category">{{ t('common.category') }}</label>
                  <select id="channel-category" class="input" v-model="editForm.category_id">
                    <option :value="null">{{ t('common.uncategorized') }}</option>
                    <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
                  </select>
                </div>
              </div>
              <!-- EPG Section (yalnizca canli TV; film/dizide yayin akisi olmaz) -->
              <div v-if="activeStreamType === 'live' && editingChannel.epg_channel_id && getCurrentAndNext().length" class="ep-epg-section">
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
              <!-- Metadata Section (VOD/Series) -->
              <div v-if="activeStreamType !== 'live'" class="ep-metadata-section">
                <div class="ep-metadata-header">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  <span>{{ t('metadata.title') }}</span>
                  <button class="btn btn-accent btn-xs" @click="fetchXtreamMetadata" :disabled="fetchingMetadata" style="margin-left:auto">
                    <span v-if="fetchingMetadata" class="spinner" style="width:11px;height:11px"></span>
                    {{ fetchingMetadata ? t('metadata.fetching') : (editingChannel.extras?.metadata_fetched ? t('metadata.refetch') : t('metadata.fetch')) }}
                  </button>
                </div>
                <div v-if="editingChannel.extras?.metadata_fetched" class="ep-metadata-body">
                  <div v-if="editingChannel.extras.backdrop_url" class="ep-meta-backdrop">
                    <img :src="editingChannel.extras.backdrop_url" :alt="t('accessibility.backdropImage', { name: editingChannel.name })" @error="$event.target.style.display='none'" />
                  </div>
                  <div v-if="editingChannel.extras.overview" class="ep-meta-overview">{{ editingChannel.extras.overview }}</div>
                  <div class="ep-meta-grid">
                    <div v-if="editingChannel.extras.year" class="ep-meta-item">
                      <span class="ep-meta-label">{{ t('metadata.year') }}</span>
                      <span class="ep-meta-value">{{ editingChannel.extras.year }}</span>
                    </div>
                    <div v-if="editingChannel.extras.rating" class="ep-meta-item">
                      <span class="ep-meta-label">{{ t('metadata.rating') }}</span>
                      <span class="ep-meta-value ep-meta-rating">{{ editingChannel.extras.rating.toFixed ? editingChannel.extras.rating.toFixed(1) : editingChannel.extras.rating }}</span>
                    </div>
                    <div v-if="editingChannel.extras.runtime" class="ep-meta-item">
                      <span class="ep-meta-label">{{ t('metadata.runtime') }}</span>
                      <span class="ep-meta-value">{{ editingChannel.extras.runtime }} {{ t('metadata.min') }}</span>
                    </div>
                    <div v-if="editingChannel.extras.seasons" class="ep-meta-item">
                      <span class="ep-meta-label">{{ t('metadata.seasons') }}</span>
                      <span class="ep-meta-value">{{ editingChannel.extras.seasons }}</span>
                    </div>
                    <div v-if="editingChannel.extras.episodes" class="ep-meta-item">
                      <span class="ep-meta-label">{{ t('metadata.episodes') }}</span>
                      <span class="ep-meta-value">{{ editingChannel.extras.episodes }}</span>
                    </div>
                  </div>
                  <div v-if="editingChannel.extras.genres?.length" class="ep-meta-genres">
                    <span v-for="g in editingChannel.extras.genres" :key="g" class="ep-meta-genre-tag">{{ g }}</span>
                  </div>
                  <div v-if="editingChannel.extras.director" class="ep-meta-info">
                    <span class="ep-meta-label">{{ t('metadata.director') }}:</span> {{ editingChannel.extras.director }}
                  </div>
                  <div v-if="editingChannel.extras.cast" class="ep-meta-info">
                    <span class="ep-meta-label">{{ t('metadata.cast') }}:</span> {{ typeof editingChannel.extras.cast === 'string' ? editingChannel.extras.cast : editingChannel.extras.cast.slice(0, 5).join(', ') }}
                  </div>
                  <div v-if="editingChannel.extras.imdb_id" class="ep-meta-info ep-meta-ids">
                    <span>{{ t('metadata.imdbId') }}: {{ editingChannel.extras.imdb_id }}</span>
                    <span v-if="editingChannel.extras.tmdb_id">{{ t('metadata.tmdbId') }}: {{ editingChannel.extras.tmdb_id }}</span>
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
              <span class="ep-empty-hint">{{ totalChannelCount }} {{ streamTypeLabel.unit }}</span>
            </div>
          </aside>
        </div>
      </div>
    </div>

    <!-- Feature modals -->
    <AddChannelModal
      v-if="showAddChannel"
      :playlist-id="playlistId"
      :categories="categories"
      :initial-stream-type="activeStreamType"
      @created="handleChannelCreated"
      @close="showAddChannel = false"
    />
    <BulkRenameModal
      v-if="showBulkRename"
      :channel-ids="selectedChannelIds"
      @applied="handleBulkApplied"
      @close="showBulkRename = false"
    />
    <BulkUpdateModal
      v-if="showBulkUpdate"
      :channel-ids="selectedChannelIds"
      :categories="categories"
      @applied="handleBulkApplied"
      @close="showBulkUpdate = false"
    />
    <SharePlaylistModal v-if="showShare" :playlist-id="playlistId" :is-shared="playlistShared" @shared="playlistShared = true" @revoked="playlistShared = false" @close="showShare = false" />
    <XtreamOutputModal v-if="showXtreamOutput" :playlist-id="playlistId" :hidden-count="categories.filter(c => c.is_hidden).length" @close="showXtreamOutput = false" />
    <ViewProfilesModal v-if="showViewProfiles" :playlist-id="playlistId" :categories="categories" @close="showViewProfiles = false" @applied="onViewProfileApplied" />
    <LogoLibraryModal v-if="showLogoLibrary" :channel-name="editForm.name || editingChannel?.name || ''" @close="showLogoLibrary = false" @select="applyLibraryLogo" />
    <XtreamImportWizard
      v-if="showXtreamModal"
      :playlist-id="playlistId"
      @close="showXtreamModal = false"
      @imported="handleXtreamImported"
    />
    <ConfirmModal
      v-if="confirmState"
      :title="confirmState.title"
      :message="confirmState.message"
      :loading="confirmLoading"
      @confirm="handleConfirm"
      @cancel="confirmState = null"
    />

    <!-- Existing modals -->
    <!-- M3U Import Modal (Editor) -->
    <Teleport to="body">
      <div v-if="showM3uImportInEditor" v-focus-trap class="modal-overlay" @click.self="showM3uImportInEditor = false">
        <div class="modal">
          <div class="modal-header">
            <h3>{{ t('m3uImport.title') }}</h3>
            <button class="btn btn-ghost btn-icon-sm" @click="showM3uImportInEditor = false">✕</button>
          </div>
          <div class="form-group">
            <label for="editor-m3u-url">{{ t('m3uImport.fromUrl') }}</label>
            <input id="editor-m3u-url" class="input" type="url" v-model="editorM3uForm.url" :placeholder="t('m3uImport.urlPlaceholder')" />
          </div>
          <div class="url-divider"><span>{{ t('common.or') }}</span></div>
          <div class="form-group">
            <label for="editor-m3u-file">{{ t('m3uImport.fromFile') }}</label>
            <input id="editor-m3u-file" type="file" accept=".m3u,.m3u8,.txt" @change="onEditorM3uFile" class="input" />
          </div>
          <div v-if="editorM3uError" class="result-box error">{{ editorM3uError }}</div>
          <div v-if="editorM3uResult" class="result-box success">
            {{ t('toast.importSuccess', { channels: editorM3uResult.totalChannels, categories: editorM3uResult.totalCategories, duration: (editorM3uResult.duration / 1000).toFixed(1) }) }}
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" @click="showM3uImportInEditor = false">{{ t('common.close') }}</button>
            <button class="btn btn-primary" @click="doEditorM3uImport" :disabled="editorM3uImporting || (!editorM3uForm.url && !editorM3uForm.content)">
              <span v-if="editorM3uImporting" class="spinner" style="width:14px;height:14px"></span>
              {{ editorM3uImporting ? t('common.importing') : t('common.import') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="showBulkMove" v-focus-trap class="modal-overlay" @click.self="showBulkMove = false">
        <div class="modal">
          <div class="modal-header"><h3>{{ t('bulkMove.title') }}</h3><button class="btn btn-ghost btn-icon-sm" @click="showBulkMove = false">✕</button></div>
          <div class="form-group"><label for="bulk-target-category">{{ t('bulkMove.targetCategory') }}</label>
            <select id="bulk-target-category" class="input" v-model="bulkTargetCat">
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
      <div v-if="showCatCreate" v-focus-trap class="modal-overlay" @click.self="showCatCreate = false">
        <div class="modal">
          <div class="modal-header"><h3>{{ t('categoryEditor.createTitle') }}</h3><button class="btn btn-ghost btn-icon-sm" @click="showCatCreate = false">✕</button></div>
          <div class="form-group"><label>{{ t('categoryEditor.nameLabel') }}</label><input class="input" v-model="newCatName" @keyup.enter="createCategory" autofocus /></div>
          <div class="modal-actions"><button class="btn btn-secondary" @click="showCatCreate = false">{{ t('common.cancel') }}</button><button class="btn btn-primary" @click="createCategory" :disabled="!newCatName.trim()">{{ t('common.create') }}</button></div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="editingCat" v-focus-trap class="modal-overlay" @click.self="editingCat = null">
        <div class="modal">
          <div class="modal-header"><h3>{{ t('categoryEditor.editTitle') }}</h3><button class="btn btn-ghost btn-icon-sm" @click="editingCat = null">✕</button></div>
          <div class="form-group"><label>{{ t('categoryEditor.nameLabel') }}</label><input class="input" v-model="editCatName" @keyup.enter="updateCategory" /></div>
          <div class="modal-actions"><button class="btn btn-secondary" @click="editingCat = null">{{ t('common.cancel') }}</button><button class="btn btn-primary" @click="updateCategory" :disabled="!editCatName.trim()">{{ t('common.save') }}</button></div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="deletingCat" v-focus-trap class="modal-overlay" @click.self="deletingCat = null">
        <div class="modal">
          <div class="modal-header"><h3>{{ t('categoryEditor.deleteTitle') }}</h3><button class="btn btn-ghost btn-icon-sm" @click="deletingCat = null">✕</button></div>
          <p style="font-size:13px;color:var(--text-secondary)">"{{ deletingCat.name }}" {{ t('categoryEditor.deleteConfirm') }}</p>
          <div class="modal-actions"><button class="btn btn-secondary" @click="deletingCat = null">{{ t('common.cancel') }}</button><button class="btn btn-danger" @click="doDeleteCat">{{ t('common.delete') }}</button></div>
        </div>
      </div>
    </Teleport>
    <!-- EPG Program Detail Modal -->
    <Teleport to="body">
      <div v-if="selectedProgram" v-focus-trap class="modal-overlay" @click.self="selectedProgram = null">
        <div class="modal epg-detail-modal">
          <div class="epg-detail-header">
            <div class="epg-detail-channel" v-if="selectedProgramChannel">
              <img v-if="selectedProgramChannel.logo_url" :src="selectedProgramChannel.logo_url" class="epg-detail-ch-logo" :alt="t('accessibility.channelLogo', { name: selectedProgramChannel.name })" @error="$event.target.style.display='none'" />
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
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { useI18n } from '../langs/useI18n'
import AddChannelModal from '../components/AddChannelModal.vue'
import BulkRenameModal from '../components/BulkRenameModal.vue'
import BulkUpdateModal from '../components/BulkUpdateModal.vue'
import SharePlaylistModal from '../components/SharePlaylistModal.vue'
import StreamTestControl from '../components/StreamTestControl.vue'
import XtreamImportWizard from '../components/XtreamImportWizard.vue'
import XtreamOutputModal from '../components/XtreamOutputModal.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import ViewProfilesModal from '../components/ViewProfilesModal.vue'
import LogoLibraryModal from '../components/LogoLibraryModal.vue'

const route = useRoute()
const router = useRouter()
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
const activeFilter = ref('')
const page = ref(1)
const totalPages = ref(1)
const totalChannelCount = ref(0)
const tableTotal = ref(0)
const selectedIds = ref(new Set())
const editingChannel = ref(null)
const editForm = ref({})
const logoFileInput = ref(null)
const logoUploading = ref(false)
const showLogoLibrary = ref(false)
const fetchingMetadata = ref(false)

// Nav
const activeView = ref('basic')
const activeStreamType = ref('live')

// Editor durumu URL'de: ?view=...&type=... (hash query) geri yukle
const VALID_VIEWS = ['basic', 'sort', 'epg', 'category', 'update']
const VALID_TYPES = ['live', 'vod', 'series']
if (VALID_TYPES.includes(route.query.type)) activeStreamType.value = route.query.type
if (VALID_VIEWS.includes(route.query.view)) activeView.value = route.query.view
const streamTypeCounts = ref({ live: 0, vod: 0, series: 0 })
const mobileNavOpen = ref(false)
const mobileCategoriesOpen = ref(false)

// Accordion
const openAccordions = ref(new Set())
const accChannels = reactive({})

// Sort
let sortDragIdx = null
const sortSelectedCat = ref(null)
const sortCatChannels = ref([])
const sortCatTotal = ref(0)
const sortCatLoading = ref(false)
let sortChanDragIdx = null
const SORT_RENDER_LIMIT = 100
const SORT_FETCH_LIMIT = 500
const sortRenderCount = ref(SORT_RENDER_LIMIT)
const sortVisibleChannels = computed(() => sortCatChannels.value.slice(0, sortRenderCount.value))

// Category editor
const showCatCreate = ref(false)
const newCatName = ref('')
const editingCat = ref(null)
const editCatName = ref('')
const deletingCat = ref(null)
const inlineEditCatId = ref(null)
const inlineEditName = ref('')

// Xtream
const showXtreamModal = ref(false)
const savedXtream = ref(null) // { serverUrl, username, lastSynced }
const savedXtreamTypes = ref(['live'])
const playlistShared = ref(false)
// Otomatik guncelleme ayarlari (sync_interval_minutes / backup_before_sync)
const autoSyncInterval = ref(null)
const autoSyncBackup = ref(false)
const autoSyncSaving = ref(false)

function applyAutoSyncSettings(pl) {
  if (!pl) return
  autoSyncInterval.value = pl.sync_interval_minutes ?? null
  autoSyncBackup.value = !!pl.backup_before_sync
}

async function saveAutoSync() {
  if (autoSyncSaving.value) return
  autoSyncSaving.value = true
  try {
    const { data } = await api.put(`/playlists/${playlistId}/sync-settings`, {
      syncIntervalMinutes: autoSyncInterval.value,
      backupBeforeSync: autoSyncBackup.value
    })
    autoSyncInterval.value = data.sync_interval_minutes ?? null
    autoSyncBackup.value = !!data.backup_before_sync
    toast(t('autoSync.saved'), 'success')
  } catch (e) {
    toast(e.response?.data?.error?.message || t('toast.updateError'), 'error')
  } finally {
    autoSyncSaving.value = false
  }
}
const syncing = ref(false)
const addingTypes = ref(false)
const addTypesResult = ref(null)
// Guncelleme oncesi kategori secimi
const syncPreviewLoading = ref(false)
const syncPreview = ref(null)
const syncSelection = reactive({ live: new Set(), series: new Set(), vod: new Set() })
const syncSearches = reactive({ live: '', series: '', vod: '' })
const syncResult = ref(null)

// Filtre kurallari
const filterRules = ref([])
const newRule = reactive({ field: 'group', pattern: '', exclude: true })
const ruleSaving = ref(false)
const ruleTesting = ref(false)
const ruleTestResult = ref(null)

// Ek kaynaklar (coklu kaynak)
const extraSources = ref([])
const newSource = reactive({ label: '', serverUrl: '', username: '', password: '' })
const sourceSaving = ref(false)
const syncingAll = ref(false)
const syncAllResult = ref(null)

// EPG
const epgSources = ref([])
const newEpgUrl = ref('')
const addingEpg = ref(false)
const autoMatching = ref(false)
const matchResult = ref(null)
// EPG Match Profiles
const epgProfiles = ref([])
const savingProfile = ref(false)
const runningProfileId = ref(null)
const newProfile = ref({ name: '', stripPrefixes: '', stripSuffixes: '', ignoreWords: '' })
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
const guidePage = ref(1)
const guideTotal = ref(0)
const guideLoadingMore = ref(false)
const GUIDE_PAGE_SIZE = 100
const hourWidth = 240
const guideTrackWidth = 24 * hourWidth
const epgGridRef = ref(null)
const epgTimeHeaderRef = ref(null)
const epgChannelColRef = ref(null)
const epgGridBodyRef = ref(null)
const selectedProgram = ref(null)
const selectedProgramChannel = ref(null)
const nowOffset = ref(0)
const nowMs = ref(Date.now())

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
const showAddChannel = ref(false)
const showBulkRename = ref(false)
const showBulkUpdate = ref(false)
const showShare = ref(false)
const showXtreamOutput = ref(false)

// ConfirmModal (native confirm yerine)
const confirmState = ref(null) // { title, message, onConfirm }
const confirmLoading = ref(false)

function askConfirm(title, message, onConfirm) {
  confirmState.value = { title, message, onConfirm }
}

async function handleConfirm() {
  if (confirmLoading.value || !confirmState.value) return
  confirmLoading.value = true
  try { await confirmState.value.onConfirm() } finally {
    confirmLoading.value = false
    confirmState.value = null
  }
}
// Gorunum sablonlari (P2-8)
const showViewProfiles = ref(false)
function onViewProfileApplied() { loadCategories() }

let searchTimer = null

const allSelected = computed(() => channels.value.length > 0 && channels.value.every(ch => selectedIds.value.has(ch.id)))
const selectedChannelIds = computed(() => [...selectedIds.value])

const filterOptions = computed(() => [
  { value: '', label: t('advFilter.all') },
  { value: 'missing_logo', label: t('advFilter.missingLogo') },
  { value: 'missing_epg', label: t('advFilter.missingEpg') },
  { value: 'duplicate_name', label: t('advFilter.duplicateName') },
  { value: 'dead', label: t('advFilter.dead') },
  { value: 'unchecked', label: t('advFilter.unchecked') },
])
const activeFilterLabel = computed(() => filterOptions.value.find(o => o.value === activeFilter.value)?.label || '')
const isResultFiltered = computed(() => !!(search.value || activeFilter.value))

const streamTypeLabel = computed(() => {
  switch (activeStreamType.value) {
    case 'vod': return { all: t('editor.allMovies'), unit: t('common.movie'), search: t('editor.searchMovies') }
    case 'series': return { all: t('editor.allSeries'), unit: t('common.serie'), search: t('editor.searchSeries') }
    default: return { all: t('editor.allChannels'), unit: t('common.channel'), search: t('editor.searchPlaceholder') }
  }
})

const emptySmartTitle = computed(() => {
  switch (activeStreamType.value) {
    case 'vod': return t('addTypes.noMoviesYet')
    case 'series': return t('addTypes.noSeriesYet')
    default: return t('addTypes.noChannelsYet')
  }
})

const showM3uImportInEditor = ref(false)

function toggleStreamSection(type) {
  if (activeStreamType.value === type) { mobileNavOpen.value = false; return }
  activeStreamType.value = type
  activeView.value = 'basic'
  selectedCatId.value = null
  editingChannel.value = null
  page.value = 1
  search.value = ''
  selectedIds.value = new Set()
  loadChannels()
  loadTotalCount()
  loadCategories()
  mobileNavOpen.value = false
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

// URL durumunu hash query'sine yaz (?view=...&type=...)
watch([activeView, activeStreamType], ([v, st]) => {
  const query = {}
  if (v !== 'basic') query.view = v
  if (st !== 'live') query.type = st
  router.replace({ query }).catch(() => {})
})

// Klavye kisayollari: '/' aramaya odaklanir, 'g' + e/s/k/g gorunum degistirir
let goPrefixPending = false
let goPrefixTimer = null

function isTypingTarget(el) {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

function onGlobalKeydown(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (isTypingTarget(e.target)) { goPrefixPending = false; return }
  if (e.key === '/') {
    e.preventDefault()
    document.querySelector('.search-input')?.focus()
    return
  }
  const key = e.key.toLowerCase()
  if (goPrefixPending) {
    goPrefixPending = false
    clearTimeout(goPrefixTimer)
    const view = { e: 'epg', s: 'sort', k: 'category', g: 'update' }[key]
    if (view) {
      e.preventDefault()
      activeView.value = view
    }
    return
  }
  if (key === 'g') {
    goPrefixPending = true
    clearTimeout(goPrefixTimer)
    goPrefixTimer = setTimeout(() => { goPrefixPending = false }, 1000)
  }
}

// Asistan veri degistirdiginde acik ekran kendini tazeler; kullanici F5'e
// basmak zorunda kalmasin.
async function refreshAfterAiChange() {
  try {
    const { data } = await api.get(`/playlists/${playlistId}/categories`, { params: { streamType: activeStreamType.value } })
    categories.value = data
  } catch { /* kategori tazeleme kritik degil */ }
  await Promise.all([loadChannels(), loadTotalCount(), loadStreamTypeCounts()])
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)
  window.addEventListener('ai:data-changed', refreshAfterAiChange)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('ai:data-changed', refreshAfterAiChange)
  clearTimeout(goPrefixTimer)
})

onMounted(async () => {
  try {
    const [plRes, catRes] = await Promise.all([
      api.get('/playlists'),
      api.get(`/playlists/${playlistId}/categories`, { params: { streamType: activeStreamType.value } })
    ])
    const pl = plRes.data.find(p => String(p.id) === String(playlistId))
    playlistName.value = pl?.name || 'Playlist'
    playlistShared.value = Boolean(pl?.is_shared)
    applyAutoSyncSettings(pl)
    if (pl?.xtream_server_url) {
      savedXtream.value = { serverUrl: pl.xtream_server_url, username: pl.xtream_username, lastSynced: pl.last_synced_at }
      savedXtreamTypes.value = pl.xtream_stream_types ? JSON.parse(pl.xtream_stream_types) : ['live']
    }
    categories.value = catRes.data
    await Promise.all([loadChannels(), loadTotalCount(), loadStreamTypeCounts(), loadFilterRules(), loadSources()])
  } catch { toast(t('toast.loadError'), 'error') }
  finally { pageLoading.value = false }
})

// Load EPG sources and guide when switching to epg view
watch(activeView, v => {
  mobileNavOpen.value = false
  mobileCategoriesOpen.value = false
  if (v === 'epg') { loadEpgSources(); loadGuide(); loadEpgProfiles() }
})

// Load the source library lazily when the sources tab is opened
watch(epgTab, v => { if (v === 'sources' && activeView.value === 'epg') loadEpgLibrary() })

// Load EPG data when editing channel changes
watch(editingChannel, ch => { if (ch) loadEditChannelEpg() })

// Sayfa/tur/arama degistiginde onceki istek hala ucabilir. Yalnizca en son
// istegin yaniti duruma yazilir; gecikmis yanit guncel gorunumu ezmez.
let channelsRequestId = 0

async function loadChannels() {
  const requestId = ++channelsRequestId
  channelsLoading.value = true
  try {
    const params = { page: page.value, limit: 50, streamType: activeStreamType.value }
    if (search.value) params.search = search.value
    if (activeFilter.value) params.filter = activeFilter.value
    if (selectedCatId.value) params.categoryId = selectedCatId.value
    const { data } = await api.get(`/playlists/${playlistId}/channels`, { params })
    if (requestId !== channelsRequestId) return
    channels.value = data.channels || data
    totalPages.value = data.totalPages || 1
    tableTotal.value = data.total || channels.value.length
    if (!selectedCatId.value && !search.value && !activeFilter.value) totalChannelCount.value = data.total || channels.value.length
  } catch {
    if (requestId === channelsRequestId) toast(t('toast.channelsLoadError'), 'error')
  }
  finally { if (requestId === channelsRequestId) channelsLoading.value = false }
}

async function loadTotalCount() {
  try {
    const { data } = await api.get(`/playlists/${playlistId}/channels`, { params: { limit: 1, streamType: activeStreamType.value } })
    totalChannelCount.value = data.total || 0
  } catch {}
}

async function loadCategories() {
  try { const { data } = await api.get(`/playlists/${playlistId}/categories`, { params: { streamType: activeStreamType.value } }); categories.value = data } catch {}
}

async function loadAccChannels(catId) {
  try {
    const { data } = await api.get(`/playlists/${playlistId}/channels`, { params: { categoryId: catId, limit: 500 } })
    accChannels[catId] = data.channels || data
  } catch { accChannels[catId] = [] }
}

function selectCategory(id) {
  selectedCatId.value = id; page.value = 1; selectedIds.value = new Set(); editingChannel.value = null; mobileCategoriesOpen.value = false; loadChannels()
}

// Secim yalnizca goruntulenen sorgu baglamina aittir. Sayfa/tur/arama
// degistiginde temizlenmezse gorunmeyen kanallar toplu islemlere dahil olur.
function clearSelection() { selectedIds.value = new Set() }

function goToPage(target) {
  const next = Math.max(1, Math.min(target, totalPages.value))
  if (next === page.value) return
  page.value = next
  clearSelection()
  loadChannels()
}

function debouncedSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; clearSelection(); loadChannels() }, 300)
}
function onFilterChange() {
  page.value = 1; clearSelection(); loadChannels()
}
function clearAdvFilter() {
  if (!activeFilter.value) return
  activeFilter.value = ''; onFilterChange()
}
function toggleSelect(id) { const s = new Set(selectedIds.value); if (s.has(id)) s.delete(id); else s.add(id); selectedIds.value = s }
function toggleSelectAll() { if (allSelected.value) selectedIds.value = new Set(); else selectedIds.value = new Set(channels.value.map(ch => ch.id)) }
function shortenUrl(url) { if (!url) return '-'; try { return url.length > 60 ? '...' + url.slice(-50) : url } catch { return url } }

function startEditChannel(ch) {
  editingChannel.value = ch
  editForm.value = { name: ch.name, logo_url: ch.logo_url || '', epg_channel_id: ch.epg_channel_id || '', epg_source_id: ch.epg_source_id || null, category_id: ch.category_id || null, stream_url: ch.stream_url || '' }
  epgAcResults.value = []
  epgAcOpen.value = false
  epgIdAcResults.value = []
  epgIdAcOpen.value = false
  epgSelectedIcon.value = null
}

async function saveChannel() {
  try {
    const { epg_channel_id, epg_source_id, ...channelUpdates } = editForm.value
    const requests = [api.put(`/channels/${editingChannel.value.id}`, channelUpdates)]
    if (activeStreamType.value === 'live') {
      requests.push(api.put(`/channels/${editingChannel.value.id}/epg`, { epgChannelId: epg_channel_id || null, epgSourceId: epg_source_id || null }))
    }
    await Promise.all(requests)
    toast(t('toast.channelUpdated'), 'success'); editingChannel.value = null
    loadChannels(); loadCategories(); loadTotalCount()
    for (const catId of openAccordions.value) loadAccChannels(catId)
  } catch (e) { toast(e.response?.data?.error?.message || t('common.error'), 'error') }
}

function deleteChannel(ch) {
  askConfirm(t('common.delete'), `"${ch.name}" ${t('toast.deleteChannelConfirm', { count: 1 })}`, () => performDeleteChannel(ch))
}

async function performDeleteChannel(ch) {
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
    editForm.value = { name: data.name, logo_url: data.logo_url || '', epg_channel_id: data.epg_channel_id || '', epg_source_id: data.epg_source_id || null, category_id: data.category_id || null, stream_url: data.stream_url || '' }
    editingChannel.value = data
    toast(t('toast.resetToOriginal'), 'success')
    loadChannels()
  } catch (e) { toast(e.response?.data?.error?.message || t('toast.resetError'), 'error') }
}

function triggerLogoUpload() {
  logoFileInput.value?.click()
}

/**
 * Kanal düzenleme paneli açıkken alt kısmında Kaydet/Sıfırla/Sil çubuğu durur
 * ve bu, ekranın sağ alt köşesinde sabit duran asistan düğmesiyle çakışır.
 * Çubuk göründüğü sürece düğme onun üstüne alınır; panel kapanınca eski
 * yerine döner. (Çubuk 10px dolgu + ~34px düğme + kenarlık ≈ 56px.)
 */
const FAB_CLEARANCE = '78px'

function syncAssistantOffset(panelOpen) {
  const root = document.documentElement
  if (panelOpen) root.style.setProperty('--ai-fab-bottom', FAB_CLEARANCE)
  else root.style.removeProperty('--ai-fab-bottom')
}

watch(editingChannel, (channel) => syncAssistantOffset(Boolean(channel)))
onUnmounted(() => syncAssistantOffset(false))

function openLogoLibrary() {
  showLogoLibrary.value = true
}

/**
 * Kutuphaneden secilen logo dogrudan kanala yazilir. Gorsel sunucuya
 * kopyalanmaz; CDN adresi kaydedilir — ice aktarilan listelerdeki dis logo
 * adresleriyle ayni davranis.
 */
async function applyLibraryLogo(logo) {
  showLogoLibrary.value = false
  if (!editingChannel.value) return
  const previous = editForm.value.logo_url
  editForm.value.logo_url = logo.url
  try {
    const { data } = await api.put(`/channels/${editingChannel.value.id}`, { logo_url: logo.url })
    editingChannel.value = { ...editingChannel.value, logo_url: data.logo_url || logo.url }
    const row = channels.value.find((ch) => ch.id === editingChannel.value.id)
    if (row) row.logo_url = data.logo_url || logo.url
    toast(t('logoLibrary.applied', { name: logo.name }), 'success')
  } catch (error) {
    editForm.value.logo_url = previous
    toast(error.response?.data?.error?.message || t('logoLibrary.applyFailed'), 'error')
  }
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

function bulkDelete() {
  askConfirm(t('common.delete'), t('toast.deleteChannelConfirm', { count: selectedIds.value.size }), performBulkDelete)
}

async function performBulkDelete() {
  try {
    await api.post('/channels/bulk', { action: 'delete', channelIds: [...selectedIds.value] })
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

function refreshFeatureData({ clearSelected = false } = {}) {
  if (clearSelected) selectedIds.value = new Set()
  for (const catId of Object.keys(accChannels)) delete accChannels[catId]
  loadChannels()
  loadCategories()
  loadTotalCount()
  loadStreamTypeCounts()
  for (const catId of openAccordions.value) loadAccChannels(catId)
}

function handleChannelCreated() {
  refreshFeatureData()
}

function handleBulkApplied() {
  refreshFeatureData({ clearSelected: true })
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
async function toggleCatHidden(cat) {
  try {
    const { data } = await api.put(`/categories/${cat.id}`, { is_hidden: !cat.is_hidden })
    categories.value = categories.value.map(item => item.id === cat.id ? { ...item, ...data } : item)
  } catch (e) { toast(e.response?.data?.error?.message || t('common.error'), 'error') }
}
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
  if (sortDragIdx === null || sortDragIdx === idx) { sortDragIdx = null; return }
  const previousOrder = [...categories.value]
  const moved = categories.value.splice(sortDragIdx, 1)[0]
  categories.value.splice(idx, 0, moved)
  const movedIndex = categories.value.findIndex(cat => cat.id === moved.id)
  const payload = movedIndex === 0
    ? { beforeCategoryId: categories.value[1]?.id }
    : { afterCategoryId: categories.value[movedIndex - 1]?.id }
  sortDragIdx = null

  try { await api.put(`/categories/${moved.id}/order`, payload) }
  catch {
    categories.value = previousOrder
    toast(t('toast.sortingError'), 'error')
  }
}

async function moveSortCat(idx, dir) {
  const target = idx + dir
  if (target < 0 || target >= categories.value.length) return
  const previousOrder = [...categories.value]
  const moved = categories.value.splice(idx, 1)[0]
  categories.value.splice(target, 0, moved)
  const movedIndex = categories.value.findIndex(cat => cat.id === moved.id)
  const payload = movedIndex === 0
    ? { beforeCategoryId: categories.value[1]?.id }
    : { afterCategoryId: categories.value[movedIndex - 1]?.id }

  try { await api.put(`/categories/${moved.id}/order`, payload) }
  catch {
    categories.value = previousOrder
    toast(t('toast.sortingError'), 'error')
  }
}

async function selectSortCat(cat) {
  sortSelectedCat.value = cat
  sortCatLoading.value = true
  sortCatChannels.value = []
  sortCatTotal.value = 0
  sortRenderCount.value = SORT_RENDER_LIMIT
  try {
    const { data } = await api.get(`/playlists/${playlistId}/channels`, { params: { categoryId: cat.id, limit: SORT_FETCH_LIMIT } })
    sortCatChannels.value = data.channels || data
    sortCatTotal.value = data.total ?? sortCatChannels.value.length
  } catch { toast(t('toast.channelsLoadError'), 'error') }
  finally { sortCatLoading.value = false }
}

async function chanDrop(idx) {
  if (sortChanDragIdx === null || sortChanDragIdx === idx) { sortChanDragIdx = null; return }
  const previousOrder = [...sortCatChannels.value]
  const moved = sortCatChannels.value.splice(sortChanDragIdx, 1)[0]
  sortCatChannels.value.splice(idx, 0, moved)
  const movedIndex = sortCatChannels.value.findIndex(ch => ch.id === moved.id)
  const payload = movedIndex === 0
    ? { beforeChannelId: sortCatChannels.value[1]?.id }
    : { afterChannelId: sortCatChannels.value[movedIndex - 1]?.id }
  sortChanDragIdx = null

  try { await api.put(`/channels/${moved.id}/order`, payload) }
  catch {
    sortCatChannels.value = previousOrder
    toast(t('toast.sortingError'), 'error')
  }
}

async function moveSortChan(idx, dir) {
  const target = idx + dir
  if (target < 0 || target >= sortCatChannels.value.length) return
  const previousOrder = [...sortCatChannels.value]
  const moved = sortCatChannels.value.splice(idx, 1)[0]
  sortCatChannels.value.splice(target, 0, moved)
  const movedIndex = sortCatChannels.value.findIndex(ch => ch.id === moved.id)
  const payload = movedIndex === 0
    ? { beforeChannelId: sortCatChannels.value[1]?.id }
    : { afterChannelId: sortCatChannels.value[movedIndex - 1]?.id }

  try { await api.put(`/channels/${moved.id}/order`, payload) }
  catch {
    sortCatChannels.value = previousOrder
    toast(t('toast.sortingError'), 'error')
  }
}

function openXtream() { showXtreamModal.value = true }

// Xtream hesap duzenleme (kayitli kimlik bilgileri)
const accountEditOpen = ref(false)
const accountEditSaving = ref(false)
const accountEditForm = ref({ serverUrl: '', username: '', password: '' })

function toggleAccountEdit() {
  accountEditOpen.value = !accountEditOpen.value
  if (accountEditOpen.value) {
    accountEditForm.value = {
      serverUrl: savedXtream.value?.serverUrl || '',
      username: savedXtream.value?.username || '',
      password: ''
    }
  }
}

async function saveAccountEdit() {
  if (accountEditSaving.value) return
  accountEditSaving.value = true
  try {
    const payload = {
      xtreamServerUrl: accountEditForm.value.serverUrl.trim(),
      xtreamUsername: accountEditForm.value.username.trim()
    }
    if (accountEditForm.value.password) payload.xtreamPassword = accountEditForm.value.password
    await api.put(`/playlists/${playlistId}`, payload)
    savedXtream.value = { ...savedXtream.value, serverUrl: payload.xtreamServerUrl, username: payload.xtreamUsername }
    accountEditOpen.value = false
    toast(t('xtream.accountUpdated'), 'success')
  } catch (e) {
    toast(e.response?.data?.error?.message || t('common.error'), 'error')
  } finally {
    accountEditSaving.value = false
  }
}
async function handleXtreamImported(data) {
  toast(t('toast.importSuccess', {
    channels: data.totalChannels ?? 0,
    categories: data.totalCategories ?? 0,
    duration: ((Number(data.duration) || 0) / 1000).toFixed(1)
  }), 'success')
  try {
    const plRes = await api.get('/playlists')
    const pl = plRes.data.find(p => String(p.id) === String(playlistId))
    playlistShared.value = Boolean(pl?.is_shared)
    applyAutoSyncSettings(pl)
    if (pl?.xtream_server_url) {
      savedXtream.value = { serverUrl: pl.xtream_server_url, username: pl.xtream_username, lastSynced: pl.last_synced_at }
      savedXtreamTypes.value = pl.xtream_stream_types ? JSON.parse(pl.xtream_stream_types) : ['live']
    }
  } catch {
    toast(t('toast.playlistsLoadError'), 'error')
  }
  loadCategories(); loadChannels(); loadTotalCount(); loadStreamTypeCounts()
  for (const catId of openAccordions.value) loadAccChannels(catId)
}
async function startSyncPreview() {
  if (syncPreviewLoading.value || syncing.value) return
  syncPreviewLoading.value = true
  syncResult.value = null
  try {
    const { data } = await api.get(`/playlists/${playlistId}/sync/preview`)
    syncPreview.value = data
    for (const type of ['live', 'series', 'vod']) {
      const cats = data.types?.[type]?.categories || []
      syncSelection[type] = new Set(cats.filter((c) => c.selected).map((c) => c.id))
      syncSearches[type] = ''
    }
  } catch (e) {
    toast(e.response?.data?.error?.message || t('toast.updateError'), 'error')
  } finally {
    syncPreviewLoading.value = false
  }
}

function cancelSyncSelection() {
  if (syncing.value) return
  syncPreview.value = null
}

function syncFilteredCategories(type) {
  const cats = syncPreview.value?.types?.[type]?.categories || []
  const q = syncSearches[type].trim().toLocaleLowerCase()
  if (!q) return cats
  return cats.filter((c) => (c.name || '').toLocaleLowerCase().includes(q))
}

function syncSetCategory(type, id, checked) {
  if (checked) syncSelection[type].add(id)
  else syncSelection[type].delete(id)
}

function syncSelectVisible(type) {
  for (const cat of syncFilteredCategories(type)) syncSelection[type].add(cat.id)
}

function syncDeselectAll(type) {
  syncSelection[type].clear()
}

const syncAvailableTypes = computed(() => savedXtreamTypes.value.filter((type) => syncPreview.value?.types?.[type]?.available))

const syncCanRun = computed(() => {
  if (!syncPreview.value) return false
  // Tip basina zorunluluk yok: tek tip bile secilebilir, bos birakilan tipler korunur.
  return syncAvailableTypes.value.reduce((sum, type) => sum + syncSelection[type].size, 0) > 0
})

async function doSync() {
  if (syncing.value) return
  syncing.value = true
  syncResult.value = null
  try {
    const payload = {}
    if (syncPreview.value) {
      const categories = {}
      for (const type of syncAvailableTypes.value) categories[type] = [...syncSelection[type]]
      payload.categories = categories
    }
    const { data } = await api.post(`/playlists/${playlistId}/sync`, payload)
    syncResult.value = data
    syncPreview.value = null
    toast(t('toast.syncResult', { added: data.added, updated: data.updated, removed: data.removed }), 'success')
    const plRes = await api.get('/playlists')
    const pl = plRes.data.find(p => String(p.id) === String(playlistId))
    if (pl?.last_synced_at) savedXtream.value = { ...savedXtream.value, lastSynced: pl.last_synced_at }
    loadCategories(); loadChannels(); loadTotalCount(); loadStreamTypeCounts()
  } catch (e) { toast(e.response?.data?.error?.message || t('toast.updateError'), 'error') }
  finally { syncing.value = false }
}

// ---- Filtre kurallari ----
async function loadFilterRules() {
  try {
    const { data } = await api.get(`/playlists/${playlistId}/filter-rules`)
    filterRules.value = data
  } catch { filterRules.value = [] }
}

async function addFilterRule() {
  if (!newRule.pattern.trim() || ruleSaving.value) return
  ruleSaving.value = true
  ruleTestResult.value = null
  try {
    await api.post(`/playlists/${playlistId}/filter-rules`, {
      field: newRule.field,
      pattern: newRule.pattern.trim(),
      exclude: newRule.exclude,
    })
    newRule.pattern = ''
    toast(t('filterRules.added'), 'success')
    await loadFilterRules()
  } catch (e) { toast(e.response?.data?.error?.message || t('common.error'), 'error') }
  finally { ruleSaving.value = false }
}

async function deleteFilterRule(rule) {
  try {
    await api.delete(`/filter-rules/${rule.id}`)
    toast(t('filterRules.deleted'), 'success')
    await loadFilterRules()
  } catch (e) { toast(e.response?.data?.error?.message || t('common.error'), 'error') }
}

async function toggleFilterRule(rule) {
  try {
    await api.put(`/filter-rules/${rule.id}`, { enabled: !rule.enabled })
    await loadFilterRules()
  } catch (e) { toast(e.response?.data?.error?.message || t('common.error'), 'error') }
}

async function moveFilterRule(rule, direction) {
  try {
    await api.put(`/filter-rules/${rule.id}/order`, { direction })
    await loadFilterRules()
  } catch (e) { toast(e.response?.data?.error?.message || t('common.error'), 'error') }
}

async function testFilterRule() {
  if (!newRule.pattern.trim() || ruleTesting.value) return
  ruleTesting.value = true
  try {
    const { data } = await api.post(`/playlists/${playlistId}/filter-rules/test`, {
      field: newRule.field,
      pattern: newRule.pattern.trim(),
    })
    ruleTestResult.value = data
  } catch (e) {
    ruleTestResult.value = null
    toast(e.response?.data?.error?.message || t('common.error'), 'error')
  } finally { ruleTesting.value = false }
}

// ---- Ek kaynaklar (coklu kaynak) ----
async function loadSources() {
  try {
    const { data } = await api.get(`/playlists/${playlistId}/sources`)
    extraSources.value = data
  } catch { extraSources.value = [] }
}

async function addSource() {
  if (sourceSaving.value) return
  sourceSaving.value = true
  try {
    await api.post(`/playlists/${playlistId}/sources`, {
      label: newSource.label.trim() || undefined,
      serverUrl: newSource.serverUrl.trim(),
      username: newSource.username.trim(),
      password: newSource.password,
    })
    newSource.label = ''; newSource.serverUrl = ''; newSource.username = ''; newSource.password = ''
    toast(t('multiSource.added'), 'success')
    await loadSources()
  } catch (e) { toast(e.response?.data?.error?.message || t('common.error'), 'error') }
  finally { sourceSaving.value = false }
}

async function deleteSource(source) {
  try {
    await api.delete(`/sources/${source.id}`)
    toast(t('multiSource.deleted'), 'success')
    await loadSources()
  } catch (e) { toast(e.response?.data?.error?.message || t('common.error'), 'error') }
}

async function syncAllSources() {
  if (syncingAll.value || syncing.value) return
  syncingAll.value = true
  syncAllResult.value = null
  try {
    const { data } = await api.post(`/playlists/${playlistId}/sync-all`)
    syncAllResult.value = data
    toast(t('multiSource.syncResult', { added: data.added, updated: data.updated, removed: data.removed }), data.failedSources ? 'error' : 'success')
    const plRes = await api.get('/playlists')
    const pl = plRes.data.find(p => String(p.id) === String(playlistId))
    if (pl?.last_synced_at) savedXtream.value = { ...savedXtream.value, lastSynced: pl.last_synced_at }
    loadCategories(); loadChannels(); loadTotalCount(); loadStreamTypeCounts()
  } catch (e) { toast(e.response?.data?.error?.message || t('toast.updateError'), 'error') }
  finally { syncingAll.value = false }
}

async function doAddTypes(types) {
  addingTypes.value = true
  addTypesResult.value = null
  try {
    const { data } = await api.post(`/playlists/${playlistId}/import/add-types`, { streamTypes: types })
    addTypesResult.value = data
    savedXtreamTypes.value = data.allTypes
    toast(t('addTypes.result', { added: data.added, types: data.addedTypes.join(', '), duration: (data.duration / 1000).toFixed(1) }), 'success')
    loadCategories(); loadChannels(); loadTotalCount(); loadStreamTypeCounts()
  } catch (e) {
    toast(e.response?.data?.error?.message || t('toast.updateError'), 'error')
  } finally { addingTypes.value = false }
}

// M3U Import in Editor
const editorM3uForm = ref({ url: '', content: '' })
const editorM3uImporting = ref(false)
const editorM3uResult = ref(null)
const editorM3uError = ref('')

function onEditorM3uFile(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => { editorM3uForm.value.content = reader.result }
  reader.readAsText(file)
}

async function doEditorM3uImport() {
  editorM3uImporting.value = true; editorM3uResult.value = null; editorM3uError.value = ''
  try {
    const payload = {}
    if (editorM3uForm.value.content) payload.m3uContent = editorM3uForm.value.content
    else payload.m3uUrl = editorM3uForm.value.url
    const { data } = await api.post(`/playlists/${playlistId}/import/m3u`, payload)
    editorM3uResult.value = data
    toast(t('toast.importSuccess', { channels: data.totalChannels, categories: data.totalCategories, duration: (data.duration / 1000).toFixed(1) }), 'success')
    loadCategories(); loadChannels(); loadTotalCount(); loadStreamTypeCounts()
    setTimeout(() => { showM3uImportInEditor.value = false }, 2000)
  } catch (e) {
    editorM3uError.value = e.response?.data?.error?.message || t('toast.genericError')
  } finally { editorM3uImporting.value = false }
}

async function loadEpgSources() { try { const { data } = await api.get('/epg/sources'); epgSources.value = data } catch {} }
async function saveEpgRefreshInterval(s, raw) {
  const minutes = raw === '' ? null : Number(raw)
  if (s._savingInterval) return
  s._savingInterval = true
  try {
    await api.put(`/epg/sources/${s.id}/refresh-settings`, { refreshIntervalMinutes: minutes })
    s.refresh_interval_minutes = minutes
    toast(t('autoSync.saved'), 'success')
  } catch (e) {
    toast(e.response?.data?.error?.message || t('toast.updateError'), 'error')
    loadEpgSources()
  } finally {
    s._savingInterval = false
  }
}
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
function deleteEpgSource(source) {
  askConfirm(t('common.delete'), t('toast.categoryDeleteConfirm'), () => performDeleteEpgSource(source))
}

async function performDeleteEpgSource(source) {
  try { await api.delete(`/epg/sources/${source.id}`); toast(t('toast.epgSourceDeleted'), 'success'); loadEpgSources(); loadGuide() }
  catch (e) { toast(e.response?.data?.error?.message || t('toast.deletionError'), 'error') }
}
function parseWordList(text) {
  return String(text || '').split(',').map(w => w.trim()).filter(Boolean)
}
function profileSettingsSummary(profile) {
  const s = profile.settings || {}
  const parts = []
  if (s.stripPrefixes?.length) parts.push(`− ${s.stripPrefixes.join(', ')}`)
  if (s.stripSuffixes?.length) parts.push(`${s.stripSuffixes.join(', ')} −`)
  if (s.ignoreWords?.length) parts.push(`⊘ ${s.ignoreWords.join(', ')}`)
  return parts.join('  ·  ')
}
async function loadEpgProfiles() {
  try { const { data } = await api.get(`/playlists/${playlistId}/epg-profiles`); epgProfiles.value = data } catch {}
}
async function createEpgProfile() {
  const name = newProfile.value.name.trim()
  if (!name) { toast(t('epgProfiles.nameRequired'), 'error'); return }
  savingProfile.value = true
  try {
    await api.post(`/playlists/${playlistId}/epg-profiles`, {
      name,
      settings: {
        stripPrefixes: parseWordList(newProfile.value.stripPrefixes),
        stripSuffixes: parseWordList(newProfile.value.stripSuffixes),
        ignoreWords: parseWordList(newProfile.value.ignoreWords),
      },
    })
    toast(t('epgProfiles.saved'), 'success')
    newProfile.value = { name: '', stripPrefixes: '', stripSuffixes: '', ignoreWords: '' }
    loadEpgProfiles()
  } catch (e) { toast(e.response?.data?.error?.message || t('epgProfiles.error'), 'error') }
  finally { savingProfile.value = false }
}
async function runEpgProfile(profile) {
  runningProfileId.value = profile.id
  try {
    const { data } = await api.post(`/epg-profiles/${profile.id}/run`)
    matchResult.value = data.result
    toast(t('epgProfiles.runDone', { matched: data.result.matched, total: data.result.total }), 'success')
    loadEpgProfiles(); loadGuide(); loadChannels()
  } catch (e) { toast(e.response?.data?.error?.message || t('epgProfiles.error'), 'error') }
  finally { runningProfileId.value = null }
}
function deleteEpgProfile(profile) {
  askConfirm(t('common.delete'), t('epgProfiles.deleteConfirm'), () => performDeleteEpgProfile(profile))
}

async function performDeleteEpgProfile(profile) {
  try { await api.delete(`/epg-profiles/${profile.id}`); toast(t('epgProfiles.deleted'), 'success'); loadEpgProfiles() }
  catch (e) { toast(e.response?.data?.error?.message || t('epgProfiles.error'), 'error') }
}
// EPG Source Library (iptv-org)
const libCountries = ref([])
const libGuides = ref([])
const libCountry = ref('')
const libQuery = ref('')
const libLoading = ref(false)
const libError = ref(false)
const libAdding = ref(null)
let libCountriesLoaded = false
let libQueryTimer = null

async function searchLibrary() {
  libLoading.value = true; libError.value = false
  try {
    const params = {}
    if (libCountry.value) params.country = libCountry.value
    if (libQuery.value.trim()) params.q = libQuery.value.trim()
    const { data } = await api.get('/epg-library/guides', { params })
    libGuides.value = data
  } catch { libError.value = true }
  finally { libLoading.value = false }
}
async function loadEpgLibrary() {
  if (!libCountriesLoaded) {
    libCountriesLoaded = true
    try { const { data } = await api.get('/epg-library/countries'); libCountries.value = data } catch {}
    searchLibrary()
  }
}
watch(libCountry, () => { if (libCountriesLoaded) searchLibrary() })
watch(libQuery, () => {
  clearTimeout(libQueryTimer)
  libQueryTimer = setTimeout(() => { if (libCountriesLoaded) searchLibrary() }, 300)
})
async function addFromLibrary(g) {
  if (!g.url || libAdding.value) return
  libAdding.value = g.site
  try { const { data } = await api.post('/epg/sources', { url: g.url }); toast(t('toast.epgAdded', { channels: data.channelCount, programs: data.programCount }), 'success'); loadEpgSources(); loadGuide() }
  catch (e) { toast(e.response?.data?.error?.message || t('toast.epgError'), 'error') }
  finally { libAdding.value = null }
}

async function doAutoMatch() {
  autoMatching.value = true
  try { const { data } = await api.post(`/playlists/${playlistId}/epg/auto-match`); matchResult.value = data; toast(t('toast.channelsMatched', { count: `${data.matched}/${data.total}` }), 'success'); loadGuide(); loadChannels() }
  catch { toast(t('toast.matchingError'), 'error') }
  finally { autoMatching.value = false }
}
async function loadGuide() {
  guideLoading.value = true
  guidePage.value = 1
  guideChannels.value = []
  guideTotal.value = 0
  try {
    const { data } = await api.get(`/playlists/${playlistId}/epg/guide`, { params: { date: guideDate.value, tzOffset: new Date().getTimezoneOffset(), page: 1, limit: GUIDE_PAGE_SIZE } })
    guideChannels.value = data.channels || []
    guideTotal.value = data.total || 0
    updateNowOffset()
  } catch { guideChannels.value = []; guideTotal.value = 0 }
  finally { guideLoading.value = false }
}
async function loadMoreGuide() {
  if (guideLoading.value || guideLoadingMore.value) return
  if (guideChannels.value.length >= guideTotal.value) return
  guideLoadingMore.value = true
  try {
    const nextPage = guidePage.value + 1
    const { data } = await api.get(`/playlists/${playlistId}/epg/guide`, { params: { date: guideDate.value, tzOffset: new Date().getTimezoneOffset(), page: nextPage, limit: GUIDE_PAGE_SIZE } })
    if ((data.channels || []).length) {
      guideChannels.value = [...guideChannels.value, ...data.channels]
      guidePage.value = nextPage
    } else {
      guideTotal.value = guideChannels.value.length
    }
  } catch { /* sessiz: bir sonraki scroll'da tekrar dener */ }
  finally { guideLoadingMore.value = false }
}
function changeGuideDate(delta) {
  const d = new Date(guideDate.value + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  guideDate.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  loadGuide()
}
function updateNowOffset() {
  const now = new Date()
  nowMs.value = now.getTime()
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
  return new Date(prog.end_time).getTime() < nowMs.value
}
function onGridScroll() {
  const body = epgGridBodyRef.value
  if (!body) return
  if (epgTimeHeaderRef.value) epgTimeHeaderRef.value.scrollLeft = body.scrollLeft
  if (epgChannelColRef.value) epgChannelColRef.value.scrollTop = body.scrollTop
  // Sona yaklasinca sonraki kanal sayfasini yukle (buyuk playlistlerde tumunu
  // tek seferde basmak tarayiciyi kilitler)
  if (body.scrollTop + body.clientHeight > body.scrollHeight - 400) loadMoreGuide()
}
function showProgramDetail(prog, ch) {
  selectedProgram.value = prog
  selectedProgramChannel.value = ch
  // Guide yanitinda description tasinmiyor (agir); modal acilinca cekilir
  if (prog.description === undefined) {
    api.get(`/epg/programs/${prog.id}`)
      .then(({ data }) => {
        if (selectedProgram.value?.id === prog.id) selectedProgram.value = { ...selectedProgram.value, description: data.description || '' }
      })
      .catch(() => {})
  }
}
async function loadEditChannelEpg() {
  if (!editingChannel.value?.id) { editChannelEpg.value = []; return }
  try { const { data } = await api.get(`/channels/${editingChannel.value.id}/epg/preview`, { params: { tzOffset: new Date().getTimezoneOffset() } }); editChannelEpg.value = data }
  catch { editChannelEpg.value = [] }
}
function isProgramLive(prog) {
  return new Date(prog.start_time).getTime() <= nowMs.value && nowMs.value <= new Date(prog.end_time).getTime()
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

// Akis saglik taramasi: baslat + ilerlemeyi 2sn'de bir yokla.
const healthScan = ref({ running: false, checked: 0, total: 0, dead: 0 })
let _healthTimer = null

async function pollHealthScan() {
  try {
    const { data } = await api.get(`/playlists/${playlistId}/health-scan`)
    healthScan.value = data
    if (!data.running) {
      if (_healthTimer) { clearInterval(_healthTimer); _healthTimer = null }
      toast(t('streamHealth.scanDone', { checked: data.checked, dead: data.dead }), data.dead ? 'info' : 'success')
      loadChannels()
    }
  } catch {
    if (_healthTimer) { clearInterval(_healthTimer); _healthTimer = null }
    healthScan.value = { running: false, checked: 0, total: 0, dead: 0 }
  }
}

async function startHealthScan() {
  if (healthScan.value.running) return
  try {
    const { data } = await api.post(`/playlists/${playlistId}/health-scan`, { streamType: activeStreamType.value })
    healthScan.value = data
    if (!data.running) return
    toast(t('streamHealth.scanStarted', { total: data.total }), 'info')
    if (_healthTimer) clearInterval(_healthTimer)
    _healthTimer = setInterval(pollHealthScan, 2000)
  } catch {
    toast(t('streamHealth.scanError'), 'error')
  }
}

onUnmounted(() => {
  if (_nowTimer) clearInterval(_nowTimer)
  if (_healthTimer) clearInterval(_healthTimer)
})

function doShare() {
  showShare.value = true
}
// EPG Autocomplete functions
function onNameInput() {
  clearTimeout(epgAcTimer)
  if (activeStreamType.value !== 'live') { epgAcResults.value = []; return }
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
  editForm.value.epg_source_id = epgCh.source_id
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
async function fetchXtreamMetadata() {
  if (!editingChannel.value) return
  fetchingMetadata.value = true
  try {
    const force = editingChannel.value.extras?.metadata_fetched ? 'true' : 'false'
    const { data } = await api.post(`/channels/${editingChannel.value.id}/metadata?force=${force}`)
    editingChannel.value = data
    toast(t('toast.metadataFetched'), 'success')
  } catch (e) {
    const msg = e.response?.data?.error?.message || t('toast.metadataError')
    toast(msg, 'error')
  } finally { fetchingMetadata.value = false }
}
// EPG ID field autocomplete
function onEpgIdInput() {
  clearTimeout(epgIdAcTimer)
  editForm.value.epg_source_id = null
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
  editForm.value.epg_source_id = epgCh.source_id
  epgIdAcResults.value = []
  epgIdAcOpen.value = false
  if (epgCh.icon_url) {
    epgSelectedIcon.value = epgCh.icon_url
  }
}

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
.filter-count-badge { font-size: 11px; color: var(--accent); background: var(--bg-tertiary); padding: 2px 8px; border-radius: 10px; font-weight: 600; }
.adv-filter-select { height: 32px; padding: 0 8px; font-size: 12px; width: auto; max-width: 170px; }
.adv-filter-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: var(--accent); background: var(--bg-tertiary); border: 1px solid var(--accent); padding: 2px 6px 2px 8px; border-radius: 10px; white-space: nowrap; }
.adv-filter-badge-clear { background: none; border: none; color: inherit; font-size: 13px; line-height: 1; cursor: pointer; padding: 0 2px; }
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
.cat-sb-item.cat-sb-hidden { opacity: 0.65; }
.cat-sb-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cat-sb-hidden-badge { font-size: 8px; color: var(--warning); background: var(--warning-soft); padding: 1px 4px; border-radius: 6px; flex-shrink: 0; }
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
.bulk-bar { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 8px 16px; background: var(--bg-secondary); border-bottom: 1px solid var(--border); }

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
.ch-table tbody tr { content-visibility: auto; contain-intrinsic-size: 42px; }
.ch-table tbody tr:hover { background: var(--bg-hover); }
.ch-table tbody tr.selected { background: var(--accent-soft); }
.ch-table tbody tr.editing { background: var(--accent-soft); box-shadow: inset 0 0 0 1px var(--accent); }
.th-check, .td-check { width: 32px; text-align: center; }
.td-check input, .th-check input { accent-color: var(--accent); cursor: pointer; }
.th-num, .td-num { width: 40px; color: var(--text-muted); text-align: center; }
.ch-name-cell { display: flex; align-items: center; gap: 6px; }
.row-logo { width: 22px; height: 22px; border-radius: 3px; object-fit: contain; flex-shrink: 0; }
.row-logo-fb { font-size: 14px; width: 22px; text-align: center; flex-shrink: 0; }
.td-name { font-weight: 500; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.td-url { max-width: 200px; }
.url-text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted); font-size: 11px; }
.td-epg { color: var(--text-muted); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.health-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; flex-shrink: 0; vertical-align: middle; }
.health-ok { background: var(--success, #22c55e); }
.health-dead { background: var(--danger, #ef4444); }
.health-unchecked { background: var(--text-muted, #9ca3af); opacity: 0.5; }
.health-scan-btn:disabled { opacity: 0.7; cursor: default; }

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
.sort-truncated-warning {
  padding: 8px 16px; color: var(--warning); background: var(--warning-soft);
  border-bottom: 1px solid var(--border); font-size: 12px; flex-shrink: 0;
}
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
.sort-move { display: flex; flex-direction: column; gap: 2px; flex-shrink: 0; }
.sort-move-btn {
  display: grid; place-items: center; width: 22px; height: 16px; padding: 0;
  background: var(--bg-primary); border: 1px solid var(--border); border-radius: 4px;
  color: var(--text-muted); cursor: pointer; transition: color 0.15s, border-color 0.15s;
}
.sort-move-btn:hover:not(:disabled) { color: var(--text-primary); border-color: var(--accent); }
.sort-move-btn:disabled { opacity: 0.35; cursor: default; }
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

/* EPG source library (iptv-org) */
.epg-lib-country { max-width: 200px; flex-shrink: 0; }
.epg-lib-results { margin-top: 10px; }
.epg-lib-status { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-muted); padding: 8px 0; }
.epg-lib-list {
  display: flex; flex-direction: column; max-height: 320px; overflow-y: auto;
  border: 1px solid var(--border); border-radius: var(--radius);
}
.epg-lib-item {
  display: flex; align-items: center; gap: 10px; padding: 8px 12px;
  border-bottom: 1px solid var(--border); transition: background var(--transition);
}
.epg-lib-item:last-child { border-bottom: none; }
.epg-lib-item:hover { background: var(--bg-hover); }
.epg-lib-item-info { flex: 1; min-width: 0; }
.epg-lib-item-name { font-size: 12px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.epg-lib-item-meta { display: flex; gap: 8px; font-size: 11px; color: var(--text-muted); overflow: hidden; }
.epg-lib-item-samples { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.epg-lib-no-url { font-size: 10px; color: var(--text-muted); white-space: nowrap; cursor: help; }

/* Match profiles */
.epg-profile-form { display: flex; flex-direction: column; gap: 8px; }
.epg-profile-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; }
.epg-profile-field { display: flex; flex-direction: column; gap: 4px; }
.epg-profile-field span { font-size: 11px; color: var(--text-muted); }
.epg-profile-settings { font-size: 11px; color: var(--text-muted); margin-top: 4px; word-break: break-word; }

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
.epg-detail-ch-logo { width: 24px; height: 24px; border-radius: 6px; object-fit: contain; }
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
.update-panel { padding: 16px 20px; flex: 1; min-height: 0; overflow-y: auto; }
/* Sync kategori secimi + rapor */
.sync-select-panel {
  margin-top: 14px; padding: 16px; border: 1px solid var(--border);
  border-radius: var(--radius-lg); background: var(--bg-secondary);
}
.sync-select-title { margin: 0 0 4px; font-size: 14px; font-weight: 600; }
.sync-select-desc { margin: 0 0 14px; color: var(--text-muted); font-size: 12px; line-height: 1.5; }
.sync-type-block { margin: 0 0 14px; padding: 0; border: none; }
.sync-type-block:disabled { opacity: 0.6; }
.sync-type-legend { margin-bottom: 8px; color: var(--text-secondary); font-size: 12px; font-weight: 600; }
.search-group { margin-bottom: 12px; }
.category-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.category-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.selected-counter { color: var(--text-secondary); font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.category-list {
  max-height: 260px; overflow-y: auto; overscroll-behavior: contain; border: 1px solid var(--border);
  border-radius: var(--radius); background: var(--bg-primary);
}
.category-list:focus-visible { outline: 3px solid var(--accent-soft); border-color: var(--accent); }
.category-list ul { margin: 0; padding: 4px; list-style: none; }
.category-row {
  display: flex; align-items: center; gap: 10px; min-height: 38px; padding: 7px 10px; border-radius: 6px;
  content-visibility: auto; contain-intrinsic-size: 38px;
}
.category-row:hover { background: var(--bg-hover); }
.category-row input { width: 16px; height: 16px; margin: 0; accent-color: var(--accent); flex-shrink: 0; }
.category-row input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.category-row label { flex: 1; display: flex; align-items: center; gap: 8px; color: var(--text-secondary); font-size: 13px; line-height: 1.35; cursor: pointer; }
.empty-categories { margin: 0; padding: 28px 16px; color: var(--text-muted); font-size: 13px; text-align: center; }
.selection-warning { margin: 10px 0 0; color: #fca5a5; font-size: 12px; }
.sync-new-badge {
  flex-shrink: 0; padding: 1px 7px; border-radius: 999px; font-size: 10px; font-weight: 700;
  background: var(--accent-soft); color: var(--accent-hover); border: 1px solid var(--accent);
}
.sync-select-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
.sync-report {
  margin-top: 14px; padding: 16px; border: 1px solid rgba(16,185,129,0.25);
  border-radius: var(--radius-lg); background: var(--bg-secondary);
}
.sync-report-title { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; font-size: 14px; font-weight: 600; }
.sync-report-stats { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.sync-report-section { margin-bottom: 14px; }
.sync-report-section h5 { margin: 0 0 8px; color: var(--text-secondary); font-size: 12px; font-weight: 600; }
.sync-report-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.sync-report-tag {
  padding: 3px 10px; border-radius: 999px; font-size: 11px;
  background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border);
}
.sync-report-channels { margin: 0; padding: 0 0 0 18px; color: var(--text-secondary); font-size: 12px; line-height: 1.7; }
.sync-report-more { color: var(--text-muted); font-style: italic; list-style: none; }
.sync-report-empty { margin: 0; color: var(--text-muted); font-size: 12px; }
@media (max-width: 600px) {
  .category-toolbar { flex-direction: column; align-items: flex-start; }
  .selected-counter { white-space: normal; }
}
/* Smart empty state */
.empty-smart { display: flex; flex-direction: column; align-items: center; padding: 20px 0; max-width: 420px; margin: 0 auto; }
.empty-smart-icon { width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
.empty-smart-icon.vod { background: linear-gradient(135deg, rgba(139,92,246,0.12), rgba(99,102,241,0.08)); color: #8b5cf6; }
.empty-smart-icon.series { background: linear-gradient(135deg, rgba(59,130,246,0.12), rgba(99,102,241,0.08)); color: #3b82f6; }
.empty-smart-icon.accent { background: linear-gradient(135deg, var(--accent-soft), rgba(99,102,241,0.06)); color: var(--accent); }
.empty-smart-icon.muted { background: var(--bg-hover); color: var(--text-muted); }
.empty-smart-title { font-size: 18px; font-weight: 600; margin-bottom: 6px; text-align: center; }
.empty-smart-desc { font-size: 13px; color: var(--text-secondary); text-align: center; line-height: 1.6; margin-bottom: 20px; }

/* Source option cards */
.empty-smart-options { display: flex; flex-direction: column; gap: 10px; width: 100%; margin-top: 4px; }
.empty-option-card {
  display: flex; align-items: center; gap: 14px; padding: 16px 18px;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); cursor: pointer; transition: var(--transition);
}
.empty-option-card:hover { background: var(--bg-card-hover); border-color: var(--border-light); transform: translateY(-1px); box-shadow: var(--shadow-sm); }
.empty-option-icon {
  width: 44px; height: 44px; border-radius: var(--radius); display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.empty-option-icon.xtream { background: linear-gradient(135deg, #6366f1, #818cf8); color: white; }
.empty-option-icon.m3u { background: linear-gradient(135deg, #10b981, #34d399); color: white; }
.empty-option-info { flex: 1; min-width: 0; }
.empty-option-title { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
.empty-option-desc { font-size: 11.5px; color: var(--text-secondary); line-height: 1.5; }
.empty-option-arrow { color: var(--text-muted); flex-shrink: 0; transition: var(--transition); }
.empty-option-card:hover .empty-option-arrow { color: var(--accent); transform: translateX(3px); }

/* Add Types Section */
.add-types-section {
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 16px; margin-bottom: 8px; margin-top: 8px;
}
.add-types-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.add-types-desc { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }
.add-types-current { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
.add-types-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
.add-types-complete { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--success); margin-top: 8px; }

/* Filtre kurallari */
.filter-rule-list { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.filter-rule-row {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px;
  background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius);
}
.filter-rule-disabled { opacity: 0.5; }
.filter-rule-field { font-size: 11px; color: var(--text-muted); min-width: 56px; }
.filter-rule-pattern {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 12px; color: var(--text-primary); background: var(--bg-tertiary);
  padding: 2px 6px; border-radius: 4px;
}
.filter-rule-actions { display: flex; gap: 2px; flex-shrink: 0; }
.filter-rule-empty { font-size: 12px; color: var(--text-muted); margin-bottom: 12px; }
.filter-rule-form { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.filter-rule-select { width: auto; flex: 0 0 auto; }
.filter-rule-input { flex: 1; min-width: 140px; }
.filter-rule-test-result {
  margin-top: 10px; padding: 10px 12px; background: var(--bg-secondary);
  border: 1px solid var(--border); border-radius: var(--radius);
}
.filter-rule-test-summary { font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; }
.filter-rule-test-matches { list-style: none; margin: 0; padding: 0; font-size: 12px; display: flex; flex-direction: column; gap: 4px; }
.filter-rule-test-group { color: var(--text-muted); margin-left: 6px; }

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
.result-box { padding: 10px 14px; border-radius: var(--radius); font-size: 13px; display: flex; align-items: center; gap: 8px; }
.result-box.success { background: var(--success-soft); color: var(--success); border: 1px solid rgba(16,185,129,0.2); }

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

.account-edit-form { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
.account-edit-desc { margin: 0 0 12px; font-size: 11px; color: var(--text-muted); line-height: 1.5; }
.account-edit-form .form-group { margin-bottom: 10px; }
.account-edit-form .form-group label { display: block; margin-bottom: 4px; font-size: 11px; font-weight: 600; color: var(--text-secondary); }
.account-edit-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }

/* Otomatik guncelleme (auto sync) */
.auto-sync-section {
  margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border);
}
.auto-sync-header { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); margin-bottom: 8px; }
.auto-sync-title { font-size: 12px; font-weight: 600; }
.auto-sync-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.auto-sync-select { width: auto; min-width: 140px; padding: 6px 10px; font-size: 12px; }
.auto-sync-backup { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary); cursor: pointer; }
.auto-sync-hint { margin-top: 8px; font-size: 11px; color: var(--text-muted); }

/* EPG kaynak otomatik yenileme */
.epg-src-autorefresh {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  border-top: 1px solid var(--border);
}
.epg-src-autorefresh-label { font-size: 11px; color: var(--text-muted); }
.epg-src-autorefresh-select { width: auto; min-width: 120px; padding: 4px 8px; font-size: 11.5px; }

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
  width: 64px; height: 64px; border-radius: 8px; object-fit: contain; background: var(--bg-tertiary);
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
/* Alan icine gomulu eylem dugmesi (Logo URL -> kutuphanede ara). Metin
   dugmenin altina kaymasin diye input'a sag bosluk verilir. */
.ep-input-action-wrap { position: relative; display: flex; align-items: center; }
.ep-input-action-wrap .input { width: 100%; }
.ep-input-with-action { padding-right: 34px; }
.ep-input-action {
  position: absolute; right: 5px;
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; padding: 0;
  background: none; border: none; border-radius: var(--radius-sm);
  color: var(--text-muted); cursor: pointer;
  transition: color var(--transition), background var(--transition);
}
.ep-input-action:hover { color: var(--accent); background: var(--bg-hover); }
.ep-input-action:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

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

/* Metadata panel */
.ep-metadata-section { margin-top: 12px; border-top: 1px solid var(--border); padding-top: 12px; }
.ep-metadata-header { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; }
.ep-metadata-body { font-size: 12px; color: var(--text-secondary); }
.ep-meta-backdrop { border-radius: var(--radius); overflow: hidden; margin-bottom: 8px; max-height: 120px; }
.ep-meta-backdrop img { width: 100%; height: 100%; object-fit: cover; }
.ep-meta-overview { line-height: 1.5; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.ep-meta-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.ep-meta-item { display: flex; flex-direction: column; gap: 2px; background: var(--bg-tertiary); padding: 4px 8px; border-radius: var(--radius); }
.ep-meta-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
.ep-meta-value { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.ep-meta-rating { color: #fbbf24; }
.ep-meta-genres { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.ep-meta-genre-tag { font-size: 10px; padding: 2px 8px; border-radius: 10px; background: var(--accent-soft, rgba(99,102,241,0.15)); color: var(--accent); }
.ep-meta-info { font-size: 12px; margin-bottom: 4px; line-height: 1.4; }
.ep-meta-info .ep-meta-label { display: inline; font-size: 12px; font-weight: 600; color: var(--text-primary); text-transform: none; letter-spacing: 0; }
.ep-meta-ids { display: flex; gap: 12px; color: var(--text-muted); font-size: 11px; margin-top: 6px; }
.ch-meta-badges { display: inline-flex; gap: 4px; margin-left: 6px; }
.ch-meta-year { font-size: 10px; color: var(--text-muted); background: var(--bg-tertiary); padding: 1px 5px; border-radius: 4px; }
.ch-meta-rating { font-size: 10px; color: #fbbf24; background: rgba(251,191,36,0.1); padding: 1px 5px; border-radius: 4px; font-weight: 600; }

.nav-section-active { background: var(--accent-soft); color: var(--accent); }
.nav-section-count { font-size: 11px; color: var(--text-muted); background: var(--bg-tertiary); padding: 1px 6px; border-radius: 8px; margin-left: auto; margin-right: 4px; }
.stream-type-group { display: flex; gap: 16px; margin-top: 4px; }
.stream-type-label { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; color: var(--text-secondary); }
.stream-type-label input[type="checkbox"] { accent-color: var(--accent); }

.mobile-menu-btn, .mobile-scrim { display: none; }

@media (max-width: 1180px) {
  .edit-panel { width: 280px; min-width: 280px; }
  .cat-sidebar { width: 190px; min-width: 170px; }
  .search-input { width: 180px; }
}

@media (max-width: 960px) {
  .mobile-menu-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 40px; height: 40px; flex: 0 0 40px;
    border: 1px solid var(--border-light); border-radius: var(--radius);
    color: var(--text-primary); background: var(--bg-tertiary); cursor: pointer;
  }
  .nav-sidebar {
    position: fixed; z-index: 702; top: var(--header-height, 52px); bottom: 0; left: 0;
    width: min(320px, 86vw); transform: translateX(-102%);
    transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 12px 0 36px rgba(0,0,0,0.35);
  }
  .nav-sidebar.mobile-open { transform: translateX(0); }
  .mobile-scrim {
    display: block; position: fixed; inset: var(--header-height, 52px) 0 0; z-index: 701;
    border: 0; width: auto; height: auto; background: rgba(3,5,10,0.64);
  }
  .edit-panel {
    position: fixed; z-index: 690; right: 0; top: var(--header-height, 52px); bottom: 0;
    width: min(380px, 88vw); min-width: 0; box-shadow: -12px 0 36px rgba(0,0,0,0.35);
  }
  .edit-panel-empty { display: none; }
}

@media (max-width: 720px) {
  .editor, .editor-loading { height: calc(100dvh - var(--header-height, 52px)); }
  .top-bar { padding: 8px; gap: 8px; }
  .top-bar-left, .top-bar-right { gap: 6px; min-width: 0; }
  .playlist-title { max-width: 34vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .channel-count-badge, .top-bar-right > .btn { display: none; }
  .filter-count-badge { display: none; }
  .adv-filter-select { max-width: 120px; }
  .top-bar-right > .add-channel-btn { display: inline-flex; width: 40px; height: 40px; justify-content: center; padding: 0; }
  .add-channel-label { display: none; }
  .search-input { width: min(34vw, 160px); height: 40px; }
  .cat-sidebar {
    position: fixed; z-index: 704; top: var(--header-height, 52px); bottom: 0; left: 0;
    width: min(330px, 88vw); min-width: 0; transform: translateX(-102%);
    transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 12px 0 36px rgba(0,0,0,0.35);
  }
  .cat-sidebar.mobile-open { transform: translateX(0); }
  .category-scrim { z-index: 703; }
  .edit-panel { inset: var(--header-height, 52px) 0 0; width: 100%; }
  .th-url, .td-url, .th-epg, .td-epg, .th-num, .td-num { display: none; }
  .ch-table th, .ch-table td { padding-block: 10px; }
  .td-name { max-width: none; }
  .center-empty { padding: 36px 18px; }
  .modal { width: calc(100% - 24px); max-height: calc(100dvh - 32px); overflow-y: auto; padding: 20px; }
  .epg-toolbar, .view-header { flex-wrap: wrap; }
}
</style>
