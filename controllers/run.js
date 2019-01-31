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

exports.get = async (req, res) => {
    const runs = await Run.findAll();
    res.json(runs);
};

exports.get50 = async (req, res) => {
    res.json([]);
};

exports.new = async (req, res) => {
    // TODO: make it into a transaction
    const event = await Event.build({
        by: req.get('email'),
        comment: 'automatic - OMS'
    }).save();
    const runEvent = await RunEvent.build({
        run_number: req.body.run_number,
        metadata: req.body,
        version: event.version
    }).save();
    res.json(runEvent);
};

exports.update = async (req, res) => {};
