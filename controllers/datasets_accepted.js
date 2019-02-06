// Still missing to be changed to versioned items
const getMaxIdPlusOne = require('../utils/model_tools').getMaxIdPlusOne;
const DatasetsAccepted = require('../models').DatasetsAccepted;

exports.getAll = async (req, res) => {
    const datasets_accepted = await DatasetsAccepted.findAll();
    res.json(datasets_accepted);
};

exports.getAllByClass = async (req, res) => {
    const datasets = await DatasetsAccepted.findAll({
        where: {
            class: req.params.class
        }
    });
    res.json(datasets);
};

exports.new = async (req, res) => {
    const dataset_accepted = DatasetsAccepted.build({
        ...req.body,
        id: await getMaxIdPlusOne(DatasetsAccepted),
        last_changed_by: req.get('email')
    });
    const saved_dataset_criteria = await dataset_accepted.save();
    res.json(saved_dataset_criteria);
};
exports.edit = async (req, res) => {
    const dataset_accepted = await DatasetsAccepted.findByPk(
        req.params.id_dataset_accepted
    );
    if (dataset_accepted === null) {
        throw 'Criteria not found';
    }
    const updated_criteria = await dataset_accepted.update({
        ...req.body,
        last_changed_by: req.get('email')
    });
    res.json(updated_criteria);
};
exports.delete = async (req, res) => {
    const { id_dataset_accepted } = req.params;
    const dataset_accepted = await DatasetsAccepted.findByPk(
        id_dataset_accepted
    );
    await dataset_accepted.destroy();
    res.json(dataset_accepted);
};
