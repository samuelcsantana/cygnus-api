import { createHmac, randomInt } from 'node:crypto';
import type Redis from 'ioredis';
import {
  VerificationCodeCheck,
  VerificationCodePurpose,
  VerificationCodeService,
} from '../../application/user/verification-code-service';

const CODE_KEY_PREFIX = 'verification-code:';
const ATTEMPTS_KEY_PREFIX = 'verification-code-attempts:';
const REQUESTS_KEY_PREFIX = 'verification-code-requests:';

/** Ten minutes: long enough to switch to a mail app and back, short enough to shrink the window. */
const CODE_TTL_SECONDS = 10 * 60;

/**
 * A six-digit code is one of a million, so the attempt budget is the whole of its strength — the
 * per-IP rate limit on the route is not, because an attacker who wants a million guesses can
 * simply use more than one IP. Five wrong guesses burn the code and force a new one to be mailed.
 */
const MAX_ATTEMPTS = 5;

/**
 * Throttle on *asking for* a code, keyed by address rather than by caller: without it this endpoint
 * mails an arbitrary inbox on demand, which is someone else's inbox to fill and our Resend quota to
 * spend. Five in fifteen minutes leaves room for the frontend's 60-second resend button.
 */
const MAX_REQUESTS_PER_WINDOW = 5;
const REQUEST_WINDOW_SECONDS = 15 * 60;

/**
 * Domain-separation label for the code hash. The HMAC key below is *derived* from the JWT access
 * secret rather than being it: a derived key keeps this hash from ever being computed with the key
 * that signs tokens, while adding no new secret to provision, rotate, and forget to set in one of
 * the four places the deployment reads env from.
 */
const CODE_HASH_DOMAIN = 'cygnus:verification-code:v1';

/**
 * Check-and-consume in one round trip, because it is three operations that must not interleave:
 * count the attempt, enforce the budget, and destroy the code the moment it is spent. Done as
 * separate commands, two requests arriving together could both spend the same code, and a client
 * could keep guessing while the counter caught up.
 *
 * Returns the same vocabulary as VerificationCodeCheck so the caller has nothing to translate.
 */
const CONSUME_SCRIPT = `
local stored = redis.call('GET', KEYS[1])

if not stored then
  return 'not-found'
end

local attempts = redis.call('INCR', KEYS[2])

if attempts == 1 then
  -- Tie the counter's lifetime to the code's, so it cannot outlive it and poison the next code.
  local ttl = redis.call('PTTL', KEYS[1])
  if ttl > 0 then
    redis.call('PEXPIRE', KEYS[2], ttl)
  end
end

if attempts > tonumber(ARGV[2]) then
  redis.call('DEL', KEYS[1], KEYS[2])
  return 'too-many-attempts'
end

if stored == ARGV[1] then
  redis.call('DEL', KEYS[1], KEYS[2])
  return 'valid'
end

return 'invalid'
`;

/**
 * Redis rather than Postgres, on purpose. The lifetime is native (`SET ... EX`), the attempt budget
 * is an atomic `INCR`, and the data is disposable by definition — a table would mean writing a
 * cleanup job to do what the TTL does for free. The precedent is RedisTokenRevocationService.
 *
 * The trade-off is that Render's Key Value instance is not durable: a restart drops every code in
 * flight. That is acceptable here and only here — the user asks for another one. It is exactly why the
 * session version, which must survive a flush, lives in Postgres instead.
 */
export class RedisVerificationCodeService implements VerificationCodeService {
  private readonly hashKey: Buffer;

  constructor(
    private readonly redis: Redis,
    hashSecret: string,
  ) {
    this.hashKey = createHmac('sha256', hashSecret).update(CODE_HASH_DOMAIN).digest();
  }

  async issue(purpose: VerificationCodePurpose, email: string): Promise<string | null> {
    const normalizedEmail = email.trim().toLowerCase();

    if (!(await this.allowRequest(purpose, normalizedEmail))) {
      return null;
    }

    // randomInt is the CSPRNG, not Math.random: a predictable code is the same as no code.
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');

    await this.redis
      .multi()
      .set(this.codeKey(purpose, normalizedEmail), this.hash(purpose, normalizedEmail, code), 'EX', CODE_TTL_SECONDS)
      // Requesting a new code starts a fresh attempt budget — otherwise attempts spent against the
      // previous code would carry over and cut the new one short.
      .del(this.attemptsKey(purpose, normalizedEmail))
      .exec();

    return code;
  }

  async consume(purpose: VerificationCodePurpose, email: string, code: string): Promise<VerificationCodeCheck> {
    const normalizedEmail = email.trim().toLowerCase();

    const result = await this.redis.eval(
      CONSUME_SCRIPT,
      2,
      this.codeKey(purpose, normalizedEmail),
      this.attemptsKey(purpose, normalizedEmail),
      this.hash(purpose, normalizedEmail, code),
      MAX_ATTEMPTS,
    );

    return result as VerificationCodeCheck;
  }

  private async allowRequest(purpose: VerificationCodePurpose, email: string): Promise<boolean> {
    const key = `${REQUESTS_KEY_PREFIX}${purpose}:${email}`;
    const requests = await this.redis.incr(key);

    if (requests === 1) {
      await this.redis.expire(key, REQUEST_WINDOW_SECONDS);
    }

    return requests <= MAX_REQUESTS_PER_WINDOW;
  }

  /**
   * Stored as a keyed hash, never in the clear. Six digits is a space a plain SHA-256 dump would
   * fall to in milliseconds, so the point is the key: without it, holding a copy of Redis is not
   * enough to turn a stored code back into a login. The purpose and address are inside the hashed
   * message too, which binds a code to the exact flow and account it was issued for.
   */
  private hash(purpose: VerificationCodePurpose, email: string, code: string): string {
    return createHmac('sha256', this.hashKey).update(`${purpose}:${email}:${code}`).digest('hex');
  }

  private codeKey(purpose: VerificationCodePurpose, email: string): string {
    return `${CODE_KEY_PREFIX}${purpose}:${email}`;
  }

  private attemptsKey(purpose: VerificationCodePurpose, email: string): string {
    return `${ATTEMPTS_KEY_PREFIX}${purpose}:${email}`;
  }
}
