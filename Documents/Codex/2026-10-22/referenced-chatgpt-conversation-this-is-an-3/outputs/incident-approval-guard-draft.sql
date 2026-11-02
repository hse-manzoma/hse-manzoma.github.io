-- Draft only. Review against the live schema and existing triggers/policies before applying.
-- Enforces the F-HSE-03-01 approval boundary on public.docs.data.
-- This does not change or run against Supabase.

create or replace function public.guard_fhse0301_incident_approval()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_uid text := auth.uid()::text;
  v_approver constant text := 'af6d18cb-f29a-4a7e-8c38-c23cc29d4230';
  v_f jsonb;
  v_old_f jsonb;
  v_signs jsonb;
  v_old_signs jsonb;
begin
  if tg_op = 'UPDATE'
     and old.col = 'records'
     and old.data->>'form' = 'F-HSE-03-01'
     and (new.col <> 'records' or new.data->>'form' <> 'F-HSE-03-01') then
    raise insufficient_privilege using message = 'incident_identity_cannot_be_changed';
  end if;

  if coalesce(new.col, '') <> 'records'
     or coalesce(new.data->>'form', '') <> 'F-HSE-03-01' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- New reports are content records, never pre-approved by client-supplied JSON.
    if v_uid is distinct from v_approver then
      new.data := new.data - 'approved';
      new.data := jsonb_set(
        new.data,
        '{f}',
        coalesce(new.data->'f', '{}'::jsonb) - 'mgr' - 'mgrSig',
        true
      );
    end if;
    -- A creator may add their own signature only; never seed another user's entry.
    new.data := jsonb_set(
      new.data,
      '{signs}',
      case when v_uid is not null
                 and coalesce(new.data->'signs', '{}'::jsonb) ? v_uid
        then jsonb_build_object(v_uid, new.data->'signs'->v_uid)
        else '{}'::jsonb end,
      true
    );
    if v_uid = v_approver
       and new.data->'approved' is not null
       and new.data->'approved' <> 'null'::jsonb
       and new.data->'approved'->>'by' is distinct from v_uid then
      raise insufficient_privilege using message = 'incident_approval_actor_mismatch';
    end if;
    return new;
  end if;

  -- Only Islam Bakr Abbas's authenticated UID may change approval or its manager field.
  if v_uid is distinct from v_approver then
    -- Restore protected values from the stored row, so edits to report content
    -- still succeed even when the client sends the full JSON document.
    new.data := new.data - 'approved';
    if old.data ? 'approved' then
      new.data := new.data || jsonb_build_object('approved', old.data->'approved');
    end if;
    v_f := coalesce(new.data->'f', '{}'::jsonb) - 'mgr' - 'mgrSig';
    v_old_f := coalesce(old.data->'f', '{}'::jsonb);
    if v_old_f ? 'mgr' then v_f := v_f || jsonb_build_object('mgr', v_old_f->'mgr'); end if;
    if v_old_f ? 'mgrSig' then v_f := v_f || jsonb_build_object('mgrSig', v_old_f->'mgrSig'); end if;
    new.data := jsonb_set(new.data, '{f}', v_f, true);
  elsif new.data->'approved' is distinct from old.data->'approved'
        and new.data->'approved' is not null
        and new.data->'approved' <> 'null'::jsonb
        and new.data->'approved'->>'by' is distinct from v_uid then
    raise insufficient_privilege using message = 'incident_approval_actor_mismatch';
  end if;

  -- Preserve every other person's signature entry while allowing the caller
  -- to change only the entry keyed by their own authenticated UID.
  v_signs := coalesce(new.data->'signs', '{}'::jsonb);
  v_old_signs := coalesce(old.data->'signs', '{}'::jsonb);
  v_signs := (v_old_signs - coalesce(v_uid, '')) ||
    case when v_uid is not null and v_signs ? v_uid
      then jsonb_build_object(v_uid, v_signs->v_uid) else '{}'::jsonb end;
  new.data := jsonb_set(new.data, '{signs}', v_signs, true);

  return new;
end;
$$;

drop trigger if exists guard_fhse0301_incident_approval on public.docs;
create trigger guard_fhse0301_incident_approval
before insert or update of data, col on public.docs
for each row execute function public.guard_fhse0301_incident_approval();
