const { sequelize } = require('../config/database');
const defineUser = require('./user');
const defineFaqSection = require('./faqSection');
const defineFaqItem = require('./faqItem');
const defineTicket = require('./ticket');
const defineTicketMessage = require('./ticketMessage');

const User = defineUser(sequelize);
const FaqSection = defineFaqSection(sequelize);
const FaqItem = defineFaqItem(sequelize);
const Ticket = defineTicket(sequelize);
const TicketMessage = defineTicketMessage(sequelize);

FaqSection.hasMany(FaqItem, { foreignKey: 'sectionId', as: 'items', onDelete: 'CASCADE' });
FaqItem.belongsTo(FaqSection, { foreignKey: 'sectionId', as: 'section' });

User.hasMany(Ticket, { foreignKey: 'userId', as: 'tickets' });
Ticket.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Ticket.hasMany(TicketMessage, { foreignKey: 'ticketId', as: 'messages', onDelete: 'CASCADE' });
TicketMessage.belongsTo(Ticket, { foreignKey: 'ticketId', as: 'ticket' });

module.exports = {
  sequelize,
  User,
  FaqSection,
  FaqItem,
  Ticket,
  TicketMessage
};
