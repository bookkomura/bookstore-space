<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Showcase } from '../content/schema'
import ImageFrame from './ImageFrame.vue'
import OverlayHeader from './OverlayHeader.vue'

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
    <OverlayHeader :title="showcase.title" @close="emit('close')">
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
    </OverlayHeader>

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
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  padding: 0 2px;
  color: rgba(240, 184, 96, 0.78);
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  white-space: nowrap;
  text-decoration: none;
  border: 0;
  border-bottom: 1px solid rgba(240, 184, 96, 0.3);
  transition: color 180ms ease, border-color 180ms ease;
}

.creator::after {
  content: "↗";
  font-size: 0.72rem;
}

.creator--emphasized {
  color: #f0b860;
  font-weight: 500;
  background: none;
  border-bottom-color: #f0b860;
  box-shadow: none;
}

.creator:focus-visible {
  outline: 3px solid #fff4d6;
  outline-offset: 3px;
}

@media (prefers-reduced-motion: no-preference) {
  .creator--emphasized {
    animation: creator-rule 700ms cubic-bezier(0.2, 0.7, 0.25, 1) both;
  }

  @keyframes creator-rule {
    from { border-bottom-color: rgba(240, 184, 96, 0.2); }
    to { border-bottom-color: #f0b860; }
  }
}

@media (max-width: 480px) {
  :deep(.overlay-header) {
    gap: 8px;
  }
}
</style>
