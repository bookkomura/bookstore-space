<script setup lang="ts">
const props = withDefaults(defineProps<{
  ariaLabel?: string
  tone?: 'inherit' | 'dark'
}>(), {
  ariaLabel: '關閉',
  tone: 'inherit',
})

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <button
    :class="['overlay-close', { 'overlay-close--dark': props.tone === 'dark' }]"
    data-testid="close"
    type="button"
    :aria-label="props.ariaLabel"
    @click="emit('close')"
  >✕</button>
</template>

<style scoped>
.overlay-close {
  width: 44px;
  height: 44px;
  padding: 0;
  color: inherit;
  font-size: 1.5rem;
  background: none;
  border: none;
}

.overlay-close--dark {
  color: #000;
}
</style>
