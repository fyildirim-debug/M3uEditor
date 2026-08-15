<template>
  <div class="ai-root">
    <button
      class="ai-launcher"
      type="button"
      :class="{ open }"
      :aria-label="t('ai.title')"
      :title="t('ai.title')"
      @click="toggle"
    >
      <svg v-if="!open" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z"/>
      </svg>
      <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>

    <Teleport to="body">
      <div v-if="open" class="ai-panel" role="dialog" :aria-label="t('ai.title')">
        <header class="ai-header">
          <div class="ai-title">
            <span class="ai-dot" :class="{ ready: settings.configured }" aria-hidden="true"></span>
            <strong>{{ t('ai.title') }}</strong>
            <span v-if="settings.model" class="badge badge-accent ai-model">{{ settings.model }}</span>
          </div>
          <div class="ai-header-actions">
            <button class="btn btn-ghost btn-icon-sm" type="button" :title="t('ai.newChat')" :aria-label="t('ai.newChat')" @click="startNewChat">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon-sm" type="button" :title="t('ai.tasks')" :aria-label="t('ai.tasks')" @click="openTasks">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon-sm" type="button" :title="t('ai.settings')" :aria-label="t('ai.settings')" @click="view = view === 'settings' ? 'chat' : 'settings'">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon-sm" type="button" :aria-label="t('common.close')" @click="open = false">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </header>

        <!-- ── Ayarlar ── -->
        <section v-if="view === 'settings'" class="ai-body">
          <AiSettingsForm id-prefix="ai-panel" show-cancel @cancel="view = 'chat'" @saved="onSettingsSaved" />
        </section>

        <!-- ── Zamanlanmış görevler ── -->
        <section v-else-if="view === 'tasks'" class="ai-body">
          <p class="ai-hint">{{ t('ai.tasksHint') }}</p>
          <p v-if="!tasks.length" class="ai-empty-inline">{{ t('ai.tasksEmpty') }}</p>
          <div v-for="task in tasks" :key="task.id" class="ai-task" :class="{ off: !task.enabled }">
            <div class="ai-task-head">
              <strong>{{ task.name }}</strong>
              <span class="ai-task-interval">{{ formatInterval(task.intervalMinutes) }}</span>
            </div>
            <p class="ai-task-prompt">{{ task.prompt }}</p>
            <p v-if="task.lastRunAt" class="ai-task-meta" :class="{ failed: task.lastStatus === 'error' }">
              {{ t('ai.taskLastRun', { when: formatDate(task.lastRunAt), status: task.lastStatus }) }}
            </p>
            <p v-else class="ai-task-meta">{{ t('ai.taskNever') }}</p>
            <p v-if="task.lastResult" class="ai-task-result">{{ task.lastResult }}</p>
            <div class="ai-task-actions">
              <button class="btn btn-ghost btn-sm" type="button" :disabled="busyTaskId === task.id" @click="toggleTask(task)">
                {{ task.enabled ? t('ai.taskDisable') : t('ai.taskEnable') }}
              </button>
              <button class="btn btn-secondary btn-sm" type="button" :disabled="busyTaskId === task.id" @click="runTask(task)">
                <span v-if="busyTaskId === task.id" class="spinner spinner-sm"></span>
                {{ t('ai.taskRun') }}
              </button>
              <button class="btn btn-ghost btn-sm ai-danger" type="button" :disabled="busyTaskId === task.id" @click="deleteTask(task)">
                {{ t('common.delete') }}
              </button>
            </div>
          </div>
        </section>

        <!-- ── Sohbet ── -->
        <section v-else class="ai-body" ref="scroller">
          <div v-if="!settings.configured" class="ai-empty">
            <p>{{ t('ai.notConfigured') }}</p>
            <button class="btn btn-primary btn-sm" type="button" @click="view = 'settings'">{{ t('ai.openSettings') }}</button>
          </div>

          <template v-else>
            <div v-if="!messages.length" class="ai-empty">
              <p>{{ t('ai.welcome') }}</p>
              <div class="ai-suggestions">
                <button v-for="(suggestion, index) in suggestions" :key="index" class="ai-suggestion" type="button" @click="send(suggestion)">
                  {{ suggestion }}
                </button>
              </div>
            </div>

            <div v-for="(message, index) in messages" :key="index" :class="['ai-message', 'ai-' + message.role]">
              <!-- Yanıtın kimden geldiği ve hâlâ yazılıp yazılmadığı her zaman görünür olmalı. -->
              <div v-if="message.role === 'assistant'" class="ai-author">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"/>
                </svg>
                <span>{{ t('ai.assistantLabel') }}</span>
                <span v-if="message.streaming" class="ai-author-state">{{ t('ai.writing') }}</span>
              </div>

              <div v-if="message.role === 'assistant' && message.steps?.length" class="ai-steps">
                <div v-for="(step, stepIndex) in message.steps" :key="stepIndex" :class="['ai-step', { failed: step.ok === false, destructive: step.destructive, running: step.ok === undefined }]">
                  <span v-if="step.ok === undefined" class="ai-step-spin" aria-hidden="true"></span>
                  <svg v-else-if="step.ok" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                  <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  <code>{{ step.tool }}</code>
                  <span v-if="step.error" class="ai-step-error">{{ step.error }}</span>
                </div>
              </div>

              <div v-if="message.attachments?.length" class="ai-files">
                <span v-for="file in message.attachments" :key="file.id" class="ai-file-chip">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  {{ file.filename }}
                </span>
              </div>

              <div v-if="message.content" class="ai-bubble">
                <template v-if="message.role === 'assistant'">
                  <MarkdownText :text="message.content" />
                  <span v-if="message.streaming" class="ai-caret" aria-hidden="true"></span>
                </template>
                <template v-else>{{ message.content }}</template>
              </div>

              <!-- Henüz tek karakter gelmediyse de asistanın çalıştığı görünsün. -->
              <div v-else-if="message.streaming" class="ai-bubble ai-typing">
                <span></span><span></span><span></span>
              </div>

              <!-- Asistanın ürettiği indirilebilir dosyalar -->
              <div v-if="message.outputs?.length" class="ai-downloads">
                <button
                  v-for="file in message.outputs"
                  :key="file.id"
                  class="ai-download"
                  type="button"
                  @click="downloadFile(file)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <span class="ai-download-name">{{ file.filename }}</span>
                  <span class="ai-download-size">{{ formatSize(file.sizeBytes) }}</span>
                </button>
              </div>

              <!-- Onay bekleyen yıkıcı işlem -->
              <div v-if="message.pending" class="ai-approval">
                <div class="ai-approval-head">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <strong>{{ t('ai.approvalTitle') }}</strong>
                </div>
                <code class="ai-approval-tool">{{ message.pending.tool }}</code>
                <p class="ai-approval-impact">{{ message.pending.impact }}</p>
                <div class="ai-approval-actions">
                  <button class="btn btn-secondary btn-sm" type="button" :disabled="sending" @click="resolveApproval(message, false)">{{ t('ai.reject') }}</button>
                  <button class="btn btn-primary btn-sm" type="button" :disabled="sending" @click="resolveApproval(message, true)">{{ t('ai.approve') }}</button>
                </div>
              </div>
            </div>

          </template>
        </section>

        <footer v-if="view === 'chat' && settings.configured" class="ai-footer">
          <div class="ai-composer">
            <div v-if="pendingFiles.length" class="ai-pending-files">
              <span v-for="file in pendingFiles" :key="file.id" class="ai-file-chip">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                {{ file.filename }}
                <button class="ai-file-remove" type="button" :aria-label="t('ai.removeFile')" @click="removePendingFile(file)">×</button>
              </span>
            </div>
            <textarea
              v-model="draft"
              class="input ai-input"
              rows="1"
              :placeholder="t('ai.placeholder')"
              :disabled="sending"
              @keydown.enter.exact.prevent="send()"
            ></textarea>
          </div>
          <input ref="fileInput" type="file" multiple accept=".m3u,.m3u8,.txt,.xml,.xmltv,.json,.csv" style="display:none" @change="onFileSelect" />
          <button class="btn btn-ghost btn-icon" type="button" :disabled="sending || uploading" :title="t('ai.attach')" :aria-label="t('ai.attach')" @click="fileInput?.click()">
            <span v-if="uploading" class="spinner spinner-sm"></span>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </button>
          <button class="btn btn-primary btn-icon" type="button" :disabled="sending || (!draft.trim() && !pendingFiles.length)" :aria-label="t('ai.send')" @click="send()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </footer>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch, inject } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api'
