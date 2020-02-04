const json_logic = require('json-logic-js');
const {
  convert_array_of_list_to_array_of_ranges
} = require('golden-json-helpers');
const { http } = require('../app');
const io = require('socket.io')(http);
const { sequelize, Sequelize } = require('../models');
const { format_lumisection } = require('./lumisection');
const pMap = require('p-map');
const Queue = require('bull');

// const jsonProcessingQueue = new Queue('json processing', 'redis://redis:6379');

exports.calculate_json = async (req, res) => {
  const { golden_json_logic, run_min, run_max, dataset_name } = req.body;
  const json = await jsonProcessingQueue.add(
    {
      run_min,
      run_max,
      dataset_name,
      golden_json_logic
    },
    { attempts: 5 }
  );
  jsonProcessingQueue.on('progress', (job, progress) => {
    console.log(`internal progress for job ${job.id}`, progress);
  });

  jsonProcessingQueue.on('completed', (job, result) => {
    console.log(`completed job ${job.id}: `);
  });
};

// TODO-ENHANCEMENT: Add information about job: started at, finished at
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

// exports.calculate_json({
//   body: {
//     run_min: 300000,
//     run_max: 340000,
//     dataset_name: '/PromptReco/Collisions2018D%',
//     golden_json_logic: `
// {
//   "==": [ {"and": [
//     {">=": [{"var": "run.oms.energy"}, 6000]},
//     {"<=": [{"var": "run.oms.energy"}, 7000]},
//     {">=": [{"var": "run.oms.b_field"}, 3.7]},
//     {"in": ["25ns", {"var": "run.oms.injection_scheme"}]},
//     {"==": [{"in": ["WMass", {"var": "run.oms.hlt_key"}]}, false]},
//     {"==": [{"var": "lumisection.rr.dt-dt"}, "GOOD"]},
//     {"==": [{"var": "lumisection.rr.csc-csc"}, "GOOD"]},
//     {"==": [{"var": "lumisection.rr.l1t-l1tmu"}, "GOOD"]},
//     {"==": [{"var": "lumisection.rr.l1t-l1tcalo"}, "GOOD"]},
//     {"==": [{"var": "lumisection.rr.hlt-hlt"}, "GOOD"]},
//     {"==": [{"var": "lumisection.rr.tracker-pixel"}, "GOOD"]},
//     {"==": [{"var": "lumisection.rr.tracker-strip"}, "GOOD"]},
//     {"==": [{"var": "lumisection.rr.tracker-track"}, "GOOD"]},
//     {"==": [{"var": "lumisection.rr.ecal-ecal"}, "GOOD"]},
//     {"==": [{"var": "lumisection.rr.ecal-es"}, "GOOD"]},
//     {"==": [{"var": "lumisection.rr.hcal-hcal"}, "GOOD"]},
//     {"==": [{"var": "lumisection.rr.muon-muon"}, "GOOD"]},
//     {"==": [{"var": "lumisection.rr.jetmet-jetmet"}, "GOOD"]},
//     {"==": [{"var": "lumisection.rr.lumi-lumi"}, "GOOD"]},
//     {"==": [{"var": "lumisection.rr.dc-lowlumi"}, "BAD"]},
//     {"==": [{"var": "lumisection.oms.cms_active"}, true]},
//     {"==": [{"var": "lumisection.oms.bpix_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.fpix_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.tibtid_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.tecm_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.tecp_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.tob_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.ebm_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.ebp_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.eem_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.eep_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.esm_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.esp_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.hbhea_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.hbheb_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.hbhec_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.hf_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.ho_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.dtm_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.dtp_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.dt0_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.cscm_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.cscp_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.rpc_ready"}, true]},
//     {"==": [{"var": "lumisection.oms.beam1_present"}, true]},
//     {"==": [{"var": "lumisection.oms.beam2_present"}, true]},
//     {"==": [{"var": "lumisection.oms.beam1_stable"}, true]},
//     {"==": [{"var": "lumisection.oms.beam2_stable"}, true]}
//     ]
//     },false]

// }

// `
//   }
// });
