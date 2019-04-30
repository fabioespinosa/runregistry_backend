const fs = require('fs');
const {
    generate_golden_json_for_dataset
} = require('../controllers/json_creation');
const previous_json = fs.readFileSync(`${__dirname}/previous_json.json`);

describe('Generate golden json', () => {
    const run_numbers = [321879, 321777, 322204];
    const run_number = 322204;
    const dataset_name = '/PromptReco/Collisions2018D/DQM';
    it('Fails with no array', async () => {
        // Call with invalid array:
    });
    it('Generates correct json', async () => {
        // const parsed_json = JSON.parse(previous_json);
        const generated_json = {};
        // for (const [key, val] of Object.entries(parsed_json)) {
        // const run_number = +key;
        // try {
        const promises = run_numbers.map(async run_number => {
            const ranges = await generate_golden_json_for_dataset(
                run_number,
                dataset_name,
                [
                    ['dt-dt', 'GOOD'],
                    ['csc-csc', 'GOOD'],
                    ['l1t-l1tcalo', 'GOOD'],
                    ['hlt-hlt', 'GOOD'],
                    ['tracker-pix', 'GOOD'],
                    ['tracker-strip', 'GOOD'],
                    ['tracker-track', 'GOOD'],
                    ['ecal-ecal', 'GOOD'],
                    ['hcal-hcal', 'GOOD'],
                    ['ecal-es', 'GOOD'],
                    ['egamma-egamma', 'GOOD'],
                    ['muon-muon', 'GOOD'],
                    ['jetmet-jetmet', 'GOOD'],
                    ['lumi-lumi', 'GOOD']
                ],
                [
                    ['cms_active', true],
                    ['bpix_ready', true],
                    ['fpix_ready', true],
                    ['tibtid_ready', true],
                    ['tecm_ready', true],
                    ['tecp_ready', true],
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
                    ['rpc_ready', true]
                ]
            );
            console.log(ranges);
            generated_json[run_number] = ranges;
        });

        await Promise.all(promises);

        //         generated_json[run_number] = ranges;
        //     } catch (e) {}
        // }
        // fs.writeFileSync(
        //     './generated_json.json',
        //     JSON.stringify(generated_json),
        //     'utf-8'
        // );
    });
});
