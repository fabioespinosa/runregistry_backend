module.exports = (sequelize, DataTypes) => {
    const JSONBDeduplication = sequelize.define(
        'JSONBDeduplication',
        {
            id: {
                primaryKey: true,
                type: DataTypes.INTEGER,
                autoIncrement: true
            },
            jsonb: {
                type: DataTypes.JSONB,
                allowNull: false,
                unique: true
            }
        },
        {
            timestamps: false
        },
        {
            indexes: [
                {
                    name: 'JSONBDeduplication_jsonb_index',
                    fields: ['jsonb']
                }
            ]
        }
    );
    return JSONBDeduplication;
};
