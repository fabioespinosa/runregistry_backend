const axios = require('axios');
const queue = require('async').queue;
const { getLumisectionAttributes } = require('./saving_updating_runs_utils');
const { calculate_rr_attributes } = require('./3.calculate_rr_attributes');
const { API_URL } = require('../config/config')[
    process.env.ENV || 'development'
];

// The runs to be saved/updated get here, they await to be classified into cosmics/collision/commission:
// AND check if they are significant
// IF the run is significant, the component's statuses get assigned
// If some runs didn't got saved, it will try again 1 time.
exports.save_runs = async (new_runs, number_of_tries) => {
    let saved_runs = 0;
    const runs_not_saved = [];
    let promises = new_runs.map(run => async () => {
        try {
            let oms_attributes = run;
            // We aggergate the lumisection information from OMS into the run
            oms_attributes = await getLumisectionAttributes(oms_attributes);
            // We freeze oms_attributes to prevent them changing later on:
            Object.freeze(oms_attributes);

            const rr_attributes = await calculate_rr_attributes(oms_attributes);

            await axios.post(
                `${API_URL}/runs`,
                { oms_attributes, rr_attributes },
                {
                    headers: {
                        email: 'auto@auto',
                        comment: 'run creation - appeared in OMS'
                    }
                }
            );
            saved_runs += 1;
        } catch (e) {
            runs_not_saved.push(run);
            console.log(`Error saving run ${run.run_number}`);
        }
    });

    // We use 80 workers to save it in first try, if errors, then we want to go slower, just 1:
    const number_of_workers = number_of_tries === 0 ? 80 : 1;
    const asyncQueue = queue(async run => await run(), number_of_workers);

    // When runs finished saving:
    asyncQueue.drain = async () => {
        console.log(`${saved_runs} run(s) saved`);
        if (runs_not_saved.length > 0) {
            const run_numbers_of_runs_not_saved = runs_not_saved.map(
                ({ run_number }) => run_number
            );
            console.log(
                `WARNING: ${
                    runs_not_saved.length
                } run(s) were not saved. They are: ${run_numbers_of_runs_not_saved}.`
            );
            console.log('------------------------------');
            console.log('------------------------------');
            if (number_of_tries < 4) {
                console.log(
                    `TRYING AGAIN: with ${runs_not_saved.length} run(s)`
                );
                number_of_tries += 1;
                await exports.save_runs(runs_not_saved, number_of_tries);
            } else {
                console.log(
                    `After trying 4 times, ${run_numbers_of_runs_not_saved} run(s) were not saved`
                );
            }
        }
    };

    asyncQueue.error = err => {
        console.log(`Critical error saving runs, ${JSON.stringify(err)}`);
    };

    asyncQueue.push(promises);
};

exports.update_runs = async (
    new_runs,
    email_refreshing,
    manually_significant
) => {
    const promises = new_runs.map(async run => {
        try {
            let oms_attributes = run;
            // We aggergate the lumisection information from OMS into the run
            oms_attributes = await getLumisectionAttributes(oms_attributes);
            // We freeze oms_attributes to prevent them changing later on:
            Object.freeze(oms_attributes);
            const rr_attributes = await calculate_rr_attributes(
                oms_attributes,
                manually_significant
            );
            await axios.put(
                `${API_URL}/runs/${run.run_number}`,
                { oms_attributes, rr_attributes },
                {
                    // The email HAS to start with auto, or else API won't know it's an automatic change
                    headers: {
                        email: email_refreshing || 'auto@auto',
                        comment: email_refreshing
                            ? `update from OMS requested by ${email_refreshing}`
                            : 'automatic update from OMS'
                    }
                }
            );
        } catch (e) {
            console.log(`Error updating run ${run.run_number}`);
        }
    });
    await Promise.all(promises);
};
