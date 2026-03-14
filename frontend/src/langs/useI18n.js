import { ref, reactive } from 'vue'
import config from './config.json'
import trData from './tr.json'
import enData from './en.json'

const translations = { tr: trData, en: enData }

const STORAGE_KEY = 'app_lang'

// Reactive global state (shared across all components)
const currentLang = ref(localStorage.getItem(STORAGE_KEY) || config.defaultLang)
const currentTranslations = reactive({ data: translations[currentLang.value] || translations[config.defaultLang] })

/**
 * Get nested value from object by dot notation key
 * e.g. resolve('common.save', { common: { save: 'Kaydet' } }) → 'Kaydet'
 */
function resolve(key, obj) {
  return key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj)
}

/**
 * Replace {placeholder} tokens in a string
 * e.g. interpolate('Hello {name}', { name: 'World' }) → 'Hello World'
 */
function interpolate(str, params) {
  if (!params || typeof str !== 'string') return str
  return str.replace(/\{(\w+)\}/g, (_, key) => (params[key] !== undefined ? params[key] : `{${key}}`))
}

export function useI18n() {
  /**
   * Translate a key with optional parameters
   * @param {string} key - Dot notation key (e.g. 'common.save')
   * @param {object} [params] - Interpolation params (e.g. { count: 5 })
   * @returns {string} Translated string or key as fallback
   */
  function t(key, params) {
    const value = resolve(key, currentTranslations.data)
    if (value === undefined) return key
    return interpolate(value, params)
  }

  /**
   * Change the active language
   * @param {string} code - Language code (e.g. 'en', 'tr')
   */
  function setLang(code) {
    if (!translations[code]) return
    currentLang.value = code
    currentTranslations.data = translations[code]
    localStorage.setItem(STORAGE_KEY, code)
  }

  return {
    t,
    lang: currentLang,
    setLang,
    langs: config.languages
  }
}
