const Run = require('../controllers/run');
const auth = require('../auth/authenticate');
const { catchAPIError: catchAPI } = require('../utils/error_handlers');

module.exports = app => {
    app.get('/runs/:run_number', catchAPI(Run.getOne));
    app.get('/runs/', catchAPI(Run.get));
    app.get('/runs_50', catchAPI(Run.get50));
    app.post('/runs/', catchAPI(Run.new));
    app.put('/runs/:run_number', catchAPI(Run.edit));

    // Querying:
    app.post('/runs_filtered_ordered/:page', Run.getFilteredOrdered);
    app.post(
        '/significant_runs_filtered_ordered/:page',
        catchAPI(Run.significantRunsFilteredOrdered)
    );

    // Shifter actions:
    app.post('/runs/mark_significant', auth, catchAPI(Run.markSignificant));
    app.post(
        '/runs/move_run/:from_state/:to_state',
        auth,
        catchAPI(Run.moveRun)
    );
    app.post(
        '/runs/refresh_run/:id_run',
        catchAPI(Run.refreshRunClassAndComponents)
    );
};
