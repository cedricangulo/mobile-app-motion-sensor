/**
 * Shake detection, extracted from the component so it can be unit tested without
 * Angular or a device.
 *
 * The algorithm is unchanged from the original: the X reading is compared against a
 * running `baseline`, and whenever the gap exceeds the threshold the baseline re-anchors
 * to that new extreme. That is what makes it work — a shake reverses direction, so each
 * swing in the opposite direction is measured from the last spike and also exceeds the
 * threshold, keeping the settle timer alive. It behaves like peak-to-trough detection
 * without needing an explicit window.
 *
 * A shake is reported only once the device has been still for `settleDelayMs`, so the
 * result is readable while the phone is being held rather than flickering mid-shake.
 */
export class ShakeDetector {
  /**
   * Accelerometer delta, in m/s^2, that counts as deliberate movement.
   *
   * Seeded at 0, so the very first reading is measured against zero rather than against
   * the device's actual resting orientation. In practice that means picking the phone up
   * can register one roll, after which the baseline is correct. Left as-is because it is
   * the original behaviour and it is harmless once the first shake lands.
   */
  private baseline = 0;

  private rollTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly threshold = 3,
    private readonly settleDelayMs = 800,
    private readonly onRoll: () => void,
  ) {}

  /**
   * Feeds one X reading. Schedules a roll if this reading is a major movement; restarts
   * the timer if a roll is already pending, so only the end of a burst decides the value.
   */
  addSample(x: number): void {
    if (!Number.isFinite(x)) {
      return;
    }

    if (Math.abs(x - this.baseline) <= this.threshold) {
      return;
    }

    this.baseline = x;
    clearTimeout(this.rollTimer);
    this.rollTimer = setTimeout(() => this.onRoll(), this.settleDelayMs);
  }

  /** True while a roll is pending, i.e. movement was seen and the settle delay is running. */
  get isSettling(): boolean {
    return this.rollTimer !== undefined;
  }

  /** Cancels a pending roll. Call when the owning page is destroyed. */
  dispose(): void {
    clearTimeout(this.rollTimer);
    this.rollTimer = undefined;
  }
}
