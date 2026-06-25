const seedData = require('../data/faq.seed.json');
const { sequelize, FaqSection, FaqItem } = require('../models');

async function seedFaq() {
  await sequelize.sync();

  for (const sectionData of seedData) {
    const [section] = await FaqSection.findOrCreate({
      where: { title: sectionData.section },
      defaults: { title: sectionData.section }
    });

    for (const itemData of sectionData.items) {
      await FaqItem.findOrCreate({
        where: {
          sectionId: section.id,
          question: itemData.question
        },
        defaults: {
          sectionId: section.id,
          question: itemData.question,
          answer: itemData.answer
        }
      });
    }
  }
}

seedFaq()
  .then(async () => {
    await sequelize.close();
    console.log('FAQ seed completed');
  })
  .catch(async (error) => {
    console.error(error);
    await sequelize.close();
    process.exit(1);
  });
