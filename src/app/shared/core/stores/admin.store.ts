import { Injectable, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  AdminDefaultModel,
  AdminDefaultModelPayload,
  AdminInitialResponse,
  AdminModel,
  AdminModelPayload,
  AdminUserPayload,
  AdminUserRecord,
} from '../models/admin.model';
import { ApiService } from '../services/api.service';

@Injectable({ providedIn: 'root' })
export class AdminStore {
  private readonly _data = signal<AdminInitialResponse | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _isMutating = signal(false);
  private readonly _error = signal<unknown | null>(null);
  private readonly _actionMessage = signal<string | null>(null);

  readonly data = this._data.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isMutating = this._isMutating.asReadonly();
  readonly error = this._error.asReadonly();
  readonly actionMessage = this._actionMessage.asReadonly();

  readonly users = computed(() => this._data()?.users ?? []);
  readonly models = computed(() => this._data()?.models ?? []);
  readonly defaultModels = computed(() => this._data()?.defaultModels ?? []);
  readonly threads = computed(() => this._data()?.threads ?? []);

  constructor(private readonly api: ApiService) {}

  async load(): Promise<void> {
    if (this._isLoading()) return;
    this._isLoading.set(true);
    try {
      const payload = await firstValueFrom(this.api.getAdminInitialData());
      this._data.set(payload ?? { users: [], models: [], defaultModels: [], threads: [] });
      this._error.set(null);
      this._actionMessage.set(null);
    } catch (err) {
      this._error.set(err);
    } finally {
      this._isLoading.set(false);
    }
  }

  async addOrUpdateUser(payload: AdminUserPayload): Promise<AdminUserRecord | undefined> {
    return this.mutate(async () => {
      const exists = this.findUser(payload.userId);
      const record = await firstValueFrom(
        exists ? this.api.updateAdminUser(payload) : this.api.addAdminUser(payload),
      );
      this.updateData((data) => ({
        ...data,
        users: this.upsertBy(data.users, record, (entry) => entry.userId === record.userId),
      }));
      this._actionMessage.set('ユーザーを追加/更新しました');
      return record;
    });
  }

  async uploadUsersCsv(file: File): Promise<AdminUserRecord[] | undefined> {
    return this.mutate(async () => {
      const users = await firstValueFrom(this.api.uploadAdminUsersCsv(file));
      this.updateData((data) => ({ ...data, users }));
      this._actionMessage.set('CSV の取り込みが完了しました');
      return users;
    });
  }

  async addModel(payload: AdminModelPayload): Promise<AdminModel | undefined> {
    return this.mutate(async () => {
      const model = await firstValueFrom(this.api.addAdminModel(payload));
      this.updateData((data) => ({
        ...data,
        models: this.upsertBy(data.models, model, (entry) => entry.id === model.id),
      }));
      this._actionMessage.set('モデルを追加しました');
      return model;
    });
  }

  async updateModel(id: string, payload: AdminModelPayload): Promise<AdminModel | undefined> {
    return this.mutate(async () => {
      const model = await firstValueFrom(this.api.updateAdminModel(id, payload));
      this.updateData((data) => ({
        ...data,
        models: this.upsertBy(data.models, model, (entry) => entry.id === model.id),
      }));
      this._actionMessage.set('モデルを更新しました');
      return model;
    });
  }

  async deleteModel(id: string): Promise<void> {
    await this.mutate(async () => {
      await firstValueFrom(this.api.deleteAdminModel(id));
      this.updateData((data) => ({
        ...data,
        models: data.models.filter((entry) => entry.id !== id),
      }));
      this._actionMessage.set('モデルを削除しました');
    });
  }

  async addDefaultModel(
    payload: AdminDefaultModelPayload,
  ): Promise<AdminDefaultModel | undefined> {
    return this.mutate(async () => {
      const model = await firstValueFrom(this.api.addDefaultModel(payload));
      this.updateData((data) => ({
        ...data,
        defaultModels: this.upsertBy(data.defaultModels, model, (entry) => entry.id === model.id),
      }));
      this._actionMessage.set('デフォルトモデルを追加しました');
      return model;
    });
  }

  async updateDefaultModel(
    id: string,
    payload: AdminDefaultModelPayload,
  ): Promise<AdminDefaultModel | undefined> {
    return this.mutate(async () => {
      const model = await firstValueFrom(this.api.updateDefaultModel(id, payload));
      this.updateData((data) => ({
        ...data,
        defaultModels: this.upsertBy(
          data.defaultModels,
          model,
          (entry) => entry.id === model.id,
        ),
      }));
      this._actionMessage.set('デフォルトモデルを更新しました');
      return model;
    });
  }

  async deleteDefaultModel(id: string): Promise<void> {
    await this.mutate(async () => {
      await firstValueFrom(this.api.deleteDefaultModel(id));
      this.updateData((data) => ({
        ...data,
        defaultModels: data.defaultModels.filter(
          (entry) => entry.id !== id && entry.swarmGroup !== id,
        ),
      }));
      this._actionMessage.set('デフォルトモデルを削除しました');
    });
  }

  async downloadUsersCsv(): Promise<Blob | undefined> {
    try {
      return await firstValueFrom(this.api.downloadAdminUsersCsv());
    } catch (err) {
      this._error.set(err);
      return undefined;
    }
  }

  async downloadUsageCsv(): Promise<Blob | undefined> {
    try {
      return await firstValueFrom(this.api.downloadAdminUsageCsv());
    } catch (err) {
      this._error.set(err);
      return undefined;
    }
  }

  async downloadEvents(): Promise<Blob | undefined> {
    try {
      return await firstValueFrom(this.api.getAdminEventsArchive());
    } catch (err) {
      this._error.set(err);
      return undefined;
    }
  }

  async refresh(): Promise<void> {
    await this.load();
  }

  private findUser(userId: string): AdminUserRecord | undefined {
    return this._data()?.users.find((user) => user.userId === userId);
  }

  private updateData(updater: (data: AdminInitialResponse) => AdminInitialResponse): void {
    const base = this._data() ?? { users: [], models: [], defaultModels: [], threads: [] };
    this._data.set(updater(base));
  }

  private async mutate<T>(operation: () => Promise<T>): Promise<T | undefined> {
    if (this._isMutating()) return undefined;
    this._isMutating.set(true);
    try {
      const result = await operation();
      this._error.set(null);
      return result;
    } catch (err) {
      this._error.set(err);
      throw err;
    } finally {
      this._isMutating.set(false);
    }
  }

  private upsertBy<T>(list: T[], item: T, matcher: (entry: T) => boolean): T[] {
    const idx = list.findIndex(matcher);
    if (idx >= 0) {
      const next = [...list];
      next[idx] = item;
      return next;
    }
    return [...list, item];
  }
}
