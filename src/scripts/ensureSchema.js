const { DataTypes } = require('sequelize');

async function ensureUserColumns(sequelize) {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable('users');

  if (!table.marketingOptIn) {
    await queryInterface.addColumn('users', 'marketingOptIn', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  }

  if (!table.newsOptIn) {
    await queryInterface.addColumn('users', 'newsOptIn', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  }
}

async function ensureSchema(sequelize) {
  await ensureUserColumns(sequelize);
}

module.exports = {
  ensureSchema
};
