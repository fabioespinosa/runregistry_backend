const sequelize = require('../models').sequelize;
const Cycle = require('../models').Cycle;
const CycleDataset = require('../models').CycleDataset;
const Dataset = require('../models').Dataset;

exports.add = async (req, res) => {
    const { attributes } = req.body;
    const cycle = await Cycle.create({
        cycle_attributes: attributes || {},
        deleted: false
    });
    res.json(cycle);
};
exports.getAll = async (req, res) => {
    const cycles = await Cycle.findAll({
        include: [
            {
                model: CycleDataset,
                include: {
                    model: Dataset
                }
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
                model: CycleDataset,
                include: {
                    model: Dataset
                }
            }
        ]
    });
    res.json(cycle);
};

exports.addDatasetsToCycle = async (req, res) => {
    // datasets must bome in the form of [{name: "Online/prompt", run_number: 323546}, ...]
    const { datasets, id_cycle } = req.body;
    const cycle = await Cycle.findByPk(id_cycle);
    if (!cycle) {
        throw 'This cycle does not exist ';
    }
    const datasets_promises = datasets.map(async ({ name, run_number }) => {
        if (!name || !run_number) {
            throw 'Name and run_number must be included';
        }
        const cycle_datasets = await CycleDataset.create({
            id_cycle,
            name,
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
    await cycle_to_delete.update({ deleted: true });
    res.json(cycle_to_delete);
};

exports.deleteDatasetFromCycle = async (req, res) => {};

exports.signOffDatasetsInCycle = async (req, res) => {};
