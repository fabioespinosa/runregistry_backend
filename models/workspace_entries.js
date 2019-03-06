module.exports = (sequelize, DataTypes) => {
    const WorkspaceEntries = sequelize.define(
        'WorkspaceEntries',
        {},
        { timestamps: false }
    );
    WorkspaceEntries.associate = function(models) {
        WorkspaceEntries.belongsTo(models.WorkspaceList, {
            foreignKey: {
                name: 'WL_id'
            }
        });
        WorkspaceEntries.belongsTo(models.Workspace, {
            foreignKey: {
                name: 'id'
            }
        });
    };
    return WorkspaceEntries;
};
