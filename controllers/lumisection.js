const axios = require('axios');
const Dataset = require('../models').Dataset;
const { lumisection_attributes } = require('../config/config');
const { OMS_URL, OMS_LUMISECTIONS } = require('../config/config')[
    process.env.NODE_ENV || 'development'
];
const getAttributesSpecifiedFromArray = require('get-attributes-specified-from-array');
const { deepEqual } = require('assert');
const { changeHistory } = require('./history_utils');

exports.getLumisectionsForRun = async (req, res) => {
    let {
        data: { data: lumisections }
    } = await axios.get(`${OMS_URL}/${OMS_LUMISECTIONS(req.params.id_run)}`);
    lumisections = lumisections.map(({ attributes }) =>
        getAttributesSpecifiedFromArray(attributes, lumisection_attributes)
    );
    const ls_ranges = exports.getLumisectionRanges(lumisections);
    res.json(ls_ranges);
};

exports.getLumisectionsForDatasetWorkspace = async (req, res) => {
    const { workspace } = req.params;
    const { id_dataset } = req.body;
    // If a user has previously edited the lumisections, they will be in the lumisection column:
    const dataset = await Dataset.findByPk(id_dataset);
    if (dataset[`${workspace}_lumisections`].value.length === 0) {
        req.params.id_run = dataset.run_number;
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
//// Returns LS ranges in format: [{start:0, end: 23, ...values}, {start: 24, end: 90, ...values}]
//exports.getLumisectionRanges = lumisections => {
//const ls_ranges = [];
//ls_ranges.push({ ...lumisections[0], start: 1 });
//
//for (let i = 1; i < lumisections.length; i++) {
//const previous_range = ls_ranges[ls_ranges.length - 1];
//try {
//deepEqual(
//getAttributesSpecifiedFromArray(
//previous_range,
//lumisection_attributes
//),
//getAttributesSpecifiedFromArray(
//lumisections[i],
//lumisection_attributes
//)
//);
//} catch (e) {
//// This means that there is a LS break in the range (exception thrown), not equal
//ls_ranges[ls_ranges.length - 1] = {
//...previous_range,
//end: i
//};
//ls_ranges.push({ ...lumisections[i], start: i + 1 });
//}
//}
//
//// Set the end of final range:
//ls_ranges[ls_ranges.length - 1] = {
//...ls_ranges[ls_ranges.length - 1],
//end: lumisections.length
//};
//return ls_ranges;
//};
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
