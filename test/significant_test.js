const {
  is_run_significant
} = require('../cron/saving_updating_runs_lumisections_utils');

const {
  get_OMS_lumisections
} = require('../cron/saving_updating_runs_lumisections_utils');
const {
  calculate_rr_attributes,
  calculate_rr_lumisections,
  calculate_oms_attributes
} = require('../cron/3.calculate_rr_attributes');

describe('Significant test', async () => {
  const event1 = {
    energy: null,
    l1_key: 'l1_trg_cosmics2019/v20',
    b_field: 0.019,
    hlt_key: '/cdaq/special/2019/MWGR1/CruzetForMWGR1/HLT/V9',
    l1_menu: 'L1Menu_Collisions2018_v2_1_0',
    l1_rate: null,
    duration: null,
    end_lumi: null,
    end_time: null,
    sequence: 'GLOBAL-RUN',
    init_lumi: null,
    clock_type: 'LOCAL',
    components: ['DAQ', 'DCS', 'DQM', 'ECAL', 'SCAL', 'TCDS', 'TRG'],
    run_number: 334592,
    start_time: '2020-01-24T14:36:29Z',
    fill_number: null,
    l1_hlt_mode: 'cosmics2019',
    last_update: '2020-01-24T14:37:02Z',
    ls_duration: 6,
    stable_beam: false,
    daq_included: true,
    dcs_included: true,
    dqm_included: true,
    trg_included: true,
    trigger_mode: 'l1_hlt_cosmics2019/v44',
    cmssw_version: 'CMSSW_10_6_8_patch1',
    ecal_included: true,
    recorded_lumi: null,
    scal_included: true,
    tcds_included: true,
    delivered_lumi: null,
    tier0_transfer: true,
    l1_key_stripped: 'cosmics2019/v20',
    fill_type_party1: null,
    fill_type_party2: null,
    hlt_physics_rate: null,
    hlt_physics_size: null,
    fill_type_runtime: null,
    hlt_physics_counter: null,
    l1_triggers_counter: null,
    l1_hlt_mode_stripped: 'cosmics2019/v44',
    hlt_physics_throughput: null,
    initial_prescale_index: null,
    beams_present_and_stable: false
  };
  const event2 = {
    energy: 0,
    end_lumi: 0,
    init_lumi: 0,
    fill_number: 7495,
    last_update: '2020-01-24T14:59:34Z',
    ls_duration: 67,
    fill_type_party1: 'PB82',
    fill_type_party2: 'PB82',
    hlt_physics_rate: 7.061,
    hlt_physics_size: 0.139,
    fill_type_runtime: 'COSMICS',
    hlt_physics_counter: 10040,
    hlt_physics_throughput: 0.00009764,
    initial_prescale_index: 0
  };
  const run = { ...event1, ...event2 };

  it('Generates significance correctly', async () => {
    const oms_lumisections = await get_OMS_lumisections(run.run_number);
    const oms_attributes = await calculate_oms_attributes(
      run,
      oms_lumisections
    );
    Object.freeze(oms_lumisections);
    Object.freeze(oms_attributes);

    const rr_attributes = await calculate_rr_attributes(
      oms_attributes,
      oms_lumisections
    );

    const significant = await is_run_significant(
      oms_attributes,
      rr_attributes,
      oms_lumisections
    );
    console.log(significant);
  });
});
