const queue = require('async').queue;
const sequelize = require('../models').sequelize;
const Sequelize = require('../models').Sequelize;
const { DatasetTripletCache, Dataset, Run } = require('../models');
const { Op } = Sequelize;
const number_of_datasets_per_batch = 50;

exports.fill_dataset_triplet_cache = async transaction => {
    return new Promise(async (resolve, reject) => {
        const max_version = (await DatasetTripletCache.max('version')) || 0;
        const count = await Dataset.count({
            where: {
                version: {
                    [Op.gt]: max_version
                }
            }
        });

        const number_of_batches = Math.ceil(
            count / number_of_datasets_per_batch
        );
        const async_functions = [];
        let number_of_processed_datasets = 0;
        for (let i = 0; i < number_of_batches; i++) {
            async_functions.push(async () => {
                const dataset_batch = await Dataset.findAll({
                    where: {
                        version: {
                            [Op.gt]: max_version
                        }
                    },
                    order: [['version', 'ASC'], ['run_number', 'ASC']],
                    limit: number_of_datasets_per_batch,
                    offset: i * number_of_datasets_per_batch
                });
                const processed_datasets = await exports.processDatasets(
                    dataset_batch,
                    transaction
                );
                number_of_processed_datasets += processed_datasets.length;
            });
        }
        console.log(`Processing for ${count} datasets.`);
        const asyncQueue = queue(
            async dataset_batch => await dataset_batch(),
            1
        );
        asyncQueue.drain = async () => {
            console.log(
                `Cache generated for ${number_of_processed_datasets} datasets`
            );
            resolve();
        };
        asyncQueue.error = err => {
            console.log('Error: ');
            console.log(err);
            reject();
            throw err;
        };
        await asyncQueue.push(async_functions);
    });
};

exports.processDatasets = async (
    dataset_batch,
    transaction,
    number_of_tries
) => {
    const options = {};
    if (transaction) {
        options.transaction = transaction;
    }
    const promises = dataset_batch.map(async dataset => {
        try {
            const { name, run_number } = dataset;
            const merged_lumisections = await sequelize.query(
                // Query will aggregate all the lumisections of the run and go for the OMS values and RR values
                `
                    SELECT "run_number", "name", "lumisection_number", "triplets", "dcs_bits"
                    FROM
                    
                      (SELECT "run_number" as "run_number", "lumisection_number" as "lumisection_number", mergejsonb("jsonb" ORDER BY version) as "dcs_bits"
                        from "OMSLumisectionEventAssignation"
                            inner join(
                    SELECT "OMSLumisectionEvent"."version" as "version3", "run_number", "name", "jsonb"
                            from "OMSLumisectionEvent" inner join "JSONBDeduplication" ON "OMSLumisectionEvent"."lumisection_metadata_id" = "JSONBDeduplication"."id" inner join "Event" on "OMSLumisectionEvent"."version" = "Event"."version"
                            ORDER BY "OMSLumisectionEvent"."version" DESC) as "OMSMerged" on "OMSLumisectionEventAssignation"."version" = "OMSMerged"."version3"
                            -- We filter by dataset name, since we want those changes that came from online first, and if there are changes from offline, they are applied in the correct order by the mergejsonb which orders by version (and naturally the version of the dataset goes after the online)
                            WHERE (name = 'online' OR name = '${name}' )
                        GROUP BY "run_number", "lumisection_number"

                            ) as "oms"

                        left outer join

                        (SELECT "run_number" as "rr_run_number", "name", "lumisection_number" as "rr_lumisection_number", mergejsonb("jsonb" ORDER BY manual_change, version) as "triplets"
                        from "LumisectionEventAssignation"
                            inner join (
                    SELECT "LumisectionEvent"."version" as "version2", "run_number", "name", "jsonb", "manual_change"
                            from "LumisectionEvent" inner join "JSONBDeduplication" ON "LumisectionEvent"."lumisection_metadata_id" = "JSONBDeduplication"."id" inner join "Event" on "LumisectionEvent"."version" = "Event"."version"
                            ORDER BY "LumisectionEvent"."version" DESC) as "Merged" on "LumisectionEventAssignation"."version" = "Merged"."version2"
                        group by "run_number", "name", "lumisection_number"
                            
                            ) as "rr"
                    ON "oms"."run_number" = "rr"."rr_run_number"  and "rr"."rr_lumisection_number" = "oms"."lumisection_number" 
                        
                    WHERE (
                        "run_number" = ${run_number} AND
                         (name is null or name = '${name}')
                    ) 
            `,
                {
                    type: sequelize.QueryTypes.SELECT
                }
            );
            const dcs_summary = calculate_dcs_bits_cache(merged_lumisections);
            const triplet_summary = calculate_rr_cache(merged_lumisections);
            const rr_ranges = calculate_rr_ranges(merged_lumisections);
            const dcs_ranges = calculate_oms_ranges(merged_lumisections);
            await DatasetTripletCache.upsert(
                {
                    name: dataset.name,
                    run_number: dataset.run_number,
                    version: dataset.version,
                    dcs_summary,
                    triplet_summary,
                    rr_ranges,
                    dcs_ranges
                },
                options
            );
            return;
        } catch (err) {
            console.log(
                `Failed for dataset ${dataset.name} of run ${dataset.run_number}`
            );
            if (!number_of_tries || number_of_tries < 5) {
                if (typeof number_of_tries === 'undefined') {
                    number_of_tries = 0;
                }
                console.log(`Trying again for ${number_of_tries} time`);
                setImmediate(
                    exports.processDatasets.bind(
                        null,
                        [dataset],
                        null,
                        number_of_tries + 1
                    )
                );
            } else {
                console.log(
                    `Failed completely for ${dataset.name} of run ${dataset.run_number}`
                );
                console.log(err);
            }
        }
    });
    return await Promise.all(promises);
};

