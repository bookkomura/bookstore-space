<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  src: string
  alt: string
  fit?: 'contain' | 'cover'
  loading?: 'eager' | 'lazy'
}>(), {
  fit: 'contain',
  loading: 'eager',
})

const emit = defineEmits<{ error: [] }>()
const status = ref<'loading' | 'loaded' | 'error'>('loading')

const imageClass = computed(() => [
  'image',
  `image--${props.fit}`,
  { 'image--loading': status.value === 'loading' },
])

function fail() {
  status.value = 'error'
  emit('error')
}

watch(
  () => props.src,
  () => {
    status.value = 'loading'
  },
)
</script>

<template>
  <div class="frame" data-testid="image-frame">
    <svg
      v-if="status === 'loading'"
      class="loader"
      data-testid="image-loader"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect class="loader-base" x="2" y="2" width="96" height="96" rx="1" />
      <rect class="loader-trace" x="5" y="5" width="90" height="90" rx="1" pathLength="100" />
    </svg>
    <img
      v-if="status !== 'error'"
      :src="src"
      :alt="alt"
      :loading="loading"
      :class="imageClass"
      data-testid="image"
      @load="status = 'loaded'"
      @error="fail"
    >
    <slot v-else name="error" />
  </div>
</template>

<style scoped>
.frame {
  position: relative;
  overflow: hidden;
  background: #21170a;
}

.image {
  display: block;
  width: 100%;
  height: 100%;
  opacity: 1;
  transition: opacity 220ms ease-out;
}

.image--contain { object-fit: contain; }
.image--cover { object-fit: cover; }
.image--loading { opacity: 0; }

.loader {
  position: absolute;
  z-index: 1;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.loader-base {
  fill: none;
  stroke: rgba(245, 239, 224, 0.16);
  stroke-width: 1;
}

.loader-trace {
  fill: none;
  stroke: #f0b860;
  stroke-width: 1.5;
  stroke-dasharray: 28 72;
  stroke-linecap: square;
  animation: trace-frame 1.4s linear infinite;
}

@keyframes trace-frame {
  to { stroke-dashoffset: -100; }
}

@media (prefers-reduced-motion: reduce) {
  .loader-trace {
    stroke-dasharray: 100 0;
    animation: none;
  }
}
</style>
