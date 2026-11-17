import { timingSafeEqual } from 'crypto';

export function cronKeyMatches(
  provided: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!provided || !expected) return false;

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Prefer the `x-cron-key` header. The `?key=` query param is kept only for
 * backwards compatibility with existing crontab entries, because query strings
 * end up in access logs.
 */
export function getCronKey(request: Request): string | null {
  const headerKey = request.headers.get('x-cron-key');
  if (headerKey) return headerKey;
  return new URL(request.url).searchParams.get('key');
}
