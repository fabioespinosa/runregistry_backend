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
            },
            name: {
                type: DataTypes.TEXT,
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

        CycleDataset.belongsTo(models.Dataset, {
            constraints: false,
            foreignKey: 'run_number',
            sourceKey: 'run_number',
            scope: {
                name: sequelize.where(
                    sequelize.col('CycleDataset.name'),
                    '=',
                    sequelize.col('CycleDataset->Dataset.name')
                )
            }
        });
    };
    return CycleDataset;
};
