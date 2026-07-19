<script setup lang="ts">
import type { StoreInfo } from '../content/schema'

defineProps<{ info: StoreInfo }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div class="overlay" data-testid="store-info">
    <div class="card" style="box-sizing: border-box">
      <button data-testid="close" aria-label="關閉" @click="emit('close')">✕</button>
      <h2>來實體店逛逛</h2>
      <p>{{ info.address }}</p>
      <p>{{ info.hours }}</p>
      <div class="links">
        <a data-testid="map-link" :href="info.mapLink" target="_blank" rel="noopener">地圖導航</a>
        <a data-testid="ig-link" :href="info.instagram" target="_blank" rel="noopener">Instagram</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0, 0, 0, 0.6);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.card {
  position: relative; background: #f5efe0; color: #322718;
  border-radius: 8px; padding: 24px 32px; max-width: 360px; width: 100%;
}
.card button { position: absolute; top: 8px; right: 8px; background: none; border: none; font-size: 1.3rem; }
.links { display: flex; gap: 16px; margin-top: 16px; }
.links a { color: #7a5220; font-weight: 600; }
</style>
