const { Client } = require('pg');
const queue = require('async').queue;
const sequelize = require('../../models').sequelize;

const axios = require('axios');
const {
    save_individual_dataset
} = require('../../cron_datasets/1.create_datasets');

const connectionString =
    'postgresql://fabioespinosa:@localhost:5432/intermediate_rr';
const { API_URL } = require('../../config/config')['development'];

exports.save_runs_from_old_rr = async (rows, number_of_tries) => {
    const client = new Client({
        connectionString: connectionString
    });
    await client.connect();

    if (!rows) {
        const result = await client.query(`
            select offline.* from offline 
            where run_number >= 123411 and rda_name <> '/Global/Online/ALL' and (offline.workspace_states -> 'global') is not null and lumisection_ranges is not null
            order by run_number ASC;
        `);
        rows = result.rows;
    }
    let saved_runs = 0;
    const runs_not_saved = [];
    const promises = rows.map(row => async () => {
        try {
            let {
                run_number,
                rda_name: dataset_name,
                workspace_states,
                lumisection_ranges,
                workspace_user,
                rda_created,
                workspace_comments
            } = row;

            if (lumisection_ranges === null || !lumisection_ranges) {
                throw 'Lumisection_ranges cannot be null';
            }
            const preformatted_lumisections = expand_ranges_to_lumisections(
                lumisection_ranges
            );
            const rr_lumisections = generate_rr_lumisections(
                row,
                preformatted_lumisections
            );

            const new_workspace_states = {};
            for (const [key, val] of Object.entries(workspace_states)) {
                new_workspace_states[`${key.toLowerCase()}_state`] = val;
            }
            // State of each workspace:
            const dataset_attributes = {
                ...new_workspace_states
            };
            const event_info = {
                email: `auto@auto MIG: ${
                    workspace_user
                        ? workspace_user.global && workspace_user.global
                        : ''
                }`,
                comment: 'migration from previous RR'
            };
            const transaction = await sequelize.transaction();
            await save_individual_dataset(
                dataset_name,
                run_number,
                dataset_attributes,
                rr_lumisections,
                transaction,
                event_info
            );
            await transaction.commit();
        } catch (e) {
            runs_not_saved.push(row);
            console.log(e);
        }
    });
    const number_of_workers = 1;
    const asyncQueue = queue(async run => await run(), number_of_workers);

    // When runs finished saving:
    asyncQueue.drain = async () => {
        console.log(`${saved_runs} run(s) saved`);
        if (runs_not_saved.length > 0) {
            const run_numbers_of_runs_not_saved = runs_not_saved.map(
                ({ run_number }) => run_number
            );
            console.log(
                `WARNING: ${
                    runs_not_saved.length
                } run(s) were not saved. They are: ${run_numbers_of_runs_not_saved}.`
            );
            console.log('------------------------------');
            console.log('------------------------------');
            if (number_of_tries < 4) {
                console.log(
                    `TRYING AGAIN: with ${runs_not_saved.length} run(s)`
                );
                number_of_tries += 1;
                await exports.save_runs_from_old_rr(
                    runs_not_saved,
                    number_of_tries
                );
            } else {
                console.log(
                    `After trying 4 times, ${run_numbers_of_runs_not_saved} run(s) were not saved`
                );
            }
        }
    };
    asyncQueue.error = err => {
        console.log(`Critical error saving runs, ${JSON.stringify(err)}`);
    };

    asyncQueue.push(promises);
};

(async () => exports.save_runs_from_old_rr(undefined, 1))();

const expand_ranges_to_lumisections = lumisection_ranges => {
    const lumisections = [];
    lumisection_ranges.forEach(range => {
        const { rdr_section_from, rdr_section_to } = range;
        for (let i = rdr_section_from; i <= rdr_section_to; i++) {
            lumisections.push(range);
        }
    });
    return lumisections;
};

// Go from run to lumisections (per component)
const generate_rr_lumisections = (row, lumisections) => {
    if (lumisections === null || !lumisections) {
        throw 'Lumisections cannot be null';
    }
    return lumisections.map(lumisection => {
        const current_lumisection = {};
        for (let [key, triplet] of Object.entries(row)) {
            if (key.includes('-')) {
                const workspace = key.split('-')[0];
                const component = key.split('-')[1];
                if (workspace === component) {
                    // We are dealing with a local column (e.g. ecal-ecal, which will be replaced with global-ecal)
                    continue;
                }
                // The following will be replaced by the global one (btag-btag, jetmet-jetmet, l1t-l1tmu, l1t-l1tcalo, tracker-pix, tracker-strip, ecal-es)
                if (workspace === 'btag' && component === 'btag') {
                    continue;
                }
                if (workspace === 'jetmet' && component === 'jetmet') {
                    continue;
                }
                if (workspace === 'muon' && component === 'muon') {
                    continue;
                }
                if (workspace === 'tau' && component === 'tau') {
                    continue;
                }
                if (workspace === 'tracker' && component === 'track') {
                    continue;
                }
                if (
                    workspace === 'l1t' &&
                    (component === 'l1tmu' || component === 'l1tcalo')
                ) {
                    continue;
                }
                if (
                    workspace === 'tracker' &&
                    (component === 'pixel' || component === 'strip')
                ) {
                    continue;
                }
                if (workspace === 'ecal' && component === 'es') {
                    continue;
                }
                // if it includes "-" it is a triplet.
                let final_status = 'NOTSET';
                if (triplet === null) {
                    final_status = 'NOTSET';
                } else if (triplet.status !== 'GOOD') {
                    final_status = triplet.status;
                }
                // If it is one of the columns set in the lumisection table, we must check if we can apply the lumisection bit:
                else if (
                    [
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
                        'lowlumi',
                        'lumi',
                        'pix',
                        'rpc',
                        'strip',
                        'track'
                    ].includes(component)
                ) {
                    // Value must be GOOD, meaning it has some good lumisections inside:
                    const ls_status = lumisection[`lse_${component}`];
                    if (ls_status === null || component === 'cms') {
                        final_status = 'GOOD';
                    } else if (ls_status === 1) {
                        console.log(
                            `Run has lumisection bits: ${
                                row.run_number
                            } for ${key}`
                        );
                        final_status = 'GOOD';
                    } else {
                        // other scenario is 0:
                        final_status = 'BAD';
                    }
                } else {
                    // If it is not global, then it will be GOOD:
                    final_status = 'GOOD';
                }
                if (key.startsWith('global-')) {
                    if (component === 'l1tmu' || component === 'l1tcalo') {
                        key = `l1t-${component}`;
                    } else if (
                        component === 'pix' ||
                        component === 'strip' ||
                        component === 'track'
                    ) {
                        key = `tracker-${component}`;
                    } else if (component === 'es') {
                        key = `ecal-${component}`;
                    } else {
                        key = `${component}-${component}`;
                    }
                }
                current_lumisection[key] = {
                    status: final_status,
                    comment: triplet ? triplet.comment : '',
                    cause: triplet ? triplet.cause : ''
                };
            }
        }
        return current_lumisection;
    });
};
