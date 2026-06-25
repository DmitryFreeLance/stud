const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { env } = require('./config/env');
const { sequelize } = require('./models');
const { faqMenuKeyboard, mainMenu, cancelInlineKeyboard, paginatedKeyboard } = require('./utils/keyboards');
const { findOrCreateUser } = require('./services/userService');
const { getSections, getSectionWithItems, searchFaq } = require('./services/faqService');
const {
  createOrAppendTicket,
  getOpenTickets,
  getTicketById,
  closeTicket,
  saveAdminReply,
  getTodaysTickets
} = require('./services/ticketService');
const { getSession, setMode, pushHistory, popHistory, clearHistory } = require('./services/sessionStore');
const faqSeed = require('./data/faq.seed.json');
const { FaqSection, FaqItem } = require('./models');

if (!env.botToken) {
  throw new Error('BOT_TOKEN is required');
}

const app = express();
const bot = new TelegramBot(env.botToken, { polling: true });
const pendingActions = new Map();
const PAGE_SIZE = 5;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

function actionKey(chatId) {
  return `${chatId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

async function ensureFaqSeeded() {
  const count = await FaqSection.count();
  if (count > 0) {
    return;
  }

  for (const sectionData of faqSeed) {
    const section = await FaqSection.create({ title: sectionData.section });
    for (const item of sectionData.items) {
      await FaqItem.create({
        sectionId: section.id,
        question: item.question,
        answer: item.answer
      });
    }
  }
}

async function showMainMenu(chatId, isAdmin, text = 'Главное меню') {
  clearHistory(chatId);
  setMode(chatId, 'idle');
  return bot.sendMessage(chatId, text, mainMenu(isAdmin));
}

async function showFaqMenu(chatId) {
  clearHistory(chatId);
  pushHistory(chatId, { type: 'main' });
  setMode(chatId, 'faq_menu');
  return bot.sendMessage(chatId, 'Выберите режим FAQ:', faqMenuKeyboard());
}

async function showSections(chatId, page = 0) {
  const sections = await getSections();
  const keyboard = paginatedKeyboard(
    sections,
    page,
    PAGE_SIZE,
    (section) => [{ text: section.title, callback_data: `faq:section:${section.id}` }],
    'faq:menu',
    (targetPage) => `faq:sections:${targetPage}`
  );

  pushHistory(chatId, { type: 'faq_menu' });
  setMode(chatId, 'faq_sections');
  return bot.sendMessage(chatId, 'Выберите раздел:', keyboard);
}

async function showSectionQuestions(chatId, sectionId) {
  const section = await getSectionWithItems(sectionId);

  if (!section) {
    return bot.sendMessage(chatId, 'Раздел не найден.');
  }

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        ...section.items.map((item) => [{ text: item.question, callback_data: `faq:item:${item.id}` }]),
        [{ text: 'Назад', callback_data: 'faq:sections:0' }]
      ]
    }
  };

  pushHistory(chatId, { type: 'faq_sections', sectionId });
  setMode(chatId, 'faq_questions');
  return bot.sendMessage(chatId, `Раздел: ${section.title}`, keyboard);
}

async function showFaqItem(chatId, itemId) {
  const item = await FaqItem.findByPk(itemId, {
    include: [{ model: FaqSection, as: 'section' }]
  });

  if (!item) {
    return bot.sendMessage(chatId, 'Вопрос не найден.');
  }

  pushHistory(chatId, { type: 'faq_questions', sectionId: item.sectionId });
  return bot.sendMessage(
    chatId,
    `Вопрос:\n${item.question}\n\nОтвет:\n${item.answer}`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Назад', callback_data: `faq:section:${item.sectionId}` }],
          [{ text: 'Главное меню', callback_data: 'nav:main' }]
        ]
      }
    }
  );
}

async function showTickets(chatId, page = 0) {
  const tickets = await getOpenTickets();

  if (tickets.length === 0) {
    return bot.sendMessage(chatId, 'Открытых заявок нет.', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Назад', callback_data: 'nav:main' }]]
      }
    });
  }

  const keyboard = paginatedKeyboard(
    tickets,
    page,
    PAGE_SIZE,
    (ticket) => [{ text: String(ticket.id), callback_data: `ticket:view:${ticket.id}` }],
    'nav:main',
    (targetPage) => `tickets:list:${targetPage}`
  );

  const lines = tickets
    .slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
    .map((ticket) => `${ticket.id} - ${ticket.previewText}`);

  setMode(chatId, 'ticket_list');
  return bot.sendMessage(chatId, `Список заявок:\n${lines.join('\n')}`, keyboard);
}

async function showTicketDetails(chatId, ticketId) {
  const ticket = await getTicketById(ticketId);

  if (!ticket) {
    return bot.sendMessage(chatId, 'Заявка не найдена.');
  }

  const session = getSession(chatId);
  session.selectedTicketId = ticket.id;
  setMode(chatId, 'admin_reply');

  const lines = ticket.messages.slice(-5).map((message) => {
    const prefix = message.senderRole === 'admin' ? 'Админ' : 'Пользователь';
    const body = message.text || message.messageType;
    return `${prefix}: ${body}`;
  });

  return bot.sendMessage(
    chatId,
    `Заявка #${ticket.id}\nПользователь: ${ticket.user.firstName} (${ticket.user.telegramId})\nСтатус: ${ticket.status}\n\nПоследние сообщения:\n${lines.join('\n') || 'Пусто'}\n\nТеперь отправьте любой текст или файл, и бот доставит его пользователю.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Закрыть заявку', callback_data: `ticket:close:${ticket.id}` }],
          [{ text: 'Назад', callback_data: 'tickets:list:0' }]
        ]
      }
    }
  );
}

