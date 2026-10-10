/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EntityManager } from '../entity/EntityManager';
import { EventBus } from '../events/EventBus';
import { SeededRNG } from '../rng/SeededRNG';
import { ConfigLoader } from '../data/ConfigLoader';

export class SkillSystem {
  constructor(
    private entities: EntityManager,
    private eventBus: EventBus,
    private rng: SeededRNG,
    private configs: ConfigLoader
  ) {}

  public update(dt: number): void {
    const casters = this.entities.query(['Transform', 'SkillSet', 'Health']);

    for (const casterId of casters) {
      const transform = this.entities.getComponent(casterId, 'Transform');
      const skillSet = this.entities.getComponent(casterId, 'SkillSet');
      const health = this.entities.getComponent(casterId, 'Health');
      const combat = this.entities.getComponent(casterId, 'Combat');
      const player = this.entities.getComponent(casterId, 'Player');

      if (!transform || !skillSet || !health || health.isDead) {
        continue;
      }

      // Tick cooldowns
      for (const skillId of Object.keys(skillSet.cooldowns)) {
        if (skillSet.cooldowns[skillId] > 0) {
          skillSet.cooldowns[skillId] = Math.max(0, skillSet.cooldowns[skillId] - dt);
        }
      }

      // Passive Mana Regeneration: ~1.5 MP/s
      if (skillSet.currentMana < skillSet.maxMana) {
        const eneBonus = player ? player.stats.energy * 0.05 : 0;
        skillSet.currentMana = Math.min(skillSet.maxMana, skillSet.currentMana + (1.2 + eneBonus) * dt);
      }

      // Check if a skill cast was requested
      if (skillSet.castingSkillId) {
        const skillId = skillSet.castingSkillId;
        skillSet.castingSkillId = null;

        const skillConf = this.configs.getSkill(skillId);
        if (!skillConf) continue;

        // Check cooldown
        const currentCd = skillSet.cooldowns[skillId] ?? 0;
        if (currentCd > 0) {
          continue; // Skill on cooldown
        }

        // Check mana
        if (skillSet.currentMana < skillConf.manaCost) {
          continue; // Not enough mana
        }

        // Consume mana and set cooldown
        skillSet.currentMana -= skillConf.manaCost;
        skillSet.cooldowns[skillId] = skillConf.cooldown;

        // Determine targets based on skill type
        this.executeSkill(casterId, skillConf);
      }
    }
  }

  private executeSkill(casterId: number, skill: ReturnType<ConfigLoader['getSkill']> & {}): void {
    const casterTransform = this.entities.getComponent(casterId, 'Transform')!;
    const casterCombat = this.entities.getComponent(casterId, 'Combat');
    const casterPlayer = this.entities.getComponent(casterId, 'Player');

    const baseDmg = casterCombat ? this.rng.range(casterCombat.damageMin, casterCombat.damageMax) : 20;
    const strBonus = casterPlayer ? Math.floor(casterPlayer.stats.strength / 5) : 0;
    const totalBase = (baseDmg + strBonus) * skill.damageMultiplier;

    this.eventBus.emit({
      type: 'OnSkillUsed',
      casterId,
      skillId: skill.id,
      skillName: skill.name,
      targetId: casterCombat?.targetEntityId ?? null,
      targetPos: { x: casterTransform.position.x, y: casterTransform.position.y },
      manaCost: skill.manaCost,
      aoeRadius: skill.aoeRadius
    });

    if (skill.effectType === 'aoe_circle') {
      // Signature Mu Online Twisting Slash! Hits all monster entities in radius
      const monsters = this.entities.getEntitiesByTag('Monster');
      for (const mId of monsters) {
        const mTransform = this.entities.getComponent(mId, 'Transform');
        const mHealth = this.entities.getComponent(mId, 'Health');
        const mCombat = this.entities.getComponent(mId, 'Combat');
        if (!mTransform || !mHealth || mHealth.isDead) continue;

        const dist = Math.hypot(
          mTransform.position.x - casterTransform.position.x,
          mTransform.position.y - casterTransform.position.y
        );

        if (dist <= skill.aoeRadius) {
          this.applySkillDamage(casterId, mId, totalBase, mCombat?.defense ?? 0, mTransform.position);
        }
      }
    } else if (skill.effectType === 'single_target' || skill.effectType === 'dash') {
      // Hits targetEntityId or closest monster in front
      let targetId = casterCombat?.targetEntityId;
      if (!targetId || !this.entities.hasEntity(targetId)) {
        // Find closest monster within range
        const monsters = this.entities.getEntitiesByTag('Monster');
        let closestDist = skill.range;
        for (const mId of monsters) {
          const mTransform = this.entities.getComponent(mId, 'Transform');
          const mHealth = this.entities.getComponent(mId, 'Health');
          if (!mTransform || !mHealth || mHealth.isDead) continue;

          const dist = Math.hypot(
            mTransform.position.x - casterTransform.position.x,
            mTransform.position.y - casterTransform.position.y
          );
          if (dist < closestDist) {
            closestDist = dist;
            targetId = mId;
          }
        }
      }

      if (targetId && this.entities.hasEntity(targetId)) {
        const mTransform = this.entities.getComponent(targetId, 'Transform');
        const mHealth = this.entities.getComponent(targetId, 'Health');
        const mCombat = this.entities.getComponent(targetId, 'Combat');
        if (mTransform && mHealth && !mHealth.isDead) {
          this.applySkillDamage(casterId, targetId, totalBase, mCombat?.defense ?? 0, mTransform.position);
        }
      }
    }
  }

  private applySkillDamage(
    attackerId: number,
    targetId: number,
    damage: number,
    targetDefense: number,
    targetPos: { x: number; y: number; z: number }
  ): void {
    const targetHealth = this.entities.getComponent(targetId, 'Health');
    if (!targetHealth || targetHealth.isDead) return;

    const isCrit = this.rng.chance(0.18); // Skills have higher crit
    let finalDmg = Math.max(1, Math.floor(damage - targetDefense * 0.4));
    if (isCrit) {
      finalDmg = Math.floor(finalDmg * 1.35);
    }

    targetHealth.currentHp = Math.max(0, targetHealth.currentHp - finalDmg);

    this.eventBus.emit({
      type: 'OnEntityDamaged',
      targetId,
      sourceId: attackerId,
      damage: finalDmg,
      isCrit,
      isMiss: false,
      remainingHp: targetHealth.currentHp,
      position: { ...targetPos }
    });

    if (targetHealth.currentHp <= 0 && !targetHealth.isDead) {
      targetHealth.isDead = true;
      const ai = this.entities.getComponent(targetId, 'AI');
      const expReward = ai ? (this.configs.getMonster(ai.monsterTemplateId)?.expReward ?? 25) : 25;

      this.eventBus.emit({
        type: 'OnEntityDied',
        entityId: targetId,
        killerId: attackerId,
        expReward,
        position: { ...targetPos }
      });
    }
  }
}
