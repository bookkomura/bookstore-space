<script setup lang="ts">
import type { Shelf } from '../content/schema'

defineProps<{ shelf: Shelf }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div class="overlay" data-testid="shelf-panel">
    <header>
      <h2>{{ shelf.title }}</h2>
      <button data-testid="close" aria-label="關閉" @click="emit('close')">✕</button>
    </header>
    <ul>
      <li v-for="book in shelf.books" :key="book.title">
        <img :src="book.cover" :alt="book.title" loading="lazy" />
        <div>
          <h3>{{ book.title }}</h3>
          <p>{{ book.note }}</p>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 100; overflow-y: auto;
  background: rgba(20, 16, 10, 0.92); color: #f5efe0; padding: 16px;
}
header { display: flex; justify-content: space-between; align-items: center; }
header button { background: none; border: none; color: inherit; font-size: 1.5rem; padding: 8px; }
ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 16px; }
li { display: flex; gap: 12px; }
li img { width: 80px; height: 112px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
li h3 { margin: 0 0 4px; }
li p { margin: 0; line-height: 1.5; opacity: 0.85; }
</style>
