/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EntityManager } from '../entity/EntityManager';
import { SeededRNG } from '../rng/SeededRNG';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export class AISystem {
  constructor(
    private entities: EntityManager,
    private rng: SeededRNG,
    private physics: PhysicsWorld
  ) {}

  public update(dt: number): void {
    const aiEntities = this.entities.query(['Transform', 'Movement', 'AI', 'Combat', 'Health']);
    const playerEntities = this.entities.getEntitiesByTag('Player');

    for (const id of aiEntities) {
      const transform = this.entities.getComponent(id, 'Transform');
      const movement = this.entities.getComponent(id, 'Movement');
      const ai = this.entities.getComponent(id, 'AI');
      const combat = this.entities.getComponent(id, 'Combat');
      const health = this.entities.getComponent(id, 'Health');

      if (!transform || !movement || !ai || !combat || !health) continue;

      if (health.isDead) {
        ai.state = 'idle';
        combat.targetEntityId = null;
        movement.velocity = { x: 0, y: 0 };
        continue;
      }

      // Check if target player exists and is alive
      let targetPlayerId: number | null = null;
      let targetDist = Infinity;
      let targetPos = { x: 0, y: 0 };

      // Find nearest living player
      for (const pId of playerEntities) {
        const pHealth = this.entities.getComponent(pId, 'Health');
        const pTransform = this.entities.getComponent(pId, 'Transform');
        if (!pHealth || pHealth.isDead || !pTransform) continue;

        // Check if player is in safe zone
        if (this.physics.grid.isSafeZone({ x: pTransform.position.x, y: pTransform.position.y })) {
          continue;
        }

        const dx = pTransform.position.x - transform.position.x;
        const dy = pTransform.position.y - transform.position.y;
        const dist = Math.hypot(dx, dy);

        if (dist < targetDist) {
          targetDist = dist;
          targetPlayerId = pId;
          targetPos = { x: pTransform.position.x, y: pTransform.position.y };
        }
      }

      // Calculate distance to spawn point
      const distFromSpawn = Math.hypot(
        transform.position.x - ai.spawnPoint.x,
        transform.position.y - ai.spawnPoint.y
      );

      // Leash check: if monster strayed too far from spawn, force return
      if (distFromSpawn > ai.leashRadius && ai.state !== 'returning') {
        ai.state = 'returning';
        combat.targetEntityId = null;
      }

      switch (ai.state) {
        case 'idle':
        case 'patrol': {
          combat.targetEntityId = null;

          // Aggro check: if player within aggro radius and in line of sight
          if (targetPlayerId !== null && targetDist <= ai.aggroRadius) {
            ai.state = 'chase';
            combat.targetEntityId = targetPlayerId;
            ai.targetEntityId = targetPlayerId;
            break;
          }

          // Idle wandering
          ai.wanderTimer -= dt;
          if (ai.wanderTimer <= 0) {
            ai.wanderTimer = ai.wanderInterval + this.rng.rangeFloat(-0.8, 0.8);
            if (this.rng.chance(0.6)) {
              // Pick random position near spawn point
              const angle = this.rng.rangeFloat(0, Math.PI * 2);
              const r = this.rng.rangeFloat(0.5, ai.wanderRadius);
              const targetX = ai.spawnPoint.x + Math.cos(angle) * r;
              const targetY = ai.spawnPoint.y + Math.sin(angle) * r;

              if (this.physics.canFitAt({ x: targetX, y: targetY }, 0.4)) {
                movement.targetPosition = { x: targetX, y: targetY };
              }
            } else {
              movement.targetPosition = null;
              movement.velocity = { x: 0, y: 0 };
              movement.movementState = 'idle';
            }
          }
          break;
        }

        case 'chase': {
          if (targetPlayerId === null || targetDist > ai.leashRadius * 1.2) {
            ai.state = 'returning';
            combat.targetEntityId = null;
            break;
          }

          combat.targetEntityId = targetPlayerId;

          if (targetDist <= combat.attackRange) {
            // Reached attack range! Transition to attack
            ai.state = 'attack';
            movement.targetPosition = null;
            movement.velocity = { x: 0, y: 0 };
            movement.movementState = 'idle';
            transform.rotation = Math.atan2(targetPos.y - transform.position.y, targetPos.x - transform.position.x);
          } else {
            // Chase towards player
            const dx = targetPos.x - transform.position.x;
            const dy = targetPos.y - transform.position.y;
            const dist = Math.hypot(dx, dy);

            movement.targetPosition = null;
            movement.velocity = {
              x: (dx / dist) * movement.speed,
              y: (dy / dist) * movement.speed
            };
            movement.movementState = 'running';
            transform.rotation = Math.atan2(dy, dx);
          }
          break;
        }

        case 'attack': {
          if (targetPlayerId === null) {
            ai.state = 'returning';
            combat.targetEntityId = null;
            break;
          }

          combat.targetEntityId = targetPlayerId;
          transform.rotation = Math.atan2(targetPos.y - transform.position.y, targetPos.x - transform.position.x);

          if (targetDist > combat.attackRange * 1.3) {
            // Target moved away; resume chase
            ai.state = 'chase';
          } else {
            // Stay in place during attack
            movement.velocity = { x: 0, y: 0 };
            movement.movementState = 'idle';
          }
          break;
        }

        case 'returning': {
          combat.targetEntityId = null;
          const dx = ai.spawnPoint.x - transform.position.x;
          const dy = ai.spawnPoint.y - transform.position.y;
          const dist = Math.hypot(dx, dy);

          if (dist <= 0.5) {
            // Reached spawn point
            ai.state = 'idle';
            movement.velocity = { x: 0, y: 0 };
            movement.movementState = 'idle';
            movement.targetPosition = null;
          } else {
            movement.velocity = {
              x: (dx / dist) * ai.returnSpeed,
              y: (dy / dist) * ai.returnSpeed
            };
            movement.movementState = 'running';
            transform.rotation = Math.atan2(dy, dx);
          }
          break;
        }
      }
    }
  }
}
