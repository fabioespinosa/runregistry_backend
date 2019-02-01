const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const config = require('../config/config')['development'];

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

sequelize
    .query(
        `GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA "public" to "${
            config.username
        }"`
    )
    .then(result => {
        console.log('Permissions granted on all tables to SELECT and INSERT');
    })
    .catch(err => {
        console.log('ERROR assigning permissinos:', err);
    });

// sequelize.query(
//     `
//     CREATE TABLE IF NOT EXISTS "Event" (
//         version SERIAL PRIMARY KEY,

//         -- version meta data
//         "createdAt" TIMESTAMP,
//         by TEXT,
//         comment TEXT
//     );

// CREATE TABLE IF NOT EXISTS "RunEvent" (
//     version INTEGER REFERENCES "Event"(version) PRIMARY KEY,
//     --actual ID(refers to current version)
//     runnumber INTEGER NOT NULL,

//     --data changed in current version(needs to be accumulated)
//     class TEXT,
//     rundata JSONB NOT NULL
// );

// `
// );
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
