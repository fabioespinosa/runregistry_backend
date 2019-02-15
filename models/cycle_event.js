module.exports = (sequelize, DataTypes) => {
    const CycleEvent = sequelize.define(
        'CycleEvent',
        {
            version: {
                primaryKey: true,
                type: DataTypes.INTEGER,
                autoIncrement: true
            },
            cycle_id: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            cycle_metadata: {
                type: DataTypes.JSONB,
                allowNull: false
            }
        },
        {
            timestamps: false,
            indexes: [
                { name: 'CycleEvent_cycleId_index', fields: ['cycle_id'] }
            ]
        }
    );
    CycleEvent.associate = function(models) {
        CycleEvent.belongsTo(models.Event, { foreignKey: 'version' });
    };

    return CycleEvent;
};
