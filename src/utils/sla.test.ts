/**
 * SGASD 2.0 — Utilitários e Testes Unitários de SLA e Validação de E-mail
 * -------------------------------------------------------------------------
 * Arquivo: src/utils/sla.test.ts
 *
 * Este arquivo contém funções puras (sem efeitos colaterais) responsáveis por:
 *   • Calcular a data/hora de vencimento (due_date) de um chamado baseado na
 *     severidade/prioridade e nos SLAs contratuais.
 *   • Determinar o status do SLA (no_prazo, atencao, estourado).
 *   • Validar endereços de e-mail.
 *
 * Integração com React (Framework Web)
 * -----------------------------------
 * React é uma biblioteca JavaScript/TypeScript para construção de interfaces.
 * Os componentes visuais do SGASD (em src/routes e src/components) importam
 * essas funções utilitárias e as executam em eventos, hooks (useMemo, useEffect)
 * ou handlers de formulário. Como as regras estão isoladas em scripts TypeScript
 * puros, elas podem ser testadas unitariamente sem precisar renderizar a DOM.
 *
 * Exemplo de uso em um componente React:
 *
 *   import { calculateSLADueDate, getSLAStatus } from "@/utils/sla.test";
 *
 *   const dueDate = calculateSLADueDate("alta", new Date(), contractSLA);
 *   const slaStatus = getSLAStatus(dueDate);
 *
 * O TypeScript garante que apenas valores válidos de prioridade sejam passados,
 * reduzindo erros em tempo de execução e facilitando a manutenção.
 */

import { describe, expect, test } from "bun:test";

/**
 * Prioridades de ticket aceitas pelo sistema.
 * A ordem do enum reflete a severidade crescente.
 */
export type TicketPriority = "baixa" | "media" | "alta" | "critica";

/**
 * Status possíveis de cumprimento do SLA.
 */
export type SLAStatus = "no_prazo" | "atencao" | "estourado";

/**
 * Horas de SLA por severidade. O sistema usa esses valores como padrão quando
 * nenhum contrato específico é informado.
 */
export interface SLAHours {
  critica: number;
  alta: number;
  media: number;
  baixa: number;
}

/**
 * SLA padrão do SGASD, em horas.
 * Pode ser sobrescrito pelos SLAs definidos no contrato do cliente.
 */
export const DEFAULT_SLA_HOURS: SLAHours = {
  critica: 4,
  alta: 8,
  media: 24,
  baixa: 72,
};

/**
 * Converte horas em milissegundos.
 */
const hoursToMs = (hours: number): number => hours * 60 * 60 * 1000;

/**
 * Calcula a data/hora de vencimento (due_date) de um chamado.
 *
 * @param priority      Prioridade do ticket (baixa, media, alta, critica).
 * @param startDate     Momento de abertura ou reabertura do chamado.
 * @param contractSLA   (opcional) SLAs específicos do contrato do cliente.
 * @returns Data/hora de vencimento do chamado.
 *
 * Regras de negócio:
 *   • crítica → 4h  • alta → 8h  • média → 24h  • baixa → 72h (padrão).
 *   • Se o contrato informar um SLA para a prioridade, ele tem precedência.
 *   • A reabertura de um chamado deve chamar esta função novamente com
 *     startDate = data/hora da reabertura, gerando um novo due_date.
 */
export function calculateSLADueDate(
  priority: TicketPriority,
  startDate: Date,
  contractSLA?: Partial<SLAHours>
): Date {
  const hours = contractSLA?.[priority] ?? DEFAULT_SLA_HOURS[priority];
  return new Date(startDate.getTime() + hoursToMs(hours));
}