import { useI18n } from '../langs/useI18n'
import AiSettingsForm from './AiSettingsForm.vue'
import MarkdownText from './MarkdownText.vue'

const { t } = useI18n()
const route = useRoute()
const toast = inject('toast', () => {})

const open = ref(false)
const view = ref('chat')
const sending = ref(false)
const uploading = ref(false)
const draft = ref('')
const scroller = ref(null)
const fileInput = ref(null)
const messages = ref([])
const conversationId = ref(null)
const pendingFiles = ref([])
const tasks = ref([])
const busyTaskId = ref(null)
// Akış sırasında içeriği büyüyen asistan mesajı; akış bitince sıfırlanır.
const streamingMessage = ref(null)

const settings = reactive({ configured: false, hasApiKey: false, model: null, baseUrl: '', limits: {} })

// Editördeyken açık liste asistana bağlam olarak geçer; araç çağrıları
// playlistId verilmediğinde bu listeyi kullanır.
const playlistId = computed(() => (route.path.startsWith('/playlist/') ? route.params.id : null))

const suggestions = computed(() => [
  t('ai.suggestion1'),
  t('ai.suggestion2'),
  t('ai.suggestion3'),
])

async function loadSettings() {
  try {
    const { data } = await api.get('/ai/settings')
    Object.assign(settings, data)
  } catch { /* oturum yoksa sessizce geç */ }
}

