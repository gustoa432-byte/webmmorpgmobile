/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EntityManager } from '../entity/EntityManager';
import { EventBus } from '../events/EventBus';
import { SeededRNG } from '../rng/SeededRNG';
import { ConfigLoader } from '../data/ConfigLoader';

export class CombatSystem {
  constructor(
    private entities: EntityManager,
    private eventBus: EventBus,
    private rng: SeededRNG,
    private configs: ConfigLoader
  ) {}

  public update(dt: number): void {
    const combatants = this.entities.query(['Transform', 'Combat', 'Health']);

    for (const attackerId of combatants) {
      const transform = this.entities.getComponent(attackerId, 'Transform');
      const combat = this.entities.getComponent(attackerId, 'Combat');
      const health = this.entities.getComponent(attackerId, 'Health');
      const movement = this.entities.getComponent(attackerId, 'Movement');

      if (!transform || !combat || !health || health.isDead) {
        continue;
      }

      // Decrement attack cooldown timer
      if (combat.attackTimer > 0) {
        combat.attackTimer -= dt;
      }

      // Decrement attack animation timer
      if (combat.attackAnimationTimer > 0) {
        combat.attackAnimationTimer -= dt;
        if (combat.attackAnimationTimer <= 0) {
          combat.isAttacking = false;
        }
      }

      // Check if target is valid and alive
      const targetId = combat.targetEntityId;
      if (targetId === null) {
        continue;
      }

      if (!this.entities.hasEntity(targetId)) {
        combat.targetEntityId = null;
        continue;
      }

      const targetHealth = this.entities.getComponent(targetId, 'Health');
      const targetTransform = this.entities.getComponent(targetId, 'Transform');

      if (!targetHealth || targetHealth.isDead || !targetTransform) {
        combat.targetEntityId = null;
        continue;
      }

      // Calculate distance to target
      const dx = targetTransform.position.x - transform.position.x;
      const dy = targetTransform.position.y - transform.position.y;
      const distance = Math.hypot(dx, dy);

      // Player auto-approach logic:
      // If attacker is Player and distance > attackRange, steer towards target
      const isPlayer = this.entities.hasTag(attackerId, 'Player');
      if (isPlayer && distance > combat.attackRange) {
        if (movement) {
          movement.velocity = {
            x: (dx / distance) * movement.speed,
            y: (dy / distance) * movement.speed
          };
          movement.movementState = 'running';
          transform.rotation = Math.atan2(dy, dx);
        }
        continue; // Keep approaching until in attack range
      }

      // If in attack range, stop running and attack
      if (distance <= combat.attackRange) {
        if (isPlayer && movement && movement.targetPosition === null) {
          movement.velocity = { x: 0, y: 0 };
          movement.movementState = 'idle';
        }

        transform.rotation = Math.atan2(dy, dx);

        // Can we attack now?
        if (combat.attackTimer <= 0) {
          this.executeAutoAttack(attackerId, targetId, transform.position, targetTransform.position);
          const interval = 1.0 / Math.max(0.2, combat.attackSpeed);
          combat.attackTimer = interval;
          combat.isAttacking = true;
          combat.attackAnimationDuration = Math.min(interval * 0.6, 0.35);
          combat.attackAnimationTimer = combat.attackAnimationDuration;
        }
      }
    }
  }

  private executeAutoAttack(
    attackerId: number,
    targetId: number,
    attackerPos: { x: number; y: number; z: number },
    targetPos: { x: number; y: number; z: number }
  ): void {
    const combat = this.entities.getComponent(attackerId, 'Combat')!;
    const targetCombat = this.entities.getComponent(targetId, 'Combat');
    const targetHealth = this.entities.getComponent(targetId, 'Health')!;
    const playerComp = this.entities.getComponent(attackerId, 'Player');
    const targetPlayerComp = this.entities.getComponent(targetId, 'Player');

    // Calculate attack stats
    let minDmg = combat.damageMin;
    let maxDmg = combat.damageMax;

    if (playerComp) {
      // Dark knight strength contribution (STR / 6)
      const strBonus = Math.floor(playerComp.stats.strength / 6);
      minDmg += strBonus;
      maxDmg += strBonus;

      // Inventory weapon bonus
      const inv = this.entities.getComponent(attackerId, 'Inventory');
      if (inv?.equipment.weapon) {
        const weaponItem = this.configs.getItem(inv.equipment.weapon.templateId);
        if (weaponItem?.bonusDamage) {
          minDmg += weaponItem.bonusDamage;
          maxDmg += weaponItem.bonusDamage;
        }
      }
    }

    // Roll base raw damage
    let rawDamage = this.rng.range(minDmg, maxDmg);

    // Defense calculation
    let defense = targetCombat?.defense ?? 0;
    if (targetPlayerComp) {
      defense += Math.floor(targetPlayerComp.stats.agility / 3);
      const inv = this.entities.getComponent(targetId, 'Inventory');
      if (inv?.equipment) {
        for (const slotKey of ['armor', 'helm', 'pants', 'gloves', 'boots', 'shield'] as const) {
          const item = inv.equipment[slotKey];
          if (item) {
            const itemConf = this.configs.getItem(item.templateId);
            if (itemConf?.bonusDefense) {
              defense += itemConf.bonusDefense;
            }
          }
        }
      }
    }

    // Critical hit chance: 8% base + AGI / 100 for players
    const critChance = playerComp ? 0.08 + (playerComp.stats.agility * 0.001) : 0.04;
    const isCrit = this.rng.chance(critChance);

    let finalDamage = Math.max(1, rawDamage - Math.floor(defense * 0.5));
    if (isCrit) {
      finalDamage = Math.floor(maxDmg * 1.25) - Math.floor(defense * 0.3);
      finalDamage = Math.max(Math.floor(maxDmg * 0.8), finalDamage);
    }

    // Apply damage
    targetHealth.currentHp = Math.max(0, targetHealth.currentHp - finalDamage);

    this.eventBus.emit({
      type: 'OnEntityDamaged',
      targetId,
      sourceId: attackerId,
      damage: finalDamage,
      isCrit,
      isMiss: false,
      remainingHp: targetHealth.currentHp,
      position: { ...targetPos }
    });

    // Check for death
    if (targetHealth.currentHp <= 0 && !targetHealth.isDead) {
      targetHealth.isDead = true;
      targetHealth.deathTime = 0;

      // Calculate experience reward if victim was a monster
      let expReward = 0;
      const ai = this.entities.getComponent(targetId, 'AI');
      if (ai) {
        const monsterConfig = this.configs.getMonster(ai.monsterTemplateId);
        expReward = monsterConfig?.expReward ?? 25;
      }

      this.eventBus.emit({
        type: 'OnEntityDied',
        entityId: targetId,
        killerId: attackerId,
        expReward,
        position: { ...targetPos }
      });
    }
  }
}
