/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EntityManager } from '../entity/EntityManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export class MovementSystem {
  constructor(
    private entities: EntityManager,
    private physics: PhysicsWorld
  ) {}

  public update(dt: number): void {
    const movableEntities = this.entities.query(['Transform', 'Movement', 'Collider']);

    for (const id of movableEntities) {
      const transform = this.entities.getComponent(id, 'Transform');
      const movement = this.entities.getComponent(id, 'Movement');
      const collider = this.entities.getComponent(id, 'Collider');
      const health = this.entities.getComponent(id, 'Health');

      if (!transform || !movement || !collider) continue;

      // Dead entities don't move
      if (health?.isDead) {
        movement.velocity = { x: 0, y: 0 };
        movement.movementState = 'idle';
        continue;
      }

      // Save previous position for render interpolation
      transform.previousPosition = { ...transform.position };

      const combat = this.entities.getComponent(id, 'Combat');
      const hasCombatTarget = combat && combat.targetEntityId !== null;

      // 1. Process directional movement (joystick / keyboard)
      if (movement.desiredDirection) {
        const dir = movement.desiredDirection;
        const len = Math.hypot(dir.x, dir.y);
        if (len > 0.001) {
          movement.velocity = {
            x: (dir.x / len) * movement.speed,
            y: (dir.y / len) * movement.speed
          };
          movement.movementState = 'running';
          transform.rotation = Math.atan2(dir.y, dir.x);
        } else {
          movement.velocity = { x: 0, y: 0 };
          movement.movementState = 'idle';
        }
      }
      // 2. Process point-and-click targetPosition
      else if (movement.targetPosition) {
        const dx = movement.targetPosition.x - transform.position.x;
        const dy = movement.targetPosition.y - transform.position.y;
        const dist = Math.hypot(dx, dy);

        if (dist <= 0.15) {
          movement.velocity = { x: 0, y: 0 };
          movement.targetPosition = null;
          movement.movementState = 'idle';
        } else {
          const speed = movement.speed;
          movement.velocity = {
            x: (dx / dist) * speed,
            y: (dy / dist) * speed
          };
          movement.movementState = 'running';
          transform.rotation = Math.atan2(dy, dx);
        }
      }
      // 3. Process combat target approach (auto-approach when entity has a target)
      else if (hasCombatTarget && this.entities.hasEntity(combat.targetEntityId!)) {
        const targetId = combat.targetEntityId!;
        const targetTrans = this.entities.getComponent(targetId, 'Transform');
        const targetHealth = this.entities.getComponent(targetId, 'Health');

        if (targetTrans && targetHealth && !targetHealth.isDead) {
          const dx = targetTrans.position.x - transform.position.x;
          const dy = targetTrans.position.y - transform.position.y;
          const dist = Math.hypot(dx, dy);

          // Face the target
          transform.rotation = Math.atan2(dy, dx);

          if (dist > combat.attackRange) {
            // Out of attack range -> approach target
            const speed = movement.speed;
            movement.velocity = {
              x: (dx / dist) * speed,
              y: (dy / dist) * speed
            };
            movement.movementState = 'running';
          } else {
            // In attack range -> stop moving and attack
            movement.velocity = { x: 0, y: 0 };
            movement.movementState = 'idle';
          }
        } else {
          combat.targetEntityId = null;
          movement.velocity = { x: 0, y: 0 };
          movement.movementState = 'idle';
        }
      } else {
        movement.velocity = { x: 0, y: 0 };
        movement.movementState = 'idle';
      }

      // Calculate desired displacement
      const desiredDelta = {
        x: movement.velocity.x * dt,
        y: movement.velocity.y * dt
      };

      if (desiredDelta.x !== 0 || desiredDelta.y !== 0) {
        // Resolve movement with physics wall sliding and step offset
        const result = this.physics.moveWithSliding(
          { x: transform.position.x, y: transform.position.y },
          desiredDelta,
          collider.radius,
          movement.stepOffset
        );

        transform.position.x = result.position.x;
        transform.position.y = result.position.y;

        // If stopped by collision while seeking a target point, stop trying
        if (result.collided && movement.targetPosition && Math.hypot(result.delta.x, result.delta.y) < 0.001) {
          movement.targetPosition = null;
          movement.velocity = { x: 0, y: 0 };
          movement.movementState = 'idle';
        }
      } else {
        movement.movementState = 'idle';
      }
    }

    // Dynamic entity separation: push overlapping solid entities apart
    for (let i = 0; i < movableEntities.length; i++) {
      const idA = movableEntities[i];
      const transformA = this.entities.getComponent(idA, 'Transform');
      const colliderA = this.entities.getComponent(idA, 'Collider');
      const healthA = this.entities.getComponent(idA, 'Health');
      if (!transformA || !colliderA || !colliderA.solid || healthA?.isDead) continue;

      for (let j = i + 1; j < movableEntities.length; j++) {
        const idB = movableEntities[j];
        const transformB = this.entities.getComponent(idB, 'Transform');
        const colliderB = this.entities.getComponent(idB, 'Collider');
        const healthB = this.entities.getComponent(idB, 'Health');
        if (!transformB || !colliderB || !colliderB.solid || healthB?.isDead) continue;

        const sep = this.physics.separateCircles(
          { x: transformA.position.x, y: transformA.position.y },
          colliderA.radius,
          { x: transformB.position.x, y: transformB.position.y },
          colliderB.radius
        );

        if (sep.collided) {
          // Push both away if walkable
          const newPosA = {
            x: transformA.position.x + sep.offsetA.x,
            y: transformA.position.y + sep.offsetA.y
          };
          if (this.physics.canFitAt(newPosA, colliderA.radius)) {
            transformA.position.x = newPosA.x;
            transformA.position.y = newPosA.y;
          }

          const newPosB = {
            x: transformB.position.x + sep.offsetB.x,
            y: transformB.position.y + sep.offsetB.y
          };
          if (this.physics.canFitAt(newPosB, colliderB.radius)) {
            transformB.position.x = newPosB.x;
            transformB.position.y = newPosB.y;
          }
        }
      }
    }
  }
}
