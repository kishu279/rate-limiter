/**
 * Lightweight structured logger.
 *
 * Provides prefixed, level-based logging so each module can tag its output
 * (e.g. `[items]`, `[cart]`, `[orders]`) for quick filtering in the console.
 *
 * Usage:
 *   const log = createLogger('items');
 *   log.info('fetching all items');
 *   log.warn('cache miss for key', key);
 *   log.error('failed to fetch items', err);
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Current minimum log level — reads from ENV or defaults to 'info'. */
const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? "info";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function timestamp(): string {
  return new Date().toISOString();
}

export interface Logger {
  debug: (msg: string, ...args: unknown[]) => void;
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
}

/**
 * Create a logger namespaced to a given module.
 *
 * @param module - Short name used as the log prefix (e.g. `'items'`, `'cart'`).
 */
export function createLogger(module: string): Logger {
  const prefix = `[${module}]`;

  function log(level: LogLevel, msg: string, args: unknown[]): void {
    if (!shouldLog(level)) return;

    const ts = timestamp();
    const fn =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;

    if (args.length > 0) {
      fn(`${ts} ${prefix} [${level.toUpperCase()}] ${msg}`, ...args);
    } else {
      fn(`${ts} ${prefix} [${level.toUpperCase()}] ${msg}`);
    }
  }

  return {
    debug(msg: string, ...args: unknown[]) {
      log("debug", msg, args);
    },
    info(msg: string, ...args: unknown[]) {
      log("info", msg, args);
    },
    warn(msg: string, ...args: unknown[]) {
      log("warn", msg, args);
    },
    error(msg: string, ...args: unknown[]) {
      log("error", msg, args);
    },
  };
}
