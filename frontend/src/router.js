import { createRouter, createWebHashHistory } from 'vue-router'
import Login from './views/Login.vue'
import Dashboard from './views/Dashboard.vue'
import Editor from './views/Editor.vue'
import Account from './views/Account.vue'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/login', component: Login },
  { path: '/dashboard', component: Dashboard, meta: { auth: true } },
  { path: '/playlist/:id', component: Editor, meta: { auth: true } },
  { path: '/account', component: Account, meta: { auth: true } },
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
