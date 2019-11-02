const { catchAPIError: catchAPI } = require('../utils/error_handlers');
const auth = require('../auth/authenticate');
const Dataset = require('../controllers/dataset');

module.exports = app => {
    app.post(
        '/dc_tools/unique_dataset_names',
        catchAPI(Dataset.getUniqueDatasetNames)
    );
    app.post(
        '/dc_tools/duplicate_datasets',
        auth,
        catchAPI(Dataset.duplicate_datasets)
    );
    app.post(
        '/dc_tools/dataset_update',
        auth,
        catchAPI(Dataset.change_multiple_states)
    );
    app.post(
        '/dc_tools/copy_column_from_datasets',
        auth,
        catchAPI(Dataset.copy_column_from_datasets)
    );
};
