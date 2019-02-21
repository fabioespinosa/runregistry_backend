module.exports = (sequelize, DataTypes) => {
    const Run = sequelize.define(
        'Run',
        {
            run_number: { type: DataTypes.INTEGER, primaryKey: true },
            oms_attributes: { type: DataTypes.JSONB, allowNull: false },
            rr_attributes: { type: DataTypes.JSONB, allowNull: false },
            version: { type: DataTypes.INTEGER, allowNull: false },
            deleted: { type: DataTypes.BOOLEAN, allowNull: false }
        },
        {
            timestamps: false,
            indexes: [{ name: 'Run_version_index', fields: ['version'] }]
        }
    );
    return Run;
};
