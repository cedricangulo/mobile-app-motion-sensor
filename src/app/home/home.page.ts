import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import type { PluginListenerHandle } from '@capacitor/core';

import { Accelerometer } from '../accelerometer/accelerometer';

/**
 * Rolls a 1-6 dice when the device is shaken along the X axis.
 *
 * The value only changes on a *major* movement and only once the device has been
 * still for `SETTLE_DELAY_MS`, so the result stays readable while the phone is
 * still being held. Hand tremor stays below `MAJOR_MOVE_THRESHOLD` and is ignored.
 */
@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
})
export class HomePage implements OnInit, OnDestroy {
  /** Accelerometer delta, in m/s^2, that counts as a deliberate shake. */
  private static readonly MAJOR_MOVE_THRESHOLD = 3;

  /** Quiet period after the last shake before the dice is actually rolled. */
  private static readonly SETTLE_DELAY_MS = 800;

  private static readonly SIDES = 6;

  readonly number = signal(0);

  /** Last accepted X reading, used as the baseline for the next shake. */
  private lastAccelX = 0;

  private rollTimer: ReturnType<typeof setTimeout> | undefined;
  private accelListener: PluginListenerHandle | undefined;

  async ngOnInit() {
    // `addListener` rejects where no accelerometer is exposed (an emulator, a desktop
    // browser). Swallowing that keeps the page usable and stops the rejection from
    // surfacing as an unhandled promise.
    try {
      this.accelListener = await Accelerometer.addListener('accel', (event) => {
        const accel = event.accelerationIncludingGravity ?? event.acceleration;
        if (!accel) return;

        if (Math.abs(accel.x - this.lastAccelX) > HomePage.MAJOR_MOVE_THRESHOLD) {
          this.lastAccelX = accel.x;
          this.scheduleRoll();
        }
      });
    } catch {
      // No accelerometer on this device; the UI stays at its initial value.
    }
  }

  ngOnDestroy() {
    clearTimeout(this.rollTimer);
    // The original implementation dropped the handle here, which leaked the native
    // listener every time the page was revisited.
    void this.accelListener?.remove();
    this.accelListener = undefined;
  }

  /** Restarts the settle timer, so only the final shake of a burst decides the roll. */
  private scheduleRoll() {
    clearTimeout(this.rollTimer);
    this.rollTimer = setTimeout(() => this.rollDice(), HomePage.SETTLE_DELAY_MS);
  }

  rollDice() {
    this.number.set(Math.floor(Math.random() * HomePage.SIDES) + 1);
  }
}
