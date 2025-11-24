import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { PrimaryButton } from '../../../../../shared/ui/primary-button/primary-button';
import { SecondaryButton } from '../../../../../shared/ui/secondary-button/secondary-button';
import { EnvironmentStore } from '../../../../../shared/core/stores/environment.store';
import { InitialDataStore } from '../../../../../shared/core/stores/initial-data.store';
import type { EnvironmentVariable } from '../../../../../shared/core/models/environment-variable.model';

@Component({
  selector: 'app-settings',
  imports: [PrimaryButton, SecondaryButton],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit {
  private readonly environmentStore = inject(EnvironmentStore);
  private readonly initialDataStore = inject(InitialDataStore);
  private readonly editing = signal(false);
  private readonly editBuffer = signal<Record<string, string>>({});

  protected readonly entries = computed(() => this.environmentStore.entries());
  protected readonly isLoading = computed(() => this.environmentStore.isLoading());
  protected readonly isSaving = computed(() => this.environmentStore.isSaving());
  protected readonly loadError = computed(() => this.environmentStore.error());
  protected readonly saveError = computed(() => this.environmentStore.saveError());
  protected readonly userLabel = computed(
    () => this.initialDataStore.initialData()?.user?.name_full ?? 'ゲスト',
  );
  protected readonly hasChanges = computed(() => {
    if (!this.editing()) return false;
    const buffer = this.editBuffer();
    return this.entries().some(
      (entry) => (buffer[entry.key] ?? entry.value) !== entry.value,
    );
  });

  ngOnInit(): void {
    void this.environmentStore.load();
  }

  startEditing(): void {
    const buffer: Record<string, string> = {};
    for (const entry of this.entries()) {
      buffer[entry.key] = entry.value;
    }
    this.editBuffer.set(buffer);
    this.editing.set(true);
  }

  cancelEditing(): void {
    this.editBuffer.set({});
    this.editing.set(false);
  }

  getEditValue(entry: EnvironmentVariable): string {
    return this.editBuffer()[entry.key] ?? entry.value;
  }

  handleInput(entry: EnvironmentVariable, event: Event): void {
    const target = event.target as HTMLTextAreaElement | HTMLInputElement | null;
    if (!target) return;
    const updated = { ...this.editBuffer() };
    updated[entry.key] = target.value;
    this.editBuffer.set(updated);
  }

  async submitChanges(): Promise<void> {
    if (!this.hasChanges()) return;
    const payload = this.entries().map<EnvironmentVariable>((entry) => ({
      ...entry,
      value: this.editBuffer()[entry.key] ?? entry.value,
    }));
    try {
      await this.environmentStore.persist(payload);
      this.editBuffer.set({});
      this.editing.set(false);
    } catch {
      // keep editing state so user can retry
    }
  }

  isEditing(): boolean {
    return this.editing();
  }
}
