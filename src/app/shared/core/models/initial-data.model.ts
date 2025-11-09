import type { User } from './user.model';
import type { RequestHistory } from './request-history.model';

export interface InitialData {
  user: User;
  request_histories: RequestHistory[];
}

