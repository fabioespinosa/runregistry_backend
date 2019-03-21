const JSONBDeduplication = require('../models').JSONBDeduplication;
const sequelize = require('../models').sequelize;

// It will try to find one JSONB already in the JSONBDeduplication table. If it finds it, it will return it, if it doesn't find it, it will create it.
exports.findOrCreateJSONB = async (jsonb, tries) => {
    if (!tries) {
        tries = 1;
    }
    if (tries > 1000) {
        throw 'Error saving jsonb';
    }
    let saved_jsonb = null;
    const result = await sequelize.query(
        `SELECT "id", "jsonb" FROM "JSONBDeduplication" AS "JSONBDeduplication" WHERE "JSONBDeduplication"."jsonb" = :jsonb;`,
        {
            type: sequelize.QueryTypes.SELECT,
            replacements: {
                jsonb: JSON.stringify(jsonb)
            }
        }
    );

    if (result.length !== 0) {
        saved_jsonb = result[0];
    }
    if (saved_jsonb === null) {
        try {
            saved_jsonb = await JSONBDeduplication.create({
                jsonb
            });
            saved_jsonb = saved_jsonb.dataValues;
        } catch (e) {
            console.log(
                `Race condition saving JSONBs, trying again for ${tries} time`
            );
            // This means the jsonb already existed (race with other one trying to save the same jsonb ), so we run the method again recursively:
            tries += 1;
            return exports.findOrCreateJSONB(jsonb, tries);
        }
    }
    return saved_jsonb;
};
