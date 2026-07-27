import { env } from '../../shared/config/env';
import { JwtTokenService } from './jwt-token.service';

export const tokenService = new JwtTokenService(
  env.JWT_ACCESS_SECRET,
  env.JWT_REFRESH_SECRET,
  env.JWT_ACCESS_EXPIRES_IN,
  env.JWT_REFRESH_EXPIRES_IN,
);
