import { readFileSync } from "node:fs";
import { extrairPaginas } from "@/lib/icms/esportes/pdf";
import { extrairPatrimonioCultural } from "@/lib/icms/criterios/patrimonio";

const url = process.env["SUPABASE_URL"]!;
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
const h = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

async function req(caminho: string, init: RequestInit) {
  const res = await fetch(`${url}/rest/v1/${caminho}`, { ...init, headers: h });
  if (!res.ok) throw new Error(`${caminho}: ${res.status} ${await res.text()}`);
}

const buf = readFileSync("/mnt/user-uploads/pontuacao_definitiva_exercicio_2027_28_08_2027.pdf");
const paginas = await extrairPaginas(new Uint8Array(buf));
const r = extrairPatrimonioCultural(paginas);
const ano = r.exercicio ?? 2027;
const fonte = r.definitiva ? "definitivo" : "preliminar";
const base = `criterio=eq.patrimonio_cultural&ano_base=eq.${ano}&fonte_relatorio=eq.${fonte}`;
await req(`criterio_ranking_municipio?${base}`, { method: "DELETE" });
await req(`criterio_item_municipio?${base}`, { method: "DELETE" });

const comum = { criterio: "patrimonio_cultural", ano_base: ano, fonte_relatorio: fonte };
const ranking = r.ranking.map((x) => ({
  ...comum,
  municipio: x.municipio,
  municipio_nome: x.municipioNome,
  posicao: x.posicao,
  nota_final: x.notaFinal,
  indice_percentual: x.indicePercentual,
}));
const itens = r.itens.map((i) => ({
  ...comum,
  municipio: i.municipio,
  municipio_nome: i.municipioNome,
  item_nome: i.itemNome,
  item_codigo: i.itemCodigo,
  peso: i.peso,
  pontuacao: i.pontuacao,
  quantidade: i.quantidade,
  observacao: i.observacao,
}));
for (let i = 0; i < ranking.length; i += 500)
  await req("criterio_ranking_municipio", {
    method: "POST",
    body: JSON.stringify(ranking.slice(i, i + 500)),
  });
for (let i = 0; i < itens.length; i += 500)
  await req("criterio_item_municipio", {
    method: "POST",
    body: JSON.stringify(itens.slice(i, i + 500)),
  });
await req("criterio_importacoes", {
  method: "POST",
  body: JSON.stringify([
    {
      ...comum,
      origem: "arquivo",
      arquivo_nome: "pontuacao_definitiva_exercicio_2027_28_08_2027.pdf",
      paginas: paginas.length,
      registros_ranking: ranking.length,
      registros_itens: itens.length,
      municipios: new Set(itens.map((i) => i.municipio)).size,
      nao_mapeados: [],
      divergencias: r.divergencias,
      importado_por_nome: "Importação IEPHA (tabela oficial)",
    },
  ]),
});
console.log("ok", ranking.length, itens.length, "divergencias", r.divergencias.length);
process.exit(0);