exports.fill_for_unfilled_datasets = async transaction => {
    const count_query_function = async () =>
        await sequelize.query(
            `
                SELECT count(*) FROM "Dataset" LEFT JOIN "DatasetTripletCache" 
                ON "Dataset".run_number = "DatasetTripletCache".run_number AND "Dataset".name = "DatasetTripletCache".name 
                WHERE triplet_summary IS NULL
            `,
            {
                type: sequelize.QueryTypes.SELECT
            }
        );
    const count_query_result = await count_query_function();
    let { count } = count_query_result[0];
    count = +count;

    const number_of_batches = Math.ceil(count / number_of_datasets_per_batch);
    const async_functions = [];
    let number_of_processed_datasets = 0;
    for (let i = 0; i < number_of_batches; i++) {
        async_functions.push(async () => {
            const dataset_batch = await sequelize.query(
                `
                SELECT "Dataset".* FROM "Dataset"
                LEFT JOIN "DatasetTripletCache" ON "Dataset".run_number = "DatasetTripletCache".run_number AND "Dataset".name = "DatasetTripletCache".name
                WHERE triplet_summary IS NULL
                ORDER BY "Dataset".run_number ASC
                LIMIT ${number_of_datasets_per_batch}
                OFFSET ${i * number_of_datasets_per_batch};
                `,
                {
                    type: sequelize.QueryTypes.SELECT
                }
            );
            const processed_datasets = await exports.processDatasets(
                dataset_batch,
                transaction
            );
            number_of_processed_datasets += processed_datasets.length;
        });
    }

    console.log(`Processing for ${count} datasets.`);
    const number_of_workers = 4;
    const asyncQueue = queue(
        async dataset_batch => await dataset_batch(),
        number_of_workers
    );
    asyncQueue.drain = async () => {
        console.log(
            `Cache generated for ${number_of_processed_datasets} datasets`
        );

        // There might still be some datasets that need to be calculated that due to the offset haven't been calculated:
        const new_count_result = await count_query_function();
        const new_count = new_count_result[0].count;
        if (new_count > 0) {
            console.log(
                `Still ${new_count} datasets that need to be calculated, please wait`
            );
            await exports.fill_for_unfilled_datasets(transaction);
        }
    };
    asyncQueue.error = err => {
        console.log('Error: ');
        console.log(err);
        throw err;
    };
    await asyncQueue.push(async_functions);
};

exports.recalculate_all_triplet_cache = async transaction => {
    const count = await Dataset.count();
    const number_of_batches = Math.ceil(count / number_of_datasets_per_batch);
    const async_functions = [];
    let number_of_processed_datasets = 0;
    for (let i = 0; i < number_of_batches; i++) {
        async_functions.push(async () => {
            const dataset_batch = await Dataset.findAll({
                order: [['version', 'ASC'], ['run_number', 'ASC']],
                limit: number_of_datasets_per_batch,
                offset: i * number_of_datasets_per_batch
            });
            const processed_datasets = await exports.processDatasets(
                dataset_batch,
                transaction
            );
            number_of_processed_datasets += processed_datasets.length;
        });
    }

    console.log(`Processing for ${count} datasets.`);
    const asyncQueue = queue(async dataset_batch => await dataset_batch(), 4);
    asyncQueue.drain = async () => {
        console.log(
            `Cache generated for ${number_of_processed_datasets} datasets`
        );
    };
    asyncQueue.error = err => {
        console.log('Error: ');
        console.log(err);
        throw err;
    };
    await asyncQueue.push(async_functions);
};

