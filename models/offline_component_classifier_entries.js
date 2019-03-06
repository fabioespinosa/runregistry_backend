module.exports = (sequelize, DataTypes) => {
    const OfflineComponentClassifierEntries = sequelize.define(
        'OfflineComponentClassifierEntries',
        {},
        { timestamps: false }
    );
    OfflineComponentClassifierEntries.associate = function(models) {
        OfflineComponentClassifierEntries.belongsTo(
            models.OfflineComponentClassifierList,
            {
                foreignKey: {
                    name: 'OCPCL_id'
                }
            }
        );
        OfflineComponentClassifierEntries.belongsTo(
            models.OfflineComponentClassifier,
            {
                foreignKey: {
                    name: 'id'
                }
            }
        );
    };
    return OfflineComponentClassifierEntries;
};
