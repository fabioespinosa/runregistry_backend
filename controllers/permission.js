const Permission = require('../models').Permission;
const PermissionEntries = require('../models').PermissionEntries;
const PermissionList = require('../models').PermissionList;
const {
    findAllItems,
    generateNewItem,
    generateNewList,
    getCurrentEntries,
    generateNewEntries,
    generateNewSettings
} = require('./version_tracking_helpers');

const id = 'PL_id';

// getAll and getAllPermissions are separated due to the use in ./auth/authenticate.
exports.getAll = async (req, res) => {
    const permissions = await getAllPermissions();
    res.json(permissions);
};

exports.getAllPermissions = async () => {
    const permissions = await findAllItems(PermissionList, Permission);
    return permissions;
};

exports.addPermissionToEgroup = async (req, res) => {
    const new_permission_data = req.body;

    const new_permission = await generateNewItem(Permission, {
        new_permission_data
    });

    const new_permission_list = await generateNewList(PermissionList);

    const current_permission_entries = await getCurrentEntries(
        PermissionEntries,
        id
    );
    const new_permission_entries = generateNewEntries(
        current_permission_entries,
        new_permission_list,
        id
    );

    // If the permission is edited, we don't want it duplicated, since we just saved the edited one, the previous permission (identified by the one we find first) is the one we don't want to duplicate
    new_permission_entries.filter(
        permission => +permission.dataValues.id !== permission.id
    );
    new_permission_entries.push({
        [id]: new_permission_list.id,
        id: new_permission.id
    });
    await Permission.bulkCreate(new_permission_entries);
    await generateNewSettings(id, new_permission_list, 'fespinos@cern.ch');

    res.json(new_permission);
};

exports.addPermissionToEgroup = async (req, res) => {
    const permission = await Permission.findOne({
        where: {
            pog: req.body.pog
        }
    });
    permission.dataValues.actions.push(req.body.action);

    const new_permission = await generateNewItem(Permission, {
        ...permission.dataValues
    });

    const new_permission_list = await generateNewList(PermissionList);

    const current_permission_entries = await getCurrentEntries(
        PermissionEntries,
        id
    );
    const new_permission_entries = generateNewEntries(
        current_permission_entries,
        new_permission_list,
        id
    );

    // If the permission is edited, we don't want it duplicated, since we just saved the edited one, the previous permission (identified by the one we find first) is the one we don't want to duplicate
    new_permission_entries.filter(
        permission => +permission.dataValues.id !== permission.id
    );
    new_permission_entries.push({
        [id]: new_permission_list.id,
        id: new_permission.id
    });
    await Permission.bulkCreate(new_permission_entries);
    await generateNewSettings(id, new_permission_list, 'fespinos@cern.ch');

    res.json(new_permission);
};

exports.deleteEgroup = async (req, res) => {
    const deleted_egroup = await Classifier.findByPk(req.params.egroup_id);
    const new_permission_list = await generateNewList(PermissionList);

    const current_permission_entries = await getCurrentEntries(
        PermissionEntries,
        id
    );
    const new_permission_entries = generateNewEntries(
        current_permission_entries,
        new_permission_list,
        id
    );
    // If the classifier is deleted, we don't want it to be added to the next set of entries
    new_permission_entries.filter(
        permission => +req.params.egroup_id !== permission.id
    );
    await Entries.bulkCreate(new_permission_entries);
    await generateNewSettings(id, new_permission_list, 'fespinos@cern.ch');
    res.json(deleted_egroup);
};

exports.deletePermissionToEgroup = async (req, res) => {
    const permission = await Permission.findOne({
        where: {
            pog: req.body.egroup
        }
    });
    permission.actions = permission.actions.filter(action => {
        return action !== req.body.action;
    });
    const updated_permission = await permission.update(permission);
    res.json(updated_permission);
};
