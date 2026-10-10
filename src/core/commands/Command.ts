/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EntityId, Vec2 } from '../types';

export type CommandType =
  | 'Move'
  | 'SetTarget'
  | 'UseSkill'
  | 'Pickup'
  | 'ChangeSkillLoadout'
  | 'Respawn'
  | 'UsePotion';

export interface BaseCommand {
  readonly type: CommandType;
  readonly entityId: EntityId;
  readonly timestamp?: number;
}

export interface MoveCommand extends BaseCommand {
  readonly type: 'Move';
  readonly direction?: Vec2; // Normalized direction vector for continuous input (joystick/keys)
  readonly targetPos?: Vec2;  // Target point for point-and-click / tap
}

export interface SetTargetCommand extends BaseCommand {
  readonly type: 'SetTarget';
  readonly targetEntityId: EntityId | null;
}

export interface UseSkillCommand extends BaseCommand {
  readonly type: 'UseSkill';
  readonly slot: number; // 1 to 4 (or 0 for basic attack)
  readonly targetEntityId?: EntityId | null;
  readonly targetPos?: Vec2;
}

export interface PickupCommand extends BaseCommand {
  readonly type: 'Pickup';
  readonly targetItemId?: EntityId; // Optional specific item or nearest
}

export interface ChangeSkillLoadoutCommand extends BaseCommand {
  readonly type: 'ChangeSkillLoadout';
  readonly slots: string[]; // List of skill IDs
}

export interface RespawnCommand extends BaseCommand {
  readonly type: 'Respawn';
}

export interface UsePotionCommand extends BaseCommand {
  readonly type: 'UsePotion';
  readonly potionItemId?: string;
}

export type Command =
  | MoveCommand
  | SetTargetCommand
  | UseSkillCommand
  | PickupCommand
  | ChangeSkillLoadoutCommand
  | RespawnCommand
  | UsePotionCommand;
