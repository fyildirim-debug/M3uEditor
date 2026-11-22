/**
 * Masaüstü uygulamasında mı çalışıyoruz?
 *
 * Electron ana süreci kullanıcı aracısına `M3UEditorDesktop/<sürüm>` ekler.
 * Masaüstünde tek kullanıcı vardır ve oturum ana süreç tarafından açılır;
 * giriş/çıkış, parola, e-posta, oturumlar ve kullanıcı yönetimi gösterilmez.
 * Bu yalnızca arayüzü sadeleştirir — yetki kararı hiçbir zaman buna dayanmaz.
 */
export const isDesktop = typeof navigator !== 'undefined' && /\bM3UEditorDesktop\//.test(navigator.userAgent || '')
