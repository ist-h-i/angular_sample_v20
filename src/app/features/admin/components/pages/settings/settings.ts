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

interface UserThreadRow {
  userId: string;
  statuses: Record<string, number>;
  total: number;
}

type UsageFilterMode = 'topCount' | 'threshold' | 'userSearch';

interface UsageFilterState {
  mode: UsageFilterMode;
  topCount: number;
  minRequests: number;
  userQuery: string;
  binSize: number;
}

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
  protected readonly threadStats = this.adminStore.threadStats;
  protected readonly hasData = computed(
    () => !!this.users().length || !!this.models().length || !!this.defaultModels().length,
  );

  protected readonly userForm = signal<UserFormState>(this.blankUserForm());
  protected readonly modelForm = signal<ModelFormState>(this.blankModelForm());
  protected readonly defaultModelForm = signal<DefaultModelFormState>(this.blankDefaultModelForm());
  protected readonly usageFilters = signal<UsageFilterState>({
    mode: 'topCount',
    topCount: 10,
    minRequests: 50,
    userQuery: '',
    binSize: 10,
  });

  private readonly userThreadTotals = computed<UserThreadRow[]>(() =>
    this.threadStats().map((entry) => ({
      userId: entry.userId,
      statuses: { ...entry.statuses },
      total: this.sumStatuses(entry.statuses),
    })),
  );

  protected readonly statusTotals = computed(() => {
    const totals: Record<string, number> = {};
    let overall = 0;
    for (const entry of this.userThreadTotals()) {
      for (const [status, count] of Object.entries(entry.statuses)) {
        const safe = this.toSafeNumber(count);
        totals[status] = (totals[status] ?? 0) + safe;
        overall += safe;
      }
    }
    return { totals, overall };
  });

  protected readonly statusKeys = computed(() => {
    const totals = this.statusTotals().totals;
    const keys = Object.keys(totals);
    return keys.sort((a, b) => {
      const diff = (totals[b] ?? 0) - (totals[a] ?? 0);
      return diff !== 0 ? diff : a.localeCompare(b);
    });
  });

  protected readonly filteredUsageRows = computed(() => {
    const filters = this.usageFilters();
    const rows = [...this.userThreadTotals()].sort((a, b) => b.total - a.total);
    if (filters.mode === 'topCount') {
      const limit = this.normalizeNumber(filters.topCount, 1);
      return rows.slice(0, limit);
    }
    if (filters.mode === 'threshold') {
      const min = this.normalizeNumber(filters.minRequests, 0);
      return rows.filter((row) => row.total >= min);
    }
    const query = filters.userQuery.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => row.userId.toLowerCase().includes(query));
  });

  protected readonly filteredUsageSummary = computed(() => {
    const rows = this.filteredUsageRows();
    return {
      userCount: rows.length,
      totalRequests: rows.reduce((sum, row) => sum + row.total, 0),
    };
  });

  protected readonly histogramBuckets = computed(() => {
    const binSize = this.normalizeNumber(this.usageFilters().binSize, 1);
    const bucketCounts: Record<number, number> = {};
    for (const entry of this.userThreadTotals()) {
      const bucket = Math.floor(entry.total / binSize) * binSize;
      bucketCounts[bucket] = (bucketCounts[bucket] ?? 0) + 1;
    }
    const sorted = Object.keys(bucketCounts)
      .map((key) => Number(key))
      .sort((a, b) => a - b);
    return sorted.map((start) => ({
      start,
      end: start + binSize - 1,
      count: bucketCounts[start],
    }));
  });

  protected readonly histogramMaxCount = computed(() =>
    Math.max(0, ...this.histogramBuckets().map((bucket) => bucket.count)),
  );

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

  protected handleUsageCsvDownload(): void {
    if (!this.threadStats().length) return;
    const rows = this.userThreadTotals();
    const headers = ['userId', 'total', ...this.statusKeys()];
    const lines = rows.map((row) =>
      [row.userId, row.total, ...this.statusKeys().map((key) => row.statuses[key] ?? 0)].join(
        ',',
      ),
    );
    const csv = [headers.join(','), ...lines].join('\n');
    this.saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'admin-usage.csv');
  }

  protected setUsageMode(mode: UsageFilterMode): void {
    this.usageFilters.update((prev) => ({ ...prev, mode }));
  }

  protected updateUsageFilter<K extends keyof UsageFilterState>(
    key: K,
    value: UsageFilterState[K],
  ): void {
    this.usageFilters.update((prev) => {
      if (key === 'topCount' || key === 'minRequests' || key === 'binSize') {
        return {
          ...prev,
          [key]: this.normalizeNumber(value as number, key === 'binSize' ? 1 : 0),
        } as UsageFilterState;
      }
      return { ...prev, [key]: value } as UsageFilterState;
    });
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

  protected formatNumber(value: number): string {
    return Number(value).toLocaleString();
  }

  private sumStatuses(statuses: Record<string, number> | undefined): number {
    return Object.values(statuses ?? {}).reduce((sum, value) => sum + this.toSafeNumber(value), 0);
  }

  private toSafeNumber(value: number): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  private normalizeNumber(value: number | string, min: number): number {
    const num = Math.floor(Number(value));
    if (!Number.isFinite(num)) return Math.max(0, min);
    return num < min ? min : num;
  }
}
