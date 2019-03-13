const axios = require('axios');
const assert = require('assert');
const {
    save_runs,
    manually_update_a_run
} = require('../cron/2.save_or_update_runs');
const { API_URL, OMS_URL, OMS_SPECIFIC_RUN } = require('../config/config')[
    process.env.ENV || 'development'
];
describe('Cron: ', () => {
    before(async done => {
        console.log('works');
        done();
    });
    it('Saves run with lumisection', async done => {
        const run_number = 327744;
        const {
            data: { data: fetched_run }
        } = await axios.get(`${OMS_URL}/${OMS_SPECIFIC_RUN(run_number)}`);
        const run_oms_attributes = fetched_run[0].attributes;
        await save_runs([run_oms_attributes], 0);
    });
});
