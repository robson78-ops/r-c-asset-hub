ALTER TABLE public.ticket_historico
  ADD COLUMN IF NOT EXISTS campo text,
  ADD COLUMN IF NOT EXISTS valor_anterior text,
  ADD COLUMN IF NOT EXISTS valor_novo text;

CREATE INDEX IF NOT EXISTS idx_ticket_historico_ticket ON public.ticket_historico(ticket_id, created_at);

CREATE OR REPLACE FUNCTION public.compute_ticket_sla()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  horas integer;
  ref timestamptz;
  base timestamptz;
  ctr uuid;
  reaberto boolean := false;
  recalcular boolean := false;
BEGIN
  -- contrato efetivo: o do ticket ou, na ausencia, o do ativo vinculado
  ctr := NEW.contrato_id;
  IF ctr IS NULL AND NEW.ativo_id IS NOT NULL THEN
    SELECT a.contrato_id INTO ctr FROM public.ativos a WHERE a.id = NEW.ativo_id;
  END IF;

  SELECT CASE NEW.prioridade
    WHEN 'critica' THEN c.sla_critica_horas
    WHEN 'alta' THEN c.sla_alta_horas
    WHEN 'media' THEN c.sla_media_horas
    ELSE c.sla_baixa_horas
  END INTO horas
  FROM public.contratos c WHERE c.id = ctr;

  IF horas IS NULL THEN
    horas := CASE NEW.prioridade
      WHEN 'critica' THEN 4 WHEN 'alta' THEN 8 WHEN 'media' THEN 24 ELSE 72 END;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    reaberto := OLD.status IN ('resolvido','fechado') AND NEW.status NOT IN ('resolvido','fechado');
    recalcular := NEW.prioridade IS DISTINCT FROM OLD.prioridade
      OR NEW.contrato_id IS DISTINCT FROM OLD.contrato_id
      OR NEW.ativo_id IS DISTINCT FROM OLD.ativo_id
      OR NEW.due_date IS NULL;
  END IF;

  -- resolucao / reabertura
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IN ('resolvido','fechado') AND NEW.resolved_at IS NULL THEN
      NEW.resolved_at := now();
    ELSIF reaberto THEN
      NEW.resolved_at := NULL;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    base := COALESCE(NEW.created_at, now());
    NEW.due_date := base + (horas || ' hours')::interval;
  ELSIF reaberto THEN
    NEW.due_date := now() + (horas || ' hours')::interval;
  ELSIF recalcular THEN
    NEW.due_date := COALESCE(NEW.created_at, now()) + (horas || ' hours')::interval;
  END IF;

  ref := CASE WHEN NEW.status IN ('resolvido','fechado')
              THEN COALESCE(NEW.resolved_at, now()) ELSE now() END;

  IF ref > NEW.due_date THEN
    NEW.sla_status := 'estourado';
  ELSIF ref > NEW.due_date - ((horas * 0.25) || ' hours')::interval THEN
    NEW.sla_status := 'atencao';
  ELSE
    NEW.sla_status := 'no_prazo';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_ticket_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  nome text;
BEGIN
  SELECT COALESCE(p.display_name, p.email) INTO nome FROM public.profiles p WHERE p.user_id = uid;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ticket_historico (ticket_id, autor_id, autor_nome, acao, campo, valor_novo, comentario)
    VALUES (NEW.id, uid, nome, 'criado', 'ticket', NEW.prioridade::text,
            'Chamado criado com prioridade ' || NEW.prioridade || ' e prazo ' || to_char(NEW.due_date, 'DD/MM/YYYY HH24:MI'));
    RETURN NEW;
  END IF;

  IF NEW.prioridade IS DISTINCT FROM OLD.prioridade THEN
    INSERT INTO public.ticket_historico (ticket_id, autor_id, autor_nome, acao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, uid, nome, 'alteracao', 'prioridade', OLD.prioridade::text, NEW.prioridade::text);
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.ticket_historico (ticket_id, autor_id, autor_nome, acao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, uid, nome,
            CASE WHEN OLD.status IN ('resolvido','fechado') AND NEW.status NOT IN ('resolvido','fechado')
                 THEN 'reabertura' ELSE 'alteracao' END,
            'status', OLD.status::text, NEW.status::text);
  END IF;

  IF NEW.ativo_id IS DISTINCT FROM OLD.ativo_id THEN
    INSERT INTO public.ticket_historico (ticket_id, autor_id, autor_nome, acao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, uid, nome, 'alteracao', 'ativo',
            (SELECT a.nome FROM public.ativos a WHERE a.id = OLD.ativo_id),
            (SELECT a.nome FROM public.ativos a WHERE a.id = NEW.ativo_id));
  END IF;

  IF NEW.contrato_id IS DISTINCT FROM OLD.contrato_id THEN
    INSERT INTO public.ticket_historico (ticket_id, autor_id, autor_nome, acao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, uid, nome, 'alteracao', 'contrato',
            (SELECT c.numero FROM public.contratos c WHERE c.id = OLD.contrato_id),
            (SELECT c.numero FROM public.contratos c WHERE c.id = NEW.contrato_id));
  END IF;

  IF NEW.sla_status IS DISTINCT FROM OLD.sla_status THEN
    INSERT INTO public.ticket_historico (ticket_id, autor_id, autor_nome, acao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, uid, nome, 'sla', 'sla_status', OLD.sla_status::text, NEW.sla_status::text);
  END IF;

  IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
    INSERT INTO public.ticket_historico (ticket_id, autor_id, autor_nome, acao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, uid, nome, 'sla', 'due_date',
            to_char(OLD.due_date, 'DD/MM/YYYY HH24:MI'), to_char(NEW.due_date, 'DD/MM/YYYY HH24:MI'));
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_tickets_audit ON public.tickets;
CREATE TRIGGER trg_tickets_audit
AFTER INSERT OR UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.audit_ticket_changes();