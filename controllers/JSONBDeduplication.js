const JSONBDeduplication = require('../models').JSONBDeduplication;

// It will try to find one JSONB already in the JSONBDeduplication table. If it finds it, it will return it, if it doesn't find it, it will create it.
exports.findOrCreateJSONB = async jsonb => {
    let saved_jsonb = await JSONBDeduplication.findOne({
        where: {
            jsonb
        }
    });
    if (saved_jsonb === null) {
        saved_jsonb = await JSONBDeduplication.create({
            jsonb
        });
    }
    return saved_jsonb.dataValues;
};
