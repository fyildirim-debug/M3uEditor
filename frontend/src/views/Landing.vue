<template>
  <div class="landing" ref="landingRef">
    <!-- Hero Section -->
    <section class="hero">
      <div class="hero-orb hero-orb--1"></div>
      <div class="hero-orb hero-orb--2"></div>
      <div class="hero-orb hero-orb--3"></div>
      <div class="hero-noise"></div>

      <div class="hero-content">
        <div class="hero-badge">
          <span class="hero-badge__dot"></span>
          <span>IPTV Playlist Manager</span>
        </div>

        <h1 class="hero-title">{{ t('landing.heroTitle') }}</h1>
        <p class="hero-subtitle">{{ t('landing.heroSubtitle') }}</p>

        <div class="hero-actions">
          <router-link v-if="auth.isLoggedIn" to="/dashboard" class="btn-cta btn-cta--primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
            Dashboard
          </router-link>
          <router-link v-else to="/login" class="btn-cta btn-cta--primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            {{ t('landing.ctaStart') }}
          </router-link>
          <router-link to="/pricing" class="btn-cta btn-cta--secondary">
            {{ t('landing.ctaPlans') }}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </router-link>
        </div>

        <div class="hero-stats" ref="statsRef">
          <div class="hero-stat">
            <span class="hero-stat__num">{{ animatedStats.channels.toLocaleString() }}+</span>
            <span class="hero-stat__label">Kanal</span>
          </div>
          <div class="hero-stat__sep"></div>
          <div class="hero-stat">
            <span class="hero-stat__num">{{ animatedStats.countries }}+</span>
            <span class="hero-stat__label">Ulke</span>
          </div>
          <div class="hero-stat__sep"></div>
          <div class="hero-stat">
            <span class="hero-stat__num">{{ animatedStats.uptime }}%</span>
            <span class="hero-stat__label">Uptime</span>
          </div>
        </div>

        <!-- Editor mockup -->
        <div class="mockup">
          <div class="mockup__bar">
            <span class="mockup__dot mockup__dot--red"></span>
            <span class="mockup__dot mockup__dot--yellow"></span>
            <span class="mockup__dot mockup__dot--green"></span>
          </div>
          <div class="mockup__body">
            <div class="mockup__sidebar">
              <div class="mockup__sidebar-item mockup__sidebar-item--active"></div>
              <div class="mockup__sidebar-item"></div>
              <div class="mockup__sidebar-item"></div>
              <div class="mockup__sidebar-item"></div>
              <div class="mockup__sidebar-item"></div>
            </div>
            <div class="mockup__content">
              <div class="mockup__line mockup__line--w70"></div>
              <div class="mockup__line mockup__line--w90"></div>
              <div class="mockup__line mockup__line--w50"></div>
              <div class="mockup__line mockup__line--w80"></div>
              <div class="mockup__line mockup__line--w60"></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Trusted By -->
    <section class="trusted">
      <div class="section-wrap">
        <p class="trusted__text">Binlerce kullanici tarafindan tercih ediliyor</p>
        <div class="trusted__logos">
          <div class="trusted__logo"><div class="trusted__shape trusted__shape--circle"></div></div>
          <div class="trusted__logo"><div class="trusted__shape trusted__shape--diamond"></div></div>
          <div class="trusted__logo"><div class="trusted__shape trusted__shape--hexagon"></div></div>
          <div class="trusted__logo"><div class="trusted__shape trusted__shape--square"></div></div>
          <div class="trusted__logo"><div class="trusted__shape trusted__shape--triangle"></div></div>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section class="features" id="features">
      <div class="section-wrap">
        <div class="features__grid">
          <div v-for="(feat, i) in features" :key="feat.key" class="feat-card anim-item" :style="{ animationDelay: (i * 0.1) + 's' }">
            <div class="feat-card__icon" :class="'feat-card__icon--' + feat.color">
              <component :is="feat.icon" />
            </div>
            <div class="feat-card__text">
              <h3>{{ t('landing.' + feat.key) }}</h3>
              <p>{{ t('landing.' + feat.key + 'Desc') }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- How It Works -->
    <section class="how">
      <div class="section-wrap">
        <h2 class="section-heading">{{ t('landing.howTitle') }}</h2>
        <div class="how__steps">
          <div class="how__step anim-item" v-for="n in 3" :key="n" :style="{ animationDelay: (n * 0.15) + 's' }">
            <span class="how__num">{{ n }}</span>
            <h3>{{ t('landing.step' + n) }}</h3>
            <p>{{ t('landing.step' + n + 'Desc') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Testimonials -->
    <section class="reviews">
      <div class="section-wrap">
        <h2 class="section-heading">Kullanici Yorumlari</h2>
        <div class="reviews__grid">
          <div v-for="(review, i) in testimonials" :key="i" class="review-card anim-item" :style="{ animationDelay: (i * 0.12) + 's' }">
            <svg class="review-card__quote" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" opacity="0.15"><path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C9.591 11.69 11 13.166 11 15c0 1.933-1.567 3.5-3.5 3.5-1.14 0-2.18-.432-2.917-1.179zM15.583 17.321C14.553 16.227 14 15 14 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C20.591 11.69 22 13.166 22 15c0 1.933-1.567 3.5-3.5 3.5-1.14 0-2.18-.432-2.917-1.179z"/></svg>
            <div class="review-card__stars">
              <svg v-for="s in 5" :key="s" width="14" height="14" viewBox="0 0 24 24" fill="#fbbf24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </div>
            <p class="review-card__body">{{ review.text }}</p>
            <div class="review-card__author">
              <span class="review-card__name">{{ review.name }}</span>
              <span class="review-card__role">{{ review.role }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta-section">
      <div class="cta-section__inner">
        <h2>Hemen Basla</h2>
        <p>Playlistlerini profesyonelce yonetmeye basla.</p>
        <router-link to="/login" class="btn-cta btn-cta--primary btn-cta--lg">
          {{ t('landing.ctaStart') }}
        </router-link>
        <span class="cta-section__note">Kredi karti gerektirmez</span>
      </div>
    </section>

    <!-- Footer -->
    <footer class="landing-footer">
      <div class="section-wrap">
        <div class="footer-top">
          <div class="footer-brand">
            <div class="footer-brand__logo">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            </div>
            <span class="footer-brand__name">M3U Editor</span>
            <p class="footer-brand__desc">IPTV playlist yonetim platformu. Kanallarinizi duzenleyin, kategorize edin ve paylasin.</p>
          </div>
          <div class="footer-col">
            <h4>Urun</h4>
            <router-link to="/pricing">{{ t('landing.ctaPlans') }}</router-link>
            <a href="#features">Ozellikler</a>
          </div>
          <div class="footer-col">
            <h4>Destek</h4>
            <a href="#">Yardim</a>
            <a href="#">SSS</a>
          </div>
          <div class="footer-col">
            <h4>Yasal</h4>
            <router-link to="/terms">{{ t('legal.termsTitle') }}</router-link>
            <router-link to="/privacy">{{ t('legal.privacyTitle') }}</router-link>
          </div>
        </div>
        <div class="footer-bottom">
          <p>&copy; {{ new Date().getFullYear() }} M3U Editor. {{ t('landing.footerRights') }}</p>
          <div class="footer-socials">
            <a href="#" aria-label="GitHub">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            </a>
            <a href="#" aria-label="Twitter">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="#" aria-label="Discord">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z"/></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, h } from 'vue'
import { useI18n } from '../langs/useI18n'
import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const landingRef = ref(null)
const statsRef = ref(null)

/* --- Animated stats counter --- */
const animatedStats = reactive({ channels: 0, countries: 0, uptime: 0 })
const targetStats = { channels: 10000, countries: 50, uptime: 99.9 }
let statsAnimated = false

function animateCount(obj, key, target, duration = 1600) {
  const start = performance.now()
  const isFloat = !Number.isInteger(target)
  function tick(now) {
    const t = Math.min((now - start) / duration, 1)
    const ease = 1 - Math.pow(1 - t, 3)
    obj[key] = isFloat ? parseFloat((target * ease).toFixed(1)) : Math.round(target * ease)
    if (t < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/* --- Icon components --- */
const IconLayers = { render: () => h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [h('path', { d: 'M12 2L2 7l10 5 10-5-10-5z' }), h('path', { d: 'M2 17l10 5 10-5' }), h('path', { d: 'M2 12l10 5 10-5' })]) }
const IconFile = { render: () => h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [h('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }), h('polyline', { points: '14 2 14 8 20 8' }), h('line', { x1: 12, y1: 18, x2: 12, y2: 12 }), h('line', { x1: 9, y1: 15, x2: 15, y2: 15 })]) }
const IconTv = { render: () => h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [h('rect', { x: 2, y: 7, width: 20, height: 15, rx: 2, ry: 2 }), h('polyline', { points: '17 2 12 7 7 2' })]) }
const IconPen = { render: () => h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [h('path', { d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }), h('path', { d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' })]) }
const IconFilm = { render: () => h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [h('rect', { x: 2, y: 2, width: 20, height: 20, rx: 2.18, ry: 2.18 }), h('line', { x1: 7, y1: 2, x2: 7, y2: 22 }), h('line', { x1: 17, y1: 2, x2: 17, y2: 22 }), h('line', { x1: 2, y1: 12, x2: 22, y2: 12 })]) }
const IconShare = { render: () => h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [h('circle', { cx: 18, cy: 5, r: 3 }), h('circle', { cx: 6, cy: 12, r: 3 }), h('circle', { cx: 18, cy: 19, r: 3 }), h('line', { x1: 8.59, y1: 13.51, x2: 15.42, y2: 17.49 }), h('line', { x1: 15.41, y1: 6.51, x2: 8.59, y2: 10.49 })]) }

const features = [
  { key: 'featXtream', color: 'indigo', icon: IconLayers },
  { key: 'featM3u', color: 'purple', icon: IconFile },
  { key: 'featEpg', color: 'blue', icon: IconTv },
  { key: 'featBulk', color: 'emerald', icon: IconPen },
  { key: 'featVod', color: 'amber', icon: IconFilm },
  { key: 'featShare', color: 'rose', icon: IconShare },
]

const testimonials = [
  { name: 'Ahmet Yilmaz', role: 'IPTV Saglayici', text: 'M3U Editor ile 5000+ kanalimi dakikalar icinde duzenleyebiliyorum. Xtream entegrasyonu mukemmel calisiyor, topluca kategori ve siralama yapabilmek cok buyuk kolaylik.' },
  { name: 'Elif Kaya', role: 'Teknoloji Blogcusu', text: 'EPG eslestirme ozelligi harika. Artik tum kanallarina program rehberi eklemek saniyeler suruyor. Arayuzu cok temiz ve kullanimi kolay, kesinlikle tavsiye ederim.' },
  { name: 'Burak Demir', role: 'Sistem Yoneticisi', text: 'Paylasim linkleri ile musterilerime ozel listeler olusturuyorum. Sifreli ve sureli link destegiyle guvenlik konusunda da rahatim. Profesyonel bir arac.' },
]

/* --- Intersection Observer for scroll animations --- */
let observer = null

onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('anim-visible')
        // Stats counter
        if (entry.target === statsRef.value && !statsAnimated) {
          statsAnimated = true
          animateCount(animatedStats, 'channels', targetStats.channels)
          animateCount(animatedStats, 'countries', targetStats.countries)
          animateCount(animatedStats, 'uptime', targetStats.uptime)
        }
      }
    })
  }, { threshold: 0.15 })

  if (landingRef.value) {
    landingRef.value.querySelectorAll('.anim-item').forEach(el => observer.observe(el))
    if (statsRef.value) observer.observe(statsRef.value)
  }
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})
</script>

<style scoped>
/* ========================================
   LANDING PAGE — PREMIUM DARK SAAS
   ======================================== */

.landing {
  min-height: 100vh;
  overflow-x: hidden;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.section-wrap {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 24px;
}

.section-heading {
  text-align: center;
  font-size: clamp(24px, 3.5vw, 36px);
  font-weight: 800;
  letter-spacing: -1px;
  margin-bottom: 56px;
  color: var(--text-primary);
}

/* ── HERO ─────────────────────────────── */
.hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 100px 24px 60px;
  text-align: center;
  overflow: hidden;
}

.hero-noise {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
  background-repeat: repeat;
  pointer-events: none;
  z-index: 0;
}

.hero-orb {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(100px);
  z-index: 0;
}

.hero-orb--1 {
  width: 700px;
  height: 700px;
  top: -250px;
  left: 50%;
  transform: translateX(-50%);
  background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%);
  animation: orbFloat1 8s ease-in-out infinite;
}

.hero-orb--2 {
  width: 500px;
  height: 500px;
  bottom: -150px;
  right: -100px;
  background: radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%);
  animation: orbFloat2 10s ease-in-out infinite;
}

.hero-orb--3 {
  width: 400px;
  height: 400px;
  top: 30%;
  left: -100px;
  background: radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%);
  animation: orbFloat3 12s ease-in-out infinite;
}

