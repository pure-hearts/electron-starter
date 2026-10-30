import { createApp } from "vue";
import { createPinia } from "pinia";
import "./styles/index.css";
import App from "./App.vue";
import router from "./router";
import { i18n } from "./i18n";
import { initBridge } from "./bridge";
import { registerElectronDirectives } from "./directives/electron";

// 初始化跨端 Bridge，Web 模式下自动装载垫片，保证 window.$ipcBridge 安全就绪
const bridge = initBridge();

const app = createApp(App);
registerElectronDirectives(app);

app.config.errorHandler = (error, _instance, info) => {
  console.error("Vue error", info, error);
  void bridge.invoke("log:write", "error", String(error)).catch(() => undefined);
};
window.addEventListener("unhandledrejection", (e) => {
  void bridge.invoke("log:write", "error", String(e.reason)).catch(() => undefined);
});
app.use(createPinia()).use(router).use(i18n).mount("#app");
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
