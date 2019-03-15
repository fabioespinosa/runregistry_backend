const changeNameOfAllKeys = require('change-name-of-all-keys');
const json_logic = require('json-logic-js');
const queue = require('async').queue;
const { offline_column_structure } = require('../config/config');
const Sequelize = require('../models').Sequelize;
const sequelize = require('../models').sequelize;
const {
    DatasetTripletCache,
    LumisectionEvent,
    LumisectionEventAssignation,
    Dataset,
    DatasetEvent,
    Event,
    Workspace,
    OfflineDatasetClassifier,
    Run
} = require('../models');
const { goOverDatasets } = require('./dataset_triplet_cache');
const { get_rr_lumisections_for_dataset } = require('./lumisection');

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

exports.update_or_create_dataset = async (
    dataset_name,
    run_number,
    dataset_metadata,
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

        const datasetEvent = await DatasetEvent.create(
            {
                name: dataset_name,
                run_number,
                dataset_metadata,
                version: event.version,
                deleted: false
            },
            { transaction }
        );
        // update the Dataset table
        await sequelize.query(
            `
                CREATE TEMPORARY TABLE updated_dataset_references as SELECT DISTINCT run_number, name from "DatasetEvent" where "DatasetEvent"."version" > (SELECT COALESCE((SELECT MAX("version") from "Dataset"), 0));

                CREATE TEMPORARY TABLE updated_datasets as SELECT "DatasetEvent".* FROM "DatasetEvent" 
                INNER JOIN updated_dataset_references ON "DatasetEvent"."run_number" = updated_dataset_references."run_number" AND "DatasetEvent"."name" = updated_dataset_references."name";

                INSERT INTO "Dataset" (run_number, name, dataset_attributes , deleted, "version")
                SELECT  run_number, 
                        name,
                        mergejsonb(dataset_metadata ORDER BY version),
                        (SELECT deleted from "DatasetEvent" WHERE "version" = (SELECT max(version) FROM updated_datasets AS "deleted")),
                        (SELECT max(version) FROM "DatasetEvent" ) AS "version"
                FROM updated_datasets
                GROUP BY (run_number, name)
                ON CONFLICT ("run_number", "name") DO UPDATE SET "run_number"=EXCLUDED."run_number", "name"=EXCLUDED."name", "dataset_attributes" = EXCLUDED."dataset_attributes", "deleted" = EXCLUDED."deleted", "version" = EXCLUDED."version";

                DROP TABLE updated_dataset_references;
                DROP TABLE updated_datasets;
        `,
            { transaction }
        );
        if (local_transaction) {
            await transaction.commit();
        }
        return datasetEvent;
    } catch (err) {
        // Rollback transaction if any errors were encountered
        console.log(err);
        if (local_transaction) {
            await transaction.rollback();
        }
        throw `Error updating/saving dataset ${dataset_name} of run: ${run_number}, ${
            err.message
        }`;
    }
};

exports.getDatasets = async (req, res) => {
    // const datasets = await Dataset.findAll();
    // res.json(datasets);
};

exports.getDataset = async (req, res) => {
    const dataset = await Dataset.findByPk(req.params.id_dataset);
    res.json(dataset);
};

exports.getDatasetsWaiting = async (req, res) => {
    const datasets = await Dataset.findAll({
        where: {
            // DO NOT CHANGE THE FOLLOWING LINE AS APPLICATION LOGIC RELIES ON IT:
            'global_state.value': 'waiting dqm gui'
        }
    });
    res.json(datasets);
};
exports.getDatasetsWaitingDBS = async (req, res) => {
    const datasets = await Dataset.findAll({
        where: {
            // DO NOT CHANGE THE FOLLOWING LINE AS APPLICATION LOGIC RELIES ON IT:
            [Op.or]: [
                { 'appeared_in.value': '' },
                { 'appeared_in.value': 'DQM GUI' }
            ]
        }
    });
    res.json(datasets);
};

