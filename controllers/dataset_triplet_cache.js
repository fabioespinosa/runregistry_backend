const sequelize = require('../models').sequelize;
const Sequelize = require('../models').Sequelize;
const { DatasetTripletCache, Dataset } = require('../models');
const { Op } = Sequelize;

exports.fillDatasetTripletCache = async version => {
    try {
        const max_version = (await DatasetTripletCache.max('version')) || 0;
        const count = await Dataset.count({
            where: {
                version: {
                    [Op.gt]: max_version
                },
                run_number: {
                    [Op.lte]: 2000
                }
            }
        });
        const selected_datasets = await Dataset.findAll({
            where: {
                version: {
                    [Op.lt]: await DatasetTripletCache.max('version')
                },
                run_number: {
                    [Op.lte]: 2000
                }
            }
        });

        selected_datasets.forEach(async dataset => {
            const merged_lumisections = await sequelize.query(
                `
                SELECT run_number, "name", lumisection_number, mergejsonb(lumisection_metadata ORDER BY version ) as "triplets", (SELECT max(version) FROM "LumisectionEvent" ) AS "version"
                FROM(
                SELECT "LumisectionEvent"."version", run_number, "name", lumisection_metadata, lumisection_number from "LumisectionEvent"  inner join "LumisectionEventAssignation" 
                    on "LumisectionEvent"."version" = "LumisectionEventAssignation"."version" 
                WHERE "LumisectionEvent"."name" = '${
                    dataset.name
                }' AND "LumisectionEvent"."run_number" = '${dataset.run_number}'
                ) AS "updated_lumisectionEvents"
                GROUP BY "run_number", "name", lumisection_number ORDER BY lumisection_number;
            `,
                {
                    type: sequelize.QueryTypes.SELECT
                }
            );

            // Put all the components present in the dataset
            const components_present_in_dataset = [];
            merged_lumisections.forEach(({ triplets }) => {
                for (const [component, val] of Object.entries(triplets)) {
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
                                    triplet_summary[component].comments.push(
                                        comment
                                    );
                                }

                                // We add the cause (if any)
                                if (
                                    cause !== '' &&
                                    typeof cause !== 'undefined'
                                ) {
                                    triplet_summary[component].causes.push(
                                        cause
                                    );
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
            await DatasetTripletCache.upsert({
                name: dataset.name,
                run_number: dataset.run_number,
                version: dataset.version,
                triplet_summary
            });
        });
    } catch (e) {
        console.log(e);
    }
};
