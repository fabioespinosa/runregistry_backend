module.exports = {
    development: {
        username: 'hackathon',
        password: '',
        database: 'hackathon',
        host: '127.0.0.1',
        logging: true,
        dialect: 'postgres',
        operatorsAliases: false,
        define: {
            // Make sequelize not pluralize the name of tables:
            freezeTableName: true
        },
        API_URL: 'http: //localhost:7003',
        OMS_URL: `http: //cmsomsapidev.cern.ch:8080/api/v1`,
        OMS_RUNS: (number_of_runs = 10) =>
            `runs?sort=-run_number&page%5Blimit%5D=${number_of_runs}&include=meta`,
        OMS_SPECIFIC_RUN: run_number => `runs?filter[run_number
        ]=${run_number}`,
        OMS_LUMISECTIONS: id_run =>
            `lumisections?filter[run_number
        ]=${id_run}&page[limit
        ]=5000`,
        RUNS_PER_API_CALL: 20,
        SECONDS_PER_API_CALL: 30,
        DBS_URL: 'https: //cmsweb.cern.ch/dbs/prod/global',
        DBS_DATASETS: id_run => `DBSReader/datasets?run_num=${id_run}`,
        SECONDS_PER_DBS_CHECK: 6010,
        DQM_GUI_URL:
            'https: //cmsweb.cern.ch/dqm/offline/data/json/samples?match=',
        SECONDS_PER_DQM_GUI_CHECK: 6000
    }
};
