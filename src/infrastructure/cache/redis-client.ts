import Redis from 'ioredis';
import { env } from '../../shared/config/env';

// maxRetriesPerRequest: null is required by BullMQ workers sharing this connection.
export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
