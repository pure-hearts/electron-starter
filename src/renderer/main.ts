import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "element-plus/theme-chalk/dark/css-vars.css";
import "./styles/index.css";
import App from "./App.vue";
import router from "./router";
import { i18n } from "./i18n";
const app = createApp(App);
app.config.errorHandler = (error, _instance, info) => {
  console.error("Vue error", info, error);
  void window.$ipcBridge?.invoke("log:write", "error", String(error)).catch(() => undefined);
};
window.addEventListener("unhandledrejection", (e) => {
  void window.$ipcBridge?.invoke("log:write", "error", String(e.reason)).catch(() => undefined);
});
app.use(createPinia()).use(router).use(i18n).use(ElementPlus).mount("#app");
// A healthy render includes a mounted app and a resolved route. Confirming after
// a brief settling period preserves rollback when the new renderer crashes early.
void router
  .isReady()
  .then(() => {
    window.setTimeout(() => {
      if (document.querySelector("#app")?.childElementCount) {
        void window.$ipcBridge.invoke("hot:confirm").catch(() => undefined);
      }
    }, 2500);
  })
  .catch(() => undefined);
