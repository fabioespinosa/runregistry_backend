const JSONBDeduplication = require('../models').JSONBDeduplication;

// It will try to find one JSONB already in the JSONBDeduplication table. If it finds it, it will return it, if it doesn't find it, it will create it.
exports.findOrCreateJSONB = async (jsonb, transaction, tries) => {
    if (tries > 1000) {
        throw 'Error saving jsonb';
    }
    if (!tries) {
        tries = 0;
    }
    let saved_jsonb = await JSONBDeduplication.findOne({
        where: {
            jsonb
        }
    });
    if (saved_jsonb === null) {
        try {
            saved_jsonb = await JSONBDeduplication.create({
                jsonb
            });
        } catch (e) {
            // This means the jsonb already existed (race with other one trying to save the same jsonb ), so we run the method again recursively:
            tries += 1;
            return exports.findOrCreateJSONB(jsonb, tries);
        }
    }
    return saved_jsonb.dataValues;
};
