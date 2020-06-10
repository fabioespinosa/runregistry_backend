const { Sequelize, sequelize, Dataset } = require('../models');
const _ = require('lodash');
const fs = require('fs');
const https = require('https');
const CronJob = require('cron').CronJob;
const axios = require('axios').create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
    cert: fs.readFileSync('./cron_datasets/usercert.pem'),
    key: fs.readFileSync('./cron_datasets/userkey.pem'),
    passphrase: 'passphrase',
  }),
});
const splitRegex = require('./pinging_utils').splitRegex;
const { handleErrors } = require('../utils/error_handlers');
const {
  API_URL,
  DQM_GUI_URL,
  SECONDS_PER_DQM_GUI_CHECK,
} = require('../config/config')[process.env.ENV || 'development'];
const { update_or_create_dataset } = require('../controllers/dataset');
const { create_new_version } = require('../controllers/version');

const { Op } = Sequelize;

const promiseSerial = (funcs) =>
  funcs.reduce(
    (promise, func) =>
      promise.then((result) =>
        func().then(Array.prototype.concat.bind(result))
      ),
    Promise.resolve([])
  );

const get_all_datasets_in_gui = async () => {
  let all_datasets_in_gui;
  if (process.env.NODE_ENV === 'production') {
    const { data } = await axios.get(`${DQM_GUI_URL}*.`);
    all_datasets_in_gui = data;
  } else {
    all_datasets_in_gui = JSON.parse(
      fs.readFileSync('./cron_datasets/full_gui_sample.json', 'utf8')
    );
  }
  all_datasets_in_gui = all_datasets_in_gui.samples[0].items;

  const run_numbers_dataset = {};
  all_datasets_in_gui.forEach(({ run, dataset }) => {
    if (typeof run_numbers_dataset[run] === 'undefined') {
      run_numbers_dataset[run] = [dataset];
    } else {
      run_numbers_dataset[run].push(dataset);
    }
  });
  return run_numbers_dataset;
};

const get_all_datasets_in_rr = async () => {
  return await Dataset.findAll({
    where: {
      name: { [Op.ne]: 'online' },
    },
    attributes: ['run_number', 'name', 'datasets_in_gui'],
    order: [
      ['run_number', 'ASC'],
      ['name', 'ASC'],
    ],
  });
};

const get_datasets_accepted = async () => {
  let { data: datasets_accepted } = await axios.get(
    `${API_URL}/datasets_accepted`
  );

  return _.chain(datasets_accepted).groupBy('name').value();
};

const ping_dqm_gui = async () => {
  let transaction;
  try {
    // transaction = await sequelize.transaction();
    // const { atomic_version } = await create_new_version({
    //   req: { email: 'auto@auto' },
    //   transaction,
    //   comment: 'new dataset appeared pinging gui',
    // });
    const datasets_accepted = await get_datasets_accepted();
    const all_datasets_in_rr = await get_all_datasets_in_rr();
    const all_datasets_in_gui = await get_all_datasets_in_gui();

    const runs_with_new_datasets_in_gui = {};
    const promises = all_datasets_in_rr.map(
      ({ run_number, name, datasets_in_gui }) => async () => {
        const datasets_accepted_by_name = datasets_accepted[name] || [];
        const current_datasets_in_gui =
          all_datasets_in_gui[`${run_number}`] || [];
        const future_datasets_in_gui = new Set();
        datasets_accepted_by_name.forEach(
          ({ regexp, enabled, run_from, run_to }) => {
            if (enabled && run_from <= run_number && run_number <= run_to) {
              const regexs = splitRegex(regexp);
              regexs.forEach((regexp) => {
                regexp = new RegExp(regexp.trim());
                current_datasets_in_gui.forEach((dataset_in_gui) => {
                  if (
                    regexp.test(dataset_in_gui) &&
                    !datasets_in_gui.includes(dataset_in_gui)
                  ) {
                    future_datasets_in_gui.add(dataset_in_gui);
                  }
                });
              });
            }
          }
        );
        if (future_datasets_in_gui.size > 0) {
          // insert into DB:
          await update_or_create_dataset({
            dataset_name: name,
            run_number,
            dataset_metadata: {},
            datasets_in_gui: Array.from(future_datasets_in_gui),
            atomic_version: 141303,
            // transaction,
          });
          // runs_with_new_datasets_in_gui[`${run_number}-${name}`] = Array.from(
          //   future_datasets_in_gui
          // );
        }
      }
    );
    await promiseSerial(promises);
    console.log('finished');
    // await transaction.commit();
  } catch (err) {
    console.log(err.message);
    await transaction.rollback();
  }

  // await promiseSerial(promises);
  // // Get full sample of GUI:
  // const datasets_to_save_in_gui = [];
  // const datasets_accepted_promises = datasets_accepted.map(
  //   (dataset_accepted) => async () => {
  //     if (dataset_accepted.enabled) {
  //       const regexs = splitRegex(dataset_accepted.regexp);
  //       const regexs_promises = regexs.map((regexp) => async () => {
  //         try {
  //           regexp = new RegExp(regexp.trim());
  //           const { data } = await axios.get(`${DQM_GUI_URL}${regexp}`);
  //           // The response from dqm gui comes like this, therefore, we need to parse it in the following line:
  //           //{
  //           //      samples: [
  //           //          {
  //           //              type: "offline_data",
  //           //              items: [
  //           //                  {
  //           //                      type: "offline_data",
  //           //                      run: "271861",
  //           //                      dataset: "/Cosmics/Run2016B-PromptReco-v1/DQMIO",
  //           //                      version: "",
  //           //                      importversion: 1
  //           //                  },
  //           //                  {
  //           //                      ...
  //           //                  }
  //           //              ]
  //           //      ]
  //           //}

  //           data.samples[0].items.forEach((available_dataset) => {
  //             // If the dataset that appeared in DQM GUI matches one that is pending, then we can mark it as 'APPEARED IN DQM GUI'
  //             datasets_waiting.forEach((dataset_waiting) => {
  //               if (
  //                 +available_dataset.run === dataset_waiting.run_number &&
  //                 dataset_accepted.name === dataset_waiting.name
  //               ) {
  //                 // The dataset has appeared in DQM GUI:
  //                 datasets_to_save_in_gui.push(dataset_waiting);
  //               }
  //             });
  //           });
  //         } catch (e) {
  //           console.log(e);
  //         }
  //       });
  //       await promiseSerial(regexs_promises);
  //     }
  //   }
  // );

  // await promiseSerial(datasets_accepted_promises);
  // console.log(datasets_to_save_in_gui);
  // const promises = datasets_to_save_in_gui.map(
  //   (dataset_waiting) => async () => {
  //     try {
  //       await axios.post(
  //         `${API_URL}/dataset_appeared_in_dqm_gui`,
  //         {
  //           run_number: dataset_waiting.run_number,
  //           dataset_name: dataset_waiting.name,
  //         },
  //         {
  //           headers: {
  //             email: 'auto@auto',
  //             comment: 'Dataset appeared in DQM GUI',
  //           },
  //         }
  //       );
  //     } catch (e) {
  //       console.log(e);
  //     }
  //   }
  // );
  // await promiseSerial(promises);
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
