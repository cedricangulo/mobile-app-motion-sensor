import { WebPlugin } from '@capacitor/core';

import type { AccelerometerPlugin } from './accelerometer';

/**
 * Browser fallback, used by `ng serve` and by unit tests where no native module exists.
 *
 * Mirrors `@capacitor/motion`'s web implementation: it forwards the browser
 * `devicemotion` event. `WebPlugin.registerWindowListener` passes the raw
 * `DeviceMotionEvent` through untouched, and that event already exposes
 * `accelerationIncludingGravity`, so no reshaping is required.
 *
 * Note that the Android WebView does not deliver accelerometer data this way — that is
 * precisely why the native plugin exists.
 */
export class AccelerometerWeb extends WebPlugin implements AccelerometerPlugin {
  constructor() {
    super();
    // WebPlugin.addListener then routes 'accel' subscribers to this window event.
    this.registerWindowListener('devicemotion', 'accel');
  }
}