exports.getSpecificWorkspace = async (req, res) => {
    const columns = await Workspace.findAll({
        where: {
            pog: req.params.pog
        }
    });
    const datasets = await Dataset.findAll({
        include: [req.params.pog, ...columns]
    });
    res.json(datasets);
};

exports.appearedInDBS = async (req, res) => {
    const { id } = req.body;
    const dataset = await Dataset.findByPk(id);
    if (dataset.appeared_in.value.includes('DBS')) {
        throw 'already marked as appeared';
    }
    dataset.appeared_in = changeHistory(
        dataset.appeared_in,
        {
            value:
                // If the value is empty, put DBS, else, add it by ',' separation:
                dataset.appeared_in.value === ''
                    ? 'DBS'
                    : `${dataset.appeared_in.value}, DBS`
        },
        'auto (dbs trigger)'
    );
    const saved_dataset = await dataset.save();
    res.json(saved_dataset);
};
// If a dataset appeared in DQM GUI we must mark it open inmediately (we must changed )
exports.appearedInDQMGUI = async (req, res) => {
    const { id } = req.body;
    const dataset = await Dataset.findByPk(id);
    const author_dqm_gui_trigger = 'auto (dqm gui trigger)';
    const author_dataset_classifier = 'auto (dataset classifier)';
    if (dataset.appeared_in.value.includes('DQM GUI')) {
        throw 'already marked as appeared';
    }
    dataset.appeared_in = changeHistory(
        dataset.appeared_in,
        {
            value:
                // If the value is empty, put DQM GUI, else, add it by ',' separation:
                dataset.appeared_in.value === ''
                    ? 'DQM GUI'
                    : `${dataset.appeared_in.value}, DQM GUI`
        },
        author_dqm_gui_trigger
    );
    // TODO: Check classifier if the run needs to  see if a run passes to certification:
    const dataset_classifiers = await OfflineDatasetClassifier.findAll();
    dataset_classifiers.forEach(dataset_classifier => {
        const classifier = dataset_classifier.dataValues.classifier;
        const significant = json_logic.apply(classifier, dataset);
        const workspace = dataset_classifier.dataValues.workspace;
        if (significant === 'CREATE_DATASET') {
            dataset[`${workspace}_state`] = changeHistory(
                dataset[`${workspace}_state`],
                { value: 'OPEN' },
                author_dataset_classifier
            );
        }
        if (significant === 'IRRELEVANT') {
            dataset[`${workspace}_state`] = changeHistory(
                dataset[`${workspace}_state`],
                { value: 'OPEN' },
                author_dataset_classifier
            );
        }
    });
    const saved_dataset = await dataset.save();
    res.json(saved_dataset);
};

exports.getFilteredOrdered = async (req, res) => {
    const { workspace, page } = req.params;
    const { sortings, page_size } = req.body;
    let filter = changeNameOfAllKeys(
        {
            // Online is the dataset we show in Online RR, we don't want to show it here:
            name: { '<>': 'online' },
            [`dataset_attributes.${workspace}_state`]: {
                and: [
                    { '<>': 'OPEN' },
                    { '<>': 'SIGNOFF' },
                    { '<>': 'COMPLETED' }
                ]
            },
            ...req.body.filter
        },
        conversion_operator
    );
    // If its filtering by run class, then include it in run class
    let include = [
        {
            model: Run,
            attributes: ['rr_attributes']
        },
        {
            model: DatasetTripletCache,
            attributes: ['triplet_summary']
        }
    ];
    if (typeof filter['class'] !== 'undefined') {
        include[0].where = { 'rr_attributes.class': filter['class'] };
        delete filter['class'];
    }
    const count = await Dataset.count({
        where: filter,
        include
    });
    let pages = Math.ceil(count / page_size);
    let offset = page_size * page;
    let datasets = await Dataset.findAll({
        where: filter,
        order: sortings.length > 0 ? sortings : [['run_number', 'DESC']],
        limit: page_size,
        offset,
        include
    });
    res.json({ datasets, pages });
};

