const { Op } = require('sequelize');
const { Ticket, TicketMessage, User } = require('../models');

function getTextPreview(message) {
  const text =
    message.text ||
    message.caption ||
    (message.document && message.document.file_name) ||
    (message.photo && 'Фото') ||
    (message.video && 'Видео') ||
    (message.voice && 'Голосовое сообщение') ||
    (message.audio && 'Аудио') ||
    (message.sticker && 'Стикер') ||
    'Вложение';

  return String(text).slice(0, 32);
}

function getMessagePayload(message) {
  if (message.text) {
    return {
      messageType: 'text',
      text: message.text,
      meta: {}
    };
  }

  if (message.photo) {
    const photo = message.photo[message.photo.length - 1];
    return {
      messageType: 'photo',
      text: message.caption || null,
      telegramFileId: photo.file_id,
      telegramFileUniqueId: photo.file_unique_id,
      meta: {}
    };
  }

  if (message.document) {
    return {
      messageType: 'document',
      text: message.caption || null,
      telegramFileId: message.document.file_id,
      telegramFileUniqueId: message.document.file_unique_id,
      meta: {
        fileName: message.document.file_name,
        mimeType: message.document.mime_type
      }
    };
  }

  if (message.video) {
    return {
      messageType: 'video',
      text: message.caption || null,
      telegramFileId: message.video.file_id,
      telegramFileUniqueId: message.video.file_unique_id,
      meta: {}
    };
  }

  if (message.voice) {
    return {
      messageType: 'voice',
      text: null,
      telegramFileId: message.voice.file_id,
      telegramFileUniqueId: message.voice.file_unique_id,
      meta: {}
    };
  }

  if (message.audio) {
    return {
      messageType: 'audio',
      text: message.caption || null,
      telegramFileId: message.audio.file_id,
      telegramFileUniqueId: message.audio.file_unique_id,
      meta: {
        performer: message.audio.performer,
        title: message.audio.title
      }
    };
  }

  if (message.sticker) {
    return {
      messageType: 'sticker',
      text: null,
      telegramFileId: message.sticker.file_id,
      telegramFileUniqueId: message.sticker.file_unique_id,
      meta: {}
    };
  }

  return {
    messageType: 'unsupported',
    text: 'Неподдерживаемый тип сообщения',
    meta: {}
  };
}

async function findOpenTicketForUser(userId) {
  return Ticket.findOne({
    where: {
      userId,
      status: 'open'
    },
    order: [['openedAt', 'DESC']]
  });
}

async function createOrAppendTicket(user, message) {
  let ticket = await findOpenTicketForUser(user.id);
  let created = false;

  if (!ticket) {
    ticket = await Ticket.create({
      userId: user.id,
      status: 'open',
      previewText: getTextPreview(message),
      openedAt: new Date()
    });
    created = true;
  }

  await TicketMessage.create({
    ticketId: ticket.id,
    senderRole: 'user',
    telegramMessageId: message.message_id || null,
    ...getMessagePayload(message)
  });

  if (!ticket.previewText || ticket.previewText === 'Вложение') {
    ticket.previewText = getTextPreview(message);
    await ticket.save();
  }

  return { ticket, created };
}

async function getOpenTickets() {
  return Ticket.findAll({
    where: { status: 'open' },
    include: [{ model: User, as: 'user' }],
    order: [['openedAt', 'DESC']]
  });
}

async function getTicketById(ticketId) {
  return Ticket.findByPk(ticketId, {
    include: [
      { model: User, as: 'user' },
      { model: TicketMessage, as: 'messages', separate: true, order: [['createdAt', 'ASC']] }
    ]
  });
}

async function closeTicket(ticketId) {
  const ticket = await Ticket.findByPk(ticketId);
  if (!ticket) {
    return null;
  }

  ticket.status = 'closed';
  ticket.closedAt = new Date();
  await ticket.save();
  return ticket;
}

async function saveAdminReply(ticketId, message) {
  return TicketMessage.create({
    ticketId,
    senderRole: 'admin',
    telegramMessageId: message.message_id || null,
    ...getMessagePayload(message)
  });
}

async function getTodaysTickets(userId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  return Ticket.findAll({
    where: {
      userId,
      openedAt: {
        [Op.gte]: start
      }
    }
  });
}

module.exports = {
  createOrAppendTicket,
  getOpenTickets,
  getTicketById,
  closeTicket,
  saveAdminReply,
  getTodaysTickets
};
