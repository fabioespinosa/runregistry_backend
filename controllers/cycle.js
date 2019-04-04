const changeNameOfAllKeys = require('change-name-of-all-keys');
const sequelize = require('../models').sequelize;
const Cycle = require('../models').Cycle;
const CycleDataset = require('../models').CycleDataset;
const Dataset = require('../models').Dataset;
const Run = require('../models').Run;
const Sequelize = require('../models').Sequelize;
const { Op } = Sequelize;
const conversion_operator = {
    and: Op.and,
    or: Op.or,
    '>': Op.gt,
    '<': Op.lt,
    '>=': Op.gte,
    '<=': Op.lte,
    like: Op.iLike,
    notlike: Op.notLike,
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
    const { cycle_attributes, deadline } = req.body;
    const cycle = await Cycle.create({
        cycle_attributes: cycle_attributes || {},
        deadline,
        deleted: false
    });
    req.body.id_cycle = cycle.id_cycle;
    await exports.addDatasetsToCycle(req, res);
};
exports.getAll = async (req, res) => {
    let cycles = await Cycle.findAll({
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

exports.addDatasetsToCycle = async (req, res) => {
    // A filter comes, and we must reproduce that filter to get the dataset that were displayed on the lower table to add them to the cycle
    let filter = changeNameOfAllKeys(
        {
            name: source_dataset_name,
            'dataset_attributes.global_state': {
                or: [{ '=': 'OPEN' }, { '=': 'SIGNOFF' }, { '=': 'COMPLETED' }]
            },
            ...req.body.filter
        },
        conversion_operator
    );
    let include = [
        {
            model: Run,
            attributes: ['rr_attributes']
        }
    ];
    if (typeof filter['class'] !== 'undefined') {
        include[0].where = { 'rr_attributes.class': filter['class'] };
        delete filter['class'];
    }

    const selected_datasets = await Dataset.findAll({
        where: filter,
        include
    });
    if (selected_datasets.length === 0) {
        throw `No dataset found for filter criteria`;
    }

    const { id_cycle } = req.body;
    const cycle = await Cycle.findByPk(id_cycle);
    if (!cycle) {
        throw 'This cycle does not exist ';
    }
    const datasets_promises = selected_datasets.map(
        async ({ run_number, name }) => {
            if (!run_number || !name) {
                throw 'run_number and name of the dataset must be valid';
            }
            const cycle_datasets = await CycleDataset.create({
                id_cycle,
                run_number,
                name
            });
        }
    );
    await Promise.all(datasets_promises);
    await exports.getOne(req, res);
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

exports.deleteDatasetFromCycle = async (req, res) => {};

exports.signOffDatasetsInCycle = async (req, res) => {};

exports.getSignedOffRunNumbers = async (req, res) => {
    const unique_run_numbers = await Dataset.findAll({
        where: {
            name: { [Op.ne]: 'online' }
        },
        attributes: ['run_number'],
        group: ['run_number'],
        order: [['run_number', 'DESC']]
    });
    res.json(unique_run_numbers);
};

exports.markCycleCompletedInWorkspace = async (req, res) => {
    const { workspace } = req.params;
    const { id_cycle } = req.body;
    const cycle = await exports.getOneInternal(id_cycle);
    // Validate if all datasets inside are moved to complete:
    cycle.datasets.forEach(({ run_number, name, dataset_attributes }) => {
        if (dataset_attributes[`${workspace}_state`] !== 'COMPLETED') {
            throw `The dataset with name: ${name} and run number: ${run_number}, has not been moved to completed. Cycle cannot be marked completed.`;
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
