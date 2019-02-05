const { getMaxIdPlusOne } = require('../utils/model_tools');
const Settings = require('../models').Settings;
const {
    ClassClassifier,
    ClassClassifierEntries,
    ClassClassifierList,

    ComponentClassifier,
    ComponentClassifierEntries,
    ComponentClassifierList,

    DatasetClassifier,
    DatasetClassifierEntries,
    DatasetClassifierList,

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
        id: 'CCL_id'
    },
    component: {
        Classifier: ComponentClassifier,
        Entries: ComponentClassifierEntries,
        List: ComponentClassifierList,
        id: 'CPCL_id'
    },
    dataset: {
        Classifier: DatasetClassifier,
        Entries: DatasetClassifierEntries,
        List: DatasetClassifierList,
        id: 'DCL_id'
    },
    offline_dataset: {
        Classifier: OfflineDatasetClassifier,
        Entries: OfflineDatasetClassifierEntries,
        List: OfflineDatasetClassifierList,
        id: 'ODCL_id'
    }
};

exports.getClassifiers = async (req, res) => {
    // Get max in settings:
    const { category } = req.params;
    const { Classifier, List } = ClassifierTypes[category];
    const max_settings_id = await Settings.max('id');
    // This will join the Classifiers with the Setting configuration of higher ID (the current one).
    let classifiers = await Classifier.findAll({
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
    // We convert the classifier into a string:
    classifiers = classifiers.map(({ dataValues }) => ({
        ...dataValues,
        classifier: JSON.stringify(dataValues.classifier)
    }));
    res.json(classifiers);
};

const generateNewClassifier = async (Classifier, classifier_data) => {
    const new_classifier = await Classifier.build({
        ...classifier_data,
        id: await getMaxIdPlusOne(Classifier)
    }).save();
    return new_classifier;
};

const generateNewClassifierList = async List => {
    const new_classifier_list = await List.build({
        id: await getMaxIdPlusOne(List)
    }).save();
    return new_classifier_list;
};

const getCurrentClasssifierEntries = async (Entries, id) => {
    const current_id_version = await Entries.max(id);
    const current_classifier_entries = await Entries.findAll({
        where: {
            [id]: current_id_version || 0
        }
    });
    return current_classifier_entries;
};

const generateNewClassifierEntries = (
    current_classifier_entries,
    new_classifier_list,
    id
) => {
    const new_classifier_entries = current_classifier_entries.map(entry => {
        return { [id]: new_classifier_list.id, id: entry.id };
    });
    return new_classifier_entries;
};

const generateNewSettings = async (Settings, id, new_classifier_list, by) => {
    const current_settings_id = await Settings.max('id');
    const current_settings = await Settings.findByPk(current_settings_id);
    const new_settings = await Settings.build({
        ...current_settings.dataValues,
        id: await getMaxIdPlusOne(Settings),
        [id]: new_classifier_list.id,
        metadata: { by }
    }).save();
    return new_settings;
};

exports.new = async (req, res) => {
    const { category } = req.params;
    const new_classifier_data = req.body;
    const { Classifier, Entries, List, id } = ClassifierTypes[category];

    const new_classifier = await generateNewClassifier(
        Classifier,
        new_classifier_data
    );
    const new_classifier_list = await generateNewClassifierList(List);
    const current_classifier_entries = await getCurrentClasssifierEntries(
        Entries,
        id
    );
    const new_classifier_entries = generateNewClassifierEntries(
        current_classifier_entries,
        new_classifier_list,
        id
    );
    // We add the new entry (of the new classifier to entries)
    new_classifier_entries.push({
        [id]: new_classifier_list.id,
        id: new_classifier.id
    });
    await Entries.bulkCreate(new_classifier_entries);

    const new_settings = await generateNewSettings(
        Settings,
        id,
        new_classifier_list,
        'fespinos@cern.ch'
    );
    new_classifier.classifier = JSON.stringify(new_classifier.classifier);
    res.json(new_classifier);
};

exports.edit = async (req, res) => {
    const { category } = req.params;
    const new_classifier_data = req.body;
    const { Classifier, Entries, List, id } = ClassifierTypes[category];
    const new_classifier = await generateNewClassifier(
        Classifier,
        new_classifier_data
    );

    const new_classifier_list = await generateNewClassifierList(List);

    const current_classifier_entries = await getCurrentClasssifierEntries(
        Entries,
        id
    );
    const new_classifier_entries = generateNewClassifierEntries(
        current_classifier_entries,
        new_classifier_list,
        id
    );

    // If the classifier is edited, we don't want it duplicated, since we just saved the edited one, the previous classifier (identified by the id in the request) is the one we don't want to duplicate
    new_classifier_entries.filter(
        classifier => +req.params.classifier_id !== classifier.id
    );
    new_classifier_entries.push({
        [id]: new_classifier_list.id,
        id: new_classifier.id
    });
    await Entries.bulkCreate(new_classifier_entries);

    const new_settings = await generateNewSettings(
        Settings,
        id,
        new_classifier_list,
        'fespinos@cern.ch'
    );
    new_classifier.classifier = JSON.stringify(new_classifier.classifier);
    res.json(new_classifier);
};

exports.delete = async (req, res) => {
    const { category } = req.params;
    const { Classifier, Entries, List, id } = ClassifierTypes[category];
    const deleted_classifier = await Classifier.findByPk(
        req.params.classifier_id
    );
    const new_classifier_list = await generateNewClassifierList(List);

    const current_classifier_entries = await getCurrentClasssifierEntries(
        Entries,
        id
    );
    const new_classifier_entries = generateNewClassifierEntries(
        current_classifier_entries,
        new_classifier_list,
        id
    );
    // If the classifier is deleted, we don't want it to be added to the next set of entries
    new_classifier_entries.filter(
        classifier => +req.params.classifier_id !== classifier.id
    );
    await Entries.bulkCreate(new_classifier_entries);
    const new_settings = await generateNewSettings(
        Settings,
        id,
        new_classifier_list,
        'fespinos@cern.ch'
    );
    res.json(deleted_classifier);
};
