
-- Tickets
DROP POLICY IF EXISTS "Admin/tecnico delete tickets" ON public.tickets;
CREATE POLICY "Authenticated delete tickets" ON public.tickets
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Ativos
DROP POLICY IF EXISTS "Admin/tecnico delete ativos" ON public.ativos;
CREATE POLICY "Authenticated delete ativos" ON public.ativos
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Clientes
DROP POLICY IF EXISTS "Admin/tecnico delete clientes" ON public.clientes;
CREATE POLICY "Authenticated delete clientes" ON public.clientes
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Histórico (necessário para remover o ticket junto)
CREATE POLICY "Authenticated delete historico" ON public.ticket_historico
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
