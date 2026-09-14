import { config } from '../config';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

export interface LogMetadata {
  [key: string]: unknown;
  userId?: string;
  requestId?: string;
  service?: string;
  duration?: number;
  error?: Error;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;

  private constructor() {
    this.logLevel = this.parseLogLevel(config.logging.level);
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private parseLogLevel(level: string): LogLevel {
    const normalizedLevel = level.toLowerCase();
    if (Object.values(LogLevel).includes(normalizedLevel as LogLevel)) {
      return normalizedLevel as LogLevel;
    }
    return LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, metadata?: LogMetadata): string {
    const timestamp = new Date().toISOString();
    const metaStr = metadata ? JSON.stringify(metadata) : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message} ${metaStr}`;
  }

  private colorize(level: LogLevel, message: string): string {
    const colors = {
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.WARN]: '\x1b[33m', // Yellow
      [LogLevel.INFO]: '\x1b[36m', // Cyan
      [LogLevel.DEBUG]: '\x1b[90m', // Gray
    };
    const reset = '\x1b[0m';
    return `${colors[level]}${message}${reset}`;
  }

  private log(level: LogLevel, message: string, metadata?: LogMetadata): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, metadata);
    const coloredMessage = this.colorize(level, formattedMessage);

    switch (level) {
      case LogLevel.ERROR:
        console.error(coloredMessage);
        break;
      case LogLevel.WARN:
        console.warn(coloredMessage);
        break;
      case LogLevel.INFO:
        console.info(coloredMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(coloredMessage);
        break;
    }

    // In production, you might want to send to external service
    if (config.app.env === 'production' && level === LogLevel.ERROR) {
      this.persistLog(level, message, metadata);
    }
  }

  private async persistLog(
    level: LogLevel,
    message: string,
    metadata?: LogMetadata
  ): Promise<void> {
    try {
      // This will be implemented when we add database logging
      // For now, just a placeholder
      const { prisma } = await import('../services/database.service');
      await prisma.systemLog.create({
        data: {
          level: level,
          message: message,
          service: metadata?.service || 'api',
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });
    } catch (error) {
      // Fail silently to avoid logging errors in logger
      console.error('Failed to persist log:', error);
    }
  }

  public error(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.ERROR, message, metadata);
  }

  public warn(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  public info(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  public debug(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  // HTTP request logging
  public http(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    metadata?: LogMetadata
  ): void {
    const message = `${method} ${url} ${statusCode} - ${duration}ms`;
    const level =
      statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    this.log(level, message, { ...metadata, duration });
  }

  // Database query logging
  public query(query: string, duration: number, metadata?: LogMetadata): void {
    this.debug(`Query executed in ${duration}ms`, { ...metadata, query });
  }

  // Transaction logging
  public transaction(type: string, amount: string, metadata?: LogMetadata): void {
    this.info(`Transaction: ${type} - ${amount}`, metadata);
  }

  // Security event logging
  public security(event: string, metadata?: LogMetadata): void {
    this.warn(`Security Event: ${event}`, metadata);
  }
}

// Export singleton instance
export const logger = Logger.getInstance();
