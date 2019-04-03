const Dataset = require('../controllers/dataset');
const auth = require('../auth/authenticate');
const { catchAPIError: catchAPI } = require('../utils/error_handlers');

module.exports = app => {
    app.get('/datasets_waiting', catchAPI(Dataset.getDatasetsWaiting));
    app.get('/datasets_waiting_dbs', catchAPI(Dataset.getDatasetsWaitingDBS));
    app.get('/datasets/workspace/:pog', catchAPI(Dataset.getSpecificWorkspace));
    app.post('/dataset_appeared_in_dbs', catchAPI(Dataset.appearedInDBS));
    app.post('/datasets/get_dataset', catchAPI(Dataset.getDataset));
    app.post(
        '/dataset_appeared_in_dqm_gui',
        catchAPI(Dataset.appearedInDQMGUI)
    );
    // This only queries:
    app.post(
        '/datasets/:workspace/editable/:page',
        catchAPI(Dataset.getEditableDatasets)
    );
    // This only queries:
    app.post(
        '/datasets/:workspace/waiting_list/:page',
        catchAPI(Dataset.getWaitingDatasets)
    );
    app.put('/datasets/:workspace', auth, catchAPI(Dataset.edit));

    app.post('/datasets/:workspace', auth, catchAPI(Dataset.add));
    app.post(
        '/datasets/:workspace/move_dataset',
        auth,
        catchAPI(Dataset.moveDataset)
    );
    app.post(
        '/datasets_get_lumisection_bar',
        catchAPI(Dataset.getLumisectionBar)
    );
    app.post('/datasets_get_lumisections', catchAPI(Dataset.get_lumisections));
};
