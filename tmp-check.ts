import { readFileSync } from "node:fs";
import { extrairPaginas } from "@/lib/icms/esportes/pdf";
import { ehRelatorioIepha, extrairPatrimonioCultural } from "@/lib/icms/criterios/patrimonio";

const buf = readFileSync("/mnt/user-uploads/pontuacao_definitiva_exercicio_2027_28_08_2027.pdf");
const paginas = await extrairPaginas(new Uint8Array(buf));
console.log("iepha?", ehRelatorioIepha(paginas));
const r = extrairPatrimonioCultural(paginas);
console.log("exercicio", r.exercicio, "definitiva", r.definitiva);
console.log("ranking", r.ranking.length, "itens", r.itens.length, "div", r.divergencias.length);
console.log(r.divergencias.slice(0, 5));
for (const nome of ["Abadia dos Dourados", "Abre Campo", "Brumadinho", "Buritizeiro"]) {
  const rk = r.ranking.find((x) => x.municipioNome === nome);
  console.log(nome, rk?.posicao, rk?.notaFinal, rk?.indicePercentual);
  console.log(
    r.itens
      .filter((i) => i.municipioNome === nome)
      .map((i) => `${i.itemCodigo}=${i.pontuacao}${i.observacao ? ` (${i.observacao})` : ""}`),
  );
}
console.log("top", r.ranking.slice(0, 3).map((x) => `${x.municipioNome} ${x.notaFinal}`));
if (typeof process !== "undefined") process.exit(0);
