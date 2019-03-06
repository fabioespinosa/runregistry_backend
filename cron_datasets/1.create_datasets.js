const axios = require('axios');
const json_logic = require('json-logic-js');

const { API_URL } = require('../config/config')[
    process.env.NODE_ENV || 'development'
];
const { update_or_create_dataset } = require('../controllers/dataset');
const { create_lumisections } = require('../controllers/lumisection');

exports.create_offline_waiting_datasets = async (run, transaction) => {
    const { run_number, rr_attributes } = run;
    const { data: datasets_accepted } = await axios.get(
        `${API_URL}/datasets_accepted/${rr_attributes.class}`
    );
    // We get the lumisections from online dataset
    const { data: lumisections } = await axios.post(
        `${API_URL}/datasets_get_lumisections`,
        {
            name: 'online',
            run_number
        }
    );
    const { data: workspaces } = await axios.get(`${API_URL}/workspaces`);

    const { data: classifiers } = await axios.get(
        `${API_URL}/classifiers/offline_component`
    );

    const datasets_accepted_promises = datasets_accepted.map(
        async ({ run_from, run_to, enabled, name }) => {
            if (run_number >= run_from && run_number <= run_to && enabled) {
                const classified_lumisections = classify_dataset_lumisections(
                    run,
                    lumisections,
                    workspaces,
                    classifiers
                );
                return await save_individual_dataset(
                    name,
                    run_number,
                    { global_state: 'waiting dqm gui' },
                    classified_lumisections,
                    transaction
                );
            }
        }
    );
    await Promise.all(datasets_accepted_promises);
    return datasets_accepted_promises;
};

const classify_dataset_lumisections = (
    run,
    lumisections,
    workspaces,
    classifiers
) => {
    // We need offline component classifiers,
    // We need the offline workspace structure
    // We need the lumisections of the run to compare them with the classifiers
    const dataset_lumisections = [];
    lumisections.forEach(lumisection => {
        const lumisection_components = {};
        workspaces.forEach(workspace => {
            workspace.columns.forEach(column => {
                const component_classifiers = classifiers.filter(
                    classifier => classifier.component === column
                );

                // Setup a hash of the classifier of this specific component by status (so that it can be accessed later)
                const component_classifiers_indexed_by_status = {};
                component_classifiers.forEach(classifier => {
                    component_classifiers_indexed_by_status[
                        classifier.status
                    ] = classifier;
                });

                // We start with the worst possible priority status (NO VALUE FOUND) once it finds a higher priority status, then we change it
                lumisection_components[column] = {
                    status: 'NO VALUE FOUND',
                    comment: '',
                    cause: ''
                };

                // And then for each classifier inside the component, we find its priority and check if its superior then the actual one
                component_classifiers.forEach(classifier => {
                    const classifier_json = JSON.parse(classifier.classifier);
                    // We join the attributes from the run AND the lumisection to produce a per lumisection result:
                    const run_and_lumisection_attributes = {
                        ...run.rr_attributes,
                        ...lumisection[`${workspace.workspace}_triplet`]
                    };
                    // If it passes the classifier test for this lumisection:
                    if (
                        json_logic.apply(
                            classifier_json,
                            run_and_lumisection_attributes
                        )
                    ) {
                        const assigned_status = classifier.status;
                        // We have to compare priorities to the previous one assigned
                        const previous_status =
                            lumisection_components[column].status;
                        // In priority the less, the more priority, priority 1 is more important than priority 2:
                        // If the newly calculated status has higher priority than the previous one, then assigned it to the triplet (the classifier by default returns NO VALUE FOUND if it does not pass the test)
                        if (
                            previous_status === 'NO VALUE FOUND' ||
                            component_classifiers_indexed_by_status[
                                assigned_status
                            ].priority <
                                component_classifiers_indexed_by_status[
                                    previous_status
                                ].priority
                        ) {
                            lumisection_components[
                                column
                            ].status = assigned_status;
                        }
                    }
                });
            });
        });
        dataset_lumisections.push(lumisection_components);
    });
    return dataset_lumisections;
};
const save_individual_dataset = async (
    dataset_name,
    run_number,
    dataset_attributes,
    lumisections,
    transaction
) => {
    const event_info = {
        email: 'auto@auto',
        comment: 'Run signed off, dataset creation'
    };
    // The only reason we do not do this via HTTP is because we want it to be a transaction
    const saved_dataset = await update_or_create_dataset(
        dataset_name,
        run_number,
        dataset_attributes,
        event_info,
        transaction
    );
    if (lumisections.length > 0) {
        const saved_lumisections = await create_lumisections(
            run_number,
            dataset_name,
            [],
            lumisections,
            event_info,
            transaction
        );
    }
};
