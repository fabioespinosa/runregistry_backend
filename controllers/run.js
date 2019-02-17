const axios = require('axios');
const getObjectWithAttributesThatChanged = require('get-object-with-attributes-that-changed');
const changeNameOfAllKeys = require('change-name-of-all-keys');

const Sequelize = require('../models').Sequelize;
const sequelize = require('../models').sequelize;
const { OMS_URL, OMS_SPECIFIC_RUN } = require('../config/config')[
    process.env.ENV || 'development'
];
const { update_runs } = require('../cron/2.save_or_update_runs');
const { Run, Event, RunEvent } = require('../models');

const update_or_create_run = async (
    run_number,
    oms_metadata,
    rr_metadata,
    req
) => {
    run_number = +run_number;
    const by = req.get('email');
    const comment = req.get('comment');
    if (!by) {
        throw "The email of the author's action should be stated in request's header 'email'";
    }
    // Start transaction:
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const event = await Event.create(
            {
                by,
                comment
            },
            { transaction }
        );

        const runEvent = await RunEvent.create(
            {
                run_number,
                oms_metadata,
                rr_metadata,
                version: event.version
            },
            { transaction }
        );
        // update the Run table
        await sequelize.query(
            `
                CREATE TEMPORARY TABLE updated_runnumbers as SELECT DISTINCT "run_number" from "RunEvent" where "RunEvent"."version" > (SELECT COALESCE((SELECT MAX("version") from "Run"), 0));
                CREATE TEMPORARY TABLE updated_runs as SELECT * FROM "RunEvent"
                WHERE "RunEvent"."run_number" IN (
                    SELECT * from updated_runnumbers
                );

                INSERT INTO "Run" (run_number, rr_attributes, oms_attributes, "version")
                SELECT run_number,
                        mergejsonb(rr_metadata ORDER BY version),
                        mergejsonb(oms_metadata ORDER BY version),
                        (SELECT max(version) FROM "RunEvent" ) AS "version"
                FROM updated_runs
                GROUP BY run_number
                ON CONFLICT (run_number) DO UPDATE SET "rr_attributes" = EXCLUDED."rr_attributes", "oms_attributes" = EXCLUDED."oms_attributes", version = EXCLUDED.version;
            
                DROP TABLE updated_runnumbers;
                DROP TABLE updated_runs;
        `,
            { transaction }
        );
        await transaction.commit();
        return runEvent;
    } catch (err) {
        // Rollback transaction if any errors were encountered
        console.log(err);
        await transaction.rollback();
        throw {
            err: `Error updating/saving run ${run_number}, ${err.message}`
        };
    }
};

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

exports.getRunWithHistory = async (req, res) => {
    let run_events = await RunEvent.findAll({
        where: {
            run_number: req.params.run_number
        },
        order: [['version', 'ASC']],
        include: [{ model: Event }]
    });
    run_events = run_events.map(
        ({ oms_metadata, rr_metadata, run_number, version, Event }) => ({
            ...oms_metadata,
            ...rr_metadata,
            run_number,
            version,
            ...Event.dataValues
        })
    );
    res.json(run_events);
};

exports.new = async (req, res) => {
    // TODO: make it into a transaction
    // TODO: validate run attributes
    const { oms_attributes, rr_attributes } = req.body;
    const { run_number } = oms_attributes;
    const run = await Run.findByPk(run_number);
    if (run !== null) {
        throw 'Run already exists';
    }
    const runEvent = await update_or_create_run(
        run_number,
        oms_attributes,
        rr_attributes,
        req
    );
    res.json(runEvent);
};

// This edits or updates the run
// The new_attributes are a collection of the attributes that changed with respect to the run
exports.edit = async (req, res) => {
    const { run_number } = req.params;
    const run = await Run.findByPk(run_number);
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

    // Validate that all rr_attributes which changed the triplets contain comment, status and cause:
    for (const [key, val] of Object.entries(new_rr_attributes)) {
        if (key.includes('_triplet')) {
            const { status, comment, cause } = new_rr_attributes[key];
            if (
                typeof status === 'undefined' ||
                typeof comment === 'undefined' ||
                typeof cause === 'undefined'
            ) {
                throw 'Neither State, Comment or Cause can be undefined';
            }
        }
    }

    const new_oms_attributes_length = Object.keys(new_oms_attributes).length;
    const new_rr_attributes_length = Object.keys(new_rr_attributes).length;
    // If there was actually something to update:

    if (new_oms_attributes_length + new_rr_attributes_length > 0) {
        const runEvent = await update_or_create_run(
            run_number,
            new_oms_attributes,
            new_rr_attributes,
            req
        );
        const { oms_metadata, rr_metadata } = runEvent;
        run.dataValues.oms_attributes = { ...oms_attributes, ...oms_metadata };
        run.dataValues.rr_attributes = { ...rr_attributes, ...rr_metadata };
        res.json(run.dataValues);
    } else {
        throw 'Nothing to update, the attributes sent are the same as those in the run already stored';
    }
};

exports.markSignificant = async (req, res) => {
    const { run_number } = req.body.original_run;
    const run = await Run.findByPk(run_number);
    if (run.rr_attributes.significant === true) {
        throw 'Run is already significant';
    }

    const oms_metadata = {};
    const rr_metadata = { significant: true };
    await update_or_create_run(run_number, oms_metadata, rr_metadata, req);
    res.json(run);
    req.params.run_number = +run_number;
    try {
        await exports.refreshRunClassAndComponents(req, res);
    } catch (e) {
        // We refresh the run automatically after making a run significant, it will mark an error because it will try to setheadrs of a request which is already sent
    }
};

exports.refreshRunClassAndComponents = async (req, res) => {
    const { run_number } = req.params;
    const email = `auto - refresh by ${req.get('email')}`;
    const previously_saved_run = await Run.findByPk(run_number);
    if (previously_saved_run.rr_attributes.state !== 'OPEN') {
        throw 'Run must be in state OPEN to be refreshed';
    }
    const {
        data: { data: fetched_run }
    } = await axios.get(`${OMS_URL}/${OMS_SPECIFIC_RUN(run_number)}`);
    await update_runs([fetched_run[0].attributes], email, true);
    const saved_run = await Run.findByPk(run_number);
    res.json(saved_run);
};

// TODO: finish moveRun creation of dataset

exports.moveRun = async (req, res) => {
    const { to_state } = req.params;
    const { run_number } = req.body.original_run;
    const run = await Run.findByPk(run_number);
    // Validation
    if (!['SIGNOFF', 'OPEN', 'COMPLETED'].includes(to_state)) {
        throw 'The final state must be SIGNOFF, OPEN OR COMPLETED, no other option is valid';
    }
    if (run.rr_attributes.state === to_state) {
        throw `Run's state is already in state ${to_state}`;
    }
    //      Check if triplets are empty quotes:
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
    //      Check if run class is empty:
    if (run.dataValues.rr_attributes.class === '') {
        throw 'The class of run must not be empty ';
    }
    // End validation
    const oms_metadata = {};
    const rr_metadata = { state: to_state };
    await update_or_create_run(run_number, oms_metadata, rr_metadata, req);
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
    let offset = page_size * page;
    const count = await Run.count({ where: filter });
    let pages = Math.ceil(count / page_size);
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
    const count = await Run.count({
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
