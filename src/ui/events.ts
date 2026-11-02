/** Typed pub/sub bus connecting the controller and the panes. */

type Listener = () => void;

export interface EventMap {
  /** A bundle was loaded (set, frame, part, palette and page were reset). */
  'bundle:changed': void;
  /** Another set of the collection was selected (frame and part were reset). */
  'set:selected': void;
  /** Another frame (group) of the set was selected (part was reset). */
  'frame:selected': void;
  /** Another part of the group was selected. */
  'part:selected': void;
  /** Another palette row was selected for the GFX page. */
  'palette:selected': void;
  /** Another GFX page was selected. */
  'page:selected': void;
  /** A tile of the GFX page was clicked. */
  'gfx:selected': void;
  /** Playback was started or stopped. */
  'playback:changed': void;
}

export type EventName = keyof EventMap;

class EventBus {
  private listeners = new Map<EventName, Set<Listener>>();

  on(event: EventName, listener: Listener): () => void {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(listener);
    return () => set.delete(listener);
  }

  /** Subscribe one listener to several events. */
  onAny(events: EventName[], listener: Listener): void {
    for (const event of events) this.on(event, listener);
  }

  emit(event: EventName): void {
    for (const fn of this.listeners.get(event) ?? []) fn();
  }
}

export const events = new EventBus();
