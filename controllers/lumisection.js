const axios = require('axios');
const sequelize = require('../models').sequelize;
const Dataset = require('../models').Dataset;
const {
    Event,
    LumisectionEvent,
    LumisectionEventAssignation,
    OMSLumisectionEvent,
    OMSLumisectionEventAssignation
} = require('../models');
const {
    oms_lumisection_whitelist,
    online_components
} = require('../config/config');
const { OMS_URL, OMS_LUMISECTIONS } = require('../config/config')[
    process.env.ENV || 'development'
];

const getAttributesSpecifiedFromArray = require('get-attributes-specified-from-array');
const getObjectWithAttributesThatChanged = require('get-object-with-attributes-that-changed');
const { deepEqual } = require('assert');
const { findOrCreateJSONB } = require('./JSONBDeduplication');

const rr_lumisection_whitelist = online_components.map(
    component => `${component}_triplet`
);

// Its a range, contains start_lumisection AND it contains end_lumisection
const update_or_create_lumisection = async (
    run_number,
    dataset_name,
    lumisection_metadata,
    start_lumisection,
    end_lumisection,
    req,
    LSEvent,
    LSEventAssignation,
    transaction
) => {
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
        const deduplicated_jsonb = await findOrCreateJSONB(
            lumisection_metadata
        );

        let manual_change = false;
        if (by !== 'auto@auto') {
            manual_change = true;
        }
        const lumisectionEvent = await LSEvent.create(
            {
                run_number,
                name: dataset_name,
                lumisection_metadata_id: deduplicated_jsonb.id,
                version: event.version,
                manual_change
            },
            { transaction }
        );
        const lumisection_entries = [];
        for (let i = start_lumisection; i <= end_lumisection; i++) {
            lumisection_entries.push({
                version: event.version,
                lumisection_number: i
            });
        }
        await LSEventAssignation.bulkCreate(lumisection_entries, {
            transaction
        });
        if (local_transaction) {
            await transaction.commit();
        }
        return lumisectionEvent;
    } catch (err) {
        console.log(err);
        if (local_transaction) {
            await transaction.rollback();
        }
        throw `Error updating/saving dataset ${dataset_name} of run ${run_number} lumisections`;
    }
};

exports.create_oms_lumisections = async (
    run_number,
    dataset_name,
    lumisections,
    req,
    transaction
) => {
    const lumisection_ranges = await exports.getLumisectionRanges(
        lumisections,
        oms_lumisection_whitelist
    );

    const saved_ranges = lumisection_ranges.map(async lumisection_range => {
        const { start, end } = lumisection_range;
        const lumisection_range_values = { ...lumisection_range };
        delete lumisection_range_values.start;
        delete lumisection_range_values.end;
        return await update_or_create_lumisection(
            run_number,
            dataset_name,
            lumisection_range_values,
            start,
            end,
            req,
            OMSLumisectionEvent,
            OMSLumisectionEventAssignation,
            transaction
        );
    });
    await Promise.all(saved_ranges);
    return saved_ranges;
};

exports.create_rr_lumisections = async (
    run_number,
    dataset_name,
    lumisections,
    req,
    transaction
) => {
    let local_whitelist;
    if (dataset_name !== 'online') {
        // If we are not dealing with online, we do not want to whitelist
        local_whitelist = ['*'];
    }

    const lumisection_ranges = await exports.getLumisectionRanges(
        lumisections,
        local_whitelist || rr_lumisection_whitelist
    );

    const saved_ranges = lumisection_ranges.map(async lumisection_range => {
        const { start, end } = lumisection_range;
        const lumisection_range_values = { ...lumisection_range };
        delete lumisection_range_values.start;
        delete lumisection_range_values.end;
        return await update_or_create_lumisection(
            run_number,
            dataset_name,
            lumisection_range_values,
            start,
            end,
            req,
            LumisectionEvent,
            LumisectionEventAssignation,
            transaction
        );
    });
    await Promise.all(saved_ranges);
    return saved_ranges;
};

