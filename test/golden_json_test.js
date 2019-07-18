const fs = require('fs');
const queue = require('async').queue;
const {
    get_all_distinct_run_numbers_for_dataset,
    generate_golden_json_for_dataset
} = require('../controllers/json_creation');
const previous_json = fs.readFileSync(`${__dirname}/previous_json.json`);

const criteria_for_status_flags = [
    // ['cms-cms', 'GOOD'],
    ['dt-dt', 'GOOD'],
    ['csc-csc', 'GOOD'],
    ['l1t-l1tcalo', 'GOOD'],
    ['l1t-l1tmu', 'GOOD'],
    ['hlt-hlt', 'GOOD'],
    ['tracker-pixel', 'GOOD'],
    ['tracker-strip', 'GOOD'],
    ['tracker-track', 'GOOD'],
    ['ecal-ecal', 'GOOD'],
    ['hcal-hcal', 'GOOD'],
    ['ecal-es', 'GOOD'],
    ['egamma-egamma', 'GOOD'],
    ['muon-muon', 'GOOD'],
    ['jetmet-jetmet', 'GOOD'],
    ['lumi-lumi', 'GOOD']
    // ['dc-lowlumi', 'GOOD']
];

const criteria_for_dcs = [
    ['cms_active', true],
    ['bpix_ready', true],
    ['fpix_ready', true],
    ['tibtid_ready', true],
    ['tecm_ready', true],
    ['tecp_ready', true],
    // ['castor_ready', true],
    ['tob_ready', true],
    ['ebm_ready', true],
    ['ebp_ready', true],
    ['eem_ready', true],
    ['eep_ready', true],
    ['esm_ready', true],
    ['esp_ready', true],
    ['hbhea_ready', true],
    ['hbheb_ready', true],
    ['hbhec_ready', true],
    ['hf_ready', true],
    ['ho_ready', true],
    ['dtm_ready', true],
    ['dtp_ready', true],
    ['dt0_ready', true],
    ['cscm_ready', true],
    ['cscp_ready', true],
    ['rpc_ready', true],
    ['beam1_present', true],
    ['beam2_present', true],
    ['beam1_stable', true],
    ['beam2_stable', true]
];

describe('Generate golden json', () => {
    const year = 2018;
    const dataset_nameA = `/PromptReco/Collisions${year}A/DQM`;
    const dataset_nameB = `/PromptReco/Collisions${year}B/DQM`;
    const dataset_nameC = `/PromptReco/Collisions${year}C/DQM`;
    const dataset_nameD = `/PromptReco/Collisions${year}D/DQM`;
    const dataset_nameE = `/PromptReco/Collisions${year}E/DQM`;
    const dataset_nameF = `/PromptReco/Collisions${year}F/DQM`;
    const dataset_nameG = `/PromptReco/Collisions${year}G/DQM`;
    const dataset_nameH = `/PromptReco/Collisions${year}H/DQM`;
    it('Fails with no array', async () => {
        // Call with invalid array:
    });
    it('Generates correct json', async () => {
        // const parsed_json = JSON.parse(previous_json);
        const json_eraA = get_json_for_dataset(dataset_nameA);
        const json_eraB = get_json_for_dataset(dataset_nameB);
        const json_eraC = get_json_for_dataset(dataset_nameC);
        const json_eraD = get_json_for_dataset(dataset_nameD);
        const json_eraE = get_json_for_dataset(dataset_nameE);
        const json_eraF = get_json_for_dataset(dataset_nameF);
        const json_eraG = get_json_for_dataset(dataset_nameG);
        const json_eraH = get_json_for_dataset(dataset_nameH);

        const result = await Promise.all([
            json_eraA,
            json_eraB,
            json_eraC,
            json_eraD,
            json_eraE,
            json_eraF,
            json_eraG,
            json_eraH
        ]);
        let final_json = {};
        result.forEach(small_json => {
            final_json = { ...final_json, ...small_json };
        });
        console.log('finished');
        fs.writeFileSync(
            `./generated_json${year}.json`,
            JSON.stringify(final_json),
            'utf8'
        );
    });
});

const get_json_for_dataset = async dataset_name => {
    return new Promise(async (resolve, reject) => {
        const run_numbers = await get_all_distinct_run_numbers_for_dataset(
            dataset_name
        );
        const generated_json = {};
        const promises = run_numbers.map(run_number => async () => {
            try {
                const ranges = await generate_golden_json_for_dataset(
                    run_number,
                    dataset_name,
                    criteria_for_status_flags,
                    criteria_for_dcs
                );
                if (ranges.length > 0) {
                    console.log(ranges);
                    generated_json[run_number] = ranges;
                }
            } catch (e) {
                console.log(`Not generated for run: ${run_number}`);
                console.log(e);
            }
        });
        const number_of_workers = 1;
        const asyncQueue = queue(
            async promise => await promise(),
            number_of_workers
        );
        asyncQueue.drain = async () => {
            console.log(`finished ${dataset_name}`);
            resolve(generated_json);
        };

        asyncQueue.push(promises);
    });
};
