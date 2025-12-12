import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AdminStore } from '../../../../../shared/core/stores/admin.store';
import type {
  AdminDefaultModel,
  AdminModel,
  AdminUserThread,
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

interface UsageRow {
  userId: string;
  statusCounts: Record<string, number>;
  total: number;
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
  protected readonly threads = this.adminStore.threads;
  protected readonly hasData = computed(
    () => !!this.users().length || !!this.models().length || !!this.defaultModels().length,
  );

  protected readonly userForm = signal<UserFormState>(this.blankUserForm());
  protected readonly modelForm = signal<ModelFormState>(this.blankModelForm());
  protected readonly defaultModelForm = signal<DefaultModelFormState>(this.blankDefaultModelForm());

  protected readonly usageMode = signal<'limit' | 'threshold' | 'search'>('limit');
  protected readonly topLimit = signal(20);
  protected readonly thresholdCount = signal(100);
  protected readonly userQuery = signal('');
  protected readonly histogramBinSize = signal(50);

  protected readonly statusKeys = computed(() => this.collectStatusKeys(this.threads()));
  protected readonly usageRows = computed<UsageRow[]>(() =>
    this.threads().map((thread) => this.toUsageRow(thread)),
  );
  protected readonly statusTotals = computed(() => this.sumStatusTotals(this.usageRows()));
  protected readonly totalRequests = computed(() =>
    Object.values(this.statusTotals()).reduce((sum, value) => sum + value, 0),
  );
  protected readonly sortedUsageRows = computed(() =>
    [...this.usageRows()].sort((a, b) => b.total - a.total || a.userId.localeCompare(b.userId)),
  );
  protected readonly filteredUsageRows = computed(() =>
    this.filterUsageRows(this.sortedUsageRows(), this.usageMode(), {
      limit: this.topLimit(),
      threshold: this.thresholdCount(),
      query: this.userQuery(),
    }),
  );
  protected readonly filteredUsageSummary = computed(() => {
    const rows = this.filteredUsageRows();
    return {
      count: rows.length,
      total: rows.reduce((sum, row) => sum + row.total, 0),
    };
  });
  protected readonly histogramBuckets = computed(() =>
    this.buildHistogramBuckets(this.usageRows(), Math.max(1, Math.floor(this.histogramBinSize()))),
  );
  protected readonly maxHistogramCount = computed(() =>
    this.histogramBuckets().reduce((max, bucket) => Math.max(max, bucket.count), 0),
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

  protected async handleUsageCsvDownload(): Promise<void> {
    const blob = await this.adminStore.downloadUsageCsv();
    if (blob) {
      this.saveBlob(blob, 'admin-usage.csv');
    }
  }

  protected setUsageMode(mode: 'limit' | 'threshold' | 'search'): void {
    this.usageMode.set(mode);
  }

  protected updateTopLimit(value: string | number): void {
    this.topLimit.set(this.ensurePositiveInteger(value, 1));
  }

  protected updateThresholdCount(value: string | number): void {
    this.thresholdCount.set(this.ensurePositiveInteger(value, 0));
  }

  protected updateUserQuery(value: string): void {
    this.userQuery.set(value);
  }

  protected updateHistogramBinSize(value: string | number): void {
    this.histogramBinSize.set(this.ensurePositiveInteger(value, 1));
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

  private toUsageRow(thread: AdminUserThread): UsageRow {
    return {
      userId: thread.userId,
      statusCounts: thread.statusCounts,
      total: this.sumCounts(thread.statusCounts),
    };
  }

  private collectStatusKeys(threads: AdminUserThread[]): string[] {
    const keys = new Set<string>();
    for (const thread of threads) {
      Object.keys(thread.statusCounts).forEach((key) => keys.add(key));
    }
    return Array.from(keys).sort();
  }

  private sumCounts(counts: Record<string, number>): number {
    return Object.values(counts).reduce((sum, value) => sum + (value ?? 0), 0);
  }

  private sumStatusTotals(rows: UsageRow[]): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const row of rows) {
      for (const [status, count] of Object.entries(row.statusCounts)) {
        totals[status] = (totals[status] ?? 0) + (count ?? 0);
      }
    }
    return totals;
  }

  private filterUsageRows(
    rows: UsageRow[],
    mode: 'limit' | 'threshold' | 'search',
    criteria: { limit: number; threshold: number; query: string },
  ): UsageRow[] {
    if (!rows.length) return [];
    if (mode === 'limit') {
      const limit = Math.max(1, Math.floor(criteria.limit ?? 0));
      return rows.slice(0, limit);
    }
    if (mode === 'threshold') {
      const threshold = Math.max(0, Math.floor(criteria.threshold ?? 0));
      return rows.filter((row) => row.total >= threshold);
    }
    const normalizedQuery = (criteria.query ?? '').trim().toLowerCase();
    if (!normalizedQuery) return rows;
    return rows.filter((row) => row.userId.toLowerCase().includes(normalizedQuery));
  }

  private buildHistogramBuckets(rows: UsageRow[], binSize: number):
    | { label: string; count: number; start: number; end: number }[]
    | [] {
    if (!rows.length) return [];
    const totals = rows.map((row) => row.total);
    const maxTotal = Math.max(...totals);
    if (maxTotal < 0) return [];

    const buckets: { label: string; count: number; start: number; end: number }[] = [];
    for (let start = 0; start <= maxTotal; start += binSize) {
      const end = start + binSize - 1;
      const count = totals.filter((total) => total >= start && total <= end).length;
      buckets.push({
        label: `${start}〜${end}`,
        count,
        start,
        end,
      });
    }
    return buckets;
  }

  private ensurePositiveInteger(value: string | number, fallback: number): number {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
    if (parsed === 0) return 0;
    return fallback;
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
