/**
 * =============================================================================
 * SGASD — Camada de integração com a API do Supabase (PostgreSQL)
 * =============================================================================
 *
 * Este arquivo complementa `client.ts` (gerado automaticamente e que NÃO deve
 * ser editado). Aqui centralizamos:
 *
 *  1) Tratamento global de erros de requisição HTTP/API com try/catch e
 *     mensagens amigáveis exibidas em Toast (biblioteca `sonner`).
 *  2) A documentação dos tipos TypeScript das tabelas relacionais do
 *     PostgreSQL, com o mapa de integridade referencial do sistema.
 *
 * Como usar em qualquer componente React:
 *
 *   import { safeQuery, apiRequest } from "@/integrations/supabase/api";
 *   import { supabase } from "@/integrations/supabase/client";
 *
 *   const ativos = await safeQuery(
 *     () => supabase.from("ativos").select("*"),
 *     { context: "carregar ativos" }
 *   );
 *
 * Nenhum layout, rota ou menu é alterado por este módulo: ele é puramente
 * uma camada de dados/utilitários.
 *
 * -----------------------------------------------------------------------------
 * MODELO RELACIONAL (integridade referencial)
 * -----------------------------------------------------------------------------
 *
 *   clientes 1---N contratos 1---N ativos 1---N tickets 1---N ticket_historico
 *      |                              ^            ^
 *      +------------------------------+------------+  (cliente_id / contrato_id)
 *
 *   - contratos.cliente_id        -> clientes.id
 *   - ativos.cliente_id           -> clientes.id
 *   - ativos.contrato_id          -> contratos.id
 *   - tickets.cliente_id          -> clientes.id
 *   - tickets.contrato_id         -> contratos.id
 *   - tickets.ativo_id            -> ativos.id
 *   - ticket_historico.ticket_id  -> tickets.id
 *   - profiles.user_id / user_roles.user_id -> auth.users.id
 * =============================================================================
 */

import { toast } from "sonner";
import type { Database } from "./types";

/* -----------------------------------------------------------------------------
 * 1. Tipos TypeScript das tabelas relacionais do PostgreSQL
 * -------------------------------------------------------------------------- */

/** Atalhos para as linhas (`Row`), inserções e atualizações de cada tabela. */
export type Tables = Database["public"]["Tables"];
export type TableName = keyof Tables;
export type Row<T extends TableName> = Tables[T]["Row"];
export type Insert<T extends TableName> = Tables[T]["Insert"];
export type Update<T extends TableName> = Tables[T]["Update"];

/** Enums do PostgreSQL usados pelo domínio do SGASD. */
export type AppRole = Database["public"]["Enums"]["app_role"];          // admin | tecnico | usuario
export type AssetStatus = Database["public"]["Enums"]["asset_status"];  // ativo | manutencao | baixado
export type ContractStatus = Database["public"]["Enums"]["contract_status"]; // ativo | encerrado
export type SlaStatus = Database["public"]["Enums"]["sla_status"];      // no_prazo | atencao | estourado
export type TicketPriority = Database["public"]["Enums"]["ticket_priority"]; // baixa | media | alta | critica
export type TicketStatus = Database["public"]["Enums"]["ticket_status"]; // aberto | em_andamento | aguardando | resolvido | fechado

/** Cliente da R&C Consultoria — raiz do modelo relacional. */
export type Cliente = Row<"clientes">;
/** Contrato de suporte firmado com um cliente (define as horas de SLA). */
export type Contrato = Row<"contratos">;
/** Ativo tecnológico inventariado, opcionalmente ligado a cliente/contrato. */
export type Ativo = Row<"ativos">;
/** Chamado de Service Desk, ligado a ativo, cliente e contrato. */
export type Ticket = Row<"tickets">;
/** Registro imutável de auditoria das mudanças de um chamado. */
export type TicketHistorico = Row<"ticket_historico">;
/** Perfil público do usuário autenticado. */
export type Profile = Row<"profiles">;
/** Papel do usuário (armazenado em tabela separada por segurança). */
export type UserRole = Row<"user_roles">;

