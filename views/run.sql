DROP VIEW IF EXISTS "Run";
DROP AGGREGATE IF EXISTS mergeall
(jsonb);


CREATE OR REPLACE FUNCTION
merge(jsonb, jsonb) RETURNS jsonb
AS 'SELECT $1 || $2;'
LANGUAGE SQL                                   
    IMMUTABLE
    RETURNS NULL ON NULL INPUT;

CREATE AGGREGATE mergeall(jsonb)
(sfunc =
merge, stype = jsonb, initcond = '{}');

CREATE OR REPLACE VIEW "Run" as SELECT "RunEvent"."run_number", 
mergeall("RunEvent"."metadata" 
ORDER BY "RunEvent"."version" )
FROM "RunEvent" INNER JOIN "Event" ON "Event"."version" = "RunEvent"."version"
GROUP BY "RunEvent"."run_number";