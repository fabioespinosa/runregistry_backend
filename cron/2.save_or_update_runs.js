const axios = require('axios');
const { calculate_rr_attributes } = require('./3.calculate_rr_attributes');
const { API_URL } = require('../config/config')[
    process.env.NODE_ENV || 'development'
];

// The runs to be saved/updated get here, they await to be classified into cosmics/collision/commission:
// AND check if they are significant
// IF the run is significant, the component's statuses get assigned
exports.save_runs = async new_runs => {
    let significant_runs = 0;
    // the timestamp is calculated once for every set of runs we will saved (so that we know they were saved at the same timestamp);
    const now = Date.now();
    const promises = new_runs.map(async run => {
        try {
            const oms_attributes = run;
            // We don't want to accidentally alter the attributes we get from OMS, so we freeze them:
            Object.freeze(oms_attributes);
            const rr_attributes = await calculate_rr_attributes(
                oms_attributes,
                now
            );
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

exports.update_runs = async (
    new_runs,
    email_refreshing,
    manually_significant
) => {
    const now = Date.now();
    const promises = new_runs.map(async run => {
        try {
            const oms_attributes = run;
            // We don't want to accidentally alter the attributes we get from OMS, so we freeze them:
            Object.freeze(oms_attributes);
            const rr_attributes = await calculate_rr_attributes(
                oms_attributes,
                now,
                manually_significant
            );
            await axios.put(
                `${API_URL}/runs/${run.run_number}`,
                { oms_attributes, rr_attributes },
                {
                    // The email HAS to start with auto, or else API won't know it's an automatic change
                    headers: {
                        email:
                            email_refreshing ||
                            'auto (run updated automatically)'
                    }
                }
            );
        } catch (e) {
            console.log(`Error updating run ${run.run_number}`);
            console.log(e);
        }
    });
    await Promise.all(promises);
};