const calculate_dcs_bits_cache = merged_lumisections => {
    // Put all the dcs bits present in the dataset
    const dcs_present_in_dataset = [];
    merged_lumisections.forEach(({ dcs_bits }) => {
        for (const [dcs_bit, val] of Object.entries(dcs_bits)) {
            // dcs_bit is the key, val is the value
            if (
                !dcs_present_in_dataset.includes(dcs_bit) &&
                // Luminosity cannot be summarized:
                ![
                    'end_lumi',
                    'init_lumi',
                    'recorded_lumi',
                    'delivered_lumi',
                    'live_lumi_per_lumi',
                    'recorded_lumi_per_lumi',
                    'delivered_lumi_per_lumi'
                ].includes(dcs_bit)
            ) {
                dcs_present_in_dataset.push(dcs_bit);
            }
        }
    });

    const dcs_summary = {};
    // Initialize empty components:
    dcs_present_in_dataset.forEach(dcs_bit => {
        dcs_summary[dcs_bit] = {
            TRUE: 0,
            FALSE: 0,
            NULL: 0,
            EMPTY: 0
        };
    });

    // Insert data:
    if (merged_lumisections.length > 0) {
        const last_lumisection_number =
            merged_lumisections[merged_lumisections.length - 1]
                .lumisection_number;
        let current_merged_lumisection_element = 0;
        for (let i = 0; i < last_lumisection_number; i++) {
            const { dcs_bits, lumisection_number } = merged_lumisections[
                current_merged_lumisection_element
            ];
            if (i + 1 === lumisection_number) {
                current_merged_lumisection_element += 1;
                dcs_present_in_dataset.forEach(dcs_bit => {
                    if (typeof dcs_bits[dcs_bit] !== 'undefined') {
                        const dcs_bit_value = dcs_bits[dcs_bit];

                        // If the value is null:
                        if (dcs_bit_value === null) {
                            dcs_summary[dcs_bit]['NULL'] += 1;
                        }
                        if (dcs_bit_value === true) {
                            dcs_summary[dcs_bit]['TRUE'] += 1;
                        }
                        if (dcs_bit_value === false) {
                            dcs_summary[dcs_bit]['FALSE'] += 1;
                        }
                    } else {
                        // If the triplet for this particular change is not in there, it was empty, so we add 1 to the count
                        dcs_summary[dcs_bit]['EMPTY'] += 1;
                    }
                });
            } else {
                // it is just a space between lumisections. where there are some lumisections above and some below, it just means its an empty lumisection
                dcs_present_in_dataset.forEach(dcs_bit => {
                    dcs_summary[dcs_bit]['EMPTY'] += 1;
                });
            }
        }
    }

    return dcs_summary;
};

