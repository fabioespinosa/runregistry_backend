const Settings = require('../models').Settings;
const { getMaxIdPlusOne } = require('../utils/model_tools');

// This will join the Item with the Setting configuration of higher ID (the current one).
exports.findAllItems = async (List, Item) => {
    const max_settings_id = await Settings.max('id');
    return await Item.findAll({
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
};

exports.generateNewItem = async (Item, data) => {
    const new_item = await Item.build({
        ...data,
        id: await getMaxIdPlusOne(Item)
    }).save();
    return new_item;
};

exports.generateNewList = async List => {
    const new_item_list = await List.build({
        id: await getMaxIdPlusOne(List)
    }).save();
    return new_item_list;
};

exports.getCurrentEntries = async (Entries, id) => {
    const current_id_version = await Entries.max(id);
    const current_item_entries = await Entries.findAll({
        where: {
            [id]: current_id_version || 0
        }
    });
    return current_item_entries;
};

exports.generateNewEntries = (current_item_entries, new_item_list, id) => {
    const new_item_entries = current_item_entries.map(entry => {
        return { [id]: new_item_list.id, id: entry.id };
    });
    return new_item_entries;
};

exports.generateNewSettings = async (id, new_classifier_list, by) => {
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
