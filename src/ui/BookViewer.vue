<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Showcase } from '../content/schema'
import ImageFrame from './ImageFrame.vue'

const props = defineProps<{ showcase: Showcase }>()
const emit = defineEmits<{ close: [] }>()

const pageIndex = ref(0)
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
      <a
        v-if="showcase.creatorLink"
        data-testid="creator-link"
        class="creator"
        :class="{ 'creator--emphasized': isLast }"
        :href="showcase.creatorLink"
        target="_blank"
        rel="noopener"
        aria-label="認識創作者（在新分頁開啟）"
      >認識創作者</a>
      <button data-testid="close" aria-label="關閉" @click="emit('close')">✕</button>
    </header>

    <div class="page">
      <ImageFrame
        :key="`${pageIndex}-${retryKey}`"
        :src="page.image"
        :alt="page.caption"
        fit="contain"
        class="page-image"
      >
        <template #error>
          <div class="placeholder">
            <p>圖片載入失敗</p>
            <button data-testid="retry" @click="retry">重試</button>
          </div>
        </template>
      </ImageFrame>
      <p class="caption">{{ page.caption }}</p>
    </div>

    <footer>
      <button data-testid="prev" :disabled="pageIndex === 0" @click="prev">上一頁</button>
      <span>{{ pageIndex + 1 }} / {{ showcase.pages.length }}</span>
      <button data-testid="next" :disabled="isLast" @click="next">下一頁</button>
    </footer>

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
  display: grid;
  grid-template-columns: minmax(0, 1fr) 8.5rem 44px;
  gap: 12px;
  align-items: center;
}

header h2 {
  grid-column: 1;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 1.2rem;
  white-space: nowrap;
  text-overflow: ellipsis;
}

header button {
  grid-column: 3;
  width: 44px;
  height: 44px;
  padding: 0;
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

.page-image {
  width: min(100%, 42rem);
  height: min(70%, 34rem);
  min-height: 15rem;
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
  grid-column: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 8.5rem;
  height: 44px;
  padding: 0 12px;
  box-sizing: border-box;
  color: #f0b860;
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
  text-decoration: none;
  background: transparent;
  border: 1px solid #f0b860;
  border-radius: 999px;
  transition: color 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
}

.creator--emphasized {
  color: #21170a;
  background: #f0b860;
  box-shadow: 0 0 0 4px rgba(240, 184, 96, 0.18);
}

.creator:focus-visible {
  outline: 3px solid #fff4d6;
  outline-offset: 3px;
}

@media (prefers-reduced-motion: no-preference) {
  .creator--emphasized {
    animation: creator-emphasis 240ms ease-out both;
  }

  @keyframes creator-emphasis {
    from {
      opacity: 0.72;
    }

    to {
      opacity: 1;
    }
  }
}

@media (max-width: 480px) {
  header {
    gap: 8px;
  }
}
</style>
