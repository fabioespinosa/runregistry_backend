const fs = require('fs');
const Sequelize = require('sequelize');
const path = require('path');

module.exports = (sequelize, DataTypes) => {
    const RunView = sequelize.define(
        'Run',
        {
            run_number: { type: DataTypes.INTEGER, primaryKey: true },
            oms_attributes: { type: DataTypes.JSONB },
            rr_attributes: { type: DataTypes.JSONB }
        },
        { timestamps: false }
    );

    RunView.sync = options => {
        const viewPath = path.resolve(__dirname, '../views/run.sql');
        const file = fs.readFileSync(viewPath, { encoding: 'utf-8' });
        sequelize.query(file);
        return null;
    };
    RunView.drop = async options => {
        return sequelize.query('DROP VIEW IF EXISTS Run', {
            logging: options.logging
        });
    };

    return RunView;
};
