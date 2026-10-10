/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Deterministic Pseudo-Random Number Generator using Mulberry32.
 * Strictly guarantees identical sequences for identical seeds.
 * Zero usage of Math.random().
 */
export class SeededRNG {
  private state: number;
  private readonly initialSeed: number;

  constructor(seed: number = 1337) {
    this.initialSeed = seed >>> 0;
    this.state = this.initialSeed;
  }

  /**
   * Resets RNG to initial seed.
   */
  public reset(): void {
    this.state = this.initialSeed;
  }

  /**
   * Returns current internal state integer.
   */
  public getState(): number {
    return this.state;
  }

  /**
   * Sets internal state integer directly (useful for snapshots/save states).
   */
  public setState(state: number): void {
    this.state = state >>> 0;
  }

  /**
   * Generates next unsigned 32-bit integer.
   */
  public nextUint32(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /**
   * Generates next float in range [0, 1).
   */
  public nextFloat(): number {
    return this.nextUint32() / 4294967296;
  }

  /**
   * Generates integer in range [min, max] inclusive.
   */
  public range(min: number, max: number): number {
    if (min >= max) return min;
    const span = max - min + 1;
    return min + Math.floor(this.nextFloat() * span);
  }

  /**
   * Generates float in range [min, max).
   */
  public rangeFloat(min: number, max: number): number {
    if (min >= max) return min;
    return min + this.nextFloat() * (max - min);
  }

  /**
   * Returns true with given probability [0, 1].
   */
  public chance(probability: number): boolean {
    if (probability <= 0) return false;
    if (probability >= 1) return true;
    return this.nextFloat() < probability;
  }

  /**
   * Picks a random element from an array deterministically.
   */
  public pick<T>(array: readonly T[]): T | undefined {
    if (array.length === 0) return undefined;
    const index = Math.floor(this.nextFloat() * array.length);
    return array[index];
  }
}
