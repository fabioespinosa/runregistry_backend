DROP VIEW IF EXISTS "Run";
DROP AGGREGATE IF EXISTS oms_attributes
(jsonb);
DROP AGGREGATE IF EXISTS rr_attributes
(jsonb);


CREATE OR REPLACE FUNCTION
merge(jsonb, jsonb) RETURNS jsonb
AS 'SELECT $1 || $2;'
LANGUAGE SQL                                   
    IMMUTABLE
    RETURNS NULL ON NULL INPUT;

CREATE AGGREGATE oms_attributes(jsonb)
(sfunc =
merge, stype = jsonb, initcond = '{}');

CREATE AGGREGATE rr_attributes(jsonb)
(sfunc =
merge, stype = jsonb, initcond = '{}');

CREATE OR REPLACE VIEW "Run" as 
SELECT "RunEvent"."run_number", 
oms_attributes("RunEvent"."oms_metadata" 
ORDER BY "RunEvent"."version" ), 
rr_attributes("RunEvent"."rr_metadata" 
ORDER BY "RunEvent"."version")
FROM "RunEvent" INNER JOIN "Event" ON "Event"."version" = "RunEvent"."version"
GROUP BY "RunEvent"."run_number";


-- INSERT INTO "ClassClassifierList"  DEFAULT VALUES;
-- INSERT INTO "ComponentClassifierList" DEFAULT VALUES; 
-- INSERT INTO "DatasetClassifierList" DEFAULT VALUES; 
-- INSERT INTO "OfflineDatasetClassifierList" DEFAULT VALUES; -- 

-- INSERT INTO "Settings" ("metadata", "createdAt", "CCL_id", "CPCL_id", "DCL_id", "ODCL_id")
-- SELECT ('{}', '2019-02-01 05:30:13.831-05', (SELECT MAX ("id") FROM "ClassClassifierList"), (SELECT MAX ("id") FROM "ComponentClassifierList"), (SELECT MAX ("id") FROM "DatasetClassifierList"), (SELECT MAX ("id") FROM "OfflineDatasetClassifierList"))
-- WHERE NOT EXISTS (SELECT *
-- FROM "Settings")-- 

