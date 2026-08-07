import { tokenService } from './token-service.instance';
import { tokenRevocationService } from './token-revocation-service.instance';

/** Best-effort revocation used on logout/account deletion — a missing or already-invalid token is a no-op. */
export async function revokeRefreshTokenIfPresent(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) {
    return;
  }

  try {
    const payload = tokenService.verifyRefreshToken(refreshToken);
    const remainingTtlSeconds = payload.exp - Math.floor(Date.now() / 1000);

    if (remainingTtlSeconds > 0) {
      await tokenRevocationService.revoke(payload.jti, remainingTtlSeconds);
    }
  } catch {
    // Already invalid/expired — nothing to revoke.
  }
}
