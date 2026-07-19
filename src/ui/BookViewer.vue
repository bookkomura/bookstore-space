<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Showcase } from '../content/schema'

const props = defineProps<{ showcase: Showcase }>()
const emit = defineEmits<{ close: [] }>()

const pageIndex = ref(0)
const failed = ref<Record<number, boolean>>({})
const retryKey = ref(0)

const page = computed(() => props.showcase.pages[pageIndex.value])
const isLast = computed(() => pageIndex.value === props.showcase.pages.length - 1)

function next() {
  if (!isLast.value) pageIndex.value++
}

function prev() {
  if (pageIndex.value > 0) pageIndex.value--
}

function retry() {
  failed.value[pageIndex.value] = false
  retryKey.value++
}

watch(
  pageIndex,
  (index) => {
    const nextPage = props.showcase.pages[index + 1]
    if (nextPage) {
      const image = new Image()
      image.src = nextPage.image
    }
  },
  { immediate: true },
)

let startX = 0

function onTouchStart(event: TouchEvent) {
  startX = event.touches[0].clientX
}

function onTouchEnd(event: TouchEvent) {
  const deltaX = event.changedTouches[0].clientX - startX
  if (deltaX < -50) next()
  else if (deltaX > 50) prev()
}
</script>

<template>
  <div class="overlay" data-testid="book-viewer" @touchstart="onTouchStart" @touchend="onTouchEnd">
    <header>
      <h2>{{ showcase.title }}</h2>
      <button data-testid="close" aria-label="關閉" @click="emit('close')">✕</button>
    </header>

    <div class="page">
      <img
        v-if="!failed[pageIndex]"
        :key="`${pageIndex}-${retryKey}`"
        :src="page.image"
        :alt="page.caption"
        @error="failed[pageIndex] = true"
      >
      <div v-else class="placeholder">
        <p>圖片載入失敗</p>
        <button data-testid="retry" @click="retry">重試</button>
      </div>
      <p class="caption">{{ page.caption }}</p>
    </div>

    <footer>
      <button data-testid="prev" :disabled="pageIndex === 0" @click="prev">上一頁</button>
      <span>{{ pageIndex + 1 }} / {{ showcase.pages.length }}</span>
      <button data-testid="next" :disabled="isLast" @click="next">下一頁</button>
    </footer>

    <a
      v-if="isLast && showcase.creatorLink"
      data-testid="creator-link"
      class="creator"
      :href="showcase.creatorLink"
      target="_blank"
      rel="noopener"
    >創作者 IG →</a>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  padding: 16px;
  color: #f5efe0;
  background: rgba(20, 16, 10, 0.92);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

header h2 {
  margin: 0;
  font-size: 1.2rem;
}

header button {
  padding: 8px;
  color: inherit;
  font-size: 1.5rem;
  background: none;
  border: none;
}

.page {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.page img {
  max-width: 100%;
  max-height: 70%;
  object-fit: contain;
  border-radius: 4px;
}

.placeholder {
  padding: 48px 24px;
  text-align: center;
  background: #333;
  border-radius: 4px;
}

.caption {
  max-width: 32em;
  margin-top: 12px;
  line-height: 1.6;
  text-align: center;
}

footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 12px 0;
}

footer button {
  padding: 8px 20px;
  color: inherit;
  background: none;
  border: 1px solid #f5efe0;
  border-radius: 20px;
}

footer button:disabled {
  opacity: 0.3;
}

.creator {
  padding-bottom: 8px;
  color: #f0b860;
  text-align: center;
}
</style>
