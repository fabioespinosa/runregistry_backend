const axios = require('axios');
const appendToAllAttributes = require('append-to-all-attributes');
const { API_URL } = require('../config/config')[
    process.env.NODE_ENV || 'development'
];
const {
    setupRun,
    setComponentsIncludedBooleans,
    getLumisectionAttributes,
    assign_run_class,
    fill_component_triplets,
    is_run_significant,
    assign_component_status
} = require('./saving_updating_runs_utils');

// The runs to be saved get here, they await to be classified into cosmics/collision/commission:
// AND check if its significant
// IF the run is significant, the component's statuses get assigned
exports.save_runs = async new_runs => {
    let significant_runs = 0;
    const now = Date.now();
    const default_history_attribute = value => ({
        value: value,
        when: now,
        history: [],
        by: 'auto'
    });
    const promises = new_runs.map(async run => {
        run = await setupRun(run, now);
        run = {
            ...run,
            // Significant starts being false, class is to be determined later, state starts OPEN:
            significant: default_history_attribute(false),
            stop_reason: default_history_attribute(''),
            class: default_history_attribute(''),
            state: default_history_attribute('OPEN'),
            hlt_key: default_history_attribute(run.hlt_key),
            hlt_physics_counter: default_history_attribute(
                run.hlt_physics_counter
            )
        };

        if (run.hlt_key.value !== null) {
            run = await assign_run_class(run);
        }
        // DATASET TRIPLETS START:
        const run_is_significant = await is_run_significant(run);
        if (run_is_significant) {
            significant_runs += 1;
            const components_status = await assign_component_status(run, now);
            const components_status_renamed = appendToAllAttributes(
                components_status,
                '_triplet'
            );
            run.significant = default_history_attribute(true);
            run = { ...run, ...components_status_renamed };
        }

        await axios.post(`${API_URL}/runs`, run, {
            headers: { email: 'auto' }
        });
    });
    await Promise.all(promises);
    console.log(
        `${
            new_runs.length
        } run(s) saved of which ${significant_runs} were significant`
    );
};
