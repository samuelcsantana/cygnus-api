export interface HealthReport {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
  database: 'up';
}
