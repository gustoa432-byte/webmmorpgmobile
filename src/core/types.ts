/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type EntityId = number;

export type EntityTag = 'Player' | 'Monster' | 'NPC' | 'Item' | 'Projectile' | 'Obstacle';

export type AIState = 'idle' | 'patrol' | 'chase' | 'attack' | 'returning';

export type MovementState = 'idle' | 'walking' | 'running';

export type ColliderShape = 'capsule' | 'circle' | 'box';

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'jewel';

export interface MonsterConfig {
  id: string;
  name: string;
  level: number;
  maxHp: number;
  damageMin: number;
  damageMax: number;
  defense: number;
  attackSpeed: number; // attacks per second
  attackRange: number; // grid units
  aggroRadius: number;
  leashRadius: number;
  walkSpeed: number;
  expReward: number;
  dropTable: {
    itemId: string;
    chance: number; // 0 to 1
    minQty?: number;
    maxQty?: number;
  }[];
  color: string;
  size: number;
}

export interface SkillConfig {
  id: string;
  name: string;
  slot: number; // 1 to 4
  manaCost: number;
  cooldown: number; // seconds
  damageMultiplier: number;
  range: number;
  aoeRadius: number;
  effectType: 'single_target' | 'aoe_circle' | 'cone' | 'dash';
  description: string;
  icon: string;
}

export interface ItemConfig {
  id: string;
  name: string;
  rarity: ItemRarity;
  type: 'consumable' | 'weapon' | 'armor' | 'jewel' | 'currency';
  healAmount?: number;
  bonusDamage?: number;
  bonusDefense?: number;
  color: string;
  sellPrice: number;
  stackable: boolean;
  description: string;
}

export interface ClassConfig {
  id: string;
  name: string;
  baseStats: {
    strength: number;
    agility: number;
    vitality: number;
    energy: number;
  };
  baseHp: number;
  baseMana: number;
  defaultWeaponDamageMin: number;
  defaultWeaponDamageMax: number;
  defaultAttackSpeed: number;
  defaultAttackRange: number;
}

export interface SpawnZoneConfig {
  monsterId: string;
  count: number;
  x: number;
  y: number;
  radius: number;
  respawnTimeSeconds: number;
}

export interface MapConfig {
  id: string;
  name: string;
  width: number;
  height: number;
  cellSize: number;
  spawnPoint: Vec2;
  spawnZones: SpawnZoneConfig[];
  obstacles: {
    x: number;
    y: number;
    radius: number;
    type?: 'pillar' | 'wall' | 'house';
  }[];
  safeZoneRadius: number;
}
