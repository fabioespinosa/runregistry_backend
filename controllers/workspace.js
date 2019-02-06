const Workspace = require('../models').Workspace;

exports.getAll = async (req, res) => {
    const workspaces = await Workspace.findAll();
    res.json(workspaces);
};

exports.addColumnToWorkspace = async (req, res) => {
    const workspace = await Workspace.findOne({
        where: {
            pog: req.body.pog
        }
    });
    workspace.columns.push(req.body.column);
    const updated_workspace = await workspace.update(workspace);
    res.json(updated_workspace);
};

exports.deleteColumnFromWorkspace = async (req, res) => {
    const workspace = await Workspace.findOne({
        where: {
            pog: req.body.pog
        }
    });
    workspace.columns = workspace.columns.filter(column => {
        return column !== req.body.column;
    });
    const updated_workspace = await workspace.update(workspace);
    res.json(updated_workspace);
};
