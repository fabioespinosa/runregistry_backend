module.exports = (sequelize, DataTypes) => {
    const CycleDataset = sequelize.define(
        'CycleDataset',
        {
            id_cycle: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true
            },
            run_number: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true
            }
        },
        {
            name: {
                singular: 'CycleDataset',
                plural: 'CycleDataset'
            }
        }
    );
    CycleDataset.associate = function(models) {
        CycleDataset.belongsTo(models.Cycle, {
            foreignKey: {
                name: 'id_cycle'
            }
        });

        CycleDataset.belongsTo(models.Run, {
            constraints: false,
            foreignKey: 'run_number',
            sourceKey: 'run_number'
        });
    };
    return CycleDataset;
};
