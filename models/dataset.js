module.exports = (sequelize, DataTypes) => {
    const Cycle = sequelize.define(
        'Cycle',
        {
            id_cycle: { type: DataTypes.INTEGER, primaryKey: true },
            // TODO: should we put a foreign key to table RUN
            run_attributes: { type: DataTypes.JSONB },
            cycle_attributes: { type: DataTypes.JSONB },
            version: { type: DataTypes.INTEGER }
        },
        {
            timestamps: false,
            indexes: [{ name: 'Cycle_version_index', fields: ['version'] }]
        }
    );
    return Cycle;
};
