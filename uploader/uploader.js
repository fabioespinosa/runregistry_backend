const { save_runs } = require('../cron/2.save_or_update_runs');
const queue = require('async').queue;

const { lstatSync, readdirSync, readFileSync } = require('fs');
const { join } = require('path');

const isDirectory = source => lstatSync(source).isDirectory();

const getDirectories = source =>
    readdirSync(source)
        .map(name => join(source, name))
        .filter(isDirectory);

const classify_runs = () => {
    const runs_directories = getDirectories(`${__dirname}/runs`);
    const runs = [];
    runs_directories.forEach((run, index) => {
        const run_number = +run.split('/uploader/runs/')[1];
        // Only interested in those of 2018
        if (run_number >= 307926) {
            const run_info = JSON.parse(
                readFileSync(`${__dirname}/runs/${run_number}/run.json`)
            ).attributes;

            let lumisection_info = JSON.parse(
                readFileSync(
                    `${__dirname}/runs/${run_number}/lumisections.json`
                )
            );
            lumisection_info = lumisection_info.map(
                ({ attributes }) => attributes
            );
            run_info.lumisections = lumisection_info;
            runs.push(run_info);
        }
    });

    save_runs(runs);

    // const asyncQueue = queue(async);
};

classify_runs();
