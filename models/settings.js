module.exports = (sequelize, DataTypes) => {
    const Settings = sequelize.define(
        'Settings',
        {
            id: {
                primaryKey: true,
                type: DataTypes.INTEGER,
                autoIncrement: true
            },
            metadata: {
                type: DataTypes.JSONB,
                allowNull: false
            }
        },
        {
            updatedAt: false
        }
    );
    Settings.associate = function(models) {
        Settings.belongsTo(models.ClassClassifierList, {
            foreignKey: {
                name: 'CCL_id',
                allowNull: false
            },
            onDelete: 'CASCADE'
        });
        Settings.belongsTo(models.DatasetClassifierList, {
            foreignKey: {
                name: 'DCL_id',
                allowNull: false
            },
            onDelete: 'CASCADE'
        });
        Settings.belongsTo(models.ComponentClassifierList, {
            foreignKey: {
                name: 'CCL_id',
                allowNull: false
            },
            onDelete: 'CASCADE'
        });
        Settings.belongsTo(models.OfflineDatasetClassifierList, {
            foreignKey: {
                name: 'ODCL_id',
                allowNull: false
            },
            onDelete: 'CASCADE'
        });
    };
    return Settings;
};
