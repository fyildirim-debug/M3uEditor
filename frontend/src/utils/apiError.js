import { useI18n } from '../langs/useI18n'

// Sunucu hata mesajlari Turkce yazilir. Turkce arayuzde sunucunun ozgul mesaji
// ("Bu akis adresi zaten kayitli" gibi) genel ceviriden daha bilgilendiricidir;
// diger dillerde ham Turkce metin yerine hata koduna karsilik gelen ceviri gosterilir.
const SERVER_MESSAGE_LANG = 'tr'

function hasKey(t, key) {
  const value = t(key)
  return typeof value === 'string' && value !== key
}

/** Sunucu yanitindaki hata kodunu dondurur (ornek: 'VALIDATION_ERROR'). */
export function apiErrorCode(error) {
  const data = error?.response?.data
  return data?.error?.code || data?.code || ''
}

/**
 * Bir API hatasini kullaniciya gosterilecek metne cevirir.
 * Sira: (TR arayuzde) sunucu mesaji -> `errors.<KOD>` cevirisi -> sunucu mesaji
 * -> ag/zaman asimi cevirisi -> `fallbackKey`.
 *
 * @param {unknown} error axios hatasi
 * @param {(key: string, params?: object) => string} t i18n cevirici
 * @param {string} [fallbackKey] hic bilgi yoksa kullanilacak anahtar
 */
export function apiErrorMessage(error, t, fallbackKey = 'toast.genericError') {
  const data = error?.response?.data
  const serverMessage = typeof data?.error?.message === 'string' ? data.error.message
    : typeof data?.message === 'string' ? data.message : ''
  const code = apiErrorCode(error)
  const { lang } = useI18n()

  if (serverMessage && lang.value === SERVER_MESSAGE_LANG) return serverMessage
  if (code && hasKey(t, `errors.${code}`)) return t(`errors.${code}`)
  if (serverMessage) return serverMessage
  if (error && !error.response) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return t('errors.TIMEOUT')
    if (error.code === 'ERR_NETWORK') return t('errors.NETWORK_ERROR')
  }
  return t(fallbackKey)
}
