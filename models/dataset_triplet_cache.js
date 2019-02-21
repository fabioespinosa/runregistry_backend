module.exports = (sequelize, DataTypes) => {
    const DatasetTripletCache = sequelize.define(
        'DatasetTripletCache',
        {
            // run_number and name are a composite foreign key to Dataset.
            run_number: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true
            },
            name: { type: DataTypes.TEXT, allowNull: false, primaryKey: true },
            triplet_summary: { type: DataTypes.JSONB, allowNull: false },
            version: { type: DataTypes.INTEGER, allowNull: false }
        },
        {
            timestamps: false,
            indexes: [
                {
                    name: 'DatasetTripleCache_version_index',
                    fields: ['version']
                }
            ]
        }
    );
    DatasetTripletCache.associate = function(models) {
        DatasetTripletCache.belongsTo(models.Run, { foreignKey: 'run_number' });
    };
    return DatasetTripletCache;
};
