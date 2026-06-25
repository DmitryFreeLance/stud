const { User } = require('../models');
const { env } = require('../config/env');

async function findOrCreateUser(msg) {
  const telegramId = msg.from.id;
  const defaults = {
    username: msg.from.username || null,
    firstName: msg.from.first_name || 'Пользователь',
    lastName: msg.from.last_name || null,
    role: env.adminTelegramIds.includes(telegramId) ? 1 : 0
  };

  const [user] = await User.findOrCreate({
    where: { telegramId },
    defaults
  });

  let changed = false;

  for (const [key, value] of Object.entries(defaults)) {
    if (value !== undefined && user[key] !== value) {
      user[key] = value;
      changed = true;
    }
  }

  if (changed) {
    await user.save();
  }

  return user;
}

module.exports = {
  findOrCreateUser
};
