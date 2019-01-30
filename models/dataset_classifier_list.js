module.exports = (sequelize, DataTypes) => {
    const DatasetClassifierList = sequelize.define('DatasetClassifierList', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        }
    });
    DatasetClassifierList.associate = function(models) {
        DatasetClassifierList.hasMany(models.Settings, {
            foreignKey: 'DCL_id'
        });
        DatasetClassifierList.belongsToMany(models.DatasetClassifier, {
            through: models.DatasetClassifierEntries,
            foreignKey: 'DCL_id',
            otherKey: 'id'
        });
    };
    return DatasetClassifierList;
};
