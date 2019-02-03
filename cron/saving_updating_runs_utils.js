const axios = require('axios');
const json_logic = require('json-logic-js');
const { handleErrors } = require('../utils/error_handlers');
const { API_URL, OMS_URL, OMS_LUMISECTIONS } = require('../config/config')[
    process.env.NODE_ENV || 'development'
];

const { online_components } = require('../config/config');

exports.setupRun = async (run, now) => {
    run = await exports.setComponentsIncludedBooleans(run);
    run = await exports.getLumisectionAttributes(run);
    run = exports.fill_component_status(run, now);
    return run;
};
// Takes the 'included array' from API and turns it into attributes:
exports.setComponentsIncludedBooleans = handleErrors(async run => {
    const components = {};
    run.components.forEach(component => {
        const component_name = `${component.toLowerCase()}_included`;
        components[component_name] = true;
    });
    return { ...run, ...components };
}, 'Error setting boolean values for components included');

// Beam1Present, Beam1Stable, Beam2Present, Beam2Stable are set for the whole run here:
// Along with a whole new attribute 'beams_present_and_stable' which will only be true if there is at least 1 LS with all other true
exports.getLumisectionAttributes = handleErrors(async run => {
    // Get lumisections:
    let {
        data: { data: lumisections }
    } = await axios.get(`${OMS_URL}/${OMS_LUMISECTIONS(run.run_number)}`);

    const ls_duration = lumisections.length;
    // Deconstruct attributes inside lumisections:
    lumisections = lumisections.map(({ attributes }) => {
        return attributes;
    });

    // Map through lumisections and return new attribute that composes the other 4 beam attributes:
    lumisections = set_conjuncted_beam_attribute(lumisections);

    // Reduce lumisection attributes so that it can be added to the run object:
    const ls_attributes = reduce_ls_attributes(lumisections);

    // Lumisection attributes contain fields which are named the same in run, it is vital run is put later so that they are overwritten:
    return { ...ls_attributes, ...run, ls_duration };
}, 'Error getting reduced lumisection attributes for the run');

const set_conjuncted_beam_attribute = lumisections => {
    return lumisections.map(lumisection => {
        const {
            beam1_present,
            beam1_stable,
            beam2_present,
            beam2_stable
        } = lumisection;
        // If one of them is null, set the conjunction null:
        if (
            beam1_present === null ||
            beam1_stable === null ||
            beam2_present === null ||
            beam2_stable === null
        ) {
            lumisection.beams_present_and_stable = null;
        } else {
            // Set the conjunction:
            lumisection.beams_present_and_stable =
                beam1_present && beam1_stable && beam2_present && beam2_stable;
        }
        return lumisection;
    });
};

// Reduces the array of lumisections to truthy if only one is true in whole array
const reduce_ls_attributes = lumisections => {
    const reduced_values = {};
    // If there is at least 1 LS that is true, then its true for the run:
    lumisections.forEach(lumisection => {
        Object.keys(lumisection).forEach((key, index) => {
            reduced_values[key] = reduced_values[key] || lumisection[key];
        });
    });
    // If any value is null, we want it to be false (unsure if null can be true later):
    Object.keys(reduced_values).forEach((key, index) => {
        reduced_values[key] =
            reduced_values[key] === null ? false : reduced_values[key];
    });
    return reduced_values;
};

// If run has a previous class, see if the newly found one has higher priority (lower index of priority means higher priority)
// If run has no previous class, assign class
exports.assign_run_class = handleErrors(async run => {
    const { data: classifiers_array } = await axios.get(
        `${API_URL}/classifiers/class`
    );
    classifiers_array.sort((a, b) => a.priority - b.priority);

    // Setup a hash by class name, to later access the priority of a previously assigned class:
    const class_classifiers_indexed_by_class = {};
    classifiers_array.forEach(classifier => {
        class_classifiers_indexed_by_class[classifier.class] = classifier;
    });

    classifiers_array.forEach(classifier => {
        const classifier_json = JSON.parse(classifier.classifier);
        const sss = json_logic.apply(classifier_json, run);
        if (json_logic.apply(classifier_json, run)) {
            const assigned_class = classifier.class;
            const previous_class = run.class;
            // A smaller integer in priority is equivalent to MORE priority:
            if (
                previous_class === '' ||
                classifier.priority <
                    class_classifiers_indexed_by_class[previous_class].priority
            ) {
                run.class = assigned_class;
            }
        }
    });
    return run;
}, 'Error assigning run class');

exports.is_run_significant = handleErrors(async run => {
    let run_is_significant = false;
    const { data: classifiers_array } = await axios.get(
        `${API_URL}/classifiers/dataset`
    );
    classifiers_array.forEach(classifier => {
        const classifier_class = classifier.class;
        classifier = JSON.parse(classifier.classifier);
        if (classifier_class === run.class) {
            const create_dataset = json_logic.apply(classifier, run);
            if (create_dataset === 'CREATE_DATASET') {
                run_is_significant = true;
            }
        }
    });
    return run_is_significant;
}, 'Error determining if run is significant');

exports.fill_component_status = (run, now) => {
    const triplet_names = {};
    online_components.forEach(component => {
        triplet_names[`${component}_status`] = '';
    });
    return { ...run, ...triplet_names };
};
exports.assign_component_status = handleErrors(async (run, now) => {
    // We fetch all classifiers and then filter them for each component
    const { data: classifiers_array } = await axios.get(
        `${API_URL}/classifiers/component`
    );

    online_components.forEach(component => {
        run_components[component] = {};
    });

    // For each component:
    online_components.forEach(component => {
        // Filter the ones of this component:
        const component_classifiers = classifiers_array.filter(
            classifier => classifier.component === component
        );

        // Setup a hash by status
        const component_classifiers_indexed_by_status = {};
        component_classifiers.forEach(classifier => {
            component_classifiers_indexed_by_status[
                classifier.status
            ] = classifier;
        });

        // We start with the worst possible priority status (NO VALUE FOUND) once it finds a higher priority status, then we change it
        if (run[`${component}_status`] === '') {
            run_components[component] = 'NO VALUE FOUND';
        }

        // And then for each classifier inside the component, we find its priority and check if its superior then the actual one
        component_classifiers.forEach(classifier => {
            const classifier_json = JSON.parse(classifier.classifier);

            // If it passes the classifier test for this run:
            if (json_logic.apply(classifier_json, run)) {
                const assigned_status = classifier.status;
                // We have to compare priorities to the previous one assigned
                const previous_status = run_components[component];
                // In priority the less, the more priority:
                // If the newly calculated status has higher priority than the previous one, then assigned it to the triplet (the classifier by default returns NO VALUE FOUND if it does not pass the test)
                if (
                    previous_status === 'NO VALUE FOUND' ||
                    component_classifiers_indexed_by_status[assigned_status]
                        .priority <
                        component_classifiers_indexed_by_status[previous_status]
                            .priority
                ) {
                    run_components[component] = assigned_status;
                }
            }
        });
    });
    return run_components;
}, 'Error assigning component status in dataset');
