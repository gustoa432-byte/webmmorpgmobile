/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EntityManager } from './entity/EntityManager';
import { CommandQueue } from './commands/CommandQueue';
import { Command } from './commands/Command';
import { EventBus, CoreEvent } from './events/EventBus';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { TileAttribute } from './physics/WalkabilityGrid';
import { ConfigLoader } from './data/ConfigLoader';
import { SeededRNG } from './rng/SeededRNG';
import { FixedTimestep } from './time/FixedTimestep';
import { EntityId } from './types';

// Systems
import { CommandSystem } from './systems/CommandSystem';
import { MovementSystem } from './systems/MovementSystem';
import { AISystem } from './systems/AISystem';
import { CombatSystem } from './systems/CombatSystem';
import { SkillSystem } from './systems/SkillSystem';
import { PickupSystem } from './systems/PickupSystem';
import { ProgressionSystem } from './systems/ProgressionSystem';
import { SpawnSystem } from './systems/SpawnSystem';
import { LifetimeSystem } from './systems/LifetimeSystem';

export interface CoreOptions {
  seed?: number;
  ticksPerSecond?: number;
}

export class Core {
  public readonly rng: SeededRNG;
  public readonly entities: EntityManager;
  public readonly commandQueue: CommandQueue;
  public readonly eventBus: EventBus;
  public physics: PhysicsWorld;
  public readonly configs: ConfigLoader;
  public readonly timestep: FixedTimestep;

  // Systems in strict execution order
  private commandSystem: CommandSystem;
  private movementSystem: MovementSystem;
  private aiSystem: AISystem;
  private combatSystem: CombatSystem;
  private skillSystem: SkillSystem;
  private pickupSystem: PickupSystem;
  private progressionSystem: ProgressionSystem;
  private spawnSystem: SpawnSystem;
  private lifetimeSystem: LifetimeSystem;

  private primaryPlayerId: EntityId = -1;
  private isInitialized: boolean = false;

  constructor(options: CoreOptions = {}) {
    const seed = options.seed ?? 1999; // Mu Online heritage
    this.rng = new SeededRNG(seed);
    this.timestep = new FixedTimestep(options.ticksPerSecond ?? 20);
    this.entities = new EntityManager();
    this.commandQueue = new CommandQueue();
    this.eventBus = new EventBus();
    this.configs = new ConfigLoader();

    const mapConf = this.configs.getMap();
    this.physics = new PhysicsWorld(mapConf.width, mapConf.height, mapConf.cellSize);

    // Instantiate systems
    this.commandSystem = new CommandSystem(this.entities, this.commandQueue, this.eventBus, this.configs, this.physics);
    this.movementSystem = new MovementSystem(this.entities, this.physics);
    this.aiSystem = new AISystem(this.entities, this.rng, this.physics);
    this.combatSystem = new CombatSystem(this.entities, this.eventBus, this.rng, this.configs, this.physics);
    this.skillSystem = new SkillSystem(this.entities, this.eventBus, this.rng, this.configs);
    this.pickupSystem = new PickupSystem(this.entities, this.eventBus, this.configs);
    this.progressionSystem = new ProgressionSystem(this.entities, this.eventBus);
    this.spawnSystem = new SpawnSystem(this.entities, this.eventBus, this.rng, this.configs, this.physics);
    this.lifetimeSystem = new LifetimeSystem(this.entities);

    this.setupWorld();
  }

  /**
   * Configures map grid, static obstacles, safe zones, and initial entities.
   */
  private setupWorld(): void {
    const mapConf = this.configs.getMap();

    // Setup safe zone at town center (fountain area)
    const safeRadiusTiles = Math.floor(mapConf.safeZoneRadius / mapConf.cellSize);
    const centerGx = Math.floor(mapConf.spawnPoint.x / mapConf.cellSize);
    const centerGy = Math.floor(mapConf.spawnPoint.y / mapConf.cellSize);

    for (let gy = centerGy - safeRadiusTiles; gy <= centerGy + safeRadiusTiles; gy++) {
      for (let gx = centerGx - safeRadiusTiles; gx <= centerGx + safeRadiusTiles; gx++) {
        const distSq = (gx - centerGx) * (gx - centerGx) + (gy - centerGy) * (gy - centerGy);
        if (distSq <= safeRadiusTiles * safeRadiusTiles) {
          this.physics.grid.setTile(gx, gy, TileAttribute.SAFE_ZONE);
        }
      }
    }

    // Add obstacles from config
    for (let i = 0; i < mapConf.obstacles.length; i++) {
      const obs = mapConf.obstacles[i];
      this.physics.addObstacle(`obs_${i}`, obs.x, obs.y, obs.radius);

      // Block grid cell if large
      const { gx, gy } = this.physics.grid.worldToGrid({ x: obs.x, y: obs.y });
      this.physics.grid.setTile(gx, gy, TileAttribute.BLOCKED);
    }

    // Spawn initial monsters from spawn zones
    for (const zone of mapConf.spawnZones) {
      for (let i = 0; i < zone.count; i++) {
        const angle = (i / zone.count) * Math.PI * 2 + this.rng.rangeFloat(0, 0.5);
        const dist = this.rng.rangeFloat(1.0, zone.radius);
        const spawnX = zone.x + Math.cos(angle) * dist;
        const spawnY = zone.y + Math.sin(angle) * dist;

        this.spawnSystem.respawnMonster(zone.monsterId, { x: spawnX, y: spawnY });
      }
    }

    // Create primary player (Dark Knight)
    this.primaryPlayerId = this.createPlayer('DarkKnight');
    this.isInitialized = true;
  }

