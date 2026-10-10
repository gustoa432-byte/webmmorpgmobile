/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EntityManager } from '../entity/EntityManager';
import { EventBus } from '../events/EventBus';
import { ConfigLoader } from '../data/ConfigLoader';

export class PickupSystem {
  constructor(
    private entities: EntityManager,
    private eventBus: EventBus,
    private configs: ConfigLoader
  ) {}

  public update(_dt: number): void {
    const players = this.entities.getEntitiesByTag('Player');
    const itemEntities = this.entities.getEntitiesByTag('Item');

    if (itemEntities.length === 0) return;

    for (const playerId of players) {
      const pTransform = this.entities.getComponent(playerId, 'Transform');
      const pInventory = this.entities.getComponent(playerId, 'Inventory');
      const pHealth = this.entities.getComponent(playerId, 'Health');

      if (!pTransform || !pInventory || pHealth?.isDead) continue;

      const wantsPickup = (pInventory as any).wantsPickup === true;
      const targetedItemId = (pInventory as any).pendingPickupItemId as number | null;

      // Reset pickup intent flag for this tick
      (pInventory as any).wantsPickup = false;
      (pInventory as any).pendingPickupItemId = null;

      // Pickup radius: 1.0 for walk-over, 2.4 if explicitly commanded to pick up
      const pickupRadius = wantsPickup ? 2.4 : 0.8;

      for (const itemId of itemEntities) {
        if (!this.entities.hasEntity(itemId)) continue;

        // If specific item requested, ignore others unless general pickup
        if (targetedItemId !== null && targetedItemId !== undefined && itemId !== targetedItemId) {
          continue;
        }

        const iTransform = this.entities.getComponent(itemId, 'Transform');
        const iDrop = this.entities.getComponent(itemId, 'ItemDrop');

        if (!iTransform || !iDrop) continue;

        const dist = Math.hypot(
          iTransform.position.x - pTransform.position.x,
          iTransform.position.y - pTransform.position.y
        );

        if (dist <= pickupRadius) {
          this.pickUpItem(playerId, itemId);
          break; // One item per tick per player
        }
      }
    }
  }

  private pickUpItem(playerId: number, itemId: number): void {
    const inventory = this.entities.getComponent(playerId, 'Inventory');
    const itemDrop = this.entities.getComponent(itemId, 'ItemDrop');

    if (!inventory || !itemDrop) return;

    const itemConfig = this.configs.getItem(itemDrop.templateId);

    // Zen is currency - added directly to wallet
    if (itemDrop.templateId === 'zen' || itemDrop.zenAmount > 0) {
      const zenGain = itemDrop.zenAmount > 0 ? itemDrop.zenAmount : 50;
      inventory.zen += zenGain;

      this.eventBus.emit({
        type: 'OnItemPicked',
        entityId: itemId,
        pickerId: playerId,
        itemTemplateId: 'zen',
        itemName: 'Zen',
        count: zenGain,
        zenAmount: zenGain
      });

      this.entities.destroyEntity(itemId);
      return;
    }

    // Normal item: check inventory capacity
    if (inventory.items.length >= inventory.capacity) {
      return; // Bag full!
    }

    // Check stackable item
    if (itemConfig?.stackable) {
      const existing = inventory.items.find(i => i.templateId === itemDrop.templateId);
      if (existing) {
        existing.count += itemDrop.count;
        this.eventBus.emit({
          type: 'OnItemPicked',
          entityId: itemId,
          pickerId: playerId,
          itemTemplateId: itemDrop.templateId,
          itemName: itemDrop.itemName,
          count: itemDrop.count,
          zenAmount: 0
        });
        this.entities.destroyEntity(itemId);
        return;
      }
    }

    // Add new inventory entry
    inventory.items.push({
      id: `item_${Date.now()}_${itemId}`,
      templateId: itemDrop.templateId,
      name: itemDrop.itemName,
      count: itemDrop.count
    });

    this.eventBus.emit({
      type: 'OnItemPicked',
      entityId: itemId,
      pickerId: playerId,
      itemTemplateId: itemDrop.templateId,
      itemName: itemDrop.itemName,
      count: itemDrop.count,
      zenAmount: 0
    });

    this.entities.destroyEntity(itemId);
  }
}
