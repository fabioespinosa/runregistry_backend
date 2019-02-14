const appendToAllAttributes = require('append-to-all-attributes');
const {
    setupRRAttributes,
    assign_run_class,
    is_run_significant,
    assign_component_status
} = require('./saving_updating_runs_utils');

exports.calculate_rr_attributes = async (
    oms_attributes,
    manually_significant
) => {
    let rr_attributes = await setupRRAttributes(oms_attributes);
    // Significant starts being false, stop_reason is a shifter value (so it starts as empty), class is to be determined later, state starts OPEN:
    rr_attributes.significant = false;
    rr_attributes.stop_reason = '';
    rr_attributes.class = '';
    rr_attributes.state = 'OPEN';

    // hlt_key is determinant to calculate the run's class, so if its not ready, we rather wait to classify a run
    if (oms_attributes.hlt_key !== null) {
        rr_attributes.class = await assign_run_class(
            oms_attributes,
            rr_attributes
        );
    }

    const run_is_significant = await is_run_significant(
        oms_attributes,
        rr_attributes
    );
    if (manually_significant || run_is_significant) {
        const components_status = await assign_component_status(
            oms_attributes,
            rr_attributes
        );
        const components_status_renamed = appendToAllAttributes(
            components_status,
            '_triplet'
        );
        rr_attributes = {
            ...rr_attributes,
            ...components_status_renamed,
            significant: true
        };
    }
    return rr_attributes;
};
