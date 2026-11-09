DO $migration$
BEGIN
CREATE TABLE IF NOT EXISTS cm_history (
 id bigserial PRIMARY KEY,
 entity_type text NOT NULL CHECK(entity_type IN ('page','task','memory')),
 entity_id text NOT NULL,
 operation text NOT NULL,
 actor jsonb NOT NULL,
 before_document jsonb,
 after_document jsonb,
 changed_fields jsonb NOT NULL,
 occurred_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS cm_history_entity ON cm_history(entity_type,entity_id,id DESC);
CREATE TABLE IF NOT EXISTS cm_checkpoints (reader text PRIMARY KEY,cursor bigint NOT NULL DEFAULT 0);
REVOKE ALL ON cm_history,cm_checkpoints FROM PUBLIC;
REVOKE ALL ON SEQUENCE cm_history_id_seq FROM PUBLIC;

EXECUTE $ddl$
CREATE OR REPLACE FUNCTION cm_record_event(kind text, entity text, old_doc jsonb, new_doc jsonb) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $fn$
DECLARE fields jsonb; action text; who jsonb;
BEGIN
 IF (old_doc - 'revision' - 'updated' - 'updated_at') IS NOT DISTINCT FROM (new_doc - 'revision' - 'updated' - 'updated_at') THEN RETURN; END IF;
 PERFORM pg_advisory_xact_lock(882134);
 who := coalesce(nullif(current_setting('cosmomemo.actor',true),'')::jsonb,'{"kind":"unknown","id":"legacy","name":"Client precedente"}'::jsonb);
 SELECT coalesce(jsonb_agg(field ORDER BY field),'[]'::jsonb) INTO fields FROM (
  SELECT key AS field FROM jsonb_object_keys(coalesce(old_doc,'{}'::jsonb)||coalesce(new_doc,'{}'::jsonb)) AS keys(key)
  WHERE key NOT IN ('revision','updated','updated_at') AND old_doc->key IS DISTINCT FROM new_doc->key
 ) changed;
 action := CASE WHEN old_doc IS NULL THEN 'create' WHEN new_doc IS NULL THEN 'delete'
  WHEN kind='page' AND coalesce((old_doc->>'deleted')::boolean,false)=false AND (new_doc->>'deleted')::boolean THEN 'trash'
  WHEN kind='page' AND (old_doc->>'deleted')::boolean AND NOT (new_doc->>'deleted')::boolean THEN 'restore' ELSE 'update' END;
 INSERT INTO cm_history(entity_type,entity_id,operation,actor,before_document,after_document,changed_fields,occurred_at)
 VALUES(kind,entity,action,who,old_doc,new_doc,fields,(extract(epoch FROM clock_timestamp())*1000)::bigint);
END $fn$
$ddl$;

EXECUTE $ddl$
CREATE OR REPLACE FUNCTION cm_audit_workspace() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $fn$
DECLARE collection text; previous jsonb; incoming jsonb; entity text;
BEGIN
 FOREACH collection IN ARRAY ARRAY['pages','tasks'] LOOP
  FOR entity IN SELECT value->>'id' FROM jsonb_array_elements(OLD.document->collection)
    UNION SELECT value->>'id' FROM jsonb_array_elements(NEW.document->collection) LOOP
   SELECT value INTO previous FROM jsonb_array_elements(OLD.document->collection) WHERE value->>'id'=entity;
   SELECT value INTO incoming FROM jsonb_array_elements(NEW.document->collection) WHERE value->>'id'=entity;
   PERFORM cm_record_event(CASE WHEN collection='pages' THEN 'page' ELSE 'task' END,entity,previous,incoming);
  END LOOP;
 END LOOP;
 RETURN NEW;
END $fn$
$ddl$;
DROP TRIGGER IF EXISTS cm_workspace_history ON cm_workspace;
CREATE TRIGGER cm_workspace_history AFTER UPDATE ON cm_workspace FOR EACH ROW EXECUTE FUNCTION cm_audit_workspace();

EXECUTE $ddl$
CREATE OR REPLACE FUNCTION cm_audit_memory() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $fn$
BEGIN
 PERFORM cm_record_event('memory',coalesce(NEW.key,OLD.key),CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) ELSE NULL END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) ELSE NULL END);
 RETURN coalesce(NEW,OLD);
END $fn$
$ddl$;
DROP TRIGGER IF EXISTS cm_memory_history ON cm_memories;
CREATE TRIGGER cm_memory_history AFTER INSERT OR UPDATE OR DELETE ON cm_memories FOR EACH ROW EXECUTE FUNCTION cm_audit_memory();

EXECUTE $ddl$
CREATE OR REPLACE FUNCTION cm_apply_changes_audited(changes jsonb, legacy_revision integer, who jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $fn$
DECLARE saved jsonb; task jsonb; project jsonb;
BEGIN
 PERFORM set_config('cosmomemo.actor',who::text,true);
 saved := cm_apply_changes(changes,legacy_revision);
 FOR task IN SELECT value->'document' FROM jsonb_array_elements(coalesce(changes->'tasks','[]'::jsonb)) WHERE value->'document'->>'project_id' IS NOT NULL LOOP
  SELECT value INTO project FROM jsonb_array_elements(saved->'workspace'->'pages') WHERE value->>'id'=task->>'project_id';
  IF (project->>'deleted')::boolean THEN RAISE EXCEPTION 'CM_INVALID: project is trashed'; END IF;
 END LOOP;
 FOR task IN SELECT value FROM jsonb_array_elements(saved->'workspace'->'tasks') WHERE value->>'project_id' IS NOT NULL LOOP
  SELECT value INTO project FROM jsonb_array_elements(saved->'workspace'->'pages') WHERE value->>'id'=task->>'project_id';
  IF project IS NULL OR project->>'kind' IS DISTINCT FROM 'project' THEN RAISE EXCEPTION 'CM_INVALID: project missing'; END IF;
 END LOOP;
 RETURN saved;
END $fn$
$ddl$;

EXECUTE $ddl$
CREATE OR REPLACE FUNCTION cm_write_memory(k text, body text, labels jsonb, expected integer, remove boolean, who jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $fn$
DECLARE stored cm_memories; stamp bigint := (extract(epoch FROM clock_timestamp())*1000)::bigint;
BEGIN
 PERFORM set_config('cosmomemo.actor',who::text,true);
 IF remove THEN
  DELETE FROM cm_memories WHERE key=k AND revision=expected RETURNING * INTO stored;
 ELSIF expected=0 THEN
  INSERT INTO cm_memories(key,content,tags,updated_at) VALUES(k,body,labels,stamp) ON CONFLICT DO NOTHING RETURNING * INTO stored;
 ELSE
  UPDATE cm_memories SET content=body,tags=labels,updated_at=stamp,revision=revision+1 WHERE key=k AND revision=expected RETURNING * INTO stored;
 END IF;
 IF stored.key IS NULL THEN RAISE EXCEPTION 'CM_CONFLICT'; END IF;
 RETURN to_jsonb(stored);
END $fn$
$ddl$;
REVOKE ALL ON FUNCTION cm_record_event(text,text,jsonb,jsonb),cm_audit_workspace(),cm_audit_memory(),cm_apply_changes_audited(jsonb,integer,jsonb),cm_write_memory(text,text,jsonb,integer,boolean,jsonb) FROM PUBLIC;
END
$migration$;
