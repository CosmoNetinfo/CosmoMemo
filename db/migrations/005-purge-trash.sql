CREATE OR REPLACE FUNCTION cm_purge_trash(selection jsonb, who jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $fn$
DECLARE current_doc jsonb; choice jsonb; page jsonb; item jsonb; ids text[] := ARRAY[]::text[];
 changes jsonb := '{"pages":[],"tasks":[]}'::jsonb; saved jsonb; expected integer;
BEGIN
 SELECT document INTO current_doc FROM cm_workspace WHERE id=1 FOR UPDATE;
 IF jsonb_typeof(selection)<>'array' OR jsonb_array_length(selection)<1 OR jsonb_array_length(selection)>200 THEN RAISE EXCEPTION 'CM_INVALID: select 1 to 200 pages'; END IF;
 FOR choice IN SELECT value FROM jsonb_array_elements(selection) LOOP
  IF choice->>'page_id' IS NULL OR choice->>'page_id'=ANY(ids) THEN RAISE EXCEPTION 'CM_INVALID: duplicate or missing page'; END IF;
  SELECT value INTO page FROM jsonb_array_elements(current_doc->'pages') WHERE value->>'id'=choice->>'page_id';
  IF page IS NULL OR NOT (page->>'deleted')::boolean THEN RAISE EXCEPTION 'CM_INVALID: page is not trashed'; END IF;
  expected := (choice->>'expected_page_revision')::integer;
  IF expected IS NULL OR coalesce((page->>'revision')::integer,1)<>expected THEN
   RAISE EXCEPTION USING MESSAGE='CM_CONFLICT',DETAIL=jsonb_build_object('entity_id',page->>'id','collection','pages','expected_revision',expected,'current_revision',coalesce((page->>'revision')::integer,1))::text;
  END IF;
  ids := array_append(ids,page->>'id');
  changes := jsonb_set(changes,'{pages}',(changes->'pages')||jsonb_build_array(jsonb_build_object('id',page->>'id','expected_revision',expected,'document',NULL)));
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(current_doc->'pages') WHERE value->>'parent'=ANY(ids) AND NOT value->>'id'=ANY(ids) LOOP
  changes := jsonb_set(changes,'{pages}',(changes->'pages')||jsonb_build_array(jsonb_build_object('id',item->>'id','expected_revision',coalesce((item->>'revision')::integer,1),'document',item||'{"parent":null}'::jsonb)));
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(current_doc->'tasks') WHERE value->>'project_id'=ANY(ids) LOOP
  changes := jsonb_set(changes,'{tasks}',(changes->'tasks')||jsonb_build_array(jsonb_build_object('id',item->>'id','expected_revision',coalesce((item->>'revision')::integer,1),'document',item||'{"project_id":null}'::jsonb)));
 END LOOP;
 saved := cm_apply_changes_audited(changes,NULL,who);
 -- Keep event IDs for existing checkpoints, but erase historical page content.
 -- A permanently removed page cannot be recovered through read_page_version.
 UPDATE cm_history SET before_document=NULL,after_document=NULL WHERE entity_type='page' AND entity_id=ANY(ids);
 RETURN saved;
END
$fn$;