@keyframes orbFloat1 {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(30px); }
}
@keyframes orbFloat2 {
  0%, 100% { transform: translateY(0) translateX(0); }
  50% { transform: translateY(-40px) translateX(-20px); }
}
@keyframes orbFloat3 {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(25px); }
}

.hero-content {
  position: relative;
  z-index: 1;
  max-width: 760px;
  animation: heroFadeIn 0.8s ease both;
}

@keyframes heroFadeIn {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 7px 18px;
  background: var(--accent-soft);
  border: 1px solid rgba(99,102,241,0.2);
  border-radius: 100px;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-hover);
  margin-bottom: 32px;
}

.hero-badge__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulseDot 2s ease-in-out infinite;
}

@keyframes pulseDot {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.5); }
  50% { box-shadow: 0 0 0 6px rgba(99,102,241,0); }
}

.hero-title {
  font-size: clamp(36px, 5.5vw, 60px);
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: -1.5px;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #ffffff 0%, #c7c8ff 50%, var(--accent-hover) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: clamp(15px, 2vw, 18px);
  color: var(--text-secondary);
  line-height: 1.7;
  max-width: 560px;
  margin: 0 auto 40px;
}

.hero-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
}

/* CTA Buttons */
.btn-cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 28px;
  font-size: 15px;
  font-weight: 600;
  border-radius: var(--radius-md);
  text-decoration: none;
  transition: transform var(--transition), opacity var(--transition), box-shadow var(--transition);
  cursor: pointer;
  border: none;
}

