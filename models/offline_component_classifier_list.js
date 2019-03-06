module.exports = (sequelize, DataTypes) => {
    const OfflineComponentClassifierList = sequelize.define(
        'OfflineComponentClassifierList',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            }
        },
        { timestamps: false }
    );
    OfflineComponentClassifierList.associate = function(models) {
        OfflineComponentClassifierList.hasMany(models.Settings, {
            foreignKey: {
                name: 'OCPCL_id',
                allowNull: false
            }
        });
        OfflineComponentClassifierList.belongsToMany(
            models.OfflineComponentClassifier,
            {
                through: models.OfflineComponentClassifierEntries,
                foreignKey: 'OCPCL_id',
                otherKey: 'id'
            }
        );
    };
    return OfflineComponentClassifierList;
};
