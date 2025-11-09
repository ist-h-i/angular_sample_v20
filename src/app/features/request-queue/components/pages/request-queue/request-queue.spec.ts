import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequestQueue } from './request-queue';

describe('RequestQueue', () => {
  let component: RequestQueue;
  let fixture: ComponentFixture<RequestQueue>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestQueue]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RequestQueue);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
