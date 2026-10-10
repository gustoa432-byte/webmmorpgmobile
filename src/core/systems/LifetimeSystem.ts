/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EntityManager } from '../entity/EntityManager';

export class LifetimeSystem {
  constructor(private entities: EntityManager) {}

  public update(dt: number): void {
    const mortalEntities = this.entities.query(['Lifetime']);

    for (const id of mortalEntities) {
      const lifetime = this.entities.getComponent(id, 'Lifetime');
      if (!lifetime) continue;

      lifetime.remainingSeconds -= dt;

      if (lifetime.remainingSeconds <= 0 && lifetime.despawnOnExpire) {
        this.entities.destroyEntity(id);
      }
    }
  }
}
