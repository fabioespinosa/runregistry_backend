const fs = require('fs');
const https = require('https');
const CronJob = require('cron').CronJob;
const axios = require('axios').create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    })
});
const { deepEqual } = require('assert');
const getAttributesSpecifiedFromArray = require('get-attributes-specified-from-array');
const { handleErrors } = require('../utils/error_handlers');
const config = require('../config/config');
const cookie_generator = require('./get_cookie').get_cookie;
const {
    OMS_URL,
    OMS_RUNS,
    API_URL,
    RUNS_PER_API_CALL,
    SECONDS_PER_API_CALL
} = config[process.env.NODE_ENV || 'development'];
const { save_runs } = require('./2.save_runs');
const { update_runs } = require('./3.update_runs');

// These are the attributes we track history from in the OMS API:

// Will call itself recursively if all runs are new
const fetch_runs = async (
    fetch_amount = RUNS_PER_API_CALL,
    first_time = true
) => {
    let headers = {};
    // insert cookie that will authenticate OMS request:
    if (first_time && process.env.ENV === 'production') {
        headers = {
            Cookie: await cookie_generator()
        };
    }

    const oms_response = await axios.get(
        `${OMS_URL}/${OMS_RUNS(fetch_amount)}`,
        {
            headers
        }
    );

    const all_fetched_runs = oms_response.data.data;

    if (typeof all_fetched_runs === 'undefined') {
        throw Error('Invalid cookie in request');
    }
    // all_fetched_runs is an accumulation of all runs, we need to slice it to get the actually new runs in the corresponding request
    let fetched_runs = first_time
        ? all_fetched_runs
        : all_fetched_runs.slice(fetch_amount / 2);

    const { data: last_saved_runs } = await axios.get(`${API_URL}/runs_50`);
    const new_runs = calculate_new_runs(fetched_runs, last_saved_runs);

    // If all runs are new, it means there might've been other previous runs which have not been saved (the arrays are not equal in length)
    // Therefore, it is good to call recursively until at least some run that is fetched was previously fetched and saved, and then save them all.
    if (
        new_runs.length === fetched_runs.length &&
        all_fetched_runs.length < 300
    ) {
        console.log(
            `All fetched runs are new, fetching ${fetch_amount * 2} runs...`
        );
        await fetch_runs(fetch_amount * 2, false);
    } else {
        const runs_to_be_saved = calculate_new_runs(
            all_fetched_runs,
            last_saved_runs
        );
        if (runs_to_be_saved.length > 0) {
            console.log(`saving: ${runs_to_be_saved.length} runs`);
            await save_runs(runs_to_be_saved);
        }
    }

    // Check for runs to update (only on first time):
    if (first_time) {
        const runs_to_update = calculate_runs_to_update(
            fetched_runs,
            last_saved_runs
        );
        // This will minimum include two runs to update (the last two are always updated, unless they just got saved)
        if (runs_to_update.length > 0) {
            update_runs(runs_to_update);
        }
    }
};

if (process.env.NODE_ENV === 'production') {
    const job = new CronJob(
        `*/${SECONDS_PER_API_CALL} * * * * *`,
        handleErrors(fetch_runs, 'Error fetching new runs ')
    ).start();
}

// If in a dev environment we want to do this at least once:
handleErrors(fetch_runs, 'Error fetching new runs')();

// makes left outer join between fetched_runs and last_saved_runs, returns the difference of runs (the ones which have not been saved)
const calculate_new_runs = (fetched_runs, last_saved_runs) => {
    const new_runs = [];
    fetched_runs.forEach(fetched_run => {
        let exists = false;
        // Check if it exists in the already saved runs:
        last_saved_runs.forEach(existing_run => {
            if (+fetched_run.run_number === existing_run.run_number) {
                exists = true;
            }
        });
        // If it does not exist in alreay saved run, check if it exists in the recently created array.
        if (!exists) {
            let already_saved = false;
            new_runs.forEach(run => {
                if (+fetched_run.run_number === +run.run_number) {
                    already_saved = true;
                }
            });
            if (!already_saved) {
                new_runs.push(fetched_run);
            }
        }
    });
    return new_runs;
};

// Calculates runs which have been updated in the relevant attributes (critical_attributes)
const calculate_runs_to_update = (fetched_runs, last_saved_runs) => {
    // Save the first two ids:
    const id_fetched_run_1 = +fetched_runs[0].run_number;
    const id_fetched_run_2 = +fetched_runs[1].run_number;
    const runs_to_update = [];
    fetched_runs.forEach(fetched_run => {
        const new_attributes = fetched_run.attributes;
        last_saved_runs.forEach(existing_run => {
            // if runs are the same (i.e. same run_number), do comparison:
            if (+fetched_run.run_number === +existing_run.run_number) {
                try {
                    deepEqual(existing_run, new_attributes);
                    // Always include the first two to compare:
                    if (
                        +existing_run.run_number === id_fetched_run_1 ||
                        +existing_run.run_number === id_fetched_run_2
                    ) {
                        runs_to_update.push({
                            ...existing_run,
                            ...fetched_run.attributes
                        });
                    }
                } catch (e) {
                    // old attributes !== new attributes, the run has been updated in the relevant attributes, include those in the previous run so that it can compare
                    runs_to_update.push({
                        ...existing_run,
                        ...fetched_run.attributes
                    });
                }
            }
        });
    });
    return runs_to_update;
};
