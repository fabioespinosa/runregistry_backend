const sequelize = require('../models').sequelize;
const Cycle = require('../models').Cycle;
const CycleDataset = require('../models').CycleDataset;
const Dataset = require('../models').Dataset;
const Run = require('../models').Run;
const Sequelize = require('../models').Sequelize;
const { Op } = Sequelize;

exports.add = async (req, res) => {
    const { cycle_attributes, deadline } = req.body;
    const cycle = await Cycle.create({
        cycle_attributes: cycle_attributes || {},
        deadline,
        deleted: false
    });
    req.body.id_cycle = cycle.id_cycle;
    await exports.addRunsToCycle(req, res);
};
exports.getAll = async (req, res) => {
    const cycles = await Cycle.findAll({
        include: [
            {
                model: Run
            }
        ],
        where: {
            deleted: false
        }
    });

    res.json(cycles);
};

exports.getOne = async (req, res) => {
    const cycle = await Cycle.findByPk(req.body.id_cycle, {
        include: [
            {
                model: Run
            }
        ]
    });
    res.json(cycle);
};

exports.addRunsToCycle = async (req, res) => {
    // Run must bome in the form of [{run_number: 323546}, ...]
    const { runs, id_cycle } = req.body;
    const cycle = await Cycle.findByPk(id_cycle);
    if (!cycle) {
        throw 'This cycle does not exist ';
    }
    const datasets_promises = runs.map(async ({ run_number }) => {
        if (!run_number) {
            throw 'run_number must be included';
        }
        const cycle_datasets = await CycleDataset.create({
            id_cycle,
            run_number
        });
    });
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

    const cycle = await Cycle.findByPk(id_cycle);
    cycle.cycle_attributes = {
        ...cycle.cycle_attributes,
        [`${workspace}_state`]: 'completed'
    };
    const saved_cycle = await cycle.update({
        cycle_attributes: cycle.cycle_attributes
    });
    res.json(saved_cycle);
};
