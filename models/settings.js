module.exports = (sequelize, DataTypes) => {
    const Settings = sequelize.define('Settings', {
        id: {
            primaryKey: true,
            type: DataTypes.INTEGER,
            autoIncrement: true
        },
        reason: {
            type: DataTypes.TEXT,
            allowNull: false
        }
    });
    Settings.associate = function(models) {
        Settings.belongsTo(models.ClassClassifierList, {
            foreignKey: {
                name: 'CCL_id',
                allowNull: false
            }
        });
        Settings.belongsTo(models.DatasetClassifierList, {
            foreignKey: {
                name: 'DCL_id',
                allowNull: false
            }
        });
        Settings.belongsTo(models.ComponentClassifierList, {
            foreignKey: {
                name: 'CCL_id',
                allowNull: false
            }
        });
        Settings.belongsTo(models.OfflineDatasetClassifierList, {
            foreignKey: {
                name: 'ODCL_id',
                allowNull: false
            }
        });
    };
    return Settings;
};
