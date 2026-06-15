/**
 * Logger utility with different log levels
 * Prevents console.log scattering and provides centralized logging control
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Set minimum log level (change in production)
const MIN_LOG_LEVEL: LogLevel = import.meta.env.PROD ? 'warn' : 'debug';

const logs: LogEntry[] = [];
const MAX_STORED_LOGS = 100;

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL];
}

function addLog(entry: LogEntry): void {
  logs.push(entry);
  if (logs.length > MAX_STORED_LOGS) {
    logs.shift(); // Remove oldest log
  }
}

export const logger = {
  debug(message: string, data?: unknown): void {
    if (!shouldLog('debug')) return;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'debug',
      message,
      data
    };
    addLog(entry);
    console.debug(`[DEBUG] ${message}`, data ?? '');
  },

  info(message: string, data?: unknown): void {
    if (!shouldLog('info')) return;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      data
    };
    addLog(entry);
    console.info(`[INFO] ${message}`, data ?? '');
  },

  warn(message: string, data?: unknown): void {
    if (!shouldLog('warn')) return;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      data
    };
    addLog(entry);
    console.warn(`[WARN] ${message}`, data ?? '');
  },

  error(message: string, error?: Error | unknown): void {
    if (!shouldLog('error')) return;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      data: error
    };
    addLog(entry);
    console.error(`[ERROR] ${message}`, error ?? '');
  },

  // Get recent logs for debugging
  getRecentLogs(count: number = 20): LogEntry[] {
    return logs.slice(-count);
  },

  // Clear stored logs
  clearLogs(): void {
    logs.length = 0;
  }
};

// Export log types for external use
export type { LogLevel, LogEntry };
