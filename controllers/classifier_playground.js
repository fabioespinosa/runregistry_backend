const json_logic = require('json-logic-js');
const Run = require('../models').Run;

const { get_oms_lumisections_for_dataset } = require('./lumisection');
const {
    reduce_ls_attributes
} = require('../cron/saving_updating_runs_lumisections_utils');

exports.testArbitraryClassifier = async (req, res) => {
    let { data, json_logic } = req.body;
    json_logic = JSON.parse(json_logic);
    const result = return_classifier_evaluated_tuple(data, json_logic);

    res.json({
        result,
        data
    });
};

exports.testClassifier = async (req, res) => {
    const run_number = req.body.run.run_number;
    const previously_saved_run = await Run.findByPk(run_number);

    const { oms_attributes, rr_attributes } = previously_saved_run.dataValues;

    const oms_lumisections = await get_oms_lumisections_for_dataset(
        run_number,
        'online'
    );
    const reduced_lumisection_attributes = reduce_ls_attributes(
        oms_lumisections
    );
    const run = {
        ...oms_attributes,
        ...rr_attributes,
        ...reduced_lumisection_attributes
    };
    const classifier = JSON.parse(req.body.classifier);
    const result = return_classifier_evaluated_tuple(run, classifier.if);
    res.json({
        result,
        run_data: run
    });
};

// TODO: Should refresh run
exports.getRunInfo = async (req, res) => {
    const { run_number } = req.params;
    const previously_saved_run = await Run.findByPk(run_number);

    const { oms_attributes, rr_attributes } = previously_saved_run.dataValues;

    const oms_lumisections = await get_oms_lumisections_for_dataset(
        run_number,
        'online'
    );
    const reduced_lumisection_attributes = reduce_ls_attributes(
        oms_lumisections
    );
    const run = {
        oms_attributes,
        rr_attributes,
        reduced_lumisection_attributes
    };
    res.json({ run });
};

// returns [rule, passed], for example [{"==": [{"var": "beam1_present"}, false]}, true], which means the variable beam1_present was indeed false
const return_classifier_evaluated_tuple = (run_data, classifier_rules) => {
    const evaluated_tuples = [];
    if (!Array.isArray(classifier_rules)) {
        classifier_rules = [classifier_rules];
    }
    classifier_rules.forEach(rule => {
        Object.keys(rule).forEach(key => {
            if (key === 'if') {
            } else if (key === 'or' || key === 'and') {
                const if_rule = { if: [rule] };
                let result = json_logic.apply(if_rule, run_data);
                result = result === true; // Make null values false
                const printed_value = { resulted_value: result };
                rule[key] = return_classifier_evaluated_tuple(
                    run_data,
                    rule[key]
                );
                evaluated_tuples.push([rule, printed_value]);
            } else {
                const if_rule = { if: [rule] };
                let result = json_logic.apply(if_rule, run_data);
                result = result === true; // Make null values false
                const printed_value = { resulted_value: result };
                evaluated_tuples.push([rule, printed_value]);
            }
        });
    });
    return evaluated_tuples;
};
