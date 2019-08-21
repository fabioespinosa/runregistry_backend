const { catchAPIError: catchAPI } = require('../utils/error_handlers');
const auth = require('../auth/authenticate');
const Json = require('../controllers/json_creation');

module.exports = app => {
    app.post(
        '/json_creation/generate',
        catchAPI(Json.calculate_json_based_on_ranges)
    );
    // app.post(
    //     '/dc_tools/duplicate_datasets',
    //     auth,
    //     catchAPI(Dataset.duplicate_datasets)
    // );
};
