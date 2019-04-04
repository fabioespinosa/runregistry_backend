const changeNameOfAllKeys = require('change-name-of-all-keys');
const Sequelize = require('../models').Sequelize;
const sequelize = require('../models').sequelize;
const {
    DatasetTripletCache,
    Dataset,
    DatasetEvent,
    Event,
    Workspace,
    Run
} = require('../models');
const {
    get_rr_lumisections_for_dataset,
    create_rr_lumisections
} = require('./lumisection');
const { fill_dataset_triplet_cache } = require('./dataset_triplet_cache');
const { WAITING_DQM_GUI_CONSTANT } = require('../config/config')[
    process.env.ENV || 'development'
];

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
    const { run_number, dataset_name } = req.body;
    const dataset = await Dataset.findOne({
        where: {
            run_number,
            name: dataset_name
        },
        include: [{ model: Run }, { model: DatasetTripletCache }]
    });
    res.json(dataset);
};

exports.getDatasetsWaiting = async (req, res) => {
    const datasets = await Dataset.findAll({
        where: {
            // DO NOT CHANGE THE FOLLOWING LINE AS APPLICATION LOGIC RELIES ON IT:
            'dataset_attributes.global_state': WAITING_DQM_GUI_CONSTANT
        }
    });
    res.json(datasets);
};
exports.getDatasetsWaitingDBS = async (req, res) => {
    const datasets = await Dataset.findAll({
        where: {
            // DO NOT CHANGE THE FOLLOWING LINE AS APPLICATION LOGIC RELIES ON IT:
            [Op.or]: [
                { 'dataset_attributes.appeared_in': '' },
                { 'dataset_attributes.appeared_in': 'DQM GUI' }
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
    const { run_number, dataset_name } = req.body;
    const dataset = await Dataset.findOne({
        where: {
            run_number,
            name: dataset_name
        }
    });
    let { appeared_in } = dataset.dataset_attributes;

    if (typeof appeared_in === 'undefined') {
        appeared_in = [];
    }
    if (appeared_in.includes('DBS')) {
        throw 'already marked as appeared in DBS';
    }

    await exports.update_or_create_dataset(
        dataset_name,
        run_number,
        {
            appeared_in: appeared_in.concat('DBS')
        },
        req
    );
    const saved_dataset = await Dataset.findOne({
        where: {
            run_number,
            name: dataset_name
        },
        include: [{ model: Run }, { model: DatasetTripletCache }]
    });
    res.json(saved_dataset);
};
// If a dataset appeared in DQM GUI we must mark it open inmediately (we must changed )
exports.appearedInDQMGUI = async (req, res) => {
    const { run_number, dataset_name } = req.body;
    const dataset = await Dataset.findOne({
        where: {
            run_number,
            name: dataset_name
        }
    });

    let { appeared_in } = dataset.dataset_attributes;

    if (typeof appeared_in === 'undefined') {
        appeared_in = [];
    }
    if (appeared_in.includes('DQM GUI')) {
        throw 'already marked as appeared in DQM GUI';
    }
    await exports.update_or_create_dataset(dataset_name, run_number, {
        appeared_in: appeared_in.concat('DQM GUI')
    });
    const saved_dataset = await Dataset.findOne({
        where: {
            run_number,
            name: dataset_name
        },
        include: [{ model: Run }, { model: DatasetTripletCache }]
    });

    res.json(saved_dataset);
    // // TODO: Decide if there is going to be one dataset_classifier per workspace
    // const dataset_classifiers = await OfflineDatasetClassifier.findAll();
    // dataset_classifiers.forEach(dataset_classifier => {
    //     const classifier = dataset_classifier.dataValues.classifier;
    //     const significant = json_logic.apply(classifier, dataset);
    //     const workspace = dataset_classifier.dataValues.workspace;
    //     if (significant === 'CREATE_DATASET') {
    //         dataset[`${workspace}_state`] = changeHistory(
    //             dataset[`${workspace}_state`],
    //             { value: 'OPEN' },
    //             author_dataset_classifier
    //         );
    //     }
    //     if (significant === 'IRRELEVANT') {
    //         dataset[`${workspace}_state`] = changeHistory(
    //             dataset[`${workspace}_state`],
    //             { value: 'OPEN' },
    //             author_dataset_classifier
    //         );
    //     }
    // });
};

exports.getWaitingDatasets = async (req, res) => {
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
    // If a user filters by anything else:
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
            where: triplet_summary_filter,
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
    res.json({ datasets, pages, count });
};

exports.getEditableDatasets = async (req, res) => {
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
    // If a user filters by anything else:

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
            where: triplet_summary_filter,
            attributes: ['triplet_summary']
        }
    ];
    if (typeof filter['class'] !== 'undefined') {
        include[0].where = { 'rr_attributes.class': filter['class'] };
        delete filter['class'];
    }
    const { count } = await Dataset.count({
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
    res.json({ datasets, pages, count });
};

// Move manually a dataset from client:
exports.moveDataset = async (req, res) => {
    const { run_number, dataset_name, workspace, to_state } = req.body;
    const dataset = await Dataset.findOne({
        where: { run_number, name: dataset_name },
        include: [
            {
                model: Run
            }
        ]
    });
    const { dataset_attributes } = dataset;
    const new_dataset_attributes = {};
    // IF THE USER MOVES MANUALLY THE DATASET FROM GLOBAL TO OPEN AND THE DATASET WAS WAITING DQM GUI IN OTHER WORKSPACES, IT IS MOVED FROM ALL TO OPEN:
    if (
        workspace === 'global' &&
        dataset_attributes.global_state === WAITING_DQM_GUI_CONSTANT &&
        to_state === 'OPEN'
    ) {
        for (const [dataset_attribute, value] of Object.entries(
            dataset_attributes
        )) {
            if (
                dataset_attribute.includes('_state') &&
                value === WAITING_DQM_GUI_CONSTANT
            ) {
                new_dataset_attributes[dataset_attribute] = to_state;
            }
        }
        // And finally in global:
        new_dataset_attributes[`${workspace}_state`] = to_state;
    } else {
        // Or else if a user just moved for an individual workspace other than global:
        new_dataset_attributes[`${workspace}_state`] = to_state;
    }

    await exports.update_or_create_dataset(
        dataset_name,
        run_number,
        new_dataset_attributes,
        req
    );
    const saved_dataset = await Dataset.findOne({
        where: {
            run_number,
            name: dataset_name
        },
        include: [{ model: Run }, { model: DatasetTripletCache }]
    });

    res.json(saved_dataset);
};

exports.manual_edit = async (req, res) => {
    const { workspace } = req.params;
    const { run_number, dataset_name } = req.body;
    const dataset = await Dataset.findOne({
        where: { run_number, name: dataset_name },
        include: [
            {
                model: Run
            }
        ]
    });
    if (dataset === null) {
        throw 'Dataset not found';
    }
    const { dataset_attributes } = dataset;
    if (dataset_attributes[`${workspace}_state`] !== 'OPEN') {
        throw `Dataset is not in state OPEN for workspace: ${workspace}`;
    }

    const new_dataset_attributes = getObjectWithAttributesThatChanged(
        dataset_attributes,
        req.body.dataset_attributes
    );
    const new_attributes_length = Object.keys(new_dataset_attributes).length;
    if (new_attributes_length > 0) {
        const datasetEvent = await update_or_create_dataset(
            dataset_name,
            run_Number,
            new_dataset_attributes,
            req
        );
    } else {
        throw 'Nothing to update, the attributes sent are the same as those in the dataset already stored';
    }
    const saved_dataset = await Dataset.findOne({
        where: {
            run_number,
            name: dataset_name
        },
        include: [{ model: Run }, { model: DatasetTripletCache }]
    });
    res.json(saved_dataset);
};

// visualization on popover

exports.getLumisectionBar = async (req, res) => {
    const { run_number, name, component } = req.body;
    const merged_lumisections = await sequelize.query(
        `
        SELECT run_number, "name", lumisection_number, mergejsonb(lumisection_metadata ORDER BY manual_change, version ) as "triplets"
        FROM(
        SELECT "LumisectionEvent"."version", run_number, "name", jsonb AS "lumisection_metadata", lumisection_number, manual_change  FROM "LumisectionEvent" INNER JOIN "LumisectionEventAssignation" 
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

// DC TOOLS:

// It will duplicate existing datsets, if it fails for one, it fails for all and transaction is aborted
// It comes with a filter that comes from front end, we will query for the datasets that match the filter AND that are not in a 'waiting dqm gui' global_state
exports.duplicate_datasets = async (req, res) => {
    let {
        source_dataset_name,
        target_dataset_name,
        workspaces_to_duplicate_into
    } = req.body;

    let filter = changeNameOfAllKeys(
        {
            name: source_dataset_name,
            'dataset_attributes.global_state': {
                or: [{ '=': 'OPEN' }, { '=': 'SIGNOFF' }, { '=': 'COMPLETED' }]
            },
            ...req.body.filter
        },
        conversion_operator
    );
    let include = [
        {
            model: Run,
            attributes: ['rr_attributes']
        }
    ];
    if (typeof filter['class'] !== 'undefined') {
        include[0].where = { 'rr_attributes.class': filter['class'] };
        delete filter['class'];
    }

    const datasets_to_copy = await Dataset.findAll({
        where: filter,
        include
    });
    if (datasets_to_copy.length === 0) {
        throw `No dataset found for filter criteria`;
    }

    // TODO: Validate that the workspace in 'workspaces_to_duplicate_into' actually exist:

    let transaction;
    try {
        transaction = await sequelize.transaction();

        const promises = datasets_to_copy.map(async dataset => {
            const { run_number } = dataset;
            // We go through the state of every workspace, if the user included that workspace in the "copy" tool, then we copy that. If not, then we don't
            // If the user didn't include a workspace, then the duplicated dataset will not appear in such workspace (because there is no state there)
            const new_dataset_attributes = {};
            for (const [key, val] of Object.entries(
                dataset.dataValues.dataset_attributes
            )) {
                if (key.includes('_state')) {
                    const key_workspace = key.split('_state')[0];
                    if (
                        workspaces_to_duplicate_into.includes(key_workspace) ||
                        key_workspace === 'global'
                    ) {
                        new_dataset_attributes[key] = val;
                    }
                } else {
                    // All other attributes not regarding state, we copy to the new_dataset_attributes:
                    new_dataset_attributes[key] = val;
                }
            }

            // If there was a newly created workspace sent, and it wasn't saved before on the dataset, we should still add the state to the dataset, and set it to pending:
            // So that it shows up in the newly created workspace:
            workspaces_to_duplicate_into.forEach(workspace => {
                new_dataset_attributes[`${workspace}_state`] =
                    new_dataset_attributes[`${workspace}_state`] ||
                    WAITING_DQM_GUI_CONSTANT;
            });

            await exports.update_or_create_dataset(
                target_dataset_name,
                run_number,
                new_dataset_attributes,
                req,
                transaction
            );
            const original_lumisections = await get_rr_lumisections_for_dataset(
                run_number,
                source_dataset_name
            );
            const saved_rr_lumisections = await create_rr_lumisections(
                run_number,
                target_dataset_name,
                original_lumisections,
                req,
                transaction
            );
        });

        await Promise.all(promises);
        await transaction.commit();
        // You can only fill the cache when transaction has commited:
        await fill_dataset_triplet_cache();

        const saved_datasets_promises = datasets_to_copy.map(
            async ({ run_number, name }) => {
                const saved_dataset = await Dataset.findOne({
                    where: {
                        run_number,
                        name: target_dataset_name
                    },
                    include: [
                        {
                            model: Run,
                            attributes: ['rr_attributes']
                        },
                        { model: DatasetTripletCache }
                    ]
                });
                return saved_dataset;
            }
        );
        const saved_datasets = await Promise.all(saved_datasets_promises);
        res.json(saved_datasets);
    } catch (err) {
        console.log('Error duplicating datasets');
        console.log(err);
        await transaction.rollback();
        throw `Error duplicating datasets: ${err.message}`;
    }
};

exports.getUniqueDatasetNames = async (req, res) => {
    let filter = changeNameOfAllKeys(
        {
            'dataset_attributes.global_state': {
                or: [{ '=': 'OPEN' }, { '=': 'SIGNOFF' }, { '=': 'COMPLETED' }]
            },
            ...req.body.filter
        },
        conversion_operator
    );
    let include = [
        {
            model: Run,
            attributes: ['rr_attributes']
        }
    ];
    if (typeof filter['class'] !== 'undefined') {
        include[0].where = { 'rr_attributes.class': filter['class'] };
        delete filter['class'];
    }

    const datasets_filter_criteria = await Dataset.findAll({
        where: filter,
        include
    });
    const unique_dataset_names_object = {};
    datasets_filter_criteria.forEach(({ name }) => {
        unique_dataset_names_object[name] = name;
    });
    const unique_dataset_names = Object.keys(unique_dataset_names_object);

    res.json(unique_dataset_names);
};