  /**
   * Creates a Dark Knight player entity with default class equipment and stats.
   */
  public createPlayer(_name: string = 'DarkKnight'): EntityId {
    const dkClass = this.configs.getClass('dark_knight')!;
    const mapConf = this.configs.getMap();

    const id = this.entities.createEntity(['Player']);

    this.entities.addComponent(id, {
      type: 'Transform',
      position: { x: mapConf.spawnPoint.x, y: mapConf.spawnPoint.y, z: 0 },
      previousPosition: { x: mapConf.spawnPoint.x, y: mapConf.spawnPoint.y, z: 0 },
      rotation: Math.PI * 0.5,
      height: 1.0
    });

    this.entities.addComponent(id, {
      type: 'Movement',
      speed: 4.8,
      velocity: { x: 0, y: 0 },
      desiredDirection: null,
      targetPosition: null,
      path: [],
      movementState: 'idle',
      stepOffset: 0.3
    });

    this.entities.addComponent(id, {
      type: 'Collider',
      shape: 'capsule',
      radius: 0.5,
      height: 1.8,
      isTrigger: false,
      solid: true
    });

    // Create Rapier body for player
    this.physics.createCharacterBody(
      id,
      mapConf.spawnPoint,
      0.5,
      1.8
    );

    this.entities.addComponent(id, {
      type: 'Health',
      currentHp: dkClass.baseHp,
      maxHp: dkClass.baseHp,
      isDead: false,
      deathTime: 0,
      respawnTimeSeconds: 5.0
    });

    this.entities.addComponent(id, {
      type: 'Combat',
      targetEntityId: null,
      attackSpeed: dkClass.defaultAttackSpeed,
      attackTimer: 0,
      damageMin: dkClass.defaultWeaponDamageMin,
      damageMax: dkClass.defaultWeaponDamageMax,
      defense: 10,
      attackRange: dkClass.defaultAttackRange,
      isAttacking: false,
      attackAnimationDuration: 0.25,
      attackAnimationTimer: 0
    });

    this.entities.addComponent(id, {
      type: 'SkillSet',
      skillSlots: ['weapon_skill', 'cyclone', 'slash', 'twisting_slash'],
      cooldowns: {
        weapon_skill: 0,
        cyclone: 0,
        slash: 0,
        twisting_slash: 0
      },
      selectedSlot: 1,
      currentMana: dkClass.baseMana,
      maxMana: dkClass.baseMana,
      castingSkillId: null,
      castTimer: 0
    });

    this.entities.addComponent(id, {
      type: 'Inventory',
      items: [
        { id: 'start_pot_1', templateId: 'small_healing_potion', name: 'Small Healing Potion', count: 5 },
        { id: 'start_sword', templateId: 'short_sword', name: 'Short Sword', count: 1 }
      ],
      zen: 500,
      capacity: 32,
      wantsPickup: false,
      pendingPickupItemId: null,
      equipment: {
        weapon: { id: 'eq_sword', templateId: 'short_sword', name: 'Short Sword', count: 1, equippedSlot: 'weapon' }
      }
    });

    this.entities.addComponent(id, {
      type: 'Player',
      classId: 'dark_knight',
      level: 1,
      currentExp: 0,
      expToNextLevel: 100,
      statPoints: 0,
      stats: {
        strength: dkClass.baseStats.strength,
        agility: dkClass.baseStats.agility,
        vitality: dkClass.baseStats.vitality,
        energy: dkClass.baseStats.energy
      }
    });

    this.eventBus.emit({
      type: 'OnEntitySpawned',
      entityId: id,
      templateId: 'dark_knight',
      tag: 'Player',
      position: { x: mapConf.spawnPoint.x, y: mapConf.spawnPoint.y, z: 0 }
    });

    return id;
  }

  public getPlayerId(): EntityId {
    return this.primaryPlayerId;
  }

