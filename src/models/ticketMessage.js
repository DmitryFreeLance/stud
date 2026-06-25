const { DataTypes } = require('sequelize');

function defineTicketMessage(sequelize) {
  return sequelize.define(
    'TicketMessage',
    {
      senderRole: {
        type: DataTypes.STRING,
        allowNull: false
      },
      telegramMessageId: {
        type: DataTypes.BIGINT
      },
      messageType: {
        type: DataTypes.STRING,
        allowNull: false
      },
      text: {
        type: DataTypes.TEXT
      },
      telegramFileId: {
        type: DataTypes.STRING
      },
      telegramFileUniqueId: {
        type: DataTypes.STRING
      },
      meta: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      }
    },
    {
      tableName: 'ticket_messages'
    }
  );
}

module.exports = defineTicketMessage;
