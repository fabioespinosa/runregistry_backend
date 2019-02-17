module.exports = (sequelize, DataTypes) => {
    const Dataset = sequelize.define(
        'Dataset',
        {
            run_number: { type: DataTypes.INTEGER, primaryKey: true },
            name: { type: DataTypes.TEXT, primaryKey: true },
            dataset_attributes: { type: DataTypes.JSONB },
            version: { type: DataTypes.INTEGER }
        },
        {
            timestamps: false,
            indexes: [{ name: 'Dataset_version_index', fields: ['version'] }]
        }
    );
    Dataset.associate = function(models) {
        Dataset.belongsTo(models.Run, { foreignKey: 'run_number' });
    };
    return Dataset;
};
