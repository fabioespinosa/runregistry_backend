const Classifier = require('../controllers/classifier');
const { catchAPIError: catchAPI } = require('../utils/error_handlers');

module.exports = app => {
    app.get('/classifiers/:category', catchAPI(Classifier.getClassifiers));
    app.put('/classifiers/:category', catchAPI(Classifier.edit));
    app.post('/classifiers/:category', catchAPI(Classifier.new));
    app.delete(
        '/classifiers/:category/:classifier_id',
        catchAPI(Classifier.delete)
    );
};