exports.update_rr_lumisections = async (
    run_number,
    dataset_name,
    new_lumisections,
    req,
    transaction
) => {
    const by = req.email || req.get('email');

    let get_lumisections_without_shifter_intervention = false;
    if (by === 'auto@auto') {
        // If it is an automatic change, we want the program to get the lumisections without any change, so that if a change,after the shifters action occurs, it only saves it once:
        get_lumisections_without_shifter_intervention = true;
    }

    const previous_lumisections = await exports.get_rr_lumisections_for_dataset(
        run_number,
        dataset_name,
        get_lumisections_without_shifter_intervention
    );
    let local_whitelist;
    if (dataset_name !== 'online') {
        // If we are not dealing with online, we do not want to whitelist
        local_whitelist = ['*'];
    }
    const new_ls_ranges = exports.getNewLumisectionRanges(
        previous_lumisections,
        new_lumisections,
        local_whitelist || rr_lumisection_whitelist
    );
    const saved_ranges = new_ls_ranges.map(async lumisection_range => {
        const { start, end } = lumisection_range;
        const lumisection_range_values = { ...lumisection_range };
        delete lumisection_range_values.start;
        delete lumisection_range_values.end;
        return await update_or_create_lumisection(
            run_number,
            dataset_name,
            lumisection_range_values,
            start,
            end,
            req,
            LumisectionEvent,
            LumisectionEventAssignation,
            transaction
        );
    });
    await Promise.all(saved_ranges);
    return saved_ranges;
};
exports.update_oms_lumisections = async (
    run_number,
    dataset_name,
    new_lumisections,
    req,
    transaction
) => {
    const previous_lumisections = await exports.get_oms_lumisections_for_dataset(
        run_number,
        dataset_name
    );
    const new_ls_ranges = exports.getNewLumisectionRanges(
        previous_lumisections,
        new_lumisections,
        oms_lumisection_whitelist
    );
    const saved_ranges = new_ls_ranges.map(async lumisection_range => {
        const { start, end } = lumisection_range;
        const lumisection_range_values = { ...lumisection_range };
        delete lumisection_range_values.start;
        delete lumisection_range_values.end;
        return await update_or_create_lumisection(
            run_number,
            dataset_name,
            lumisection_range_values,
            start,
            end,
            req,
            OMSLumisectionEvent,
            OMSLumisectionEventAssignation,
            transaction
        );
    });
    await Promise.all(saved_ranges);
    return saved_ranges;
};

