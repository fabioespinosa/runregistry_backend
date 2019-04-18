const fs = require('fs');
const https = require('https');
const CronJob = require('cron').CronJob;
const axios = require('axios').create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false,
        cert: fs.readFileSync('./cron_datasets/usercert.pem'),
        key: fs.readFileSync('./cron_datasets/userkey.pem'),
        passphrase: 'passphrase'
    })
});
const splitRegex = require('./pinging_utils').splitRegex;
const { handleErrors } = require('../utils/error_handlers');
const {
    API_URL,
    DQM_GUI_URL,
    SECONDS_PER_DQM_GUI_CHECK
} = require('../config/config')[process.env.ENV || 'development'];

const promiseSerial = funcs =>
    funcs.reduce(
        (promise, func) =>
            promise.then(result =>
                func().then(Array.prototype.concat.bind(result))
            ),
        Promise.resolve([])
    );

const ping_dqm_gui = async () => {
    const { data: datasets_accepted } = await axios.get(
        `${API_URL}/datasets_accepted`
    );
    const { data: datasets_waiting } = await axios.get(
        `${API_URL}/datasets_waiting`
    );
    const datasets_to_save_in_gui = [];
    const datasets_accepted_promises = datasets_accepted.map(
        dataset_accepted => async () => {
            if (dataset_accepted.enabled) {
                const regexs = splitRegex(dataset_accepted.regexp);
                const regexs_promises = regexs.map(regexp => async () => {
                    try {
                        const { data } = await axios.get(
                            `${DQM_GUI_URL}${regexp}`
                        );
                        regexp = new RegExp(regexp.trim());
                        // The response from dqm gui comes like this, therefore, we need to parse it in the following line:
                        //{
                        //      samples: [
                        //          {
                        //              type: "offline_data",
                        //              items: [
                        //                  {
                        //                      type: "offline_data",
                        //                      run: "271861",
                        //                      dataset: "/Cosmics/Run2016B-PromptReco-v1/DQMIO",
                        //                      version: "",
                        //                      importversion: 1
                        //                  },
                        //                  {
                        //                      ...
                        //                  }
                        //              ]
                        //      ]
                        //}

                        data.samples[0].items.forEach(available_dataset => {
                            // If the dataset that appeared in DQM GUI matches one that is pending, then we can mark it as 'APPEARED IN DQM GUI'
                            datasets_waiting.forEach(dataset_waiting => {
                                if (
                                    +available_dataset.run ===
                                        dataset_waiting.run_number &&
                                    dataset_accepted.name ===
                                        dataset_waiting.name
                                ) {
                                    // The dataset has appeared in DQM GUI:
                                    datasets_to_save_in_gui.push(
                                        dataset_waiting
                                    );
                                }
                            });
                        });
                    } catch (e) {
                        console.log(e);
                    }
                });
                await promiseSerial(regexs_promises);
            }
        }
    );

    await promiseSerial(datasets_accepted_promises);
    console.log(datasets_to_save_in_gui);
    const promises = datasets_to_save_in_gui.map(
        dataset_waiting => async () => {
            try {
                await axios.post(
                    `${API_URL}/dataset_appeared_in_dqm_gui`,
                    {
                        run_number: dataset_waiting.run_number,
                        dataset_name: dataset_waiting.name
                    },
                    {
                        headers: {
                            email: 'auto@auto',
                            comment: 'Dataset appeared in DQM GUI'
                        }
                    }
                );
            } catch (e) {
                console.log(e);
            }
        }
    );
    await promiseSerial(promises);
};

// Cron job starts:
if (process.env.NODE_ENV !== 'development') {
    const job = new CronJob(
        `*/${SECONDS_PER_DQM_GUI_CHECK} * * * * *`,
        handleErrors(ping_dqm_gui, 'Error pinging DQM GUI')
    ).start();
}

// For development:
ping_dqm_gui();
