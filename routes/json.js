const { catchAPIError: catchAPI } = require('../utils/error_handlers');
const auth = require('../auth/authenticate');
const Json = require('../controllers/json_creation');
const JsonPortal = require('../controllers/queue_json_creation');
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
  app.post('/json_portal/generate', catchAPI(JsonPortal.calculate_json));
  app.get('/json_portal/jsons', catchAPI(JsonPortal.get_jsons));
};
