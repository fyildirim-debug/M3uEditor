import { createRouter, createWebHashHistory } from 'vue-router'
import Landing from './views/Landing.vue'
import Login from './views/Login.vue'
import Dashboard from './views/Dashboard.vue'
import Editor from './views/Editor.vue'
import Account from './views/Account.vue'
import ForgotPassword from './views/ForgotPassword.vue'
import ResetPassword from './views/ResetPassword.vue'
import Terms from './views/Terms.vue'
import Privacy from './views/Privacy.vue'
import NotFound from './views/NotFound.vue'

const routes = [
  { path: '/', component: Landing },
  { path: '/login', component: Login },
  { path: '/forgot-password', component: ForgotPassword },
  { path: '/reset-password', component: ResetPassword },
  { path: '/terms', component: Terms },
  { path: '/privacy', component: Privacy },
  { path: '/dashboard', component: Dashboard, meta: { auth: true } },
  { path: '/playlist/:id', component: Editor, meta: { auth: true } },
  { path: '/account', component: Account, meta: { auth: true } },
  { path: '/:pathMatch(.*)*', component: NotFound },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to) => {
  if (to.meta.auth && !localStorage.getItem('token')) {
    return '/login'
  }
})

export default router
