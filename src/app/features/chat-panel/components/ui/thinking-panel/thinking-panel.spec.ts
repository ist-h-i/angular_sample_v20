import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThinkingPanel } from './thinking-panel';
import { ApiService } from '../../../../../shared/core/services/api.service';

const mockApiService = {} as ApiService;

describe('ThinkingPanel', () => {
  let component: ThinkingPanel;
  let fixture: ComponentFixture<ThinkingPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThinkingPanel],
      providers: [{ provide: ApiService, useValue: mockApiService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ThinkingPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
