import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Annotation } from './annotation';

describe('Annotation', () => {
  let component: Annotation;
  let fixture: ComponentFixture<Annotation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Annotation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Annotation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
