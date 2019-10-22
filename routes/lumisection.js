const { catchAPIError: catchAPI } = require('../utils/error_handlers');
const auth = require('../auth/authenticate');
const Lumisection = require('../controllers/lumisection');

module.exports = app => {
    app.post(
        '/lumisections/joint_lumisection_ranges',
        catchAPI(Lumisection.get_rr_and_oms_lumisection_ranges)
    );
    app.post(
        '/lumisections/oms_lumisection_ranges',
        catchAPI(Lumisection.get_oms_lumisection_ranges)
    );
    app.post(
        '/lumisections/rr_lumisection_ranges',
        catchAPI(Lumisection.get_rr_lumisection_ranges)
    );
    // Used in online to edit runs LS components:
    app.post(
        '/lumisections/rr_lumisection_ranges_by_component',
        catchAPI(Lumisection.get_rr_lumisection_ranges_by_component)
    );
    app.post(
        '/lumisections/rr_lumisections',
        catchAPI(Lumisection.get_rr_lumisections)
    );
    app.post(
        '/lumisections/oms_lumisections',
        catchAPI(Lumisection.get_oms_lumisections)
    );
    app.put(
        '/lumisections/edit_lumisections',
        auth,
        catchAPI(Lumisection.edit_rr_lumisections)
    );
    app.put(
        '/dataset_lumisections/:workspace/reset',
        auth,
        catchAPI(Lumisection.resetLumisections)
    );
    app.post(
        '/lumisections/get_data_of_json',
        catchAPI(Lumisection.get_data_of_json)
    );
};
