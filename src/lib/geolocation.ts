import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface SimplePosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export type LocationPermissionState = 'granted' | 'denied' | 'prompt';

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Current permission state.
 *
 * On Android the WebView reports `denied` for geolocation until the *app* holds the runtime
 * permission, and the app can only get it by asking. So never treat that as final: the native
 * path always reports the real OS state.
 */
export async function locationPermissionState(): Promise<LocationPermissionState> {
  if (isNative()) {
    try {
      const status = await Geolocation.checkPermissions();
      if (status.location === 'granted' || status.coarseLocation === 'granted') return 'granted';
      if (status.location === 'denied' && status.coarseLocation === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'prompt';
    }
  }

  if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return result.state as LocationPermissionState;
    } catch {
      return 'prompt';
    }
  }
  return 'prompt';
}

/** Asks the OS for location access. Native shows the system dialog. */
export async function requestLocationAccess(): Promise<boolean> {
  if (isNative()) {
    try {
      const status = await Geolocation.requestPermissions({ permissions: ['location'] });
      return status.location === 'granted' || status.coarseLocation === 'granted';
    } catch {
      return false;
    }
  }
  return true;
}

function toSimple(coords: { latitude: number; longitude: number; accuracy: number | null }): SimplePosition {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy ?? 0,
  };
}

/** One-shot fix. Uses the native provider on device, the browser API elsewhere. */
export async function getCurrentPositionOnce(options?: {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}): Promise<SimplePosition> {
  const opts = {
    enableHighAccuracy: options?.enableHighAccuracy ?? true,
    timeout: options?.timeout ?? 10000,
    maximumAge: options?.maximumAge ?? 30000,
  };

  if (isNative()) {
    const position = await Geolocation.getCurrentPosition(opts);
    return toSimple(position.coords);
  }

  return new Promise<SimplePosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(toSimple(pos.coords)),
      (err) => reject(err),
      opts
    );
  });
}

/** True when the failure was a permission denial rather than a timeout/no-fix. */
export function isPermissionDenied(err: unknown): boolean {
  const anyErr = err as { code?: number | string; message?: string } | undefined;
  if (!anyErr) return false;
  if (anyErr.code === 1) return true; // PositionError.PERMISSION_DENIED
  return /denied|permission/i.test(String(anyErr.message || ''));
}
