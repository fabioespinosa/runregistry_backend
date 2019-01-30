const bodyParser = require('body-parser');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const models = require('./models/index');

const routes = require('./routes/index');
const port = 9500;

const app = express();
app.use(morgan('dev'));
app.use(cors());
app.use(bodyParser.json());

routes(app);

models.sequelize.sync({}).then(() => {
    app.listen(port, () => {
        console.log(`server listening in port ${port}`);
    });
});