function toggle() {
  open.value = !open.value
  // Hesap ayarlarından yapılandırıldıysa panel doğrudan sohbetle açılsın.
  if (open.value) loadSettings().then(() => { if (!settings.configured) view.value = 'settings' })
}

function onSettingsSaved(data) {
  Object.assign(settings, data)
  if (data.configured) view.value = 'chat'
}

// Hesap ayarları sayfasındaki form kaydettiğinde panel de güncel kalsın.
function onExternalSettingsChange(event) {
  if (event.detail) Object.assign(settings, event.detail)
}

function startNewChat() {
  conversationId.value = null
  messages.value = []
  pendingFiles.value = []
  view.value = 'chat'
}

async function scrollToEnd() {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

function formatSize(bytes) {
  const value = Number(bytes) || 0
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function formatInterval(minutes) {
  const value = Number(minutes) || 0
  if (value % 1440 === 0) return t('ai.everyDays', { count: value / 1440 })
  if (value % 60 === 0) return t('ai.everyHours', { count: value / 60 })
  return t('ai.everyMinutes', { count: value })
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return String(value)
  }
}

/* ─────────────── Dosya ekleme ─────────────── */

async function onFileSelect(event) {
  const files = [...(event.target.files || [])]
  event.target.value = ''
  if (!files.length) return

  const maxBytes = settings.limits?.attachmentBytes || 20 * 1024 * 1024
  uploading.value = true
  try {
    for (const file of files) {
      if (file.size > maxBytes) {
        toast(t('ai.attachTooLarge', { name: file.name, size: formatSize(maxBytes) }), 'error')
        continue
      }
      // Dosyalar metin tabanlı (M3U/XML/JSON/CSV/TXT); sunucu içerikten
      // biçimi kendisi tespit ediyor, burada uzantıya göre karar verilmiyor.
      const content = await file.text()
      const { data } = await api.post('/ai/attachments', {
        filename: file.name,
        content,
        conversationId: conversationId.value || undefined,
      })
      pendingFiles.value.push(data)
    }
  } catch (error) {
    toast(error.response?.data?.error?.message || t('ai.attachFailed'), 'error')
  } finally {
    uploading.value = false
  }
}

async function removePendingFile(file) {
  pendingFiles.value = pendingFiles.value.filter((item) => item.id !== file.id)
  try {
    await api.delete(`/ai/attachments/${file.id}`)
  } catch { /* sunucuda kalırsa kota temizliğinde silinir */ }
}

async function downloadFile(file) {
  try {
    const response = await api.get(`/ai/attachments/${file.id}/download`, { responseType: 'blob' })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = file.filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (error) {
    toast(error.response?.data?.error?.message || t('ai.downloadFailed'), 'error')
  }
}

/* ─────────────── Sohbet ─────────────── */

function notifyDataChanged(steps) {
  // Veri değiştiren araçlar çalıştıysa açık ekranlar kendini tazelesin.
  const changed = (steps || []).some((step) => step.ok
    && !['list_', 'get_', 'search_', 'find_', 'describe_', 'count_', 'preview_', 'read_'].some((prefix) => step.tool.startsWith(prefix)))
  if (changed) window.dispatchEvent(new CustomEvent('ai:data-changed'))
}

/**
 * Akışlı sohbet. Sunucu SSE gönderir; her kare bir olaydır. Akış kurulamazsa
 * (eski tarayıcı, araya giren vekil sunucu, 401 sonrası token tazeleme)
 * `false` döner ve çağıran akışsız uca düşer.
 */
async function streamChat(payload, onEvent) {
  if (typeof fetch !== 'function' || !window.ReadableStream) return false
  const token = sessionStorage.getItem('token')
  let response
  try {
    response = await fetch('/api/ai/chat/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
      credentials: 'include',
    })
  } catch {
    return false
  }
  if (!response.ok || !response.body) return false

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let boundary = buffer.indexOf('\n\n')
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue
        try {
          onEvent(JSON.parse(line.slice(5).trim()))
        } catch { /* yarım kare; sonraki turda tamamlanır */ }
      }
      boundary = buffer.indexOf('\n\n')
    }
  }
  return true
}

