import { defineConfig, presetWind3 } from "unocss";

export default defineConfig({
  presets: [presetWind3()],
  rules: [
    ["drag", { "-webkit-app-region": "drag" }],
    ["no-drag", { "-webkit-app-region": "no-drag" }],
  ],
  theme: {
    colors: {
      app: {
        bg: {
          page: "var(--app-bg-page)",
          surface: "var(--app-bg-surface)",
          subtle: "var(--app-bg-subtle)",
          muted: "var(--app-bg-muted)",
          hover: "var(--app-bg-hover)",
        },
        border: {
          DEFAULT: "var(--app-border)",
          subtle: "var(--app-border-subtle)",
          focus: "var(--app-border-focus)",
        },
        text: {
          primary: "var(--app-text-primary)",
          regular: "var(--app-text-regular)",
          secondary: "var(--app-text-secondary)",
          muted: "var(--app-text-muted)",
        },
        primary: {
          DEFAULT: "var(--app-primary)",
          hover: "var(--app-primary-hover)",
        },
        danger: "var(--app-danger)",
        success: "var(--app-success)",
        warning: "var(--app-warning)",
      },
    },
  },
});
