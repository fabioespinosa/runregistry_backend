module.exports = (sequelize, DataTypes) => {
    const ComponentClassifier = sequelize.define(
        'ComponentClassifier',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            status: {
                type: DataTypes.STRING,
                allowNull: false
            },
            component: {
                type: DataTypes.STRING,
                allowNull: false
            },
            classifier: {
                type: DataTypes.JSONB,
                allowNull: false
            },
            priority: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            enabled: {
                type: DataTypes.BOOLEAN,
                allowNull: false
            }
        },
        {
            updatedAt: false
        }
    );
    ComponentClassifier.associate = function(models) {
        ComponentClassifier.belongsToMany(models.ComponentClassifierList, {
            through: models.ComponentClassifierEntries,
            foreignKey: 'id',
            otherKey: 'CPCL_id'
        });
    };
    return ComponentClassifier;
};
