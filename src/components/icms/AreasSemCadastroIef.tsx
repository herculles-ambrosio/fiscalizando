import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { normalizarMunicipio } from "@/lib/icms/esportes/parser";
import { baixarCsv, montarCsv } from "@/lib/csv";
import type { FonteRelatorio } from "@/hooks/useCriterios";

/**
 * Áreas protegidas que ainda não geram pontuação no IEF.
 *
 * Duas situações são apontadas a partir dos relatórios oficiais importados
 * (ICMS Ecológico — sub-critério Unidades de Conservação):
 *
 * 1. o município aparece no índice de conservação, mas não tem nenhuma unidade
 *    de conservação cadastrada no IEF — a área protegida existe e não pontua;
 * 2. a unidade está cadastrada, porém sem fator de qualidade apurado (0,0) —
 *    o cadastro existe, mas a avaliação anual não foi solicitada.
 */

const LINK_CADASTRO =
  "https://www.mg.gov.br/servico/cadastrar-unidades-de-conservacao-municipais-no-icms-ecologico-sub-criterio-unidades-de";
const LINK_FATOR =
  "https://www.mg.gov.br/servico/solicitar-fator-de-qualidade-das-unidades-de-conservacao-referente-ao-programa-icms-ecologico-sub-criterio-unidades-de-conservacao";
const LINK_MANUAL =
  "https://ief.mg.gov.br/documents/51853/7604982/Manual_de_Procedimentos_para_o_Cadastramento_de_UCs_Municipais_para_fins_de_Recebimento_de_ICMS_Ecol%C3%B3gico/7b986f59-0e9b-0765-7b90-9794eb7a39a0?t=1723743034973&version=1.0";
const LINK_FORMULARIO =
  "https://ief.mg.gov.br/documents/51853/7604982/Formul%C3%A1rio_Municipais/4a523a77-6371-6f31-f3ec-172a29fe2c32?t=1723743035517&version=1.0";

type LinhaBanco = {
  municipio: string;
  municipio_nome: string;
  item_codigo: string | null;
  pontuacao: number | null;
  observacao: string | null;
};

type Pendencia = {
  municipio: string;
  nome: string;
  situacao: "sem_cadastro" | "sem_fator";
  detalhe: string;
  link: string;
  rotuloLink: string;
};

