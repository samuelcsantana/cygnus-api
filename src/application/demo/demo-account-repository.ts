import { DemoDataset } from './demo-dataset';

export interface DemoAccountRepository {
  /** Writes the account and everything it holds, all or nothing. */
  create(dataset: DemoDataset): Promise<void>;
  /** Deletes every demo account whose expiry is at or before `now`, with its data; returns how many. */
  deleteExpired(now: Date): Promise<number>;
}
