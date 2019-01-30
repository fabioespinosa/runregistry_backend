module.exports = (sequelize, DataTypes) => {
    const ComponentClassifierEntries = sequelize.define(
        'ComponentClassifierEntries',
        {}
    );
    ComponentClassifierEntries.associate = function(models) {
        ComponentClassifierEntries.hasMany(models.ComponentClassifierList, {
            foreignKey: {
                name: 'CPCL_id'
            }
        });
        ComponentClassifierEntries.hasMany(models.ComponentClassifier, {
            foreignKey: {
                name: 'id'
            }
        });
    };
    return ComponentClassifierEntries;
};
