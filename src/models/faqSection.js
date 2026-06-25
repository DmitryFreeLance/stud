const { DataTypes } = require('sequelize');

function defineFaqSection(sequelize) {
  return sequelize.define(
    'FaqSection',
    {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      }
    },
    {
      tableName: 'faq_sections'
    }
  );
}

module.exports = defineFaqSection;
