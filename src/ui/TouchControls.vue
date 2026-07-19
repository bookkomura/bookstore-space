<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { touchInput } from '../game/inputState'
import { joystickVector } from '../game/joystick'

const props = defineProps<{
  canInteract: boolean
  disabled: boolean
}>()
const emit = defineEmits<{ interact: [] }>()

const RADIUS = 40
const touchId = ref<number | null>(null)
const origin = ref({ x: 0, y: 0 })
const knob = ref({ x: 0, y: 0 })

function findTouch(list: TouchList, identifier: number): Touch | null {
  for (let index = 0; index < list.length; index++) {
    const item = list[index]
    if (item?.identifier === identifier) return item
  }
  return null
}

function resetJoystick() {
  touchId.value = null
  knob.value = { x: 0, y: 0 }
  touchInput.x = 0
  touchInput.y = 0
}

function onStart(event: TouchEvent) {
  if (props.disabled || touchId.value !== null) return
  const touch = event.changedTouches[0]
  if (!touch) return
  touchId.value = touch.identifier
  origin.value = { x: touch.clientX, y: touch.clientY }
}

function onMove(event: TouchEvent) {
  if (props.disabled || touchId.value === null) return
  const touch = findTouch(event.touches, touchId.value)
  if (!touch) return
  const vector = joystickVector(
    origin.value,
    { x: touch.clientX, y: touch.clientY },
    RADIUS,
  )
  knob.value = { x: vector.x * RADIUS, y: vector.y * RADIUS }
  touchInput.x = vector.x
  touchInput.y = vector.y
}

function onEnd(event: TouchEvent) {
  if (touchId.value === null) return
  if (findTouch(event.changedTouches, touchId.value)) resetJoystick()
}

function interact() {
  if (props.canInteract && !props.disabled) emit('interact')
}

watch(() => props.disabled, (disabled) => {
  if (disabled) resetJoystick()
})
onUnmounted(resetJoystick)
</script>

<template>
  <div
    class="joystick"
    data-testid="joystick"
    :aria-disabled="disabled"
    @touchstart.prevent="onStart"
    @touchmove.prevent="onMove"
    @touchend.prevent="onEnd"
    @touchcancel.prevent="onEnd"
  >
    <div class="base">
      <div
        class="knob"
        :style="{ transform: `translate(${knob.x}px, ${knob.y}px)` }"
      />
    </div>
  </div>

  <button
    type="button"
    class="interact"
    data-testid="interact-button"
    :class="{ ready: canInteract && !disabled }"
    :disabled="!canInteract || disabled"
    aria-label="點擊互動"
    @click="interact"
  >
    點擊
  </button>
</template>

<style scoped>
.joystick {
  position: fixed;
  left: 24px;
  bottom: max(24px, env(safe-area-inset-bottom));
  z-index: 50;
  touch-action: none;
}
.base {
  width: 96px;
  height: 96px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}
.knob {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
}
.interact {
  position: fixed;
  right: 24px;
  bottom: max(28px, env(safe-area-inset-bottom));
  z-index: 50;
  width: 76px;
  height: 76px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-radius: 50%;
  background: rgba(75, 85, 99, 0.58);
  color: rgba(255, 255, 255, 0.58);
  font-size: 16px;
  font-weight: 700;
  transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
}
.interact.ready {
  border-color: #fff7d6;
  background: #d8b866;
  color: #2f2818;
  box-shadow: 0 0 0 5px rgba(255, 247, 214, 0.2), 0 0 22px rgba(216, 184, 102, 0.8);
  transform: scale(1.06);
}
.interact:disabled { cursor: default; }
</style>