exports.getFilteredOrderedSignificant = async (req, res) => {
    const { workspace, page } = req.params;
    const { sortings, page_size } = req.body;
    let filter = changeNameOfAllKeys(
        {
            name: { '<>': 'online' },
            // ONLY THOSE OPEN SIGNOFF OR COMPLETED ARE SHOWN IN EDITABLE
            [`dataset_attributes.${workspace}_state`]: {
                or: [{ '=': 'OPEN' }, { '=': 'SIGNOFF' }, { '=': 'COMPLETED' }]
            },
            ...req.body.filter
        },
        conversion_operator
    );
    // If its filtering by run class, then include it in run filter
    let include = [
        {
            model: Run,
            attributes: ['rr_attributes']
        },
        {
            model: DatasetTripletCache,
            attributes: ['triplet_summary']
        }
    ];
    if (typeof filter['class'] !== 'undefined') {
        include[0].where = { 'rr_attributes.class': filter['class'] };
        delete filter['class'];
    }
    const { count } = await Dataset.findAndCountAll({
        where: filter,
        include
    });
    let pages = Math.ceil(count / page_size);
    let offset = page_size * page;
    let datasets = await Dataset.findAll({
        where: filter,
        order: sortings.length > 0 ? sortings : [['run_number', 'DESC']],
        limit: page_size,
        offset,
        include
    });
    res.json({ datasets, pages });
};

// Move manually a dataset from client:
exports.moveDataset = async (req, res) => {
    const { id_dataset, workspace, state } = req.body;
    const dataset = await Dataset.findOne({
        where: { id: id_dataset },
        include: [
            {
                model: Run,
                as: 'run',
                attributes: ['class', 'state', 'significant', 'stop_reason']
            }
        ]
    });
    // IF THE USER MOVES MANUALLY THE DATASET FROM GLOBAL TO OPEN AND THE DATASET WAS WAITING DQM GUI IN OTHER WORKSPACES, IT IS MOVED FROM ALL TO OPEN:
    if (
        workspace === 'global' &&
        dataset.global_state.value === 'waiting dqm gui' &&
        state === 'OPEN'
    ) {
        for (const [workspace, column] of Object.entries(
            offline_column_structure
        )) {
            // attribute cms is not really a workspace:
            if (
                workspace !== 'cms' &&
                dataset[`${workspace}_state`]['value'] === 'waiting dqm gui'
            ) {
                dataset[`${workspace}_state`] = changeHistory(
                    dataset[`${workspace}_state`],
                    { value: state },
                    req.get('email')
                );
            }
        }
        // And finally in global:
        dataset[`${workspace}_state`] = changeHistory(
            dataset[`${workspace}_state`],
            { value: state },
            req.get('email')
        );
    } else {
        // Or else if a user just moved for an individual workspace other than global:
        dataset[`${workspace}_state`] = changeHistory(
            dataset[`${workspace}_state`],
            {
                value: state
            },
            req.get('email')
        );
    }
    const saved_dataset = await dataset.save();
    res.json(saved_dataset);
};

exports.edit = async (req, res) => {
    const dataset = await Dataset.findOne({
        where: { id: req.body.id_dataset },
        include: [
            {
                model: Run,
                as: 'run',
                attributes: ['class', 'state', 'significant', 'stop_reason']
            }
        ]
    });
    const { dataValues } = dataset;
    if (dataset === null) {
        throw 'Dataset not found';
    }
    const email = req.get('email');
    if (req.body.class) {
        // User is editing the class name (cosmics, collision, etc...)
        const old_class = dataValues.class.value;
        const new_class = req.body.class;
        if (old_class !== new_class) {
            dataValues['class'] = changeHistory(
                dataValues.class,
                { value: new_class },
                email
            );
        }
    } else {
        // User is editing triplets
        for (const [key, val] of Object.entries(req.body)) {
            if (typeof val === 'object') {
                if (val.status) {
                    const { status, comment, cause } = dataValues[key];
                    const new_status = req.body[key].status;
                    const new_comment = req.body[key].comment;
                    const new_cause = req.body[key].cause;
                    // Check if the component changed:
                    if (
                        status !== new_status ||
                        comment !== new_comment ||
                        cause !== new_cause
                    ) {
                        dataValues[key] = changeHistory(
                            dataValues[key],
                            req.body[key],
                            email
                        );
                    }
                }
            }
        }
    }

    const updated_dataset = await dataset.update(dataValues);
    res.json(updated_dataset.dataValues);
};

