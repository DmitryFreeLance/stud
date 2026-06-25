function mainMenu(isAdmin) {
  const keyboard = [[{ text: 'FAQ' }, { text: 'Обратная связь' }]];

  if (isAdmin) {
    keyboard.push([{ text: 'Посмотреть заявки' }]);
  }

  return {
    reply_markup: {
      keyboard,
      resize_keyboard: true
    }
  };
}

function cancelInlineKeyboard(actionId) {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: 'Отмена', callback_data: `cancel:${actionId}` }]]
    }
  };
}

function faqMenuKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Поиск по ключевому слову', callback_data: 'faq:keyword' }],
        [{ text: 'Поиск по разделам', callback_data: 'faq:sections:0' }],
        [{ text: 'Главное меню', callback_data: 'nav:main' }]
      ]
    }
  };
}

function withBackRow(rows, backCallback) {
  return [...rows, [{ text: 'Назад', callback_data: backCallback }]];
}

function paginatedKeyboard(items, page, pageSize, mapper, backCallback, pageCallbackBuilder) {
  const start = page * pageSize;
  const chunk = items.slice(start, start + pageSize);
  const rows = chunk.map(mapper);
  const navRow = [];
  const getPageCallback = pageCallbackBuilder || ((targetPage) => `page:${targetPage}`);

  if (page > 0) {
    navRow.push({ text: '<<', callback_data: getPageCallback(page - 1) });
  }

  if (start + pageSize < items.length) {
    navRow.push({ text: '>>', callback_data: getPageCallback(page + 1) });
  }

  if (navRow.length > 0) {
    rows.push(navRow);
  }

  return {
    reply_markup: {
      inline_keyboard: withBackRow(rows, backCallback)
    }
  };
}

module.exports = {
  mainMenu,
  cancelInlineKeyboard,
  faqMenuKeyboard,
  paginatedKeyboard
};
