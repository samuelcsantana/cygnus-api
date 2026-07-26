export interface HealthChecker {
  checkDatabase(): Promise<boolean>;
}
