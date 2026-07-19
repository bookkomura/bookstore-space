import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { touchInput } from '../src/game/inputState'
import TouchControls from '../src/ui/TouchControls.vue'

function touch(identifier: number, clientX: number, clientY: number): Touch {
  return { identifier, clientX, clientY } as Touch
}

function dispatchTouch(
  element: Element,
  type: string,
  touches: Touch[],
  changedTouches: Touch[] = touches,
) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    touches: { value: touches },
    changedTouches: { value: changedTouches },
  })
  element.dispatchEvent(event)
}

afterEach(() => {
  touchInput.x = 0
  touchInput.y = 0
})

describe('TouchControls', () => {
  it('區域外停用，區域內啟用並 emit interact', async () => {
    const wrapper = mount(TouchControls, {
      props: { canInteract: false, disabled: false },
    })
    const button = wrapper.get('[data-testid="interact-button"]')
    expect(button.attributes('disabled')).toBeDefined()

    await wrapper.setProps({ canInteract: true })
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    expect(wrapper.emitted('interact')).toHaveLength(1)
  })

  it('第二根手指不取代 joystick 的 identifier', () => {
    const wrapper = mount(TouchControls, {
      props: { canInteract: true, disabled: false },
    })
    const joystick = wrapper.get('[data-testid="joystick"]').element
    const left = touch(1, 100, 100)
    const right = touch(2, 350, 700)

    dispatchTouch(joystick, 'touchstart', [left], [left])
    dispatchTouch(
      joystick,
      'touchmove',
      [touch(1, 140, 100), right],
      [touch(1, 140, 100)],
    )

    expect(touchInput.x).toBeCloseTo(1)
    expect(touchInput.y).toBeCloseTo(0)
  })

  it('overlay 停用控制時立即清除 joystick 向量', async () => {
    const wrapper = mount(TouchControls, {
      props: { canInteract: true, disabled: false },
    })
    touchInput.x = 1
    await wrapper.setProps({ disabled: true })
    await nextTick()
    expect(touchInput).toEqual({ x: 0, y: 0 })
  })
})
