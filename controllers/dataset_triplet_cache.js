const queue = require('async').queue;
const sequelize = require('../models').sequelize;
const Sequelize = require('../models').Sequelize;
const { DatasetTripletCache, Dataset } = require('../models');
const { Op } = Sequelize;
const number_of_datasets_per_batch = 100;

exports.fill_dataset_triplet_cache = async transaction => {
    const max_version = (await DatasetTripletCache.max('version')) || 0;
    const count = await Dataset.count({
        where: {
            version: {
                [Op.gt]: max_version
            }
        }
    });

    const number_of_batches = Math.ceil(count / number_of_datasets_per_batch);
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
    if (number_of_batches < 10) {
        await Promise.all(async_functions.map(async => async()));
        console.log(
            `Cache generated for ${number_of_processed_datasets} datasets`
        );
    } else {
        const asyncQueue = queue(
            async dataset_batch => await dataset_batch(),
            1
        );
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
    }
};

exports.processDatasets = async (dataset_batch, transaction) => {
    const options = {};
    if (transaction) {
        options.transaction = transaction;
    }
    try {
        const processed_datasets = dataset_batch.map(async dataset => {
            const merged_lumisections = await sequelize.query(
                `
                SELECT run_number, "name", lumisection_number, mergejsonb(lumisection_metadata ORDER BY manual_change, version ) as "triplets", (SELECT max(version) FROM "LumisectionEvent" ) AS "version"
                FROM(
                SELECT "LumisectionEvent"."version", run_number, "name",jsonb as "lumisection_metadata", lumisection_number, manual_change  FROM "LumisectionEvent"  INNER JOIN "LumisectionEventAssignation" 
                on "LumisectionEvent"."version" = "LumisectionEventAssignation"."version" inner join "JSONBDeduplication" on "lumisection_metadata_id" = "id"
                WHERE "LumisectionEvent"."name" = '${
                    dataset.name
                }' AND "LumisectionEvent"."run_number" = '${dataset.run_number}'
                ) AS "updated_lumisectionEvents"
                GROUP BY "run_number", "name", lumisection_number 
                ORDER BY lumisection_number;
            `,
                {
                    type: sequelize.QueryTypes.SELECT
                }
            );

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
                let current_merged_lumisection_element = 0;
                for (let i = 0; i < last_lumisection_number; i++) {
                    const {
                        triplets,
                        lumisection_number
                    } = merged_lumisections[current_merged_lumisection_element];
                    if (i + 1 === lumisection_number) {
                        current_merged_lumisection_element += 1;
                        components_present_in_dataset.forEach(component => {
                            if (typeof triplets[component] === 'object') {
                                const { status, comment, cause } = triplets[
                                    component
                                ];
                                // We add the status:
                                if (
                                    typeof triplet_summary[component][
                                        status
                                    ] !== 'undefined'
                                ) {
                                    triplet_summary[component][status] += 1;
                                } else {
                                    triplet_summary[component][status] = 1;
                                }
                                // We add the comments (if any)
                                if (
                                    comment !== '' &&
                                    typeof comment !== 'undefined'
                                ) {
                                    if (
                                        !triplet_summary[
                                            component
                                        ].comments.includes(comment)
                                    ) {
                                        triplet_summary[
                                            component
                                        ].comments.push(comment);
                                    }
                                }

                                // We add the cause (if any)
                                if (
                                    cause !== '' &&
                                    typeof cause !== 'undefined'
                                ) {
                                    if (
                                        !triplet_summary[
                                            component
                                        ].causes.includes(cause)
                                    ) {
                                        triplet_summary[component].causes.push(
                                            cause
                                        );
                                    }
                                }
                            } else {
                                // If the triplet for this particular change is not in there, it was empty, so we add 1 to the count
                                triplet_summary[component]['EMPTY'] += 1;
                            }
                        });
                    } else {
                        // it is just a space between lumisections. where there are some lumisections above and some below, it just means its an empty lumisection
                        components_present_in_dataset.forEach(component => {
                            triplet_summary[component]['EMPTY'] += 1;
                        });
                    }
                }
            }
            await DatasetTripletCache.upsert(
                {
                    name: dataset.name,
                    run_number: dataset.run_number,
                    version: dataset.version,
                    triplet_summary
                },
                options
            );
        });
        return processed_datasets;
    } catch (e) {
        console.log(e);
    }
};
