const { catchAPIError: catchAPI } = require('../utils/error_handlers');
const auth = require('../auth/authenticate');
const Lumisection = require('../controllers/lumisection');

module.exports = app => {
    app.get(
        '/lumisections/id_run/:run_number',
        catchAPI(Lumisection.getLumisectionsForRun)
    );
    app.get(
        '/dataset_lumisections/:id_dataset',
        catchAPI(Lumisection.getLumisectionsForDataset)
    );
    app.post(
        '/lumisections/joint_lumisections',
        catchAPI(Lumisection.get_rr_and_oms_lumisection_ranges)
    );
    app.post(
        '/lumisections/oms_lumisections',
        catchAPI(Lumisection.get_oms_lumisection_ranges)
    );
    app.post(
        '/lumisections/rr_lumisections',
        catchAPI(Lumisection.get_rr_lumisection_ranges)
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
