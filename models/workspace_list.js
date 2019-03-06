module.exports = (sequelize, DataTypes) => {
    const WorkspaceList = sequelize.define(
        'WorkspaceList',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            }
        },
        { timestamps: false }
    );
    WorkspaceList.associate = function(models) {
        WorkspaceList.hasMany(models.Settings, {
            foreignKey: {
                name: 'WL_id',
                allowNull: false
            },
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT'
        });
        WorkspaceList.belongsToMany(models.Workspace, {
            through: models.WorkspaceEntries,
            foreignKey: 'WL_id',
            otherKey: 'id',
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT'
        });
    };
    return WorkspaceList;
};
