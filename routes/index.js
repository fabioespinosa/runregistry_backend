const classifier = require('./classifier');
const run = require('./run');
const dataset = require('./dataset');
const classifier_playground = require('./classifier_playground');
const lumisection = require('./lumisection');
const workspace = require('./workspace');
const datasets_accepted = require('./datasets_accepted');

module.exports = function(app) {
    classifier(app);
    run(app);
    dataset(app);
    classifier_playground(app);
    lumisection(app);
    workspace(app);
    datasets_accepted(app);
};
