import { defineStore } from 'pinia'
import { ref } from 'vue'
export const useAppStore = defineStore('app', () => {
  const locale = ref(localStorage.getItem('locale') || 'zh-CN')
  const theme = ref('light')
  const lastDeepLink = ref('')
  function receiveDeepLink(url: string): void { lastDeepLink.value = url }
  function setLocale(value: string) {
    if (value !== 'zh-CN' && value !== 'en-US') return
    locale.value = value
    localStorage.setItem('locale', value)
    void window.desktop.invoke('store:set', 'locale', value)
  }
  async function hydrate() {
    const saved = await window.desktop.invoke('store:get', 'locale')
    if (saved === 'zh-CN' || saved === 'en-US') {
      locale.value = saved
      localStorage.setItem('locale', saved)
      return saved
    }
    return locale.value
  }
  return { locale, theme, lastDeepLink, receiveDeepLink, setLocale, hydrate }
})
