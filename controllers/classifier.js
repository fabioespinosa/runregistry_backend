const { getMaxIdPlusOne } = require('../utils/model_tools');
const { sequelize } = require('../models');
const Settings = require('../models').Settings;
const {
    ClassClassifier,
    ClassClassifierEntries,
    ClassClassifierList
} = require('../models');

const {
    ComponentClassifier,
    ComponentClassifierEntries,
    ComponentClassifierList
} = require('../models');

const {
    DatasetClassifier,
    DatasetClassifierEntries,
    DatasetClassifierList
} = require('../models');

const {
    OfflineDatasetClassifier,
    OfflineDatasetClassifierEntries,
    OfflineDatasetClassifierList
} = require('../models');

// Allows us to set the Classifier dynamically
const ClassifierTypes = {
    class: {
        Classifier: ClassClassifier,
        Entries: ClassClassifierEntries,
        List: ClassClassifierList,
        id: 'CCL_id',
        name: 'ClassClassifier'
    },
    component: {
        Classifier: ComponentClassifier,
        Entries: ComponentClassifierEntries,
        List: ComponentClassifierList,
        id: 'CPCL_id',
        name: 'ComponentClassifier'
    },
    dataset: {
        Classifier: DatasetClassifier,
        Entries: DatasetClassifierEntries,
        List: DatasetClassifierList,
        id: 'DCL_id',
        name: 'DatasetClassifier'
    },
    offline_dataset: {
        Classifier: OfflineDatasetClassifier,
        Entries: OfflineDatasetClassifierEntries,
        List: OfflineDatasetClassifierList,
        id: 'ODCL_id',
        name: 'OfflineDatasetClassifier'
    }
};

exports.getClassifiers = async (req, res) => {
    // Get max in settings:
    const { category } = req.params;
    const { Classifier, List, name } = ClassifierTypes[category];
    const max_settings_id = await Settings.max('id');
    const classifiers = await Classifier.findAll({
        include: [
            {
                model: List,
                required: true,
                include: [
                    {
                        model: Settings,
                        required: true,
                        where: {
                            id: max_settings_id
                        }
                    }
                ]
            }
        ]
    });
    res.json(classifiers);
};

exports.new = async (req, res) => {
    const { category } = req.params;
    const { Classifier, Entries, List, id } = ClassifierTypes[category];
    const new_classifier = await Classifier.build({
        ...req.body,
        id: await getMaxIdPlusOne(Classifier)
    }).save();

    const new_classifier_list = await List.build({
        id: await getMaxIdPlusOne(List)
    }).save();

    const current_id_version = await Entries.max(id);
    const current_classifier_entries = await Entries.findAll({
        where: {
            [id]: current_id_version || 0
        }
    });

    const new_classifier_entries = current_classifier_entries.map(entry => {
        return { [id]: new_classifier_list.id, id: entry.id };
    });
    new_classifier_entries.push({
        [id]: new_classifier_list.id,
        id: new_classifier.id
    });
    await Entries.bulkCreate(new_classifier_entries);

    const current_settings_id = await Settings.max('id');
    const current_settings = await Settings.findByPk(current_settings_id);
    await Settings.build({
        ...current_settings.dataValues,
        id: await getMaxIdPlusOne(Settings),
        metadata: { by: 'fespinos@cern.ch' },
        [id]: new_classifier_list.id
    }).save();
    new_classifier.dataValues.classifier = JSON.stringify(
        new_classifier.dataValues.classifier
    );
    res.json(new_classifier.dataValues);
};

exports.edit = async (req, res) => {
    const { category } = req.params;
    const { Classifier, Entries, List, id } = ClassifierTypes[category];
    const new_classifier = await Classifier.build({
        ...req.body,
        id: await getMaxIdPlusOne(ClassClassifier)
    }).save();

    const new_classifier_list = await List.build({
        id: await getMaxIdPlusOne(ClassClassifierList)
    }).save();

    const current_id_version = await Entries.max(id);
    const current_classifier_entries = await Entries.findAll({
        where: {
            [id]: current_id_version || 0
        }
    });
    const new_classifier_entries = current_classifier_entries
        .map(entry => {
            return { [id]: new_classifier_list.id, id: entry.id };
        })
        // If the classifier is edited, we don't want it duplicated, since we just saved the edited one, the previous classifier (identified by the id in the request) is the one we don't want to duplicate
        .filter(classifier => +req.params.classifier_id !== classifier.id);
    new_classifier_entries.push({
        [id]: new_classifier_list.id,
        id: new_classifier.id
    });
    await Entries.bulkCreate(new_classifier_entries);

    const current_settings_id = await Settings.max('id');
    const current_settings = await Settings.findByPk(current_settings_id);
    await Settings.build({
        ...current_settings.dataValues,
        id: await getMaxIdPlusOne(Settings),
        metadata: { by: 'fespinos@cern.ch' },
        [id]: new_classifier_list.id
    }).save();
    new_classifier.classifier = JSON.stringify(new_classifier.classifier);
    res.json(new_classifier);
};

exports.delete = async (req, res) => {
    const { category } = req.params;
    const { Classifier, Entries, List, id } = ClassifierTypes[category];

    const deleted_classifier = await Classifier.findByPk(
        req.params.classifier_id
    );
    const new_classifier_list = await List.build({
        id: await getMaxIdPlusOne(ClassClassifierList)
    }).save();

    const current_id_version = await Entries.max(id);
    const current_classifier_entries = await Entries.findAll({
        where: {
            [id]: current_id_version || 0
        }
    });
    const new_classifier_entries = current_classifier_entries
        .map(entry => {
            return { [id]: new_classifier_list.id, id: entry.id };
        })
        // If the classifier is edited, we don't want it duplicated, since we just saved the edited one, the previous classifier (identified by the id in the request) is the one we don't want to duplicate
        .filter(classifier => +req.params.classifier_id !== classifier.id);
    await Entries.bulkCreate(new_classifier_entries);

    const current_settings_id = await Settings.max('id');
    const current_settings = await Settings.findByPk(current_settings_id);
    await Settings.build({
        ...current_settings.dataValues,
        id: await getMaxIdPlusOne(Settings),
        metadata: { by: 'fespinos@cern.ch' },
        [id]: new_classifier_list.id
    }).save();
    res.json(deleted_classifier);
};
