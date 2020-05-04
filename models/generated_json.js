module.exports = (sequelize, DataTypes) => {
  const GeneratedJson = sequelize.define(
    'GeneratedJson',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      dataset_name_filter: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      tags: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      created_by: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      official: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
      runregistry_version: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      json_logic: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      generated_json: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      generated_json_with_dataset_names: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      anti_json: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
    },
    {
      name: {
        singular: 'GeneratedJson',
        plural: 'GeneratedJson',
      },
    }
  );

  return GeneratedJson;
};
