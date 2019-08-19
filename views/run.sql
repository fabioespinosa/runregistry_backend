CREATE EXTENSION
IF NOT EXISTS pgcrypto;
BEGIN;
    DROP VIEW IF EXISTS "RunView";
    DROP VIEW IF EXISTS "AggregatedLumisection";
    DROP AGGREGATE IF EXISTS oms_attributes
    (jsonb);
DROP AGGREGATE IF EXISTS rr_attributes
(jsonb);
DROP AGGREGATE IF EXISTS mergejsonb
(jsonb);



CREATE OR REPLACE FUNCTION
    mergejsonb
(jsonb, jsonb) RETURNS jsonb
AS 'SELECT $1 || $2;'
LANGUAGE SQL                                   
    IMMUTABLE
    RETURNS NULL ON NULL INPUT;

CREATE AGGREGATE mergejsonb(jsonb)
(sfunc =
mergejsonb, stype = jsonb, initcond = '{}');


CREATE AGGREGATE oms_attributes(jsonb)
(sfunc =
mergejsonb, stype = jsonb, initcond = '{}');

CREATE AGGREGATE rr_attributes(jsonb)
(sfunc =
mergejsonb, stype = jsonb, initcond = '{}');


CREATE OR REPLACE VIEW "RunView" as
SELECT "RunEvent"."run_number",
    oms_attributes("RunEvent"."oms_metadata"
ORDER BY "RunEvent"."version"
), 
rr_attributes
("RunEvent"."rr_metadata" 
ORDER BY "RunEvent"."version")
FROM "RunEvent" INNER JOIN "Event" ON "Event"."version" = "RunEvent"."version"
GROUP BY "RunEvent"."run_number";


CREATE OR REPLACE VIEW "LumisectionEventJSONB" as
select *
from
    (SELECT *
    from "LumisectionEventAssignation"
        inner join (
SELECT "Event"."comment", "Event"."by" , "LumisectionEvent"."version" as "version2", "run_number", "name", "jsonb"
        from "LumisectionEvent" inner join "JSONBDeduplication" ON "LumisectionEvent"."lumisection_metadata_id" = "JSONBDeduplication"."id" inner join "Event" on "LumisectionEvent"."version" = "Event"."version"
        ORDER BY "LumisectionEvent"."version" DESC) as "Merged" on "LumisectionEventAssignation"."version" = "Merged"."version2") as "rr"


    inner join

    (SELECT "run_number" as "oms_run_number", "name" as "oms_name", "lumisection_number" as "oms_lumisection_number", "jsonb" as "oms_jsonb"
    from "OMSLumisectionEventAssignation"
        inner join(
SELECT "Event"."comment", "Event"."by" , "OMSLumisectionEvent"."version" as "version3", "run_number", "name", "jsonb"
        from "OMSLumisectionEvent" inner join "JSONBDeduplication" ON "OMSLumisectionEvent"."lumisection_metadata_id" = "JSONBDeduplication"."id" inner join "Event" on "OMSLumisectionEvent"."version" = "Event"."version"
        ORDER BY "OMSLumisectionEvent"."version" DESC) as "OMSMerged" on "OMSLumisectionEventAssignation"."version" = "OMSMerged"."version3") as "oms"


    on "oms"."oms_run_number" = "rr"."run_number" and "oms"."oms_name" = "rr"."name" and "rr"."lumisection_number" = "oms"."oms_lumisection_number";


CREATE OR REPLACE VIEW "AggregatedLumisection" as
select "run_number", "name", "lumisection_number", "rr_lumisection", "oms_lumisection", "run_rr_attributes", "run_oms_attributes"
from
    (SELECT "run_number", "name", "lumisection_number", mergejsonb("jsonb") as "rr_lumisection"
    from "LumisectionEventAssignation"
        inner join (
SELECT "LumisectionEvent"."version" as "version2", "run_number", "name", "jsonb"
        from "LumisectionEvent" inner join "JSONBDeduplication" ON "LumisectionEvent"."lumisection_metadata_id" = "JSONBDeduplication"."id" inner join "Event" on "LumisectionEvent"."version" = "Event"."version"
        ORDER BY "LumisectionEvent"."version" DESC) as "Merged" on "LumisectionEventAssignation"."version" = "Merged"."version2"
    group by "run_number", "name", "lumisection_number"
        
        ) as "rr"


    inner join

    (SELECT "run_number" as "oms_run_number", "name" as "oms_name", "lumisection_number" as "oms_lumisection_number", mergejsonb("jsonb") as "oms_lumisection"
    from "OMSLumisectionEventAssignation"
        inner join(
SELECT "OMSLumisectionEvent"."version" as "version3", "run_number", "name", "jsonb"
        from "OMSLumisectionEvent" inner join "JSONBDeduplication" ON "OMSLumisectionEvent"."lumisection_metadata_id" = "JSONBDeduplication"."id" inner join "Event" on "OMSLumisectionEvent"."version" = "Event"."version"
        ORDER BY "OMSLumisectionEvent"."version" DESC) as "OMSMerged" on "OMSLumisectionEventAssignation"."version" = "OMSMerged"."version3"
    group by "run_number", "oms_name", "oms_lumisection_number"
        ) as "oms"
    on "oms"."oms_run_number" = "rr"."run_number" and "oms"."oms_name" = "rr"."name" and "rr"."lumisection_number" = "oms"."oms_lumisection_number"

    inner join

    (SELECT "run_number" as "run_run_number", "rr_attributes" as "run_rr_attributes", "oms_attributes" as "run_oms_attributes"
    from "Run") as "run"

    on "rr"."run_number" = "run"."run_run_number";


COMMIT;