/** Akış olaylarını ekrandaki asistan mesajına uygular. */
function applyEvent(event, target) {
  if (event.type === 'start') {
    conversationId.value = event.conversationId
  } else if (event.type === 'delta') {
    target.content += event.text
  } else if (event.type === 'tool') {
    // Sonucu henüz belli değil: ok alanı tanımsız kalır, arayüz dönen halka gösterir.
    target.steps.push({ tool: event.tool })
  } else if (event.type === 'tool-result') {
    const running = target.steps.find((step) => step.tool === event.tool && step.ok === undefined)
    if (running) Object.assign(running, event)
    else target.steps.push(event)
  } else if (event.type === 'attachment') {
    if (!target.outputs.some((file) => file.id === event.file.id)) target.outputs.push(event.file)
  } else if (event.type === 'approval') {
    target.pending = event.pending
  } else if (event.type === 'done') {
    if (event.reply && !target.content) target.content = event.reply
    target.pending = event.pendingApproval || target.pending
    notifyDataChanged(event.steps)
  } else if (event.type === 'error') {
    target.content = target.content || event.message || t('ai.failed')
  }
  scrollToEnd()
}

async function send(preset) {
  const text = String(preset ?? draft.value).trim()
  const files = pendingFiles.value.slice()
  if ((!text && !files.length) || sending.value) return

  draft.value = ''
  pendingFiles.value = []
  messages.value.push({ role: 'user', content: text, attachments: files })
  sending.value = true
  scrollToEnd()

  const assistant = reactive({ role: 'assistant', content: '', steps: [], outputs: [], pending: null, streaming: true })
  messages.value.push(assistant)
  streamingMessage.value = assistant

  const payload = {
    message: text || t('ai.filesAttached'),
    conversationId: conversationId.value || undefined,
    playlistId: playlistId.value || undefined,
    attachmentIds: files.length ? files.map((file) => file.id) : undefined,
  }

  try {
    const streamed = await streamChat(payload, (event) => applyEvent(event, assistant))
    if (!streamed) {
      // Akışsız yedek yol: axios token tazelemeyi de üstlenir.
      const { data } = await api.post('/ai/chat', payload)
      conversationId.value = data.conversationId
      assistant.content = data.reply || ''
      assistant.steps = data.steps || []
      assistant.outputs = data.files || []
      assistant.pending = data.pendingApproval || null
      notifyDataChanged(data.steps)
    }
    if (!assistant.content && !assistant.pending && !assistant.steps.length) {
      assistant.content = t('ai.failed')
    }
  } catch (error) {
    assistant.content = error.response?.data?.error?.message || t('ai.failed')
  } finally {
    assistant.streaming = false
    sending.value = false
    streamingMessage.value = null
    scrollToEnd()
  }
}

async function resolveApproval(message, approved) {
  const pending = message.pending
  if (!pending || sending.value) return
  message.pending = null
  sending.value = true

  const assistant = reactive({ role: 'assistant', content: '', steps: [], outputs: [], pending: null, streaming: true })
  messages.value.push(assistant)
  scrollToEnd()

  try {
    const { data } = await api.post(`/ai/approvals/${pending.id}`, { approved })
    assistant.content = data.reply || (approved ? t('ai.approved') : t('ai.rejected'))
    assistant.steps = data.steps || []
    assistant.outputs = data.files || []
    assistant.pending = data.pendingApproval || null
    notifyDataChanged(data.steps)
  } catch (error) {
    assistant.content = error.response?.data?.error?.message || t('ai.failed')
  } finally {
    assistant.streaming = false
    sending.value = false
    scrollToEnd()
  }
}

