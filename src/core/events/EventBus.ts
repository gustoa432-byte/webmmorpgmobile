/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EntityId, EntityTag, Vec2, Vec3 } from '../types';

export interface OnEntityDamagedEvent {
  type: 'OnEntityDamaged';
  targetId: EntityId;
  sourceId: EntityId;
  damage: number;
  isCrit: boolean;
  isMiss: boolean;
  remainingHp: number;
  position: Vec3;
}

export interface OnEntityDiedEvent {
  type: 'OnEntityDied';
  entityId: EntityId;
  killerId: EntityId;
  expReward: number;
  position: Vec3;
}

export interface OnEntitySpawnedEvent {
  type: 'OnEntitySpawned';
  entityId: EntityId;
  templateId: string;
  tag: EntityTag;
  position: Vec3;
}

export interface OnItemPickedEvent {
  type: 'OnItemPicked';
  entityId: EntityId; // Item entity that was picked
  pickerId: EntityId; // Player who picked it
  itemTemplateId: string;
  itemName: string;
  count: number;
  zenAmount: number;
}

export interface OnLevelUpEvent {
  type: 'OnLevelUp';
  entityId: EntityId;
  newLevel: number;
  statPointsGained: number;
}

export interface OnSkillUsedEvent {
  type: 'OnSkillUsed';
  casterId: EntityId;
  skillId: string;
  skillName: string;
  targetId?: EntityId | null;
  targetPos?: Vec2;
  manaCost: number;
  aoeRadius?: number;
}

export interface OnTargetChangedEvent {
  type: 'OnTargetChanged';
  entityId: EntityId;
  targetId: EntityId | null;
}

export interface OnItemDroppedEvent {
  type: 'OnItemDropped';
  entityId: EntityId;
  itemTemplateId: string;
  itemName: string;
  count: number;
  zenAmount: number;
  position: Vec3;
}

export type CoreEvent =
  | OnEntityDamagedEvent
  | OnEntityDiedEvent
  | OnEntitySpawnedEvent
  | OnItemPickedEvent
  | OnLevelUpEvent
  | OnSkillUsedEvent
  | OnTargetChangedEvent
  | OnItemDroppedEvent;

export type EventCallback<T extends CoreEvent = CoreEvent> = (event: T) => void;

export class EventBus {
  private listeners: Map<string, Set<EventCallback<any>>> = new Map();
  private eventBuffer: CoreEvent[] = [];
  private history: CoreEvent[] = [];
  private readonly maxHistory: number = 200;

  /**
   * Subscribes a listener callback to a specific event type, or '*' for all events.
   */
  public subscribe<T extends CoreEvent>(eventType: T['type'] | '*', callback: EventCallback<T>): () => void {
    let set = this.listeners.get(eventType);
    if (!set) {
      set = new Set();
      this.listeners.set(eventType, set);
    }
    set.add(callback);

    return () => {
      set?.delete(callback);
    };
  }

  /**
   * Buffers an event to be dispatched at the end of the simulation tick.
   */
  public emit(event: CoreEvent): void {
    this.eventBuffer.push(event);
  }

  /**
   * Immediately dispatches all buffered events in FIFO order to all subscribers.
   */
  public dispatchAll(): CoreEvent[] {
    if (this.eventBuffer.length === 0) return [];

    const eventsToDispatch = this.eventBuffer;
    this.eventBuffer = [];

    for (const event of eventsToDispatch) {
      // Record history
      this.history.push(event);
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }

      // Notify specific listeners
      const specific = this.listeners.get(event.type);
      if (specific) {
        for (const cb of specific) {
          try {
            cb(event);
          } catch (e) {
            console.error(`Error in event listener for ${event.type}:`, e);
          }
        }
      }

      // Notify wildcard listeners
      const wildcard = this.listeners.get('*');
      if (wildcard) {
        for (const cb of wildcard) {
          try {
            cb(event);
          } catch (e) {
            console.error('Error in wildcard event listener:', e);
          }
        }
      }
    }

    return eventsToDispatch;
  }

  /**
   * Gets recent event history.
   */
  public getHistory(): readonly CoreEvent[] {
    return this.history;
  }

  /**
   * Clears all listeners and buffered events.
   */
  public reset(): void {
    this.eventBuffer = [];
    this.history = [];
  }
}