const calculate_rr_cache = merged_lumisections => {
    // If there is null in the triplets, means that the lumisections
    if (
        merged_lumisections.length > 0 &&
        merged_lumisections[0].triplets === null
    ) {
        return {};
    }
    // Put all the components present in the dataset
    const components_present_in_dataset = [];
    merged_lumisections.forEach(({ triplets }) => {
        for (const [component, val] of Object.entries(triplets)) {
            // component is the key, val is the value
            if (!components_present_in_dataset.includes(component)) {
                components_present_in_dataset.push(component);
            }
        }
    });

    const triplet_summary = {};
    // Initialize empty components:
    components_present_in_dataset.forEach(component => {
        triplet_summary[component] = {
            EMPTY: 0,
            comments: [],
            causes: []
        };
    });
    // Insert data:
    if (merged_lumisections.length > 0) {
        const last_lumisection_number =
            merged_lumisections[merged_lumisections.length - 1]
                .lumisection_number;
        // We use current_merged_lumisection_element to extract the lumisection_number from the element in merged_lumisections
        let current_merged_lumisection_element = 0;
        for (let i = 0; i < last_lumisection_number; i++) {
            const { triplets, lumisection_number } = merged_lumisections[
                current_merged_lumisection_element
            ];
            if (i + 1 === lumisection_number) {
                current_merged_lumisection_element += 1;
                components_present_in_dataset.forEach(component => {
                    if (typeof triplets[component] === 'object') {
                        const { status, comment, cause } = triplets[component];
                        // We add the status:
                        if (
                            typeof triplet_summary[component][status] !==
                            'undefined'
                        ) {
                            triplet_summary[component][status] += 1;
                        } else {
                            triplet_summary[component][status] = 1;
                        }
                        // We add the comments (if any)
                        if (comment !== '' && typeof comment !== 'undefined') {
                            if (
                                !triplet_summary[component].comments.includes(
                                    comment
                                )
                            ) {
                                triplet_summary[component].comments.push(
                                    comment
                                );
                            }
                        }

                        // We add the cause (if any)
                        if (cause !== '' && typeof cause !== 'undefined') {
                            if (
                                !triplet_summary[component].causes.includes(
                                    cause
                                )
                            ) {
                                triplet_summary[component].causes.push(cause);
                            }
                        }
                    } else {
                        // If the triplet for this particular change is not in there, it was empty, so we add 1 to the count
                        triplet_summary[component]['EMPTY'] += 1;
                    }
                });
            } else {
                // it is just a space between lumisections. where there are some lumisections above and some below, it just means its an empty lumisection, which should not happen
                components_present_in_dataset.forEach(component => {
                    triplet_summary[component]['EMPTY'] += 1;
                });
            }
        }
    }
    return triplet_summary;
};

const calculate_rr_ranges = merged_lumisections => {
    if (
        merged_lumisections.length > 0 &&
        merged_lumisections[0].triplets === null
    ) {
        return {};
    }
    // Put all the components present in the dataset
    const components_present_in_dataset = [];
    merged_lumisections.forEach(({ triplets }) => {
        for (const [component, val] of Object.entries(triplets)) {
            // component is the key, val is the value
            if (!components_present_in_dataset.includes(component)) {
                components_present_in_dataset.push(component);
            }
        }
    });

    const lumisections_component_status = {};

    components_present_in_dataset.forEach(component => {
        lumisections_component_status[component] = { EMPTY: [] };
    });

    /**  
First step is to get it in the form of 
    lumisections_component_status = {
        castor: {
            GOOD: [34, 35,36, ..., 69, 80, 81...,90],
            BAD: [95, 96, 97..., 100, 111, 112, ],
            STANDBY: [95, 96, 97..., 100, 111, 112, ],
            NOTSET: [95, 96, 97..., 100, 111, 112, ],
        },
        ...
    }

    **/

    // We use a for (i) and not a forEach becuase we want to make sure the indices were correctly assigned, if they weren't we still reflect that with EMPTY lumisections
    if (merged_lumisections.length > 0) {
        const last_lumisection_number =
            merged_lumisections[merged_lumisections.length - 1]
                .lumisection_number;
        let current_merged_lumisection_element = 0;
        for (let i = 0; i < last_lumisection_number; i++) {
            const { triplets, lumisection_number } = merged_lumisections[
                current_merged_lumisection_element
            ];
            if (i + 1 === lumisection_number) {
                current_merged_lumisection_element += 1;
                components_present_in_dataset.forEach(component => {
                    if (typeof triplets[component] === 'object') {
                        const { status } = triplets[component];
                        if (
                            typeof lumisections_component_status[component][
                                status
                            ] === 'undefined'
                        ) {
                            lumisections_component_status[component][status] = [
                                lumisection_number
                            ];
                        } else {
                            lumisections_component_status[component][
                                status
                            ].push(lumisection_number);
                        }
                    } else {
                        lumisections_component_status[component]['EMPTY'].push(
                            lumisection_number
                        );
                    }
                });
            } else {
                components_present_in_dataset.forEach(component => {
                    lumisections_component_status[component]['EMPTY'].push(
                        lumisection_number
                    );
                });
            }
        }
    }

    /**  

    Now we want to get the ranges:
    
    ranges_per_component = {
        castor: {
            GOOD: [[34, 69], [80, 90]],
            BAD: [[95, 100], [111, 114], [170, 180]],
            STANDBY: [[95, 100], [111, 114], [170, 180]],
            NOTSET: [[95, 100], [111, 114], [170, 180]],
        },
        ...
    }
    **/

    const ranges_in_component = {};

    components_present_in_dataset.forEach(component => {
        ranges_in_component[component] = {};
    });

    for (const [component_name, component_values] of Object.entries(
        lumisections_component_status
    )) {
        for (const [status, lumisection_numbers] of Object.entries(
            component_values
        )) {
            ranges_in_component[component_name][
                status
            ] = convert_array_of_list_to_array_of_ranges(lumisection_numbers);
        }
    }

    return ranges_in_component;
};