async function sendTicketMessageToUser(ticket, message) {
  const targetChatId = ticket.user.telegramId;

  switch (message.messageType) {
    case 'text':
      await bot.sendMessage(targetChatId, message.text || '');
      break;
    case 'photo':
      await bot.sendPhoto(targetChatId, message.telegramFileId, {
        caption: message.text || undefined
      });
      break;
    case 'document':
      await bot.sendDocument(targetChatId, message.telegramFileId, {
        caption: message.text || undefined
      });
      break;
    case 'video':
      await bot.sendVideo(targetChatId, message.telegramFileId, {
        caption: message.text || undefined
      });
      break;
    case 'voice':
      await bot.sendVoice(targetChatId, message.telegramFileId);
      break;
    case 'audio':
      await bot.sendAudio(targetChatId, message.telegramFileId, {
        caption: message.text || undefined
      });
      break;
    case 'sticker':
      await bot.sendSticker(targetChatId, message.telegramFileId);
      break;
    default:
      await bot.sendMessage(targetChatId, message.text || 'Новое сообщение по заявке');
  }
}

async function notifyAdmins(text) {
  for (const adminId of env.adminTelegramIds) {
    try {
      await bot.sendMessage(adminId, text);
    } catch (error) {
      console.error(`Failed to notify admin ${adminId}`, error.message);
    }
  }
}

async function runCancelableAction(chatId, executor) {
  const id = actionKey(chatId);
  pendingActions.set(id, { canceled: false, chatId });
  const waitMessage = await bot.sendMessage(chatId, 'Выполняю запрос...', cancelInlineKeyboard(id));

  await new Promise((resolve) => setTimeout(resolve, env.actionDelayMs));

  const action = pendingActions.get(id);
  if (!action || action.canceled) {
    pendingActions.delete(id);
    return;
  }

  try {
    await executor();
  } finally {
    pendingActions.delete(id);
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
      chat_id: chatId,
      message_id: waitMessage.message_id
    }).catch(() => null);
  }
}

async function runButtonAction(chatId, executor) {
  await runCancelableAction(chatId, executor);
}

bot.onText(/\/start/, async (msg) => {
  const user = await findOrCreateUser(msg);
  await showMainMenu(msg.chat.id, user.role === 1, 'Бот запущен. Выберите раздел:');
});

bot.on('message', async (msg) => {
  if (!msg.text && !msg.document && !msg.photo && !msg.video && !msg.voice && !msg.audio && !msg.sticker) {
    return;
  }

  if (msg.text && msg.text.startsWith('/start')) {
    return;
  }

  const user = await findOrCreateUser(msg);
  const chatId = msg.chat.id;
  const session = getSession(chatId);

  if (msg.text === 'FAQ') {
    await runButtonAction(chatId, async () => {
      await showFaqMenu(chatId);
    });
    return;
  }

  if (msg.text === 'Обратная связь') {
    setMode(chatId, 'feedback');
    await bot.sendMessage(
      chatId,
      'Отправьте текст, фото, документ, видео, стикер, аудио или голосовое сообщение. Всё будет прикреплено к вашей текущей заявке.',
      {
        reply_markup: {
          keyboard: [
            [{ text: 'Главное меню' }]
          ],
          resize_keyboard: true
        }
      }
    );
    return;
  }

  if (msg.text === 'Посмотреть заявки' && user.role === 1) {
    await runButtonAction(chatId, async () => {
      await showTickets(chatId, 0);
    });
    return;
  }

  if (msg.text === 'Главное меню') {
    await showMainMenu(chatId, user.role === 1);
    return;
  }

  if (session.mode === 'faq_search_waiting' && msg.text) {
    const results = await searchFaq(msg.text);
    if (results.length === 0) {
      await bot.sendMessage(chatId, 'Ничего не найдено. Попробуйте другой запрос.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Назад', callback_data: 'faq:menu' }],
            [{ text: 'Главное меню', callback_data: 'nav:main' }]
          ]
        }
      });
      return;
    }

    const rows = results.map((item) => [{ text: item.question, callback_data: `faq:item:${item.id}` }]);
    rows.push([{ text: 'Назад', callback_data: 'faq:menu' }]);
    rows.push([{ text: 'Главное меню', callback_data: 'nav:main' }]);
    await bot.sendMessage(chatId, 'Найдены подходящие вопросы:', {
      reply_markup: {
        inline_keyboard: rows
      }
    });
    return;
  }

  if (session.mode === 'feedback') {
    const todaysTickets = await getTodaysTickets(user.id);
    const { ticket, created } = await createOrAppendTicket(user, msg);

    if (created && todaysTickets.length === 0) {
      await bot.sendMessage(
        chatId,
        'Заявка получена! Вы можете писать дополнительные сообщения - они будут прикреплены к заявке.',
        mainMenu(user.role === 1)
      );
      await notifyAdmins(`Поступила новая заявка! ID: ${ticket.id}`);
    }
    return;
  }

  if (session.mode === 'admin_reply' && user.role === 1 && session.selectedTicketId) {
    const ticket = await getTicketById(session.selectedTicketId);
    if (!ticket || ticket.status !== 'open') {
      await bot.sendMessage(chatId, 'Заявка уже закрыта или не найдена.');
      return;
    }

    const savedMessage = await saveAdminReply(ticket.id, msg);
    await sendTicketMessageToUser(ticket, savedMessage);
    await bot.sendMessage(chatId, `Сообщение отправлено пользователю по заявке #${ticket.id}.`);
    return;
  }
});

