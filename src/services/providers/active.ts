import { DEFAULT_PROVIDER_ID } from './registry';
import type { ProviderId } from './types';

// Kept in its own module with no other imports so both the cache layer and the
// fetch layer can read it without creating an import cycle.
let activeProviderId: ProviderId = DEFAULT_PROVIDER_ID;

export function setActiveProviderId(id: ProviderId | undefined) {
  activeProviderId = id || DEFAULT_PROVIDER_ID;
}

export function getActiveProviderId(): ProviderId {
  return activeProviderId;
}
