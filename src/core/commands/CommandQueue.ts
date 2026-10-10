/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Command } from './Command';

export class CommandQueue {
  private queue: Command[] = [];

  /**
   * Adds a command to the queue.
   */
  public enqueue(command: Command): void {
    this.queue.push(command);
  }

  /**
   * Drains and returns all commands currently buffered.
   */
  public drain(): Command[] {
    const commands = this.queue;
    this.queue = [];
    return commands;
  }

  /**
   * Returns current count of queued commands.
   */
  public get length(): number {
    return this.queue.length;
  }

  /**
   * Clears all pending commands.
   */
  public clear(): void {
    this.queue = [];
  }

  /**
   * Serializes pending commands to JSON string.
   */
  public serialize(): string {
    return JSON.stringify(this.queue);
  }

  /**
   * Deserializes and appends commands from JSON string.
   */
  public deserialize(json: string): void {
    try {
      const parsed = JSON.parse(json) as Command[];
      if (Array.isArray(parsed)) {
        this.queue.push(...parsed);
      }
    } catch (_e) {
      // Ignored malformed command queue payload in headless mode
    }
  }
}