function fatorDaObservacao(obs: string | null): number | null {
  const m = obs?.match(/fator de conserva[cç][aã]o\s+([0-9],[0-9])/i);
  if (!m?.[1]) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function nomeUc(obs: string | null): string {
  const bruto = (obs ?? "").split("·")[0]?.trim() ?? "";
  return bruto || "unidade sem nome no relatório";
}

async function carregarLinhas(ano: number, fonte: FonteRelatorio): Promise<LinhaBanco[]> {
  const linhas: LinhaBanco[] = [];
  const passo = 1000;
  for (let inicio = 0; inicio < 20000; inicio += passo) {
    const { data, error } = await supabase
      .from("criterio_item_municipio")
      .select("municipio, municipio_nome, item_codigo, pontuacao, observacao")
      .eq("criterio", "meio_ambiente")
      .eq("ano_base", ano)
      .eq("fonte_relatorio", fonte)
      .in("item_codigo", ["unidades_conservacao", "indice_conservacao"])
      .range(inicio, inicio + passo - 1);
    if (error) throw error;
    const lote = (data ?? []) as LinhaBanco[];
    linhas.push(...lote);
    if (lote.length < passo) break;
  }
  return linhas;
}

export function AreasSemCadastroIef({
  ano,
  fonte,
}: {
  ano: number | null;
  fonte: FonteRelatorio | null;
}) {
  const { municipio } = useMunicipioAtivo();
  const chave = municipio ? normalizarMunicipio(municipio.nome) : null;
  const [busca, setBusca] = useState("");
  const [soMeu, setSoMeu] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ief-sem-cadastro", ano, fonte],
    enabled: !!ano && !!fonte,
    staleTime: 10 * 60 * 1000,
    queryFn: () => carregarLinhas(ano!, fonte!),
  });

  const pendencias = useMemo<Pendencia[]>(() => {
    if (!data?.length) return [];
    const comUc = new Map<string, { nome: string; ucs: LinhaBanco[] }>();
    const comConservacao = new Map<string, string>();

    for (const l of data) {
      if (l.item_codigo === "unidades_conservacao") {
        const atual = comUc.get(l.municipio) ?? { nome: l.municipio_nome, ucs: [] };
        atual.ucs.push(l);
        comUc.set(l.municipio, atual);
      } else if (l.item_codigo === "indice_conservacao") {
        comConservacao.set(l.municipio, l.municipio_nome);
      }
    }

    const lista: Pendencia[] = [];

    for (const [mun, nome] of comConservacao) {
      if (comUc.has(mun)) continue;
      lista.push({
        municipio: mun,
        nome,
        situacao: "sem_cadastro",
        detalhe:
          "Aparece no índice de conservação, mas não tem nenhuma unidade de conservação cadastrada no IEF.",
        link: LINK_CADASTRO,
        rotuloLink: "Cadastrar UC no IEF",
      });
    }

    const jaVista = new Set<string>();
    for (const [mun, info] of comUc) {
      for (const uc of info.ucs) {
        const fator = fatorDaObservacao(uc.observacao);
        if (fator == null || fator > 0) continue;
        const chaveUc = `${mun}|${nomeUc(uc.observacao)}`;
        if (jaVista.has(chaveUc)) continue;
        jaVista.add(chaveUc);
        lista.push({
          municipio: mun,
          nome: info.nome,
          situacao: "sem_fator",
          detalhe: `${nomeUc(uc.observacao)} — cadastrada, porém com fator de qualidade 0,0 (sem avaliação vigente).`,
          link: LINK_FATOR,
          rotuloLink: "Solicitar fator de qualidade",
        });
      }
    }

    return lista.sort(
      (a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.detalhe.localeCompare(b.detalhe, "pt-BR"),
    );
  }, [data]);

  const filtradas = useMemo(() => {
    const termo = normalizarMunicipio(busca);
    return pendencias.filter(
      (p) =>
        (!soMeu || p.municipio === chave) && (!termo || normalizarMunicipio(p.nome).includes(termo)),
    );
  }, [pendencias, busca, soMeu, chave]);

  const semCadastro = pendencias.filter((p) => p.situacao === "sem_cadastro").length;
  const semFator = pendencias.filter((p) => p.situacao === "sem_fator").length;
  const meuMunicipio = chave ? pendencias.filter((p) => p.municipio === chave) : [];

  if (!ano || !fonte) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Importe um relatório do ICMS Ecológico para conferir as áreas protegidas sem cadastro no
          IEF.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Áreas protegidas sem cadastro no IEF</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Municípios sem UC cadastrada</p>
              <p className="text-xl font-semibold">{semCadastro}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">UCs sem fator de qualidade</p>
              <p className="text-xl font-semibold">{semFator}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Pendências em {municipio?.nome ?? "seu município"}
              </p>
              <p className="text-xl font-semibold">{meuMunicipio.length}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Base: relatório do ICMS Ecológico {ano} ({fonte}). Uma área protegida só entra na
            pontuação depois do cadastro no IEF e da avaliação anual do fator de qualidade.{" "}
            <a className="underline" href={LINK_MANUAL} target="_blank" rel="noreferrer">
              Manual de procedimentos
            </a>{" "}
            ·{" "}
            <a className="underline" href={LINK_FORMULARIO} target="_blank" rel="noreferrer">
              Formulário de UC municipal
            </a>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Lista de pendências ({filtradas.length})</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar município"
                className="w-56 pl-8"
              />
            </div>
            <Button size="sm" variant={soMeu ? "default" : "outline"} onClick={() => setSoMeu((v) => !v)}>
              Só {municipio?.nome ?? "meu município"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                baixarCsv(
                  `areas-sem-cadastro-ief-${ano}-${fonte}.csv`,
                  montarCsv(
                    ["Município", "Situação", "Detalhe", "Link oficial"],
                    filtradas.map((p) => [
                      p.nome,
                      p.situacao === "sem_cadastro" ? "Sem cadastro no IEF" : "Sem fator de qualidade",
                      p.detalhe,
                      p.link,
                    ]),
                  ),
                )
              }
            >
              <Download className="mr-2 size-4" />
              CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && <p className="p-6 text-sm text-muted-foreground">Carregando relatório…</p>}
          {!isLoading && !filtradas.length && (
            <p className="p-6 text-sm text-muted-foreground">
              Nenhuma pendência encontrada com os filtros atuais.
            </p>
          )}
          {!!filtradas.length && (
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60">
                  <tr>
                    <th className="p-2 text-left">Município</th>
                    <th className="p-2 text-left">Situação</th>
                    <th className="p-2 text-left">Detalhe</th>
                    <th className="p-2 text-left">Cadastramento oficial</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((p, i) => (
                    <tr
                      key={`${p.municipio}-${p.situacao}-${i}`}
                      className={p.municipio === chave ? "bg-emerald-50 dark:bg-emerald-950/20" : ""}
                    >
                      <td className="p-2 font-medium">{p.nome}</td>
                      <td className="p-2">
                        <Badge variant={p.situacao === "sem_cadastro" ? "outline" : "secondary"}>
                          {p.situacao === "sem_cadastro" ? "Sem cadastro" : "Sem fator de qualidade"}
                        </Badge>
                      </td>
                      <td className="p-2 text-muted-foreground">{p.detalhe}</td>
                      <td className="p-2">
                        <a
                          className="inline-flex items-center gap-1 text-emerald-700 underline dark:text-emerald-400"
                          href={p.link}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {p.rotuloLink}
                          <ExternalLink className="size-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
