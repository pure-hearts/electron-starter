import { defineStore } from 'pinia'
import { ref } from 'vue'
export const useAppStore = defineStore('app', () => {
  const locale = ref(localStorage.getItem('locale') || 'zh-CN')
  const theme = ref('light')
  function setLocale(value: string) {
    locale.value = value
    localStorage.setItem('locale', value)
    void window.desktop.invoke('store:set', 'locale', value)
  }
  async function hydrate() {
    const saved = await window.desktop.invoke('store:get', 'locale')
    if (typeof saved === 'string') setLocale(saved)
  }
  return { locale, theme, setLocale, hydrate }
})
