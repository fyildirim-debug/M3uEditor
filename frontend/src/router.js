import { createRouter, createWebHashHistory } from 'vue-router'
import { watch } from 'vue'
import { useAuthStore } from './stores/auth'
import { useI18n } from './langs/useI18n'

const routes = [
  { path: '/', component: () => import('./views/Landing.vue') },
  { path: '/login', component: () => import('./views/Login.vue'), meta: { guest: true, titleKey: 'auth.login' } },
  { path: '/forgot-password', component: () => import('./views/ForgotPassword.vue'), meta: { guest: true, titleKey: 'forgotPw.title' } },
  { path: '/reset-password', component: () => import('./views/ResetPassword.vue'), meta: { guest: true, titleKey: 'resetPw.title' } },
  { path: '/terms', component: () => import('./views/Terms.vue'), meta: { titleKey: 'legal.termsTitle' } },
  { path: '/privacy', component: () => import('./views/Privacy.vue'), meta: { titleKey: 'legal.privacyTitle' } },
  { path: '/dashboard', component: () => import('./views/Dashboard.vue'), meta: { auth: true, titleKey: 'dashboard.title' } },
  { path: '/playlist/:id', component: () => import('./views/Editor.vue'), meta: { auth: true, titleKey: 'pageTitles.editor' } },
  { path: '/account', component: () => import('./views/Account.vue'), meta: { auth: true, titleKey: 'account.title' } },
  { path: '/admin', component: () => import('./views/Admin.vue'), meta: { auth: true, admin: true, titleKey: 'admin.title' } },
  { path: '/:pathMatch(.*)*', component: () => import('./views/NotFound.vue'), meta: { titleKey: 'notFound.title' } },
]

const router = createRouter({ history: createWebHashHistory(), routes })

router.beforeEach(async (to) => {
  const token = sessionStorage.getItem('token')
  if (to.meta.auth && !token) return { path: '/login', query: { redirect: to.fullPath } }
  if (to.meta.admin && token) {
    const auth = useAuthStore()
    try { await auth.getProfile() } catch {}
    if (!sessionStorage.getItem('token')) return { path: '/login', query: { redirect: to.fullPath } }
    if (!auth.user?.is_admin) return '/dashboard'
  }
  if (to.meta.guest && token) return '/dashboard'
})

const APP_NAME = 'M3U Editor'
const { t, lang } = useI18n()

function applyTitle(route) {
  const key = route.meta?.titleKey
  document.title = key ? `${t(key)} · ${APP_NAME}` : APP_NAME
}

router.afterEach((to) => {
  applyTitle(to)
  window.scrollTo({ top: 0, behavior: 'instant' })
})

// Dil degisince acik sayfanin basligi da cevrilir.
watch(lang, () => applyTitle(router.currentRoute.value))

export default router
