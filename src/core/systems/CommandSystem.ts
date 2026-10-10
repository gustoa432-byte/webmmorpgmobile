/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Command } from '../commands/Command';
import { CommandQueue } from '../commands/CommandQueue';
import { EntityManager } from '../entity/EntityManager';
import { EventBus } from '../events/EventBus';
import { ConfigLoader } from '../data/ConfigLoader';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export class CommandSystem {
  constructor(
    private entities: EntityManager,
    private commandQueue: CommandQueue,
    private eventBus: EventBus,
    private configs: ConfigLoader,
    private physics: PhysicsWorld
  ) {}

  public update(dt: number): void {
    const commands = this.commandQueue.drain();

    for (const cmd of commands) {
      this.processCommand(cmd, dt);
    }
  }

  private processCommand(cmd: Command, _dt: number): void {
    const entityId = cmd.entityId;
    if (!this.entities.hasEntity(entityId)) {
      return;
    }

    const health = this.entities.getComponent(entityId, 'Health');
    const isDead = health?.isDead ?? false;

    // Respawn command is allowed when dead
    if (cmd.type === 'Respawn') {
      if (isDead && health) {
        const transform = this.entities.getComponent(entityId, 'Transform');
        const mapConfig = this.configs.getMap();
        if (transform) {
          transform.position = { x: mapConfig.spawnPoint.x, y: mapConfig.spawnPoint.y, z: 0 };
          transform.previousPosition = { ...transform.position };
        }
        this.physics.setPosition(entityId, mapConfig.spawnPoint);
        health.isDead = false;
        health.currentHp = health.maxHp;

        const skillSet = this.entities.getComponent(entityId, 'SkillSet');
        if (skillSet) {
          skillSet.currentMana = skillSet.maxMana;
        }

        const movement = this.entities.getComponent(entityId, 'Movement');
        if (movement) {
          movement.velocity = { x: 0, y: 0 };
          movement.targetPosition = null;
          movement.path = [];
          movement.movementState = 'idle';
        }

        const combat = this.entities.getComponent(entityId, 'Combat');
        if (combat) {
          combat.targetEntityId = null;
          combat.isAttacking = false;
        }
      }
      return;
    }

    // Dead entities cannot execute other commands
    if (isDead) {
      return;
    }

    switch (cmd.type) {
      case 'Move': {
        const movement = this.entities.getComponent(entityId, 'Movement');
        const combat = this.entities.getComponent(entityId, 'Combat');

        if (movement) {
          if (cmd.direction) {
            // Directional joystick / keyboard movement
            const len = Math.hypot(cmd.direction.x, cmd.direction.y);
            if (len > 0.001) {
              const nx = cmd.direction.x / len;
              const ny = cmd.direction.y / len;
              movement.desiredDirection = { x: nx, y: ny };
              movement.targetPosition = null;

              // Disengage target if actively moving away or out of range
              if (combat && combat.targetEntityId !== null) {
                const targetTrans = this.entities.getComponent(combat.targetEntityId, 'Transform');
                const pTrans = this.entities.getComponent(entityId, 'Transform');
                if (targetTrans && pTrans) {
                  const toTargetX = targetTrans.position.x - pTrans.position.x;
                  const toTargetY = targetTrans.position.y - pTrans.position.y;
                  const dist = Math.hypot(toTargetX, toTargetY);
                  const dot = nx * toTargetX + ny * toTargetY;
                  if (dot < 0 || dist > 8.0) {
                    combat.targetEntityId = null;
                    this.eventBus.emit({
                      type: 'OnTargetChanged',
                      entityId,
                      targetId: null
                    });
                  }
                } else {
                  combat.targetEntityId = null;
                }
              }
            } else {
              movement.desiredDirection = null;
              movement.velocity = { x: 0, y: 0 };
              movement.movementState = 'idle';
            }
          } else if (cmd.targetPos) {
            // Point-and-click movement
            movement.targetPosition = { x: cmd.targetPos.x, y: cmd.targetPos.y };
            movement.desiredDirection = null;
          }
        }
        break;
      }

      case 'SetTarget': {
        const combat = this.entities.getComponent(entityId, 'Combat');
        if (combat) {
          combat.targetEntityId = cmd.targetEntityId;
          this.eventBus.emit({
            type: 'OnTargetChanged',
            entityId,
            targetId: cmd.targetEntityId
          });
        }
        break;
      }

      case 'UseSkill': {
        const skillSet = this.entities.getComponent(entityId, 'SkillSet');
        if (skillSet) {
          skillSet.selectedSlot = cmd.slot;
          const skillIndex = cmd.slot - 1;
          const skillId = skillSet.skillSlots[skillIndex];
          if (skillId) {
            skillSet.castingSkillId = skillId;
          }
        }
        if (cmd.targetEntityId !== undefined) {
          const combat = this.entities.getComponent(entityId, 'Combat');
          if (combat) {
            combat.targetEntityId = cmd.targetEntityId;
          }
        }
        break;
      }

      case 'Pickup': {
        // Handled directly in PickupSystem, but we mark or flag entity
        // The PickupSystem checks entities with player tag or pickup commands
        const inventory = this.entities.getComponent(entityId, 'Inventory');
        if (inventory) {
          inventory.pendingPickupItemId = cmd.targetItemId ?? null;
          inventory.wantsPickup = true;
        }
        break;
      }

      case 'ChangeSkillLoadout': {
        const skillSet = this.entities.getComponent(entityId, 'SkillSet');
        if (skillSet && cmd.slots) {
          skillSet.skillSlots = [...cmd.slots];
        }
        break;
      }

      case 'UsePotion': {
        const inventory = this.entities.getComponent(entityId, 'Inventory');
        if (inventory && health) {
          // Find potion item in inventory
          const potIndex = inventory.items.findIndex(
            it => it.templateId === (cmd.potionItemId || 'small_healing_potion') || it.templateId === 'large_healing_potion'
          );
          if (potIndex !== -1) {
            const pot = inventory.items[potIndex];
            const itemConf = this.configs.getItem(pot.templateId);
            const heal = itemConf?.healAmount ?? 50;
            health.currentHp = Math.min(health.maxHp, health.currentHp + heal);

            if (pot.count > 1) {
              pot.count--;
            } else {
              inventory.items.splice(potIndex, 1);
            }
          }
        }
        break;
      }
    }
  }
}
