const time = () => new Date().toISOString();

const log = (level, message, meta) => {
  const base = `[${time()}] [${level.toUpperCase()}] ${message}`;
  if (meta) {
    console.log(base, meta);
  } else {
    console.log(base);
  }
};

module.exports = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta)
};

