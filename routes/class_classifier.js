const ClassClassifier = require('../controllers/class_classifier');
const { catchAPIError: catchAPI } = require('../utils/error_handlers');

module.exports = app => {
    app.get('/classifiers/class_classifiers', catchAPI(ClassClassifier.get));
    app.put(
        '/classifiers/class_classifiers/:classifier_id',
        catchAPI(ClassClassifier.edit)
    );
    app.post('/classifiers/class_classifiers', catchAPI(ClassClassifier.new));
    app.delete(
        '/classifiers/class_classifiers/:classifier_id',
        catchAPI(ClassClassifier.delete)
    );
};
