const axios = require('axios');
const json_logic = require('json-logic-js');

const { API_URL } = require('../config/config')[
    process.env.ENV || 'development'
];
const { update_or_create_dataset } = require('../controllers/dataset');
const { create_rr_lumisections } = require('../controllers/lumisection');
const {
    classify_component_per_lumisection
} = require('../cron/saving_updating_runs_lumisections_utils');

exports.waiting_dqm_gui_constant = 'waiting dqm gui';

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

    const standard_waiting_list_dataset_attributes = {
        global_state: exports.waiting_dqm_gui_constant
    };
    workspaces.forEach(({ workspace }) => {
        standard_waiting_list_dataset_attributes[`${workspace}_state`] =
            exports.waiting_dqm_gui_constant;
    });

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
                    standard_waiting_list_dataset_attributes,
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
    const dataset_lumisections = [];
    lumisections.forEach(lumisection => {
        // We join the attributes from the run AND the lumisection to produce a per lumisection result:
        const run_and_lumisection_attributes = {
            ...run.oms_attributes,
            ...run.rr_attributes,
            ...lumisection
        };
        const lumisection_components = {};
        workspaces.forEach(({ workspace, columns }) => {
            // The namespace rule is the following:
            // Each workspace gets assigned a triplet by workspace-workspace. So csc would be csc-csc. Then other sub_components of that workspace get named workspace-name_of_subcomponent, so occupancy in csc would be csc-occupancy
            // So here we assign workspace-workspace, e.g. csc-csc or hcal-hcal:
            const name_of_workspace = `${workspace}-${workspace}`;
            lumisection_components[
                name_of_workspace
            ] = classify_component_per_lumisection(
                run_and_lumisection_attributes,
                classifiers,
                workspace
            );
            columns.forEach(sub_component => {
                const name_of_sub_component = `${workspace}-${sub_component}`;
                // Here we assign workspace-sub_component e.g. csc-occupancy or tracker-pix
                lumisection_components[
                    name_of_sub_component
                ] = classify_component_per_lumisection(
                    run_and_lumisection_attributes,
                    classifiers,
                    name_of_sub_component
                );
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
        const saved_lumisections = await create_rr_lumisections(
            run_number,
            dataset_name,
            lumisections,
            event_info,
            transaction
        );
    }
};
