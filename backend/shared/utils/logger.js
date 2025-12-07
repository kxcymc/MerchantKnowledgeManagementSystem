// Set UTF-8 encoding for Windows compatibility
if (process.platform === 'win32') {
  try {
    if (process.stdout.setDefaultEncoding) {
      process.stdout.setDefaultEncoding('utf8');
    }
    if (process.stderr.setDefaultEncoding) {
      process.stderr.setDefaultEncoding('utf8');
    }
    // Try to set console code page to UTF-8
    const { execSync } = require('child_process');
    execSync('chcp 65001 >nul 2>&1', { stdio: 'ignore' });
  } catch (e) {
    // Ignore errors, continue execution
  }
}

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

