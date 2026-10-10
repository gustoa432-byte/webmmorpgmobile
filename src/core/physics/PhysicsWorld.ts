/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Vec2 } from '../types';
import { WalkabilityGrid } from './WalkabilityGrid';

export interface StaticObstacle {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export class PhysicsWorld {
  public grid: WalkabilityGrid;
  public staticObstacles: StaticObstacle[] = [];
  public worldBounds: { minX: number; maxX: number; minY: number; maxY: number };

  constructor(gridWidth: number = 64, gridHeight: number = 64, cellSize: number = 1.0) {
    this.grid = new WalkabilityGrid(gridWidth, gridHeight, cellSize);
    this.worldBounds = {
      minX: 1.0,
      maxX: gridWidth * cellSize - 1.0,
      minY: 1.0,
      maxY: gridHeight * cellSize - 1.0
    };
  }

  public addObstacle(id: string, x: number, y: number, radius: number): void {
    this.staticObstacles.push({ id, x, y, radius });
  }

  /**
   * Resolves desired movement with wall sliding and step offset.
   * Returns final valid position and actual displacement.
   */
  public moveWithSliding(
    currentPos: Vec2,
    desiredDelta: Vec2,
    colliderRadius: number,
    stepOffset: number = 0.2
  ): { position: Vec2; delta: Vec2; collided: boolean } {
    let targetX = currentPos.x + desiredDelta.x;
    let targetY = currentPos.y + desiredDelta.y;

    // First clamp within map boundaries
    targetX = Math.max(this.worldBounds.minX + colliderRadius, Math.min(this.worldBounds.maxX - colliderRadius, targetX));
    targetY = Math.max(this.worldBounds.minY + colliderRadius, Math.min(this.worldBounds.maxY - colliderRadius, targetY));

    // Try full step first
    if (this.canFitAt({ x: targetX, y: targetY }, colliderRadius)) {
      return {
        position: { x: targetX, y: targetY },
        delta: { x: targetX - currentPos.x, y: targetY - currentPos.y },
        collided: false
      };
    }

    // Full step failed; attempt sliding along X axis only
    let collided = true;
    let finalX = currentPos.x;
    let finalY = currentPos.y;

    if (desiredDelta.x !== 0 && this.canFitAt({ x: targetX, y: currentPos.y }, colliderRadius)) {
      finalX = targetX;
    }

    // Attempt sliding along Y axis only
    if (desiredDelta.y !== 0 && this.canFitAt({ x: finalX, y: targetY }, colliderRadius)) {
      finalY = targetY;
    } else if (desiredDelta.y !== 0 && this.canFitAt({ x: currentPos.x, y: targetY }, colliderRadius)) {
      finalY = targetY;
    }

    // Step offset allowance: check if slight perpendicular nudge or small obstacle clearance allows forward motion
    if (finalX === currentPos.x && finalY === currentPos.y && (desiredDelta.x !== 0 || desiredDelta.y !== 0)) {
      const smallStep = stepOffset * 0.5;
      const testOffsets = [
        { x: desiredDelta.x * 0.5, y: 0 },
        { x: 0, y: desiredDelta.y * 0.5 },
        { x: -desiredDelta.y * smallStep, y: desiredDelta.x * smallStep },
        { x: desiredDelta.y * smallStep, y: -desiredDelta.x * smallStep }
      ];

      for (const offset of testOffsets) {
        const testPos = { x: currentPos.x + offset.x, y: currentPos.y + offset.y };
        if (this.canFitAt(testPos, colliderRadius)) {
          finalX = testPos.x;
          finalY = testPos.y;
          break;
        }
      }
    }

    return {
      position: { x: finalX, y: finalY },
      delta: { x: finalX - currentPos.x, y: finalY - currentPos.y },
      collided
    };
  }

  /**
   * Checks whether a capsule/circle with radius can fit at pos without colliding with grid or static obstacles.
   */
  public canFitAt(pos: Vec2, radius: number): boolean {
    // Check map bounds
    if (
      pos.x - radius < this.worldBounds.minX ||
      pos.x + radius > this.worldBounds.maxX ||
      pos.y - radius < this.worldBounds.minY ||
      pos.y + radius > this.worldBounds.maxY
    ) {
      return false;
    }

    // Check Walkability Grid
    if (!this.grid.isWalkable(pos, radius)) {
      return false;
    }

    // Check Static Obstacles (pillars, ruins, rocks)
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
   * Separates two dynamic circular colliders to prevent mutual overlapping.
   */
  public separateCircles(
    posA: Vec2,
    radiusA: number,
    posB: Vec2,
    radiusB: number
  ): { offsetA: Vec2; offsetB: Vec2; collided: boolean } {
    const dx = posB.x - posA.x;
    const dy = posB.y - posA.y;
    const distSq = dx * dx + dy * dy;
    const minDist = radiusA + radiusB;

    if (distSq >= minDist * minDist || distSq === 0) {
      return {
        offsetA: { x: 0, y: 0 },
        offsetB: { x: 0, y: 0 },
        collided: false
      };
    }

    const dist = Math.sqrt(distSq);
    const overlap = minDist - dist;
    const nx = dx / dist;
    const ny = dy / dist;

    const halfOverlap = overlap * 0.5;

    return {
      offsetA: { x: -nx * halfOverlap, y: -ny * halfOverlap },
      offsetB: { x: nx * halfOverlap, y: ny * halfOverlap },
      collided: true
    };
  }
}
