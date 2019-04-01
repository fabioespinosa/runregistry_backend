const { catchAPIError: catchAPI } = require('../utils/error_handlers');
const auth = require('../auth/authenticate');
const Dataset = require('../controllers/dataset');

module.exports = app => {
    app.post(
        '/dc_tools/duplicate_datasets',
        auth,
        catchAPI(Dataset.duplicate_datasets)
    );
};
