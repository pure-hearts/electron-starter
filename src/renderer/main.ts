import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './styles/index.scss'
import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
const app = createApp(App)
app.config.errorHandler = (error, _instance, info) => {
  console.error('Vue error', info, error)
  void window.desktop?.invoke('log:write', 'error', String(error)).catch(() => undefined)
}
window.addEventListener('unhandledrejection', e => {
  void window.desktop?.invoke('log:write', 'error', String(e.reason)).catch(() => undefined)
})
app.use(createPinia()).use(router).use(i18n).use(ElementPlus).mount('#app')
