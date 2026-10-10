/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ClassConfig,
  ItemConfig,
  MapConfig,
  MonsterConfig,
  SkillConfig
} from '../types';

import monstersData from './monsters.json';
import skillsData from './skills.json';
import itemsData from './items.json';
import classesData from './classes.json';
import mapData from './maps.json';

export class ConfigLoader {
  private monsters: Map<string, MonsterConfig> = new Map();
  private skills: Map<string, SkillConfig> = new Map();
  private items: Map<string, ItemConfig> = new Map();
  private classes: Map<string, ClassConfig> = new Map();
  private map: MapConfig;

  constructor() {
    this.map = mapData as unknown as MapConfig;
    this.loadDefaults();
  }

  private loadDefaults(): void {
    for (const m of monstersData as unknown as MonsterConfig[]) {
      this.monsters.set(m.id, m);
    }
    for (const s of skillsData as unknown as SkillConfig[]) {
      this.skills.set(s.id, s);
    }
    for (const i of itemsData as unknown as ItemConfig[]) {
      this.items.set(i.id, i);
    }
    for (const c of classesData as unknown as ClassConfig[]) {
      this.classes.set(c.id, c);
    }
  }

  public getMonster(id: string): MonsterConfig | undefined {
    return this.monsters.get(id);
  }

  public getAllMonsters(): MonsterConfig[] {
    return Array.from(this.monsters.values());
  }

  public getSkill(id: string): SkillConfig | undefined {
    return this.skills.get(id);
  }

  public getSkillBySlot(slot: number): SkillConfig | undefined {
    for (const s of this.skills.values()) {
      if (s.slot === slot) return s;
    }
    return undefined;
  }

  public getAllSkills(): SkillConfig[] {
    return Array.from(this.skills.values());
  }

  public getItem(id: string): ItemConfig | undefined {
    return this.items.get(id);
  }

  public getAllItems(): ItemConfig[] {
    return Array.from(this.items.values());
  }

  public getClass(id: string): ClassConfig | undefined {
    return this.classes.get(id);
  }

  public getMap(): MapConfig {
    return this.map;
  }
}
