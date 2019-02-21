module.exports = (sequelize, DataTypes) => {
    const LumisectionEvent = sequelize.define(
        'LumisectionEvent',
        {
            version: {
                primaryKey: true,
                type: DataTypes.INTEGER,
                autoIncrement: true
            },
            run_number: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            name: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            lumisection_metadata: {
                type: DataTypes.JSONB,
                allowNull: false
            }
        },
        {
            timestamps: false,
            indexes: [
                {
                    name: 'LumisectionEvent_datasetReference_index',
                    fields: ['run_number', 'name']
                }
            ]
        }
    );
    LumisectionEvent.associate = function(models) {
        LumisectionEvent.belongsTo(models.Event, { foreignKey: 'version' });
        LumisectionEvent.hasMany(models.LumisectionEventAssignation, {
            foreignKey: 'version'
        });
        // THE FOLLOWING 3 LINES ARE NOT YET SUPPORTED IN SEQUELIZE, WE HAVE TO INITIALIZE THE COMPOUND FOREIGN KEY TO DATASET IN initialization/initialize.js file
        // LumisectionEvent.belongsTo(models.Dataset, {
        //     foreignKey: ['run_number','name']
        // })
    };

    return LumisectionEvent;
};