  /**
   * Enqueues a command for the game world.
   */
  public enqueueCommand(command: Command): void {
    this.commandQueue.enqueue(command);
  }

  /**
   * Advances the engine by frameDeltaTime (accumulates time and executes fixedUpdate ticks).
   * Returns interpolation alpha in [0, 1].
   */
  public step(frameDeltaTimeSeconds: number): number {
    return this.timestep.step(frameDeltaTimeSeconds, (fixedDt, _tick) => {
      this.fixedUpdate(fixedDt);
    });
  }

  /**
   * Advances the simulation by exactly one fixed tick (dt = 0.05s).
   */
  public stepSingleTick(): void {
    this.timestep.stepSingleTick((fixedDt, _tick) => {
      this.fixedUpdate(fixedDt);
    });
  }

  /**
   * The Authoritative Fixed Update Loop (Section 3.3):
   * Order:
   * 1. CommandSystem
   * 2. MovementSystem
   * 3. AISystem
   * 4. CombatSystem
   * 5. SkillSystem
   * 6. PickupSystem
   * 7. ProgressionSystem
   * 8. SpawnSystem
   * 9. LifetimeSystem
   * 10. EventDispatch
   */
  public fixedUpdate(dt: number): CoreEvent[] {
    // 1. Process incoming commands
    this.commandSystem.update(dt);

    // 2. AI logic (mobs decide states and update targets/desired positions)
    this.aiSystem.update(dt);

    // 3. Movement + collisions + wall sliding + target approach
    this.movementSystem.update(dt);

    // 4. Combat (auto-attacks when in range)
    this.combatSystem.update(dt);

    // 5. Skills (cooldowns, casts, mana)
    this.skillSystem.update(dt);

    // 6. Pickup items & Zen
    this.pickupSystem.update(dt);

    // 7. Progression (exp, levels, stat points)
    this.progressionSystem.update(dt);

    // 8. Respawn dead monsters & timers
    this.spawnSystem.update(dt);

    // 9. Lifetime of drops and temporary entities
    this.lifetimeSystem.update(dt);

    // 10. Dispatch queued events to subscribers
    return this.eventBus.dispatchAll();
  }

  /**
   * Resets the entire world with an optional new seed.
   */
  public reset(seed?: number): void {
    this.progressionSystem.destroy();
    this.spawnSystem.destroy();

    const newSeed = seed ?? this.rng.getState();
    this.rng.setState(newSeed);
    this.timestep.reset();
    this.entities.reset();
    this.commandQueue.clear();
    this.eventBus.reset();

    this.physics.destroy();
    const mapConf = this.configs.getMap();
    this.physics = new PhysicsWorld(mapConf.width, mapConf.height, mapConf.cellSize);

    // Re-instantiate systems
    this.commandSystem = new CommandSystem(this.entities, this.commandQueue, this.eventBus, this.configs, this.physics);
    this.movementSystem = new MovementSystem(this.entities, this.physics);
    this.aiSystem = new AISystem(this.entities, this.rng, this.physics);
    this.combatSystem = new CombatSystem(this.entities, this.eventBus, this.rng, this.configs, this.physics);
    this.skillSystem = new SkillSystem(this.entities, this.eventBus, this.rng, this.configs);
    this.pickupSystem = new PickupSystem(this.entities, this.eventBus, this.configs);
    this.progressionSystem = new ProgressionSystem(this.entities, this.eventBus);
    this.spawnSystem = new SpawnSystem(this.entities, this.eventBus, this.rng, this.configs, this.physics);
    this.lifetimeSystem = new LifetimeSystem(this.entities);

    this.setupWorld();
  }

  /**
   * Deterministic State Fingerprint/Hash:
   * Hashes active entities, positions (quantized to 4 decimal places), HP, levels, and RNG state.
   * Can be compared between two runs with same seed and commands to prove 100% determinism.
   */
  public getStateHash(): string {
    const parts: (string | number)[] = [
      this.timestep.ticks,
      this.rng.getState()
    ];

    const entities = this.entities.getAllEntities();
    for (const id of entities) {
      parts.push(id);
      const transform = this.entities.getComponent(id, 'Transform');
      if (transform) {
        parts.push(
          Math.round(transform.position.x * 1000),
          Math.round(transform.position.y * 1000)
        );
      }
      const health = this.entities.getComponent(id, 'Health');
      if (health) {
        parts.push(health.currentHp, health.isDead ? 1 : 0);
      }
      const player = this.entities.getComponent(id, 'Player');
      if (player) {
        parts.push(player.level, player.currentExp, player.statPoints);
      }
      const inv = this.entities.getComponent(id, 'Inventory');
      if (inv) {
        parts.push(inv.zen, inv.items.length);
      }
    }

    // Simple FNV-1a 32-bit hash
    let hash = 2166136261;
    const str = parts.join('|');
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
}
