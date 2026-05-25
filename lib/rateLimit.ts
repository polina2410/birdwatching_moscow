import { redis } from './redis';

const WINDOW = 60;
const MAX_REQUESTS = 2;

export async function checkRateLimit(key: string): Promise<{
  allowed: boolean;
  retryAfterSeconds: number;
}> {
  const redisKey = `rate_limit:${key}`;

  const pipeline = redis.pipeline();
  pipeline.incr(redisKey);
  pipeline.expire(redisKey, WINDOW);
  const [current] = await pipeline.exec<[number, number]>();

  if (current > MAX_REQUESTS) {
    const ttl = await redis.ttl(redisKey);
    return {
      allowed: false,
      retryAfterSeconds: ttl > 0 ? ttl : WINDOW,
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}
