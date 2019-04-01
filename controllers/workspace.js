const { Workspace, WorkspaceEntries, WorkspaceList } = require('../models');
const {
    findAllItems,
    findOneItem,
    saveNewItem,
    editItem,
    deleteItem
} = require('./version_tracking_helpers');

const id = 'WL_id';

exports.getAll = async (req, res) => {
    const workspaces = await findAllItems(WorkspaceList, Workspace);
    // Sort alphabetically:
    workspaces.sort((a, b) =>
        a.workspace !== b.workspace ? (a.workspace < b.workspace ? -1 : 1) : 0
    );
    res.json(workspaces);
};

exports.addColumnToWorkspace = async (req, res) => {
    const workspace = await Workspace.findOneItem(WorkspaceList, Workspace, {
        where: {
            workspace: req.body.workspace
        }
    });

    workspace.columns.push(req.body.column);
    const edited_workspace = await editItem(
        WorkspaceList,
        WorkspaceEntries,
        Workspace,
        id,
        workspace.dataValues,
        workspace.dataValues.id,
        req.get('email')
    );
    res.json(edited_workspace);
};

exports.deleteColumnFromWorkspace = async (req, res) => {
    const workspace = await findOneItem(WorkspaceList, Workspace, {
        where: { workspace: req.body.workspace }
    });

    workspace.dataValues.columns = workspace.columns.filter(column => {
        return column !== req.body.column;
    });

    const updated_workspace = await editItem(
        WorkspaceList,
        WorkspaceEntries,
        Workspace,
        id,
        workspace.dataValues,
        workspace.dataValues.id,
        req.get('email')
    );

    res.json(updated_workspace);
};