/**
 * Determina o status do SLA com base no due_date e, opcionalmente, na data de
 * resolução do chamado.
 *
 * @param dueDate     Data/hora de vencimento calculada.
 * @param resolvedAt  (opcional) Data/hora em que o chamado foi resolvido.
 * @param now         (opcional) Instância de referência para comparação.
 * @param startDate   (opcional) Data/hora de abertura/reabertura do chamado.
 *                    Quando informada, a janela total do SLA é calculada como
 *                    dueDate - startDate, tornando o alerta proporcional ao
 *                    contrato/prioridade. Sem startDate, usa 24h como fallback.
 * @returns Status do SLA: no_prazo, atencao ou estourado.
 *
 * Regras de negócio:
 *   • Se o chamado já foi resolvido (resolvedAt), compara resolvedAt com dueDate.
 *   • Caso contrário, compara o momento atual (now) com dueDate.
 *   • "estourado"  → prazo expirado.
 *   • "atencao"    → faltam menos ou igual a 25% do tempo total OU menos de 1h.
 *   • "no_prazo"   → ainda há tempo suficiente.
 */
export function getSLAStatus(
  dueDate: Date,
  resolvedAt: Date | null = null,
  now: Date = new Date(),
  startDate?: Date
): SLAStatus {
  const reference = resolvedAt ?? now;

  if (reference.getTime() > dueDate.getTime()) {
    return "estourado";
  }

  // Janela total do SLA: se startDate fornecida, usa o tempo real do chamado;
  // caso contrário, assume 24h como referência genérica.
  const totalWindow = startDate
    ? dueDate.getTime() - startDate.getTime()
    : hoursToMs(24);
  const remaining = dueDate.getTime() - reference.getTime();
  const oneHour = hoursToMs(1);

  if (remaining <= totalWindow * 0.25 || remaining <= oneHour) {
    return "atencao";
  }

  return "no_prazo";
}

/**
 * Valida um endereço de e-mail.
 *
 * @param email Endereço de e-mail a ser validado.
 * @returns true se o formato for válido; false caso contrário.
 *
 * A expressão regular verifica:
 *   • Parte local com letras, números e caracteres permitidos.
 *   • Domínio com pelo menos um ponto e TLD de 2+ caracteres.
 *   • Ausência de espaços e caracteres inválidos.
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return regex.test(email.trim().toLowerCase());
}

/* ==========================================================================
 * TESTES UNITÁRIOS
 * ========================================================================== */

