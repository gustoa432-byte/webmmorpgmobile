/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Core } from './core/Core';
import { EntityId } from './core/types';
import { GameCanvas } from './presentation/GameCanvas';
import { SkillHotbar } from './presentation/SkillHotbar';
import { VirtualJoystick } from './presentation/VirtualJoystick';
import { EngineInspector } from './presentation/EngineInspector';
import { InventoryModal } from './presentation/InventoryModal';
import { VerificationModal } from './presentation/VerificationModal';
import {
  Grid3X3,
  Layers,
  ShieldAlert,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Info,
  Maximize2
} from 'lucide-react';

export default function App() {
  const coreRef = useRef<Core | null>(null);
  if (!coreRef.current) {
    coreRef.current = new Core({ seed: 1999, ticksPerSecond: 20 });
  }
  const core = coreRef.current;

  const [showGrid, setShowGrid] = useState(false);
  const [showInspector, setShowInspector] = useState(true);
  const [showInventory, setShowInventory] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<EntityId | null>(null);
  const [targetInfo, setTargetInfo] = useState<{
    id: number;
    name: string;
    level: number;
    currentHp: number;
    maxHp: number;
  } | null>(null);

  // Poll player's combat target for top HUD
  useEffect(() => {
    const interval = setInterval(() => {
      const playerId = core.getPlayerId();
      const combat = core.entities.getComponent(playerId, 'Combat');
      const targetId = combat?.targetEntityId ?? selectedEntityId;

      if (targetId && core.entities.hasEntity(targetId)) {
        const hp = core.entities.getComponent(targetId, 'Health');
        const ai = core.entities.getComponent(targetId, 'AI');
        const monsterConf = ai ? core.configs.getMonster(ai.monsterTemplateId) : null;

        if (hp && !hp.isDead) {
          setTargetInfo({
            id: targetId,
            name: monsterConf?.name ?? `Entity #${targetId}`,
            level: monsterConf?.level ?? 1,
            currentHp: Math.floor(hp.currentHp),
            maxHp: hp.maxHp
          });
          return;
        }
      }
      setTargetInfo(null);
    }, 60);

    return () => clearInterval(interval);
  }, [core, selectedEntityId]);

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const stepTick = () => {
    core.stepSingleTick();
  };

  const resetWorld = (seed?: number) => {
    core.reset(seed);
    setSelectedEntityId(null);
    setTargetInfo(null);
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
      {/* Main Game Screen Area */}
      <div className="relative flex-1 h-full flex flex-col min-w-0">
        {/* Top Navigation & Status Bar */}
        <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 py-2 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 pointer-events-auto">
          {/* Title & Mu Season 1 badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <h1 className="font-bold text-sm tracking-wide bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500 bg-clip-text text-transparent">
                Mu Online Core Engine v1.0
              </h1>
            </div>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-mono text-slate-400 border border-slate-700">
              Season 1 Lorencia MVP
            </span>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGrid(!showGrid)}
              title="Toggle .att Walkability Grid"
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition ${
                showGrid
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Walk Grid</span>
            </button>

            <button
              onClick={() => setShowVerification(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border border-emerald-500/50 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 transition font-medium"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
              <span>Verify DoD</span>
            </button>

            <button
              onClick={() => setShowInspector(!showInspector)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition ${
                showInspector
                  ? 'bg-slate-800 border-amber-400 text-amber-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Inspector</span>
            </button>
          </div>
        </header>

        {/* Target Frame (Top Center) */}
        {targetInfo && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center bg-slate-900/90 border border-red-500/50 px-4 py-1.5 rounded-xl backdrop-blur-md shadow-2xl animate-in fade-in zoom-in-95 pointer-events-none">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-100">
              <span className="text-red-400">Target:</span>
              <span>{targetInfo.name}</span>
              <span className="px-1.5 py-0.2 bg-red-950 border border-red-800 text-red-300 rounded text-[10px]">
                Lv.{targetInfo.level}
              </span>
            </div>
            {/* Target HP Bar */}
            <div className="w-48 bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800 mt-1">
              <div
                style={{
                  width: `${Math.max(0, (targetInfo.currentHp / targetInfo.maxHp) * 100)}%`
                }}
                className="h-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-150"
              />
            </div>
            <span className="text-[10px] font-mono text-slate-400 mt-0.5">
              {targetInfo.currentHp} / {targetInfo.maxHp} HP
            </span>
          </div>
        )}

        {/* Interactive Game Canvas */}
        <div className="flex-1 w-full h-full">
          <GameCanvas
            core={core}
            showGrid={showGrid}
            onSelectEntity={setSelectedEntityId}
            selectedEntityId={selectedEntityId}
          />
        </div>

        {/* In-Game Controls Overlay (Bottom) */}
        <div className="absolute bottom-4 left-4 right-4 z-20 flex items-end justify-between pointer-events-none">
          {/* Virtual Joystick (Bottom Left) */}
          <div className="pointer-events-auto">
            <VirtualJoystick core={core} />
          </div>

          {/* Skill Hotbar & Actions (Bottom Center) */}
          <div className="pointer-events-auto">
            <SkillHotbar
              core={core}
              onOpenInventory={() => setShowInventory(true)}
            />
          </div>

          {/* Controls Hint / Guide (Bottom Right) */}
          <div className="hidden lg:flex flex-col gap-1 p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-xl backdrop-blur-md text-[11px] text-slate-400 font-mono pointer-events-none">
            <div className="text-amber-400 font-semibold mb-0.5">Controls:</div>
            <div>• Click ground: Move</div>
            <div>• Click mob: Target & Attack</div>
            <div>• WASD / Stick: Joystick Move</div>
            <div>• 1-4: Class Skills</div>
            <div>• Space: Pick Up Item/Zen</div>
            <div>• Q: Use Healing Potion</div>
          </div>
        </div>
      </div>

      {/* Right Collapsible Inspector Drawer */}
      {showInspector && (
        <div className="w-80 lg:w-96 h-full shrink-0 z-30 transition-all shadow-2xl">
          <EngineInspector
            core={core}
            isPaused={isPaused}
            onTogglePause={togglePause}
            onStepTick={stepTick}
            onReset={resetWorld}
            onOpenVerification={() => setShowVerification(true)}
            selectedEntityId={selectedEntityId}
            onSelectEntity={setSelectedEntityId}
          />
        </div>
      )}

      {/* Modals */}
      <InventoryModal
        core={core}
        isOpen={showInventory}
        onClose={() => setShowInventory(false)}
      />

      <VerificationModal
        isOpen={showVerification}
        onClose={() => setShowVerification(false)}
      />
    </div>
  );
}
