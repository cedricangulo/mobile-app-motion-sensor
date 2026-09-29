import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { ACCELEROMETER, type AccelerometerPlugin } from '../accelerometer/accelerometer';
import { HomePage } from './home.page';

/** Builds a stub plugin whose `addListener` resolves to an inert handle. */
function stubPlugin(addListener: Mock<AccelerometerPlugin['addListener']>) {
  return {
    provide: ACCELEROMETER,
    useValue: { addListener, removeAllListeners: vi.fn() } satisfies AccelerometerPlugin,
  };
}

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  let addListener: Mock<AccelerometerPlugin['addListener']>;

  beforeEach(async () => {
    // A stub, not the real plugin: `registerPlugin` resolves to the web fallback under
    // test, whose handle rejects on remove() and produces unhandled rejections.
    addListener = vi.fn<AccelerometerPlugin['addListener']>().mockResolvedValue({
      remove: vi.fn().mockResolvedValue(undefined),
    });
    TestBed.configureTestingModule({ providers: [stubPlugin(addListener)] });
    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    // ngOnInit is invoked directly rather than via detectChanges(): it is async, and
    // letting Angular also fire it would subscribe twice per test.
    await component.ngOnInit();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('subscribes to the accelerometer', () => {
    expect(addListener).toHaveBeenCalledOnce();
    expect(addListener.mock.calls[0][0]).toBe('accel');
  });

  it('starts on zero', () => {
    expect(component.number()).toBe(0);
  });

  it('rolls a value between 1 and 6', () => {
    for (let i = 0; i < 100; i++) {
      component.rollDice();
      expect(component.number()).toBeGreaterThanOrEqual(1);
      expect(component.number()).toBeLessThanOrEqual(6);
    }
  });

  it('is safe to destroy twice', () => {
    fixture.destroy();
    // A second teardown would throw on an already-removed handle if cleanup were wrong.
    expect(() => component.ngOnDestroy()).not.toThrow();
  });
});
