const axios = require('axios');
const getObjectWithAttributesThatChanged = require('get-object-with-attributes-that-changed');
const changeNameOfAllKeys = require('change-name-of-all-keys');

const Sequelize = require('../models').Sequelize;
const sequelize = require('../models').sequelize;

const { OMS_URL, OMS_SPECIFIC_RUN } = require('../config/config')[
    process.env.ENV || 'development'
];
const {
    create_oms_lumisections,
    create_rr_lumisections,
    update_oms_lumisections,
    update_rr_lumisections,
    get_rr_lumisections_for_dataset
} = require('./lumisection');
const { update_or_create_dataset } = require('./dataset');
const { fill_dataset_triplet_cache } = require('./dataset_triplet_cache');
const { manually_update_a_run } = require('../cron/2.save_or_update_runs');
const {
    create_offline_waiting_datasets
} = require('../cron_datasets/1.create_datasets');
const {
    Run,
    Dataset,
    DatasetTripletCache,
    Event,
    RunEvent
} = require('../models');

const update_or_create_run = async (
    run_number,
    oms_metadata,
    rr_metadata,
    req,
    transaction
) => {
    run_number = +run_number;
    const by = req.email || req.get('email');
    const comment = req.comment || req.get('comment');
    if (!by) {
        throw "The email of the author's action should be stated in request's header 'email'";
    }
    // Start transaction:
    let local_transaction = false;
    try {
        if (typeof transaction === 'undefined') {
            local_transaction = true;
            transaction = await sequelize.transaction();
        }
        const event = await Event.create(
            {
                by,
                comment
            },
            { transaction }
        );
        let manual_change = false;
        // If the email is not auto@auto, it means it was a manual change, therefore later on, when we order changes, we give priority to the manual change
        if (!by.startsWith('auto@auto')) {
            manual_change = true;
            if (Object.keys(oms_metadata).length !== 0) {
                throw 'Manual change must have empty oms_metadata';
            }
        }
        const runEvent = await RunEvent.create(
            {
                run_number,
                oms_metadata,
                rr_metadata,
                version: event.version,
                deleted: false,
                manual_change
            },
            { transaction }
        );
        // update the Run table, we are creating temporary tables to prevent the postgres optimizer to do unnecessary scans of whole table
        // The ORDER BY in mergejsonb first orders by manual_change (shifters actions overwrite automatic changes )
        await sequelize.query(
            `
                CREATE TEMPORARY TABLE updated_runnumbers as SELECT DISTINCT "run_number" from "RunEvent" where "RunEvent"."version" > (SELECT COALESCE((SELECT MAX("version") from "Run"), 0));
                CREATE TEMPORARY TABLE updated_runs as SELECT * FROM "RunEvent"
                WHERE "RunEvent"."run_number" IN (
                    SELECT * from updated_runnumbers
                );

                INSERT INTO "Run" (run_number, rr_attributes, oms_attributes, deleted, "version")
                SELECT run_number,
                        mergejsonb(rr_metadata ORDER BY manual_change, version),
                        mergejsonb(oms_metadata ORDER BY version),
                        (SELECT deleted from "RunEvent" WHERE "version" = (SELECT max(version) FROM updated_runs)) AS "deleted",
                        (SELECT max(version) FROM "RunEvent" ) AS "version"
                FROM updated_runs
                GROUP BY run_number
                ON CONFLICT (run_number) DO UPDATE SET "rr_attributes" = EXCLUDED."rr_attributes", "oms_attributes" = EXCLUDED."oms_attributes", "deleted" = EXCLUDED."deleted", "version" = EXCLUDED.version;

                DROP TABLE updated_runnumbers;
                DROP TABLE updated_runs;
        `,
            { transaction }
        );
        if (local_transaction) {
            await transaction.commit();
        }
        return runEvent;
    } catch (err) {
        // Rollback transaction if any errors were encountered
        console.log(err);
        if (local_transaction) {
            await transaction.rollback();
        }
        throw `Error updating/saving run ${run_number}, ${err.message}`;
    }
};
exports.update_run = update_or_create_run;

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
    const run = await Run.findByPk(req.params.run_number, {
        include: [
            {
                model: DatasetTripletCache,
                attributes: ['triplet_summary']
            }
        ]
    });
    res.json(run);
};

