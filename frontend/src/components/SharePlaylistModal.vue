<template>
  <EditorFeatureModal :title="t('share.title')" @close="$emit('close')">
    <p class="feature-description">{{ t('share.optionsInstruction') }}</p>
    <div class="form-group">
      <label for="share-expiry">{{ t('share.expiresInDays') }}</label>
      <input id="share-expiry" v-model.number="expiresInDays" class="input" type="number" min="1" max="365" :placeholder="t('share.noExpiry')" />
    </div>
    <div class="form-group">
      <label for="share-password">{{ t('share.password') }}</label>
      <input id="share-password" v-model="password" class="input" type="password" minlength="10" maxlength="128" :placeholder="t('share.passwordPlaceholder')" autocomplete="new-password" />
      <span class="field-hint">{{ t('share.passwordHint') }}</span>
    </div>

    <div v-if="shareUrl" class="link-list">
      <div class="link-group">
        <label for="share-m3u-url">{{ t('share.m3uUrl') }}</label>
        <div class="link-row">
          <input id="share-m3u-url" class="input" :value="shareUrl" readonly @click="$event.target.select()" />
          <button class="btn btn-secondary btn-sm" type="button" @click="copyLink(shareUrl)">{{ t('common.copy') }}</button>
        </div>
      </div>
      <div v-if="xmltvUrl" class="link-group">
        <label for="share-xmltv-url">{{ t('share.xmltvUrl') }}</label>
        <div class="link-row">
          <input id="share-xmltv-url" class="input" :value="xmltvUrl" readonly @click="$event.target.select()" />
          <button class="btn btn-secondary btn-sm" type="button" @click="copyLink(xmltvUrl)">{{ t('common.copy') }}</button>
        </div>
      </div>
      <p class="feature-hint">{{ t('share.instruction') }}</p>
    </div>

    <template #actions>
      <button class="btn btn-secondary" type="button" :disabled="generating" @click="$emit('close')">{{ t('common.close') }}</button>
      <button class="btn btn-primary" type="button" :disabled="!isValid || generating" @click="createShare">
        <span v-if="generating" class="spinner spinner-sm"></span>
        {{ generating ? t('share.generating') : t('share.createLink') }}
      </button>
    </template>
  </EditorFeatureModal>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import api from '../api'
import { useI18n } from '../langs/useI18n'
import EditorFeatureModal from './EditorFeatureModal.vue'

const props = defineProps({ playlistId: { type: String, required: true } })
defineEmits(['close'])
const toast = inject('toast')
const { t } = useI18n()

const expiresInDays = ref('')
const password = ref('')
const generating = ref(false)
const shareUrl = ref('')
const xmltvUrl = ref('')
const isValid = computed(() => {
  const expiryValid = expiresInDays.value === '' || (Number.isInteger(expiresInDays.value) && expiresInDays.value >= 1 && expiresInDays.value <= 365)
  const passwordValid = !password.value || (password.value.length >= 10 && password.value.length <= 128)
  return expiryValid && passwordValid
})

function absoluteUrl(path) {
  return new URL(path, window.location.origin).href
}

async function createShare() {
  const body = {}
  if (expiresInDays.value !== '') body.expiresInDays = expiresInDays.value
  if (password.value) body.password = password.value

  generating.value = true
  try {
    const { data } = await api.post(`/playlists/${props.playlistId}/share`, body)
    shareUrl.value = absoluteUrl(data.url || `/api/shared/${data.token}`)
    xmltvUrl.value = data.xmltvUrl ? absoluteUrl(data.xmltvUrl) : ''
  } catch (error) {
    toast(error.response?.data?.error?.message || t('toast.shareError'), 'error')
  } finally {
    generating.value = false
  }
}

async function copyLink(value) {
  try {
    await navigator.clipboard.writeText(value)
    toast(t('toast.copied'), 'success')
  } catch {
    toast(t('common.error'), 'error')
  }
}
</script>

<style scoped>
.feature-description, .feature-hint, .field-hint { color: var(--text-muted); font-size: 12px; line-height: 1.5; }
.feature-description { margin: 0 0 16px; }
.feature-hint { margin: 10px 0 0; }
.form-group { margin-bottom: 14px; }
.form-group label, .link-group label { display: block; margin-bottom: 5px; color: var(--text-muted); font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
.field-hint { display: block; margin-top: 5px; }
.link-list { display: flex; flex-direction: column; gap: 14px; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--border); }
.link-row { display: flex; gap: 8px; }
.link-row .input { min-width: 0; }
@media (max-width: 520px) { .link-row { align-items: stretch; flex-direction: column; } }
</style>
