const axios = require('axios');
const appendToAllAttributes = require('append-to-all-attributes');
const { API_URL } = require('../config/config')[
    process.env.NODE_ENV || 'development'
];
const {
    setupRRAttributes,
    assign_run_class,
    is_run_significant,
    assign_component_status
} = require('./saving_updating_runs_utils');

// The runs to be saved get here, they await to be classified into cosmics/collision/commission:
// AND check if its significant
// IF the run is significant, the component's statuses get assigned
exports.save_runs = async new_runs => {
    let significant_runs = 0;
    const now = Date.now();
    const promises = new_runs.map(async run => {
        try {
            const oms_attributes = run;
            // We don't want to accidentally alter the attributes we get from OMS, so we freeze them:
            Object.freeze(oms_attributes);
            let rr_attributes = await setupRRAttributes(oms_attributes, now);
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
            if (run_is_significant) {
                significant_runs += 1;
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

            await axios.post(
                `${API_URL}/runs`,
                { oms_attributes, rr_attributes },
                { headers: { email: 'auto' } }
            );
        } catch (e) {
            console.log(`Error saving run ${run.run_number}`);
            console.log(e);
        }
    });
    await Promise.all(promises);
    console.log(
        `${
            new_runs.length
        } run(s) saved of which ${significant_runs} were significant`
    );
};
