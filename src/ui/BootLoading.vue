<script setup lang="ts">
defineProps<{
  progress: number
  error?: boolean
}>()
</script>

<template>
  <div class="boot-loading" data-testid="boot-loading">
    <div class="ink-bloom" aria-hidden="true" />
    <div class="wordmark" aria-label="小村閱讀 載入中">
      <span aria-hidden="true">小</span>
      <span aria-hidden="true">村</span>
      <span aria-hidden="true">閱</span>
      <span aria-hidden="true">讀</span>
    </div>
    <div
      class="boot-loading-bar"
      data-testid="boot-loading-bar"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="Math.round(progress * 100)"
    >
      <div class="boot-loading-fill" :style="{ '--progress': progress }" />
    </div>
    <p class="boot-loading-copy" data-testid="boot-loading-copy" aria-live="polite">
      <template v-if="error">場景素材載入失敗，請重新整理再試一次。</template>
      <template v-else>正在整理書架<span class="dots" aria-hidden="true">⋯⋯</span></template>
    </p>
  </div>
</template>

<style scoped>
.boot-loading {
  position: fixed;
  inset: 0;
  z-index: 100;
  overflow: hidden;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #1c1712;
  color: #f3e9d6;
}

.ink-bloom {
  position: absolute;
  inset: -30%;
  background: radial-gradient(circle, rgb(167 128 79 / 45%), transparent 48%);
  animation: ink-pulse 2.4s ease-in-out 1.1s infinite;
}

.wordmark {
  position: relative;
  display: flex;
  gap: 0.45em;
  justify-content: center;
  font-family: "LXGW WenKai TC", "Noto Serif TC", serif;
  font-size: clamp(3rem, 9vw, 6rem);
  letter-spacing: 0.15em;
  color: #f3e9d6;
}

.wordmark span {
  opacity: 0;
  transform: translateY(0.35em);
  animation: char-in 420ms ease-out forwards;
}

.wordmark span:nth-child(2) { animation-delay: 180ms; }
.wordmark span:nth-child(3) { animation-delay: 360ms; }
.wordmark span:nth-child(4) { animation-delay: 540ms; }

.boot-loading-bar {
  position: relative;
  width: 204px;
  height: 16px;
  margin-top: 56px;
  background: rgb(68 68 68 / 35%);
}

.boot-loading-fill {
  position: absolute;
  left: 2px;
  top: 2px;
  height: 12px;
  background: #d8c9a3;
  width: calc(200px * var(--progress));
  transition: width 180ms linear;
}

.boot-loading-copy {
  position: relative;
  margin: 26px 0 0;
  font-family: "LXGW WenKai TC", "Noto Serif TC", serif;
  font-size: 17px;
  letter-spacing: 0.18em;
  color: #f3e9d6;
}

.dots {
  animation: dots 1.2s steps(1) infinite;
}

@keyframes char-in {
  to { opacity: 1; transform: translateY(0); }
}

@keyframes ink-pulse {
  50% { opacity: 0.72; transform: scale(1.04); }
}

@keyframes dots {
  0%, 20% { opacity: 0; }
  40%, 100% { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .ink-bloom,
  .wordmark span { animation: none; transform: none; }
  .wordmark span { opacity: 1; }
  .dots { animation: none; }
}
</style>