// This method is used when someone/cron automatically updates the values of the lumisections. We try to preserve the lumisection ranges which still apply, and calculate the minimum amount of new LS ranges necessary to fulfill the change
// Returns the newLSRanges if there were any
exports.getNewLumisectionRanges = (
    previous_lumisections,
    new_lumisections,
    lumisection_whitelist
) => {
    // Check if the lumisections are equal, if they are equal, do nothing.
    // If the lumisections are different, then create the ranges for the ones which changed

    if (previous_lumisections.length > new_lumisections.length) {
        throw 'Lumisections cannot be deleted';
    }
    const new_ls_ranges = [];

    for (let i = 0; i < new_lumisections.length; i++) {
        let current_previous_lumisection = previous_lumisections[i] || {};
        let current_new_lumisection = new_lumisections[i];
        if (lumisection_whitelist[0] !== '*') {
            current_previous_lumisection = getAttributesSpecifiedFromArray(
                current_previous_lumisection,
                lumisection_whitelist
            );
            current_new_lumisection = getAttributesSpecifiedFromArray(
                current_new_lumisection,
                lumisection_whitelist
            );
        }

        // We will check if the lumisections are equal one by one
        try {
            deepEqual(current_previous_lumisection, current_new_lumisection);
            if (new_ls_ranges.length > 0) {
                // If we had something saved in the range, we close it, since we found that there was one lumisection in the way which did match (and did not throw exception)
                const previous_range = new_ls_ranges[new_ls_ranges.length - 1];
                // If the range has not been closed yet:
                if (typeof previous_range.end === 'undefined') {
                    new_ls_ranges[new_ls_ranges.length - 1] = {
                        ...previous_range,
                        end: i
                    };
                }
            }
        } catch (e) {
            // this means that they are not equal

            // Lumisection changed, therefore we need to create a new range
            if (new_ls_ranges.length === 0) {
                const new_lumisection_attributes = getObjectWithAttributesThatChanged(
                    current_previous_lumisection,
                    current_new_lumisection
                );
                new_ls_ranges.push({
                    ...new_lumisection_attributes,
                    start: i + 1
                });
            } else {
                const previous_range = new_ls_ranges[new_ls_ranges.length - 1];
                const previous_range_copy = { ...previous_range };
                const potentially_new_lumisection_attributes = getObjectWithAttributesThatChanged(
                    current_previous_lumisection,
                    current_new_lumisection
                );
                // We delete start and end from previous range so that it doesn't interfere with deepEqual
                delete previous_range_copy.start;
                delete previous_range_copy.end;
                try {
                    deepEqual(
                        previous_range_copy,
                        potentially_new_lumisection_attributes
                    );
                } catch (e) {
                    if (typeof previous_range.end === 'undefined') {
                        new_ls_ranges[new_ls_ranges.length - 1] = {
                            ...previous_range,
                            end: i
                        };
                    }
                    const new_lumisection_attributes = getObjectWithAttributesThatChanged(
                        current_previous_lumisection,
                        current_new_lumisection
                    );
                    new_ls_ranges.push({
                        ...new_lumisection_attributes,
                        start: i + 1
                    });
                }
            }
        }
    }
    if (new_ls_ranges.length > 0) {
        // If we had something saved in the range, we close it, since we found that there was one lumisection in the way which did match (and did not throw exception)
        const previous_range = new_ls_ranges[new_ls_ranges.length - 1];
        // If the range has not been closed yet:
        if (typeof previous_range.end === 'undefined') {
            new_ls_ranges[new_ls_ranges.length - 1] = {
                ...previous_range,
                end: new_lumisections.length
            };
        }
    }
    return new_ls_ranges;
};

// Get all component lumisections:
// Without manual changes gives us the AUTOMATIC changes without any shifters intervention:
exports.get_rr_lumisections_for_dataset = async (
    run_number,
    dataset_name,
    without_manual_changes
) => {
    const merged_lumisections = await sequelize.query(
        `
        SELECT run_number, "name", lumisection_number, mergejsonb(lumisection_metadata ORDER BY ${
            without_manual_changes ? '' : 'manual_change,'
        } version ) as "triplets"
        FROM(
        SELECT "LumisectionEvent"."version", run_number, "name", jsonb AS "lumisection_metadata", lumisection_number, manual_change  FROM "LumisectionEvent" INNER JOIN "LumisectionEventAssignation" 
        ON "LumisectionEvent"."version" = "LumisectionEventAssignation"."version" INNER JOIN "JSONBDeduplication" ON "lumisection_metadata_id" = "id"
        WHERE "LumisectionEvent"."name" = :dataset_name AND "LumisectionEvent"."run_number" = :run_number
        ) AS "updated_lumisectionEvents"
        GROUP BY "run_number", "name", lumisection_number 
        ORDER BY lumisection_number;
    `,
        {
            type: sequelize.QueryTypes.SELECT,
            replacements: {
                run_number,
                dataset_name
            }
        }
    );
    // Put all the components present in the dataset
    const components_present_in_dataset = [];
    merged_lumisections.forEach(({ triplets }) => {
        for (const [component, val] of Object.entries(triplets)) {
            if (!components_present_in_dataset.includes(component)) {
                components_present_in_dataset.push(component);
            }
        }
    });

    const lumisections_with_empty_wholes = [];
    // Insert data:
    if (merged_lumisections.length > 0) {
        const last_lumisection_number =
            merged_lumisections[merged_lumisections.length - 1]
                .lumisection_number;
        let current_merged_lumisection_element = 0;
        for (let i = 0; i < last_lumisection_number; i++) {
            const { triplets, lumisection_number } = merged_lumisections[
                current_merged_lumisection_element
            ];
            lumisections_with_empty_wholes[i] = {};
            if (i + 1 === lumisection_number) {
                current_merged_lumisection_element += 1;
                components_present_in_dataset.forEach(component => {
                    if (typeof triplets[component] === 'object') {
                        lumisections_with_empty_wholes[i][component] =
                            triplets[component];
                    } else {
                        // If the triplet for this particular change is not in there, it was empty, so we add an empty triplet
                        lumisections_with_empty_wholes[i][component] = {
                            status: 'EMPTY',
                            comment: '',
                            cause: ''
                        };
                    }
                });
            } else {
                // it is just a space between lumisections. where there are some lumisections above and some below, it just means its an empty lumisection
                components_present_in_dataset.forEach(component => {
                    lumisections_with_empty_wholes[i][component] = {
                        status: 'EMPTY',
                        comment: '',
                        cause: ''
                    };
                });
            }
        }
    }
    return lumisections_with_empty_wholes;
};

