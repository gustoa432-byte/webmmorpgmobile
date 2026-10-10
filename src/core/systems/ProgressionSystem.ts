/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EntityManager } from '../entity/EntityManager';
import { EventBus, OnEntityDiedEvent } from '../events/EventBus';

export class ProgressionSystem {
  private unsubscribe: (() => void) | null = null;
  private pendingExpGains: { playerId: number; exp: number }[] = [];

  constructor(
    private entities: EntityManager,
    private eventBus: EventBus
  ) {
    // Subscribe to OnEntityDied
    this.unsubscribe = this.eventBus.subscribe('OnEntityDied', (event: OnEntityDiedEvent) => {
      if (event.killerId && this.entities.hasTag(event.killerId, 'Player')) {
        this.pendingExpGains.push({
          playerId: event.killerId,
          exp: event.expReward
        });
      }
    });
  }

  public update(_dt: number): void {
    if (this.pendingExpGains.length === 0) return;

    const gains = this.pendingExpGains;
    this.pendingExpGains = [];

    for (const gain of gains) {
      if (!this.entities.hasEntity(gain.playerId)) continue;

      const player = this.entities.getComponent(gain.playerId, 'Player');
      const health = this.entities.getComponent(gain.playerId, 'Health');
      const skillSet = this.entities.getComponent(gain.playerId, 'SkillSet');

      if (!player || !health) continue;

      player.currentExp += gain.exp;

      // Check for level ups (can level up multiple times if huge exp)
      while (player.currentExp >= player.expToNextLevel) {
        player.currentExp -= player.expToNextLevel;
        player.level += 1;
        player.statPoints += 5;

        // Mu Online DK stat growth
        player.stats.strength += 2;
        player.stats.agility += 1;
        player.stats.vitality += 1;
        player.stats.energy += 1;

        // Next level formula
        player.expToNextLevel = Math.floor(player.expToNextLevel * 1.35 + 40);

        // Increase and fully heal HP & MP
        health.maxHp += 20;
        health.currentHp = health.maxHp;

        if (skillSet) {
          skillSet.maxMana += 8;
          skillSet.currentMana = skillSet.maxMana;
        }

        this.eventBus.emit({
          type: 'OnLevelUp',
          entityId: gain.playerId,
          newLevel: player.level,
          statPointsGained: 5
        });
      }
    }
  }

  public destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}
