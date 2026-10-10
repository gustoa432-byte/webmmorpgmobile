/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Core } from '../core/Core';
import { X, Shield, Sword, Sparkles, Coins, Plus, HeartPulse } from 'lucide-react';

interface InventoryModalProps {
  core: Core;
  isOpen: boolean;
  onClose: () => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({ core, isOpen, onClose }) => {
  const [player, setPlayer] = useState<any>(null);
  const [inventory, setInventory] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);

  const playerId = core.getPlayerId();

  const refreshState = () => {
    const p = core.entities.getComponent(playerId, 'Player');
    const inv = core.entities.getComponent(playerId, 'Inventory');
    const hp = core.entities.getComponent(playerId, 'Health');
    if (p) setPlayer({ ...p, stats: { ...p.stats } });
    if (inv) setInventory({ ...inv, items: [...inv.items], equipment: { ...inv.equipment } });
    if (hp) setHealth({ ...hp });
  };

  useEffect(() => {
    if (isOpen) {
      refreshState();
      const interval = setInterval(refreshState, 200);
      return () => clearInterval(interval);
    }
  }, [isOpen, core, playerId]);

  if (!isOpen || !player || !inventory) return null;

  const addStat = (statName: 'strength' | 'agility' | 'vitality' | 'energy') => {
    if (player.statPoints > 0) {
      player.statPoints -= 1;
      player.stats[statName] += 1;

      // Update in core component directly
      const pComp = core.entities.getComponent(playerId, 'Player');
      if (pComp) {
        pComp.statPoints = player.statPoints;
        pComp.stats[statName] = player.stats[statName];
      }
      refreshState();
    }
  };

  const usePotion = (templateId: string) => {
    core.enqueueCommand({
      type: 'UsePotion',
      entityId: playerId,
      potionItemId: templateId
    });
    setTimeout(refreshState, 60);
  };

  const expPct = Math.min(100, Math.floor((player.currentExp / player.expToNextLevel) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-slate-900 border border-amber-500/60 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-slate-100">Персонаж и Инвентарь</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* Character Summary */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-base font-bold text-amber-300">Темный Рыцарь</div>
              <div className="text-xs text-slate-400">Уровень {player.level} • GODKNIFE</div>
            </div>
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="font-mono font-bold text-amber-300 text-sm">
                {inventory.zen.toLocaleString()} Zen
              </span>
            </div>
          </div>

          {/* Exp Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400 font-mono">
              <span>Опыт</span>
              <span>
                {player.currentExp} / {player.expToNextLevel} ({expPct}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
              <div
                style={{ width: `${expPct}%` }}
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-300"
              />
            </div>
          </div>

          {/* Stats Distribution */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-300">Характеристики персонажа</span>
              {player.statPoints > 0 && (
                <span className="text-xs font-bold text-amber-400 animate-pulse">
                  Свободных очков: {player.statPoints}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {[
                { name: 'Сила (STR)', key: 'strength' as const, desc: 'Увеличивает урон атаки' },
                { name: 'Ловкость (AGI)', key: 'agility' as const, desc: 'Увеличивает защиту и скорость' },
                { name: 'Живучесть (VIT)', key: 'vitality' as const, desc: 'Увеличивает макс. здоровье' },
                { name: 'Энергия (ENE)', key: 'energy' as const, desc: 'Увеличивает урон навыков и ману' }
              ].map(stat => (
                <div
                  key={stat.key}
                  className="p-2 bg-slate-900 border border-slate-800 rounded flex items-center justify-between"
                >
                  <div>
                    <div className="text-slate-300 font-semibold">{stat.name}</div>
                    <div className="text-amber-400 font-bold text-sm">{player.stats[stat.key]}</div>
                  </div>
                  {player.statPoints > 0 && (
                    <button
                      onClick={() => addStat(stat.key)}
                      className="p-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded transition"
                      title="Добавить 1 очко"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Equipment slots */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <span className="text-xs font-bold text-slate-300 block">Экипированное снаряжение</span>
            <div className="flex flex-wrap gap-2">
              <div className="p-2 bg-slate-900 border border-slate-800 rounded flex items-center gap-2 text-xs">
                <Sword className="w-4 h-4 text-amber-400" />
                <span className="text-slate-300">
                  Оружие: <strong className="text-slate-100">{inventory.equipment.weapon?.name ?? 'Короткий Меч'}</strong>
                </span>
              </div>
              <div className="p-2 bg-slate-900 border border-slate-800 rounded flex items-center gap-2 text-xs">
                <Shield className="w-4 h-4 text-cyan-400" />
                <span className="text-slate-300">
                  Броня: <strong className="text-slate-100">{inventory.equipment.armor?.name ?? 'Кожаный Доспех'}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Bag Items */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-300">Сумка инвентаря</span>
              <span className="text-slate-400 font-mono">
                {inventory.items.length} / {inventory.capacity} Слотов
              </span>
            </div>

            {inventory.items.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs italic">
                Сумка пуста. Уничтожайте монстров в Лоренсии, чтобы собирать добычу!
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {inventory.items.map((it: any, i: number) => {
                  const isPotion = it.templateId.includes('potion');
                  const isJewel = it.templateId.includes('jewel');

                  return (
                    <div
                      key={it.id || i}
                      className="p-2 bg-slate-900 border border-slate-800 rounded-lg flex flex-col justify-between text-xs space-y-1 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center gap-1.5 font-semibold">
                        {isJewel ? (
                          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                        ) : isPotion ? (
                          <HeartPulse className="w-4 h-4 text-red-400 shrink-0" />
                        ) : (
                          <Sword className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <span className={`truncate ${isJewel ? 'text-cyan-300 font-bold' : 'text-slate-200'}`}>
                          {it.name}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>x{it.count}</span>
                        {isPotion && (
                          <button
                            onClick={() => usePotion(it.templateId)}
                            className="px-2 py-0.5 bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/40 rounded text-[10px] font-bold transition"
                          >
                            Пить
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