exports.get_oms_lumisections_for_dataset = async (run_number, dataset_name) => {
    const merged_lumisections = await sequelize.query(
        `
        SELECT run_number, "name", lumisection_number, mergejsonb(lumisection_metadata ORDER BY version ) as "oms_json_blob"
        FROM(
        SELECT "OMSLumisectionEvent"."version", run_number, "name", jsonb AS "lumisection_metadata", lumisection_number  FROM "OMSLumisectionEvent" INNER JOIN "OMSLumisectionEventAssignation" 
        ON "OMSLumisectionEvent"."version" = "OMSLumisectionEventAssignation"."version" INNER JOIN "JSONBDeduplication" ON "lumisection_metadata_id" = "id"
        WHERE "OMSLumisectionEvent"."name" = :dataset_name AND "OMSLumisectionEvent"."run_number" = :run_number
        ) AS "updated_lumisectionEvents"
        GROUP BY "run_number", "name", lumisection_number 
        ORDER BY lumisection_number;
    `,
        {
            type: sequelize.QueryTypes.SELECT,
            replacements: {
                run_number,
                dataset_name
            }
        }
    );

    const lumisections_with_empty_wholes = [];
    // Insert data:
    if (merged_lumisections.length > 0) {
        const last_lumisection_number =
            merged_lumisections[merged_lumisections.length - 1]
                .lumisection_number;
        let current_merged_lumisection_element = 0;
        for (let i = 0; i < last_lumisection_number; i++) {
            const { oms_json_blob, lumisection_number } = merged_lumisections[
                current_merged_lumisection_element
            ];
            lumisections_with_empty_wholes[i] = {};
            if (i + 1 === lumisection_number) {
                current_merged_lumisection_element += 1;
                lumisections_with_empty_wholes[i] = oms_json_blob;
            } else {
                // it is just a space between lumisections. where there are some lumisections above and some below, it just means its an empty lumisection
                lumisections_with_empty_wholes[i] = {
                    err: 'No data available for this lumisection'
                };
            }
        }
    }
    return lumisections_with_empty_wholes;
};

exports.getLumisectionsForDataset = async (req, res) => {};

// Returns LS ranges in format: [{start:0, end: 23, ...values}, {start: 24, end: 90, ...values}]
exports.getLumisectionRanges = (lumisections, lumisection_attributes) => {
    // We whitelist the attributes we want (if it is an * in an array, it means we want all):
    if (lumisection_attributes[0] !== '*') {
        lumisections = lumisections.map(lumisection =>
            getAttributesSpecifiedFromArray(lumisection, lumisection_attributes)
        );
    }

    const ls_ranges = [];
    if (lumisections.length > 0) {
        ls_ranges.push({ ...lumisections[0], start: 1 });

        for (let i = 1; i < lumisections.length; i++) {
            const previous_range = { ...ls_ranges[ls_ranges.length - 1] };
            const previous_range_copy = { ...previous_range };
            // We delete start and end from previous range so that it doesn't interfere with deepEqual
            delete previous_range_copy.start;
            delete previous_range_copy.end;
            const current_range = lumisections[i];

            try {
                deepEqual(previous_range_copy, current_range);
            } catch (e) {
                // This means that there is a LS break in the range (exception thrown), not equal, therefore we create a break in the ranges array:
                ls_ranges[ls_ranges.length - 1] = {
                    ...previous_range,
                    end: i
                };
                ls_ranges.push({ ...lumisections[i], start: i + 1 });
            }
        }

        // Set the end of final range:
        ls_ranges[ls_ranges.length - 1] = {
            ...ls_ranges[ls_ranges.length - 1],
            end: lumisections.length
        };
    }

    return ls_ranges;
};

