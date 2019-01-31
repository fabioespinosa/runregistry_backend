module.exports = (sequelize, DataTypes) => {
    const Event = sequelize.define(
        'Event',
        {
            version: {
                primaryKey: true,
                type: DataTypes.INTEGER,
                autoIncrement: true
            },
            by: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            comment: {
                type: DataTypes.TEXT,
                allowNull: true
            }
        },
        {
            updatedAt: false
        }
    );
    Event.associate = function(models) {
        Event.hasOne(models.RunEvent, { foreignKey: 'version' });
    };
    return Event;
};
