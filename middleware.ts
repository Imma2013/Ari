import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getSessionContext } from '@/lib/supabase/middleware';

const RATE_LIMITED_ROUTES = new Set([
  '/api/chat',
  '/api/search',
  '/api/suggestions',
  '/api/youtube',
  '/api/article/process',
  '/api/videos',
  '/api/images',
]);

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

const anonMinuteLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(15, '1 m'),
      prefix: 'rl:anon:minute',
    })
  : null;

const anonBurstLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '10 s'),
      prefix: 'rl:anon:burst',
    })
  : null;

const authMinuteLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      prefix: 'rl:auth:minute',
    })
  : null;

const authBurstLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '10 s'),
      prefix: 'rl:auth:burst',
    })
  : null;

const getClientIp = (request: NextRequest) => {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  return 'unknown';
};

const isRateLimitedRoute = (pathname: string) => RATE_LIMITED_ROUTES.has(pathname);

const applyResponseCookies = (
  source: NextResponse,
  target: NextResponse,
): NextResponse => {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  return target;
};

const rateLimitResponse = (
  baseResponse: NextResponse,
  retryAfterSeconds: number,
) => {
  const response = NextResponse.json(
    {
      message: 'Too many requests. Please try again later.',
    },
    { status: 429 },
  );
  response.headers.set('Retry-After', String(retryAfterSeconds));
  return applyResponseCookies(baseResponse, response);
};

export async function middleware(request: NextRequest) {
  const sessionContext = await getSessionContext(request);

  if (!isRateLimitedRoute(request.nextUrl.pathname) || !redis) {
    return sessionContext.response;
  }

  const userKey = sessionContext.userId
    ? `user:${sessionContext.userId}`
    : `ip:${getClientIp(request)}`;
  const blockedKey = `rl:blocked:${userKey}`;
  const violationsKey = `rl:violations:${userKey}`;

  try {
    const isBlocked = await redis.get<string>(blockedKey);
    if (isBlocked) {
      return rateLimitResponse(sessionContext.response, 900);
    }

    const [minuteResult, burstResult] = sessionContext.userId
      ? await Promise.all([
          authMinuteLimiter!.limit(userKey),
          authBurstLimiter!.limit(userKey),
        ])
      : await Promise.all([
          anonMinuteLimiter!.limit(userKey),
          anonBurstLimiter!.limit(userKey),
        ]);

    if (!minuteResult.success || !burstResult.success) {
      const violations = await redis.incr(violationsKey);
      if (violations === 1) {
        await redis.expire(violationsKey, 60 * 15);
      }

      if (violations >= 3) {
        await redis.set(blockedKey, '1', { ex: 60 * 15 });
        await redis.del(violationsKey);
      }

      const retryAfterMs = Math.max(
        minuteResult.reset - Date.now(),
        burstResult.reset - Date.now(),
      );
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      return rateLimitResponse(sessionContext.response, retryAfterSeconds);
    }

    return sessionContext.response;
  } catch (error) {
    console.error('Rate limiter middleware error:', error);
    return sessionContext.response;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

