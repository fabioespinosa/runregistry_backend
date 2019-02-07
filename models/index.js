const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const config = require('../config/config')[process.env.ENV || 'development'];

const { database, username, password } = config;
const sequelize = new Sequelize(database, username, password, config);

const db = {};

fs.readdirSync(__dirname)
    .filter(function(file) {
        return file.indexOf('.') !== 0 && file !== 'index.js';
    })
    .forEach(function(file) {
        const model = sequelize.import(path.join(__dirname, file));
        db[model.name] = model;
    });

Object.keys(db).forEach(function(modelName) {
    if ('associate' in db[modelName]) {
        db[modelName].associate(db);
    }
});

// Auto invoking initialize function:
(async () => {
    try {
        await sequelize.query(
            `GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA "public" to "${
                config.username
            }"`
        );
        console.log(
            'Permissions granted on all tables to SELECT and INSERT. DELETE and UPDATE are not permited (this is intended behavior of RR)'
        );

        // Initialize data:
        const insert_1_into_lists = [
            'INSERT INTO "ClassClassifierList" ("id") VALUES (1);',
            'INSERT INTO "ComponentClassifierList" ("id") VALUES (1);',
            'INSERT INTO "DatasetClassifierList" ("id") VALUES (1);',
            'INSERT INTO "OfflineDatasetClassifierList" ("id") VALUES (1);',
            'INSERT INTO "PermissionList" ("id") VALUES (1);',
            'INSERT INTO "DatasetsAcceptedList" ("id") VALUES (1);'
        ];
        const insert_1_into_lists_promises = insert_1_into_lists.map(query => {
            return sequelize.query(query).catch(err => {
                // It is normal that an error exists since the value most likely exists, so we catch it and don't throw it.
            });
        });
        await Promise.all(insert_1_into_lists_promises);

        const result = await sequelize.query('SELECT * FROM "Settings"');
        const settings = result[0];
        if (settings.length === 0) {
            // If Settings are empty, we need to fill them with highest id in all tables:
            await sequelize.query(`
                INSERT INTO "Settings" (id, metadata, "createdAt","CCL_id", "CPCL_id", "DCL_id","ODCL_id", "PL_id", "DAL_id")
                VALUES 
                (
                (SELECT COALESCE((SELECT MAX("id") from "Settings"), 0)+1),
                '{"comment":"First row created automatically because of no setting previously created"}', 
                '2019-02-05 12:54:48.779-05',
                (SELECT MAX("id") FROM "ClassClassifierList"),
                (SELECT MAX("id") FROM "ComponentClassifierList"),
                (SELECT MAX("id") FROM "DatasetClassifierList"),
                (SELECT MAX("id") FROM "OfflineDatasetClassifierList"),
                (SELECT MAX("id") FROM "PermissionList"),
                (SELECT MAX("id") FROM "DatasetsAcceptedList")
                );
                `);
            console.log('Settings Table was empty');
        }
    } catch (err) {
        console.log('Error initializing schema');
        if (err.message === 'relation "Settings" does not exist');
        {
            console.log(
                'ERROR: Try running again, table Settings was not created yet, it should be created by now, and running it again should show no errors'
            );
        }
    }
})();

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
