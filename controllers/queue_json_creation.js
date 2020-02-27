// const json_logic = require('json-logic-js');
// const axios = require('axios');
// const config = require('../config/config');
// const { API_URL, REDIS_URL } = config[process.env.ENV || 'development'];
// const {
//   convert_array_of_list_to_array_of_ranges
// } = require('golden-json-helpers');
// const { http } = require('../app');
// const io = require('socket.io')(http);
// const { sequelize, Sequelize } = require('../models');
// const { format_lumisection } = require('./lumisection');
// const pMap = require('p-map');
// const Queue = require('bull');

// const jsonProcessingQueue = new Queue('json processing', REDIS_URL);

// exports.get_jsons = async (req, res) => {
//   const jobs = await jsonProcessingQueue.getJobs();
//   res.json({ jsons: jobs });
// };

// exports.calculate_json = async (req, res) => {
//   const { golden_json_logic, run_min, run_max, dataset_name } = req.body;
//   const json = await jsonProcessingQueue.add(
//     {
//       run_min,
//       run_max,
//       dataset_name,
//       golden_json_logic
//     },
//     { attempts: 5 }
//   );
//   jsonProcessingQueue.on('progress', (job, progress) => {
//     req.io.emit('progress', { job_id: job.id, progress });
//     console.log(`internal progress for job ${job.id}`, progress);
//   });

//   jsonProcessingQueue.on('completed', (job, result) => {
//     req.io.emit('completed', { job_id: job.id, result });
//     console.log(`completed job ${job.id}: `);
//   });
// };

// // TODO-ENHANCEMENT: Add information about job: started at, finished at
// jsonProcessingQueue.process(async (job, done) => {
//   console.log('started processing job', job.id);
//   const { run_min, run_max, dataset_name, golden_json_logic } = job.data;
//   const logic = JSON.parse(golden_json_logic);
//   const datasets = await sequelize.query(
//     `
//       SELECT * FROM "Dataset"
//       WHERE run_number >= :run_min AND run_number <= :run_max
//       AND name like :name
//     `,
//     {
//       type: sequelize.QueryTypes.SELECT,
//       replacements: {
//         run_min,
//         run_max,
//         name: dataset_name
//       }
//     }
//   );
//   const number_of_datasets = datasets.length;
//   const generated_json_list = {};
//   const generated_json_with_dataset_names_list = {};
//   let counter_datasets_processed = 0;
//   const mapper = async dataset => {
//     const { run_number, name: dataset_name } = dataset;
//     const lumisections = await sequelize.query(
//       `
//       SELECT * FROM "AggregatedLumisection"
//       WHERE run_number = :run_number
//       AND name = :name
//   `,
//       {
//         type: sequelize.QueryTypes.SELECT,
//         replacements: {
//           run_number,
//           name: dataset_name
//         }
//       }
//     );

//     for (let i = 0; i < lumisections.length; i++) {
//       const lumisection = format_lumisection(lumisections[i]);
//       if (json_logic.apply(logic, lumisection)) {
//         const { run_number } = lumisection.run;
//         const { name } = lumisection.dataset;
//         const { lumisection_number } = lumisection.lumisection;

//         if (typeof generated_json_list[run_number] === 'undefined') {
//           generated_json_list[run_number] = [lumisection_number];
//           generated_json_with_dataset_names_list[`${run_number}-${name}`] = [
//             lumisection_number
//           ];
//         } else {
//           generated_json_list[run_number].push(lumisection_number);
//           generated_json_with_dataset_names_list[`${run_number}-${name}`].push(
//             lumisection_number
//           );
//         }
//       }
//     }
//     counter_datasets_processed += 1;
//     // We reserve the last 1% for the last bit
//     job.progress((counter_datasets_processed - 1) / number_of_datasets);
//   };

//   await pMap(datasets, mapper, {
//     concurrency: 4
//   });

//   const generated_json = {};
//   const generated_json_with_dataset_names = {};

//   for (const [key, val] of Object.entries(generated_json_list)) {
//     generated_json[key] = convert_array_of_list_to_array_of_ranges(val);
//   }

//   for (const [key, val] of Object.entries(
//     generated_json_with_dataset_names_list
//   )) {
//     generated_json_with_dataset_names[
//       key
//     ] = convert_array_of_list_to_array_of_ranges(val);
//   }

//   // Finished:
//   job.progress(1);
//   done(null, { generated_json, generated_json_with_dataset_names });
// });

// // setTimeout(() => {
// //   axios.post(`${API_URL}/json_portal/generate`, {
// //     run_min: 300000,
// //     run_max: 340000,
// //     dataset_name: '/Express/Collisions2018/DQM',
// //     golden_json_logic: `
// // {
// //  "and": [
// //        {"==": [{"var": "dataset.name"}, "/Express/Collisions2018/DQM"]},
// //    {
// //     "or": [
// //        {"and": [{"==": [{"var": "lumisection.rr.ctpps-rp45_210"}, "GOOD"]}, {"==": [{"var": "lumisection.rr.ctpps-rp45_220"}, "GOOD"]}]},
// //        {"and": [{"==": [{"var": "lumisection.rr.ctpps-rp45_cyl"}, "GOOD"]}, {"==": [{"var": "lumisection.rr.ctpps-rp45_210"}, "GOOD"]}]},
// //        {"and": [{"==": [{"var": "lumisection.rr.ctpps-rp45_cyl"}, "GOOD"]}, {"==": [{"var": "lumisection.rr.ctpps-rp45_220"}, "GOOD"]}]},
// //        {"and": [{"==": [{"var": "lumisection.rr.ctpps-rp56_210"}, "GOOD"]}, {"==": [{"var": "lumisection.rr.ctpps-rp56_220"}, "GOOD"]}]},
// //        {"and": [{"==": [{"var": "lumisection.rr.ctpps-rp56_cyl"}, "GOOD"]}, {"==": [{"var": "lumisection.rr.ctpps-rp56_210"}, "GOOD"]}]},
// //        {"and": [{"==": [{"var": "lumisection.rr.ctpps-rp56_cyl"}, "GOOD"]}, {"==": [{"var": "lumisection.rr.ctpps-rp56_220"}, "GOOD"]}]}
// //      ]
// //    }
// // ]
// // }

// // `
// //   });
// // }, 2000);
