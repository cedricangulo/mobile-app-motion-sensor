import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomePage } from './home.page';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
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
