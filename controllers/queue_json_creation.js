const json_logic_library = require('json-logic-js');
const axios = require('axios');
const config = require('../config/config');
const { API_URL, REDIS_URL } = config[process.env.ENV || 'development'];
const {
  convert_array_of_list_to_array_of_ranges,
} = require('golden-json-helpers');
const { http } = require('../app');
const io = require('socket.io')(http);
const { sequelize, Sequelize, GeneratedJson, Version } = require('../models');
const { format_lumisection } = require('./lumisection');
const pMap = require('p-map');
const Queue = require('bull');
const { getMaxIdPlusOne } = require('../utils/model_tools');

const jsonProcessingQueue = new Queue('json processing', REDIS_URL);

exports.get_jsons = async (req, res) => {
  // TODO: paginate
  const failed = await jsonProcessingQueue.getFailed();
  const waiting = await jsonProcessingQueue.getWaiting();
  const active = await jsonProcessingQueue.getActive();
  const saved_jsons = await GeneratedJson.findAll();
  const jsons = [
    ...failed.map(({ id, data, failedReason }) => ({
      ...data,
      id,
      failedReason,
      progress: 0,
      active: false,
      waiting: false,
      failed: true,
    })),
    ...waiting.map(({ id, _progress, data }) => ({
      ...data,
      id,
      progress: _progress,
      active: false,
      waiting: true,
      failed: false,
    })),
    ...active.map(({ id, _progress, data }) => ({
      ...data,
      id,
      progress: _progress,
      active: true,
      waiting: false,
      failed: false,
    })),
    ...saved_jsons.map(({ dataValues }) => ({
      ...dataValues,
      progress: 1,
      active: false,
      waiting: false,
      failed: false,
    })),
  ];
  res.json({ jsons: jsons });
};

exports.calculate_json = async (req, res) => {
  const { json_logic, dataset_name_filter, tags, official } = req.body;
  const created_by = req.get('email');
  let parsed_json;
  try {
    parsed_json = JSON.parse(json_logic);
  } catch (err) {
    throw `JSON logic sent is not in json format`;
  }
  if (!parsed_json || Object.keys(parsed_json).length === 0) {
    throw 'Empty json logic sent';
  }
  if (!dataset_name_filter) {
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
        name: dataset_name_filter,
      },
    }
  );
  if (datasets.length === 0) {
    throw 'No datasets matched that dataset name';
  }

  // We select the sequence from the table:
  const [{ nextval }] = await sequelize.query(
    `SELECT nextval('"GeneratedJson_id_seq"')`,
    {
      type: sequelize.QueryTypes.SELECT,
    }
  );

  const json = await jsonProcessingQueue.add(
    {
      dataset_name_filter,
      json_logic: parsed_json,
      created_by,
      tags: tags || '',
      official: official || false,
    },
    { jobId: +nextval, attempts: 5 }
  );
  jsonProcessingQueue.on('progress', (job, progress) => {
    req.io.emit('progress', { id: job.id, progress });
    console.log(`internal progress for job ${job.id}`, progress);
  });

  jsonProcessingQueue.on('completed', (job, result) => {
    req.io.emit('completed', { id: job.id, result });
    console.log(`completed job ${job.id}: `);
  });
  req.io.emit('new_json_added_to_queue', { id: json.id, job: json });
  res.json(json);
};

// TODO-ENHANCEMENT: Add information about job: started at, finished at
jsonProcessingQueue.process(async (job, done) => {
  console.log('started processing job', job.id);
  const { dataset_name_filter, json_logic } = job.data;
  const datasets = await sequelize.query(
    `
      SELECT * FROM "Dataset"
      WHERE name SIMILAR TO :name
      AND deleted = false
    `,
    {
      type: sequelize.QueryTypes.SELECT,
      replacements: {
        name: dataset_name_filter,
      },
    }
  );
  const number_of_datasets = datasets.length;
  const generated_json_list = {};
  const generated_json_with_dataset_names_list = {};
  let counter_datasets_processed = 0;
  const mapper = async (dataset) => {
    const { run_number, name: dataset_name_filter } = dataset;
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
          name: dataset_name_filter,
        },
      }
    );

    for (let i = 0; i < lumisections.length; i++) {
      const lumisection = format_lumisection(lumisections[i]);
      if (json_logic_library.apply(json_logic, lumisection)) {
        const { run_number } = lumisection.run;
        const { name } = lumisection.dataset;
        const { lumisection_number } = lumisection.lumisection;

        if (typeof generated_json_list[run_number] === 'undefined') {
          generated_json_list[run_number] = [lumisection_number];
          generated_json_with_dataset_names_list[`${run_number}-${name}`] = [
            lumisection_number,
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
    concurrency: 4,
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

  // Obtain latest RR version
  const runregistry_version = await Version.max('atomic_version');

  // Add to database:
  const { by, tags, official } = job.data;
  const saved_json = GeneratedJson.create({
    id: job.id,
    dataset_name_filter: dataset_name_filter,
    tags,
    created_by: by,
    official,
    runregistry_version,
    json_logic,
    generated_json,
    generated_json_with_dataset_names,
    anti_json: {},
    deleted: false,
  });

  // Finished:
  job.progress(1);
  done(null, { generated_json, generated_json_with_dataset_names });
});
