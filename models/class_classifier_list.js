module.exports = (sequelize, DataTypes) => {
    const ClassClassifierList = sequelize.define(
        'ClassClassifierList',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            }
        },
        { timestamps: false }
    );
    ClassClassifierList.associate = function(models) {
        ClassClassifierList.hasMany(models.Settings, {
            foreignKey: {
                name: 'CCL_id',
                allowNull: false
            }
        });
        ClassClassifierList.belongsToMany(models.ClassClassifier, {
            through: models.ClassClassifierEntries,
            foreignKey: 'CCL_id',
            otherKey: 'id'
        });
    };
    return ClassClassifierList;
};
