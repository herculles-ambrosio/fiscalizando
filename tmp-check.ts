import { readFileSync, writeFileSync } from "node:fs";
import { extrairPaginas } from "@/lib/icms/esportes/pdf";
import { extrairPatrimonioCultural } from "@/lib/icms/criterios/patrimonio";

const buf = readFileSync("/mnt/user-uploads/pontuacao_definitiva_exercicio_2027_28_08_2027.pdf");
const paginas = await extrairPaginas(new Uint8Array(buf));
const r = extrairPatrimonioCultural(paginas);
const q = (v: string | null) => (v === null ? "NULL" : `'${v.replace(/'/g, "''")}'`);
const n = (v: number | null) => (v === null ? "NULL" : String(v));
const ano = r.exercicio ?? 2027;
const fonte = r.definitiva ? "definitivo" : "preliminar";
const L: string[] = [
  "begin;",
  `delete from criterio_ranking_municipio where criterio='patrimonio_cultural' and ano_base=${ano} and fonte_relatorio='${fonte}';`,
  `delete from criterio_item_municipio where criterio='patrimonio_cultural' and ano_base=${ano} and fonte_relatorio='${fonte}';`,
];
for (const x of r.ranking) {
  L.push(
    `insert into criterio_ranking_municipio (criterio,ano_base,fonte_relatorio,municipio,municipio_nome,posicao,nota_final,indice_percentual) values ('patrimonio_cultural',${ano},'${fonte}',${q(x.municipio)},${q(x.municipioNome)},${n(x.posicao)},${x.notaFinal},${x.indicePercentual});`,
  );
}
for (const i of r.itens) {
  L.push(
    `insert into criterio_item_municipio (criterio,ano_base,fonte_relatorio,municipio,municipio_nome,item_nome,item_codigo,peso,pontuacao,quantidade,observacao) values ('patrimonio_cultural',${ano},'${fonte}',${q(i.municipio)},${q(i.municipioNome)},${q(i.itemNome)},${q(i.itemCodigo)},${n(i.peso)},${n(i.pontuacao)},${n(i.quantidade)},${q(i.observacao)});`,
  );
}
L.push(
  `insert into criterio_importacoes (criterio,ano_base,fonte_relatorio,origem,url,arquivo_nome,paginas,registros_ranking,registros_itens,municipios,nao_mapeados,divergencias,importado_por_nome) values ('patrimonio_cultural',${ano},'${fonte}','arquivo',NULL,'pontuacao_definitiva_exercicio_2027.pdf',${paginas.length},${r.ranking.length},${r.itens.length},${new Set(r.itens.map((i) => i.municipio)).size},'[]'::jsonb,'[]'::jsonb,'Importação IEPHA (equipe)');`,
);
L.push("commit;");
writeFileSync("/tmp/patrimonio.sql", L.join("\n"));
console.log("sql", L.length, "ranking", r.ranking.length, "itens", r.itens.length);
process.exit(0);
