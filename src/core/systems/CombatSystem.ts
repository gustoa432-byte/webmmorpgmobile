/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EntityManager } from '../entity/EntityManager';
import { EventBus } from '../events/EventBus';
import { SeededRNG } from '../rng/SeededRNG';
import { ConfigLoader } from '../data/ConfigLoader';
import { DamageCalculator } from '../combat/DamageCalculator';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export class CombatSystem {
  constructor(
    private entities: EntityManager,
    private eventBus: EventBus,
    private rng: SeededRNG,
    private configs: ConfigLoader,
    private physics: PhysicsWorld
  ) {}

  public update(dt: number): void {
    const combatants = this.entities.query(['Transform', 'Combat', 'Health']);

    for (const attackerId of combatants) {
      const transform = this.entities.getComponent(attackerId, 'Transform');
      const combat = this.entities.getComponent(attackerId, 'Combat');
      const health = this.entities.getComponent(attackerId, 'Health');

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

      // Safe zone check: combat is disabled if either combatant is in safe zone
      if (
        this.physics.grid.isSafeZone({ x: transform.position.x, y: transform.position.y }) ||
        this.physics.grid.isSafeZone({ x: targetTransform.position.x, y: targetTransform.position.y })
      ) {
        continue;
      }

      // Calculate distance to target
      const dx = targetTransform.position.x - transform.position.x;
      const dy = targetTransform.position.y - transform.position.y;
      const distance = Math.hypot(dx, dy);

      // Attack phase: only execute attack when target is within attack range
      if (distance <= combat.attackRange) {
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
      // Note: If distance > combat.attackRange, MovementSystem handles approach cleanly!
    }
  }

  private executeAutoAttack(
    attackerId: number,
    targetId: number,
    _attackerPos: { x: number; y: number; z: number },
    targetPos: { x: number; y: number; z: number }
  ): void {
    const targetHealth = this.entities.getComponent(targetId, 'Health')!;

    // Unified damage calculation using DamageCalculator
    const calc = DamageCalculator.calculateDamage(
      attackerId,
      targetId,
      this.entities,
      this.rng,
      this.configs,
      1.0,
      0
    );

    targetHealth.currentHp = Math.max(0, targetHealth.currentHp - calc.damage);

    this.eventBus.emit({
      type: 'OnEntityDamaged',
      targetId,
      sourceId: attackerId,
      damage: calc.damage,
      isCrit: calc.isCrit,
      isMiss: calc.isMiss,
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
