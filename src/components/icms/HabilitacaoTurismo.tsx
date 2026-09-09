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
import { MUNICIPIOS_MG } from "@/lib/icms/criterios/municipiosMg";
import type { FonteRelatorio } from "@/hooks/useCriterios";

/**
 * Habilitação no ICMS Turismo — o equivalente, no Turismo, do cadastro de
 * unidades de conservação no IEF.
 *
 * Três situações impedem o município de somar tudo o que poderia:
 *
 * 1. não aparece na publicação de habilitados — não pontua nada no critério;
 * 2. está habilitado, mas com nota abaixo de 10 — perde parte da pontuação;
 * 3. está habilitado sem circuito turístico identificado na publicação.
 */

const LINK_HABILITACAO = "https://www.secult.mg.gov.br/turismo/icms-turismo";
const LINK_CIRCUITOS = "https://www.secult.mg.gov.br/turismo/circuitos-turisticos";
const LINK_SERVICO =
  "https://www.mg.gov.br/servico/habilitar-o-municipio-ao-recebimento-de-recursos-do-icms-criterio-turismo";

type LinhaItem = {
  municipio: string;
  municipio_nome: string;
  item_codigo: string | null;
  pontuacao: number | null;
  observacao: string | null;
};

type Situacao = "nao_habilitado" | "nota_parcial" | "sem_circuito";

type Pendencia = {
  municipio: string;
  nome: string;
  situacao: Situacao;
  detalhe: string;
  link: string;
  rotuloLink: string;
};

const ROTULO: Record<Situacao, string> = {
  nao_habilitado: "Não habilitado",
  nota_parcial: "Nota abaixo de 10",
  sem_circuito: "Sem circuito na publicação",
};

async function carregarItens(ano: number, fonte: FonteRelatorio): Promise<LinhaItem[]> {
  const linhas: LinhaItem[] = [];
  const passo = 1000;
  for (let inicio = 0; inicio < 20000; inicio += passo) {
    const { data, error } = await supabase
      .from("criterio_item_municipio")
      .select("municipio, municipio_nome, item_codigo, pontuacao, observacao")
      .eq("criterio", "turismo")
      .eq("ano_base", ano)
      .eq("fonte_relatorio", fonte)
      .in("item_codigo", ["tur_nota", "tur_circuito"])
      .range(inicio, inicio + passo - 1);
    if (error) throw error;
    const lote = (data ?? []) as LinhaItem[];
    linhas.push(...lote);
    if (lote.length < passo) break;
  }
  return linhas;
}

export function HabilitacaoTurismo({
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
    queryKey: ["turismo-habilitacao", ano, fonte],
    enabled: !!ano && !!fonte,
    staleTime: 10 * 60 * 1000,
    queryFn: () => carregarItens(ano!, fonte!),
  });

  const pendencias = useMemo<Pendencia[]>(() => {
    if (!data) return [];
    const notas = new Map<string, { nome: string; nota: number | null }>();
    const circuitos = new Map<string, string | null>();
    for (const l of data) {
      if (l.item_codigo === "tur_nota") {
        notas.set(l.municipio, { nome: l.municipio_nome, nota: l.pontuacao });
      } else if (l.item_codigo === "tur_circuito") {
        circuitos.set(l.municipio, l.observacao);
      }
    }

    const lista: Pendencia[] = [];

    for (const m of MUNICIPIOS_MG) {
      if (notas.has(m.chave)) continue;
      lista.push({
        municipio: m.chave,
        nome: m.nome,
        situacao: "nao_habilitado",
        detalhe:
          "Não aparece na publicação de habilitados deste ano-base, ou seja, hoje não recebe nada pelo critério Turismo.",
        link: LINK_SERVICO,
        rotuloLink: "Habilitar o município",
      });
    }

    for (const [mun, info] of notas) {
      if (info.nota != null && info.nota < 10) {
        lista.push({
          municipio: mun,
          nome: info.nome,
          situacao: "nota_parcial",
          detalhe: `Habilitado com nota ${info.nota.toLocaleString("pt-BR")} de 10 — parte da pontuação se perde na conferência anual da Secult.`,
          link: LINK_HABILITACAO,
          rotuloLink: "Conferir exigências da habilitação",
        });
      }
      if (!circuitos.get(mun)) {
        lista.push({
          municipio: mun,
          nome: info.nome,
          situacao: "sem_circuito",
          detalhe:
            "Habilitado sem circuito turístico identificado na publicação — confirme a adesão ao circuito junto à Secult.",
          link: LINK_CIRCUITOS,
          rotuloLink: "Circuitos turísticos",
        });
      }
    }

    return lista.sort(
      (a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.situacao.localeCompare(b.situacao),
    );
  }, [data]);

  const filtradas = useMemo(() => {
    const termo = normalizarMunicipio(busca);
    return pendencias.filter(
      (p) =>
        (!soMeu || p.municipio === chave) && (!termo || normalizarMunicipio(p.nome).includes(termo)),
    );
  }, [pendencias, busca, soMeu, chave]);

  const naoHabilitados = pendencias.filter((p) => p.situacao === "nao_habilitado").length;
  const notaParcial = pendencias.filter((p) => p.situacao === "nota_parcial").length;
  const meuMunicipio = chave ? pendencias.filter((p) => p.municipio === chave) : [];

  if (!ano || !fonte) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Importe a publicação de habilitados do ICMS Turismo para conferir a situação da
          habilitação.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Habilitação no ICMS Turismo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Municípios não habilitados</p>
              <p className="text-xl font-semibold">{naoHabilitados}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Habilitados com nota abaixo de 10</p>
              <p className="text-xl font-semibold">{notaParcial}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Pendências em {municipio?.nome ?? "seu município"}
              </p>
              <p className="text-xl font-semibold">{meuMunicipio.length}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Base: publicação dos habilitados do ICMS Turismo {ano} ({fonte}). O município só entra
            no rateio depois de habilitado pela Secult, com política municipal de turismo, conselho
            e fundo ativos e adesão a um circuito turístico.{" "}
            <a className="underline" href={LINK_HABILITACAO} target="_blank" rel="noreferrer">
              Página oficial do ICMS Turismo
            </a>{" "}
            ·{" "}
            <a className="underline" href={LINK_CIRCUITOS} target="_blank" rel="noreferrer">
              Circuitos turísticos
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
                  `turismo-habilitacao-${ano}-${fonte}.csv`,
                  montarCsv(
                    ["Município", "Situação", "Detalhe", "Link oficial"],
                    filtradas.map((p) => [p.nome, ROTULO[p.situacao], p.detalhe, p.link]),
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
                    <th className="p-2 text-left">Onde resolver</th>
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
                        <Badge variant={p.situacao === "nao_habilitado" ? "outline" : "secondary"}>
                          {ROTULO[p.situacao]}
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
