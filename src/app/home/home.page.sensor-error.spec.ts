import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { ACCELEROMETER, type AccelerometerPlugin } from '../accelerometer/accelerometer';
import { HomePage } from './home.page';

/**
 * Guards the regression where a missing `registerPlugin()` call in `MainActivity` made
 * the page fail silently.
 *
 * The bridge answers an unknown plugin with `"unable to find plugin : Accelerometer"`.
 * The original code caught that rejection and discarded it, so the app launched, looked
 * healthy, and simply never responded to a shake — the failure was only discoverable by
 * physically shaking a phone. The page now records the reason in `sensorError` and logs
 * it, which is what these tests assert.
 */
function stubAccelerometer(addListener: Mock<AccelerometerPlugin['addListener']>) {
  return {
    provide: ACCELEROMETER,
    useValue: { addListener, removeAllListeners: vi.fn() } satisfies AccelerometerPlugin,
  };
}

async function createWith(providers: unknown[]) {
  TestBed.configureTestingModule({ providers: providers as never[] });
  const fixture = TestBed.createComponent(HomePage);
  // ngOnInit is called directly rather than via detectChanges(): it is async, and
  // letting Angular also fire it would invoke the listener twice per test.
  await fixture.componentInstance.ngOnInit();
  return fixture;
}

describe('HomePage accelerometer failures', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('reports a missing native plugin rather than failing silently', async () => {
    const addListener = vi.fn().mockRejectedValue(new Error('unable to find plugin : Accelerometer'));
    const fixture = await createWith([stubAccelerometer(addListener)]);

    expect(fixture.componentInstance.sensorError()).toContain('unable to find plugin');
    fixture.destroy();
  });

  it('reports a device with no accelerometer', async () => {
    const addListener = vi.fn().mockRejectedValue(new Error('No accelerometer on this device'));
    const fixture = await createWith([stubAccelerometer(addListener)]);

    expect(fixture.componentInstance.sensorError()).toContain('No accelerometer');
    fixture.destroy();
  });

  it('leaves sensorError null when the sensor starts', async () => {
    const addListener = vi.fn().mockResolvedValue({ remove: vi.fn() });
    const fixture = await createWith([stubAccelerometer(addListener)]);

    expect(addListener).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.sensorError()).toBeNull();
    fixture.destroy();
  });
});
