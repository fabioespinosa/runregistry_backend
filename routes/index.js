const classifier = require('./classifier');
const runs = require('./run');
const classifier_playground = require('./classifier_playground');

module.exports = function(app) {
    classifier(app);
    runs(app);
    classifier_playground(app);
};
