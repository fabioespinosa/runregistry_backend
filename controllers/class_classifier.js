const Settings = require('../models').Settings;
const ClassClassifierList = require('../models').ClassClassifierList;
const ClassClassifierEntries = require('../models').ClassClassifierEntries;
const ClassClassifier = require('../models').ClassClassifier;

exports.getClassifiers = async (req, res) => {
    // Get max in settings:
    const max_settings_id = await Settings.max('id');
    const current_setting = await Settings.findByPk(max_settings_id);
    const classifiers = await Settings.findAll({
        where: {
            id: max_settings_id
        },
        include: [
            {
                model: ClassClassifierList,
                include: [
                    {
                        model: ClassClassifier
                    }
                ]
            }
        ]
    });
    console.log(classifiers);
};

exports.new = async (req, res) => {
    const new_settings_id = (await Settings.max('id')) + 1;

    const new_class_classifier_list_id = await ClassClassifierList.build(
        (await ClassClassifierList.max('id')) + 1
    );
    const saved_classifier_list_id = await ClassClassifierList.save();

    const new_setting = {
        id: new_settings_id,
        reason: req.body.reason,
        CCE_id: saved_classifier_list_id
    };
};

exports.edit = async (req, res) => {
    const { category } = req.params;
    const updated_classifiers = await Classifier[category].update(req.body, {
        where: { id: req.params.classifier_id },
        returning: true
    });
    if (updated_classifiers[0] === 0) {
        res.status(500);
        res.json({ err: 'No Classifier was updated' });
    }
    const saved_classifier = updated_classifiers[1][0];
    saved_classifier.classifier = JSON.stringify(saved_classifier.classifier);
    res.json(saved_classifier);
};

exports.delete = async (req, res) => {
    const { category } = req.params;
    const classifier = await Classifier[category].findByPk(
        req.params.classifier_id
    );
    await classifier.destroy();
    res.json(classifier);
};
