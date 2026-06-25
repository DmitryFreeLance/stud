const Fuse = require('fuse.js');
const { FaqSection, FaqItem } = require('../models');
const { env } = require('../config/env');

async function getSections() {
  return FaqSection.findAll({
    order: [['title', 'ASC']]
  });
}

async function getSectionWithItems(sectionId) {
  return FaqSection.findByPk(sectionId, {
    include: [{ model: FaqItem, as: 'items', separate: true, order: [['question', 'ASC']] }]
  });
}

async function searchFaq(term) {
  const items = await FaqItem.findAll({
    include: [{ model: FaqSection, as: 'section' }],
    order: [['id', 'ASC']]
  });

  const fuse = new Fuse(
    items.map((item) => item.toJSON()),
    {
      includeScore: true,
      ignoreLocation: true,
      threshold: 0.4,
      keys: ['question', 'answer']
    }
  );

  return fuse.search(term).slice(0, env.faqSearchLimit).map((entry) => entry.item);
}

module.exports = {
  getSections,
  getSectionWithItems,
  searchFaq
};
