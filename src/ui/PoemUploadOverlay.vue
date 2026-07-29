<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{ close: [] }>()
const poemUploadUrl = 'https://paiwh-poem-display.hf.space/'
const isFrameLoading = ref(true)

function handleFrameLoad() {
  isFrameLoading.value = false
}
</script>

<template>
  <section class="overlay" data-testid="poem-upload-overlay" style="position: fixed">
    <button data-testid="close" aria-label="關閉拾字成詩" @click="emit('close')">✕</button>
    <Transition name="ink-loading">
      <div v-if="isFrameLoading" class="loading" data-testid="poem-upload-loading" aria-live="polite">
        <div class="ink-bloom" aria-hidden="true" />
        <div class="poem-characters" aria-hidden="true">
          <span>拾</span><span>字</span><span>成</span><span>詩</span>
        </div>
        <div class="ink-line" aria-hidden="true" />
        <p class="loading-copy" data-testid="poem-upload-loading-copy">正在鋪開詩頁⋯⋯</p>
      </div>
    </Transition>
    <iframe data-testid="poem-upload-frame" :src="poemUploadUrl" title="拾字成詩上傳工具" @load="handleFrameLoad" />
  </section>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  isolation: isolate;
}

iframe {
  position: relative;
  z-index: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

button {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 2;
}

.loading {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-content: center;
  overflow: hidden;
  background: #1c1712;
  color: #f3e9d6;
  text-align: center;
}

.ink-bloom {
  position: absolute;
  inset: -30%;
  background: radial-gradient(circle, rgb(167 128 79 / 45%), transparent 48%);
  animation: ink-pulse 2.4s ease-in-out 1.1s infinite;
}

.poem-characters {
  position: relative;
  display: flex;
  gap: 0.45em;
  justify-content: center;
  font-family: "LXGW WenKai TC", "Noto Serif TC", serif;
  font-size: clamp(2.5rem, 8vw, 4.5rem);
  letter-spacing: 0.15em;
}

.poem-characters span {
  opacity: 0;
  transform: translateY(0.35em);
  animation: character-reveal 420ms ease-out forwards;
}

.poem-characters span:nth-child(2) { animation-delay: 180ms; }
.poem-characters span:nth-child(3) { animation-delay: 360ms; }
.poem-characters span:nth-child(4) { animation-delay: 540ms; }

.ink-line {
  position: relative;
  width: min(11rem, 48vw);
  height: 1px;
  margin: 1.25rem auto 0.85rem;
  background: linear-gradient(90deg, transparent, #cba56b, transparent);
}

.loading p {
  position: relative;
  margin: 0;
  font-size: 0.95rem;
  letter-spacing: 0.18em;
}

.loading-copy {
  font-family: "LXGW WenKai TC", "Noto Serif TC", serif;
}

.ink-loading-leave-active { transition: opacity 180ms ease-out; }
.ink-loading-leave-to { opacity: 0; }

@keyframes character-reveal {
  to { opacity: 1; transform: translateY(0); }
}

@keyframes ink-pulse {
  50% { opacity: 0.72; transform: scale(1.04); }
}

@media (prefers-reduced-motion: reduce) {
  .ink-bloom,
  .poem-characters span { animation: none; transform: none; }
  .poem-characters span { opacity: 1; }
  .ink-loading-leave-active { transition: none; }
}
</style>