// visualization on popover

exports.getLumisectionBar = async (req, res) => {
    const { run_number, name, component } = req.body;
    const merged_lumisections = await sequelize.query(
        `
        SELECT run_number, "name", lumisection_number, mergejsonb(lumisection_metadata ORDER BY version ) as "triplets"
        FROM(
        SELECT "LumisectionEvent"."version", run_number, "name", jsonb AS "lumisection_metadata", lumisection_number  FROM "LumisectionEvent" INNER JOIN "LumisectionEventAssignation" 
        ON "LumisectionEvent"."version" = "LumisectionEventAssignation"."version" INNER JOIN "JSONBDeduplication" ON "lumisection_metadata_id" = "id"
        WHERE "LumisectionEvent"."name" = :name AND "LumisectionEvent"."run_number" = :run_number
        ) AS "updated_lumisectionEvents"
        GROUP BY "run_number", "name", lumisection_number 
        ORDER BY lumisection_number;
    `,
        {
            type: sequelize.QueryTypes.SELECT,
            replacements: {
                run_number,
                name
            }
        }
    );
    // // Put all the components present in the dataset
    // const components_present_in_dataset = [];
    // merged_lumisections.forEach(({ triplets }) => {
    //     for (const [component, val] of Object.entries(triplets)) {
    //         if (!components_present_in_dataset.includes(component)) {
    //             components_present_in_dataset.push(component);
    //         }
    //     }
    // });

    const lumisections_with_empty_wholes = [];

    if (merged_lumisections.length > 0) {
        const last_lumisection_number =
            merged_lumisections[merged_lumisections.length - 1]
                .lumisection_number;
        let current_merged_lumisection_element = 0;
        for (let i = 0; i < last_lumisection_number; i++) {
            const { triplets, lumisection_number } = merged_lumisections[
                current_merged_lumisection_element
            ];
            if (i + 1 === lumisection_number && triplets[component]) {
                const component_triplet = triplets[component];
                lumisections_with_empty_wholes.push(component_triplet);
                current_merged_lumisection_element += 1;
            } else {
                // it is just a space between lumisections. where there are some lumisections above and some below, it just means its an empty lumisection
                lumisections_with_empty_wholes.push({
                    status: 'EMPTY',
                    comment: '',
                    cause: ''
                });
            }
        }
    }
    res.json(lumisections_with_empty_wholes);
};

// Get all component lumisections:
exports.get_lumisections = async (req, res) => {
    const { run_number, name } = req.body;
    const lumisections_with_empty_wholes = await get_rr_lumisections_for_dataset(
        run_number,
        name
    );
    res.json(lumisections_with_empty_wholes);
};

exports.edit = async (req, res) => {
    const { run_number, name } = req.body;
    const dataset = await Dataset.findOne({
        where: {
            run_number,
            name
        }
    });
    if (dataset === null) {
        throw 'Dataset not found';
    }
    const { dataset_attributes } = dataset.dataValues;
    const new_dataset_attributes = getObjectWithAttributesThatChanged(
        dataset_attributes,
        req.body.dataset_attributes
    );

    const new_dataset_attributes_length = Object.keys(new_dataset_attributes)
        .length;

    if (new_dataset_attributes_length > 0) {
        let transaction;
        try {
            transaction = await sequelize.transaction();
            const datasetEvent = await update_or_create_dataset(
                name,
                run_number,
                new_dataset_attributes,
                req,
                transaction
            );
            await transaction.commit();
        } catch (err) {
            console.log(err);
            await transaction.rollback();
            throw `Error updating dataset ${name} of run ${run_number}`;
        }
    } else {
        throw 'Nothing to update, the attributes sent are the same as those in the dataset already stored';
    }
};
