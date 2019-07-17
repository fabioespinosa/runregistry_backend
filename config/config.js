module.exports = {
    development: {
        username: 'hackathon',
        password: '',
        database: 'hackathon6',
        host: '127.0.0.1',
        logging: false,
        dialect: 'postgres',
        define: {
            // Make sequelize not pluralize the name of tables:
            freezeTableName: true
        },
        pool: {
            max: 5,
            min: 0,
            idle: 20000,
            acquire: 20000
        },
        WAITING_DQM_GUI_CONSTANT: 'waiting dqm gui',
        API_URL: 'http://localhost:9500',
        OMS_URL: `https://cmsoms.cern.ch/agg/api/v1`,
        OMS_RUNS: (number_of_runs = 10) =>
            `runs?sort=-last_update&page[limit]=${number_of_runs}`,
        OMS_SPECIFIC_RUN: run_number => `runs?filter[run_number]=${run_number}`,
        OMS_LUMISECTIONS: run_number =>
            `lumisections?filter[run_number]=${run_number}&page[limit]=5000`,
        RUNS_PER_API_CALL: 49,
        SECONDS_PER_API_CALL: 30,
        DBS_URL: 'https://cmsweb.cern.ch/dbs/prod/global',
        DBS_DATASETS: run_number => `DBSReader/datasets?run_num=${run_number}`,
        SECONDS_PER_DBS_CHECK: 6010,
        DQM_GUI_URL:
            'https://cmsweb.cern.ch/dqm/offline/data/json/samples?match=',
        SECONDS_PER_DQM_GUI_CHECK: 6000
    },
    staging: {
        username: 'admin',
        password: 'changeme',
        database: 'final_rr',
        logging: false,
        host: 'dbod-rr4-dev.cern.ch',
        dialect: 'postgres',
        port: 6606,
        define: {
            // Make sequelize not pluralize the name of tables:
            freezeTableName: true
        },
        WAITING_DQM_GUI_CONSTANT: 'waiting dqm gui',
        API_URL: 'http://localhost:9500',
        OMS_URL: `http://cmsomsapidev.cern.ch:8080/api/v1`,
        OMS_RUNS: (number_of_runs = 10) =>
            `runs?sort=-last_update&page[limit]=${number_of_runs}`,
        OMS_SPECIFIC_RUN: run_number => `runs?filter[run_number]=${run_number}`,
        OMS_LUMISECTIONS: run_number =>
            `lumisections?filter[run_number]=${run_number}&page[limit]=5000`,
        RUNS_PER_API_CALL: 6,
        SECONDS_PER_API_CALL: 3600,
        DBS_URL: 'https://cmsweb.cern.ch/dbs/prod/global',
        DBS_DATASETS: run_number => `DBSReader/datasets?run_num=${run_number}`,
        SECONDS_PER_DBS_CHECK: 3600,
        DQM_GUI_URL:
            'https://cmsweb.cern.ch/dqm/offline/data/json/samples?match=',
        SECONDS_PER_DQM_GUI_CHECK: 3600
    },
    production: {
        username: 'admin',
        password: 'changeme',
        database: 'runregistry_database',
        logging: false,
        host: 'dbod-gc005.cern.ch',
        dialect: 'postgres',
        port: 6601,
        define: {
            // Make sequelize not pluralize the name of tables:
            freezeTableName: true
        },
        WAITING_DQM_GUI_CONSTANT: 'waiting dqm gui',
        API_URL: 'http://localhost:9500',
        OMS_URL: `https://cmsoms.cern.ch/agg/api/v1`,
        OMS_RUNS: (number_of_runs = 10) =>
            `runs?sort=-last_update&page[limit]=${number_of_runs}`,
        OMS_SPECIFIC_RUN: run_number => `runs?filter[run_number]=${run_number}`,
        OMS_LUMISECTIONS: run_number =>
            `lumisections?filter[run_number]=${run_number}&page[limit]=5000`,
        RUNS_PER_API_CALL: 6,
        SECONDS_PER_API_CALL: 3600,
        DBS_URL: 'https://cmsweb.cern.ch/dbs/prod/global',
        DBS_DATASETS: run_number => `DBSReader/datasets?run_num=${run_number}`,
        SECONDS_PER_DBS_CHECK: 3600,
        DQM_GUI_URL:
            'https://cmsweb.cern.ch/dqm/offline/data/json/samples?match=',
        SECONDS_PER_DQM_GUI_CHECK: 40
    },

    // The online components are also the rr_lumisection_whitelist
    online_components: [
        'castor',
        'cms',
        'csc',
        'ctpps',
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
        'strip'
    ],
    // This are the attributes we save from OMS lumisections:
    oms_lumisection_whitelist: [
        'rp_time_ready',
        'cscp_ready',
        'physics_flag',
        'dt0_ready',
        'beam1_present',
        'bpix_ready',
        'ho_ready',
        'dtp_ready',
        'tecm_ready',
        'tibtid_ready',
        'fpix_ready',
        'rpc_ready',
        'rp_sect_56_ready',
        'castor_ready',
        'esp_ready',
        'eep_ready',
        'hbhea_ready',
        'ebm_ready',
        'dtm_ready',
        'eem_ready',
        'esm_ready',
        'tecp_ready',
        'ebp_ready',
        'hf_ready',
        'rp_sect_45_ready',
        'cscm_ready',
        'cms_active',
        'zdc_ready',
        'hbheb_ready',
        'tob_ready',
        'beam1_stable',
        'hbhec_ready',
        'beam2_stable',
        'beam2_present'
    ]
};
