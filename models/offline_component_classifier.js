module.exports = (sequelize, DataTypes) => {
    const OfflineComponentClassifier = sequelize.define(
        'OfflineComponentClassifier',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            status: { type: DataTypes.STRING, allowNull: false },
            component: { type: DataTypes.STRING, allowNull: false },
            classifier: { type: DataTypes.JSONB, allowNull: false },
            priority: { type: DataTypes.INTEGER, allowNull: false },
            enabled: { type: DataTypes.BOOLEAN, allowNull: false },
            workspace: {
                type: DataTypes.INTEGER,
                allowNull: false
            }
        },
        {
            updatedAt: false,
            name: {
                singular: 'OfflineomponentClassifier',
                plural: 'OfflineComponentClassifier'
            }
        }
    );
    OfflineComponentClassifier.associate = function(models) {
        OfflineComponentClassifier.belongsToMany(
            models.OfflineComponentClassifierList,
            {
                through: models.OfflineComponentClassifierEntries,
                foreignKey: 'id',
                otherKey: 'OCPCL_id'
            }
        );
        OfflineComponentClassifier.belongsTo(models.Workspace, {
            foreignKey: 'workspace'
        });
    };
    return OfflineComponentClassifier;
};
