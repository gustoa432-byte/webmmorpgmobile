/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EntityManager } from '../entity/EntityManager';
import { SeededRNG } from '../rng/SeededRNG';
import { ConfigLoader } from '../data/ConfigLoader';

export interface DamageCalculationResult {
  damage: number;
  isCrit: boolean;
  isMiss: boolean;
}

export class DamageCalculator {
  /**
   * Unified damage calculation for both auto-attacks and skills.
   * Shared by CombatSystem and SkillSystem.
   */
  public static calculateDamage(
    attackerId: number,
    targetId: number,
    entities: EntityManager,
    rng: SeededRNG,
    configs: ConfigLoader,
    multiplier: number = 1.0,
    bonusCritChance: number = 0
  ): DamageCalculationResult {
    const attackerCombat = entities.getComponent(attackerId, 'Combat');
    const attackerPlayer = entities.getComponent(attackerId, 'Player');
    const attackerInv = entities.getComponent(attackerId, 'Inventory');

    const targetCombat = entities.getComponent(targetId, 'Combat');
    const targetPlayer = entities.getComponent(targetId, 'Player');
    const targetInv = entities.getComponent(targetId, 'Inventory');

    // 1. Attacker base damage range
    let minDmg = attackerCombat?.damageMin ?? 5;
    let maxDmg = attackerCombat?.damageMax ?? 10;

    // Dark Knight STR contribution (STR / 6)
    if (attackerPlayer) {
      const strBonus = Math.floor(attackerPlayer.stats.strength / 6);
      minDmg += strBonus;
      maxDmg += strBonus;
    }

    // Equipment weapon bonus
    if (attackerInv?.equipment.weapon) {
      const weaponConf = configs.getItem(attackerInv.equipment.weapon.templateId);
      if (weaponConf?.bonusDamage) {
        minDmg += weaponConf.bonusDamage;
        maxDmg += weaponConf.bonusDamage;
      }
    }

    // Roll base raw damage deterministically
    const rawRoll = rng.range(minDmg, maxDmg);
    const scaledRaw = Math.floor(rawRoll * multiplier);
    const scaledMax = Math.floor(maxDmg * multiplier);

    // 2. Target defense calculation
    let defense = targetCombat?.defense ?? 0;
    if (targetPlayer) {
      defense += Math.floor(targetPlayer.stats.agility / 3);
    }
    if (targetInv?.equipment) {
      const slots = ['armor', 'helm', 'pants', 'gloves', 'boots', 'shield'] as const;
      for (const slot of slots) {
        const item = targetInv.equipment[slot];
        if (item) {
          const itemConf = configs.getItem(item.templateId);
          if (itemConf?.bonusDefense) {
            defense += itemConf.bonusDefense;
          }
        }
      }
    }

    // 3. Critical strike chance
    let critChance = attackerPlayer ? 0.08 + (attackerPlayer.stats.agility * 0.001) : 0.05;
    critChance += bonusCritChance;
    const isCrit = rng.chance(critChance);

    // 4. Mitigation formula (Mu Online Season 1 style: defense absorbs ~50%)
    let finalDamage = Math.max(1, scaledRaw - Math.floor(defense * 0.5));

    if (isCrit) {
      // Signature critical damage: maximum theoretical ceiling + 25% crit bonus
      const critRaw = Math.floor(scaledMax * 1.25);
      finalDamage = Math.max(
        Math.floor(scaledMax * 0.8),
        critRaw - Math.floor(defense * 0.3)
      );
    }

    return {
      damage: Math.max(1, finalDamage),
      isCrit,
      isMiss: false
    };
  }
}
