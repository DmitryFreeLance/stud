const dotenv = require('dotenv');

function loadEnv() {
  dotenv.config();
}

loadEnv();

function readBoolean(value, defaultValue = false) {
  if (value === undefined) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function readNumber(value, defaultValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function readAdminIds(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item))
    .filter(Number.isInteger);
}

module.exports = {
  loadEnv,
  env: {
    botToken: process.env.BOT_TOKEN,
    port: readNumber(process.env.PORT, 3000),
    db: {
      host: process.env.DB_HOST || 'localhost',
      port: readNumber(process.env.DB_PORT, 5432),
      name: process.env.DB_NAME || 'oktabot',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: readBoolean(process.env.DB_SSL, false)
    },
    adminTelegramIds: readAdminIds(process.env.ADMIN_TELEGRAM_IDS),
    faqSearchLimit: readNumber(process.env.FAQ_SEARCH_LIMIT, 5),
    actionDelayMs: readNumber(process.env.ACTION_DELAY_MS, 700)
  }
};
