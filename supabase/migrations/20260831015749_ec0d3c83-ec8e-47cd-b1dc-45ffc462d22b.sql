CREATE OR REPLACE FUNCTION public.reset_demo_data()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  c1 uuid; c2 uuid; c3 uuid; c4 uuid;
  k1 uuid; k2 uuid; k3 uuid; k4 uuid;
  a1 uuid; a2 uuid; a3 uuid; a4 uuid; a5 uuid; a6 uuid; a7 uuid; a8 uuid; a9 uuid; a10 uuid;
BEGIN
  IF uid IS NULL OR NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem redefinir a massa de dados';
  END IF;

  DELETE FROM public.ticket_historico;
  DELETE FROM public.tickets;
  DELETE FROM public.ativos;
  DELETE FROM public.contratos;
  DELETE FROM public.clientes;

  INSERT INTO public.clientes (nome, documento, email, telefone, endereco, created_by) VALUES
    ('Clínica Vida Plena', '12.345.678/0001-90', 'contato@vidaplena.com.br', '(11) 4002-8922', 'Av. Brasil, 1200 - Jacareí/SP', uid) RETURNING id INTO c1;
  INSERT INTO public.clientes (nome, documento, email, telefone, endereco, created_by) VALUES
    ('Escola Saber & Cia', '23.456.789/0001-01', 'ti@saberecia.com.br', '(11) 3322-1100', 'Rua das Flores, 45 - Igaratá/SP', uid) RETURNING id INTO c2;
  INSERT INTO public.clientes (nome, documento, email, telefone, endereco, created_by) VALUES
    ('Mendonça Advocacia', '34.567.890/0001-12', 'adm@mendoncaadv.com.br', '(12) 3901-7788', 'Rua XV de Novembro, 300 - Jacareí/SP', uid) RETURNING id INTO c3;
  INSERT INTO public.clientes (nome, documento, email, telefone, endereco, created_by) VALUES
    ('Padaria São José', '45.678.901/0001-23', 'financeiro@padariasaojose.com.br', '(12) 3955-4321', 'Av. Santos Dumont, 88 - Igaratá/SP', uid) RETURNING id INTO c4;

  INSERT INTO public.contratos (cliente_id, numero, descricao, data_inicio, status, sla_baixa_horas, sla_media_horas, sla_alta_horas, sla_critica_horas, created_by)
  VALUES (c1, 'CT-2026-001', 'Suporte integral 24x7', CURRENT_DATE - 240, 'ativo', 48, 16, 6, 2, uid) RETURNING id INTO k1;
  INSERT INTO public.contratos (cliente_id, numero, descricao, data_inicio, status, sla_baixa_horas, sla_media_horas, sla_alta_horas, sla_critica_horas, created_by)
  VALUES (c2, 'CT-2026-002', 'Manutenção de laboratório de informática', CURRENT_DATE - 180, 'ativo', 72, 24, 8, 4, uid) RETURNING id INTO k2;
  INSERT INTO public.contratos (cliente_id, numero, descricao, data_inicio, status, sla_baixa_horas, sla_media_horas, sla_alta_horas, sla_critica_horas, created_by)
  VALUES (c3, 'CT-2026-003', 'Suporte administrativo comercial', CURRENT_DATE - 120, 'ativo', 72, 24, 8, 4, uid) RETURNING id INTO k3;
  INSERT INTO public.contratos (cliente_id, numero, descricao, data_inicio, status, sla_baixa_horas, sla_media_horas, sla_alta_horas, sla_critica_horas, created_by)
  VALUES (c4, 'CT-2026-004', 'Suporte de PDV e retaguarda', CURRENT_DATE - 60, 'ativo', 72, 24, 8, 4, uid) RETURNING id INTO k4;

  INSERT INTO public.ativos (cliente_id, contrato_id, nome, marca, modelo, numero_serial, data_garantia, status, created_by) VALUES
    (c1, k1, 'Servidor Dell PowerEdge', 'Dell', 'PowerEdge T440', 'SRV-VP-0001', CURRENT_DATE + 400, 'ativo', uid) RETURNING id INTO a1;
  INSERT INTO public.ativos (cliente_id, contrato_id, nome, marca, modelo, numero_serial, data_garantia, status, created_by) VALUES
    (c1, k1, 'Notebook Recepção 01', 'Lenovo', 'ThinkPad E14', 'NB-VP-0002', CURRENT_DATE + 210, 'ativo', uid) RETURNING id INTO a2;
  INSERT INTO public.ativos (cliente_id, contrato_id, nome, marca, modelo, numero_serial, data_garantia, status, created_by) VALUES
    (c1, k1, 'Impressora Multifuncional', 'HP', 'LaserJet M428', 'IMP-VP-0003', CURRENT_DATE + 90, 'manutencao', uid) RETURNING id INTO a3;
  INSERT INTO public.ativos (cliente_id, contrato_id, nome, marca, modelo, numero_serial, data_garantia, status, created_by) VALUES
    (c2, k2, 'Desktop Laboratório 01', 'Positivo', 'Master D570', 'DSK-SC-0004', CURRENT_DATE + 150, 'ativo', uid) RETURNING id INTO a4;
  INSERT INTO public.ativos (cliente_id, contrato_id, nome, marca, modelo, numero_serial, data_garantia, status, created_by) VALUES
    (c2, k2, 'Desktop Laboratório 02', 'Positivo', 'Master D570', 'DSK-SC-0005', CURRENT_DATE + 150, 'ativo', uid) RETURNING id INTO a5;
  INSERT INTO public.ativos (cliente_id, contrato_id, nome, marca, modelo, numero_serial, data_garantia, status, created_by) VALUES
    (c2, k2, 'Switch de Rede 24p', 'TP-Link', 'TL-SG1024', 'SWT-SC-0006', CURRENT_DATE + 330, 'ativo', uid) RETURNING id INTO a6;
  INSERT INTO public.ativos (cliente_id, contrato_id, nome, marca, modelo, numero_serial, data_garantia, status, created_by) VALUES
    (c3, k3, 'Notebook Sócio Diretor', 'Apple', 'MacBook Air M2', 'NB-MA-0007', CURRENT_DATE + 500, 'ativo', uid) RETURNING id INTO a7;
  INSERT INTO public.ativos (cliente_id, contrato_id, nome, marca, modelo, numero_serial, data_garantia, status, created_by) VALUES
    (c3, k3, 'NAS de Backup Jurídico', 'Synology', 'DS220+', 'NAS-MA-0008', CURRENT_DATE + 260, 'ativo', uid) RETURNING id INTO a8;
  INSERT INTO public.ativos (cliente_id, contrato_id, nome, marca, modelo, numero_serial, data_garantia, status, created_by) VALUES
    (c4, k4, 'PDV Frente de Caixa 01', 'Bematech', 'RC-8400', 'PDV-SJ-0009', CURRENT_DATE + 120, 'ativo', uid) RETURNING id INTO a9;
  INSERT INTO public.ativos (cliente_id, contrato_id, nome, marca, modelo, numero_serial, data_garantia, status, created_by) VALUES
    (c4, k4, 'Impressora Fiscal', 'Epson', 'TM-T20X', 'IMF-SJ-0010', CURRENT_DATE - 30, 'baixado', uid) RETURNING id INTO a10;

  -- Chamados no prazo (verde)
  INSERT INTO public.tickets (cliente_id, contrato_id, ativo_id, titulo, descricao, prioridade, status, created_by, created_at) VALUES
    (c1, k1, a1, 'Lentidão no servidor de prontuários', 'Usuários relatam demora ao abrir prontuários eletrônicos.', 'alta', 'em_andamento', uid, now() - interval '1 hour'),
    (c2, k2, a4, 'Desktop do laboratório não liga', 'Equipamento sem resposta ao pressionar o botão power.', 'media', 'aberto', uid, now() - interval '2 hours'),
    (c3, k3, a7, 'Configurar VPN para acesso remoto', 'Sócio precisa acessar o NAS fora do escritório.', 'baixa', 'aberto', uid, now() - interval '5 hours'),
    (c4, k4, a9, 'Treinamento de operação do PDV', 'Nova operadora precisa de orientação básica.', 'baixa', 'aguardando', uid, now() - interval '8 hours'),
    (c2, k2, a6, 'Revisão preventiva do switch', 'Checagem de portas e temperatura do rack.', 'media', 'em_andamento', uid, now() - interval '3 hours');

  -- Chamado resolvido dentro do prazo
  INSERT INTO public.tickets (cliente_id, contrato_id, ativo_id, titulo, descricao, prioridade, status, created_by, created_at, resolved_at) VALUES
    (c1, k1, a2, 'Troca de bateria do notebook da recepção', 'Bateria não segura carga.', 'media', 'resolvido', uid, now() - interval '3 days', now() - interval '3 days' + interval '4 hours');

  -- Chamados com SLA estourado (histórico realista)
  INSERT INTO public.tickets (cliente_id, contrato_id, ativo_id, titulo, descricao, prioridade, status, created_by, created_at) VALUES
    (c1, k1, a3, 'Impressora multifuncional sem comunicação', 'Equipamento parou de responder na rede.', 'critica', 'em_andamento', uid, now() - interval '5 days'),
    (c4, k4, a10, 'Impressora fiscal fora de operação', 'Equipamento sem garantia, aguardando substituição.', 'alta', 'aguardando', uid, now() - interval '7 days');

  RETURN 'Massa de dados redefinida: 4 clientes, 4 contratos, 10 ativos e 8 chamados.';
END;
$$;

REVOKE ALL ON FUNCTION public.reset_demo_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_demo_data() TO authenticated;