const Run = require('../controllers/run');
const { catchAPIError: catchAPI } = require('../utils/error_handlers');

module.exports = app => {
    app.get('/runs/:run_number', catchAPI(Run.getOne));
    app.get('/runs/', catchAPI(Run.get));
    app.get('/runs_50', catchAPI(Run.get50));
    app.post('/runs/', catchAPI(Run.new));
    app.put('/runs/:run_number', catchAPI(Run.edit));
};
