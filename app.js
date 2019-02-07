const bodyParser = require('body-parser');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const models = require('./models/index');
const { expressError } = require('./utils/error_handlers');

const routes = require('./routes/index');
const port = 9500;

const app = express();
app.use(morgan('dev'));
app.use(cors());
app.use(bodyParser.json());

routes(app);

// Make errors appear as json to the client
app.use(expressError);

// Catch Application breaking error and label it here:
process.on('uncaughtException', err => {
    console.log('CRITICAL ERROR: ', err);
});
// Catch Promise error and label it here:
process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Promise Rejection at:', p, 'reason:', reason);
});

models.sequelize.sync({}).then(() => {
    app.listen(port, () => {
        console.log(`server listening in port ${port}`);

        const cron = require('./cron/1.get_runs');
        // const dbs_pinging = require('./cron_datasets/2.ping_dbs');
        // const dqm_gui_pinging = require('./cron_datasets/2.ping_dqm_gui');
    });
});
