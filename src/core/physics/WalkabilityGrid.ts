/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Vec2 } from '../types';

export enum TileAttribute {
  WALKABLE = 0,
  BLOCKED = 1,
  SAFE_ZONE = 2,
  WATER = 3
}

/**
 * Walkability Grid inspired by Mu Online .att (Attribute) map grid.
 * Divides the world coordinates into discrete tile cells.
 */
export class WalkabilityGrid {
  public readonly width: number;
  public readonly height: number;
  public readonly cellSize: number;
  private readonly tiles: Uint8Array;

  constructor(width: number, height: number, cellSize: number = 1.0) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.tiles = new Uint8Array(width * height);
    // Fill all as WALKABLE initially
    this.tiles.fill(TileAttribute.WALKABLE);
  }

  public worldToGrid(worldPos: Vec2): { gx: number; gy: number } {
    return {
      gx: Math.floor(worldPos.x / this.cellSize),
      gy: Math.floor(worldPos.y / this.cellSize)
    };
  }

  public gridToWorld(gx: number, gy: number): Vec2 {
    return {
      x: (gx + 0.5) * this.cellSize,
      y: (gy + 0.5) * this.cellSize
    };
  }

  public isInBounds(gx: number, gy: number): boolean {
    return gx >= 0 && gx < this.width && gy >= 0 && gy < this.height;
  }

  public getTile(gx: number, gy: number): TileAttribute {
    if (!this.isInBounds(gx, gy)) {
      return TileAttribute.BLOCKED;
    }
    return this.tiles[gy * this.width + gx];
  }

  public setTile(gx: number, gy: number, attr: TileAttribute): void {
    if (this.isInBounds(gx, gy)) {
      this.tiles[gy * this.width + gx] = attr;
    }
  }

  public isWalkable(worldPos: Vec2, radius: number = 0.4): boolean {
    // Check 4 sample points around radius
    const samples: Vec2[] = [
      { x: worldPos.x, y: worldPos.y },
      { x: worldPos.x + radius, y: worldPos.y },
      { x: worldPos.x - radius, y: worldPos.y },
      { x: worldPos.x, y: worldPos.y + radius },
      { x: worldPos.x, y: worldPos.y - radius }
    ];

    for (const pt of samples) {
      const { gx, gy } = this.worldToGrid(pt);
      const tile = this.getTile(gx, gy);
      if (tile === TileAttribute.BLOCKED) {
        return false;
      }
    }

    return true;
  }

  public isSafeZone(worldPos: Vec2): boolean {
    const { gx, gy } = this.worldToGrid(worldPos);
    return this.getTile(gx, gy) === TileAttribute.SAFE_ZONE;
  }

  /**
   * Simple Bresenham raycast line-of-sight test on the grid.
   */
  public hasLineOfSight(from: Vec2, to: Vec2): boolean {
    let x0 = Math.floor(from.x / this.cellSize);
    let y0 = Math.floor(from.y / this.cellSize);
    const x1 = Math.floor(to.x / this.cellSize);
    const y1 = Math.floor(to.y / this.cellSize);

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      if (this.getTile(x0, y0) === TileAttribute.BLOCKED) {
        return false;
      }
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
    return true;
  }
}
