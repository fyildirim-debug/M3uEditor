import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from './stores/auth'

const routes = [
  { path: '/', component: () => import('./views/Landing.vue') },
  { path: '/login', component: () => import('./views/Login.vue'), meta: { guest: true } },
  { path: '/forgot-password', component: () => import('./views/ForgotPassword.vue'), meta: { guest: true } },
  { path: '/reset-password', component: () => import('./views/ResetPassword.vue'), meta: { guest: true } },
  { path: '/terms', component: () => import('./views/Terms.vue') },
  { path: '/privacy', component: () => import('./views/Privacy.vue') },
  { path: '/dashboard', component: () => import('./views/Dashboard.vue'), meta: { auth: true } },
  { path: '/playlist/:id', component: () => import('./views/Editor.vue'), meta: { auth: true } },
  { path: '/account', component: () => import('./views/Account.vue'), meta: { auth: true } },
  { path: '/admin', component: () => import('./views/Admin.vue'), meta: { auth: true, admin: true } },
  { path: '/:pathMatch(.*)*', component: () => import('./views/NotFound.vue') },
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

router.afterEach((to) => {
  const title = to.path === '/' ? 'M3U Editor' : `${to.path.split('/')[1] || 'M3U Editor'} · M3U Editor`
  document.title = title.charAt(0).toUpperCase() + title.slice(1)
  window.scrollTo({ top: 0, behavior: 'instant' })
})

export default router
