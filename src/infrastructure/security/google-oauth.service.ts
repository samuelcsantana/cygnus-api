import { createHash, randomBytes } from 'node:crypto';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { GoogleIdentity, GoogleSignInError } from '../../application/user/google-identity';
import { env } from '../../shared/config/env';
import { redis } from '../cache/redis-client';

const transactionSchema = z.object({ nonce: z.string(), verifier: z.string() });
const claimsSchema = z.object({
  sub: z.string().min(1).max(255), email: z.string().email(), email_verified: z.literal(true),
  nonce: z.string(), name: z.string().max(200).optional(), hd: z.string().min(1).optional(),
});
const random = () => randomBytes(32).toString('base64url');
const key = (state: string, browser: string) => `google-oauth:${createHash('sha256').update(`${state}:${browser}`).digest('hex')}`;

export class GoogleOAuthService {
  get enabled(): boolean { return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI); }

  private client() {
    return new OAuth2Client({
      clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI,
      transporterOptions: { timeout: 10_000, retry: false },
    });
  }

  async start(browser: string): Promise<string> {
    const state = random(), nonce = random(), verifier = random();
    await redis.set(key(state, browser), JSON.stringify({ nonce, verifier }), 'EX', 600);
    return this.client().generateAuthUrl({
      scope: ['openid', 'email', 'profile'], state, nonce, prompt: 'select_account',
      access_type: 'online', code_challenge_method: CodeChallengeMethod.S256,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    });
  }

  async complete(state: string, browser: string, code?: string): Promise<GoogleIdentity> {
    // Atomic, one-time consumption, bound to an HttpOnly browser cookie. A
    // copied callback URL cannot log another browser into the attacker's account.
    const stored = await redis.getdel(key(state, browser));
    if (!stored || !code) throw new GoogleSignInError();
    const { nonce, verifier } = transactionSchema.parse(JSON.parse(stored));
    const client = this.client();
    const { tokens } = await client.getToken({ code, codeVerifier: verifier });
    if (!tokens.id_token) throw new GoogleSignInError();
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: env.GOOGLE_CLIENT_ID });
    // The library verifies signature, issuer, audience and expiry. Nonce binds
    // the signed identity to this particular authorization attempt.
    const claims = claimsSchema.parse(ticket.getPayload());
    if (claims.nonce !== nonce) throw new GoogleSignInError();
    return {
      subject: claims.sub, email: claims.email.toLowerCase(), name: claims.name ?? '',
      // email_verified alone does not prove current ownership of a third-party mailbox.
      authoritativeEmail: claims.email.toLowerCase().endsWith('@gmail.com') || Boolean(claims.hd),
    };
  }
}

export const googleOAuthService = new GoogleOAuthService();
