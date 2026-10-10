/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import RAPIER from '@dimforge/rapier2d-compat';

let rapierInitialized = false;
let initPromise: Promise<typeof RAPIER> | null = null;

/**
 * Asynchronously initializes the Rapier 2D WASM binary.
 * Safe to call multiple times; subsequent calls return the same promise.
 */
export async function initRapier(): Promise<typeof RAPIER> {
  if (rapierInitialized) {
    return RAPIER;
  }
  if (!initPromise) {
    initPromise = RAPIER.init().then(() => {
      rapierInitialized = true;
      return RAPIER;
    });
  }
  return initPromise;
}

/**
 * Returns true if the Rapier WASM runtime is already loaded and ready.
 */
export function isRapierReady(): boolean {
  return rapierInitialized;
}

export { RAPIER };
