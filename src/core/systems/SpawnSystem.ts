/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EntityManager } from '../entity/EntityManager';
import { EventBus, OnEntityDiedEvent } from '../events/EventBus';
import { SeededRNG } from '../rng/SeededRNG';
import { ConfigLoader } from '../data/ConfigLoader';
import { EntityId } from '../types';
import { PhysicsWorld } from '../physics/PhysicsWorld';

interface RespawnEntry {
  templateId: string;
  spawnPoint: { x: number; y: number };
  remainingSeconds: number;
}

export class SpawnSystem {
  private respawnQueue: RespawnEntry[] = [];
  private pendingDestroyIds: EntityId[] = [];
  private unsubscribe: (() => void) | null = null;

  constructor(
    private entities: EntityManager,
    private eventBus: EventBus,
    private rng: SeededRNG,
    private configs: ConfigLoader,
    private physics: PhysicsWorld
  ) {
    this.unsubscribe = this.eventBus.subscribe('OnEntityDied', (event: OnEntityDiedEvent) => {
      this.handleEntityDeath(event);
    });
  }

  private handleEntityDeath(event: OnEntityDiedEvent): void {
    const deadId = event.entityId;
    const isMonster = this.entities.hasTag(deadId, 'Monster');

    if (isMonster) {
      const ai = this.entities.getComponent(deadId, 'AI');
      const transform = this.entities.getComponent(deadId, 'Transform');
      const templateId = ai?.monsterTemplateId ?? 'spider';
      const monsterConf = this.configs.getMonster(templateId);

      // 1. Roll loot drops
      if (monsterConf && transform) {
        this.generateLootDrops(monsterConf, transform.position);
      }

      // 2. Schedule monster respawn using spawnZone config
      const mapConf = this.configs.getMap();
      const zone = mapConf.spawnZones.find(z => z.monsterId === templateId);
      const respawnTime = zone?.respawnTimeSeconds ?? 6.0;
      const spawnPoint = ai ? { ...ai.spawnPoint } : { x: 20, y: 20 };

      this.respawnQueue.push({
        templateId,
        spawnPoint,
        remainingSeconds: respawnTime
      });

      // 3. Queue old dead monster entity for deferred destruction at end of tick
      this.pendingDestroyIds.push(deadId);
    }
  }

  private generateLootDrops(
    monsterConf: ReturnType<ConfigLoader['getMonster']> & {},
    pos: { x: number; y: number; z: number }
  ): void {
    for (const drop of monsterConf.dropTable) {
      if (this.rng.chance(drop.chance)) {
        const itemConf = this.configs.getItem(drop.itemId);
        if (!itemConf) continue;

        const count = drop.minQty && drop.maxQty
          ? this.rng.range(drop.minQty, drop.maxQty)
          : 1;

        // Slight offset so multiple drops don't stack perfectly on top
        const dropX = pos.x + this.rng.rangeFloat(-0.6, 0.6);
        const dropY = pos.y + this.rng.rangeFloat(-0.6, 0.6);

        // Create Item Entity
        const itemEntityId = this.entities.createEntity(['Item']);

        this.entities.addComponent(itemEntityId, {
          type: 'Transform',
          position: { x: dropX, y: dropY, z: 0.1 },
          previousPosition: { x: dropX, y: dropY, z: 0.1 },
          rotation: 0,
          height: 0.2
        });

        this.entities.addComponent(itemEntityId, {
          type: 'ItemDrop',
          templateId: itemConf.id,
          itemName: itemConf.name,
          count: count,
          zenAmount: itemConf.id === 'zen' ? count : 0,
          ownerEntityId: null,
          dropTime: 0
        });

        this.entities.addComponent(itemEntityId, {
          type: 'Lifetime',
          durationSeconds: 60.0, // Item despawns after 60 seconds
          remainingSeconds: 60.0,
          despawnOnExpire: true
        });

        this.eventBus.emit({
          type: 'OnItemDropped',
          entityId: itemEntityId,
          itemTemplateId: itemConf.id,
          itemName: itemConf.name,
          count,
          zenAmount: itemConf.id === 'zen' ? count : 0,
          position: { x: dropX, y: dropY, z: 0.1 }
        });
      }
    }
  }

  public update(dt: number): void {
    // 1. Process deferred entity destructions from dead entities
    if (this.pendingDestroyIds.length > 0) {
      for (const id of this.pendingDestroyIds) {
        this.physics.removeBody(id);
        this.entities.destroyEntity(id);
      }
      this.pendingDestroyIds = [];
    }

    // 2. Process respawn timers
    for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
      const entry = this.respawnQueue[i];
      entry.remainingSeconds -= dt;

      if (entry.remainingSeconds <= 0) {
        this.respawnMonster(entry.templateId, entry.spawnPoint);
        this.respawnQueue.splice(i, 1);
      }
    }
  }

  /**
   * Spawns a monster entity at given coordinates.
   */
  public respawnMonster(templateId: string, spawnPos: { x: number; y: number }): EntityId {
    const monsterConf = this.configs.getMonster(templateId);
    if (!monsterConf) return -1;

    const id = this.entities.createEntity(['Monster']);

    this.entities.addComponent(id, {
      type: 'Transform',
      position: { x: spawnPos.x, y: spawnPos.y, z: 0 },
      previousPosition: { x: spawnPos.x, y: spawnPos.y, z: 0 },
      rotation: this.rng.rangeFloat(0, Math.PI * 2),
      height: monsterConf.size
    });

    this.entities.addComponent(id, {
      type: 'Movement',
      speed: monsterConf.walkSpeed,
      velocity: { x: 0, y: 0 },
      desiredDirection: null,
      targetPosition: null,
      path: [],
      movementState: 'idle',
      stepOffset: 0.2
    });

    this.entities.addComponent(id, {
      type: 'Collider',
      shape: 'capsule',
      radius: monsterConf.size * 0.5,
      height: monsterConf.size,
      isTrigger: false,
      solid: true
    });

    // Create Rapier kinematic character body
    this.physics.createCharacterBody(
      id,
      spawnPos,
      monsterConf.size * 0.5,
      monsterConf.size
    );

    this.entities.addComponent(id, {
      type: 'Health',
      currentHp: monsterConf.maxHp,
      maxHp: monsterConf.maxHp,
      isDead: false,
      deathTime: 0,
      respawnTimeSeconds: 5.0
    });

    this.entities.addComponent(id, {
      type: 'Combat',
      targetEntityId: null,
      attackSpeed: monsterConf.attackSpeed,
      attackTimer: 0,
      damageMin: monsterConf.damageMin,
      damageMax: monsterConf.damageMax,
      defense: monsterConf.defense,
      attackRange: monsterConf.attackRange,
      isAttacking: false,
      attackAnimationDuration: 0.3,
      attackAnimationTimer: 0
    });

    this.entities.addComponent(id, {
      type: 'AI',
      state: 'idle',
      spawnPoint: { x: spawnPos.x, y: spawnPos.y },
      aggroRadius: monsterConf.aggroRadius,
      leashRadius: monsterConf.leashRadius,
      wanderRadius: 3.5,
      wanderTimer: this.rng.rangeFloat(1.0, 3.0),
      wanderInterval: 3.5,
      targetEntityId: null,
      returnSpeed: monsterConf.walkSpeed * 1.2,
      monsterTemplateId: templateId
    });

    this.eventBus.emit({
      type: 'OnEntitySpawned',
      entityId: id,
      templateId,
      tag: 'Monster',
      position: { x: spawnPos.x, y: spawnPos.y, z: 0 }
    });

    return id;
  }

  public destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}
