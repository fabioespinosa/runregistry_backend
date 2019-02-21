const classifier = require('./classifier');
const run = require('./run');
const dataset = require('./dataset');
const classifier_playground = require('./classifier_playground');
const lumisection = require('./lumisection');

module.exports = function(app) {
    classifier(app);
    run(app);
    dataset(app);
    classifier_playground(app);
    lumisection(app);
};
