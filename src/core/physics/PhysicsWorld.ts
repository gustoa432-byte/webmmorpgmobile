/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RapierPhysicsWorld, StaticObstacleEntry } from './RapierPhysicsWorld';

export type { StaticObstacleEntry as StaticObstacle };
export { RapierPhysicsWorld };

/**
 * Authoritative PhysicsWorld using Rapier 2D WASM with Kinematic Character Controller,
 * wall sliding, autostep, and WalkabilityGrid integration.
 */
export class PhysicsWorld extends RapierPhysicsWorld {
  constructor(gridWidth: number = 48, gridHeight: number = 48, cellSize: number = 1.0) {
    super(gridWidth, gridHeight, cellSize);
  }
}
