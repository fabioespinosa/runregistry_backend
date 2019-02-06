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
const getObjectWithAttributesThatChanged = require('get-object-with-attributes-that-changed');
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
const { save_runs, update_runs } = require('./2.save_or_update_runs');

let headers = {
    Cookie:
        '_shibsession_64656661756c7468747470733a2f2f636d736f6d732e6365726e2e63682f53686962626f6c6574682e73736f2f41444653=_43d62519f85553627613c6f8e16be277'
};

// Will call itself recursively if all runs are new
const fetch_runs = async (
    fetch_amount = RUNS_PER_API_CALL,
    first_time = true
) => {
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
    if (typeof oms_response.data.data === 'undefined') {
        throw Error('Invalid cookie in request');
    }

    let all_fetched_runs = oms_response.data.data.map(
        ({ attributes }) => attributes
    );

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

// Calculates runs which have been updated in any of the OMS attributes
const calculate_runs_to_update = (fetched_runs, last_saved_runs) => {
    const runs_to_update = [];
    fetched_runs.forEach(fetched_run => {
        last_saved_runs.forEach(existing_run => {
            // if runs are the same (i.e. same run_number), do comparison:
            if (+fetched_run.run_number === +existing_run.run_number) {
                // If something changed (the object with attributes that changed has one or more properties), we update it
                const new_attributes = getObjectWithAttributesThatChanged(
                    existing_run.oms_attributes,
                    fetched_run
                );
                // If the object has one or more properties:
                if (Object.keys(new_attributes).length > 0) {
                    runs_to_update.push(fetched_run);
                }
            }
        });
    });
    return runs_to_update;
};
