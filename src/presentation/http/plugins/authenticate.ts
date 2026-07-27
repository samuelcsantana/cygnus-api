import { tokenService } from '../../../infrastructure/security/token-service.instance';
import { createAuthGuard } from './auth-guard';

export const authenticate = createAuthGuard(tokenService);
