const axios = require('axios');
const appendToAllAttributes = require('append-to-all-attributes');
const getAttributesSpecifiedFromArray = require('get-attributes-specified-from-array');
const { API_URL } = require('../config/config')[
    process.env.NODE_ENV || 'development'
];
const {
    setComponentsIncludedBooleans,
    getLumisectionAttributes,
    assign_run_class,
    fill_component_triplets,
    setupRun,
    is_run_significant,
    assign_component_status
} = require('./saving_updating_runs_utils');

// The runs to be saved get here, they await to be classified into cosmics/collision/commission:
// AND check if its worth saving the dataset
// IF the dataset is worth saving, the component's statuses get assigned
exports.update_runs = async (
    new_runs,
    email_refreshing,
    manually_signficant
) => {
    const now = Date.now();
    const promises = new_runs.map(async run => {
        const oms_attributes = run;
        // We don't want to accidentally alter the attributes we get from OMS, so we freeze them:
        Object.freeze(oms_attributes);
        const rr_attributes = await setupRRAttributes(oms_attributes, now);
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
        if (manually_signficant || run_is_significant || run.significant) {
            const components_status = await assign_component_status(
                oms_attributes,
                rr_attributes
            );
            const components_status_renamed = appendToAllAttributes(
                components_status,
                '_triplet'
            );
            // Set significant as true value so that api can compare them:
            rr_attributes = {
                ...rr_attributes,
                ...components_status_renamed,
                significant: true
            };
        }

        try {
            await axios.put(`${API_URL}/runs/${run.run_number}`, run, {
                // The email HAS to start with auto, or else API won't know it's an automatic change
                headers: {
                    email:
                        email_refreshing || 'auto (run updated automatically)'
                }
            });
        } catch (err) {
            console.log('Error updating run:');
            console.log(err.response.data);
        }
    });
    await Promise.all(promises);
};