bot.on('callback_query', async (query) => {
  const user = await findOrCreateUser({ from: query.from });
  const chatId = query.message.chat.id;
  const data = query.data || '';

  await bot.answerCallbackQuery(query.id);

  if (data.startsWith('cancel:')) {
    const id = data.split(':')[1];
    const action = pendingActions.get(id);
    if (action) {
      action.canceled = true;
      pendingActions.set(id, action);
      await bot.sendMessage(chatId, 'Запрос отменён.');
    }
    return;
  }

  if (data === 'faq:keyword') {
    await runButtonAction(chatId, async () => {
      setMode(chatId, 'faq_search_waiting');
      await bot.sendMessage(chatId, 'Введите ключевое слово для поиска по вопросам и ответам.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Назад', callback_data: 'faq:menu' }],
            [{ text: 'Главное меню', callback_data: 'nav:main' }]
          ]
        }
      });
    });
    return;
  }

  if (data === 'faq:menu') {
    await runButtonAction(chatId, async () => {
      await showFaqMenu(chatId);
    });
    return;
  }

  if (data.startsWith('faq:sections:')) {
    const page = Number(data.split(':')[2]) || 0;
    await runButtonAction(chatId, async () => {
      await showSections(chatId, page);
    });
    return;
  }

  if (data.startsWith('faq:section:')) {
    const sectionId = Number(data.split(':')[2]);
    await runButtonAction(chatId, async () => {
      await showSectionQuestions(chatId, sectionId);
    });
    return;
  }

  if (data.startsWith('faq:item:')) {
    const itemId = Number(data.split(':')[2]);
    await runButtonAction(chatId, async () => {
      await showFaqItem(chatId, itemId);
    });
    return;
  }

  if (data === 'nav:main') {
    await runButtonAction(chatId, async () => {
      await showMainMenu(chatId, user.role === 1);
    });
    return;
  }

  if (data.startsWith('tickets:list:')) {
    const page = Number(data.split(':')[2]) || 0;
    await runButtonAction(chatId, async () => {
      await showTickets(chatId, page);
    });
    return;
  }

  if (data.startsWith('ticket:view:')) {
    const ticketId = Number(data.split(':')[2]);
    await runButtonAction(chatId, async () => {
      await showTicketDetails(chatId, ticketId);
    });
    return;
  }

  if (data.startsWith('ticket:close:')) {
    const ticketId = Number(data.split(':')[2]);
    await runButtonAction(chatId, async () => {
      const ticket = await closeTicket(ticketId);
      if (ticket) {
        const detailedTicket = await getTicketById(ticketId);
        if (detailedTicket) {
          await bot.sendMessage(detailedTicket.user.telegramId, `Ваша заявка #${ticketId} закрыта администратором.`);
        }
      }
      await bot.sendMessage(chatId, `Заявка #${ticketId} закрыта.`);
    });
    return;
  }

  if (data === 'back') {
    const previous = popHistory(chatId);
    if (!previous || previous.type === 'main') {
      await showMainMenu(chatId, user.role === 1);
      return;
    }
  }
});

async function start() {
  await sequelize.authenticate();
  await sequelize.sync();
  await ensureFaqSeeded();
  app.listen(env.port, () => {
    console.log(`HTTP server started on port ${env.port}`);
  });
}

start().catch((error) => {
  console.error('Application start failed', error);
  process.exit(1);
});
