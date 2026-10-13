import { Injectable, Logger } from '@nestjs/common';

export interface IncidentLogger {
  error(message: string): void;
}

export const INCIDENT_LOGGER = Symbol('INCIDENT_LOGGER');

@Injectable()
export class NestIncidentLogger implements IncidentLogger {
  private readonly logger = new Logger(NestIncidentLogger.name);

  error(message: string): void {
    this.logger.error(message);
  }
}
