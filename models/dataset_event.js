module.exports = (sequelize, DataTypes) => {
    const DatasetEvent = sequelize.define(
        'DatasetEvent',
        {
            version: {
                primaryKey: true,
                type: DataTypes.INTEGER,
                autoIncrement: true
            },
            dataset_id: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            dataset_metadata: {
                type: DataTypes.JSONB,
                allowNull: false
            }
        },
        {
            timestamps: false,
            indexes: [
                { name: 'DatasetEvent_datasetId_index', fields: ['dataset_id'] }
            ]
        }
    );
    DatasetEvent.associate = function(models) {
        DatasetEvent.belongsTo(models.Event, { foreignKey: 'version' });
    };

    return DatasetEvent;
};
