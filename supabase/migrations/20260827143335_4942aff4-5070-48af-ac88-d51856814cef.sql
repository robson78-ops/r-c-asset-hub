CREATE TYPE public.sla_status AS ENUM ('no_prazo', 'atencao', 'estourado');
CREATE TYPE public.contract_status AS ENUM ('ativo', 'encerrado');

CREATE TABLE public.contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  numero text NOT NULL,
  descricao text,
  data_inicio date NOT NULL DEFAULT current_date,
  data_fim date,
  status public.contract_status NOT NULL DEFAULT 'ativo',
  sla_baixa_horas integer NOT NULL DEFAULT 72,
  sla_media_horas integer NOT NULL DEFAULT 24,
  sla_alta_horas integer NOT NULL DEFAULT 8,
  sla_critica_horas integer NOT NULL DEFAULT 4,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO authenticated;
GRANT ALL ON public.contratos TO service_role;

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read contratos" ON public.contratos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert contratos" ON public.contratos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update contratos" ON public.contratos FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete contratos" ON public.contratos FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_contratos_updated BEFORE UPDATE ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ativos ADD COLUMN contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL;
ALTER TABLE public.tickets ADD COLUMN contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL;
ALTER TABLE public.tickets ADD COLUMN due_date timestamptz;
ALTER TABLE public.tickets ADD COLUMN sla_status public.sla_status NOT NULL DEFAULT 'no_prazo';

CREATE INDEX idx_contratos_cliente ON public.contratos(cliente_id);
CREATE INDEX idx_ativos_contrato ON public.ativos(contrato_id);
CREATE INDEX idx_tickets_contrato ON public.tickets(contrato_id);

CREATE OR REPLACE FUNCTION public.compute_ticket_sla()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  horas integer;
  ref timestamptz;
BEGIN
  SELECT CASE NEW.prioridade
    WHEN 'critica' THEN COALESCE(c.sla_critica_horas, 4)
    WHEN 'alta' THEN COALESCE(c.sla_alta_horas, 8)
    WHEN 'media' THEN COALESCE(c.sla_media_horas, 24)
    ELSE COALESCE(c.sla_baixa_horas, 72)
  END INTO horas
  FROM (SELECT 1) dummy
  LEFT JOIN public.contratos c ON c.id = NEW.contrato_id;

  IF horas IS NULL THEN
    horas := CASE NEW.prioridade
      WHEN 'critica' THEN 4 WHEN 'alta' THEN 8 WHEN 'media' THEN 24 ELSE 72 END;
  END IF;

  NEW.due_date := COALESCE(NEW.created_at, now()) + (horas || ' hours')::interval;

  ref := CASE WHEN NEW.status IN ('resolvido','fechado') THEN COALESCE(NEW.resolved_at, now()) ELSE now() END;

  IF ref > NEW.due_date THEN
    NEW.sla_status := 'estourado';
  ELSIF ref > NEW.due_date - ((horas * 0.25) || ' hours')::interval THEN
    NEW.sla_status := 'atencao';
  ELSE
    NEW.sla_status := 'no_prazo';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tickets_sla BEFORE INSERT OR UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.compute_ticket_sla();

UPDATE public.tickets SET updated_at = now();