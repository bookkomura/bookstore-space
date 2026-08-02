<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { bridge, type BridgeEvents } from './bridge/EventBridge'
import { loadContent } from './content/loadContent'
import type { ContentBundle, Shelf, Showcase } from './content/schema'
import { createGame } from './game/createGame'
import { buildInteractionLabels } from './game/interactionLabels'
import { buildInteractionZones } from './game/sceneLayout'
import BookViewer from './ui/BookViewer.vue'
import BootLoading from './ui/BootLoading.vue'
import NewsletterArchive from './ui/NewsletterArchive.vue'
import PoemUploadOverlay from './ui/PoemUploadOverlay.vue'
import ShelfPanel from './ui/ShelfPanel.vue'
import StoreInfoCard from './ui/StoreInfoCard.vue'
import TouchControls from './ui/TouchControls.vue'

const container = ref<HTMLElement>()
const content = ref<ContentBundle | null>(null)
const loadError = ref(false)
const activeShowcase = ref<Showcase | null>(null)
const activeShelf = ref<Shelf | null>(null)
const showInfo = ref(false)
const showArchive = ref(false)
const showPoemUpload = ref(false)
const currentZone = ref<BridgeEvents['zone:enter'] | null>(null)
const bootProgress = ref(0)
const bootReady = ref(false)
const bootError = ref(false)
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
const uiOpen = computed(
  () => Boolean(activeShowcase.value || activeShelf.value || showInfo.value || showArchive.value || showPoemUpload.value),
)

let game: ReturnType<typeof createGame> | null = null
let bridgeUnsubscribers: (() => void)[] = []
let isUnmounted = false

function openInteraction({ id, type }: BridgeEvents['interact']) {
  const currentContent = content.value
  if (!currentContent) return

  if (type === 'showcase') {
    activeShowcase.value =
      currentContent.showcases.find((showcase) => showcase.id === id) ?? null
  } else if (type === 'shelf') {
    activeShelf.value =
      currentContent.shelves.find((shelf) => shelf.id === id) ?? null
  } else if (type === 'info') {
    showInfo.value = true
  } else if (type === 'archive') {
    showArchive.value = true
  } else if (type === 'poemUpload') {
    showPoemUpload.value = true
  }

  if (uiOpen.value) bridge.emit('ui:opened')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && uiOpen.value) closeAll()
}

onMounted(async () => {
  bridgeUnsubscribers.push(
    bridge.on('boot:progress', (value) => {
      bootProgress.value = value
    }),
    bridge.on('boot:complete', () => {
      bootReady.value = true
    }),
    bridge.on('boot:error', () => {
      bootError.value = true
    }),
  )

  try {
    content.value = await loadContent()
  } catch (e){
    console.error('Failed to load content', e)
    if (!isUnmounted) loadError.value = true
    return
  }

  if (isUnmounted || !container.value) return
  window.addEventListener('keydown', handleKeydown)
  bridgeUnsubscribers.push(
    bridge.on('interact', openInteraction),
    bridge.on('zone:enter', (zone) => {
      currentZone.value = zone
    }),
    bridge.on('zone:exit', ({ id }) => {
      if (currentZone.value?.id === id) currentZone.value = null
    }),
  )
  game = createGame(
    container.value,
    buildInteractionLabels(content.value),
    buildInteractionZones(content.value.showcases),
  )
})

onUnmounted(() => {
  isUnmounted = true
  window.removeEventListener('keydown', handleKeydown)
  bridgeUnsubscribers.forEach((unsubscribe) => unsubscribe())
  bridgeUnsubscribers = []
  game?.destroy(true)
})

function requestInteract() {
  if (currentZone.value && !uiOpen.value) bridge.emit('interact:request')
}

function closeAll() {
  activeShowcase.value = null
  activeShelf.value = null
  showInfo.value = false
  showArchive.value = false
  showPoemUpload.value = false
  bridge.emit('ui:closed')
}
</script>

<template>
  <div v-if="loadError" class="error">
    <p>內容載入失敗，請重新整理再試一次。</p>
  </div>
  <template v-else>
    <Transition name="boot-loading">
      <BootLoading v-if="!bootReady || bootError" :progress="bootProgress" :error="bootError" />
    </Transition>
    <div ref="container" class="game" />
    <TouchControls
      v-if="isTouch"
      :can-interact="Boolean(currentZone)"
      :disabled="uiOpen"
      @interact="requestInteract"
    />
    <BookViewer v-if="activeShowcase" :showcase="activeShowcase" @close="closeAll" />
    <ShelfPanel v-if="activeShelf" :shelf="activeShelf" @close="closeAll" />
    <StoreInfoCard v-if="showInfo && content" :info="content.storeInfo" @close="closeAll" />
    <NewsletterArchive
      v-if="showArchive && content"
      :newsletters="content.newsletters"
      @close="closeAll"
    />
    <PoemUploadOverlay v-if="showPoemUpload" @close="closeAll" />
  </template>
</template>

<style>
.game { width: 100vw; height: 100vh; }
.error { color: #f5efe0; display: flex; height: 100vh; align-items: center; justify-content: center; }

.boot-loading-leave-active { transition: opacity 180ms ease-out; }
.boot-loading-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .boot-loading-leave-active { transition: none; }
}
</style>
