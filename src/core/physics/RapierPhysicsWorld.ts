/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import RAPIER from '@dimforge/rapier2d-compat';
import { EntityId, Vec2 } from '../types';
import { WalkabilityGrid } from './WalkabilityGrid';

export interface StaticObstacleEntry {
  id: string;
  x: number;
  y: number;
  radius: number;
  body: RAPIER.RigidBody;
}

export class RapierPhysicsWorld {
  public readonly world: RAPIER.World;
  public readonly eventQueue: RAPIER.EventQueue;
  public readonly grid: WalkabilityGrid;
  public readonly characterController: RAPIER.KinematicCharacterController;

  public readonly bodyMap: Map<EntityId, RAPIER.RigidBody> = new Map();
  public readonly colliderMap: Map<EntityId, RAPIER.Collider> = new Map();
  public readonly characterRadii: Map<EntityId, number> = new Map();
  public readonly staticObstacles: StaticObstacleEntry[] = [];

  public readonly worldBounds: { minX: number; maxX: number; minY: number; maxY: number };

  constructor(gridWidth: number = 48, gridHeight: number = 48, cellSize: number = 1.0) {
    this.grid = new WalkabilityGrid(gridWidth, gridHeight, cellSize);

    // 2D top-down game world with zero gravity (Mu Online isometric action)
    this.world = new RAPIER.World({ x: 0.0, y: 0.0 });
    this.eventQueue = new RAPIER.EventQueue(true);

    // Kinematic Character Controller with sliding and step offset
    this.characterController = this.world.createCharacterController(0.01);
    this.characterController.setSlideEnabled(true);
    // Step offset (0.3m allows smoothly stepping over small bumps/edges)
    this.characterController.enableAutostep(0.3, 0.2, true);
    this.characterController.setMaxSlopeClimbAngle(Math.PI / 2);
    this.characterController.setMinSlopeSlideAngle(0);

    this.worldBounds = {
      minX: 1.0,
      maxX: gridWidth * cellSize - 1.0,
      minY: 1.0,
      maxY: gridHeight * cellSize - 1.0
    };

    this.createBoundaryWalls(gridWidth * cellSize, gridHeight * cellSize);
  }

