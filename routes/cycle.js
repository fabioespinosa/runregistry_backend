const { catchAPIError: catchAPI } = require('../utils/error_handlers');
const auth = require('../auth/authenticate');
const Cycle = require('../controllers/cycle');

module.exports = app => {
    app.get('/cycles/:workspace', catchAPI(Cycle.getAll));
    app.put(
        '/cycles/mark_cycle_complete/:workspace',
        auth,
        catchAPI(Cycle.markCycleCompletedInWorkspace)
    );
    app.post('/cycles', auth, catchAPI(Cycle.add));
    app.post('/cycles/add_datasets', auth, catchAPI(Cycle.addDatasetsToCycle));
    app.delete('/cycles', auth, catchAPI(Cycle.delete));
};
