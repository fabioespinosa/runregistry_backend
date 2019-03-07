const axios = require('axios');
const sequelize = require('../models').sequelize;
const Dataset = require('../models').Dataset;
const {
    Event,
    LumisectionEvent,
    LumisectionEventAssignation
} = require('../models');
// const { lumisection_attributes } = require('../config/config');
const { OMS_URL, OMS_LUMISECTIONS } = require('../config/config')[
    process.env.ENV || 'development'
];

const getAttributesSpecifiedFromArray = require('get-attributes-specified-from-array');
const { deepEqual } = require('assert');
const { findOrCreateJSONB } = require('./JSONBDeduplication');

//// blockhain
// Its a range, contains start_lumisection AND it contains end_lumisection
const update_or_create_lumisection = async (
    run_number,
    dataset_name,
    lumisection_metadata,
    start_lumisection,
    end_lumisection,
    req,
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
            lumisection_metadata,
            transaction
        );

        const lumisectionEvent = await LumisectionEvent.create(
            {
                run_number,
                name: dataset_name,
                lumisection_metadata_id: deduplicated_jsonb.id,
                version: event.version
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
        await LumisectionEventAssignation.bulkCreate(lumisection_entries, {
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

exports.create_lumisections = async (
    run_number,
    dataset_name,
    lumisections,
    whitelist,
    req,
    transaction
) => {
    const lumisection_ranges = await exports.getLumisectionRanges(
        lumisections,
        whitelist
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
            transaction
        );
    });
    await Promise.all(saved_ranges);
    return saved_ranges;
};

// Get lumisections:

exports.getLumisectionsForDataset = async (req, res) => {
    const { id_dataset } = req.params;
    let lumisections = await sequelize.query(
        `
            SELECT id_dataset, lumisection_number, mergejsonb(lumisection_metadata ORDER BY version ) as "lumisection_attributes"
            FROM(
            SELECT "LumisectionEvent"."version", id_dataset, lumisection_metadata, lumisection_number from "LumisectionEvent"  inner join "LumisectionEventAssignation" 
                on "LumisectionEvent"."version" = "LumisectionEventAssignation"."version" 
            WHERE "LumisectionEvent"."id_dataset" = :id_dataset
            ) AS "updated_lumisectionEvents"
            GROUP BY id_dataset, lumisection_number;`,
        {
            type: sequelize.QueryTypes.SELECT,
            replacements: {
                id_dataset
            }
        }
    );
    lumisections = lumisections.map(
        ({ lumisection_attributes }) => lumisection_attributes
    );

    lumisections = exports.getLumisectionRanges(lumisections);

    res.json(lumisections);
};

// Returns LS ranges in format: [{start:0, end: 23, ...values}, {start: 24, end: 90, ...values}]
exports.getLumisectionRanges = (lumisections, lumisection_attributes) => {
    // We whitelist the attributes we want:
    lumisections = lumisections.map(lumisection =>
        getAttributesSpecifiedFromArray(lumisection, lumisection_attributes)
    );

    const ls_ranges = [];
    ls_ranges.push({ ...lumisections[0], start: 1 });

    for (let i = 1; i < lumisections.length; i++) {
        const previous_range = ls_ranges[ls_ranges.length - 1];
        const current_range = lumisections[i];
        try {
            deepEqual(previous_range, current_range);
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

    return ls_ranges;
};

// exports.getLumisectionsForRun = async (req, res) => {
//     let {
//         data: { data: lumisections }
//     } = await axios.get(
//         `${OMS_URL}/${OMS_LUMISECTIONS(req.params.run_number)}`
//     );
//     lumisections = lumisections.map(({ attributes }) =>
//         getAttributesSpecifiedFromArray(attributes, lumisection_attributes)
//     );
//     const ls_ranges = exports.getLumisectionRanges(lumisections);
//     res.json(ls_ranges);
// };

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

//exports.editDatasetLumisections = async (req, res) => {
//// There are two cases.
//// One where the lumisections have not yet been edited before, evidence of that is an empty array (which is introduced when the dataset is created). In this case, we simply fetch the original lumisections, save them, and then perform the update.
//// Second case is where the lumisections have already been edited, only job is to update them.
//const { workspace } = req.params;
//const dataset = await Dataset.findByPk(req.body.id_dataset);
//let previous_lumisections;
//if (dataset.dataValues[`${workspace}_lumisections`].value.length > 0) {
//// If it has been edited before:
//previous_lumisections =
//dataset.dataValues[`${workspace}_lumisections`].value;
//} else {
//// If it has not been edited before, we have to fetch them, and save a copy as an initial fetch.
//const {
//data: { data: lumisections }
//} = await axios.get(
//`${OMS_URL}/${OMS_LUMISECTIONS(dataset.dataValues.run_number)}`
//);
//const newly_fetched_lumisections = lumisections.map(({ attributes }) =>
//getAttributesSpecifiedFromArray(attributes, lumisection_attributes)
//);
//// Save the copy of the initial lumisections
//await exports.saveLumisections(
//dataset,
//workspace,
//dataset.dataValues[`${workspace}_lumisections`],
//newly_fetched_lumisections,
//'INITIAL FETCH'
//);
//// The newly fetched lumisections will be edited nonetheless
//previous_lumisections = newly_fetched_lumisections;
//}
//
//previous_lumisections = Object.freeze(previous_lumisections);
//// Merge the previous lumisections with the one edited by the user
//const new_lumisections = previous_lumisections;
//const { from, to, bit, action } = req.body;
//for (let i = 0; i < previous_lumisections.length; i++) {
//if (from - 1 <= i && i <= to - 1) {
//new_lumisections[i][bit] = action === 'true';
//}
//}
//const edited_dataset = await exports.saveLumisections(
//dataset,
//workspace,
//dataset.dataValues[`${workspace}_lumisections`],
//new_lumisections,
//`${req.get('email')} - edit`
//);
//const ls_ranges = exports.getLumisectionRanges(
//edited_dataset.dataValues[`${workspace}_lumisections`].value
//);
//res.json(ls_ranges);
//};
//exports.resetLumisections = async (req, res) => {
//const { workspace } = req.params;
//const dataset = await Dataset.findByPk(req.body.id_dataset);
//const edited_dataset = await exports.saveLumisections(
//dataset,
//workspace,
//dataset.dataValues[`${workspace}_lumisections`],
//[],
//`${req.get('email')} - reset`
//);
//res.json(edited_dataset);
//};
//

//
//// workspace can be either global as in global_lumisections or as in any other workspace like csc_lumisections
//exports.saveLumisections = async (
//dataset,
//workspace,
//previous_lumisections,
//new_lumisections,
//by
//) => {
//dataset[`${workspace}_lumisections`] = changeHistory(
//previous_lumisections,
//{ value: new_lumisections },
//by,
//false,
//Date.now()
//);
//return await dataset.update(dataset.dataValues);
//};

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
