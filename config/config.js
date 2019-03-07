module.exports = {
    development: {
        username: 'hackathon',
        password: '',
        database: 'hackathon2',
        host: '127.0.0.1',
        logging: false,
        dialect: 'postgres',
        operatorsAliases: false,
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
        API_URL: 'http://localhost:9500',
        OMS_URL: `http://cmsomsapidev.cern.ch:8080/api/v1`,
        OMS_RUNS: (number_of_runs = 10) =>
            `runs?sort=-run_number&page%5Blimit%5D=${number_of_runs}`,
        OMS_SPECIFIC_RUN: run_number => `runs?filter[run_number]=${run_number}`,
        OMS_LUMISECTIONS: run_number =>
            `lumisections?filter[run_number]=${run_number}&page[limit]=5000`,
        RUNS_PER_API_CALL: 32,
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
        'init_lumi',
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
    ],
    rr_lumisection_whitelist: [
        'dt_triplet',
        'es_triplet',
        'cms_triplet',
        'csc_triplet',
        'hlt_triplet',
        'l1t_triplet',
        'pix_triplet',
        'rpc_triplet',
        'ecal_triplet',
        'hcal_triplet',
        'lumi_triplet',
        'ctpps_triplet',
        'l1tmu_triplet',
        'strip_triplet',
        'l1tcalo_triplet '
    ]
};