exports.getLumisectionsForRunFromOMS = async (req, res) => {
    const { run_number } = req.params;
    let {
        data: { data: lumisections }
    } = await axios.get(`${OMS_URL}/${OMS_LUMISECTIONS(run_number)}`);
    lumisections = lumisections.map(({ attributes }) => attributes);
    const ls_ranges = exports.getLumisectionRanges(
        lumisections,
        oms_lumisection_whitelist
    );
    res.json(ls_ranges);
};

// Old non event-sourced RR
exports.getLumisectionsForDatasetWorkspace = async (req, res) => {
    const { workspace } = req.params;
    const { id_dataset } = req.body;
    // If a user has previously edited the lumisections, they will be in the lumisection column:
    const dataset = await Dataset.findByPk(id_dataset);
    if (dataset[`${workspace}_lumisections`].value.length === 0) {
        req.params.run_number = dataset.run_number;
        exports.getLumisectionsForRun(req, res);
    } else {
        const ls_ranges = exports.getLumisectionRanges(
            dataset[`${workspace}_lumisections`].value
        );
        res.json(ls_ranges);
    }
};

// --compressed:
// SELECT id_dataset, lumisection_number, mergejsonb(lumisection_metadata ORDER BY version)
// FROM(
//     SELECT "LumisectionEvent"."version", id_dataset, lumisection_metadata, lumisection_number from "LumisectionEvent"  inner join "LumisectionEventAssignation"
// 	on "LumisectionEvent"."version" = "LumisectionEventAssignation"."version"
// WHERE "LumisectionEvent"."id_dataset" = 251357
// ) AS "updated_lumisectionEvents"
// GROUP BY id_dataset, lumisection_number;

// -- with history:
// SELECT id_dataset, lumisection_number, lumisection_metadata, "version"
// FROM(
//     SELECT "LumisectionEvent"."version", id_dataset, lumisection_metadata, lumisection_number from "LumisectionEvent"  inner join "LumisectionEventAssignation"
// 	on "LumisectionEvent"."version" = "LumisectionEventAssignation"."version"
// WHERE "LumisectionEvent"."id_dataset" = 177793
// ) AS "updated_lumisectionEvents";

// API:
// Get lumisections:
exports.get_rr_and_oms_lumisection_ranges = async (req, res) => {
    const { run_number, dataset_name } = req.body;
    const rr_lumisections = await exports.get_rr_lumisections_for_dataset(
        run_number,
        dataset_name,
        false
    );
    const oms_lumisections = await exports.get_oms_lumisections_for_dataset(
        run_number,
        'online'
    );
    let joint_lumisections;
    if (rr_lumisections.length >= oms_lumisections.length) {
        joint_lumisections = rr_lumisections.map((rr_lumisection, index) => {
            return { ...oms_lumisections[index], ...rr_lumisection };
        });
    } else {
        joint_lumisections = oms_lumisections.map((oms_lumisection, index) => {
            return { ...oms_lumisection, ...rr_lumisections[index] };
        });
    }
    const ls_ranges = exports.getLumisectionRanges(joint_lumisections, ['*']);
    res.json(ls_ranges);
};
exports.get_rr_lumisection_ranges = async (req, res) => {
    const { run_number, dataset_name } = req.body;
    const rr_lumisections = await exports.get_rr_lumisections_for_dataset(
        run_number,
        dataset_name,
        false
    );
    const ls_ranges = exports.getLumisectionRanges(rr_lumisections, ['*']);
    res.json(ls_ranges);
};
exports.get_oms_lumisection_ranges = async (req, res) => {
    const { run_number, dataset_name } = req.body;
    const rr_lumisections = await exports.get_oms_lumisections_for_dataset(
        run_number,
        'online'
    );
    const ls_ranges = exports.getLumisectionRanges(rr_lumisections, ['*']);
    res.json(ls_ranges);
};
