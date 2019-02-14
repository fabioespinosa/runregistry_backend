BEGIN;
    DROP VIEW IF EXISTS "RunView";
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


CREATE OR REPLACE VIEW "RunView" as 
SELECT "RunEvent"."run_number", 
oms_attributes("RunEvent"."oms_metadata" 
ORDER BY "RunEvent"."version" ), 
rr_attributes("RunEvent"."rr_metadata" 
ORDER BY "RunEvent"."version")
FROM "RunEvent" INNER JOIN "Event" ON "Event"."version" = "RunEvent"."version"
GROUP BY "RunEvent"."run_number";

COMMIT;