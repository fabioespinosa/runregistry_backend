const getObjectWithAttributesThatChanged = require('get-object-with-attributes-that-changed');
const { Event, RunEvent, Run } = require('../models');

// exports.new = async (req, res) => {
//     await sequelize.query(`
//     BEGIN TRANSACTION;
//     INSERT INTO "Event" ("createdAt", "by") VALUES (now(), 'hello');
//     INSERT INTO "Run" ("runnumber", "class", "rundata") VALUES('${
//         req.body.runnumber
//     }', '${req.body.class}', '${JSON.stringify(req.body)}');
//     COMMIT;
//     `);
// };

exports.getAll = async (req, res) => {
    const runs = await Run.findAll();
    res.json(runs);
};

exports.getOne = async (req, res) => {
    const run = await Run.findByPk(req.params.run_number);
    res.json(run);
};

exports.get50 = async (req, res) => {
    const runs = await Run.findAll();
    res.json(runs);
};

exports.new = async (req, res) => {
    // TODO: make it into a transaction
    const event = await Event.build({
        by: req.get('email'),
        comment: 'automatic - OMS'
    }).save();
    const runEvent = await RunEvent.build({
        run_number: +req.body.run_number,
        metadata: req.body,
        version: event.version
    }).save();
    res.json(runEvent);
};

// This edits or updates the run
// The new_attributes are a collection of the attributes that changed with respect to the run
exports.edit = async (req, res) => {
    const run = await Run.findByPk(req.params.run_number);
    const new_attributes = getObjectWithAttributesThatChanged(
        run.dataValues,
        req.body
    );
    req.body = new_attributes;
    exports.new(req, res);
};
