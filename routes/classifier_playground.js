const ClassifierPlayground = require('../controllers/classifier_playground');
const { catchAPIError: catchAPI } = require('../utils/error_handlers');

module.exports = app => {
    app.post(
        '/classifier_playground',
        catchAPI(ClassifierPlayground.testClassifier)
    );
};
