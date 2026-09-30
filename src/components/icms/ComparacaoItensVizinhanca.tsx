import type { ItemCriterioRow } from "@/hooks/useCriterios";
import type { AtividadeEsportes } from "@/hooks/useEsportes";

type Item = Pick<ItemCriterioRow, "municipio" | "item_codigo" | "item_nome" | "pontuacao" | "observacao" | "identidade_fonte">;

const valor = (n: number | null | undefined) => n == null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 8 });

function Linha({ nome, melhor, meu, unidade }: { nome: string; melhor: string; meu: string; unidade?: string }) {
  return <tr className="border-b last:border-0"><th scope="row" className="py-2 pr-4 text-left font-normal">{nome}{unidade ? ` (${unidade})` : ""}</th><td className="py-2 pr-4 text-right tabular-nums">{melhor}</td><td className="py-2 text-right tabular-nums">{meu}</td></tr>;
}

export function ComparacaoItensVizinhanca({ slug, codigo, meu, melhor, meuNome, melhorNome, itens, atividades }: {
  slug: string;
  codigo: string;
  meu: string;
  melhor: string;
  meuNome: string;
  melhorNome: string;
  itens: Item[];
  atividades?: AtividadeEsportes[] | undefined;
}) {
  const esportes = slug === "esportes";
  const ambiente = slug === "meio_ambiente" || slug === "meio-ambiente";
  const turismo = slug === "turismo";
  const selecionados = itens.filter((i) => (ambiente || turismo ? true : i.item_codigo === codigo) && (i.municipio === meu || i.municipio === melhor));
  const registros = (municipio: string, chave: string) => selecionados.filter((i) => i.municipio === municipio && i.item_codigo === chave);
  const unica = (municipio: string, chave: string) => registros(municipio, chave)[0];
  const atividadesDo = (municipio: string) => (atividades ?? []).filter((a) => a.municipio === municipio && a.atividade_codigo === codigo);
  const soma = (linhas: AtividadeEsportes[], campo: "pontuacao" | "pontuacao_atletas" | "pontuacao_modalidades" | "qtd_eventos" | "total_participantes") => {
    const numeros = linhas.map((a) => a[campo]).filter((n): n is number => n != null);
    return numeros.length ? valor(numeros.reduce((a, b) => a + b, 0)) : "—";
  };
  const doMelhor = atividadesDo(melhor);
  const doMeu = atividadesDo(meu);

  const linhas = esportes ? [
    ["Pontuação da atividade", soma(doMelhor, "pontuacao"), soma(doMeu, "pontuacao")],
    ["Pontuação de atletas", soma(doMelhor, "pontuacao_atletas"), soma(doMeu, "pontuacao_atletas")],
    ["Pontuação de modalidades", soma(doMelhor, "pontuacao_modalidades"), soma(doMeu, "pontuacao_modalidades")],
    ["Eventos", soma(doMelhor, "qtd_eventos"), soma(doMeu, "qtd_eventos")],
    ["Participantes", soma(doMelhor, "total_participantes"), soma(doMeu, "total_participantes")],
  ] : turismo ? [
    ["Circuito turístico", unica(melhor, "tur_circuito")?.observacao ?? "—", unica(meu, "tur_circuito")?.observacao ?? "—"],
    ...(["tur_nota", "tur_rlpc", "tur_irc", "tur_nota_irc", "tur_iit", "tur_indice"] as const).map((chave) => [
      unica(melhor, chave)?.item_nome ?? unica(meu, chave)?.item_nome ?? chave,
      valor(unica(melhor, chave)?.pontuacao), valor(unica(meu, chave)?.pontuacao),
    ]),
  ] : ambiente ? [...new Set(selecionados.map((i) => i.item_codigo).filter((c): c is string => !!c))].map((chave) => {
    const nome = selecionados.find((i) => i.item_codigo === chave)?.item_nome ?? chave;
    const texto = (municipio: string) => {
      const rows = registros(municipio, chave);
      if (!rows.length) return "—";
      const unicos = new Map(rows.map((i) => [`${i.identidade_fonte ?? ""}|${i.observacao ?? ""}|${i.pontuacao ?? ""}`, i]));
      return [...unicos.values()].map((i) => `${valor(i.pontuacao)}${i.observacao ? ` · ${i.observacao}` : ""}${i.identidade_fonte ? ` · ${i.identidade_fonte}` : ""}`).join("; ");
    };
    return [nome, texto(melhor), texto(meu)];
  }) : [
    ["Pontuação do componente", valor(unica(melhor, codigo)?.pontuacao), valor(unica(meu, codigo)?.pontuacao)],
    ["Detalhes registrados na publicação", unica(melhor, codigo)?.observacao ?? "—", unica(meu, codigo)?.observacao ?? "—"],
  ];

  if (!linhas.length || (esportes && !doMelhor.length && !doMeu.length) || (!esportes && !selecionados.length)) {
    return <p className="text-xs text-muted-foreground">O relatório selecionado não traz detalhes suficientes para esta comparação.</p>;
  }
  return <div className="space-y-2">
    <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-xs">
      <thead><tr className="border-b text-muted-foreground"><th className="py-2 text-left">Informação publicada</th><th className="py-2 pr-4 text-right">{melhorNome}</th><th className="py-2 text-right">{meuNome}</th></tr></thead>
      <tbody>{linhas.map(([nome, melhorValor, meuValor], i) => <Linha key={`${nome}-${i}`} nome={nome ?? "—"} melhor={melhorValor ?? "—"} meu={meuValor ?? "—"} />)}</tbody>
    </table></div>
    <p className="text-xs text-muted-foreground">— indica informação não registrada. As linhas mostram medidas publicadas, não parcelas somáveis do índice.</p>
  </div>;
}