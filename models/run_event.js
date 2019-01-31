module.exports = (sequelize, DataTypes) => {
    const RunEvent = sequelize.define(
        'RunEvent',
        {
            version: {
                primaryKey: true,
                type: DataTypes.INTEGER,
                autoIncrement: true
            },
            run_number: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            metadata: {
                type: DataTypes.JSONB,
                allowNull: false
            }
        },
        {
            timestamps: false
        }
    );
    RunEvent.associate = function(models) {
        RunEvent.belongsTo(models.Event, { foreignKey: 'version' });
    };

    return RunEvent;
};
