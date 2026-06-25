const { DataTypes } = require('sequelize');

function defineFaqItem(sequelize) {
  return sequelize.define(
    'FaqItem',
    {
      question: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      answer: {
        type: DataTypes.TEXT,
        allowNull: false
      }
    },
    {
      tableName: 'faq_items'
    }
  );
}

module.exports = defineFaqItem;