/* ─────────────── Zamanlanmış görevler ─────────────── */

async function loadTasks() {
  try {
    const { data } = await api.get('/ai/tasks')
    tasks.value = data.tasks || []
  } catch { /* görev listesi kritik değil */ }
}

function openTasks() {
  view.value = view.value === 'tasks' ? 'chat' : 'tasks'
  if (view.value === 'tasks') loadTasks()
}

async function toggleTask(task) {
  busyTaskId.value = task.id
  try {
    const { data } = await api.patch(`/ai/tasks/${task.id}`, { enabled: !task.enabled })
    Object.assign(task, data)
  } catch (error) {
    toast(error.response?.data?.error?.message || t('ai.taskFailed'), 'error')
  } finally {
    busyTaskId.value = null
  }
}

async function runTask(task) {
  busyTaskId.value = task.id
  try {
    await api.post(`/ai/tasks/${task.id}/run`)
    await loadTasks()
    window.dispatchEvent(new CustomEvent('ai:data-changed'))
    toast(t('ai.taskRanOk', { name: task.name }), 'success')
  } catch (error) {
    toast(error.response?.data?.error?.message || t('ai.taskFailed'), 'error')
    await loadTasks()
  } finally {
    busyTaskId.value = null
  }
}

async function deleteTask(task) {
  busyTaskId.value = task.id
  try {
    await api.delete(`/ai/tasks/${task.id}`)
    tasks.value = tasks.value.filter((item) => item.id !== task.id)
  } catch (error) {
    toast(error.response?.data?.error?.message || t('ai.taskFailed'), 'error')
  } finally {
    busyTaskId.value = null
  }
}

watch(open, (value) => { if (value) scrollToEnd() })

onMounted(() => {
  loadSettings()
  window.addEventListener('ai:settings-changed', onExternalSettingsChange)
})
onUnmounted(() => window.removeEventListener('ai:settings-changed', onExternalSettingsChange))
</script>

<style scoped>
.ai-launcher {
  position: fixed; right: 20px; bottom: 20px; z-index: 900;
  width: 48px; height: 48px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.12);
  background: var(--accent); color: white; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 24px rgba(99,102,241,0.45);
  transition: transform var(--transition), box-shadow var(--transition), background var(--transition);
}
.ai-launcher:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 10px 32px rgba(99,102,241,0.55); }
.ai-launcher.open { background: var(--bg-tertiary); color: var(--text-primary); }

.ai-panel {
  position: fixed; right: 20px; bottom: 80px; z-index: 950;
  width: min(420px, calc(100vw - 32px));
  height: min(620px, calc(100vh - 140px));
  display: flex; flex-direction: column;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
}

.ai-header {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 12px 12px 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-tertiary);
}
.ai-title { display: flex; align-items: center; gap: 8px; font-size: 13.5px; min-width: 0; }
.ai-model { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ai-header-actions { display: flex; gap: 2px; flex-shrink: 0; }
.ai-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-disabled); flex-shrink: 0; }
.ai-dot.ready { background: var(--success); box-shadow: 0 0 8px rgba(16,185,129,0.6); }

.ai-body { flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }

