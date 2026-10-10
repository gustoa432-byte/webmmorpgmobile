/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BaseComponent,
  ComponentMap,
  ComponentType
} from './Component';
import { EntityId, EntityTag } from '../types';

export class EntityManager {
  private nextId: EntityId = 1;
  private activeEntities: Set<EntityId> = new Set();
  private entityTags: Map<EntityId, Set<EntityTag>> = new Map();
  private components: Map<ComponentType, Map<EntityId, BaseComponent>> = new Map();

  // Cached queries for performance
  private queryCache: Map<string, EntityId[]> = new Map();
  private isCacheDirty: boolean = true;

  constructor() {
    // Initialise empty component maps for each known component type
    const types: ComponentType[] = [
      'Transform',
      'Movement',
      'Collider',
      'Health',
      'Combat',
      'SkillSet',
      'Inventory',
      'AI',
      'Player',
      'ItemDrop',
      'Lifetime'
    ];
    for (const type of types) {
      this.components.set(type, new Map());
    }
  }

  /**
   * Clears all entities and resets ID counter.
   */
  public reset(): void {
    this.nextId = 1;
    this.activeEntities.clear();
    this.entityTags.clear();
    for (const compMap of this.components.values()) {
      compMap.clear();
    }
    this.queryCache.clear();
    this.isCacheDirty = true;
  }

  /**
   * Creates a new entity with a deterministic sequential ID.
   */
  public createEntity(tags: EntityTag[] = []): EntityId {
    const id = this.nextId++;
    this.activeEntities.add(id);

    const tagSet = new Set<EntityTag>(tags);
    this.entityTags.set(id, tagSet);
    this.isCacheDirty = true;
    return id;
  }

  /**
   * Destroys an entity and all its attached components.
   */
  public destroyEntity(id: EntityId): boolean {
    if (!this.activeEntities.has(id)) {
      return false;
    }

    this.activeEntities.delete(id);
    this.entityTags.delete(id);

    for (const compMap of this.components.values()) {
      compMap.delete(id);
    }

    this.isCacheDirty = true;
    return true;
  }

  /**
   * Checks whether an entity is active.
   */
  public hasEntity(id: EntityId): boolean {
    return this.activeEntities.has(id);
  }

  /**
   * Returns all active entity IDs in strictly sorted deterministic order.
   */
  public getAllEntities(): EntityId[] {
    return Array.from(this.activeEntities).sort((a, b) => a - b);
  }

  /**
   * Tags an entity.
   */
  public addTag(id: EntityId, tag: EntityTag): void {
    if (!this.activeEntities.has(id)) return;
    let tagSet = this.entityTags.get(id);
    if (!tagSet) {
      tagSet = new Set();
      this.entityTags.set(id, tagSet);
    }
    tagSet.add(tag);
  }

  /**
   * Removes a tag from an entity.
   */
  public removeTag(id: EntityId, tag: EntityTag): void {
    const tagSet = this.entityTags.get(id);
    if (tagSet) {
      tagSet.delete(tag);
    }
  }

  /**
   * Checks if an entity has a specific tag.
   */
  public hasTag(id: EntityId, tag: EntityTag): boolean {
    const tagSet = this.entityTags.get(id);
    return tagSet ? tagSet.has(tag) : false;
  }

  /**
   * Gets entities with a specific tag in sorted deterministic order.
   */
  public getEntitiesByTag(tag: EntityTag): EntityId[] {
    const result: EntityId[] = [];
    for (const id of this.getAllEntities()) {
      const tagSet = this.entityTags.get(id);
      if (tagSet && tagSet.has(tag)) {
        result.push(id);
      }
    }
    return result;
  }

  /**
   * Adds or replaces a component on an entity.
   */
  public addComponent<T extends BaseComponent>(id: EntityId, component: T): void {
    if (!this.activeEntities.has(id)) return;
    const compMap = this.components.get(component.type);
    if (compMap) {
      compMap.set(id, component);
      this.isCacheDirty = true;
    }
  }

  /**
   * Retrieves a component by type from an entity.
   */
  public getComponent<K extends ComponentType>(id: EntityId, type: K): ComponentMap[K] | undefined {
    const compMap = this.components.get(type);
    return compMap ? (compMap.get(id) as ComponentMap[K] | undefined) : undefined;
  }

  /**
   * Checks if an entity has a specific component.
   */
  public hasComponent(id: EntityId, type: ComponentType): boolean {
    const compMap = this.components.get(type);
    return compMap ? compMap.has(id) : false;
  }

  /**
   * Removes a component from an entity.
   */
  public removeComponent(id: EntityId, type: ComponentType): void {
    const compMap = this.components.get(type);
    if (compMap && compMap.delete(id)) {
      this.isCacheDirty = true;
    }
  }

  /**
   * Queries entities that have ALL specified components.
   * Returns IDs in strictly sorted deterministic order.
   */
  public query(requiredTypes: ComponentType[]): EntityId[] {
    const cacheKey = requiredTypes.slice().sort().join('+');
    if (!this.isCacheDirty && this.queryCache.has(cacheKey)) {
      return this.queryCache.get(cacheKey)!;
    }

    if (requiredTypes.length === 0) {
      return this.getAllEntities();
    }

    // Pick smallest map to start intersection
    let smallestType = requiredTypes[0];
    let smallestSize = this.components.get(smallestType)?.size ?? 0;

    for (let i = 1; i < requiredTypes.length; i++) {
      const size = this.components.get(requiredTypes[i])?.size ?? 0;
      if (size < smallestSize) {
        smallestSize = size;
        smallestType = requiredTypes[i];
      }
    }

    const candidateMap = this.components.get(smallestType);
    if (!candidateMap || candidateMap.size === 0) {
      this.queryCache.set(cacheKey, []);
      return [];
    }

    const matched: EntityId[] = [];
    for (const id of candidateMap.keys()) {
      let match = true;
      for (const reqType of requiredTypes) {
        if (reqType === smallestType) continue;
        if (!this.components.get(reqType)?.has(id)) {
          match = false;
          break;
        }
      }
      if (match) {
        matched.push(id);
      }
    }

    // Sort deterministically
    matched.sort((a, b) => a - b);
    this.queryCache.set(cacheKey, matched);
    return matched;
  }

  /**
   * Call after batch updates if needed.
   */
  public markCacheClean(): void {
    this.isCacheDirty = false;
  }
}
