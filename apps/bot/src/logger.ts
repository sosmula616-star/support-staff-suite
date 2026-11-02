const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

const write = (level: string, scope: string, args: unknown[]) => {
  console.log(`[${stamp()}] ${level.padEnd(5)} (${scope})`, ...args);
};

export const createLogger = (scope: string) => ({
  info: (...args: unknown[]) => write('INFO', scope, args),
  warn: (...args: unknown[]) => write('WARN', scope, args),
  error: (...args: unknown[]) => write('ERROR', scope, args),
  debug: (...args: unknown[]) => {
    if (process.env.DEBUG) write('DEBUG', scope, args);
  },
});

export const logger = createLogger('core');
