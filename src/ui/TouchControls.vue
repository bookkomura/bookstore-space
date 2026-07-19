<script setup lang="ts">
import { ref } from 'vue'
import { joystickVector } from '../game/joystick'
import { touchInput } from '../game/inputState'

const RADIUS = 40
const active = ref(false)
const origin = ref({ x: 0, y: 0 })
const knob = ref({ x: 0, y: 0 })

function onStart(e: TouchEvent) {
  active.value = true
  origin.value = { x: e.touches[0].clientX, y: e.touches[0].clientY }
}
function onMove(e: TouchEvent) {
  if (!active.value) return
  const current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  const v = joystickVector(origin.value, current, RADIUS)
  knob.value = { x: v.x * RADIUS, y: v.y * RADIUS }
  touchInput.x = v.x
  touchInput.y = v.y
}
function onEnd() {
  active.value = false
  knob.value = { x: 0, y: 0 }
  touchInput.x = 0
  touchInput.y = 0
}
</script>

<template>
  <div
    class="joystick"
    data-testid="touch-controls"
    @touchstart.prevent="onStart"
    @touchmove.prevent="onMove"
    @touchend="onEnd"
    @touchcancel="onEnd"
  >
    <div class="base">
      <div class="knob" :style="{ transform: `translate(${knob.x}px, ${knob.y}px)` }" />
    </div>
  </div>
</template>

<style scoped>
.joystick { position: fixed; left: 24px; bottom: 24px; z-index: 50; touch-action: none; }
.base {
  width: 96px; height: 96px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.4);
  display: flex; align-items: center; justify-content: center;
}
.knob { width: 40px; height: 40px; border-radius: 50%; background: rgba(255, 255, 255, 0.6); }
</style>
