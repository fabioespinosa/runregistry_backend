module.exports = (sequelize, DataTypes) => {
    const DatasetClassifierEntries = sequelize.define(
        'DatasetClassifierEntries',
        {
            DCE_id: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            DC_id: {
                type: DataTypes.INTEGER,
                allowNull: false
            }
        }
    );
    DatasetClassifierEntries.associate = function(models) {
        DatasetClassifierEntries.belongsTo(models.DatasetClassifierList, {
            foreignKey: {
                name: 'DCL_id'
            }
        });
        DatasetClassifierEntries.belongsTo(models.DatasetClassifier, {
            foreignKey: {
                name: 'id'
            }
        });
    };
    return DatasetClassifierEntries;
};