/** Ativo com os relacionamentos resolvidos (joins do PostgREST). */
export type AtivoComRelacoes = Ativo & {
  clientes?: Pick<Cliente, "id" | "nome"> | null;
  contratos?: Pick<Contrato, "id" | "numero"> | null;
};

/** Chamado com os relacionamentos resolvidos (joins do PostgREST). */
export type TicketComRelacoes = Ticket & {
  clientes?: Pick<Cliente, "id" | "nome"> | null;
  contratos?: Pick<Contrato, "id" | "numero"> | null;
  ativos?: Pick<Ativo, "id" | "nome"> | null;
};

/* -----------------------------------------------------------------------------
 * 2. Tratamento global de erros de requisição HTTP (API)
 * -------------------------------------------------------------------------- */

/** Formato mínimo devolvido pelo supabase-js em qualquer query. */
export interface SupabaseResult<T> {
  data: T | null;
  error: { message: string; code?: string; details?: string | null } | null;
}

export interface SafeQueryOptions {
  /** Descrição curta da operação, usada na mensagem do Toast. Ex.: "salvar ativo". */
  context?: string;
  /** Exibe Toast de erro automaticamente (padrão: true). */
  showToast?: boolean;
  /** Mensagem de sucesso opcional. */
  successMessage?: string;
}

/**
 * Traduz códigos de erro do PostgreSQL/PostgREST e falhas de rede em
 * mensagens amigáveis em português para o usuário final.
 */
export function friendlyErrorMessage(error: unknown, context?: string): string {
  const sufixo = context ? ` ao ${context}` : "";
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  const raw =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");

  // Falhas de transporte HTTP (offline, CORS, timeout).
  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return `Não foi possível conectar ao servidor${sufixo}. Verifique sua conexão e tente novamente.`;
  }

  switch (code) {
    case "23505":
      return `Já existe um registro com esses dados${sufixo}.`;
    case "23503":
      return `Este registro está vinculado a outros dados e não pode ser removido${sufixo}.`;
    case "23502":
      return `Preencha todos os campos obrigatórios${sufixo}.`;
    case "22P02":
      return `Algum valor informado está em formato inválido${sufixo}.`;
    case "42501":
    case "PGRST301":
      return `Você não tem permissão para concluir esta ação${sufixo}.`;
    case "PGRST116":
      return `Registro não encontrado${sufixo}.`;
    default:
      break;
  }

  if (/jwt|token|not authenticated|invalid login/i.test(raw)) {
    return "Sua sessão expirou. Faça login novamente para continuar.";
  }

  return raw
    ? `${raw}`
    : `Ocorreu um erro inesperado${sufixo}. Tente novamente em instantes.`;
}

/**
 * Executa uma query do Supabase com try/catch global.
 * Retorna os dados em caso de sucesso ou `null` em caso de erro
 * (o Toast amigável já foi exibido).
 */
export async function safeQuery<T>(
  run: () => PromiseLike<SupabaseResult<T>>,
  options: SafeQueryOptions = {},
): Promise<T | null> {
  const { context, showToast = true, successMessage } = options;
  try {
    const { data, error } = await run();
    if (error) {
      if (showToast) toast.error(friendlyErrorMessage(error, context));
      return null;
    }
    if (successMessage) toast.success(successMessage);
    return data;
  } catch (err) {
    // Erros lançados fora do padrão { data, error }: rede, parsing, aborts.
    if (showToast) toast.error(friendlyErrorMessage(err, context));
    return null;
  }
}

/**
 * Variante que devolve o resultado completo, útil quando a tela precisa
 * distinguir "sem dados" de "erro" sem lançar exceções.
 */
export async function apiRequest<T>(
  run: () => PromiseLike<SupabaseResult<T>>,
  options: SafeQueryOptions = {},
): Promise<{ data: T | null; error: string | null }> {
  const { context, showToast = true, successMessage } = options;
  try {
    const { data, error } = await run();
    if (error) {
      const message = friendlyErrorMessage(error, context);
      if (showToast) toast.error(message);
      return { data: null, error: message };
    }
    if (successMessage) toast.success(successMessage);
    return { data, error: null };
  } catch (err) {
    const message = friendlyErrorMessage(err, context);
    if (showToast) toast.error(message);
    return { data: null, error: message };
  }
}
