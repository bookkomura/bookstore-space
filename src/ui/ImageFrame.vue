<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  src: string
  alt: string
  fit?: 'contain' | 'cover'
  loading?: 'eager' | 'lazy'
  /** 書封等小尺寸用 compact：行距與模糊縮小 */
  density?: 'default' | 'compact'
  /** 同一排錯開節奏，單位 ms */
  delay?: number
}>(), {
  fit: 'contain',
  loading: 'eager',
  density: 'default',
  delay: 0,
})

const emit = defineEmits<{ error: [] }>()
const status = ref<'loading' | 'loaded' | 'error'>('loading')

const imageClass = computed(() => [
  'image',
  `image--${props.fit}`,
  { 'image--loading': status.value === 'loading' },
])

const loaderStyle = computed(() => ({
  '--sweep-delay': `${props.delay}ms`,
}))

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
    <div
      v-if="status === 'loading'"
      class="loader"
      :class="`loader--${density}`"
      :style="loaderStyle"
      data-testid="image-loader"
      aria-hidden="true"
    >
      <div class="loader-grain" />
      <div class="loader-sweep" />
    </div>
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
  overflow: hidden;
  pointer-events: none;
}

/* 紙面行距紋理 */
.loader-grain {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    180deg,
    rgba(245, 239, 224, 0.05) 0 1px,
    transparent 1px 15px
  );
  animation: paper-grain 3.4s ease-in-out infinite;
}

/* 檯燈掠過的暖光帶 */
.loader-sweep {
  position: absolute;
  top: -25%;
  bottom: -25%;
  width: 42%;
  background: linear-gradient(
    100deg,
    transparent,
    rgba(240, 184, 96, 0.16) 42%,
    rgba(255, 244, 214, 0.26) 55%,
    transparent
  );
  filter: blur(7px);
  animation: paper-sweep 1.9s cubic-bezier(0.45, 0.05, 0.35, 1) infinite;
  animation-delay: var(--sweep-delay, 0ms);
}

.loader--compact .loader-grain {
  background: repeating-linear-gradient(
    180deg,
    rgba(245, 239, 224, 0.05) 0 1px,
    transparent 1px 11px
  );
}

.loader--compact .loader-sweep {
  width: 44%;
  background: linear-gradient(
    100deg,
    transparent,
    rgba(240, 184, 96, 0.18) 42%,
    rgba(255, 244, 214, 0.3) 55%,
    transparent
  );
  filter: blur(5px);
}

@keyframes paper-sweep {
  0% { transform: translateX(-130%); }
  100% { transform: translateX(330%); }
}

@keyframes paper-grain {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.85; }
}

@media (prefers-reduced-motion: reduce) {
  .loader-grain { animation: none; opacity: 0.7; }
  .loader-sweep { animation: none; opacity: 0.5; transform: translateX(60%); }
}
</style>
