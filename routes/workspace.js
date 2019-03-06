const Workspace = require('../controllers/workspace');
const { catchAPIError: catchAPI } = require('../utils/error_handlers');
const auth = require('../auth/authenticate');

module.exports = app => {
    app.get('/workspaces', catchAPI(Workspace.getAll));
    app.post('/workspaces', auth, catchAPI(Workspace.addColumnToWorkspace));
    app.delete(
        '/workspaces',
        auth,
        catchAPI(Workspace.deleteColumnFromWorkspace)
    );
};
