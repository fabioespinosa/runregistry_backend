const changeNameOfAllKeys = require('change-name-of-all-keys');
const sequelize = require('../models').sequelize;
const Cycle = require('../models').Cycle;
const CycleDataset = require('../models').CycleDataset;
const Dataset = require('../models').Dataset;
const Run = require('../models').Run;
const Sequelize = require('../models').Sequelize;
const { moveDataset } = require('./dataset');
const { Op } = Sequelize;
const { calculate_dataset_filter_and_include } = require('./dataset');
const conversion_operator = {
  and: Op.and,
  or: Op.or,
  '>': Op.gt,
  '<': Op.lt,
  '>=': Op.gte,
  '<=': Op.lte,
  like: Op.iLike,
  notlike: Op.notILike,
  '=': Op.eq,
  '<>': Op.ne,
  // In uppercase as well:
  AND: Op.and,
  OR: Op.or,
  LIKE: Op.iLike,
  NOTLIKE: Op.notLike
};

exports.getOneInternal = async id_cycle => {
  let cycle = await Cycle.findByPk(id_cycle, {
    include: [
      {
        model: CycleDataset,
        include: [{ model: Dataset }]
      }
    ],
    where: {
      deleted: false
    }
  });

  let datasets = [];
  cycle.dataValues.CycleDataset.forEach(({ Datasets }) => {
    datasets = [...datasets, ...Datasets];
  });
  cycle.datasets = datasets;
  return cycle;
};

exports.add = async (req, res) => {
  const { cycle_attributes, deadline, filter } = req.body;
  let transaction;
  try {
    transaction = await sequelize.transaction();

    const cycle = await Cycle.create(
      {
        cycle_attributes: cycle_attributes || {},
        deadline,
        deleted: false
      },
      { transaction }
    );
    const { id_cycle } = cycle;
    // A filter comes, and we must reproduce that filter to get the dataset that were displayed on the lower table to add them to the cycle
    const [calculated_filter, include] = calculate_dataset_filter_and_include(
      filter
    );

    const selected_datasets = await Dataset.findAll({
      where: calculated_filter,
      include
    });
    if (selected_datasets.length === 0) {
      throw `No dataset found for filter criteria, select at least 1 dataset`;
    }
    if (selected_datasets.length > 1000) {
      throw `Too much datasets, maximum is 1000`;
    }

    const datasets_promises = selected_datasets.map(
      async ({ run_number, name }) => {
        if (!run_number || !name) {
          throw 'run_number and name of the dataset must be valid';
        }
        if (name === 'online') {
          throw 'Online dataset cannot be part of a cycle';
        }
        const cycle_datasets = await CycleDataset.create(
          {
            id_cycle,
            run_number,
            name
          },
          { transaction }
        );
      }
    );
    await Promise.all(datasets_promises);
    await transaction.commit();
    const saved_cycle = await exports.getOneInternal(id_cycle);
    res.json(saved_cycle);
  } catch (err) {
    console.log(err);
    await transaction.rollback();
    throw `Error creating cycle: ${err}`;
  }
};
exports.getAll = async (req, res) => {
  const { workspace } = req.params;
  const workspace_state = `cycle_attributes.${workspace}_state`;
  let cycles = await Cycle.findAll({
    include: [
      {
        model: CycleDataset,
        include: [{ model: Dataset }]
      }
    ],
    where: {
      deleted: false
    },
    order: [
      [sequelize.json(`cycle_attributes.${workspace_state}`), 'desc'],
      ['deadline', 'asc']
    ]
  });
  // To add the datasets property to each cycle:
  cycles = cycles.map(({ dataValues }) => {
    const { CycleDataset } = dataValues;
    let datasets = [];
    CycleDataset.forEach(({ Datasets }) => {
      datasets = [...datasets, ...Datasets];
    });
    return {
      ...dataValues,
      datasets
    };
  });
  res.json(cycles);
};

exports.getOne = async (req, res) => {
  const cycle = await exports.getOneInternal(req.body.id_cycle);
  res.json(cycle);
};