const calculate_oms_ranges = merged_lumisections => {
    // Put all the dcs bits present in the dataset
    const dcs_present_in_dataset = [];
    merged_lumisections.forEach(({ dcs_bits }) => {
        for (const [dcs_bit, val] of Object.entries(dcs_bits)) {
            // dcs_bit is the key, val is the value
            if (
                !dcs_present_in_dataset.includes(dcs_bit) &&
                // Luminosity cannot be summarized:
                ![
                    'end_lumi',
                    'init_lumi',
                    'recorded_lumi',
                    'delivered_lumi',
                    'live_lumi_per_lumi',
                    'recorded_lumi_per_lumi',
                    'delivered_lumi_per_lumi'
                ].includes(dcs_bit)
            ) {
                dcs_present_in_dataset.push(dcs_bit);
            }
        }
    });

    const lumisection_dcs_values = {};
    // Initialize empty components:
    dcs_present_in_dataset.forEach(dcs_bit => {
        lumisection_dcs_values[dcs_bit] = {
            TRUE: [],
            FALSE: [],
            NULL: [],
            EMPTY: []
        };
    });

    // Insert data:
    if (merged_lumisections.length > 0) {
        const last_lumisection_number =
            merged_lumisections[merged_lumisections.length - 1]
                .lumisection_number;
        let current_merged_lumisection_element = 0;
        for (let i = 0; i < last_lumisection_number; i++) {
            const { dcs_bits, lumisection_number } = merged_lumisections[
                current_merged_lumisection_element
            ];
            if (i + 1 === lumisection_number) {
                current_merged_lumisection_element += 1;
                dcs_present_in_dataset.forEach(dcs_bit => {
                    if (typeof dcs_bits[dcs_bit] !== 'undefined') {
                        const dcs_bit_value = dcs_bits[dcs_bit];
                        // If the value is null:
                        if (dcs_bit_value === null) {
                            lumisection_dcs_values[dcs_bit]['NULL'].push(
                                lumisection_number
                            );
                        }
                        if (dcs_bit_value === true) {
                            lumisection_dcs_values[dcs_bit]['TRUE'].push(
                                lumisection_number
                            );
                        }
                        if (dcs_bit_value === false) {
                            lumisection_dcs_values[dcs_bit]['FALSE'].push(
                                lumisection_number
                            );
                        }
                    } else {
                        lumisection_dcs_values[dcs_bit]['EMPTY'].push(
                            lumisection_number
                        );
                    }
                });
            } else {
                // it is just a space between lumisections. where there are some lumisections above and some below, it just means its an empty lumisection
                dcs_present_in_dataset.forEach(dcs_bit => {
                    lumisection_dcs_values[dcs_bit]['EMPTY'].push(
                        lumisection_number
                    );
                });
            }
        }
    }

    const ranges_in_dcs = {};

    dcs_present_in_dataset.forEach(dcs_bit => {
        ranges_in_dcs[dcs_bit] = {};
    });

    for (const [dcs_name, dcs_values] of Object.entries(
        lumisection_dcs_values
    )) {
        for (const [value, lumisection_numbers] of Object.entries(dcs_values)) {
            ranges_in_dcs[dcs_name][
                value
            ] = convert_array_of_list_to_array_of_ranges(lumisection_numbers);
        }
    }

    return ranges_in_dcs;
};

const convert_array_of_list_to_array_of_ranges = list_of_lumisections => {
    const array_of_ranges = [];
    list_of_lumisections.forEach((lumisection_number, index) => {
        if (array_of_ranges.length === 0) {
            array_of_ranges.push([lumisection_number, lumisection_number]);
        }
        // If we are not in the end of the array:
        if (index !== list_of_lumisections.length - 1) {
            // If the next lumisection is equal to the current lumisection +1 (they both belong to the same range)
            if (list_of_lumisections[index + 1] === lumisection_number + 1) {
                array_of_ranges[array_of_ranges.length - 1][1] =
                    lumisection_number + 1;
            } else {
                // If not, we are at the end of the current range, therefore we need to insert a new range, starting from the next lumisection in the array which is +1 the current position:
                array_of_ranges.push([
                    list_of_lumisections[index + 1],
                    list_of_lumisections[index + 1]
                ]);
            }
        }
    });
    return array_of_ranges;
};
