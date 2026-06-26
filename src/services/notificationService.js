const { Op } = require('sequelize');
const { User } = require('../models');

function formatTaskStatus(payload) {
  const action = payload.status === 'approved' ? 'принято' : 'отклонено';
  const comment = payload.comment ? `\nКомментарий: ${payload.comment}` : '';
  return `Обновление по задаче\n\nЗадача: ${payload.taskTitle}\nСтатус: ${action}${comment}`;
}

function formatInactivity(payload) {
  const days = payload.daysInactive ? ` ${payload.daysInactive} дн.` : '';
  const hint = payload.hint ? `\nРекомендация: ${payload.hint}` : '';
  return `Напоминание об активности\n\nНа платформе зафиксирована неактивность${days}.${hint}`;
}

function formatCompetency(payload) {
  return `Компетенция завершена\n\nПоздравляем! Вы завершили компетенцию: ${payload.competencyTitle}`;
}

function formatSprint(payload) {
  const kind = payload.type ? `Тип события: ${payload.type}\n` : '';
  const sprint = payload.sprintTitle ? `Спринт: ${payload.sprintTitle}\n` : '';
  const body = payload.message ? `\n${payload.message}` : '';
  return `Уведомление о спринте\n\n${kind}${sprint}${body}`.trim();
}

function formatNewTask(payload) {
  const deadline = payload.deadline ? `\nСрок: ${payload.deadline}` : '';
  const sprint = payload.sprintTitle ? `\nСпринт: ${payload.sprintTitle}` : '';
  const description = payload.description ? `\nОписание: ${payload.description}` : '';
  return `Новая задача\n\nЗадача: ${payload.taskTitle}${deadline}${sprint}${description}`;
}

function formatBroadcast(payload) {
  const title = payload.title ? `${payload.title}\n\n` : '';
  return `${title}${payload.text}`;
}

async function resolveRecipients(payload, category) {
  if (Array.isArray(payload.telegramIds) && payload.telegramIds.length > 0) {
    return User.findAll({
      where: {
        telegramId: {
          [Op.in]: payload.telegramIds
        }
      }
    });
  }

  if (payload.telegramId) {
    return User.findAll({
      where: {
        telegramId: payload.telegramId
      }
    });
  }

  if (category === 'marketing') {
    return User.findAll({ where: { marketingOptIn: true } });
  }

  if (category === 'news') {
    return User.findAll({ where: { newsOptIn: true } });
  }

  return User.findAll({
    where: {
      [Op.or]: [{ marketingOptIn: true }, { newsOptIn: true }]
    }
  });
}

async function sendToUsers(bot, users, text) {
  const results = [];

  for (const user of users) {
    try {
      await bot.sendMessage(user.telegramId, text);
      results.push({ telegramId: user.telegramId, delivered: true });
    } catch (error) {
      results.push({ telegramId: user.telegramId, delivered: false, error: error.message });
    }
  }

  return results;
}

module.exports = {
  formatTaskStatus,
  formatInactivity,
  formatCompetency,
  formatSprint,
  formatNewTask,
  formatBroadcast,
  resolveRecipients,
  sendToUsers
};
