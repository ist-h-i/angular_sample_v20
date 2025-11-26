import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Chat } from './chat';

describe('Chat', () => {
  let component: Chat;
  let fixture: ComponentFixture<Chat>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Chat]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Chat);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit selected index for assistant messages', () => {
    const spy = jasmine.createSpy('onSelect');
    component.selectMessage.subscribe(spy);

    component.onMessageSelect(2, 'assistant');

    expect(spy).toHaveBeenCalledWith(2);
  });

  it('should clear selection for user messages', () => {
    const spy = jasmine.createSpy('onSelect');
    component.selectMessage.subscribe(spy);

    component.onMessageSelect(1, 'user');

    expect(spy).toHaveBeenCalledWith(null);
  });
});