exports.delete = async (req, res) => {
  const { id_cycle } = req.body;
  const cycle_to_delete = await Cycle.findByPk(id_cycle);
  if (cycle_to_delete.deleted) {
    throw 'Cycle already deleted';
  }
  const updated_cycle = await cycle_to_delete.update({ deleted: true });
  res.json(updated_cycle);
};
exports.addDatasetsToCycle = async (req, res) => {};

exports.deleteDatasetFromCycle = async (req, res) => {};

exports.signOffDatasetsInCycle = async (req, res) => {};

exports.moveCycleBackToPending = async (req, res) => {
  const { workspace } = req.params;
  const { id_cycle } = req.body;
  const cycle = await exports.getOneInternal(id_cycle);
  const { cycle_attributes } = cycle;
  // A cycle cannnot be moved back to PENDING unless it is PENDING in the global workspace first.
  if (
    workspace !== 'global' &&
    cycle_attributes['global_state'] === 'completed'
  ) {
    throw `Cycle with id ${id_cycle} can't be moved back to PENDING since it is marked completed in global workspace. Ask DC Expert to move cycle back to PENDING in global workspace and then proceed`;
  }
  cycle.cycle_attributes = {
    ...cycle.cycle_attributes,
    [`${workspace}_state`]: 'pending'
  };
  const saved_cycle = await cycle.update({
    cycle_attributes: cycle.cycle_attributes
  });

  res.json(saved_cycle);
};

exports.markCycleCompletedInWorkspace = async (req, res) => {
  const { workspace } = req.params;
  const { id_cycle } = req.body;
  const cycle = await exports.getOneInternal(id_cycle);
  if (cycle === null) {
    throw 'Cycle not found';
  }

  // If cycle is global, it shall be completed in all other workspaces before being marked complete in global:
  const states_still_open = [];
  if (workspace === 'global') {
    for (const [key, state] of Object.entries(cycle.cycle_attributes)) {
      if (key !== 'global_state' && key.includes('_state')) {
        if (state !== 'completed') {
          states_still_open.push(key.split('_state')[0]);
        }
      }
    }
  }
  if (states_still_open.length > 0) {
    throw `You cannot mark this cycle as completed in the GLOBAL workspace, as it has not yet been moved to completed in ${states_still_open.join(
      ', '
    )} workspace(s)`;
  }

  // Validate if all datasets inside are moved to complete:
  cycle.datasets.forEach(({ run_number, name, dataset_attributes }) => {
    if (
      typeof dataset_attributes[`${workspace}_state`] !== 'undefined' &&
      dataset_attributes[`${workspace}_state`] !== 'COMPLETED'
    ) {
      throw `There is at least one dataset inside this cycle that has not been moved to completed: The dataset with name: ${name} and run number: ${run_number}, has not been moved to completed. Cycle cannot be marked completed.`;
    }
  });
  cycle.cycle_attributes = {
    ...cycle.cycle_attributes,
    [`${workspace}_state`]: 'completed'
  };
  const saved_cycle = await cycle.update({
    cycle_attributes: cycle.cycle_attributes
  });
  res.json(saved_cycle);
};

exports.moveDataset = async (req, res) => {
  const { workspace } = req.params;
  const { id_cycle, run_number, dataset_name } = req.body;
  const cycle = await exports.getOneInternal(id_cycle);
  const exists = cycle.datasets.some(
    dataset =>
      dataset.run_number === run_number && dataset.name === dataset_name
  );
  if (!exists) {
    throw `Dataset ${run_number}-${datase_name} does not belong to cycle ${id_cycle}`;
  }
  if (cycle === null) {
    throw `Cycle does not exist`;
  }
  if (typeof cycle.cycle_attributes[`${workspace}_state`] === 'undefined') {
    throw `Cycle does not exist in workspace ${workspace}`;
  }
  if (cycle.cycle_attributes[`${workspace}_state`] === 'completed') {
    throw `This cycle has already been marked COMPLETED, therefore you cannot change the state of the dataset unless you change the state of the cycle`;
  }
  // Now after validation, actually move the state:
  moveDataset(req, res);
};
