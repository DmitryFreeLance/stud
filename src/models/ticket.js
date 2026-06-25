const { DataTypes } = require('sequelize');

function defineTicket(sequelize) {
  return sequelize.define(
    'Ticket',
    {
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'open'
      },
      previewText: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      openedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      closedAt: {
        type: DataTypes.DATE
      }
    },
    {
      tableName: 'tickets'
    }
  );
}

module.exports = defineTicket;
