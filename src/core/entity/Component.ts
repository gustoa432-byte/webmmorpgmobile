/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AIState,
  ColliderShape,
  MovementState,
  Vec2,
  Vec3
} from '../types';

export type ComponentType =
  | 'Transform'
  | 'Movement'
  | 'Collider'
  | 'Health'
  | 'Combat'
  | 'SkillSet'
  | 'Inventory'
  | 'AI'
  | 'Player'
  | 'ItemDrop'
  | 'Lifetime';

export interface BaseComponent {
  readonly type: ComponentType;
}

export interface TransformComponent extends BaseComponent {
  readonly type: 'Transform';
  position: Vec3;
  previousPosition: Vec3; // For render interpolation
  rotation: number; // In radians (0 facing East, PI/2 facing South, etc.)
  height: number;
}

export interface MovementComponent extends BaseComponent {
  readonly type: 'Movement';
  speed: number;
  velocity: Vec2;
  desiredDirection: Vec2 | null;
  targetPosition: Vec2 | null;
  path: Vec2[];
  movementState: MovementState;
  stepOffset: number;
}

export interface ColliderComponent extends BaseComponent {
  readonly type: 'Collider';
  shape: ColliderShape;
  radius: number;
  height: number;
  isTrigger: boolean;
  solid: boolean;
}

export interface HealthComponent extends BaseComponent {
  readonly type: 'Health';
  currentHp: number;
  maxHp: number;
  isDead: boolean;
  deathTime: number; // tick count when died
  respawnTimeSeconds: number;
}

export interface CombatComponent extends BaseComponent {
  readonly type: 'Combat';
  targetEntityId: number | null;
  attackSpeed: number; // Attacks per second
  attackTimer: number; // Remaining cooldown seconds before next auto-attack
  damageMin: number;
  damageMax: number;
  defense: number;
  attackRange: number;
  isAttacking: boolean;
  attackAnimationDuration: number;
  attackAnimationTimer: number;
}

export interface SkillSetComponent extends BaseComponent {
  readonly type: 'SkillSet';
  skillSlots: string[]; // [slot1Id, slot2Id, slot3Id, slot4Id]
  cooldowns: Record<string, number>; // skillId -> remaining seconds
  selectedSlot: number; // 1 to 4 (or 0 for normal attack)
  currentMana: number;
  maxMana: number;
  castingSkillId: string | null;
  castTimer: number;
}

export interface InventoryItem {
  id: string; // unique instance id
  templateId: string;
  name: string;
  count: number;
  equippedSlot?: 'weapon' | 'shield' | 'armor' | 'helm' | 'pants' | 'gloves' | 'boots';
}

export interface InventoryComponent extends BaseComponent {
  readonly type: 'Inventory';
  items: InventoryItem[];
  zen: number;
  capacity: number;
  wantsPickup: boolean;
  pendingPickupItemId: number | null;
  equipment: {
    weapon?: InventoryItem;
    shield?: InventoryItem;
    armor?: InventoryItem;
    helm?: InventoryItem;
    pants?: InventoryItem;
    gloves?: InventoryItem;
    boots?: InventoryItem;
  };
}

export interface AIComponent extends BaseComponent {
  readonly type: 'AI';
  state: AIState;
  spawnPoint: Vec2;
  aggroRadius: number;
  leashRadius: number;
  wanderRadius: number;
  wanderTimer: number;
  wanderInterval: number;
  targetEntityId: number | null;
  returnSpeed: number;
  monsterTemplateId: string;
}

export interface PlayerStats {
  strength: number;
  agility: number;
  vitality: number;
  energy: number;
}

export interface PlayerComponent extends BaseComponent {
  readonly type: 'Player';
  classId: string;
  level: number;
  currentExp: number;
  expToNextLevel: number;
  statPoints: number;
  stats: PlayerStats;
}

export interface ItemDropComponent extends BaseComponent {
  readonly type: 'ItemDrop';
  templateId: string;
  itemName: string;
  count: number;
  zenAmount: number;
  ownerEntityId: number | null;
  dropTime: number; // Tick or timestamp
}

export interface LifetimeComponent extends BaseComponent {
  readonly type: 'Lifetime';
  durationSeconds: number;
  remainingSeconds: number;
  despawnOnExpire: boolean;
}

export type ComponentMap = {
  Transform: TransformComponent;
  Movement: MovementComponent;
  Collider: ColliderComponent;
  Health: HealthComponent;
  Combat: CombatComponent;
  SkillSet: SkillSetComponent;
  Inventory: InventoryComponent;
  AI: AIComponent;
  Player: PlayerComponent;
  ItemDrop: ItemDropComponent;
  Lifetime: LifetimeComponent;
};