exports.getLastUpdated50 = async (req, res) => {
    const runs = await Run.findAll({
        order: [['oms_attributes.last_update', 'DESC']],
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
    // TODO: validate run attributes
    const {
        oms_attributes,
        rr_attributes,
        oms_lumisections,
        rr_lumisections
    } = req.body;
    const { run_number } = oms_attributes;
    const run = await Run.findByPk(run_number);
    if (run !== null) {
        throw 'Run already exists';
    }
    let transaction;
    try {
        const transaction = await sequelize.transaction();
        const runEvent = await update_or_create_run(
            run_number,
            oms_attributes,
            rr_attributes,
            req,
            transaction
        );
        const datasetEvent = await update_or_create_dataset(
            'online',
            run_number,
            {},
            req,
            transaction
        );
        if (rr_lumisections.length > 0 || oms_lumisections.length > 0) {
            const saved_oms_lumisections = await create_oms_lumisections(
                run_number,
                'online',
                oms_lumisections,
                req,
                transaction
            );

            const saved_rr_lumisections = await create_rr_lumisections(
                run_number,
                'online',
                rr_lumisections,
                req,
                transaction
            );
        }
        await transaction.commit();
        // You can only fill the cache when transaction has commited:
        await fill_dataset_triplet_cache();
        res.json(runEvent);
    } catch (err) {
        console.log(err);
        await transaction.rollback();
        throw `Error saving run ${run_number}`;
    }
};

// This updates the run (triggered by an OMS update) not to be confused with an manual edition of a run
// The new_attributes are a collection of the attributes that changed with respect to the run
exports.automatic_run_update = async (req, res) => {
    const { run_number } = req.params;

    const run = await Run.findByPk(run_number);
    if (run === null) {
        throw 'Run not found';
    }
    const { oms_attributes, rr_attributes } = run.dataValues;
    if (rr_attributes.state !== 'OPEN') {
        throw 'Run must be in state OPEN to be edited';
    }
    let was_run_updated = false;
    let transaction;
    try {
        // If there was a change in the lumisections, we also update the dataset triplet cache

        transaction = await sequelize.transaction();
        // Lumisection stuff:
        const { oms_lumisections, rr_lumisections } = req.body;
        const newRRLumisectionRanges = await update_rr_lumisections(
            run_number,
            'online',
            rr_lumisections,
            req,
            transaction
        );
        if (newRRLumisectionRanges.length > 0) {
            // There was a change in the lumisections, so we should update oms lumisections as well:
            const newOMSLumisectionRange = await update_oms_lumisections(
                run_number,
                'online',
                oms_lumisections,
                req,
                transaction
            );
            // Bump the version in the dataset so the fill_dataset_triplet_cache will know that the lumisections inside it changed, and so can refill the cache:
            const datasetEvent = await update_or_create_dataset(
                'online',
                run_number,
                {},
                req,
                transaction
            );
            was_run_updated = true;
        }

        // Run stuff:

        const new_oms_attributes = getObjectWithAttributesThatChanged(
            oms_attributes,
            req.body.oms_attributes
        );
        const new_rr_attributes = getObjectWithAttributesThatChanged(
            rr_attributes,
            req.body.rr_attributes
        );
        const new_rr_attributes_length = Object.keys(new_rr_attributes).length;
        const new_oms_attributes_length = Object.keys(new_oms_attributes)
            .length;
        // If there was actually something to update in the RR attributes, we update it, if it was a change in oms_attributes, we don't update it (since it doesn't affect RR attributes)
        if (
            new_rr_attributes_length + new_oms_attributes_length > 0 ||
            was_run_updated
        ) {
            const runEvent = await update_or_create_run(
                run_number,
                new_oms_attributes,
                new_rr_attributes,
                req,
                transaction
            );
            was_run_updated = true;
            //  if there was a change with regards to the RR triplets, if so, save them, or if there was a change with regards to the Run attributes (class, state, significant then save as well the different lumisections)

            // await update_dataset... (which will be the same method to update dataset from OFFLINE)
            // Now that it is commited we should find the updated run:
            console.log(`updated run ${run_number}`);
        }
        await transaction.commit();
        await fill_dataset_triplet_cache();
        if (was_run_updated) {
            const run = await Run.findByPk(run_number, {
                include: [
                    {
                        model: DatasetTripletCache,
                        attributes: ['triplet_summary']
                    }
                ]
            });
            res.json(run.dataValues);
        } else {
            // Nothing changed:
            res.status(204);
            res.send();
        }
    } catch (err) {
        console.log(err);
        await transaction.rollback();
        throw `Error updating run ${run_number}`;
    }
};

// In order to update the lumisections, one does it directly in lumisection.js edit_rr_lumsiections
// For run (class, stop_reason) its here:
exports.manual_edit = async (req, res) => {
    const { run_number } = req.params;

    const run = await Run.findByPk(run_number);
    if (run === null) {
        throw 'Run not found';
    }
    const { rr_attributes } = run.dataValues;
    if (rr_attributes.state !== 'OPEN') {
        throw 'Run must be in state OPEN to be edited';
    }

    let transaction;
    try {
        transaction = await sequelize.transaction();
        const new_rr_attributes = getObjectWithAttributesThatChanged(
            rr_attributes,
            req.body.rr_attributes
        );
        const new_rr_attributes_length = Object.keys(new_rr_attributes).length;
        // If there was actually something to update in the RR attributes, we update it, if it was a change in oms_attributes, we don't update it (since it doesn't affect RR attributes)
        if (new_rr_attributes_length > 0) {
            const runEvent = await update_or_create_run(
                run_number,
                {},
                new_rr_attributes,
                req,
                transaction
            );
            //  if there was a change with regards to the RR triplets, if so, save them, or if there was a change with regards to the Run attributes (class, state, significant then save as well the different lumisections)

            // await update_dataset... (which will be the same method to update dataset from OFFLINE)
            // Now that it is commited we should find the updated run:
            console.log(`updated run ${run_number}`);
        }
        await transaction.commit();
        const run = await Run.findByPk(run_number, {
            include: [
                {
                    model: DatasetTripletCache,
                    attributes: ['triplet_summary']
                }
            ]
        });
        res.json(run.dataValues);
    } catch (err) {
        console.log(err);
        await transaction.rollback();
        throw `Error updating run ${run_number}`;
    }
};

exports.markSignificant = async (req, res) => {
    const { run_number } = req.body.original_run;
    const run = await Run.findByPk(run_number, {
        include: [
            {
                model: DatasetTripletCache,
                attributes: ['triplet_summary']
            }
        ]
    });
    if (run === null) {
        throw 'Run not found';
    }
    if (run.rr_attributes.state !== 'OPEN') {
        throw 'Run must be in state OPEN to be marked significant';
    }
    if (run.rr_attributes.significant === true) {
        throw 'Run is already significant';
    }

    const oms_metadata = {};
    const rr_metadata = { significant: true };
    await update_or_create_run(run_number, oms_metadata, rr_metadata, req);
    // We do this to make sure the LUMISECTIONS classification are there
    const email = req.get('email');
    await manually_update_a_run(run_number, {
        email,
        manually_significant: true,
        comment: `${email} marked run significant, component statuses refreshed`
    });
    res.json(run);
};

exports.refreshRunClassAndComponents = async (req, res) => {
    const { run_number } = req.params;
    const email = req.get('email');
    const previously_saved_run = await Run.findByPk(run_number);
    if (previously_saved_run === null) {
        throw 'Run not found';
    }
    if (previously_saved_run.rr_attributes.state !== 'OPEN') {
        throw 'Run must be in state OPEN to be refreshed';
    }

    await manually_update_a_run(run_number, {
        email,
        comment: `${email} requested refresh from OMS`
    });
    const saved_run = await Run.findByPk(run_number, {
        include: [
            {
                model: DatasetTripletCache,
                attributes: ['triplet_summary']
            }
        ]
    });
    res.json(saved_run);
};

exports.moveRun = async (req, res) => {
    const { to_state } = req.params;
    const { run_number } = req.body.original_run;
    const run = await Run.findByPk(run_number);
    // Validation
    if (!['SIGNOFF', 'OPEN', 'COMPLETED'].includes(to_state)) {
        throw 'The final state must be SIGNOFF, OPEN OR COMPLETED, no other option is valid';
    }
    if (run.rr_attributes.state === to_state) {
        throw `Run ${run_number} state is already in state ${to_state}`;
    }

    // Check if triplets are empty quotes:
    const rr_lumisections = await get_rr_lumisections_for_dataset(
        run_number,
        'online'
    );
    if (rr_lumisections.length === 0) {
        throw `There is no run lumisection data for run ${run_number}, therefore it cannot be signed off`;
    }
    // Check for NO VALUE FOUND lumisections:
    for (let i = 0; i < rr_lumisections.length; i++) {
        const current_lumisection = rr_lumisections[i];
        for (const [key, val] of Object.entries(current_lumisection)) {
            if (
                // Revise
                key.includes('-') &&
                (to_state === 'SIGNOFF' || to_state === 'COMPLETED')
            ) {
                if (
                    val.status === '' ||
                    val.status === 'EMPTY' ||
                    val.status === 'NO VALUE FOUND'
                ) {
                    const subsystem = key.split('-')[1];
                    const ls_position = i + 1;
                    // Revise:
                    throw `There is a ${
                        val.status === '' ? 'empty' : val.status
                    } lumisection at position ${ls_position} of this run in component ${subsystem}. Please wait until this component is updated automatically, or ask ${subsystem} expert, then change the value.`;
                }
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
    let transaction;
    try {
        transaction = await sequelize.transaction();
        await update_or_create_run(
            run_number,
            oms_metadata,
            rr_metadata,
            req,
            transaction
        );

        if (to_state === 'SIGNOFF' || to_state === 'COMPLETED') {
            await create_offline_waiting_datasets(run.dataValues, transaction);
        }
        await transaction.commit();
        await fill_dataset_triplet_cache();
        const saved_run = await Run.findByPk(run_number, {
            include: [
                {
                    model: DatasetTripletCache,
                    attributes: ['triplet_summary']
                }
            ]
        });
        res.json(saved_run.dataValues);
    } catch (e) {
        console.log(e);
        await transaction.rollback();
        throw `Error SIGNING OFF run, creating the datasets from run in OFFLINE`;
    }
};

// Separate filtering and count will make the UX much faster.
exports.getRunsFilteredOrdered = async (req, res) => {
    // A user can filter on triplets, or on any other field
    // If the user filters by triplets, then :
    let triplet_summary_filter = {};
    for (const [key, val] of Object.entries(req.body.filter)) {
        if (key.includes('triplet_summary')) {
            triplet_summary_filter[key] = val;
            delete req.body.filter[key];
        }
    }
    triplet_summary_filter = changeNameOfAllKeys(
        triplet_summary_filter,
        conversion_operator
    );

    const { sortings, page_size, page } = req.body;
    let filter = {
        ...changeNameOfAllKeys(req.body.filter, conversion_operator),
        deleted: false
    };
    let offset = page_size * page;
    let include = [
        {
            model: DatasetTripletCache,
            where: triplet_summary_filter,
            attributes: ['triplet_summary']
        }
    ];
    // findAndCountAll is slower than doing separate count, and filtering
    const count = await Run.count({
        where: filter,
        include
    });
    let pages = Math.ceil(count / page_size);
    let runs = await Run.findAll({
        where: filter,
        order: sortings.length > 0 ? sortings : [['run_number', 'DESC']],
        limit: page_size,
        offset,
        include
    });
    res.json({ runs, pages, count });
};

exports.getDatasetNamesOfRun = async (req, res) => {
    const { run_number } = req.params;
    const datasets = await Dataset.findAll({
        where: {
            run_number
        }
    });
    const unique_dataset_names_object = {};
    datasets.forEach(({ name }) => {
        unique_dataset_names_object[name] = name;
    });
    const unique_dataset_names = Object.keys(unique_dataset_names_object);
    res.json(unique_dataset_names);
};
