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
              <div v-if="message.role === 'assistant' && message.steps?.length" class="ai-steps">
                <div v-for="(step, stepIndex) in message.steps" :key="stepIndex" :class="['ai-step', { failed: !step.ok, destructive: step.destructive }]">
                  <svg v-if="step.ok" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                  <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  <code>{{ step.tool }}</code>
                  <span v-if="step.error" class="ai-step-error">{{ step.error }}</span>
                </div>
              </div>
              <div v-if="message.content" class="ai-bubble">
                <MarkdownText v-if="message.role === 'assistant'" :text="message.content" />
                <template v-else>{{ message.content }}</template>
              </div>
            </div>

            <div v-if="sending" class="ai-message ai-assistant">
              <div class="ai-bubble ai-typing"><span></span><span></span><span></span></div>
            </div>
          </template>
        </section>

        <footer v-if="view === 'chat' && settings.configured" class="ai-footer">
          <textarea
            v-model="draft"
            class="input ai-input"
            rows="1"
            :placeholder="t('ai.placeholder')"
            :disabled="sending"
            @keydown.enter.exact.prevent="send()"
          ></textarea>
          <button class="btn btn-primary btn-icon" type="button" :disabled="sending || !draft.trim()" :aria-label="t('ai.send')" @click="send()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </footer>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api'
import { useI18n } from '../langs/useI18n'
import AiSettingsForm from './AiSettingsForm.vue'
import MarkdownText from './MarkdownText.vue'

const { t } = useI18n()
const route = useRoute()

const open = ref(false)
const view = ref('chat')
const sending = ref(false)
const draft = ref('')
const scroller = ref(null)
const messages = ref([])
const conversationId = ref(null)

const settings = reactive({ configured: false, hasApiKey: false, model: null, baseUrl: '' })

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
  view.value = 'chat'
}

async function scrollToEnd() {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

async function send(preset) {
  const text = String(preset ?? draft.value).trim()
  if (!text || sending.value) return
  draft.value = ''
  messages.value.push({ role: 'user', content: text })
  sending.value = true
  scrollToEnd()

  try {
    const { data } = await api.post('/ai/chat', {
      message: text,
      conversationId: conversationId.value || undefined,
      playlistId: playlistId.value || undefined,
    })
    conversationId.value = data.conversationId
    messages.value.push({ role: 'assistant', content: data.reply, steps: data.steps || [] })
    // Veri değiştiren araçlar çalıştıysa açık ekranlar kendini tazelesin.
    if ((data.steps || []).some((step) => step.ok && !step.tool.startsWith('list_') && !step.tool.startsWith('get_') && !step.tool.startsWith('search_'))) {
      window.dispatchEvent(new CustomEvent('ai:data-changed'))
    }
  } catch (error) {
    const message = error.response?.data?.error?.message || t('ai.failed')
    messages.value.push({ role: 'assistant', content: message, steps: [] })
  } finally {
    sending.value = false
    scrollToEnd()
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
.ai-step.destructive { color: var(--warning); background: var(--warning-soft); }
.ai-step.failed { color: var(--danger); background: var(--danger-soft); }
.ai-step code { font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.ai-step-error { color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.ai-typing { display: flex; gap: 4px; align-items: center; }
.ai-typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); animation: ai-blink 1.2s infinite; }
.ai-typing span:nth-child(2) { animation-delay: 0.2s; }
.ai-typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes ai-blink { 0%, 60%, 100% { opacity: 0.25; } 30% { opacity: 1; } }

.ai-footer { display: flex; gap: 8px; padding: 12px; border-top: 1px solid var(--border); align-items: flex-end; }
.ai-input { flex: 1; resize: none; max-height: 120px; font-family: inherit; }

@media (max-width: 640px) {
  .ai-panel { right: 8px; left: 8px; bottom: 76px; width: auto; height: calc(100vh - 150px); }
  .ai-launcher { right: 14px; bottom: 14px; }
}
</style>
