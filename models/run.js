module.exports = (sequelize, DataTypes) => {
    const Run = sequelize.define(
        'Run',
        {
            run_number: { type: DataTypes.INTEGER, primaryKey: true },
            oms_attributes: { type: DataTypes.JSONB },
            rr_attributes: { type: DataTypes.JSONB },
            version: { type: DataTypes.INTEGER }
        },
        {
            timestamps: false,
            indexes: [{ name: 'Run_version_index', fields: ['version'] }]
        }
    );
    return Run;
};
