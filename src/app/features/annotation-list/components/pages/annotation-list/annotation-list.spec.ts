import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { AnnotationList } from './annotation-list';
import { SelectedRequestStore } from '../../../../../shared/core/stores/selected-request.store';
import type { RequestDetail } from '../../../../../shared/core/models/request.model';

class SelectedRequestStoreStub {
  private readonly _detail = signal<RequestDetail | null>(null);
  private readonly _selectedMessageIndex = signal<number | null>(null);

  detail = this._detail.asReadonly();
  selectedMessageIndex = this._selectedMessageIndex.asReadonly();

  setDetail(detail: RequestDetail | null): void {
    this._detail.set(detail);
  }

  setSelectedMessageIndex(index: number | null): void {
    this._selectedMessageIndex.set(index);
  }
}

describe('AnnotationList', () => {
  let component: AnnotationList;
  let fixture: ComponentFixture<AnnotationList>;
  let selectedStore: SelectedRequestStoreStub;

  beforeEach(async () => {
    selectedStore = new SelectedRequestStoreStub();
    await TestBed.configureTestingModule({
      imports: [AnnotationList],
      providers: [
        {
          provide: SelectedRequestStore,
          useValue: selectedStore,
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnnotationList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should filter annotations to selected message urls', () => {
    const detail: RequestDetail = {
      request_id: '1',
      title: 'Test',
      query_text: 'Hello',
      status: 'completed',
      last_updated: new Date().toISOString(),
      messages: [
        {
          role: 'user',
          content: 'First',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant',
          content: 'See https://example.com and ignore others',
          timestamp: new Date().toISOString(),
          annotations: [
            { title: 'Example', url: 'https://example.com', snippet: 'Example site' },
            { title: 'Missing', url: 'https://missing.com', snippet: 'Should be filtered' },
          ],
        },
      ],
    };

    selectedStore.setDetail(detail);
    selectedStore.setSelectedMessageIndex(1);
    fixture.detectChanges();

    expect(component.annotations()).toEqual([
      { title: 'Example', url: 'https://example.com', snippet: 'Example site' },
    ]);
  });
});
