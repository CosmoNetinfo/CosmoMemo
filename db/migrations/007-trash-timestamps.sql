CREATE OR REPLACE FUNCTION cm_apply_changes(changes jsonb, legacy_revision integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $cm$
DECLARE
  doc jsonb;
  aggregate_revision integer;
  collection text;
  change jsonb;
  current_entity jsonb;
  replacement jsonb;
  expected integer;
  actual integer;
  current_id text;
  parent_id text;
  ancestor jsonb;
  visited text[];
  any_change boolean := false;
  now_ms bigint := (extract(epoch FROM clock_timestamp()) * 1000)::bigint;
BEGIN
  SELECT document, revision INTO doc, aggregate_revision FROM cm_workspace WHERE id=1 FOR UPDATE;
  IF doc IS NULL THEN RAISE EXCEPTION 'CM_INVALID: workspace missing'; END IF;
  IF legacy_revision IS NOT NULL AND aggregate_revision <> legacy_revision THEN
    RAISE EXCEPTION USING MESSAGE='CM_CONFLICT', DETAIL=jsonb_build_object('entity_id','workspace','expected_revision',legacy_revision,'current_revision',aggregate_revision)::text;
  END IF;
  FOREACH collection IN ARRAY ARRAY['pages','tasks'] LOOP
    IF jsonb_typeof(coalesce(changes->collection,'[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'CM_INVALID: changes must be arrays'; END IF;
    FOR change IN SELECT value FROM jsonb_array_elements(coalesce(changes->collection,'[]'::jsonb)) LOOP
      current_id := change->>'id';
      expected := (change->>'expected_revision')::integer;
      IF current_id IS NULL OR expected IS NULL OR expected < 0 THEN RAISE EXCEPTION 'CM_INVALID: invalid entity'; END IF;
      SELECT value INTO current_entity FROM jsonb_array_elements(doc->collection) WHERE value->>'id'=current_id;
      actual := CASE WHEN current_entity IS NULL THEN 0 ELSE coalesce((current_entity->>'revision')::integer,1) END;
      IF actual <> expected THEN
        RAISE EXCEPTION USING MESSAGE='CM_CONFLICT', DETAIL=jsonb_build_object('entity_id',current_id,'collection',collection,'expected_revision',expected,'current_revision',actual)::text;
      END IF;
      replacement := change->'document';
      IF replacement IS NULL THEN RAISE EXCEPTION 'CM_INVALID: document missing'; END IF;
      IF replacement <> 'null'::jsonb THEN
        IF jsonb_typeof(replacement) <> 'object' OR replacement->>'id' IS DISTINCT FROM current_id THEN RAISE EXCEPTION 'CM_INVALID: invalid document'; END IF;
        replacement := replacement || jsonb_build_object('revision',actual+1);
        IF collection='pages' THEN
          replacement := replacement - 'trashed_at';
          IF (replacement->>'deleted')::boolean THEN
            replacement := replacement || jsonb_build_object('trashed_at',
              CASE WHEN coalesce((current_entity->>'deleted')::boolean,false)
                THEN coalesce((current_entity->>'trashed_at')::bigint,(current_entity->>'updated')::bigint,now_ms)
                ELSE now_ms END);
          END IF;
          replacement := replacement || jsonb_build_object('updated',now_ms);
        END IF;
      END IF;
      IF actual=0 AND replacement <> 'null'::jsonb THEN
        doc := jsonb_set(doc,ARRAY[collection],(doc->collection)||jsonb_build_array(replacement));
      ELSE
        doc := jsonb_set(doc,ARRAY[collection],coalesce((
          SELECT jsonb_agg(CASE WHEN item->>'id'=current_id THEN replacement ELSE item END ORDER BY ordinal)
          FROM jsonb_array_elements(doc->collection) WITH ORDINALITY AS items(item,ordinal)
          WHERE item->>'id'<>current_id OR replacement <> 'null'::jsonb
        ),'[]'::jsonb));
      END IF;
      any_change := true;
    END LOOP;
    doc := jsonb_set(doc,ARRAY[collection],coalesce((SELECT jsonb_agg(value||jsonb_build_object('revision',coalesce((value->>'revision')::integer,1))) FROM jsonb_array_elements(doc->collection)),'[]'::jsonb));
  END LOOP;
  IF octet_length(doc::text)>2100000 THEN RAISE EXCEPTION 'CM_INVALID: workspace too large'; END IF;
  FOR current_entity IN SELECT value FROM jsonb_array_elements(doc->'pages') LOOP
    current_id := current_entity->>'id';
    visited := ARRAY[current_id];
    parent_id := current_entity->>'parent';
    WHILE parent_id IS NOT NULL LOOP
      IF parent_id=ANY(visited) THEN RAISE EXCEPTION 'CM_INVALID: page hierarchy cycle'; END IF;
      visited := array_append(visited,parent_id);
      SELECT value INTO ancestor FROM jsonb_array_elements(doc->'pages') WHERE value->>'id'=parent_id;
      IF ancestor IS NULL THEN RAISE EXCEPTION 'CM_INVALID: parent missing'; END IF;
      IF NOT (current_entity->>'deleted')::boolean AND (ancestor->>'deleted')::boolean THEN RAISE EXCEPTION 'CM_INVALID: parent is trashed'; END IF;
      parent_id := ancestor->>'parent';
    END LOOP;
  END LOOP;
  IF any_change THEN
    aggregate_revision := aggregate_revision+1;
    UPDATE cm_workspace SET document=doc,revision=aggregate_revision,updated_at=now_ms WHERE id=1;
  END IF;
  RETURN jsonb_build_object('workspace',doc,'revision',aggregate_revision);
END;
$cm$;
