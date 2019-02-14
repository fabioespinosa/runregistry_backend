const axios = require('axios');
const json_logic = require('json-logic-js');
const Run = require('../models').Run;
const { OMS_URL, OMS_SPECIFIC_RUN } = require('../config/config')[
    process.env.ENV || 'development'
];
const {
    calculate_rr_attributes
} = require('../cron/saving_updating_runs_utils');

exports.testClassifier = async (req, res) => {
    const run_number = req.body.run.id;
    const previously_saved_run = await Run.findByPk(run_number);

    const {
        data: { data: fetched_run }
    } = await axios.get(`${OMS_URL}/${OMS_SPECIFIC_RUN(run_number)}`);
    let combined_attributes_run = {
        ...previously_saved_run.dataValues.oms_attributes,
        ...fetched_run[0].attributes
    };
    combined_attributes_run = await calculate_rr_attributes(
        combined_attributes_run
    );
    const classifier = JSON.parse(req.body.classifier);
    const result = return_classifier_evaluated_tuple(
        combined_attributes_run,
        classifier.if
    );
    res.json({
        result,
        run_data: combined_attributes_run
    });
};

// returns [rule, passed], for example [{"==": [{"var": "beam1_present"}, false]}, true], which means the variable beam1_present was indeed false
const return_classifier_evaluated_tuple = (run_data, classifier_rules) => {
    const evaluated_tuples = [];
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
