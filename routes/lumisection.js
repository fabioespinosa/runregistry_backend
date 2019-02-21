const { catchAPIError: catchAPI } = require('../utils/error_handlers');
const auth = require('../auth/authenticate');
const Lumisection = require('../controllers/lumisection');

module.exports = app => {
    app.get(
        '/lumisections/id_run/:id_run',
        catchAPI(Lumisection.getLumisectionsForRun)
    );
    app.get(
        '/dataset_lumisections/:id_dataset',
        catchAPI(Lumisection.getLumisectionsForDataset)
    );
    app.put(
        '/dataset_lumisections/:workspace',
        auth,
        catchAPI(Lumisection.editDatasetLumisections)
    );
    app.put(
        '/dataset_lumisections/:workspace/reset',
        auth,
        catchAPI(Lumisection.resetLumisections)
    );
};
