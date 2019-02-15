module.exports = (sequelize, DataTypes) => {
    const Lumisection = sequelize.define(
        'Lumisection',
        {
            id_cycle: { type: DataTypes.INTEGER, primaryKey: true },
            run_number: { type: DataTypes.INTEGER },
            lumisection_number: { type: DataTypes.INTEGER },
            triplet: { type: DataTypes.JSONB }
        },
        {
            timestamps: false
        }
    );
    Lumisection.associate = function(models) {
        Lumisection.belongsTo(models.Run, { foreignKey: 'run_number' });
    };
    return Lumisection;
};
