import { createApp } from 'vue'
import App from './App.vue'
import { bridge } from './bridge/EventBridge'

declare global {
  interface ImportMeta {
    readonly env: { readonly DEV: boolean }
  }
}

if (import.meta.env.DEV) {
  // E2E 測試用：讓 Playwright 能直接觸發 bridge 事件
  ;(window as unknown as { __bridge: typeof bridge }).__bridge = bridge
}

createApp(App).mount('#app')
