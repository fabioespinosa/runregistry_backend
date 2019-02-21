module.exports = (sequelize, DataTypes) => {
    const Dataset = sequelize.define(
        'Dataset',
        {
            run_number: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true
            },
            name: { type: DataTypes.TEXT, allowNull: false, primaryKey: true },
            dataset_attributes: { type: DataTypes.JSONB, allowNull: false },
            deleted: { type: DataTypes.BOOLEAN, allowNull: false },
            version: { type: DataTypes.INTEGER, allowNull: false }
        },
        {
            timestamps: false,
            indexes: [{ name: 'Dataset_version_index', fields: ['version'] }]
        }
    );
    Dataset.associate = function(models) {
        Dataset.belongsTo(models.Run, { foreignKey: 'run_number' });
        Dataset.hasOne(models.DatasetTripletCache, {
            constraints: false,
            foreignKey: 'run_number',
            sourceKey: 'run_number',
            scope: { name: 'DatasetTripletCache.name' }
        });
    };
    return Dataset;
};
