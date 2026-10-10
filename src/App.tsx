/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Core } from './core/Core';
import { EntityId } from './core/types';
import { GameCanvas } from './presentation/GameCanvas';
import { VirtualJoystick } from './presentation/VirtualJoystick';
import { ActionZone } from './presentation/ActionZone';
import { EngineInspector } from './presentation/EngineInspector';
import { InventoryModal } from './presentation/InventoryModal';
import { VerificationModal } from './presentation/VerificationModal';
import {
  Grid3X3,
  Layers,
  ShieldAlert,
  RotateCcw,
  RefreshCw,
  Camera,
  Coins,
  HeartPulse,
  Backpack,
  Menu,
  X,
  HelpCircle,
  Sparkles
} from 'lucide-react';

export default function App() {
  const coreRef = useRef<Core | null>(null);
  if (!coreRef.current) {
    coreRef.current = new Core({ seed: 1999, ticksPerSecond: 20 });
  }
  const core = coreRef.current;

  const [showGrid, setShowGrid] = useState(false);
  const [hardCamera, setHardCamera] = useState(false);
  const [showInspector, setShowInspector] = useState(true);
  const [showInventory, setShowInventory] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<EntityId | null>(null);

  const [playerVitals, setPlayerVitals] = useState({
    level: 1,
    currentHp: 110,
    maxHp: 110,
    isDead: false,
    currentMana: 20,
    maxMana: 20,
    currentExp: 0,
    expToNextLevel: 100,
    zen: 500,
    potionCount: 0
  });

  const [targetInfo, setTargetInfo] = useState<{
    id: number;
    name: string;
    level: number;
    currentHp: number;
    maxHp: number;
  } | null>(null);

  // Poll player vitals & target info smoothly for Top HUD (Zone 2)
  useEffect(() => {
    const interval = setInterval(() => {
      const playerId = core.getPlayerId();
      const hp = core.entities.getComponent(playerId, 'Health');
      const skillSet = core.entities.getComponent(playerId, 'SkillSet');
      const playerComp = core.entities.getComponent(playerId, 'Player');
      const inv = core.entities.getComponent(playerId, 'Inventory');

      if (hp && skillSet && playerComp && inv) {
        const pots = inv.items.filter(i => i.templateId.includes('potion'));
        const totalPots = pots.reduce((sum, p) => sum + p.count, 0);

        setPlayerVitals({
          level: playerComp.level,
          currentHp: Math.floor(hp.currentHp),
          maxHp: hp.maxHp,
          isDead: hp.isDead,
          currentMana: Math.floor(skillSet.currentMana),
          maxMana: skillSet.maxMana,
          currentExp: playerComp.currentExp,
          expToNextLevel: playerComp.expToNextLevel,
          zen: inv.zen,
          potionCount: totalPots
        });
      }

      // Check current combat target
      const combat = core.entities.getComponent(playerId, 'Combat');
      const targetId = combat?.targetEntityId ?? selectedEntityId;

      if (targetId && core.entities.hasEntity(targetId)) {
        const targetHp = core.entities.getComponent(targetId, 'Health');
        const ai = core.entities.getComponent(targetId, 'AI');
        const monsterConf = ai ? core.configs.getMonster(ai.monsterTemplateId) : null;

        if (targetHp && !targetHp.isDead) {
          setTargetInfo({
            id: targetId,
            name: monsterConf?.name ?? `Сущность #${targetId}`,
            level: monsterConf?.level ?? 1,
            currentHp: Math.floor(targetHp.currentHp),
            maxHp: targetHp.maxHp
          });
          return;
        }
      }
      setTargetInfo(null);
    }, 50);

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

  const triggerPotion = () => {
    core.enqueueCommand({
      type: 'UsePotion',
      entityId: core.getPlayerId()
    });
  };

  const triggerRespawn = () => {
    core.enqueueCommand({
      type: 'Respawn',
      entityId: core.getPlayerId()
    });
  };

  return (
    <div className="flex h-[100dvh] w-full bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
      {/* Main Game Screen Area (Monolithic portrait container: Top Bar -> Game World -> Bottom Controls) */}
      <div className="relative flex-1 h-full flex flex-col min-w-0 overflow-hidden">
        {/* SAFE TOP & TOP BAR (Fixed height container: flex-none, shrink-0) */}
        <header className="flex-none shrink-0 z-30 flex flex-col bg-slate-950 border-b border-slate-800 pt-[env(safe-area-inset-top,0px)]">
          <div className="flex items-center justify-between px-3 py-1.5 h-14 min-h-[56px] max-h-[56px] box-border">
            {/* Left: Player Avatar / Level & Dual HP/MP Bars */}
            <div className="flex items-center gap-2 min-w-0">
              {/* Level / DK Badge */}
              <div className="flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-slate-900 border border-amber-500/60 shadow-md shrink-0">
                <span className="text-[9px] font-mono text-amber-400 font-bold leading-tight">DK</span>
                <span className="text-[10px] font-bold text-white leading-tight">Ур.{playerVitals.level}</span>
              </div>

              {/* Stacked HP / MP Bars with numbers */}
              <div className="flex flex-col gap-1 w-24 sm:w-36 shrink-0">
                {/* HP */}
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1 h-3.5 bg-slate-900 rounded-sm overflow-hidden border border-red-950">
                    <div
                      style={{ width: `${Math.max(0, (playerVitals.currentHp / playerVitals.maxHp) * 100)}%` }}
                      className="h-full bg-gradient-to-r from-red-600 to-rose-500 transition-all duration-100"
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-bold text-white drop-shadow">
                      {playerVitals.currentHp}/{playerVitals.maxHp} HP
                    </span>
                  </div>
                </div>

                {/* MP */}
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1 h-3.5 bg-slate-900 rounded-sm overflow-hidden border border-cyan-950">
                    <div
                      style={{ width: `${Math.max(0, (playerVitals.currentMana / playerVitals.maxMana) * 100)}%` }}
                      className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-100"
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-bold text-white drop-shadow">
                      {playerVitals.currentMana}/{playerVitals.maxMana} MP
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Center: Zen Gold */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 border border-amber-500/40 rounded-lg text-amber-300 font-mono text-xs font-bold shadow-inner shrink-0">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>{playerVitals.zen.toLocaleString()}</span>
            </div>

            {/* Right: Quick Action Buttons (Touch targets >= 44x44px) */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Quick Potion [Q] button */}
              <button
                onClick={triggerPotion}
                disabled={playerVitals.potionCount <= 0 || playerVitals.isDead}
                title="Выпить зелье здоровья [Q]"
                className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 border border-red-500/60 text-red-400 transition shadow-md disabled:opacity-50 shrink-0"
              >
                <HeartPulse className="w-5 h-5 text-red-400" />
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-red-600 text-white font-mono text-[9px] font-bold rounded-full">
                  {playerVitals.potionCount}
                </span>
              </button>

              {/* Inventory [I] button */}
              <button
                onClick={() => setShowInventory(true)}
                title="Открыть инвентарь [I]"
                className="flex items-center justify-center w-11 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 border border-amber-500/50 text-amber-300 transition shadow-md shrink-0"
              >
                <Backpack className="w-5 h-5 text-amber-400" />
              </button>

              {/* Desktop-only Direct Action Buttons (Hidden on mobile) */}
              <div className="hidden lg:flex items-center gap-1.5">
                <button
                  onClick={() => setHardCamera(!hardCamera)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{hardCamera ? 'Камера 1.0' : 'Камера 0.3'}</span>
                </button>
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                >
                  <Grid3X3 className="w-3.5 h-3.5" />
                  <span>Сетка</span>
                </button>
                <button
                  onClick={() => setShowVerification(true)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-emerald-500/50 bg-emerald-950 text-emerald-300 hover:bg-emerald-900"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>ТЗ</span>
                </button>
                <button
                  onClick={() => setShowInspector(!showInspector)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border transition ${
                    showInspector ? 'bg-slate-800 border-amber-400 text-amber-300' : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Инспектор</span>
                </button>
              </div>

              {/* Mobile Menu / Settings Button */}
              <button
                onClick={() => setShowMobileMenu(true)}
                title="Меню и Настройки"
                className="flex items-center justify-center w-11 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 border border-slate-700 text-slate-300 transition shadow-md lg:hidden shrink-0"
              >
                <Menu className="w-5 h-5 text-slate-300" />
              </button>
            </div>
          </div>

          {/* Slim Exp Bar along the bottom of the Top HUD */}
          <div className="w-full h-1 bg-slate-900 relative">
            <div
              style={{ width: `${Math.min(100, Math.max(0, (playerVitals.currentExp / playerVitals.expToNextLevel) * 100))}%` }}
              className="h-full bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-300 transition-all duration-300"
            />
          </div>
        </header>

        {/* Target Frame (Positioned just under Top Bar if active) */}
        {targetInfo && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center bg-slate-900 border border-red-500/60 px-4 py-1.5 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 pointer-events-none">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-100">
              <span className="text-red-400 font-mono">Цель:</span>
              <span>{targetInfo.name}</span>
              <span className="px-1.5 py-0.2 bg-red-950 border border-red-800 text-red-300 rounded text-[10px] font-mono">
                Ур.{targetInfo.level}
              </span>
            </div>
            {/* Target HP Bar */}
            <div className="w-44 sm:w-52 bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800 mt-1">
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

        {/* GAME WORLD (canvas container: flex-1 min-h-0, the ONLY stretchable zone, relative for floating footer) */}
        <div className="relative flex-1 min-h-0 w-full overflow-hidden flex flex-col justify-end">
          {/* Canvas fills entire world area */}
          <div className="absolute inset-0">
            <GameCanvas
              core={core}
              showGrid={showGrid}
              onSelectEntity={setSelectedEntityId}
              selectedEntityId={selectedEntityId}
              isPaused={isPaused}
              hardCamera={hardCamera}
            />
          </div>

          {/* Respawn Button overlay if dead */}
          {playerVitals.isDead && (
            <div className="absolute bottom-40 left-1/2 -translate-x-1/2 z-20 pointer-events-auto animate-bounce">
              <button
                onClick={triggerRespawn}
                className="flex items-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-2xl border-2 border-red-400 transition"
              >
                <RefreshCw className="w-4 h-4" />
                Возродиться в Лоренсии
              </button>
            </div>
          )}

          {/* BOTTOM CONTROLS & SAFE BOTTOM (Transparent footer overlaying the bottom of the map) */}
          <footer
            style={{
              paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))'
            }}
            className="relative z-20 bg-transparent px-3 sm:px-4 pt-2.5 pointer-events-none"
          >
            <div className="flex items-end justify-between w-full max-w-lg mx-auto">
              {/* Zone 4: Left Virtual Joystick (Movement) */}
              <div className="shrink-0 pointer-events-auto">
                <VirtualJoystick core={core} />
              </div>

              {/* Desktop Controls Hint (Hidden on mobile) */}
              <div className="hidden lg:flex flex-col gap-1 p-2 bg-slate-900/80 border border-slate-800 rounded-xl text-[10px] text-slate-400 font-mono mb-2 pointer-events-auto">
                <div className="text-amber-400 font-semibold">Управление (ПК):</div>
                <div>• Клик по мобу: Автоатака</div>
                <div>• Дабл-клик: Лут | WASD: Бег</div>
                <div>• 1-4: Скиллы | Q: Зелье HP</div>
              </div>

              {/* Zone 5: Right Action Zone (Gestures: Swipe ↑/→/↓/← & Hold) */}
              <div className="shrink-0 pointer-events-auto">
                <ActionZone core={core} />
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Desktop-Only Inspector Drawer (Hidden on mobile phones as requested) */}
      {showInspector && (
        <div className="hidden lg:block w-80 lg:w-96 h-full shrink-0 z-30 transition-all shadow-2xl">
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

      {/* Mobile Menu Modal (Settings & Help) */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 animate-in fade-in lg:hidden">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col text-slate-100">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Menu className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-slate-100">Меню GODKNIFE</h3>
              </div>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Menu options */}
            <div className="p-4 space-y-3">
              {/* Guide Card */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-xs">
                <div className="font-bold text-amber-300 flex items-center gap-1.5 mb-1">
                  <HelpCircle className="w-3.5 h-3.5" />
                  Управление на смартфоне:
                </div>
                <div className="text-slate-300 leading-relaxed space-y-0.5 text-[11px]">
                  <div>• <b>Левый стик:</b> Бег (отпустил = остановка)</div>
                  <div>• <b>Тап по мобу:</b> Выбор цели + автоатака</div>
                  <div>• <b>Дабл-тап по земле:</b> Поднять предмет</div>
                  <div>• <b>Action-зона (справа):</b> Свайп в 4 стороны (↑, →, ↓, ←) для скиллов</div>
                  <div>• <b>Удержание Action-зоны:</b> Меню смены скиллов</div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setHardCamera(!hardCamera);
                    setShowMobileMenu(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold"
                >
                  <span className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-slate-400" />
                    Режим камеры
                  </span>
                  <span className="text-amber-400 font-mono">
                    {hardCamera ? '1.0 (Жёсткая)' : '0.3 (Плавная)'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setShowGrid(!showGrid);
                    setShowMobileMenu(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold"
                >
                  <span className="flex items-center gap-2">
                    <Grid3X3 className="w-4 h-4 text-slate-400" />
                    Сетка ходьбы (.att)
                  </span>
                  <span className={showGrid ? 'text-emerald-400 font-mono' : 'text-slate-500 font-mono'}>
                    {showGrid ? 'ВКЛ' : 'ВЫКЛ'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setShowVerification(true);
                    setShowMobileMenu(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/50 rounded-xl text-xs font-semibold text-emerald-300"
                >
                  <span className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-emerald-400" />
                    Проверка 9 пунктов ТЗ
                  </span>
                  <span>Открыть</span>
                </button>

                <button
                  onClick={() => {
                    resetWorld();
                    setShowMobileMenu(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-red-300"
                >
                  <span className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-red-400" />
                    Перезапустить Лоренсию
                  </span>
                  <span>Сброс</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowMobileMenu(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

