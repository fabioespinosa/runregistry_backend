const classifier = require('./classifier');
const runs = require('./run');
module.exports = function(app) {
    classifier(app);
    runs(app);
};
