/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Core } from '../core/Core';
import { Sword, Wind, Flame, Zap, Package, HeartPulse, RefreshCw } from 'lucide-react';

interface SkillHotbarProps {
  core: Core;
  onOpenInventory: () => void;
}

const SKILL_ICONS: Record<string, React.ReactNode> = {
  weapon_skill: <Sword className="w-5 h-5 text-amber-300" />,
  cyclone: <Wind className="w-5 h-5 text-emerald-300" />,
  slash: <Flame className="w-5 h-5 text-orange-400" />,
  twisting_slash: <Zap className="w-5 h-5 text-cyan-300" />
};

export const SkillHotbar: React.FC<SkillHotbarProps> = ({ core, onOpenInventory }) => {
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [mana, setMana] = useState({ current: 20, max: 20 });
  const [hp, setHp] = useState({ current: 110, max: 110, isDead: false });
  const [potionCount, setPotionCount] = useState(0);

  const playerId = core.getPlayerId();

  // Poll state smoothly for UI display
  useEffect(() => {
    const interval = setInterval(() => {
      const skillSet = core.entities.getComponent(playerId, 'SkillSet');
      const health = core.entities.getComponent(playerId, 'Health');
      const inv = core.entities.getComponent(playerId, 'Inventory');

      if (skillSet) {
        setCooldowns({ ...skillSet.cooldowns });
        setMana({ current: Math.floor(skillSet.currentMana), max: skillSet.maxMana });
      }

      if (health) {
        setHp({ current: Math.floor(health.currentHp), max: health.maxHp, isDead: health.isDead });
      }

      if (inv) {
        const pots = inv.items.filter(i => i.templateId.includes('potion'));
        const total = pots.reduce((sum, p) => sum + p.count, 0);
        setPotionCount(total);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [core, playerId]);

  // Keyboard shortcut listeners (1-4, Q, Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key >= '1' && e.key <= '4') {
        const slot = parseInt(e.key, 10);
        triggerSkill(slot);
      } else if (e.key === 'q' || e.key === 'Q') {
        triggerPotion();
      } else if (e.code === 'Space') {
        e.preventDefault();
        triggerPickup();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [core, playerId]);

  const triggerSkill = (slot: number) => {
    core.enqueueCommand({
      type: 'UseSkill',
      entityId: playerId,
      slot
    });
  };

  const triggerPickup = () => {
    core.enqueueCommand({
      type: 'Pickup',
      entityId: playerId
    });
  };

  const triggerPotion = () => {
    core.enqueueCommand({
      type: 'UsePotion',
      entityId: playerId
    });
  };

  const triggerRespawn = () => {
    core.enqueueCommand({
      type: 'Respawn',
      entityId: playerId
    });
  };

  const allSkills = core.configs.getAllSkills();

  return (
    <div className="flex flex-col items-center gap-2 pointer-events-auto">
      {/* Dead notice / Respawn prompt */}
      {hp.isDead && (
        <div className="flex items-center gap-3 bg-red-950/90 border border-red-500/80 px-4 py-2 rounded-lg backdrop-blur shadow-2xl animate-pulse">
          <span className="text-red-200 font-bold text-sm">You have died in battle!</span>
          <button
            onClick={triggerRespawn}
            className="flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-bold rounded transition shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Respawn in Lorencia
          </button>
        </div>
      )}

      {/* Resource Globes / Health & Mana Bars */}
      <div className="flex items-center gap-4 bg-slate-900/90 border border-slate-700/80 px-4 py-2 rounded-full backdrop-blur shadow-xl">
        {/* HP */}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <div className="text-xs font-mono font-bold text-red-300">
            HP {hp.current} / {hp.max}
          </div>
        </div>

        <div className="h-4 w-px bg-slate-700" />

        {/* MP */}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-cyan-500" />
          <div className="text-xs font-mono font-bold text-cyan-300">
            MP {mana.current} / {mana.max}
          </div>
        </div>
      </div>

      {/* Main Action Bar */}
      <div className="flex items-center gap-2 bg-slate-900/95 border border-slate-700/90 p-2 rounded-2xl backdrop-blur shadow-2xl">
        {/* Skills 1 to 4 */}
        {allSkills.map(skill => {
          const cdRemaining = cooldowns[skill.id] ?? 0;
          const isOnCd = cdRemaining > 0;
          const notEnoughMp = mana.current < skill.manaCost;
          const isDisabled = hp.isDead || isOnCd || notEnoughMp;

          return (
            <button
              key={skill.id}
              onClick={() => triggerSkill(skill.slot)}
              disabled={hp.isDead}
              title={`${skill.name} (MP: ${skill.manaCost}) - ${skill.description}`}
              className={`relative group flex flex-col items-center justify-center w-13 h-13 rounded-xl border transition-all active:scale-95 ${
                isDisabled
                  ? 'bg-slate-800/60 border-slate-700 text-slate-500'
                  : 'bg-gradient-to-b from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 border-amber-500/40 hover:border-amber-400 text-slate-100 shadow-md'
              }`}
            >
              {/* Cooldown Overlay */}
              {isOnCd && (
                <div className="absolute inset-0 bg-slate-950/80 rounded-xl flex items-center justify-center z-10">
                  <span className="text-xs font-mono font-bold text-amber-300">
                    {cdRemaining.toFixed(1)}s
                  </span>
                </div>
              )}

              {/* Icon */}
              <div className="z-0 mb-0.5">{SKILL_ICONS[skill.id]}</div>

              {/* Hotkey Tag & Mana */}
              <div className="flex items-center justify-between w-full px-1.5 text-[9px] text-slate-400 font-mono">
                <span>[{skill.slot}]</span>
                <span className="text-cyan-400 font-semibold">{skill.manaCost}m</span>
              </div>
            </button>
          );
        })}

        <div className="h-8 w-px bg-slate-700/70 mx-1" />

        {/* Potion Button [Q] */}
        <button
          onClick={triggerPotion}
          disabled={potionCount <= 0 || hp.isDead}
          title="Use Potion [Q]"
          className="relative flex flex-col items-center justify-center w-13 h-13 rounded-xl border border-red-500/40 bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 text-red-300 transition-all shadow-md"
        >
          <HeartPulse className="w-5 h-5 text-red-400" />
          <span className="text-[9px] font-mono font-bold text-red-200">
            [Q] {potionCount}
          </span>
        </button>

        {/* Pickup Button [Space] */}
        <button
          onClick={triggerPickup}
          disabled={hp.isDead}
          title="Pick Up Loot [Space]"
          className="flex flex-col items-center justify-center w-13 h-13 rounded-xl border border-yellow-500/40 bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 text-yellow-300 transition-all shadow-md"
        >
          <Package className="w-5 h-5 text-yellow-400" />
          <span className="text-[9px] font-mono text-slate-400">[Space]</span>
        </button>

        {/* Inventory Toggle Button */}
        <button
          onClick={onOpenInventory}
          title="Inventory & Stats [I]"
          className="flex flex-col items-center justify-center w-13 h-13 rounded-xl border border-blue-500/40 bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 text-blue-300 transition-all shadow-md"
        >
          <Package className="w-5 h-5 text-blue-400" />
          <span className="text-[9px] font-mono text-slate-400">Bag</span>
        </button>
      </div>
    </div>
  );
};
