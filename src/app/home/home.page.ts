import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import type { PluginListenerHandle } from '@capacitor/core';

import { ACCELEROMETER } from '../accelerometer/accelerometer';
import { ShakeDetector } from '../accelerometer/shake-detector';

/** Accelerometer delta, in m/s^2, that counts as a deliberate shake. */
const MAJOR_MOVE_THRESHOLD = 3;

/** Quiet period after the last shake before the dice is actually rolled. */
const SETTLE_DELAY_MS = 800;

const SIDES = 6;

/**
 * Rolls a 1-6 dice when the device is shaken along the X axis.
 *
 * The value only changes on a *major* movement and only once the device has been still
 * for `SETTLE_DELAY_MS`, so the result stays readable while the phone is still being
 * held. Hand tremor stays below `MAJOR_MOVE_THRESHOLD` and is ignored.
 */
@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
})
export class HomePage implements OnInit, OnDestroy {
  readonly number = signal(0);

  /**
   * Shown when the accelerometer could not be started. Without this the page is
   * indistinguishable from "the dice just never rolls", which is exactly how a missing
   * `registerPlugin` call went unnoticed.
   */
  readonly sensorError = signal<string | null>(null);

  private readonly accelerometer = inject(ACCELEROMETER);

  private detector = new ShakeDetector(
    MAJOR_MOVE_THRESHOLD,
    SETTLE_DELAY_MS,
    () => this.rollDice(),
  );

  private accelListener: PluginListenerHandle | undefined;

  async ngOnInit() {
    try {
      this.accelListener = await this.accelerometer.addListener('accel', (event) => {
        const accel = event.accelerationIncludingGravity ?? event.acceleration;
        if (!accel) return;

        this.detector.addSample(accel.x);
      });
      this.sensorError.set(null);
    } catch (err) {
      // Surface this rather than swallowing it: an unregistered plugin, an emulator, or
      // a device with no accelerometer all land here, and each needs to be visible.
      const message = err instanceof Error ? err.message : String(err);
      this.sensorError.set(message);
      console.error('[MotionDice] accelerometer unavailable:', message);
    }
  }

  ngOnDestroy() {
    this.detector.dispose();
    void this.accelListener?.remove();
    this.accelListener = undefined;
  }

  rollDice() {
    this.number.set(Math.floor(Math.random() * SIDES) + 1);
  }
}
