const json_logic_library = require('json-logic-js');
const axios = require('axios');
const config = require('../config/config');
const { API_URL, REDIS_URL } = config[process.env.ENV || 'development'];
const {
  convert_array_of_list_to_array_of_ranges
} = require('golden-json-helpers');
const { http } = require('../app');
const io = require('socket.io')(http);
const { sequelize, Sequelize } = require('../models');
const { format_lumisection } = require('./lumisection');
const pMap = require('p-map');
const Queue = require('bull');

const jsonProcessingQueue = new Queue('json processing', REDIS_URL);

exports.get_jsons = async (req, res) => {
  const jobs = await jsonProcessingQueue.getJobs();
  res.json({ jsons: jobs });
};

exports.calculate_json = async (req, res) => {
  const { json_logic, dataset_name } = req.body;
  if (!json_logic || Object.keys(json_logic).length === 0) {
    throw 'Empty json logic sent';
  }
  if (!dataset_name) {
    throw 'No dataset name specified';
  }
  const datasets = await sequelize.query(
    `
      SELECT name FROM "Dataset"
      WHERE name SIMILAR TO :name
      AND deleted = false
    `,
    {
      type: sequelize.QueryTypes.SELECT,
      replacements: {
        name: dataset_name
      }
    }
  );
  if (datasets.length === 0) {
    throw 'No datasets matched that dataset name';
  }
  const json = await jsonProcessingQueue.add(
    {
      dataset_name,
      json_logic
    },
    { attempts: 5 }
  );
  jsonProcessingQueue.on('progress', (job, progress) => {
    req.io.emit('progress', { job_id: job.id, progress });
    console.log(`internal progress for job ${job.id}`, progress);
  });

  jsonProcessingQueue.on('completed', (job, result) => {
    req.io.emit('completed', { job_id: job.id, result });
    console.log(`completed job ${job.id}: `);
  });
  req.io.emit('new_json_added_to_queue', { job_id: json.id, job: json });
  res.json(json);
};

// TODO-ENHANCEMENT: Add information about job: started at, finished at
jsonProcessingQueue.process(async (job, done) => {
  console.log('started processing job', job.id);
  const { dataset_name, json_logic } = job.data;
  const logic = JSON.parse(json_logic);
  const datasets = await sequelize.query(
    `
      SELECT * FROM "Dataset"
      WHERE name SIMILAR TO :name
      AND deleted = false
    `,
    {
      type: sequelize.QueryTypes.SELECT,
      replacements: {
        name: dataset_name
      }
    }
  );
  const number_of_datasets = datasets.length;
  const generated_json_list = {};
  const generated_json_with_dataset_names_list = {};
  let counter_datasets_processed = 0;
  const mapper = async dataset => {
    const { run_number, name: dataset_name } = dataset;
    const lumisections = await sequelize.query(
      `
      SELECT * FROM "AggregatedLumisection"
      WHERE run_number = :run_number
      AND name = :name
  `,
      {
        type: sequelize.QueryTypes.SELECT,
        replacements: {
          run_number,
          name: dataset_name
        }
      }
    );

    for (let i = 0; i < lumisections.length; i++) {
      const lumisection = format_lumisection(lumisections[i]);
      if (json_logic_library.apply(logic, lumisection)) {
        const { run_number } = lumisection.run;
        const { name } = lumisection.dataset;
        const { lumisection_number } = lumisection.lumisection;

        if (typeof generated_json_list[run_number] === 'undefined') {
          generated_json_list[run_number] = [lumisection_number];
          generated_json_with_dataset_names_list[`${run_number}-${name}`] = [
            lumisection_number
          ];
        } else {
          generated_json_list[run_number].push(lumisection_number);
          generated_json_with_dataset_names_list[`${run_number}-${name}`].push(
            lumisection_number
          );
        }
      }
    }
    counter_datasets_processed += 1;
    // We reserve the last 1% for the last bit
    job.progress((counter_datasets_processed - 1) / number_of_datasets);
  };

  await pMap(datasets, mapper, {
    concurrency: 4
  });

  const generated_json = {};
  const generated_json_with_dataset_names = {};

  for (const [key, val] of Object.entries(generated_json_list)) {
    generated_json[key] = convert_array_of_list_to_array_of_ranges(val);
  }

  for (const [key, val] of Object.entries(
    generated_json_with_dataset_names_list
  )) {
    generated_json_with_dataset_names[
      key
    ] = convert_array_of_list_to_array_of_ranges(val);
  }

  // Finished:
  job.progress(1);
  done(null, { generated_json, generated_json_with_dataset_names });
});

// setTimeout(() => {
//   axios.post(`${API_URL}/json_portal/generate`, {
//     run_min: 300000,
//     run_max: 340000,
//     dataset_name: '/Express/Collisions2018/DQM',
//     json_logic: `
// {
//  "and": [
//        {"==": [{"var": "dataset.name"}, "/Express/Collisions2018/DQM"]},
//    {
//     "or": [
//        {"and": [{"==": [{"var": "lumisection.rr.ctpps-rp45_210"}, "GOOD"]}, {"==": [{"var": "lumisection.rr.ctpps-rp45_220"}, "GOOD"]}]},
//        {"and": [{"==": [{"var": "lumisection.rr.ctpps-rp45_cyl"}, "GOOD"]}, {"==": [{"var": "lumisection.rr.ctpps-rp45_210"}, "GOOD"]}]},
//        {"and": [{"==": [{"var": "lumisection.rr.ctpps-rp45_cyl"}, "GOOD"]}, {"==": [{"var": "lumisection.rr.ctpps-rp45_220"}, "GOOD"]}]},
//        {"and": [{"==": [{"var": "lumisection.rr.ctpps-rp56_210"}, "GOOD"]}, {"==": [{"var": "lumisection.rr.ctpps-rp56_220"}, "GOOD"]}]},
//        {"and": [{"==": [{"var": "lumisection.rr.ctpps-rp56_cyl"}, "GOOD"]}, {"==": [{"var": "lumisection.rr.ctpps-rp56_210"}, "GOOD"]}]},
//        {"and": [{"==": [{"var": "lumisection.rr.ctpps-rp56_cyl"}, "GOOD"]}, {"==": [{"var": "lumisection.rr.ctpps-rp56_220"}, "GOOD"]}]}
//      ]
//    }
// ]
// }

// `
//   });
// }, 2000);
