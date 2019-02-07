const axios = require('axios');
const getObjectWithAttributesThatChanged = require('get-object-with-attributes-that-changed');
const changeNameOfAllKeys = require('change-name-of-all-keys');

const Sequelize = require('../models').Sequelize;
const { OMS_URL, OMS_SPECIFIC_RUN } = require('../config/config')[
    process.env.ENV || 'development'
];
const { update_runs } = require('../cron/2.save_or_update_runs');
const { Run, Event, RunEvent } = require('../models');

const { Op } = Sequelize;
const conversion_operator = {
    and: Op.and,
    or: Op.or,
    '>': Op.gt,
    '<': Op.lt,
    '>=': Op.gte,
    '<=': Op.lte,
    like: Op.iLike,
    notlike: Op.notLike,
    '=': Op.eq,
    '<>': Op.ne,
    // In uppercase as well:
    AND: Op.and,
    OR: Op.or,
    LIKE: Op.iLike,
    NOTLIKE: Op.notLike
};

exports.getAll = async (req, res) => {
    const runs = await Run.findAll({
        order: [['run_number', 'DESC']]
    });
    res.json(runs);
};

exports.getOne = async (req, res) => {
    const run = await Run.findByPk(req.params.run_number);
    res.json(run);
};

exports.get50 = async (req, res) => {
    const runs = await Run.findAll({
        order: [['run_number', 'DESC']],
        limit: 50
    });
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
    if (run === null) {
        throw 'Run not found';
    }
    const { oms_attributes, rr_attributes } = run.dataValues;
    if (rr_attributes.state !== 'OPEN') {
        throw 'Run must be in state OPEN to be edited';
    }

    // Significant and state are attributes that are to be moved manually in either markSignificant or moveRun
    delete req.body.rr_attributes.significant;
    delete req.body.rr_attributes.state;

    const new_oms_attributes = getObjectWithAttributesThatChanged(
        oms_attributes,
        req.body.oms_attributes
    );
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
        res.status(400);
        res.json({
            err: 'Nothing to update'
        });
    }
};

exports.markSignificant = async (req, res) => {
    const event = await Event.build({
        by: req.get('email'),
        comment: req.get('comment')
    }).save();
    const runEvent = await RunEvent.build({
        run_number: +req.body.original_run.run_number,
        oms_metadata: {},
        rr_metadata: { significant: true },
        version: event.version
    }).save();
    req.params.id_run = req.body.original_run.run_number;

    await exports.refreshRunClassAndComponents(req, res);
};

exports.refreshRunClassAndComponents = async (req, res) => {
    const { id_run } = req.params;
    const email = `auto - refresh by ${req.get('email')}`;
    const previously_saved_run = await Run.findByPk(id_run);
    if (previously_saved_run.rr_attributes.state !== 'OPEN') {
        throw 'Run must be in state OPEN to be refreshed';
    }
    const {
        data: { data: fetched_run }
    } = await axios.get(`${OMS_URL}/${OMS_SPECIFIC_RUN(id_run)}`);
    await update_runs([fetched_run[0].attributes], email, true);
    const saved_run = await Run.findByPk(id_run);
    res.json(saved_run);
};

// TODO:

exports.moveRun = async (req, res) => {
    const { to_state } = req.params;
    if (!['SIGNOFF', 'OPEN', 'COMPLETED'].includes(to_state)) {
        throw 'The final state state must be SIGNOFF, OPEN OR COMPLETED';
    }
    const { run_number } = req.body.original_run;
    const run = await Run.findByPk(run_number);
    // Check if triplets are empty quotes:
    for (const [run_property, value] of Object.entries(
        run.dataValues.rr_attributes
    )) {
        if (run_property.includes('_triplet')) {
            if (
                to_state === 'SIGNOFF' &&
                (value.status === 'NO VALUE FOUND' || value.status === '')
            ) {
                throw `The status of ${
                    run_property.split('_triplet')[0]
                } must not be empty`;
            }
        }
    }
    // Check if run class is empty:
    if (run.dataValues.rr_attributes.class === '') {
        throw 'The class of run must not be empty ';
    }

    const event = await Event.build({
        by: req.get('email'),
        comment: req.get('comment')
    }).save();
    const runEvent = await RunEvent.build({
        run_number: +run_number,
        oms_metadata: {},
        rr_metadata: { state: to_state },
        version: event.version
    }).save();

    const saved_run = await Run.findByPk(run_number);
    res.json(saved_run.dataValues);

    // TODO TODO TODO
    // PUT DATASET IN WAITING LIST IS NOT YET DONE IN BLOCKCHAIN RR
    // MOVE IT TO OFFLINE WAITING LIST: (create the waiting run )
    //if (to_state === 'SIGNOFF' || to_state === 'COMPLETED') {
    //    create_offline_waiting_dataset(moved_run.dataValues);
    //}
};

exports.getFilteredOrdered = async (req, res) => {
    const { sortings, page_size } = req.body;
    let filter = changeNameOfAllKeys(req.body.filter, conversion_operator);
    const { page } = req.params;
    const { count } = await Run.findAndCountAll({ where: filter });
    let pages = Math.ceil(count / page_size);
    let offset = page_size * page;
    const runs = await Run.findAll({
        where: filter,
        order: sortings.length > 0 ? sortings : [['run_number', 'DESC']],
        limit: page_size,
        offset
    });
    res.json({ runs, pages });
};

exports.significantRunsFilteredOrdered = async (req, res) => {
    let filter = {
        ...changeNameOfAllKeys(req.body.filter, conversion_operator),
        'rr_attributes.significant': true
    };
    let { sortings } = req.body;
    const { page_size } = req.body;
    const { page } = req.params;
    const { count } = await Run.findAndCountAll({
        where: filter
    });
    let pages = Math.ceil(count / page_size);
    let offset = page_size * page;
    const runs = await Run.findAll({
        where: filter,
        order: sortings.length > 0 ? sortings : [['run_number', 'DESC']],
        limit: page_size,
        offset
    });
    res.json({ runs, pages });
};
