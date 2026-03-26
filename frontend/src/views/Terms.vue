<template>
  <div class="legal-page">
    <div class="legal-container">
      <h1>{{ t('legal.termsTitle') }}</h1>
      <p class="legal-date">{{ t('legal.lastUpdated') }}</p>

      <section>
        <h2>1. Genel Kosullar</h2>
        <p>Bu web sitesine erisim saglayarak ve hizmetlerimizi kullanarak, asagida belirtilen kullanim sartlarini kabul etmis sayilirsiniz. Bu sartlari kabul etmiyorsaniz, hizmetlerimizi kullanmayiniz.</p>
      </section>

      <section>
        <h2>2. Hizmet Tanimi</h2>
        <p>M3U Editor, IPTV playlist yonetimi icin web tabanli bir arac sunmaktadir. Kullanicilar M3U dosyalarini duzenleyebilir, Xtream Codes entegrasyonu yapabilir, EPG verileri ile calisabilir ve playlistlerini paylasabilir.</p>
      </section>

      <section>
        <h2>3. Kullanici Sorumlulugu</h2>
        <p>Kullanicilar, platformu yasalara uygun sekilde kullanmakla yukumludur. Telif hakki ihlali iceren iceriklerin yuklenmesi, paylasimi veya dagitimi kesinlikle yasaktir. Hesabinizin guvenligi sizin sorumluluginizdadir.</p>
      </section>

      <section>
        <h2>4. Icerik ve Sorumluluk Reddi</h2>
        <p>M3U Editor, kullanicilarin yukledigi iceriklerden sorumlu degildir. Platform yalnizca bir duzenleme araci sunar; iceriklerin yasalligi kullanicinin sorumlulugundadir.</p>
      </section>

      <section>
        <h2>5. Hesap Feshi</h2>
        <p>Kullanim sartlarini ihlal eden hesaplar onceden bildirilmeksizin askiya alinabilir veya kalici olarak kapatilabilir. Hesabinizi istediginiz zaman kendiniz de silebilirsiniz.</p>
      </section>

      <section>
        <h2>6. Degisiklikler</h2>
        <p>Bu kullanim sartlari onceden bildirilmeksizin guncellenebilir. Guncel versiyonu duzenli olarak kontrol etmeniz oneriliyor.</p>
      </section>

      <div class="legal-back">
        <router-link to="/" class="btn btn-ghost">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Ana Sayfa
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '../langs/useI18n'

const { t } = useI18n()
</script>

<style scoped>
.legal-page {
  min-height: 100vh;
  padding: 80px 24px 60px;
  animation: fadeIn 0.4s ease;
}

.legal-container {
  max-width: 720px;
  margin: 0 auto;
}

.legal-container h1 {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.5px;
  margin-bottom: 6px;
  color: var(--text-primary);
}

.legal-date {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 40px;
}

.legal-container section {
  margin-bottom: 28px;
}

.legal-container h2 {
  font-size: 16px;
  font-weight: 650;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.legal-container p {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.75;
}

.legal-back {
  margin-top: 40px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}
</style>
