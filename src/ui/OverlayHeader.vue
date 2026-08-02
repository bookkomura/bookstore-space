<script setup lang="ts">
import OverlayCloseButton from './OverlayCloseButton.vue'

defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <header class="overlay-header">
    <h2 class="overlay-title">{{ title }}</h2>
    <slot />
    <OverlayCloseButton @close="emit('close')" />
  </header>
</template>

<style scoped>
.overlay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.overlay-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 1.5rem;
  font-weight: 700;
  white-space: nowrap;
  text-overflow: ellipsis;
}

</style>
