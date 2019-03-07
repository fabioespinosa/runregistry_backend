const axios = require('axios');
const json_logic = require('json-logic-js');
const Run = require('../models').Run;
const {
    OMS_URL,
    OMS_SPECIFIC_RUN,
    OMS_LUMISECTIONS
} = require('../config/config')[process.env.ENV || 'development'];
const {
    calculate_oms_attributes
} = require('../cron/3.calculate_rr_attributes');

exports.testClassifier = async (req, res) => {
    const run_number = req.body.run.run_number;
    const previously_saved_run = await Run.findByPk(run_number);

    const { oms_attributes } = previously_saved_run.dataValues;

    const classifier = JSON.parse(req.body.classifier);
    const result = return_classifier_evaluated_tuple(
        oms_attributes,
        classifier.if
    );
    res.json({
        result,
        run_data: oms_attributes
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