.btn-cta--primary {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 4px 20px rgba(99,102,241,0.3);
}

.btn-cta--primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(99,102,241,0.45);
}

.btn-cta--secondary {
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
}

.btn-cta--secondary:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
}

.btn-cta--lg {
  padding: 16px 36px;
  font-size: 16px;
}

/* Stats */
.hero-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  margin-top: 56px;
  padding-top: 32px;
  border-top: 1px solid var(--border);
}

.hero-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.hero-stat__num {
  font-size: 24px;
  font-weight: 800;
  color: var(--accent-hover);
  letter-spacing: -0.5px;
  font-variant-numeric: tabular-nums;
}

.hero-stat__label {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.hero-stat__sep {
  width: 1px;
  height: 36px;
  background: var(--border-light);
}

/* Mockup */
.mockup {
  margin-top: 56px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-light);
  background: var(--bg-card);
  overflow: hidden;
  box-shadow: var(--shadow-lg), var(--shadow-glow);
}

.mockup__bar {
  display: flex;
  gap: 7px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.mockup__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.mockup__dot--red { background: #ef4444; }
.mockup__dot--yellow { background: #f59e0b; }
.mockup__dot--green { background: #10b981; }

.mockup__body {
  display: flex;
  min-height: 180px;
}

.mockup__sidebar {
  width: 140px;
  padding: 14px 12px;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mockup__sidebar-item {
  height: 10px;
  border-radius: 4px;
  background: var(--bg-hover);
}

.mockup__sidebar-item--active {
  background: var(--accent-soft);
  border: 1px solid rgba(99,102,241,0.2);
}

.mockup__content {
  flex: 1;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mockup__line {
  height: 10px;
  border-radius: 4px;
  background: var(--bg-hover);
}

.mockup__line--w90 { width: 90%; }
.mockup__line--w80 { width: 80%; }
.mockup__line--w70 { width: 70%; }
.mockup__line--w60 { width: 60%; }
.mockup__line--w50 { width: 50%; }

/* ── TRUSTED ─────────────────────────── */
.trusted {
  padding: 60px 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.trusted__text {
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 2px;
  font-weight: 500;
  margin-bottom: 32px;
}

.trusted__logos {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 48px;
  flex-wrap: wrap;
}

.trusted__logo {
  opacity: 0.25;
  transition: opacity var(--transition);
}

.trusted__logo:hover {
  opacity: 0.45;
}

.trusted__shape {
  width: 36px;
  height: 36px;
}

.trusted__shape--circle {
  border-radius: 50%;
  border: 2px solid var(--text-muted);
}

.trusted__shape--diamond {
  width: 28px;
  height: 28px;
  border: 2px solid var(--text-muted);
  transform: rotate(45deg);
}

.trusted__shape--hexagon {
  width: 32px;
  height: 32px;
  background: var(--text-muted);
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
}

.trusted__shape--square {
  width: 28px;
  height: 28px;
  border: 2px solid var(--text-muted);
  border-radius: 6px;
}

.trusted__shape--triangle {
  width: 0;
  height: 0;
  border-left: 16px solid transparent;
  border-right: 16px solid transparent;
  border-bottom: 28px solid var(--text-muted);
}

/* ── FEATURES ────────────────────────── */
.features {
  padding: 100px 0;
}

.features__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.feat-card {
  display: flex;
  gap: 16px;
  padding: 28px 24px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  transition: transform var(--transition), border-color var(--transition), box-shadow var(--transition);
}

.feat-card:hover {
  transform: translateY(-4px);
  border-color: rgba(99,102,241,0.3);
  box-shadow: var(--shadow-glow);
}

.feat-card__icon {
  width: 44px;
  height: 44px;
  min-width: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.feat-card__icon--indigo { background: rgba(99,102,241,0.12); color: #818cf8; }
.feat-card__icon--purple { background: rgba(124,58,237,0.12); color: #a78bfa; }
.feat-card__icon--blue { background: rgba(59,130,246,0.12); color: #60a5fa; }
.feat-card__icon--emerald { background: rgba(16,185,129,0.12); color: #34d399; }
.feat-card__icon--amber { background: rgba(245,158,11,0.12); color: #fbbf24; }
.feat-card__icon--rose { background: rgba(244,63,94,0.12); color: #fb7185; }

.feat-card__text h3 {
  font-size: 15px;
  font-weight: 650;
  margin-bottom: 6px;
  color: var(--text-primary);
}

.feat-card__text p {
  font-size: 13.5px;
  color: var(--text-secondary);
  line-height: 1.65;
}

/* ── HOW IT WORKS ────────────────────── */
.how {
  padding: 100px 0;
  border-top: 1px solid var(--border);
}

.how__steps {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 0;
  position: relative;
}

.how__step {
  text-align: center;
  flex: 1;
  max-width: 280px;
  position: relative;
  padding: 0 24px;
}

/* Connecting line between steps */
.how__step:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 28px;
  right: -8px;
  width: calc(100% - 80px);
  height: 2px;
  left: calc(50% + 28px);
  background: linear-gradient(90deg, var(--accent), rgba(99,102,241,0.2));
}

.how__num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  margin: 0 auto 20px;
  font-size: 24px;
  font-weight: 800;
  background: linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%);
  color: #fff;
  box-shadow: 0 4px 24px rgba(99,102,241,0.35);
}

.how__step h3 {
  font-size: 16px;
  font-weight: 650;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.how__step p {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* ── TESTIMONIALS ────────────────────── */
.reviews {
  padding: 100px 0;
  border-top: 1px solid var(--border);
}

.reviews__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.review-card {
  padding: 28px 24px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  position: relative;
  transition: transform var(--transition), border-color var(--transition);
}

.review-card:hover {
  transform: translateY(-3px);
  border-color: rgba(99,102,241,0.2);
}

.review-card__quote {
  color: var(--accent);
  margin-bottom: 12px;
}

.review-card__stars {
  display: flex;
  gap: 2px;
  margin-bottom: 16px;
}

.review-card__body {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.7;
  margin-bottom: 20px;
}

.review-card__author {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.review-card__name {
  font-size: 14px;
  font-weight: 650;
  color: var(--text-primary);
}

.review-card__role {
  font-size: 12px;
  color: var(--text-muted);
}

/* ── CTA SECTION ─────────────────────── */
.cta-section {
  padding: 100px 24px;
}

.cta-section__inner {
  max-width: 680px;
  margin: 0 auto;
  text-align: center;
  padding: 64px 40px;
  border-radius: var(--radius-2xl);
  background: linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(124,58,237,0.12) 100%);
  border: 1px solid rgba(99,102,241,0.2);
  position: relative;
  overflow: hidden;
}

.cta-section__inner::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, rgba(99,102,241,0.1) 0%, transparent 70%);
  pointer-events: none;
}

.cta-section__inner h2 {
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 800;
  letter-spacing: -1px;
  margin-bottom: 12px;
  position: relative;
}

.cta-section__inner p {
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: 32px;
  position: relative;
}

.cta-section__inner .btn-cta {
  position: relative;
}

.cta-section__note {
  display: block;
  margin-top: 16px;
  font-size: 13px;
  color: var(--text-muted);
  position: relative;
}

/* ── FOOTER ──────────────────────────── */
.landing-footer {
  border-top: 1px solid var(--border);
  padding: 60px 0 32px;
}

.footer-top {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 40px;
  margin-bottom: 40px;
}

.footer-brand {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.footer-brand__logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--accent-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-hover);
}

.footer-brand__name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.footer-brand__desc {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.6;
  max-width: 260px;
}

.footer-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.footer-col h4 {
  font-size: 13px;
  font-weight: 650;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.footer-col a {
  font-size: 13px;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color var(--transition);
}

.footer-col a:hover {
  color: var(--accent-hover);
}

.footer-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}

.footer-bottom p {
  font-size: 12px;
  color: var(--text-muted);
}

.footer-socials {
  display: flex;
  gap: 16px;
}

.footer-socials a {
  color: var(--text-muted);
  transition: color var(--transition), transform var(--transition);
}

.footer-socials a:hover {
  color: var(--accent-hover);
  transform: translateY(-1px);
}

/* ── SCROLL ANIMATIONS ───────────────── */
.anim-item {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}

.anim-item.anim-visible {
  opacity: 1;
  transform: translateY(0);
}

/* ── RESPONSIVE ──────────────────────── */
@media (max-width: 1024px) {
  .features__grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .reviews__grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .footer-top {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 768px) {
  .hero {
    min-height: auto;
    padding: 80px 20px 48px;
  }

  .features__grid,
  .reviews__grid {
    grid-template-columns: 1fr;
  }

  .feat-card {
    flex-direction: column;
    gap: 12px;
  }

  .how__steps {
    flex-direction: column;
    align-items: center;
    gap: 32px;
  }

  .how__step:not(:last-child)::after {
    display: none;
  }

  .hero-stats {
    gap: 20px;
  }

  .mockup__sidebar {
    width: 80px;
  }

  .footer-top {
    grid-template-columns: 1fr;
    gap: 28px;
  }

  .footer-bottom {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }

  .cta-section__inner {
    padding: 48px 24px;
  }
}

@media (max-width: 640px) {
  .trusted__logos {
    gap: 28px;
  }
  .hero-actions {
    flex-direction: column;
    width: 100%;
  }
  .btn-cta {
    width: 100%;
    justify-content: center;
  }
}

/* ── REDUCED MOTION ──────────────────── */
@media (prefers-reduced-motion: reduce) {
  .hero-orb--1,
  .hero-orb--2,
  .hero-orb--3,
  .hero-badge__dot {
    animation: none;
  }
  .hero-content {
    animation: none;
  }
  .anim-item {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
</style>
