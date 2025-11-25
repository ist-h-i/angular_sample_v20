import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { PrimaryButton } from '../../../../../shared/ui/primary-button/primary-button';
import { SecondaryButton } from '../../../../../shared/ui/secondary-button/secondary-button';
import { EnvironmentStore } from '../../../../../shared/core/stores/environment.store';
import { InitialDataStore } from '../../../../../shared/core/stores/initial-data.store';
import type { EnvironmentVariable } from '../../../../../shared/core/models/environment-variable.model';

const AI_MODEL_REGEX =
  /^AI_MODEL_(?<modelId>[A-Z0-9_]+)_(?<field>NAME|CALLS_PER_MINUTE|CALLS_PER_MONTH|REASONING_EFFORT)$/;

const AI_MODEL_FIELD_META = {
  NAME: {
    label: 'モデル名',
    helper: 'OpenAI のモデル名（例: gpt-4o-mini）',
    inputType: 'text',
  },
  CALLS_PER_MINUTE: {
    label: '分間コール上限',
    helper: '1 分あたりのリクエスト上限',
    inputType: 'number',
  },
  CALLS_PER_MONTH: {
    label: '月間コール上限',
    helper: '1 ヶ月あたりのリクエスト上限',
    inputType: 'number',
  },
  REASONING_EFFORT: {
    label: 'REASONING_EFFORT',
    helper: '推論の厳密さ（low/mid/high など）',
    inputType: 'text',
  },
} as const;

type AiModelField = keyof typeof AI_MODEL_FIELD_META;

const AI_MODEL_FIELD_ORDER: AiModelField[] = [
  'NAME',
  'CALLS_PER_MINUTE',
  'CALLS_PER_MONTH',
  'REASONING_EFFORT',
];

interface AiModelConfig {
  id: string;
  displayName: string;
  entries: EnvironmentVariable[];
  fieldEntries: Partial<Record<AiModelField, EnvironmentVariable>>;
}

interface NewModelDraft {
  uid: string;
  modelId: string;
  displayName: string;
  fields: Partial<Record<AiModelField, string>>;
}