  /**
   * Builds fixed perimeter colliders along map edges.
   */
  private createBoundaryWalls(width: number, height: number): void {
    const thickness = 2.0;

    // Top wall
    const topBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(width / 2, -thickness / 2)
    );
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, thickness / 2), topBody);

    // Bottom wall
    const bottomBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(width / 2, height + thickness / 2)
    );
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, thickness / 2), bottomBody);

    // Left wall
    const leftBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(-thickness / 2, height / 2)
    );
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(thickness / 2, height / 2), leftBody);

    // Right wall
    const rightBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(width + thickness / 2, height / 2)
    );
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(thickness / 2, height / 2), rightBody);
  }

  /**
   * Registers a character (Player or Monster) as a Rapier Kinematic body with capsule/ball collider.
   */
  public createCharacterBody(
    entityId: EntityId,
    position: Vec2,
    radius: number,
    height: number = 1.0
  ): RAPIER.RigidBody {
    // Remove previous body if existed
    if (this.bodyMap.has(entityId)) {
      this.removeBody(entityId);
    }

    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(position.x, position.y);
    const body = this.world.createRigidBody(bodyDesc);

    // Capsule or Ball collider
    let colliderDesc: RAPIER.ColliderDesc;
    if (height > radius * 2.2) {
      const halfHeight = Math.max(0.05, (height - radius * 2) * 0.5);
      colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius);
    } else {
      colliderDesc = RAPIER.ColliderDesc.ball(radius);
    }

    // Set restitution and friction for natural feel
    colliderDesc.setFriction(0.1);
    colliderDesc.setRestitution(0.0);

    const collider = this.world.createCollider(colliderDesc, body);

    this.bodyMap.set(entityId, body);
    this.colliderMap.set(entityId, collider);
    this.characterRadii.set(entityId, radius);

    return body;
  }

  /**
   * Creates a static obstacle (pillar, fountain rim, stone structure) in Rapier.
   */
  public createStaticObstacle(id: string, x: number, y: number, radius: number): void {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y);
    const body = this.world.createRigidBody(bodyDesc);
    const colDesc = RAPIER.ColliderDesc.ball(radius);
    this.world.createCollider(colDesc, body);

    this.staticObstacles.push({ id, x, y, radius, body });
  }

  public addObstacle(id: string, x: number, y: number, radius: number): void {
    this.createStaticObstacle(id, x, y, radius);
  }

  /**
   * Removes a character's rigid body and collider from Rapier world.
   */
  public removeBody(entityId: EntityId): void {
    const body = this.bodyMap.get(entityId);
    if (body) {
      this.world.removeRigidBody(body);
      this.bodyMap.delete(entityId);
      this.colliderMap.delete(entityId);
      this.characterRadii.delete(entityId);
    }
  }

  /**
   * Sets linear velocity on kinematic/dynamic body.
   */
  public setLinearVelocity(entityId: EntityId, velocity: Vec2): void {
    const body = this.bodyMap.get(entityId);
    if (body) {
      body.setLinvel({ x: velocity.x, y: velocity.y }, true);
    }
  }

  /**
   * Teleports/sets position directly on a Rapier rigid body.
   */
  public setPosition(entityId: EntityId, position: Vec2): void {
    const body = this.bodyMap.get(entityId);
    if (body) {
      body.setTranslation({ x: position.x, y: position.y }, true);
      body.setNextKinematicTranslation({ x: position.x, y: position.y });
    }
  }

  /**
   * Gets current translation coordinates of an entity from Rapier.
   */
  public getPosition(entityId: EntityId): Vec2 {
    const body = this.bodyMap.get(entityId);
    if (body) {
      const t = body.translation();
      return { x: t.x, y: t.y };
    }
    return { x: 0, y: 0 };
  }

  /**
   * Moves a character using Rapier's KinematicCharacterController.
   * Handles sliding against walls and other characters, autostep, and boundary clamping.
   */
  public moveCharacter(
    entityId: EntityId,
    desiredMovement: Vec2,
    _dt: number
  ): { position: Vec2; delta: Vec2; collided: boolean } {
    const collider = this.colliderMap.get(entityId);
    const body = this.bodyMap.get(entityId);
    const radius = this.characterRadii.get(entityId) ?? 0.5;

    if (!collider || !body) {
      return {
        position: { x: 0, y: 0 },
        delta: { x: 0, y: 0 },
        collided: false
      };
    }

    const currentTranslation = body.translation();
    const currentPos = { x: currentTranslation.x, y: currentTranslation.y };

    if (desiredMovement.x === 0 && desiredMovement.y === 0) {
      return {
        position: currentPos,
        delta: { x: 0, y: 0 },
        collided: false
      };
    }

    // Compute movement with Rapier Kinematic Character Controller (sliding + autostep)
    this.characterController.computeColliderMovement(collider, desiredMovement);
    const computed = this.characterController.computedMovement();
    const numCollisions = this.characterController.numComputedCollisions();

    let targetX = currentPos.x + computed.x;
    let targetY = currentPos.y + computed.y;

    // Clamp within map bounds
    targetX = Math.max(this.worldBounds.minX + radius, Math.min(this.worldBounds.maxX - radius, targetX));
    targetY = Math.max(this.worldBounds.minY + radius, Math.min(this.worldBounds.maxY - radius, targetY));

    // Walkability grid check: ensure target does not penetrate into blocked grid tiles
    if (!this.grid.isWalkable({ x: targetX, y: targetY }, radius)) {
      if (this.grid.isWalkable({ x: targetX, y: currentPos.y }, radius)) {
        targetY = currentPos.y;
      } else if (this.grid.isWalkable({ x: currentPos.x, y: targetY }, radius)) {
        targetX = currentPos.x;
      } else {
        targetX = currentPos.x;
        targetY = currentPos.y;
      }
    }

    const actualDelta = {
      x: targetX - currentPos.x,
      y: targetY - currentPos.y
    };

    // Synchronize Rapier kinematic translation immediately
    body.setNextKinematicTranslation({ x: targetX, y: targetY });
    body.setTranslation({ x: targetX, y: targetY }, true);

    const collided =
      numCollisions > 0 ||
      Math.abs(actualDelta.x - desiredMovement.x) > 0.001 ||
      Math.abs(actualDelta.y - desiredMovement.y) > 0.001;

    return {
      position: { x: targetX, y: targetY },
      delta: actualDelta,
      collided
    };
  }

  /**
   * Checks walkability of a world point.
   */
  public isWalkable(pos: Vec2, radius: number = 0.4): boolean {
    return this.grid.isWalkable(pos, radius);
  }

  /**
   * Checks if point is inside town safe zone.
   */
  public isSafeZone(pos: Vec2): boolean {
    return this.grid.isSafeZone(pos);
  }

  /**
   * Validates whether a character of radius can fit at position without colliding with obstacles or grid.
   */
  public canFitAt(pos: Vec2, radius: number): boolean {
    if (
      pos.x - radius < this.worldBounds.minX ||
      pos.x + radius > this.worldBounds.maxX ||
      pos.y - radius < this.worldBounds.minY ||
      pos.y + radius > this.worldBounds.maxY
    ) {
      return false;
    }

    if (!this.grid.isWalkable(pos, radius)) {
      return false;
    }

    for (const obs of this.staticObstacles) {
      const dx = pos.x - obs.x;
      const dy = pos.y - obs.y;
      const distSq = dx * dx + dy * dy;
      const minDist = radius + obs.radius;
      if (distSq < minDist * minDist) {
        return false;
      }
    }

    return true;
  }

  /**
   * Advances the Rapier physics simulation by fixed timestep dt.
   */
  public step(_dt?: number): void {
    this.world.step(this.eventQueue);
  }

  /**
   * Frees Rapier WASM resources.
   */
  public destroy(): void {
    try {
      this.characterController.free();
      this.world.free();
    } catch (_e) {
      // Ignore cleanup error if already freed
    }
    this.bodyMap.clear();
    this.colliderMap.clear();
    this.characterRadii.clear();
    this.staticObstacles.length = 0;
  }
}
