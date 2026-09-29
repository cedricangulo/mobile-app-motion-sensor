import { InjectionToken } from '@angular/core';
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/**
 * A single accelerometer reading, in m/s^2, including gravity.
 */
export interface Acceleration {
  x: number;
  y: number;
  z: number;
}

export interface AccelEvent {
  /** Reading including gravity. This is what shake detection uses. */
  accelerationIncludingGravity: Acceleration;
  /** Alias kept for parity with `@capacitor/motion`. */
  acceleration: Acceleration;
}

export interface AccelerometerPlugin {
  addListener(
    eventName: 'accel',
    listenerFunc: (event: AccelEvent) => void,
  ): Promise<PluginListenerHandle>;

  removeAllListeners(): Promise<void>;
}

/**
 * Native accelerometer, implemented in `android/app/src/main/java/io/ionic/motiondice/`
 * against `SensorManager`.
 *
 * This replaces `@capacitor/motion`, which ships no Android code — it is web-only and
 * listens for the browser `devicemotion` event that the Android WebView never fires for
 * the accelerometer, so it silently yields no readings on a real device.
 *
 * `registerPlugin` resolves to the native module on Android. In a browser (`ng serve`)
 * or under test there is no native module, so calls reject — callers should tolerate
 * that rather than assume sensor data is always available.
 */
export const Accelerometer = registerPlugin<AccelerometerPlugin>('Accelerometer', {
  web: () => import('./accelerometer.web').then((m) => new m.AccelerometerWeb()),
});

/**
 * Injection token for {@link Accelerometer}.
 *
 * `registerPlugin` returns a Proxy, so its members cannot be replaced in place, and the
 * Angular unit-test builder rejects `vi.mock` for relative imports. Injecting the plugin
 * through the token lets tests supply a stub via `{ provide: ACCELEROMETER, useValue }`
 * while the app keeps the default factory.
 */
export const ACCELEROMETER = new InjectionToken<AccelerometerPlugin>('Accelerometer', {
  providedIn: 'root',
  factory: () => Accelerometer,
});
