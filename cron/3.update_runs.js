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

const attributes_that_could_change = [
    'significant',
    'class',
    'hlt_key',
    'hlt_physics_counter',
    'ls_duration'
];

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
        run = await setupRun(run, now);
        if (run.hlt_key !== null) {
            run = await assign_run_class(run);
        }
        const run_is_significant = await is_run_significant(run);
        if (manually_signficant || run_is_significant || run.significant) {
            const components_status = await assign_component_status(run, now);
            const components_status_renamed = appendToAllAttributes(
                components_status,
                '_status'
            );
            // Set significant as true value so that api can compare them:
            run = { ...run, ...components_status_renamed, significant: true };
        } else {
            run.significant = false;
        }

        const sent_run = {};
        for (const [key, val] of Object.entries(run)) {
            if (
                val !== null &&
                (attributes_that_could_change.includes(key) ||
                    key.includes('_triplet'))
            ) {
                if (val.status === '' || val.status) {
                    // This will be a triplet:
                    sent_run[key] = val;
                } else if (val.value === '' || val.value) {
                    // This will be a versioned control item, defined by rr such as class, or significant:
                    sent_run[key] = val.value;
                } else {
                    // This will be a versioned control item not defined by rr, such as hlt_physics_counter or hlt_key:
                    sent_run[key] = val;
                }
            }
        }
        try {
            await axios.put(`${API_URL}/runs/${run.run_number}`, sent_run, {
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
