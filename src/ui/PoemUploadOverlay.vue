<script setup lang="ts">
const emit = defineEmits<{ close: [] }>()
const poemUploadUrl = 'https://paiwh-poem-display.hf.space/'
</script>

<template>
  <section class="overlay" data-testid="poem-upload-overlay" style="position: fixed">
    <button data-testid="close" aria-label="關閉拾字成詩" @click="emit('close')">✕</button>
    <iframe data-testid="poem-upload-frame" :src="poemUploadUrl" title="拾字成詩上傳工具" />
  </section>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
}

iframe {
  width: 100%;
  height: 100%;
  border: 0;
}

button {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 1;
}
</style>
