/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Core } from '../core/Core';
import { Sword, Wind, Flame, Zap, Shield, Sparkles, X, Check } from 'lucide-react';

interface ActionZoneProps {
  core: Core;
}

type ActionDirection = 'up' | 'down' | 'left' | 'right';

const SKILL_ICONS: Record<string, React.ReactNode> = {
  weapon_skill: <Sword className="w-5 h-5 text-amber-300" />,
  cyclone: <Wind className="w-5 h-5 text-emerald-300" />,
  slash: <Flame className="w-5 h-5 text-orange-400" />,
  twisting_slash: <Zap className="w-5 h-5 text-cyan-300" />
};

// Slot mapping according to TZ:
// ↑ Up: Slot 1 (Защита / Оружейный навык)
// → Right: Slot 2 (Магия 1 / Смерч)
// ← Left: Slot 3 (Меч/осн. / Рубящий удар)
// ↓ Down: Slot 4 (Магия 2 / AoE / Вихревой удар)
const DIRECTION_TO_SLOT: Record<ActionDirection, number> = {
  up: 1,
  right: 2,
  left: 3,
  down: 4
};

export const ActionZone: React.FC<ActionZoneProps> = ({ core }) => {
  const [activeDirection, setActiveDirection] = useState<ActionDirection | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [isSwiping, setIsSwiping] = useState(false);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [currentMana, setCurrentMana] = useState(20);
  const [showLoadoutMenu, setShowLoadoutMenu] = useState(false);
  const [selectedSlotForSwap, setSelectedSlotForSwap] = useState<number | null>(null);
  const [justActivatedSkill, setJustActivatedSkill] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const holdTimerRef = useRef<number | null>(null);
  const isHoldTriggeredRef = useRef(false);

  const playerId = core.getPlayerId();

  // Poll player skills and cooldowns
  useEffect(() => {
    const interval = setInterval(() => {
      const skillSet = core.entities.getComponent(playerId, 'SkillSet');
      if (skillSet) {
        setCooldowns({ ...skillSet.cooldowns });
        setCurrentMana(Math.floor(skillSet.currentMana));
      }
    }, 50);

    return () => clearInterval(interval);
  }, [core, playerId]);

  // Keyboard shortcut fallback for desktop (1-4 keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key >= '1' && e.key <= '4') {
        const slot = parseInt(e.key, 10);
        executeSkillSlot(slot);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [core, playerId]);

  const executeSkillSlot = useCallback((slot: number) => {
    const skillSet = core.entities.getComponent(playerId, 'SkillSet');
    const skillId = skillSet?.skillSlots[slot - 1];
    if (skillId) {
      setJustActivatedSkill(skillId);
      setTimeout(() => setJustActivatedSkill(null), 300);
    }

    core.enqueueCommand({
      type: 'UseSkill',
      entityId: playerId,
      slot
    });
  }, [core, playerId]);

  // Pointer event handlers for gesture-driven Action Zone
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (pointerIdRef.current !== null) return;

    pointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // fallback
    }

    startPosRef.current = { x: e.clientX, y: e.clientY };
    isHoldTriggeredRef.current = false;
    setIsSwiping(true);
    setActiveDirection(null);
    setKnobOffset({ x: 0, y: 0 });

    // Hold timer for Quick Loadout menu (> 450ms without swipe)
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = window.setTimeout(() => {
      isHoldTriggeredRef.current = true;
      setShowLoadoutMenu(true);
      setIsSwiping(false);
      setActiveDirection(null);
      setKnobOffset({ x: 0, y: 0 });
    }, 450);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (pointerIdRef.current !== e.pointerId || isHoldTriggeredRef.current) return;

    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    const dist = Math.hypot(dx, dy);

    // Cancel hold timer once finger clearly moves
    if (dist > 15 && holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    // Deadzone and directional threshold (~20px)
    if (dist >= 20) {
      let dir: ActionDirection;
      if (Math.abs(dy) > Math.abs(dx)) {
        dir = dy < 0 ? 'up' : 'down';
      } else {
        dir = dx > 0 ? 'right' : 'left';
      }
      setActiveDirection(dir);

      // Clamp visual knob translation
      const maxOffset = 26;
      const angle = Math.atan2(dy, dx);
      setKnobOffset({
        x: Math.cos(angle) * maxOffset,
        y: Math.sin(angle) * maxOffset
      });
    } else {
      setActiveDirection(null);
      setKnobOffset({ x: dx * 0.5, y: dy * 0.5 });
    }
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (pointerIdRef.current !== e.pointerId) return;

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    // If hold was triggered, menu is opened; don't fire skill
    if (!isHoldTriggeredRef.current && activeDirection) {
      const slot = DIRECTION_TO_SLOT[activeDirection];
      executeSkillSlot(slot);
    }

    pointerIdRef.current = null;
    setIsSwiping(false);
    setActiveDirection(null);
    setKnobOffset({ x: 0, y: 0 });
  };

  const skillSet = core.entities.getComponent(playerId, 'SkillSet');
  const allSkills = core.configs.getAllSkills();

  // Retrieve skill IDs assigned to each slot (1 to 4)
  const slotSkills = [
    skillSet?.skillSlots[0] ?? 'weapon_skill',
    skillSet?.skillSlots[1] ?? 'cyclone',
    skillSet?.skillSlots[2] ?? 'slash',
    skillSet?.skillSlots[3] ?? 'twisting_slash'
  ];

  const getSkillConfig = (slotIndex: number) => {
    const id = slotSkills[slotIndex];
    return core.configs.getSkill(id);
  };

  const skillUp = getSkillConfig(0);     // Slot 1: ↑ Up
  const skillRight = getSkillConfig(1);  // Slot 2: → Right
  const skillLeft = getSkillConfig(2);   // Slot 3: ← Left
  const skillDown = getSkillConfig(3);   // Slot 4: ↓ Down

  const handleSwapSkill = (targetSlot: number, newSkillId: string) => {
    if (!skillSet) return;
    const newSlots = [...skillSet.skillSlots];
    newSlots[targetSlot - 1] = newSkillId;

    core.enqueueCommand({
      type: 'ChangeSkillLoadout',
      entityId: playerId,
      slots: newSlots
    });
    setSelectedSlotForSwap(null);
  };

  return (
    <>
      {/* Action Zone Outer Container (Zone 5) */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className="relative w-32 h-32 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center touch-none select-none pointer-events-auto shadow-2xl"
        title="Action-зона: Свайп ↑/→/↓/← для навыков, удержание для смены"
      >
        {/* Direction Sector Dividers */}
        <div className="absolute w-full h-px bg-slate-700/60" />
        <div className="absolute h-full w-px bg-slate-700/60" />

        {/* 1. UP Sector (Slot 1: Защита / Навык оружия) */}
        <div
          className={`absolute top-1 flex flex-col items-center justify-center transition-transform ${
            activeDirection === 'up' ? 'scale-115 text-amber-300' : 'text-slate-400'
          }`}
        >
          <div className="relative">
            {SKILL_ICONS[skillUp?.id ?? 'weapon_skill'] ?? <Shield className="w-4 h-4" />}
            {(cooldowns[skillUp?.id ?? ''] ?? 0) > 0 && (
              <span className="absolute -top-1 -right-2 px-1 bg-red-950 text-red-300 text-[8px] font-mono font-bold rounded">
                {(cooldowns[skillUp?.id ?? ''] ?? 0).toFixed(0)}с
              </span>
            )}
          </div>
          <span className="text-[8px] font-bold uppercase tracking-tight mt-0.5">
            ↑ {skillUp?.name?.split(' ')[0] ?? 'Удар'}
          </span>
        </div>

        {/* 2. RIGHT Sector (Slot 2: Смерч / Магия 1) */}
        <div
          className={`absolute right-1 flex flex-col items-center justify-center transition-transform ${
            activeDirection === 'right' ? 'scale-115 text-emerald-300' : 'text-slate-400'
          }`}
        >
          <div className="relative">
            {SKILL_ICONS[skillRight?.id ?? 'cyclone'] ?? <Wind className="w-4 h-4" />}
            {(cooldowns[skillRight?.id ?? ''] ?? 0) > 0 && (
              <span className="absolute -top-1 -right-2 px-1 bg-red-950 text-red-300 text-[8px] font-mono font-bold rounded">
                {(cooldowns[skillRight?.id ?? ''] ?? 0).toFixed(0)}с
              </span>
            )}
          </div>
          <span className="text-[8px] font-bold uppercase tracking-tight mt-0.5">
            {skillRight?.name?.split(' ')[0] ?? 'Смерч'} →
          </span>
        </div>

        {/* 3. DOWN Sector (Slot 4: AoE / Вихревой Удар) */}
        <div
          className={`absolute bottom-1 flex flex-col items-center justify-center transition-transform ${
            activeDirection === 'down' ? 'scale-115 text-cyan-300' : 'text-slate-400'
          }`}
        >
          <span className="text-[8px] font-bold uppercase tracking-tight mb-0.5">
            ↓ {skillDown?.name?.split(' ')[0] ?? 'Вихрь'}
          </span>
          <div className="relative">
            {SKILL_ICONS[skillDown?.id ?? 'twisting_slash'] ?? <Zap className="w-4 h-4" />}
            {(cooldowns[skillDown?.id ?? ''] ?? 0) > 0 && (
              <span className="absolute -top-1 -right-2 px-1 bg-red-950 text-red-300 text-[8px] font-mono font-bold rounded">
                {(cooldowns[skillDown?.id ?? ''] ?? 0).toFixed(0)}с
              </span>
            )}
          </div>
        </div>

        {/* 4. LEFT Sector (Slot 3: Рубящий Удар) */}
        <div
          className={`absolute left-1 flex flex-col items-center justify-center transition-transform ${
            activeDirection === 'left' ? 'scale-115 text-orange-400' : 'text-slate-400'
          }`}
        >
          <div className="relative">
            {SKILL_ICONS[skillLeft?.id ?? 'slash'] ?? <Flame className="w-4 h-4" />}
            {(cooldowns[skillLeft?.id ?? ''] ?? 0) > 0 && (
              <span className="absolute -top-1 -right-2 px-1 bg-red-950 text-red-300 text-[8px] font-mono font-bold rounded">
                {(cooldowns[skillLeft?.id ?? ''] ?? 0).toFixed(0)}с
              </span>
            )}
          </div>
          <span className="text-[8px] font-bold uppercase tracking-tight mt-0.5">
            ← {skillLeft?.name?.split(' ')[0] ?? 'Рассечение'}
          </span>
        </div>

        {/* Center Dynamic Action Knob */}
        <div
          style={{
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`
          }}
          className={`w-11 h-11 rounded-full border-2 transition-transform duration-75 flex flex-col items-center justify-center shadow-lg z-10 ${
            activeDirection
              ? 'bg-amber-500 border-amber-300 scale-110 shadow-amber-500/50'
              : isSwiping
              ? 'bg-slate-700 border-slate-500 scale-95'
              : 'bg-slate-800 border-slate-600'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-200" />
          <span className="text-[7px] font-mono font-bold text-slate-300 uppercase leading-none mt-0.5">
            {activeDirection ? activeDirection.toUpperCase() : 'СВАЙП'}
          </span>
        </div>
      </div>

      {/* Quick Loadout Menu (Triggered on Hold > 450ms) */}
      {showLoadoutMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-amber-500/80 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col text-slate-100">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-amber-300">Настройка Action-Слотов</h3>
              </div>
              <button
                onClick={() => {
                  setShowLoadoutMenu(false);
                  setSelectedSlotForSwap(null);
                }}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content: 4 Direction Slots */}
            <div className="p-4 space-y-3">
              <p className="text-[11px] text-slate-400">
                Нажмите на слот для смены назначенного навыка свайпа (↑ / → / ← / ↓):
              </p>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { slot: 1, dir: '↑ Вверх', skill: skillUp },
                  { slot: 2, dir: '→ Вправо', skill: skillRight },
                  { slot: 3, dir: '← Влево', skill: skillLeft },
                  { slot: 4, dir: '↓ Вниз', skill: skillDown }
                ].map(item => {
                  const isSelected = selectedSlotForSwap === item.slot;
                  return (
                    <button
                      key={item.slot}
                      onClick={() => setSelectedSlotForSwap(isSelected ? null : item.slot)}
                      className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition ${
                        isSelected
                          ? 'bg-amber-950/60 border-amber-400 text-amber-200'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-amber-400 font-mono">
                          {item.dir}
                        </span>
                        {SKILL_ICONS[item.skill?.id ?? '']}
                      </div>
                      <div className="font-semibold text-xs truncate">
                        {item.skill?.name ?? `Слот ${item.slot}`}
                      </div>
                      <div className="text-[10px] text-cyan-400 font-mono">
                        ОМ: {item.skill?.manaCost ?? 0} | КД: {item.skill?.cooldown ?? 0}с
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Skill Selection Drawer when a slot is chosen */}
              {selectedSlotForSwap !== null && (
                <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 animate-in slide-in-from-top-2">
                  <div className="text-[11px] font-bold text-amber-300">
                    Выберите навык для Слота #{selectedSlotForSwap}:
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {allSkills.map(sk => {
                      const isCurrent = slotSkills[selectedSlotForSwap - 1] === sk.id;
                      return (
                        <button
                          key={sk.id}
                          onClick={() => handleSwapSkill(selectedSlotForSwap, sk.id)}
                          className={`w-full flex items-center justify-between p-2 rounded-lg border text-xs transition ${
                            isCurrent
                              ? 'bg-amber-900/40 border-amber-500 text-amber-200'
                              : 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {SKILL_ICONS[sk.id]}
                            <div className="text-left">
                              <div className="font-semibold">{sk.name}</div>
                              <div className="text-[10px] text-slate-400">{sk.description}</div>
                            </div>
                          </div>
                          {isCurrent && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => {
                  setShowLoadoutMenu(false);
                  setSelectedSlotForSwap(null);
                }}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition"
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
