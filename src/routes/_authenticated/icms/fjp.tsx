import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, ExternalLink, RefreshCw, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useIcmsComparativo, useIcmsExerciciosComparativo } from "@/hooks/useIcms";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { nomeCriterio, normalizarRotulo } from "@/lib/icms/criterios";
import {
  compararMunicipiosFjp,
  listarMunicipiosFjpFn,
} from "@/lib/icms/comparativo.functions";
import { formatarMoeda } from "@/lib/format";
import { baixarCsv, montarCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/icms/fjp")({
  head: () => ({
    meta: [
      { title: "Portal da FJP — valor repassado por critério e município" },
      {
        name: "description",
        content:
          "Consulte no portal Robin Hood da FJP quanto cada município recebeu por critério do ICMS e confira com os valores usados no Comparativo.",
      },
      { property: "og:title", content: "Portal da FJP — valor repassado por critério" },
      {
        property: "og:description",
        content: "Valores oficiais de repasse do ICMS por critério e por município, prontos para conferência.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalFjp,
});

type MunicipioFjp = { id: number; nome: string };
type Resultado = {
  nome: string;
  registros: { criterio: string; mes: number; valor: number | null }[];
  erro: string | null;
};

const PORTAL = "http://www.fjp.mg.gov.br/robin-hood/index.php/transferencia/index2";

function PortalFjp() {
  const { municipio } = useMunicipioAtivo();
  const { data: exercicios } = useIcmsExerciciosComparativo();

  const [lista, setLista] = useState<MunicipioFjp[]>([]);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [anoConsultado, setAnoConsultado] = useState<number | null>(null);

  const { data: gravados } = useIcmsComparativo(anoConsultado);

  useEffect(() => {
    if (exercicios?.length) setAno((a) => (exercicios.includes(a) ? a : (exercicios[0] as number)));
  }, [exercicios]);

  useEffect(() => {
    let vivo = true;
    listarMunicipiosFjpFn()
      .then((r) => {
        if (!vivo) return;
        setLista(r.municipios.map((m) => ({ id: m.id, nome: m.nome })));
        setErroLista(r.erro);
        setCarregandoLista(false);
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        setErroLista(e instanceof Error ? e.message : "portal indisponível");
        setCarregandoLista(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  // o próprio município já entra selecionado
  useEffect(() => {
    if (!municipio?.nome || !lista.length) return;
    const chave = normalizarRotulo(municipio.nome);
    const oficial = lista.find((m) => normalizarRotulo(m.nome) === chave);
    if (oficial) setSelecionados((s) => (s.length ? s : [oficial.nome]));
  }, [lista, municipio?.nome]);

  const filtrados = useMemo(() => {
    const termo = normalizarRotulo(filtro);
    if (!termo) return lista.slice(0, 40);
    return lista.filter((m) => normalizarRotulo(m.nome).includes(termo)).slice(0, 40);
  }, [lista, filtro]);

  function alternar(nome: string) {
    setSelecionados((s) =>
      s.includes(nome) ? s.filter((x) => x !== nome) : s.length >= 15 ? s : [...s, nome],
    );
  }

  async function consultar() {
    const alvos = selecionados
      .map((nome) => lista.find((m) => m.nome === nome))
      .filter((m): m is MunicipioFjp => !!m)
      .map((m) => ({ id: m.id, nome: m.nome }));
    if (!alvos.length) {
      toast.warning("Escolha pelo menos um município.");
      return;
    }
    setBuscando(true);
    try {
      const r = await compararMunicipiosFjp({ data: { exercicio: ano, municipios: alvos } });
      setResultados(r.resultados);
      setAnoConsultado(ano);
      const falhas = r.resultados.filter((x) => !x.registros.length);
      if (falhas.length) {
        toast.warning(`Sem dados no portal para: ${falhas.map((f) => f.nome).join(", ")}.`);
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? `Falha ao consultar a FJP: ${e.message}` : "Portal da FJP indisponível.",
      );
    } finally {
      setBuscando(false);
    }
  }

  /** total anual do portal por critério e município */
  const matriz = useMemo(() => {
    const municipios = resultados.filter((r) => r.registros.length).map((r) => r.nome);
    const porCriterio = new Map<string, Map<string, number>>();
    for (const r of resultados) {
      for (const reg of r.registros) {
        const linha = porCriterio.get(reg.criterio) ?? new Map<string, number>();
        linha.set(r.nome, (linha.get(r.nome) ?? 0) + (reg.valor ?? 0));
        porCriterio.set(reg.criterio, linha);
      }
    }
    const criterios = [...porCriterio.keys()].sort((a, b) =>
      nomeCriterio(a).localeCompare(nomeCriterio(b), "pt-BR"),
    );
    return { municipios, criterios, porCriterio };
  }, [resultados]);

  /** o que o Comparativo já tem gravado, para conferência lado a lado */
  const gravadosMapa = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const l of gravados ?? []) {
      const chave = `${l.criterio}|${normalizarRotulo(l.municipio_nome)}`;
      mapa.set(chave, (mapa.get(chave) ?? 0) + (l.valor ?? 0));
    }
    return mapa;
  }, [gravados]);

  const divergencias = useMemo(() => {
    const linhas: { criterio: string; municipio: string; portal: number; comparativo: number }[] = [];
    for (const criterio of matriz.criterios) {
      for (const mun of matriz.municipios) {
        const portal = matriz.porCriterio.get(criterio)?.get(mun) ?? 0;
        const chave = `${criterio}|${normalizarRotulo(mun)}`;
        if (!gravadosMapa.has(chave)) continue;
        const comparativo = gravadosMapa.get(chave) ?? 0;
        if (Math.abs(portal - comparativo) > 0.5) {
          linhas.push({ criterio, municipio: mun, portal, comparativo });
        }
      }
    }
    return linhas;
  }, [matriz, gravadosMapa]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Portal da FJP</h1>
          <p className="text-sm text-muted-foreground">
            Valor repassado por critério e por município, direto do portal Robin Hood, para conferir
            com o Comparativo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            className="inline-flex items-center gap-1 text-sm text-emerald-700 underline dark:text-emerald-400"
            href={PORTAL}
            target="_blank"
            rel="noreferrer"
          >
            Abrir o portal oficial
            <ExternalLink className="size-3" />
          </a>
          <Button asChild size="sm" variant="outline">
            <Link to="/icms/comparativo">Ir ao Comparativo</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Consulta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={ano}
                min={1991}
                max={2100}
                onChange={(e) => setAno(Number(e.target.value))}
                className="w-28"
              />
              <Button onClick={consultar} disabled={buscando || carregandoLista}>
                <RefreshCw className={`mr-2 size-4 ${buscando ? "animate-spin" : ""}`} />
                {buscando ? "Consultando…" : "Consultar FJP"}
              </Button>
            </div>
            {erroLista && (
              <p className="text-xs text-amber-700">
                Lista de municípios indisponível no portal ({erroLista}). Tente novamente em alguns
                minutos.
              </p>
            )}
            <div className="relative">
              <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar município"
                className="pl-8"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {selecionados.length} selecionado(s) — até 15 por consulta.
            </p>
            <div className="max-h-72 space-y-1 overflow-auto rounded-md border p-2">
              {carregandoLista && <p className="p-2 text-sm text-muted-foreground">Carregando…</p>}
              {filtrados.map((m) => (
                <label key={m.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/60">
                  <Checkbox
                    checked={selecionados.includes(m.nome)}
                    onCheckedChange={() => alternar(m.nome)}
                  />
                  <span>{m.nome}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!matriz.criterios.length && (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Escolha o exercício e os municípios e clique em “Consultar FJP” para ver o valor
                repassado por critério.
              </CardContent>
            </Card>
          )}

          {!!matriz.criterios.length && (
            <Card>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  Repasse por critério em {anoConsultado} (R$)
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    baixarCsv(
                      `fjp-repasse-${anoConsultado}.csv`,
                      montarCsv(
                        ["Critério", ...matriz.municipios],
                        matriz.criterios.map((c) => [
                          nomeCriterio(c),
                          ...matriz.municipios.map((m) =>
                            String(matriz.porCriterio.get(c)?.get(m) ?? 0),
                          ),
                        ]),
                      ),
                    )
                  }
                >
                  <Download className="mr-2 size-4" />
                  CSV
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[32rem] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/60">
                      <tr>
                        <th className="p-2 text-left">Critério</th>
                        {matriz.municipios.map((m) => (
                          <th key={m} className="p-2 text-right">
                            {m}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matriz.criterios.map((c) => (
                        <tr key={c} className="border-t">
                          <td className="p-2">{nomeCriterio(c)}</td>
                          {matriz.municipios.map((m) => (
                            <td key={m} className="p-2 text-right tabular-nums">
                              {formatarMoeda(matriz.porCriterio.get(c)?.get(m) ?? 0)}
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr className="border-t bg-muted/40 font-semibold">
                        <td className="p-2">Total</td>
                        {matriz.municipios.map((m) => (
                          <td key={m} className="p-2 text-right tabular-nums">
                            {formatarMoeda(
                              matriz.criterios.reduce(
                                (soma, c) => soma + (matriz.porCriterio.get(c)?.get(m) ?? 0),
                                0,
                              ),
                            )}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {!!matriz.criterios.length && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Conferência com o Comparativo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {!gravados?.length && (
                  <p className="text-muted-foreground">
                    Ainda não há valores gravados no Comparativo para {anoConsultado}. Sincronize por
                    lá para comparar as duas fontes.
                  </p>
                )}
                {!!gravados?.length && !divergencias.length && (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                    Tudo conferido: os valores do portal batem com o Comparativo.
                  </Badge>
                )}
                {!!divergencias.length && (
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/60">
                        <tr>
                          <th className="p-2 text-left">Critério</th>
                          <th className="p-2 text-left">Município</th>
                          <th className="p-2 text-right">Portal FJP</th>
                          <th className="p-2 text-right">Comparativo</th>
                          <th className="p-2 text-right">Diferença</th>
                        </tr>
                      </thead>
                      <tbody>
                        {divergencias.map((d) => (
                          <tr key={`${d.criterio}-${d.municipio}`} className="border-t">
                            <td className="p-2">{nomeCriterio(d.criterio)}</td>
                            <td className="p-2">{d.municipio}</td>
                            <td className="p-2 text-right tabular-nums">{formatarMoeda(d.portal)}</td>
                            <td className="p-2 text-right tabular-nums">
                              {formatarMoeda(d.comparativo)}
                            </td>
                            <td className="p-2 text-right tabular-nums text-amber-700">
                              {formatarMoeda(d.portal - d.comparativo)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {resultados.some((r) => r.erro) && (
            <Card>
              <CardContent className="p-4 text-xs text-muted-foreground">
                {resultados
                  .filter((r) => r.erro)
                  .map((r) => `${r.nome}: ${r.erro}`)
                  .join(" · ")}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
