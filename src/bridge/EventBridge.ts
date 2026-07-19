import type { ZoneType } from '../game/zones'

export interface BridgeEvents {
  'interact': { id: string; type: ZoneType }
  'zone:enter': { id: string; type: ZoneType }
  'zone:exit': { id: string }
  'ui:opened': undefined
  'ui:closed': undefined
}

type Handler<T> = (payload: T) => void

export class EventBridge {
  private handlers = new Map<keyof BridgeEvents, Set<Handler<never>>>()

  on<K extends keyof BridgeEvents>(event: K, fn: Handler<BridgeEvents[K]>): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(fn as Handler<never>)
    return () => this.handlers.get(event)?.delete(fn as Handler<never>)
  }

  emit<K extends keyof BridgeEvents>(
    event: K,
    ...args: BridgeEvents[K] extends undefined ? [] : [BridgeEvents[K]]
  ): void {
    this.handlers.get(event)?.forEach((fn) => (fn as Handler<BridgeEvents[K]>)(args[0] as BridgeEvents[K]))
  }
}

export const bridge = new EventBridge()
