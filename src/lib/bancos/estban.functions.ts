import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Entrada = { municipioId: string; ano: number; mes: number };

/** Baixa o ESTBAN mensal do Banco Central e grava as instituições do município. */
export const importarEstban = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((e: Entrada) => {
    if (!e?.municipioId || !/^[0-9a-f-]{36}$/i.test(e.municipioId)) throw new Error("Município inválido");
    const ano = Number(e.ano), mes = Number(e.mes);
    if (!(ano >= 2000 && ano <= 2100 && mes >= 1 && mes <= 12)) throw new Error("Competência inválida");
    return { municipioId: e.municipioId, ano, mes };
  })
  .handler(async ({ data, context }) => {
    const { unzipSync } = await import("fflate");
    const { lerEstban } = await import("./importacao");
    const { data: mun } = await context.supabase.from("municipios").select("id, nome, uf").eq("id", data.municipioId).maybeSingle();
    if (!mun) throw new Error("Sem acesso a esta prefeitura.");

    const ref = `${data.ano}${String(data.mes).padStart(2, "0")}`;
    const base = "https://www.bcb.gov.br/content/estatisticas/estatistica_bancaria_estban/municipio/";
    let bytes: Uint8Array | null = null;
    for (const nome of [`${ref}_ESTBAN.csv.zip`, `${ref}_ESTBAN.ZIP`]) {
      const r = await fetch(base + nome);
      if (r.ok && (r.headers.get("content-type") ?? "").includes("zip") || (r.ok && nome.endsWith("zip"))) {
        const b = new Uint8Array(await r.arrayBuffer());
        if (b[0] === 0x50 && b[1] === 0x4b) { bytes = b; break; }
      }
    }
    if (!bytes) return { ok: false as const, mensagem: `O Banco Central ainda não publicou o ESTBAN de ${String(data.mes).padStart(2, "0")}/${data.ano}.` };

    const arquivos = unzipSync(bytes);
    const csv = Object.values(arquivos)[0];
    if (!csv) throw new Error("Arquivo ESTBAN vazio.");
    let texto = "";
    for (let i = 0; i < csv.length; i += 8192) texto += String.fromCharCode(...csv.subarray(i, i + 8192)); // Latin-1
    const linhas = lerEstban(texto, mun.nome, mun.uf);
    if (linhas.length) {
      const { error } = await context.supabase.from("bancos_estban").upsert(
        linhas.map((l) => ({ ...l, municipio_id: data.municipioId })),
        { onConflict: "municipio_id,competencia_ano,competencia_mes,cnpj_raiz" },
      );
      if (error) throw new Error(error.message);
      // Cadastra as instituições encontradas (sem sobrescrever as já existentes).
      await context.supabase.from("bancos_instituicoes").upsert(
        linhas.map((l) => ({ municipio_id: data.municipioId, cnpj: l.cnpj_raiz, nome: l.nome, tipo: "BANCO", codigo_bc: l.cnpj_raiz })),
        { onConflict: "municipio_id,cnpj", ignoreDuplicates: true },
      );
    }
    const comp = `${String(data.mes).padStart(2, "0")}/${data.ano}`;
    return {
      ok: true as const,
      instituicoes: linhas.length,
      mensagem: linhas.length
        ? `${linhas.length} instituição(ões) no ESTBAN de ${comp}.`
        : `Nenhuma agência bancária de ${mun.nome} no ESTBAN de ${comp}. O município pode ser atendido só por cooperativas ou correspondentes — use o IF.data.`,
    };
  });
