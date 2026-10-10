/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Core } from '../core/Core';
import { EntityId } from '../core/types';
import { Play, Pause, StepForward, RotateCcw, Activity, ShieldCheck, Database, ListOrdered, CheckCircle2, ChevronRight } from 'lucide-react';

interface EngineInspectorProps {
  core: Core;
  isPaused: boolean;
  onTogglePause: () => void;
  onStepTick: () => void;
  onReset: (seed?: number) => void;
  onOpenVerification: () => void;
  selectedEntityId: EntityId | null;
  onSelectEntity: (id: EntityId | null) => void;
}

export const EngineInspector: React.FC<EngineInspectorProps> = ({
  core,
  isPaused,
  onTogglePause,
  onStepTick,
  onReset,
  onOpenVerification,
  selectedEntityId,
  onSelectEntity
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'ecs' | 'events'>('status');
  const [ticks, setTicks] = useState(0);
  const [stateHash, setStateHash] = useState('');
  const [rngState, setRngState] = useState(0);
  const [tps, setTps] = useState(core.timestep.tps);
  const [entityFilter, setEntityFilter] = useState<'All' | 'Monster' | 'Item' | 'Player'>('All');
  const [eventHistory, setEventHistory] = useState<readonly any[]>([]);
  const [seedInput, setSeedInput] = useState('1999');

  // Update inspector metrics
  useEffect(() => {
    const timer = setInterval(() => {
      setTicks(core.timestep.ticks);
      setStateHash(core.getStateHash());
      setRngState(core.rng.getState());
      setEventHistory([...core.eventBus.getHistory()]);
    }, 100);

    return () => clearInterval(timer);
  }, [core]);

  const handleTpsChange = (newTps: number) => {
    setTps(newTps);
    core.timestep.tps = newTps;
  };

  const entities = core.entities.getAllEntities().filter(id => {
    if (entityFilter === 'All') return true;
    return core.entities.hasTag(id, entityFilter);
  });

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 text-slate-200 text-xs">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-sm text-slate-100">Инспектор ядра GODKNIFE</span>
        </div>
        <button
          onClick={onOpenVerification}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 rounded font-semibold transition"
          title="Проверить соответствие 9 пунктам ТЗ"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Проверка ТЗ
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950">
        <button
          onClick={() => setActiveTab('status')}
          className={`flex-1 py-2 text-center font-medium transition ${
            activeTab === 'status'
              ? 'text-amber-400 border-b-2 border-amber-400 bg-slate-800'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Игровой цикл
        </button>
        <button
          onClick={() => setActiveTab('ecs')}
          className={`flex-1 py-2 text-center font-medium transition ${
            activeTab === 'ecs'
              ? 'text-amber-400 border-b-2 border-amber-400 bg-slate-800'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Мир ECS
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`flex-1 py-2 text-center font-medium transition ${
            activeTab === 'events'
              ? 'text-amber-400 border-b-2 border-amber-400 bg-slate-800'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Шина событий ({eventHistory.length})
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {activeTab === 'status' && (
          <div className="space-y-4">
            {/* Playback Controls */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Управление шагом (Fixed Timestep)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onTogglePause}
                  className={`flex items-center justify-center gap-1.5 flex-1 py-1.5 rounded font-bold transition ${
                    isPaused
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-amber-600 hover:bg-amber-500 text-white'
                  }`}
                >
                  {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  {isPaused ? 'Продолжить' : 'Пауза'}
                </button>
                <button
                  onClick={onStepTick}
                  className="flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-semibold border border-slate-700 transition"
                  title="Шагнуть на 1 фиксированный тик (0.05с)"
                >
                  <StepForward className="w-3.5 h-3.5" />
                  1 Шаг
                </button>
              </div>

              {/* TPS Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Частота тиков</span>
                  <span className="text-amber-400 font-bold">{tps} TPS ({Math.round(1000 / tps)} мс/тик)</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="30"
                  step="1"
                  value={tps}
                  onChange={e => handleTpsChange(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>
            </div>

            {/* Determinism & State Fingerprint */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Детерминированное состояние
              </span>
              <div className="grid grid-cols-2 gap-2 text-mono text-[11px]">
                <div className="p-2 bg-slate-900 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Всего тиков</div>
                  <div className="text-amber-300 font-bold font-mono text-sm">{ticks}</div>
                </div>
                <div className="p-2 bg-slate-900 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Хэш состояния (FNV-1a)</div>
                  <div className="text-cyan-300 font-bold font-mono text-sm">{stateHash}</div>
                </div>
                <div className="p-2 bg-slate-900 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Состояние RNG</div>
                  <div className="text-slate-200 font-mono">{rngState}</div>
                </div>
                <div className="p-2 bg-slate-900 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Активных сущностей</div>
                  <div className="text-emerald-400 font-mono font-bold">{core.entities.getAllEntities().length}</div>
                </div>
              </div>
            </div>

            {/* Reset World with Seed */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Детерминированный сброс
              </span>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={seedInput}
                  onChange={e => setSeedInput(e.target.value)}
                  placeholder="Число сида"
                  className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-100 font-mono text-xs focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={() => onReset(parseInt(seedInput, 10) || 1999)}
                  className="flex items-center gap-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded font-semibold text-slate-200 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Сбросить мир
                </button>
              </div>
            </div>

            {/* Physics Engine Info */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Физический движок
              </span>
              <div className="text-[11px] text-emerald-300 font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Rapier 2D WASM (@dimforge/rapier2d-compat)</span>
              </div>
              <ul className="text-[10px] text-slate-400 font-mono space-y-0.5 list-disc list-inside">
                <li>KinematicCharacterController со скольжением (sliding)</li>
                <li>Автоматический уступ / Step offset (0.3м)</li>
                <li>Нулевая гравитация для 2D изометрии</li>
                <li>Интеграция сетки проходимости WalkabilityGrid (.att)</li>
              </ul>
            </div>

            {/* Architecture Systems Order */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Порядок выполнения систем (за тик)
              </span>
              <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-slate-300 font-mono">
                <li>CommandSystem (Обработка команд)</li>
                <li>AISystem (Искусственный интеллект мобов)</li>
                <li>MovementSystem (Контроллер движения Rapier)</li>
                <li>CombatSystem (Боевая логика и автоатаки)</li>
                <li>SkillSystem (Применение умений и откат)</li>
                <li>PickupSystem (Подбор предметов и Zen)</li>
                <li>ProgressionSystem (Опыт и распределение уровней)</li>
                <li>SpawnSystem (Спавн и возрождение монстров)</li>
                <li>LifetimeSystem (Время жизни временных объектов)</li>
                <li>EventDispatch (Рассылка событий шины)</li>
              </ol>
            </div>
          </div>
        )}

        {activeTab === 'ecs' && (
          <div className="space-y-3">
            {/* Filter buttons */}
            <div className="flex gap-1">
              {([
                { key: 'All', label: 'Все' },
                { key: 'Player', label: 'Игрок' },
                { key: 'Monster', label: 'Монстры' },
                { key: 'Item', label: 'Предметы' }
              ] as const).map(f => (
                <button
                  key={f.key}
                  onClick={() => setEntityFilter(f.key as any)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                    entityFilter === f.key
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Entity List */}
            <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
              {entities.map(id => {
                const isSelected = selectedEntityId === id;
                const trans = core.entities.getComponent(id, 'Transform');
                const health = core.entities.getComponent(id, 'Health');
                const ai = core.entities.getComponent(id, 'AI');
                const isPl = core.entities.hasTag(id, 'Player');
                const isM = core.entities.hasTag(id, 'Monster');
                const isIt = core.entities.hasTag(id, 'Item');

                const monsterName = ai ? core.configs.getMonster(ai.monsterTemplateId)?.name ?? ai.monsterTemplateId : 'Монстр';

                const label = isPl
                  ? 'Темный Рыцарь (Игрок)'
                  : isM
                  ? `${monsterName} (#${id})`
                  : isIt
                  ? `Дроп на земле (#${id})`
                  : `Сущность #${id}`;

                return (
                  <button
                    key={id}
                    onClick={() => onSelectEntity(isSelected ? null : id)}
                    className={`w-full flex items-center justify-between p-2 rounded border text-left transition ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500/80 text-amber-200'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400">#{id}</span>
                      <span>{label}</span>
                    </div>
                    {health && (
                      <span className="font-mono text-[10px] text-red-400">
                        {Math.floor(health.currentHp)}/{health.maxHp} HP
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected Entity Inspector */}
            {selectedEntityId && (
              <div className="p-3 bg-slate-950 rounded-lg border border-amber-500/40 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                  <span className="font-bold text-amber-300">Компоненты сущности #{selectedEntityId}</span>
                  <button
                    onClick={() => onSelectEntity(null)}
                    className="text-slate-400 hover:text-slate-200 text-[10px]"
                  >
                    Закрыть
                  </button>
                </div>
                <div className="space-y-1.5 font-mono text-[10px] max-h-48 overflow-y-auto">
                  {['Transform', 'Movement', 'Health', 'Combat', 'SkillSet', 'AI', 'Player', 'Inventory', 'ItemDrop'].map(type => {
                    const comp = core.entities.getComponent(selectedEntityId, type as any);
                    if (!comp) return null;
                    return (
                      <div key={type} className="p-1.5 bg-slate-900 rounded border border-slate-800">
                        <span className="text-amber-400 font-bold block">{type}</span>
                        <pre className="text-slate-300 overflow-x-auto text-[9px]">
                          {JSON.stringify(comp, null, 2)}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-2">
            <span className="text-[11px] text-slate-400 block">
              События, опубликованные через EventBus:
            </span>
            <div className="space-y-1 max-h-80 overflow-y-auto font-mono text-[10px] pr-1">
              {eventHistory.length === 0 ? (
                <div className="text-slate-500 italic py-4 text-center">Событий пока нет</div>
              ) : (
                eventHistory.slice().reverse().map((ev, i) => {
                  const isDamaged = ev.type === 'OnEntityDamaged';
                  const isDied = ev.type === 'OnEntityDied';
                  const isLvl = ev.type === 'OnLevelUp';
                  const isItem = ev.type === 'OnItemPicked' || ev.type === 'OnItemDropped';

                  return (
                    <div
                      key={i}
                      className={`p-1.5 rounded border ${
                        isDamaged
                          ? 'bg-red-950/30 border-red-900/50 text-red-300'
                          : isDied
                          ? 'bg-purple-950/40 border-purple-800/60 text-purple-300'
                          : isLvl
                          ? 'bg-amber-950/40 border-amber-800/60 text-amber-300 font-bold'
                          : isItem
                          ? 'bg-cyan-950/30 border-cyan-800/50 text-cyan-300'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="font-bold">{ev.type}</div>
                      <div className="text-[9px] opacity-80">{JSON.stringify(ev)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
