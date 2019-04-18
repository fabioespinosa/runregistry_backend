module.exports = (sequelize, DataTypes) => {
    const Workspace = sequelize.define(
        'Workspace',
        {
            workspace: {
                type: DataTypes.TEXT,
                allowNull: false,
                primaryKey: true
            }
        },
        {
            name: {
                singular: 'Workspace',
                plural: 'Workspace'
            }
        }
    );
    Workspace.associate = function(models) {
        Workspace.hasMany(models.WorkspaceColumn, {
            as: 'columns',
            foreignKey: 'workspace'
        });
    };
    return Workspace;
};