.ai-empty { margin: auto 0; text-align: center; color: var(--text-secondary); font-size: 13px; display: flex; flex-direction: column; gap: 12px; align-items: center; }
.ai-empty-inline { color: var(--text-secondary); font-size: 12.5px; margin: 0; }
.ai-hint { font-size: 12px; color: var(--text-secondary); line-height: 1.55; margin: 0; }
.ai-suggestions { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.ai-suggestion {
  text-align: left; font-size: 12.5px; color: var(--text-secondary);
  background: var(--bg-tertiary); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 9px 11px; cursor: pointer;
  transition: background var(--transition), color var(--transition);
}
.ai-suggestion:hover { background: var(--bg-hover); color: var(--text-primary); }

.ai-message { display: flex; flex-direction: column; gap: 6px; }
.ai-user { align-items: flex-end; }
.ai-bubble {
  max-width: 85%; padding: 9px 12px; border-radius: var(--radius-md);
  font-size: 13px; line-height: 1.55; white-space: pre-wrap; word-break: break-word;
  background: var(--bg-tertiary); color: var(--text-primary);
  border: 1px solid var(--border);
}
.ai-user .ai-bubble { background: var(--accent); border-color: transparent; color: white; }

.ai-steps { display: flex; flex-direction: column; gap: 3px; max-width: 95%; }
.ai-step {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--success);
  background: var(--success-soft); border-radius: var(--radius-sm);
  padding: 4px 8px;
}
.ai-step.running { color: var(--text-secondary); background: var(--bg-tertiary); }
.ai-step.destructive { color: var(--warning); background: var(--warning-soft); }
.ai-step.failed { color: var(--danger); background: var(--danger-soft); }
.ai-step code { font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.ai-step-error { color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ai-step-spin {
  width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
  border: 2px solid var(--border-light); border-top-color: var(--accent);
  animation: ai-spin 0.7s linear infinite;
}
@keyframes ai-spin { to { transform: rotate(360deg); } }

.ai-files, .ai-pending-files { display: flex; flex-wrap: wrap; gap: 5px; }
.ai-file-chip {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; color: var(--text-secondary);
  background: var(--bg-tertiary); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 3px 7px; max-width: 100%;
}
.ai-file-remove {
  background: none; border: none; color: var(--text-muted); cursor: pointer;
  font-size: 14px; line-height: 1; padding: 0 0 0 2px;
}
.ai-file-remove:hover { color: var(--danger); }

.ai-downloads { display: flex; flex-direction: column; gap: 4px; max-width: 95%; }
.ai-download {
  display: flex; align-items: center; gap: 8px; text-align: left; cursor: pointer;
  font-size: 12px; color: var(--text-primary);
  background: var(--bg-tertiary); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 7px 10px;
  transition: background var(--transition), border-color var(--transition);
}
.ai-download:hover { background: var(--bg-hover); border-color: var(--accent); }
.ai-download-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ai-download-size { color: var(--text-muted); font-size: 11px; flex-shrink: 0; }

.ai-approval {
  display: flex; flex-direction: column; gap: 6px; max-width: 95%;
  background: var(--warning-soft); border: 1px solid var(--warning);
  border-radius: var(--radius); padding: 10px 12px;
}
.ai-approval-head { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--warning); }
.ai-approval-tool { font-size: 11.5px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--text-primary); }
.ai-approval-impact { font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.5; }
.ai-approval-actions { display: flex; justify-content: flex-end; gap: 6px; }

.ai-task {
  display: flex; flex-direction: column; gap: 5px;
  background: var(--bg-tertiary); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 10px 12px;
}
.ai-task.off { opacity: 0.6; }
.ai-task-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; font-size: 13px; }
.ai-task-interval { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.ai-task-prompt { font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.5; }
.ai-task-meta { font-size: 11px; color: var(--text-muted); margin: 0; }
.ai-task-meta.failed { color: var(--danger); }
.ai-task-result {
  font-size: 11.5px; color: var(--text-secondary); margin: 0;
  max-height: 60px; overflow: hidden; line-height: 1.45;
}
.ai-task-actions { display: flex; justify-content: flex-end; gap: 4px; }
.ai-danger { color: var(--danger); }

.ai-author { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-muted); }
.ai-author-state { color: var(--accent-hover); }
.ai-author-state::after { content: ''; }
.ai-caret {
  display: inline-block; width: 7px; height: 13px; margin-left: 2px;
  vertical-align: text-bottom; background: var(--accent);
  animation: ai-caret-blink 1s steps(1) infinite;
}
@keyframes ai-caret-blink { 0%, 50% { opacity: 1; } 50.01%, 100% { opacity: 0; } }

.ai-typing { display: flex; gap: 4px; align-items: center; }
.ai-typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); animation: ai-blink 1.2s infinite; }
.ai-typing span:nth-child(2) { animation-delay: 0.2s; }
.ai-typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes ai-blink { 0%, 60%, 100% { opacity: 0.25; } 30% { opacity: 1; } }

.ai-footer { display: flex; gap: 6px; padding: 12px; border-top: 1px solid var(--border); align-items: flex-end; }
.ai-composer { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.ai-input { width: 100%; resize: none; max-height: 120px; font-family: inherit; }

@media (max-width: 640px) {
  .ai-panel { right: 8px; left: 8px; bottom: 76px; width: auto; height: calc(100vh - 150px); }
  .ai-launcher { right: 14px; bottom: 14px; }
}
</style>
