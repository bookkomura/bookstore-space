<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { bridge } from './bridge/EventBridge'
import { loadContent } from './content/loadContent'
import type { ContentBundle, Shelf, Showcase } from './content/schema'
import { createGame } from './game/createGame'
import BookViewer from './ui/BookViewer.vue'
import ShelfPanel from './ui/ShelfPanel.vue'
import StoreInfoCard from './ui/StoreInfoCard.vue'
import TouchControls from './ui/TouchControls.vue'

const container = ref<HTMLElement>()
const content = ref<ContentBundle | null>(null)
const loadError = ref(false)
const activeShowcase = ref<Showcase | null>(null)
const activeShelf = ref<Shelf | null>(null)
const showInfo = ref(false)
const isTouch = 'ontouchstart' in window

let game: ReturnType<typeof createGame> | null = null
let offInteract: (() => void) | null = null
let isUnmounted = false

onMounted(async () => {
  try {
    content.value = await loadContent()
  } catch {
    if (!isUnmounted) loadError.value = true
    return
  }

  if (isUnmounted || !container.value) return
  game = createGame(container.value)

  offInteract = bridge.on('interact', ({ id, type }) => {
    const currentContent = content.value
    if (!currentContent) return

    if (type === 'showcase') activeShowcase.value = currentContent.showcases.find((showcase) => showcase.id === id) ?? null
    else if (type === 'shelf') activeShelf.value = currentContent.shelves.find((shelf) => shelf.id === id) ?? null
    else if (type === 'info') showInfo.value = true

    if (activeShowcase.value || activeShelf.value || showInfo.value) bridge.emit('ui:opened')
  })
})

onUnmounted(() => {
  isUnmounted = true
  offInteract?.()
  game?.destroy(true)
})

function closeAll() {
  activeShowcase.value = null
  activeShelf.value = null
  showInfo.value = false
  bridge.emit('ui:closed')
}
</script>

<template>
  <div v-if="loadError" class="error">
    <p>內容載入失敗，請重新整理再試一次。</p>
  </div>
  <template v-else>
    <div ref="container" class="game" />
    <TouchControls v-if="isTouch" />
    <BookViewer v-if="activeShowcase" :showcase="activeShowcase" @close="closeAll" />
    <ShelfPanel v-if="activeShelf" :shelf="activeShelf" @close="closeAll" />
    <StoreInfoCard v-if="showInfo && content" :info="content.storeInfo" @close="closeAll" />
  </template>
</template>

<style>
.game { width: 100vw; height: 100vh; }
.error { color: #f5efe0; display: flex; height: 100vh; align-items: center; justify-content: center; }
</style>
