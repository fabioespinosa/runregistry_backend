module.exports = {
    development: {
        username: 'hackathon',
        password: '',
        database: 'hackathon',
        host: '127.0.0.1',
        logging: false,
        dialect: 'postgres',
        operatorsAliases: false,
        define: {
            // Make sequelize not pluralize the name of tables:
            freezeTableName: true
        },
        API_URL: 'http://localhost:9500',
        OMS_URL: `http://cmsomsapidev.cern.ch:8080/api/v1`,
        OMS_RUNS: (number_of_runs = 10) =>
            `runs?sort=-run_number&page%5Blimit%5D=${number_of_runs}`,
        OMS_SPECIFIC_RUN: run_number => `runs?filter[run_number]=${run_number}`,
        OMS_LUMISECTIONS: id_run =>
            `lumisections?filter[run_number]=${id_run}&page[limit]=5000`,
        RUNS_PER_API_CALL: 10,
        SECONDS_PER_API_CALL: 30,
        DBS_URL: 'https://cmsweb.cern.ch/dbs/prod/global',
        DBS_DATASETS: id_run => `DBSReader/datasets?run_num=${id_run}`,
        SECONDS_PER_DBS_CHECK: 6010,
        DQM_GUI_URL:
            'https://cmsweb.cern.ch/dqm/offline/data/json/samples?match=',
        SECONDS_PER_DQM_GUI_CHECK: 6000
    },
    staging: {
        username: 'admin',
        password: 'changeme',
        database: 'patatrack',
        logging: false,
        host: 'dbod-rr4-dev.cern.ch',
        dialect: 'postgres',
        port: 6606,
        operatorsAliases: false,
        define: {
            // Make sequelize not pluralize the name of tables:
            freezeTableName: true
        },
        API_URL: 'http://localhost:9500',
        OMS_URL: `http://cmsomsapidev.cern.ch:8080/api/v1`,
        OMS_RUNS: (number_of_runs = 10) =>
            `runs?sort=-run_number&page%5Blimit%5D=${number_of_runs}&include=meta`,
        OMS_SPECIFIC_RUN: run_number => `runs?filter[run_number]=${run_number}`,
        OMS_LUMISECTIONS: id_run =>
            `lumisections?filter[run_number]=${id_run}&page[limit]=5000`,
        RUNS_PER_API_CALL: 6,
        SECONDS_PER_API_CALL: 3600,
        DBS_URL: 'https://cmsweb.cern.ch/dbs/prod/global',
        DBS_DATASETS: id_run => `DBSReader/datasets?run_num=${id_run}`,
        SECONDS_PER_DBS_CHECK: 3600,
        DQM_GUI_URL:
            'https://cmsweb.cern.ch/dqm/offline/data/json/samples?match=',
        SECONDS_PER_DQM_GUI_CHECK: 3600
    },
    online_components: [
        'cms',
        'castor',
        'csc',
        'dt',
        'ecal',
        'es',
        'hcal',
        'hlt',
        'l1t',
        'l1tcalo',
        'l1tmu',
        'lumi',
        'pix',
        'rpc',
        'strip',
        'ctpps'
    ],
    lumisection_attributes: [
        'beam1_present',
        'beam1_stable',
        'beam2_present',
        'beam2_stable',
        'bpix_ready',
        'castor_ready',
        'cms_infrastructure',
        'cms_active',
        'cscm_ready',
        'cscp_ready',
        'dt0_ready',
        'dtm_ready',
        'dtp_ready',
        'ebm_ready',
        'ebp_ready',
        'eem_ready',
        'eep_ready',
        'esm_ready',
        'esp_ready',
        'fpix_ready',
        'hbhea_ready',
        'hbheb_ready',
        'hbhec_ready',
        'hf_ready',
        'ho_ready',
        'rp_sect_45_ready',
        'rp_sect_56_ready',
        'rp_time_ready',
        'rpc_ready',
        'tecm_ready',
        'tecp_ready',
        'tibtid_ready',
        'tob_ready',
        'zdc_ready'
    ]
};
