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
    // TODO: validate run attributes

    const event = await Event.build({
        by: req.get('email'),
        comment: req.get('comment') || 'run creation - appeared in OMS'
    }).save();
    const runEvent = await RunEvent.build({
        run_number: +req.body.oms_attributes.run_number,
        oms_metadata: req.body.oms_attributes || {},
        rr_metadata: req.body.rr_attributes || {},
        version: event.version
    }).save();
    res.json(runEvent);
};

// This edits or updates the run
// The new_attributes are a collection of the attributes that changed with respect to the run
exports.edit = async (req, res) => {
    const run = await Run.findByPk(req.params.run_number);
    const { oms_attributes, rr_attributes } = run.dataValues;
    const new_oms_attributes = getObjectWithAttributesThatChanged(
        oms_attributes,
        req.body.oms_attributes
    );
    if (rr_attributes.significant && !req.body.rr_attributes.significant) {
        throw 'Cannot turn a run which was significant into a run which is non-significant';
    }
    const new_rr_attributes = getObjectWithAttributesThatChanged(
        rr_attributes,
        req.body.rr_attributes
    );

    let comment = '';
    if (Object.keys(new_oms_attributes).length > 0) {
        comment = 'automatic update from OMS';
    }

    const attributes_updated_from_oms = Object.keys(new_oms_attributes).length;
    const attributes_updated_from_rr_attributes = Object.keys(new_rr_attributes)
        .length;
    // If there was actually something to update:
    if (
        attributes_updated_from_oms + attributes_updated_from_rr_attributes >
        0
    ) {
        const event = await Event.build({
            by: req.get('email'),
            comment: req.get('comment') || comment
        }).save();
        const runEvent = await RunEvent.build({
            run_number: +req.params.run_number,
            oms_metadata: new_oms_attributes || {},
            rr_metadata: new_rr_attributes || {},
            version: event.version
        }).save();
        res.json(runEvent);
    } else {
        res.status(500);
        res.json({ err: 'Nothing to update' });
    }
};
