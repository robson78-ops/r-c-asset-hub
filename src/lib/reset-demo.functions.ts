/**
 * Reset / seed da massa de dados de demonstração do SGASD.
 *
 * A lógica de limpeza e recarga vive no banco (função `public.reset_demo_data`),
 * que é SECURITY DEFINER e só executa para usuários com o papel `admin`.
 * Aqui expomos essa rotina como server function tipada, sem alterar layouts ou menus.
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export type ResetDemoDataResult = {
  ok: boolean;
  message: string;
};

export const resetDemoData = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResetDemoDataResult> => {
    const { data, error } = await context.supabase.rpc('reset_demo_data');

    if (error) {
      return {
        ok: false,
        message:
          error.message.includes('administradores')
            ? 'Apenas administradores podem redefinir a massa de dados.'
            : 'Não foi possível redefinir a massa de dados. Tente novamente.',
      };
    }

    return { ok: true, message: data ?? 'Massa de dados redefinida.' };
  });
