import { DEFAULT_AQI_SOURCE_ID } from './registry';
import type { AqiSourceId } from './types';

let activeAqiSourceId: AqiSourceId = DEFAULT_AQI_SOURCE_ID;

export function setActiveAqiSourceId(id: AqiSourceId | undefined) {
  activeAqiSourceId = id || DEFAULT_AQI_SOURCE_ID;
}

export function getActiveAqiSourceId(): AqiSourceId {
  return activeAqiSourceId;
}
