import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { ShakeDetector } from './shake-detector';

/** The app's own constants, so the tests exercise the shipped configuration. */
const THRESHOLD = 3;
const SETTLE_DELAY_MS = 800;

/**
 * Feeds a sequence of X readings, one per animation-frame-ish tick, to model the sensor
 * stream. A real shake oscillates; `amplitude` is the peak swing and `swings` is how
 * many times it reverses.
 */
function feedShake(
  detector: ShakeDetector,
  { amplitude, swings, samplesPerSwing = 5 }: { amplitude: number; swings: number; samplesPerSwing?: number },
) {
  for (let s = 0; s < swings; s++) {
    const sign = s % 2 === 0 ? 1 : -1;
    for (let i = 0; i < samplesPerSwing; i++) {
      // Ramp from 0 out to the peak so the first sample of each swing is a real
      // intermediate value rather than an instant jump.
      const t = (i + 1) / samplesPerSwing;
      detector.addSample(sign * amplitude * t);
    }
  }
}

describe('ShakeDetector', () => {
  let onRoll: Mock<() => void>;
  let detector: ShakeDetector;

  beforeEach(() => {
    vi.useFakeTimers();
    onRoll = vi.fn<() => void>();
    detector = new ShakeDetector(THRESHOLD, SETTLE_DELAY_MS, onRoll);
  });

  afterEach(() => {
    detector.dispose();
    vi.useRealTimers();
  });

  it('does not roll when the device is perfectly still', () => {
    for (let i = 0; i < 200; i++) {
      detector.addSample(0);
    }
    vi.advanceTimersByTime(SETTLE_DELAY_MS * 3);

    expect(onRoll).not.toHaveBeenCalled();
  });

  it('rolls once for a real shake, not once per sample', () => {
    feedShake(detector, { amplitude: 9, swings: 4 });

    // Still settling: the shake is ongoing, so nothing has been decided yet.
    expect(onRoll).not.toHaveBeenCalled();
    expect(detector.isSettling).toBe(true);

    vi.advanceTimersByTime(SETTLE_DELAY_MS);

    expect(onRoll).toHaveBeenCalledTimes(1);
  });

  it('rolls only after the device settles, not at the start of the shake', () => {
    feedShake(detector, { amplitude: 9, swings: 2 });

    vi.advanceTimersByTime(SETTLE_DELAY_MS - 1);
    expect(onRoll).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onRoll).toHaveBeenCalledTimes(1);
  });

  it('restarts the settle timer on every swing, so the delay counts from the last one', () => {
    // First swing.
    detector.addSample(9);
    vi.advanceTimersByTime(SETTLE_DELAY_MS - 100);

    // A further swing 100 ms later must push the roll out, not let it land.
    detector.addSample(-9);
    vi.advanceTimersByTime(SETTLE_DELAY_MS - 100);
    expect(onRoll).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(onRoll).toHaveBeenCalledTimes(1);
  });

  it('ignores hand tremor that stays below the threshold', () => {
    for (let i = 0; i < 300; i++) {
      // +/-1.2 m/s^2 tremor: peak-to-trough is 2.4, under the threshold of 3.
      detector.addSample(i % 2 === 0 ? 1.2 : -1.2);
    }
    vi.advanceTimersByTime(SETTLE_DELAY_MS * 3);

    expect(onRoll).not.toHaveBeenCalled();
  });

  it('ignores a steady, non-zero resting position (device held at an angle)', () => {
    // Gravity projects onto X when the phone is not held upright. The first reading
    // exceeds the zero-seeded baseline and rolls once, then the baseline is correct and
    // holding steady is ignored. This documents the seeded-baseline behaviour.
    detector.addSample(-3.5);
    vi.advanceTimersByTime(SETTLE_DELAY_MS);
    expect(onRoll).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 300; i++) {
      detector.addSample(-3.5);
    }
    vi.advanceTimersByTime(SETTLE_DELAY_MS * 3);

    expect(onRoll).toHaveBeenCalledTimes(1);
  });

  it('ignores readings that are not finite numbers', () => {
    detector.addSample(Number.NaN);
    detector.addSample(Number.POSITIVE_INFINITY);
    vi.advanceTimersByTime(SETTLE_DELAY_MS * 3);

    expect(onRoll).not.toHaveBeenCalled();
  });

  it('cancels a pending roll when disposed mid-settle', () => {
    detector.addSample(9);
    expect(detector.isSettling).toBe(true);

    detector.dispose();
    vi.advanceTimersByTime(SETTLE_DELAY_MS * 3);

    expect(onRoll).not.toHaveBeenCalled();
    expect(detector.isSettling).toBe(false);
  });

  it('accepts a second shake after the first has settled', () => {
    feedShake(detector, { amplitude: 9, swings: 3 });
    vi.advanceTimersByTime(SETTLE_DELAY_MS);
    expect(onRoll).toHaveBeenCalledTimes(1);

    feedShake(detector, { amplitude: 9, swings: 3 });
    vi.advanceTimersByTime(SETTLE_DELAY_MS);

    expect(onRoll).toHaveBeenCalledTimes(2);
  });
});
