module.exports = (sequelize, DataTypes) => {
    const Workspace = sequelize.define(
        'Workspace',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            workspace: {
                type: DataTypes.STRING,
                allowNull: false
            },
            columns: {
                type: DataTypes.JSONB,
                allowNull: false
            }
        },
        {
            updatedAt: false,
            name: {
                singular: 'Workspace',
                plural: 'Workspace'
            }
        }
    );
    Workspace.associate = function(models) {
        Workspace.belongsToMany(models.WorkspaceList, {
            through: models.WorkspaceEntries,
            foreignKey: 'id',
            otherKey: 'WL_id'
        });
    };
    return Workspace;
};
