import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AdminStore } from '../../../../../shared/core/stores/admin.store';
import type {
  AdminDefaultModel,
  AdminModel,
  AdminUserRecord,
} from '../../../../../shared/core/models/admin.model';

interface UserFormState {
  userId: string;
  isActive: boolean;
  isAdmin: boolean;
  isSupport: boolean;
  isAc: boolean;
  allowedSpend: string;
  modelsInput: string;
}

interface ModelFormState {
  id?: string;
  name: string;
  modelId: string;
  endpoint: string;
  reasoningEffort: string;
  isVerify: boolean;
  timeoutSec: string;
}

interface DefaultModelFormState {
  id?: string;
  modelIdsInput: string;
  swarmGroup: string;
  orderNumber: string;
  allowedSpend: string;
}

interface UserUsageRow {
  userId: string;
  total: number;
  statuses: Record<string, number>;
}

interface HistogramBucket {
  range: string;
  count: number;
}

type TopUsersMode = 'topN' | 'threshold' | 'search';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit {
  private readonly adminStore = inject(AdminStore);

  protected readonly isLoading = this.adminStore.isLoading;
  protected readonly isMutating = this.adminStore.isMutating;
  protected readonly error = this.adminStore.error;
  protected readonly message = this.adminStore.actionMessage;
  protected readonly users = this.adminStore.users;
  protected readonly models = this.adminStore.models;
  protected readonly defaultModels = this.adminStore.defaultModels;
  protected readonly threads = this.adminStore.threads;
  protected readonly hasData = computed(
    () =>
      !!this.users().length ||
      !!this.models().length ||
      !!this.defaultModels().length ||
      !!this.threads().length,
  );

  protected readonly userForm = signal<UserFormState>(this.blankUserForm());
  protected readonly modelForm = signal<ModelFormState>(this.blankModelForm());
  protected readonly defaultModelForm = signal<DefaultModelFormState>(this.blankDefaultModelForm());
  protected readonly topUsersMode = signal<TopUsersMode>('topN');
  protected readonly topUsersLimit = signal(10);
  protected readonly topUsersThreshold = signal(100);
  protected readonly topUsersQuery = signal('');
  protected readonly histogramBinSize = signal(10);

  protected readonly statusKeys = computed(() => {
    const keys = new Set<string>();
    for (const entry of this.threads()) {
      Object.keys(entry).forEach((key) => {
        if (key !== 'userId') keys.add(key);
      });
    }
    return Array.from(keys).sort();
  });

  protected readonly userUsage = computed<UserUsageRow[]>(() => {
    const statuses = this.statusKeys();
    return this.threads().map((thread) => {
      const statusCounts = Object.fromEntries(
        statuses.map((status) => [status, this.toNumber(thread[status])]),
      );
      const total = Object.values(statusCounts).reduce((sum, value) => sum + value, 0);
      return { userId: thread.userId, statuses: statusCounts, total };
    });
  });

  protected readonly totalByStatus = computed(() => {
    const totals: Record<string, number> = Object.fromEntries(
      this.statusKeys().map((status) => [status, 0]),
    );
    for (const user of this.userUsage()) {
      for (const [status, value] of Object.entries(user.statuses)) {
        totals[status] = (totals[status] ?? 0) + value;
      }
    }
    return totals;
  });

  protected readonly totalRequestCount = computed(() =>
    Object.values(this.totalByStatus()).reduce((sum, value) => sum + value, 0),
  );

  protected readonly topUsersView = computed(() => {
    const mode = this.topUsersMode();
    const sorted = [...this.userUsage()].sort(
      (a, b) => b.total - a.total || a.userId.localeCompare(b.userId),
    );

    let rows: UserUsageRow[] = sorted;
    if (!sorted.length) {
      return { rows: [], displayedTotal: 0 };
    }

    if (mode === 'topN') {
      const limit = Math.max(1, Math.floor(this.topUsersLimit()) || 0);
      rows = sorted.slice(0, limit);
    } else if (mode === 'threshold') {
      const threshold = Math.max(0, Math.floor(this.topUsersThreshold()) || 0);
      rows = sorted.filter((row) => row.total >= threshold);
    } else if (mode === 'search') {
      const query = this.topUsersQuery().trim();
      rows = query ? sorted.filter((row) => row.userId.includes(query)) : [];
    }

    const displayedTotal = rows.reduce((sum, row) => sum + row.total, 0);
    return { rows, displayedTotal };
  });

  protected readonly histogram = computed(() => {
    const binSize = Math.max(1, Math.floor(this.histogramBinSize()) || 0);
    const bucketsMap = new Map<number, number>();
    for (const entry of this.userUsage()) {
      const start = Math.floor(entry.total / binSize) * binSize;
      bucketsMap.set(start, (bucketsMap.get(start) ?? 0) + 1);
    }
    const buckets: HistogramBucket[] = [...bucketsMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([start, count]) => ({
        range: `${start} - ${start + binSize - 1}`,
        count,
      }));
    const maxCount = buckets.reduce((max, bucket) => Math.max(max, bucket.count), 0);
    return { binSize, buckets, maxCount };
  });

  ngOnInit(): void {
    void this.adminStore.load();
  }

  protected async refresh(): Promise<void> {
    await this.adminStore.refresh();
  }

  protected updateUserForm<K extends keyof UserFormState>(key: K, value: UserFormState[K]): void {
    this.userForm.update((prev) => ({ ...prev, [key]: value }));
  }

  protected updateModelForm<K extends keyof ModelFormState>(key: K, value: ModelFormState[K]): void {
    this.modelForm.update((prev) => ({ ...prev, [key]: value }));
  }

  protected updateDefaultModelForm<K extends keyof DefaultModelFormState>(
    key: K,
    value: DefaultModelFormState[K],
  ): void {
    this.defaultModelForm.update((prev) => ({ ...prev, [key]: value }));
  }

  protected async saveUser(): Promise<void> {
    const form = this.userForm();
    if (!form.userId.trim()) return;
    const payload = {
      userId: form.userId.trim(),
      isActive: form.isActive,
      isAdmin: form.isAdmin,
      isSupport: form.isSupport,
      isAc: form.isAc,
      allowedSpend: this.parseNumber(form.allowedSpend),
      models: this.parseIds(form.modelsInput),
    };
    try {
      await this.adminStore.addOrUpdateUser(payload);
      this.resetUserForm();
    } catch {
      // Error is surfaced via store signals.
    }
  }

  protected editUser(user: AdminUserRecord): void {
    this.userForm.set({
      userId: user.userId,
      isActive: user.active,
      isAdmin: user.admin,
      isSupport: user.support,
      isAc: Boolean(user.isAc),
      allowedSpend: (user.allowedSpend ?? '').toString(),
      modelsInput: user.models.join(', '),
    });
  }

  protected resetUserForm(): void {
    this.userForm.set(this.blankUserForm());
  }

  protected async handleUsersCsvDownload(): Promise<void> {
    const blob = await this.adminStore.downloadUsersCsv();
    if (blob) {
      this.saveBlob(blob, 'admin-users.csv');
    }
  }

  protected async handleUsageCsvDownload(): Promise<void> {
    const blob = await this.adminStore.downloadUsageCsv();
    if (blob) {
      this.saveBlob(blob, 'admin-usage.csv');
    }
  }

  protected async handleUsersCsvUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;
    try {
      await this.adminStore.uploadUsersCsv(file);
    } catch {
      // Error is surfaced via store signals.
    }
    if (input) input.value = '';
  }

  protected setTopUsersMode(mode: TopUsersMode): void {
    this.topUsersMode.set(mode);
  }

  protected updateTopUsersLimit(value: string): void {
    const parsed = this.parseNumber(value);
    this.topUsersLimit.set(parsed ?? this.topUsersLimit());
  }

  protected updateTopUsersThreshold(value: string): void {
    const parsed = this.parseNumber(value);
    this.topUsersThreshold.set(parsed ?? this.topUsersThreshold());
  }

  protected updateTopUsersQuery(value: string): void {
    this.topUsersQuery.set(value);
  }

  protected updateHistogramBinSize(value: string): void {
    const parsed = this.parseNumber(value);
    this.histogramBinSize.set(Math.max(1, Math.floor(parsed ?? this.histogramBinSize())));
  }

  protected async saveModel(): Promise<void> {
    const form = this.modelForm();
    if (!form.name.trim() || !form.modelId.trim() || !form.endpoint.trim()) return;
    const payload = {
      name: form.name.trim(),
      modelId: form.modelId.trim(),
      endpoint: form.endpoint.trim(),
      reasoningEffort: form.reasoningEffort.trim() || undefined,
      isVerify: form.isVerify,
      timeoutSec: this.parseNumber(form.timeoutSec),
    };
    try {
      if (form.id) {
        await this.adminStore.updateModel(form.id, payload);
      } else {
        await this.adminStore.addModel(payload);
      }
      this.resetModelForm();
    } catch {
      // Error is surfaced via store signals.
    }
  }

  protected editModel(model: AdminModel): void {
    this.modelForm.set({
      id: model.id,
      name: model.name,
      modelId: model.modelId,
      endpoint: model.endpoint,
      reasoningEffort: model.reasoningEffort ?? '',
      isVerify: Boolean(model.isVerify),
      timeoutSec: model.timeoutSec?.toString() ?? '',
    });
  }

  protected async deleteModel(id: string): Promise<void> {
    try {
      await this.adminStore.deleteModel(id);
      if (this.modelForm().id === id) {
        this.resetModelForm();
      }
    } catch {
      // Error is surfaced via store signals.
    }
  }

  protected resetModelForm(): void {
    this.modelForm.set(this.blankModelForm());
  }

  protected async saveDefaultModel(): Promise<void> {
    const form = this.defaultModelForm();
    if (!form.swarmGroup.trim()) return;
    const orderNumber = this.parseNumber(form.orderNumber);
    const payload = {
      modelIds: this.parseIds(form.modelIdsInput),
      swarmGroup: form.swarmGroup.trim(),
      orderNumber: orderNumber ?? 0,
      allowedSpend: this.parseNumber(form.allowedSpend),
    };
    try {
      if (form.id) {
        await this.adminStore.updateDefaultModel(form.id, payload);
      } else {
        await this.adminStore.addDefaultModel(payload);
      }
      this.resetDefaultModelForm();
    } catch {
      // Error is surfaced via store signals.
    }
  }

  protected editDefaultModel(model: AdminDefaultModel): void {
    this.defaultModelForm.set({
      id: model.id,
      modelIdsInput: model.modelIds.join(', '),
      swarmGroup: model.swarmGroup,
      orderNumber: model.orderNumber.toString(),
      allowedSpend: model.allowedSpend?.toString() ?? '',
    });
  }

  protected async deleteDefaultModel(id: string): Promise<void> {
    try {
      await this.adminStore.deleteDefaultModel(id);
      if (this.defaultModelForm().id === id) {
        this.resetDefaultModelForm();
      }
    } catch {
      // Error is surfaced via store signals.
    }
  }

  protected resetDefaultModelForm(): void {
    this.defaultModelForm.set(this.blankDefaultModelForm());
  }

  protected async downloadEvents(): Promise<void> {
    const blob = await this.adminStore.downloadEvents();
    if (blob) {
      this.saveBlob(blob, 'admin-events.zip');
    }
  }

  protected trackById<T extends { id?: string; userId?: string }>(
    _index: number,
    item: T,
  ): string {
    return (item as { id?: string }).id ?? (item as { userId?: string }).userId ?? `${_index}`;
  }

  isEditing(): boolean {
    return false;
  }

  private blankUserForm(): UserFormState {
    return {
      userId: '',
      isActive: true,
      isAdmin: false,
      isSupport: false,
      isAc: false,
      allowedSpend: '',
      modelsInput: '',
    };
  }

  private blankModelForm(): ModelFormState {
    return {
      id: undefined,
      name: '',
      modelId: '',
      endpoint: '',
      reasoningEffort: '',
      isVerify: true,
      timeoutSec: '',
    };
  }

  private blankDefaultModelForm(): DefaultModelFormState {
    return {
      id: undefined,
      modelIdsInput: '',
      swarmGroup: '',
      orderNumber: '',
      allowedSpend: '',
    };
  }

  private toNumber(value: unknown): number {
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  private parseNumber(value: string): number | undefined {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : undefined;
  }

  private parseIds(input: string): string[] {
    return input
      .split(/[,|]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  private saveBlob(blob: Blob, filename: string): void {
    if (typeof window === 'undefined') return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