interface GeneralEntryDraft {
  uid: string;
  key: string;
  value: string;
  description: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [PrimaryButton, SecondaryButton],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit {
  private readonly environmentStore = inject(EnvironmentStore);
  private readonly initialDataStore = inject(InitialDataStore);
  private readonly editing = signal(false);
  private readonly editBuffer = signal<Record<string, string>>({});
  private readonly removalKeys = signal<Set<string>>(new Set());
  private readonly modelDraftsSignal = signal<NewModelDraft[]>([]);
  private readonly generalDraftsSignal = signal<GeneralEntryDraft[]>([]);

  protected readonly entries = computed(() => this.environmentStore.entries());
  protected readonly aiModelFieldOrder = AI_MODEL_FIELD_ORDER;
  protected readonly aiModelFieldMeta = AI_MODEL_FIELD_META;
  protected readonly visibleEntries = computed(() => {
    const removed = this.removalKeys();
    return this.entries().filter((entry) => !removed.has(entry.key));
  });
  protected readonly aiModelConfigs = computed(() => {
    const models = new Map<string, AiModelConfig>();
    for (const entry of this.visibleEntries()) {
      const match = entry.key.match(AI_MODEL_REGEX);
      if (!match) continue;
      const modelId = match.groups?.['modelId'] ?? match[1];
      const field = (match.groups?.['field'] ?? match[2]) as AiModelField;
      const existing = models.get(modelId) ?? {
        id: modelId,
        displayName: modelId.replace(/_/g, ' '),
        entries: [],
        fieldEntries: {},
      };
      existing.entries.push(entry);
      existing.fieldEntries[field] = entry;
      models.set(modelId, existing);
    }
    return Array.from(models.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  });
  protected readonly aiModelNewDrafts = this.modelDraftsSignal.asReadonly();
  protected readonly generalDrafts = this.generalDraftsSignal.asReadonly();
  protected readonly aiModelEntryKeys = computed(() => {
    const keys = new Set<string>();
    for (const model of this.aiModelConfigs()) {
      for (const entry of model.entries) {
        keys.add(entry.key);
      }
    }
    return keys;
  });
  protected readonly generalEntries = computed(() => {
    const ignored = this.aiModelEntryKeys();
    return this.visibleEntries().filter((entry) => !ignored.has(entry.key));
  });
  protected readonly isLoading = computed(() => this.environmentStore.isLoading());
  protected readonly isSaving = computed(() => this.environmentStore.isSaving());
  protected readonly loadError = computed(() => this.environmentStore.error());
  protected readonly saveError = computed(() => this.environmentStore.saveError());
  protected readonly userLabel = computed(
    () => this.initialDataStore.initialData()?.user?.name_full ?? 'ゲストユーザー',
  );
  protected readonly hasChanges = computed(() => {
    if (!this.editing()) return false;
    if (this.removalKeys().size > 0) return true;
    if (this.hasModelDrafts()) return true;
    if (this.hasGeneralDrafts()) return true;
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
    this.removalKeys.set(new Set());
    this.modelDraftsSignal.set([]);
    this.generalDraftsSignal.set([]);
  }

  cancelEditing(): void {
    this.editBuffer.set({});
    this.editing.set(false);
    this.removalKeys.set(new Set());
    this.modelDraftsSignal.set([]);
    this.generalDraftsSignal.set([]);
  }

  getModelFieldEntry(model: AiModelConfig, field: AiModelField): EnvironmentVariable | undefined {
    return model.fieldEntries[field];
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

  addModelDraft(): void {
    const next = [...this.modelDraftsSignal()];
    next.push({ uid: this.createDraftUid('model'), modelId: '', displayName: '', fields: {} });
    this.modelDraftsSignal.set(next);
  }

  removeModelDraft(uid: string): void {
    const next = this.modelDraftsSignal().filter((draft) => draft.uid !== uid);
    this.modelDraftsSignal.set(next);
  }

  updateModelDraftMeta(uid: string, key: 'modelId' | 'displayName', value: string): void {
    const next = this.modelDraftsSignal().map((draft) =>
      draft.uid === uid ? { ...draft, [key]: value } : draft,
    );
    this.modelDraftsSignal.set(next);
  }

  updateModelDraftField(uid: string, field: AiModelField, value: string): void {
    const next = this.modelDraftsSignal().map((draft) => {
      if (draft.uid !== uid) return draft;
      return { ...draft, fields: { ...draft.fields, [field]: value } };
    });
    this.modelDraftsSignal.set(next);
  }

  addGeneralDraft(): void {
    const next = [...this.generalDraftsSignal()];
    next.push({ uid: this.createDraftUid('env'), key: '', value: '', description: '' });
    this.generalDraftsSignal.set(next);
  }

  updateGeneralDraft(uid: string, field: 'key' | 'value' | 'description', value: string): void {
    const next = this.generalDraftsSignal().map((draft) =>
      draft.uid === uid ? { ...draft, [field]: value } : draft,
    );
    this.generalDraftsSignal.set(next);
  }

  removeGeneralDraft(uid: string): void {
    const next = this.generalDraftsSignal().filter((draft) => draft.uid !== uid);
    this.generalDraftsSignal.set(next);
  }

  markEntryForRemoval(key: string): void {
    const next = new Set(this.removalKeys());
    next.add(key);
    this.removalKeys.set(next);
  }

  markModelForRemoval(modelId: string): void {
    const next = new Set(this.removalKeys());
    for (const entry of this.entries()) {
      if (entry.key.startsWith(`AI_MODEL_${modelId}_`)) {
        next.add(entry.key);
      }
    }
    this.removalKeys.set(next);
  }

  formatValueForDisplay(value?: string, fallback = ''): string {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) return fallback;
    if (!this.numericPattern.test(trimmed)) return trimmed;
    const parts = trimmed.split('.');
    const formattedInt = Number(parts[0]).toLocaleString('en-US');
    const fraction = parts[1];
    return fraction ? `${formattedInt}.${fraction}` : formattedInt;
  }

  private readonly numericPattern = /^-?\d+(?:\.\d+)?$/;

  private createDraftUid(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private buildGeneralDrafts(): EnvironmentVariable[] {
    const now = new Date().toISOString();
    return this.generalDrafts()
      .filter((draft) => draft.key.trim() && draft.value.trim())
      .map((draft) => ({
        key: draft.key.trim(),
        value: draft.value.trim(),
        description: draft.description.trim() || '追加の環境変数',
        last_updated: now,
      }));
  }

  private buildModelDrafts(): EnvironmentVariable[] {
    const now = new Date().toISOString();
    const entries: EnvironmentVariable[] = [];
    for (const draft of this.aiModelNewDrafts()) {
      const rawId = draft.modelId.trim();
      if (!rawId) continue;
      const normalizedId = rawId.replace(/[^A-Z0-9]/gi, '_').toUpperCase();
      const displayName = (draft.displayName.trim() || normalizedId).trim();
      for (const field of AI_MODEL_FIELD_ORDER) {
        const value = draft.fields[field]?.trim();
        if (!value) continue;
        entries.push({
          key: `AI_MODEL_${normalizedId}_${field}`,
          value,
          description: `${displayName} ${this.aiModelFieldMeta[field].label}`,
          last_updated: now,
        });
      }
    }
    return entries;
  }

  private hasModelDrafts(): boolean {
    return this.aiModelNewDrafts().some(
      (draft) =>
        draft.modelId.trim() &&
        AI_MODEL_FIELD_ORDER.some((field) => (draft.fields[field] ?? '').trim()),
    );
  }

  private hasGeneralDrafts(): boolean {
    return this.generalDrafts().some(
      (draft) => draft.key.trim() && draft.value.trim(),
    );
  }

  async submitChanges(): Promise<void> {
    if (!this.hasChanges()) return;
    const additions = [...this.buildGeneralDrafts(), ...this.buildModelDrafts()];
    const payload = [
      ...this.entries()
        .filter((entry) => !this.removalKeys().has(entry.key))
        .map<EnvironmentVariable>((entry) => ({
          ...entry,
          value: this.editBuffer()[entry.key] ?? entry.value,
        })),
      ...additions,
    ];
    try {
      await this.environmentStore.persist(payload);
      this.editBuffer.set({});
      this.editing.set(false);
      this.removalKeys.set(new Set());
      this.modelDraftsSignal.set([]);
      this.generalDraftsSignal.set([]);
    } catch {
      // keep editing state so user can retry
    }
  }

  isEditing(): boolean {
    return this.editing();
  }
}