describe("SLA Utilities", () => {
  describe("calculateSLADueDate", () => {
    test("calcula due_date para prioridade CRITICA em 4 horas", () => {
      const start = new Date("2026-08-31T09:00:00.000Z");
      const due = calculateSLADueDate("critica", start);
      expect(due.toISOString()).toBe("2026-08-31T13:00:00.000Z");
    });

    test("calcula due_date para prioridade ALTA em 8 horas", () => {
      const start = new Date("2026-08-31T09:00:00.000Z");
      const due = calculateSLADueDate("alta", start);
      expect(due.toISOString()).toBe("2026-08-31T17:00:00.000Z");
    });

    test("calcula due_date para prioridade MEDIA em 24 horas", () => {
      const start = new Date("2026-08-31T09:00:00.000Z");
      const due = calculateSLADueDate("media", start);
      expect(due.toISOString()).toBe("2026-09-01T09:00:00.000Z");
    });

    test("calcula due_date para prioridade BAIXA em 72 horas", () => {
      const start = new Date("2026-08-31T09:00:00.000Z");
      const due = calculateSLADueDate("baixa", start);
      expect(due.toISOString()).toBe("2026-09-03T09:00:00.000Z");
    });

    test("usa SLA do contrato quando fornecido", () => {
      const start = new Date("2026-08-31T09:00:00.000Z");
      const contractSLA: Partial<SLAHours> = { alta: 2, media: 12 };
      const dueAlta = calculateSLADueDate("alta", start, contractSLA);
      const dueMedia = calculateSLADueDate("media", start, contractSLA);

      expect(dueAlta.toISOString()).toBe("2026-08-31T11:00:00.000Z");
      expect(dueMedia.toISOString()).toBe("2026-08-31T21:00:00.000Z");
    });

    test("recalcula due_date na reabertura usando nova data de início", () => {
      const originalStart = new Date("2026-08-31T09:00:00.000Z");
      const reopenAt = new Date("2026-09-01T10:00:00.000Z");

      const originalDue = calculateSLADueDate("alta", originalStart);
      const reopenedDue = calculateSLADueDate("alta", reopenAt);

      expect(originalDue.toISOString()).toBe("2026-08-31T17:00:00.000Z");
      expect(reopenedDue.toISOString()).toBe("2026-09-01T18:00:00.000Z");
    });
  });

  describe("getSLAStatus", () => {
    test("retorna 'no_prazo' quando há tempo de sobra", () => {
      const start = new Date("2026-08-31T09:00:00.000Z");
      const now = new Date("2026-08-31T10:00:00.000Z");
      const due = new Date("2026-08-31T17:00:00.000Z"); // 8h de SLA, 7h restantes
      expect(getSLAStatus(due, null, now, start)).toBe("no_prazo");
    });

    test("retorna 'atencao' quando faltam menos de 25% do tempo total", () => {
      const start = new Date("2026-08-31T09:00:00.000Z");
      const now = new Date("2026-08-31T15:30:00.000Z"); // 1,5h antes (8h total → 25% = 2h)
      const due = new Date("2026-08-31T17:00:00.000Z");
      expect(getSLAStatus(due, null, now, start)).toBe("atencao");
    });

    test("retorna 'atencao' quando faltam menos de 1h", () => {
      const now = new Date("2026-08-31T15:30:00.000Z");
      const due = new Date("2026-08-31T16:00:00.000Z"); // 30min depois
      expect(getSLAStatus(due, null, now)).toBe("atencao");
    });

    test("retorna 'estourado' quando o prazo expirou", () => {
      const now = new Date("2026-08-31T18:00:00.000Z");
      const due = new Date("2026-08-31T17:00:00.000Z");
      expect(getSLAStatus(due, null, now)).toBe("estourado");
    });

    test("considera resolvedAt ao invés de now quando chamado foi resolvido", () => {
      const start = new Date("2026-08-31T09:00:00.000Z");
      const due = new Date("2026-08-31T17:00:00.000Z"); // 8h de SLA
      const resolvedAt = new Date("2026-08-31T14:00:00.000Z"); // 3h antes do vencimento
      const now = new Date("2026-09-01T10:00:00.000Z"); // depois do vencimento

      // Mesmo com "now" após o vencimento, o status deve refletir a resolução.
      expect(getSLAStatus(due, resolvedAt, now, start)).toBe("no_prazo");
    });

    test("resolução próxima ao vencimento mantém status 'atencao'", () => {
      const start = new Date("2026-08-31T09:00:00.000Z");
      const due = new Date("2026-08-31T17:00:00.000Z");
      const resolvedAt = new Date("2026-08-31T15:30:00.000Z"); // 1,5h antes (dentro dos 25%)
      expect(getSLAStatus(due, resolvedAt, new Date(), start)).toBe("atencao");
    });

    test("retorna 'estourado' quando resolvido após o vencimento", () => {
      const due = new Date("2026-08-31T17:00:00.000Z");
      const resolvedAt = new Date("2026-08-31T18:00:00.000Z");
      expect(getSLAStatus(due, resolvedAt)).toBe("estourado");
    });
  });

  describe("validateEmail", () => {
    test("aceita e-mails válidos", () => {
      expect(validateEmail("robson@rcconsultoria.com.br")).toBe(true);
      expect(validateEmail("joao.eduardo@univsp.edu")).toBe(true);
      expect(validateEmail("suporte+ti@rcconsultoria.org")).toBe(true);
    });

    test("rejeita e-mails inválidos", () => {
      expect(validateEmail("")).toBe(false);
      expect(validateEmail("robson")).toBe(false);
      expect(validateEmail("robson@")).toBe(false);
      expect(validateEmail("@rcconsultoria.com")).toBe(false);
      expect(validateEmail("robson rc@rcconsultoria.com")).toBe(false);
      expect(validateEmail(null as unknown as string)).toBe(false);
    });
  });
});
