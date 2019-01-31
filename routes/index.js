const class_classifier = require('./class_classifier');
const runs = require('./run');
module.exports = function(app) {
    class_classifier(app);
    runs(app);
};
