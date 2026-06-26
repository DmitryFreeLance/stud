const { DataTypes } = require('sequelize');

function defineUser(sequelize) {
  return sequelize.define(
    'User',
    {
      telegramId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        unique: true
      },
      username: {
        type: DataTypes.STRING
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      lastName: {
        type: DataTypes.STRING
      },
      role: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      marketingOptIn: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      newsOptIn: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }
    },
    {
      tableName: 'users'
    }
  );
}

module.exports = defineUser;
