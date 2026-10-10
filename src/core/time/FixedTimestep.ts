/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class FixedTimestep {
  private ticksPerSecond: number;
  private fixedDeltaTime: number; // in seconds (e.g. 0.05 for 20 TPS)
  private accumulator: number = 0; // in seconds
  private tickCount: number = 0;
  private maxSubSteps: number = 5; // prevent spiral of death

  constructor(ticksPerSecond: number = 20) {
    this.ticksPerSecond = ticksPerSecond;
    this.fixedDeltaTime = 1.0 / ticksPerSecond;
  }

  public get tps(): number {
    return this.ticksPerSecond;
  }

  public set tps(value: number) {
    this.ticksPerSecond = Math.max(10, Math.min(60, value));
    this.fixedDeltaTime = 1.0 / this.ticksPerSecond;
  }

  public get dt(): number {
    return this.fixedDeltaTime;
  }

  public get ticks(): number {
    return this.tickCount;
  }

  /**
   * Resets simulation time and tick counter.
   */
  public reset(): void {
    this.accumulator = 0;
    this.tickCount = 0;
  }

  /**
   * Adds frame time and runs the fixed update callback as many times as necessary.
   * Returns current interpolation alpha [0, 1] for render interpolation.
   */
  public step(frameDeltaTimeSeconds: number, onTick: (fixedDt: number, tick: number) => void): number {
    // Clamp frame time to prevent massive jumps when tab was in background
    const clampedDt = Math.min(frameDeltaTimeSeconds, 0.25);
    this.accumulator += clampedDt;

    let subSteps = 0;
    while (this.accumulator >= this.fixedDeltaTime && subSteps < this.maxSubSteps) {
      this.tickCount++;
      onTick(this.fixedDeltaTime, this.tickCount);
      this.accumulator -= this.fixedDeltaTime;
      subSteps++;
    }

    if (subSteps >= this.maxSubSteps) {
      // Discard remaining accumulator if running too slow to prevent spiral of death
      this.accumulator = 0;
    }

    // Alpha for render interpolation: how far along we are towards the next tick
    return this.accumulator / this.fixedDeltaTime;
  }

  /**
   * Directly steps one single tick (e.g. for step-by-step debugger or test suites).
   */
  public stepSingleTick(onTick: (fixedDt: number, tick: number) => void): void {
    this.tickCount++;
    onTick(this.fixedDeltaTime, this.tickCount);
  }
}
