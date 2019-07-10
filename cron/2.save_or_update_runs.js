const axios = require('axios');
const queue = require('async').queue;
const {
    get_OMS_lumisections
} = require('./saving_updating_runs_lumisections_utils');
const {
    calculate_rr_attributes,
    calculate_rr_lumisections,
    calculate_oms_attributes
} = require('./3.calculate_rr_attributes');
const { API_URL, OMS_URL, OMS_SPECIFIC_RUN } = require('../config/config')[
    process.env.ENV || 'development'
];

// The runs to be saved/updated get here, they await to be classified into cosmics/collision/commission:
// AND check if they are significant
// IF the run is significant, the lumisection component's statuses get assigned
// If some runs didn't got saved, it will try again 4 times.
exports.save_runs = async (new_runs, number_of_tries) => {
    let saved_runs = 0;
    const runs_not_saved = [];
    const promises = new_runs.map(run => async () => {
        try {
            // We get the lumisections from OMS:

            // NORMAL:
            const oms_lumisections = await get_OMS_lumisections(run.run_number);
            // START TEMPORAL (to be used with manual uploader):
            // const oms_lumisections = run.lumisections;
            // delete run.lumisections;
            // END temporal:

            const oms_attributes = await calculate_oms_attributes(
                run,
                oms_lumisections
            );
            // We freeze oms_attributes to prevent them changing later on:
            Object.freeze(oms_lumisections);
            Object.freeze(oms_attributes);
            // NORMAL:
            const rr_attributes = await calculate_rr_attributes(
                oms_attributes,
                oms_lumisections
            );
            // start temporal
            // const rr_attributes = {};
            // end temporal;
            let rr_lumisections = [];
            // Only if the run is significant, do we calculate the component statuses for the run
            if (rr_attributes.significant) {
                rr_lumisections = await calculate_rr_lumisections(
                    oms_attributes,
                    rr_attributes,
                    oms_lumisections
                );
            }

            await axios.post(
                `${API_URL}/runs`,
                {
                    oms_attributes,
                    oms_lumisections,
                    rr_attributes,
                    rr_lumisections
                },
                {
                    headers: {
                        email: 'auto@auto',
                        comment: 'run creation'
                    },
                    maxContentLength: 52428890
                }
            );
            saved_runs += 1;
        } catch (e) {
            runs_not_saved.push(run);
            console.log(`Error saving run ${run.run_number}`);
        }
    });

    // We use 3 workers to save it in first try, if errors, then we want to go slower, just 1:
    const number_of_workers = 1;
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
    runs_to_update,
    number_of_tries,
    { email, comment, manually_significant, previous_rr_attributes }
) => {
    let updated_runs = 0;
    const runs_not_updated = [];
    const promises = runs_to_update.map(run => async () => {
        // We only update a run which state is OPEN
        try {
            // We get the lumisections from OMS:
            const oms_lumisections = await get_OMS_lumisections(run.run_number);
            const oms_attributes = await calculate_oms_attributes(
                run,
                oms_lumisections
            );
            // We freeze oms_attributes to prevent them changing later on:
            Object.freeze(oms_lumisections);
            Object.freeze(oms_attributes);
            const rr_attributes = await calculate_rr_attributes(
                oms_attributes,
                oms_lumisections,
                previous_rr_attributes // If it was manually updated (see method below), this will not be undefined
            );
            let rr_lumisections = [];
            // Only if the run is significant, do we calculate the component statuses for the run
            if (rr_attributes.significant || manually_significant) {
                rr_lumisections = await calculate_rr_lumisections(
                    oms_attributes,
                    rr_attributes,
                    oms_lumisections
                );
            }
            const updated_run = await axios.put(
                `${API_URL}/automatic_run_update/${run.run_number}`,
                {
                    oms_attributes,
                    oms_lumisections,
                    rr_attributes,
                    rr_lumisections
                },
                {
                    // The email HAS to start with auto, or else API won't know it's an automatic change (unless it was manually requested to update)
                    headers: {
                        email: email || 'auto@auto',
                        comment: comment || 'automatic update from OMS'
                    },
                    maxContentLength: 52428890
                }
            );
            if (updated_run.status === 200) {
                // if status is 200 the run was actually updated, if status is 204, the request was processed but there was nothing to update
                updated_runs += 1;
            }
        } catch (e) {
            console.log(`Error updating run ${run.run_number}`);
        }
    });
    if (runs_to_update.length < 10) {
        // If it is less than 10 runs we are refreshing, no need to do a queue
        await Promise.all(promises.map(async promise => await promise()));
    } else {
        // We use 3 workers to save it in first try, if errors, then we want to go slower, just 1:
        const number_of_workers = 1;
        const asyncQueue = queue(async run => await run(), number_of_workers);

        // When runs finished updating:
        asyncQueue.drain = async () => {
            console.log(`${updated_runs} run(s) updated`);
            if (runs_not_updated.length > 0) {
                const run_numbers_of_runs_not_updated = runs_not_updated.map(
                    ({ run_number }) => run_number
                );
                console.log(
                    `WARNING: ${
                        runs_not_updated.length
                    } run(s) were not updated. They are: ${run_numbers_of_runs_not_updated}.`
                );
                console.log('------------------------------');
                console.log('------------------------------');
                if (number_of_tries < 4) {
                    console.log(
                        `TRYING AGAIN: with ${runs_not_updated.length} run(s)`
                    );
                    number_of_tries += 1;
                    await exports.update_runs(
                        runs_not_updated,
                        number_of_tries,
                        {
                            email,
                            comment,
                            manually_significant,
                            previous_rr_attributes
                        }
                    );
                } else {
                    console.log(
                        `After trying 4 times, ${run_numbers_of_runs_not_updated} run(s) were not updated`
                    );
                }
            }
        };

        asyncQueue.error = err => {
            console.log(`Critical error saving runs, ${JSON.stringify(err)}`);
        };

        asyncQueue.push(promises);
    }
};

exports.manually_update_a_run = async (
    run_number,
    { email, comment, manually_significant }
) => {
    // get rr_attributes:
    const { data: saved_run } = await axios.get(
        `${API_URL}/runs/${run_number}`
    );
    const previous_rr_attributes = saved_run.rr_attributes;

    if (previous_rr_attributes.state !== 'OPEN') {
        throw 'Run must be in state OPEN to be refreshed';
    }
    // get oms_attributes:
    const {
        data: { data: fetched_run }
    } = await axios.get(`${OMS_URL}/${OMS_SPECIFIC_RUN(run_number)}`);
    const run_oms_attributes = fetched_run[0].attributes;
    await exports.update_runs([run_oms_attributes], 0, {
        previous_rr_attributes,
        email,
        comment,
        manually_significant
    });
};
