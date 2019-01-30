CREATE TABLE
IF NOT EXISTS "ClassClassifier"
("id"  SERIAL , "class" VARCHAR
(255) NOT NULL, "classifier" JSONB NOT NULL, "priority" INTEGERNOT NULL, "enabled" BOOLEAN NOT NULL, "createdAt" TIMESTAMP
WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP
WITH TIME ZONE NOT NULL, PRIMARY KEY
("id"));
SELECT i.relname AS name, ix.indisprimary
AS primary, ix.indisunique AS unique, ix.indkey AS indkey, array_agg
(a.attnum) as column_indexes,array_agg
(a.attname) AS column_names, pg_get_indexdef
(ix.indexrelid) AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND t.relkind = 'r' and t.relname = 'ClassClassifier' GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;
CREATE TABLE
IF NOT EXISTS "ComponentClassifier"
("id"  SERIAL , "status" VARCHAR
(255) NOT NULL, "component" VARCHAR
(255) NOT NULL, "classifier" JSONB NOT NULL, "priority" INTEGER NOT NULL, "enabled" BOOLEAN NOT NULL, "createdAt" TIMESTAMP
WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP
WITH TIME ZONE NOT NULL, PRIMARY KEY
("id"));
SELECT i.relname AS name, ix.indisprimary
AS primary, ix.indisunique AS unique, ix.indkey AS indkey, array_agg
(a.attnum) as column_indexes,array_agg
(a.attname) AS column_names, pg_get_indexdef
(ix.indexrelid) AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND t.relkind = 'r' and t.relname = 'ComponentClassifier' GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;
CREATE TABLE
IF NOT EXISTS "Cycle"
("id"  SERIAL , "deadline" TIMESTAMP
WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP
WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP
WITH TIME ZONE NOT NULL, PRIMARY KEY
("id"));
SELECT i.relname AS name, ix.indisprimary
AS primary, ix.indisunique AS unique, ix.indkey AS indkey, array_agg
(a.attnum) as column_indexes,array_agg
(a.attname) AS column_names, pg_get_indexdef
(ix.indexrelid) AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND t.relkind = 'r' and t.relname = 'Cycle' GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;
CREATE TABLE
IF NOT EXISTS "Run"
("id"  SERIAL , "class" JSONB NOT NULL, "components" JSONB NOT NULL, "state" JSONB NOT NULL, "stop_reason"JSONB NOT NULL, "l1_key" VARCHAR
(255), "ls_duration" INTEGER, "b_field" FLOAT, "tier0_transfer" BOOLEAN, "l1_triggers_counter" BIGINT, "hlt_physics_throughput" VARCHAR
(255), "init_lumi" FLOAT, "delivered_lumi" FLOAT, "recorded_lumi" FLOAT, "cmssw_version" VARCHAR
(255), "energy" INTEGER, "end_lumi" FLOAT, "hlt_physics_rate" BIGINT, "fill_number" INTEGER, "l1_hlt_mode" VARCHAR
(255), "end_time" TIMESTAMP
WITH TIME ZONE, "trigger_mode" VARCHAR
(255), "fill_type_party2" VARCHAR
(255),"fill_type_party1" VARCHAR
(255), "initial_prescale_index" INTEGER, "sequence" VARCHAR
(255), "start_time" TIMESTAMP
WITH TIME ZONE, "hlt_physics_size" FLOAT, "fill_type_runtime" VARCHAR
(255), "hlt_key" JSONB, "clock_type" VARCHAR
(255), "l1_rate" FLOAT, "l1_menu" VARCHAR
(255), "run_number" BIGINT, "stable_beam" BOOLEAN, "hlt_physics_counter" JSONB, "significant" JSONB NOT NULL, "cms_triplet" JSONB NOT NULL, "castor_triplet" JSONB NOT NULL, "csc_triplet" JSONB NOT NULL, "dt_triplet" JSONB NOT NULL, "ecal_triplet" JSONB NOT NULL, "es_triplet" JSONB NOT NULL, "hcal_triplet" JSONB NOT NULL, "hlt_triplet" JSONB NOT NULL, "l1t_triplet" JSONB NOT NULL, "l1tcalo_triplet" JSONB NOT NULL, "l1tmu_triplet" JSONB NOT NULL, "lumi_triplet" JSONB NOT NULL, "pix_triplet" JSONB NOT NULL, "rpc_triplet" JSONB NOT NULL, "strip_triplet" JSONB NOT NULL, "ctpps_triplet" JSONB NOT NULL, "createdAt" TIMESTAMP
WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP
WITH TIME ZONE NOT NULL, PRIMARY KEY
("id"));
SELECT i.relname AS name, ix.indisprimary
AS primary, ix.indisunique AS unique, ix.indkey AS indkey, array_agg
(a.attnum) as column_indexes,array_agg
(a.attname) AS column_names, pg_get_indexdef
(ix.indexrelid) AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND t.relkind = 'r' and t.relname = 'Run' GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;
CREATE TABLE
IF NOT EXISTS "Dataset"
("id" VARCHAR
(255)  REFERENCES "Cycle"
("id") ON
DELETE CASCADE ON
UPDATE CASCADE, "name" VARCHAR(255)NOT NULL, "appeared_in" JSONB NOT NULL, "global_state" JSONB NOT NULL, "global_lumisections" JSONB NOT NULL, "btag_state" JSONB NOT NULL, "btag_lumisections" JSONB NOT NULL DEFAULT '{}', "btag-btag" JSONB NOT NULL, "castor_state" JSONB NOT NULL, "castor_lumisections" JSONB NOT NULL DEFAULT '{}', "castor-castor" JSONB NOT NULL, "csc_state" JSONB NOT NULL, "csc_lumisections" JSONB NOT NULL DEFAULT '{}', "csc-csc" JSONB NOT NULL, "csc-occupancy" JSONB NOT NULL, "csc-integrity" JSONB NOT NULL, "csc-strips" JSONB NOT NULL, "csc-timing" JSONB NOT NULL, "csc-efficiency" JSONB NOT NULL, "csc-gasgains" JSONB NOT NULL, "csc-pedestals" JSONB NOT NULL, "csc-resolution" JSONB NOT NULL, "csc-segments" JSONB NOT NULL, "csc-tf" JSONB NOT NULL, "csc-triggergpe" JSONB NOT NULL, "ctpps_state" JSONB NOT NULL, "ctpps_lumisections" JSONB NOT NULL DEFAULT '{}', "ctpps-ctpps" JSONB NOT NULL, "ctpps-rp45_210" JSONB NOT NULL, "ctpps-rp45_220" JSONB NOT NULL, "ctpps-rp45_cyl" JSONB NOT NULL, "ctpps-rp56_210" JSONB NOT NULL, "ctpps-rp56_220" JSONB NOT NULL, "ctpps-rp56_cyl" JSONB NOT NULL, "ctpps-trk45_210" JSONB NOT NULL, "ctpps-time45" JSONB NOT NULL, "ctpps-trk56_220" JSONB NOT NULL, "ctpps-time56" JSONB NOT NULL, "ctpps-time_global" JSONB NOT NULL, "dt_state" JSONB NOT NULL, "dt_lumisections" JSONB NOT NULL DEFAULT '{}', "dt-dt" JSONB NOT NULL, "ecal_state" JSONB NOT NULL, "ecal_lumisections" JSONB NOT NULL DEFAULT '{}', "ecal-ecal" JSONB NOT NULL,"ecal-ebp" JSONB NOT NULL, "ecal-ebm" JSONB NOT NULL, "ecal-eep" JSONB NOT NULL, "ecal-eem" JSONB NOT NULL, "ecal-es" JSONB NOT NULL, "ecal-esp" JSONB NOT NULL,"ecal-esm" JSONB NOT NULL, "ecal-analysis" JSONB NOT NULL, "ecal-collisions" JSONB NOT NULL, "ecal-laser" JSONB NOT NULL, "ecal-tpg" JSONB NOT NULL, "ecal-noise" JSONB NOT NULL, "ecal-preshower" JSONB NOT NULL, "ecal-timing" JSONB NOT NULL, "egamma_state" JSONB NOT NULL, "egamma_lumisections" JSONB NOT NULL DEFAULT '{}', "egamma-egamma" JSONB NOT NULL, "hcal_state" JSONB NOT NULL, "hcal_lumisections" JSONB NOT NULL DEFAULT '{}', "hcal-hb" JSONB NOT NULL, "hcal-he" JSONB NOT NULL, "hcal-hf" JSONB NOT NULL, "hcal-ho0" JSONB NOT NULL, "hcal-ho12" JSONB NOT NULL, "hlt_state" JSONB NOT NULL, "hlt_lumisections" JSONB NOT NULL DEFAULT '{}', "hlt-muons" JSONB NOT NULL, "hlt-electrons" JSONB NOT NULL, "hlt-photons" JSONB NOT NULL, "hlt-jetmet" JSONB NOT NULL, "hlt-tau" JSONB NOT NULL, "hlt-bjets" JSONBNOT NULL, "hlt-technical" JSONB NOT NULL, "jetmet_state" JSONB NOT NULL, "jetmet_lumisections" JSONB NOT NULL DEFAULT '{}', "jetmet-jetmet" JSONB NOT NULL, "l1t_state" JSONB NOT NULL, "l1t_lumisections" JSONB NOT NULL DEFAULT '{}', "l1t-l1tmu" JSONB NOT NULL, "l1t-l1tcalo" JSONB NOT NULL, "l1t-software" JSONB NOT NULL, "lumi_state" JSONB NOT NULL, "lumi_lumisections" JSONB NOT NULL DEFAULT '{}', "lumi-lumi" JSONB NOT NULL, "muon_state" JSONB NOT NULL, "muon_lumisections" JSONB NOT NULL DEFAULT '{}', "muon-muon" JSONB NOT NULL, "rpc_state" JSONB NOT NULL, "rpc_lumisections" JSONB NOT NULL DEFAULT '{}', "rpc-rpc" JSONB NOT NULL, "rpc-hv"JSONB NOT NULL, "rpc-lv" JSONB NOT NULL, "rpc-feb" JSONB NOT NULL, "rpc-noise" JSONB NOT NULL, "rpc-elog" JSONB NOT NULL, "tau_state" JSONB NOT NULL, "tau_lumisections" JSONB NOT NULL DEFAULT '{}', "tau-tau" JSONB NOT NULL, "tracker_state" JSONB NOT NULL, "tracker_lumisections" JSONB NOT NULL DEFAULT '{}', "tracker-track" JSONB NOT NULL, "tracker-pix" JSONB NOT NULL, "tracker-strip" JSONB NOT NULL, "btag" JSONB NOT NULL, "castor" JSONB NOT NULL, "cms" JSONB NOT NULL, "csc" JSONB NOT NULL, "ctpps" JSONB NOT NULL, "dt" JSONB NOT NULL, "ecal" JSONB NOT NULL, "egamma" JSONB NOT NULL, "es" JSONB NOT NULL, "hcal" JSONB NOT NULL, "hlt" JSONB NOT NULL, "jetmet" JSONB NOT NULL, "l1t" JSONB NOT NULL, "l1tcalo" JSONB
NOT NULL, "l1tmu" JSONB NOT NULL, "lowLumi" JSONB NOT NULL, "lumi" JSONB NOT NULL, "muon" JSONB NOT NULL, "pix" JSONB NOT NULL, "rpc" JSONB NOT NULL, "strip" JSONB NOT NULL, "tau" JSONB NOT NULL, "track" JSONB NOT NULL, "createdAt" TIMESTAMP
WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP
WITH TIME ZONE NOT NULL, "run_number" INTEGER NOT NULL REFERENCES "Run"
("id") ON
DELETE NO ACTION ON
UPDATE CASCADE, PRIMARY KEY ("id"));
SELECT i.relname AS name, ix.indisprimary
AS primary, ix.indisunique AS unique, ix.indkey AS indkey, array_agg
(a.attnum) as column_indexes,array_agg
(a.attname) AS column_names, pg_get_indexdef
(ix.indexrelid) AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND t.relkind = 'r' and t.relname = 'Dataset' GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;
CREATE TABLE
IF NOT EXISTS "DatasetClassifier"
("id"  SERIAL , "class" VARCHAR
(255) NOT NULL, "classifier" JSONB NOT NULL, "enabled" BOOLEAN NOT NULL, "createdAt" TIMESTAMP
WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP
WITH TIME ZONE NOT NULL, PRIMARY KEY
("id"));
SELECT i.relname AS name, ix.indisprimary
AS primary, ix.indisunique AS unique, ix.indkey AS indkey, array_agg
(a.attnum) as column_indexes,array_agg
(a.attname) AS column_names, pg_get_indexdef
(ix.indexrelid) AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND t.relkind = 'r' and t.relname = 'DatasetClassifier' GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;
CREATE TABLE
IF NOT EXISTS "DatasetsAccepted"
("id"  SERIAL , "name" VARCHAR
(255) NOT NULL, "regexp" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL, "class" VARCHAR
(255) NOT NULL, "run_from" INTEGER, "run_to" INTEGER NOT NULL, "last_changed_by" VARCHAR
(255) NOT NULL, "createdAt" TIMESTAMP
WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP
WITH TIME ZONE NOT NULL, PRIMARY KEY
("id"));
SELECT i.relname AS name, ix.indisprimary
AS primary, ix.indisunique AS unique, ix.indkey AS indkey, array_agg
(a.attnum) as column_indexes,array_agg
(a.attname) AS column_names, pg_get_indexdef
(ix.indexrelid) AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND t.relkind = 'r' and t.relname = 'DatasetsAccepted' GROUP BY i.relname, ix.indexrelid, ix.indisprimary,ix.indisunique, ix.indkey ORDER BY i.relname;
CREATE TABLE
IF NOT EXISTS "OfflineDatasetClassifier"
("id"  SERIAL , "classifier" JSONB NOT NULL, "workspace" VARCHAR
(255) NOT NULL, "enabled" BOOLEAN NOT NULL, "createdAt" TIMESTAMP
WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP
WITH TIME ZONE NOT NULL, PRIMARY KEY
("id"));
SELECT i.relname AS name, ix.indisprimary
AS primary, ix.indisunique AS unique, ix.indkey AS indkey, array_agg
(a.attnum) as column_indexes,array_agg
(a.attname) AS column_names, pg_get_indexdef
(ix.indexrelid) AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND t.relkind = 'r' and t.relname = 'OfflineDatasetClassifier' GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;
CREATE TABLE
IF NOT EXISTS "Permission"
("id"  SERIAL , "egroup" VARCHAR
(255) NOT NULL, "routes" JSONB NOT NULL, "createdAt" TIMESTAMP WITHTIME ZONE NOT NULL, "updatedAt" TIMESTAMP
WITH TIME ZONE NOT NULL, PRIMARY KEY
("id"));
SELECT i.relname AS name, ix.indisprimary
AS primary, ix.indisunique AS unique, ix.indkey AS indkey, array_agg
(a.attnum) as column_indexes,array_agg
(a.attname) AS column_names, pg_get_indexdef
(ix.indexrelid) AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND t.relkind = 'r' and t.relname = 'Permission' GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;
CREATE TABLE
IF NOT EXISTS "User"
("id"  SERIAL , "username" VARCHAR
(255) UNIQUE, "fullname" VARCHAR
(255) NOT NULL, "email" VARCHAR
(255) UNIQUE, "role" VARCHAR
(255) NOT NULL, "e_groups" JSONB, "workspaces" JSONB, "createdAt" TIMESTAMP
WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP
WITH TIME ZONE NOTNULL, PRIMARY KEY
("id"));
SELECT i.relname AS name, ix.indisprimary
AS primary, ix.indisunique AS unique, ix.indkey AS indkey, array_agg
(a.attnum) as column_indexes,array_agg
(a.attname) AS column_names, pg_get_indexdef
(ix.indexrelid) AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND t.relkind = 'r' and t.relname = 'User' GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;
CREATE TABLE
IF NOT EXISTS "Workspace"
("id"  SERIAL , "pog" VARCHAR
(255) NOT NULL, "columns" JSONB NOT NULL, "createdAt" TIMESTAMP
WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP
WITH TIME ZONE NOT NULL, PRIMARY KEY
("id"));
SELECT i.relname AS name, ix.indisprimary
AS primary, ix.indisunique AS unique, ix.indkey AS indkey, array_agg
(a.attnum) as column_indexes,array_agg
(a.attname) AS column_names, pg_get_indexdef
(ix.indexrelid) AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND t.relkind = 'r' and t.relname = 'Workspace' GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;