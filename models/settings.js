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
            onDelete: 'RESTRICT'
        });
        Settings.belongsTo(models.DatasetClassifierList, {
            foreignKey: {
                name: 'DCL_id',
                allowNull: false
            },
            onDelete: 'RESTRICT'
        });
        Settings.belongsTo(models.ComponentClassifierList, {
            foreignKey: {
                name: 'CCL_id',
                allowNull: false
            },
            onDelete: 'RESTRICT'
        });
        Settings.belongsTo(models.OfflineDatasetClassifierList, {
            foreignKey: {
                name: 'ODCL_id',
                allowNull: false
            },
            onDelete: 'RESTRICT'
        });
        Settings.belongsTo(models.PermissionList, {
            foreignKey: {
                name: 'PL_id',
                allowNull: false
            },
            onDelete: 'RESTRICT'
        });
        Settings.belongsTo(models.DatasetsAcceptedList, {
            foreignKey: {
                name: 'DAL_id',
                allowNull: false
            },
            onDelete: 'RESTRICT'
        });
        Settings.belongsTo(models.WorkspaceList, {
            foreignKey: {
                name: 'WL_id',
                allowNull: false
            },
            onDelete: 'RESTRICT'
        });
        Settings.belongsTo(models.OfflineComponentClassifierList, {
            foreignKey: {
                name: 'OCPCL_id',
                allowNull: false
            },
            onDelete: 'RESTRICT'
        });
    };
    return Settings;
};
