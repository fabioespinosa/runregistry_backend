module.exports = (sequelize, DataTypes) => {
    const WorkspaceColumn = sequelize.define(
        'WorkspaceColumn',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            workspace: {
                type: DataTypes.TEXT,
                allowNull: false,
                unique: 'WorkspaceColumn_unique_column_workspace_constraint'
            },
            name: {
                type: DataTypes.TEXT,
                allowNull: false,
                unique: 'WorkspaceColumn_unique_column_workspace_constraint'
            }
        },
        {
            uniqueKeys: [
                {
                    name: 'WorkspaceColumn_unique_column_workspace_constraint',
                    fields: ['workspace', 'name']
                }
            ]
        }
    );

    WorkspaceColumn.associate = function(models) {
        WorkspaceColumn.belongsTo(models.Workspace, {
            foreignKey: 'workspace'
        });
    };
    return WorkspaceColumn;
};
