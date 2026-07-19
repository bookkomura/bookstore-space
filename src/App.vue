<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { createGame } from './game/createGame'

const container = ref<HTMLElement>()
let game: ReturnType<typeof createGame> | null = null

onMounted(() => {
  game = createGame(container.value!)
})
onUnmounted(() => {
  game?.destroy(true)
})
</script>

<template>
  <div ref="container" class="game" />
</template>

<style>
.game {
  width: 100vw;
  height: 100vh;
}
</style>
