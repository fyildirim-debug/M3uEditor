import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import focusTrap from './directives/focusTrap'
import { useAuthStore } from './stores/auth'
import './style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.directive('focus-trap', focusTrap)

const auth = useAuthStore(pinia)
await auth.refresh()

app.use(router)
app.mount('#app')
