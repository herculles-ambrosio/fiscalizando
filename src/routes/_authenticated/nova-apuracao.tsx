import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Building2, CheckCircle2, Loader2, Upload } from "lucide-react";
import { usePerfil } from "@/hooks/usePerfil";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { processarApuracao, type ProgressoEtapa } from "@/lib/vaf/processar";
import {
  conferirMunicipioEntreArquivos,
  detectarMunicipioDosArquivos,
  normalizarCodigoSef,
  type ConferenciaArquivos,
  type MunicipioArquivo,

} from "@/lib/vaf/municipioArquivo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ROTULO_TIPO_RETORNO,
  TIPOS_RETORNO,
  anoDoArquivo,
  anoDoArquivoAtivos,
  rotuloRemessa,
  sugerirTipoRetorno,
  validarCompetencia,

  type TipoRetorno,
} from "@/lib/vaf/tipoRetorno";



export const Route = createFileRoute("/_authenticated/nova-apuracao")({
  head: () => ({
    meta: [
      { title: "Nova apuração VAF" },
      {
        name: "description",
        content:
          "Envie os arquivos de contribuintes ativos e de retorno VAF/DAMEF da SEF-MG para gerar uma nova apuração.",
      },
      { property: "og:title", content: "Nova apuração VAF" },
      {
        property: "og:description",
        content: "Processe os arquivos da SEF-MG e gere a apuração VAF do município.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NovaApuracao,
});

function NovaApuracao() {
  const { data: perfil } = usePerfil();
  const { municipioId, municipio, municipios, podeTrocar, trocar } = useMunicipioAtivo();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [ativos, setAtivos] = useState<File | null>(null);
  const [retorno, setRetorno] = useState<File | null>(null);
  const [tipoRetorno, setTipoRetorno] = useState<TipoRetorno>("mensal");
  const [mesReferencia, setMesReferencia] = useState<number | null>(null);
  const [competenciaMes, setCompetenciaMes] = useState<number | null>(null);
  const [competenciaAno, setCompetenciaAno] = useState<number | null>(null);
  const [limiar, setLimiar] = useState(30);
  const [dataLimite, setDataLimite] = useState("");
  const [progresso, setProgresso] = useState<ProgressoEtapa | null>(null);

  const [erro, setErro] = useState<string | null>(null);

  const [ignorarAlertas, setIgnorarAlertas] = useState(false);
  const [detectada, setDetectada] = useState<{ mes: number | null; ano: number | null }>({
    mes: null,
    ano: null,
  });
  const [motivoAjuste, setMotivoAjuste] = useState("");

  const [municipioArquivo, setMunicipioArquivo] = useState<MunicipioArquivo>({
    codigo: null,
    nome: null,
  });
  const [dialogoPrefeitura, setDialogoPrefeitura] = useState(false);
  const [novaPrefeituraNome, setNovaPrefeituraNome] = useState("");
  const [salvandoPrefeitura, setSalvandoPrefeitura] = useState(false);
  const [erroPrefeitura, setErroPrefeitura] = useState<string | null>(null);

  const processando = progresso !== null && progresso.percentual < 100;

  const [conferencia, setConferencia] = useState<ConferenciaArquivos | null>(null);

  useEffect(() => {
    let cancelado = false;
    if (!ativos && !retorno) {
      setMunicipioArquivo({ codigo: null, nome: null });
      setConferencia(null);
      return;
    }
    detectarMunicipioDosArquivos({ ativos, retorno })
      .then((info) => {
        if (!cancelado) setMunicipioArquivo(info);
      })
      .catch(() => {
        if (!cancelado) setMunicipioArquivo({ codigo: null, nome: null });
      });
    conferirMunicipioEntreArquivos({ ativos, retorno })
      .then((c) => {
        if (!cancelado) setConferencia(c);
      })
      .catch(() => {
        if (!cancelado) setConferencia(null);
      });
    return () => {
      cancelado = true;
    };
  }, [ativos, retorno]);

  const arquivosDeMunicipiosDiferentes = conferencia?.divergente ?? false;
  const codigoArquivo = municipioArquivo.codigo;
  const codigoAtivo = normalizarCodigoSef(municipio?.codigo_sef);
  const municipioDivergente =
    !arquivosDeMunicipiosDiferentes && !!codigoArquivo && !!codigoAtivo && codigoArquivo !== codigoAtivo;
  const municipioCadastrado = codigoArquivo
    ? (municipios.find((m) => normalizarCodigoSef(m.codigo_sef) === codigoArquivo) ?? null)
    : null;
  const rotuloArquivo = municipioArquivo.nome
    ? `${municipioArquivo.nome} (código ${codigoArquivo})`
    : `código ${codigoArquivo}`;


  async function criarPrefeitura() {
    if (!codigoArquivo) return;
    const nome = novaPrefeituraNome.trim();
    if (nome.length < 2) {
      setErroPrefeitura("Informe o nome da prefeitura.");
      return;
    }
    setSalvandoPrefeitura(true);
    setErroPrefeitura(null);
    const { data, error } = await supabase
      .from("municipios")
      .insert({ nome, uf: "MG", codigo_sef: codigoArquivo })
      .select("id")
      .single();
    setSalvandoPrefeitura(false);
    if (error || !data) {
      setErroPrefeitura(
        error?.message ?? "Não foi possível cadastrar a prefeitura. Verifique suas permissões.",
      );
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["municipios"] });
    trocar(data.id);
    setDialogoPrefeitura(false);
  }


  const alertas = useMemo(
    () =>
      validarCompetencia({
        nomeAtivos: ativos?.name ?? null,
        nomeRetorno: retorno?.name ?? null,
        tipoRetorno,
        competenciaMes,
        competenciaAno,
      }),
    [ativos, retorno, tipoRetorno, competenciaMes, competenciaAno],
  );
  const temErroCompetencia = alertas.some((a) => a.nivel === "erro");
  const competenciaAlterada =
    (detectada.mes !== null || detectada.ano !== null) &&
    (competenciaMes !== detectada.mes || competenciaAno !== detectada.ano);
  const precisaMotivo = competenciaAlterada || temErroCompetencia;

  type CargaExistente = {
    id: string;
    exercicio: number;
    criado_em: string;
    tipo_retorno: string;
    competencia_mes: number | null;
    competencia_ano: number | null;
  };
  const [duplicadas, setDuplicadas] = useState<CargaExistente[]>([]);
  const [dialogoDuplicada, setDialogoDuplicada] = useState(false);
  const [substituindo, setSubstituindo] = useState(false);

  async function buscarDuplicadas(municipio: string): Promise<CargaExistente[]> {
    let q = supabase
      .from("cargas")
      .select("id, exercicio, criado_em, tipo_retorno, competencia_mes, competencia_ano")
      .eq("municipio_id", municipio)
      .eq("tipo_retorno", tipoRetorno);
    q = competenciaMes === null ? q.is("competencia_mes", null) : q.eq("competencia_mes", competenciaMes);
    if (competenciaAno !== null) q = q.eq("competencia_ano", competenciaAno);
    const { data, error } = await q;
    if (error) return [];
    return (data ?? []) as CargaExistente[];
  }

  async function excluirCargas(ids: string[]) {
    for (const id of ids) {
      const oficios = await supabase.from("oficios_emitidos").delete().eq("carga_id", id);
      if (oficios.error) throw oficios.error;
      const contribuintes = await supabase
        .from("contribuintes_apurados")
        .delete()
        .eq("carga_id", id);
      if (contribuintes.error) throw contribuintes.error;
      const carga = await supabase.from("cargas").delete().eq("id", id);
      if (carga.error) throw carga.error;
    }
    await queryClient.invalidateQueries({ queryKey: ["cargas"] });
  }

  async function executar(usuarioId: string, municipio: string) {
    setErro(null);
    setProgresso({ etapa: "Iniciando", percentual: 0 });
    try {
      const cargaId = await processarApuracao({
        municipioId: municipio,
        usuarioId,
        arquivoAtivos: ativos!,
        arquivoRetorno: retorno!,
        opcoes: {
          limiarDiscrepancia: limiar / 100,
          dataLimiteEntrega: dataLimite || null,
        },
        tipoRetorno,
        mesReferencia: tipoRetorno === "mensal" ? mesReferencia : null,
        competenciaMes: competenciaMes,
        competenciaAno: competenciaAno,
        competenciaMotivo: precisaMotivo ? motivoAjuste.trim() : null,
        competenciaDetectadaMes: detectada.mes,
        competenciaDetectadaAno: detectada.ano,
        onProgresso: setProgresso,
      });
      navigate({ to: "/cargas/$cargaId", params: { cargaId } });
    } catch (e) {
      setProgresso(null);
      setErro(e instanceof Error ? e.message : "Falha ao processar os arquivos.");
    }
  }

  async function substituirEProcessar() {
    let usuarioId = perfil?.id ?? null;
    if (!usuarioId) {
      const { data } = await supabase.auth.getUser();
      usuarioId = data.user?.id ?? null;
    }
    if (!usuarioId || !municipioId) return;
    setSubstituindo(true);
    try {
      await excluirCargas(duplicadas.map((c) => c.id));
      setDialogoDuplicada(false);
      setDuplicadas([]);
      await executar(usuarioId, municipioId);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao excluir a apuração existente.");
      setDialogoDuplicada(false);
    } finally {
      setSubstituindo(false);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!ativos || !retorno) {
      setErro("Selecione os dois arquivos da SEF-MG.");
      return;
    }
    let usuarioId = perfil?.id ?? null;
    if (!usuarioId) {
      const { data } = await supabase.auth.getUser();
      usuarioId = data.user?.id ?? null;
    }
    if (!usuarioId) {
      setErro("Sessão expirada. Entre novamente para processar a apuração.");
      return;
    }
    if (!municipioId) {
      setErro("Selecione um município antes de processar.");
      return;
    }
    if (arquivosDeMunicipiosDiferentes) {
      setErro(
        `Os arquivos são de municípios diferentes: ativos código ${conferencia?.ativos?.codigo} e retorno código ${conferencia?.retorno?.codigo}. Envie ativos e retorno da mesma prefeitura.`,
      );
      return;
    }
    if (municipioDivergente) {
      setErro(
        `Os arquivos são da prefeitura ${rotuloArquivo} e o município ativo é ${municipio?.nome}. Troque de prefeitura ou cadastre a prefeitura do arquivo antes de processar.`,
      );
      return;
    }

    if (precisaMotivo && motivoAjuste.trim().length < 5) {
      setErro(
        "Informe o motivo da correção manual da competência (mínimo de 5 caracteres) para prosseguir.",
      );
      return;
    }
    const anoAtivos = ativos ? anoDoArquivoAtivos(ativos.name) : null;
    const anoRetorno = retorno ? anoDoArquivo(retorno.name) : null;
    if (anoAtivos && anoRetorno && anoAtivos !== anoRetorno) {
      setErro(
        `O ano do arquivo de contribuintes ativos (${anoAtivos}) difere do ano do arquivo de retorno (${anoRetorno}). Não é possível processar uma apuração com anos diferentes.`,
      );
      return;
    }
    if (temErroCompetencia && !precisaMotivo && !ignorarAlertas) {
      setIgnorarAlertas(true);
      setErro(
        "A competência informada não confere com os arquivos. Revise os alertas ou clique novamente em Processar apuração para continuar assim mesmo.",
      );
      return;
    }

    const existentes = await buscarDuplicadas(municipioId);
    if (existentes.length > 0) {
      setDuplicadas(existentes);
      setDialogoDuplicada(true);
      return;
    }

    await executar(usuarioId, municipioId);
  }


  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nova apuração</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Os arquivos são lidos no seu navegador e apenas o resultado é gravado no sistema.
        </p>
      </div>

      <form onSubmit={enviar}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Arquivos da SEF-MG</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="ativos">Contribuintes ativos (P443AT…)</Label>
              <Input
                id="ativos"
                type="file"
                accept=".txt"
                required
                onChange={(e) => setAtivos(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="retorno">Retorno VAF/DAMEF (P443RT…)</Label>
              <Input
                id="retorno"
                type="file"
                accept=".txt"
                required
                onChange={(e) => {
                  const arquivo = e.target.files?.[0] ?? null;
                  setRetorno(arquivo);
                  if (arquivo) {
                    const sugestao = sugerirTipoRetorno(arquivo.name);
                    setTipoRetorno(sugestao.tipo);
                    setMesReferencia(sugestao.mes);
                    setCompetenciaMes(sugestao.mes ?? null);
                    const anoDetectado = anoDoArquivo(arquivo.name);
                    const mesDetectado = sugestao.mes ?? null;
                    setCompetenciaAno(anoDetectado);
                    setDetectada({ mes: mesDetectado, ano: anoDetectado });
                    setMotivoAjuste("");
                    setIgnorarAlertas(false);
                  }
                }}

              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo-retorno">Tipo de retorno</Label>
              <Select
                value={tipoRetorno}
                onValueChange={(v) => setTipoRetorno(v as TipoRetorno)}
              >
                <SelectTrigger id="tipo-retorno">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_RETORNO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ROTULO_TIPO_RETORNO[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Sugerido pelo nome do arquivo (remessa 13 = índice definitivo). Ajuste se
                necessário.
              </p>
            </div>

            {tipoRetorno === "mensal" && (
              <div className="space-y-2">
                <Label htmlFor="mes-referencia">Remessa (nº do arquivo)</Label>
                <Input
                  id="mes-referencia"
                  type="number"
                  min={1}
                  max={13}
                  value={mesReferencia ?? ""}
                  onChange={(e) =>
                    setMesReferencia(e.target.value ? Number(e.target.value) : null)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Número da entrega feita pela SEF (1 a 13) — não é mês de competência.
                </p>
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="competencia-mes">Remessa do arquivo</Label>
                <Select
                  value={competenciaMes ? String(competenciaMes) : "nenhum"}
                  onValueChange={(v) =>
                    { setIgnorarAlertas(false); setCompetenciaMes(v === "nenhum" ? null : Number(v)); }
                  }
                >
                  <SelectTrigger id="competencia-mes">
                    <SelectValue placeholder="Sem remessa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Sem remessa (anual)</SelectItem>
                    {Array.from({ length: 13 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {rotuloRemessa(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>

                </Select>
                <p className="text-xs text-muted-foreground">
                  O arquivo de retorno não traz mês: 12 e 13 são o nº da entrega, e a 13 é o
                  fechamento do exercício.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="competencia-ano">Ano de entrega do arquivo</Label>
                <Input
                  id="competencia-ano"
                  type="number"
                  min={1990}
                  max={2100}
                  placeholder="Detectado do arquivo"
                  value={competenciaAno ?? ""}
                  onChange={(e) =>
                    { setIgnorarAlertas(false); setCompetenciaAno(e.target.value ? Number(e.target.value) : null); }
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Ano em que a SEF gerou o arquivo. O ano de referência das análises é o exercício
                  detectado no conteúdo.
                </p>
              </div>
            </div>



            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="limiar">Limiar de discrepância (%)</Label>
                <Input
                  id="limiar"
                  type="number"
                  min={1}
                  max={100}
                  value={limiar}
                  onChange={(e) => setLimiar(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Variação do VAF em relação ao exercício anterior.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data-limite">Data limite de entrega</Label>
                <Input
                  id="data-limite"
                  type="date"
                  value={dataLimite}
                  onChange={(e) => setDataLimite(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Em branco, usa 31/05 do ano seguinte ao exercício.
                </p>
              </div>
            </div>

            {arquivosDeMunicipiosDiferentes && conferencia && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Arquivos de municípios diferentes</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    O arquivo de <strong>ativos</strong> é do município de código{" "}
                    <strong>{conferencia.ativos?.codigo ?? "?"}</strong> e o de{" "}
                    <strong>retorno</strong> é do código{" "}
                    <strong>
                      {conferencia.retorno?.codigo ?? "?"}
                      {conferencia.retorno?.nome ? ` — ${conferencia.retorno.nome}` : ""}
                    </strong>
                    . Envie os dois arquivos da mesma prefeitura.
                  </p>
                  {conferencia.evidencias.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Registros que causaram a divergência:</p>
                      <ul className="space-y-1 font-mono text-[11px]">
                        {conferencia.evidencias.map((ev) => (
                          <li key={`${ev.arquivo}-${ev.linha}`} className="truncate">
                            {ev.arquivo} · linha {ev.linha} · registro {ev.registro} · código{" "}
                            {ev.codigo} · {ev.trecho}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {municipioDivergente && (
              <Alert variant="destructive">
                <Building2 className="h-4 w-4" />
                <AlertTitle>Arquivos de outra prefeitura</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>
                    Os arquivos enviados são de <strong>{rotuloArquivo}</strong>, mas a prefeitura
                    ativa é <strong>{municipio?.nome}</strong>. A apuração não será gravada em{" "}
                    {municipio?.nome}.
                  </p>
                  {municipioCadastrado ? (
                    podeTrocar ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => trocar(municipioCadastrado.id)}
                      >
                        Trocar para {municipioCadastrado.nome}
                      </Button>
                    ) : (
                      <p className="text-xs">
                        Essa prefeitura já está cadastrada; peça à consultoria para processar o
                        arquivo nela.
                      </p>
                    )
                  ) : perfil?.ehSuperadmin ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setNovaPrefeituraNome(municipioArquivo.nome ?? "");
                        setErroPrefeitura(null);
                        setDialogoPrefeitura(true);
                      }}
                    >
                      Cadastrar prefeitura {municipioArquivo.nome ?? `código ${codigoArquivo}`}
                    </Button>
                  ) : (
                    <p className="text-xs">
                      Essa prefeitura ainda não está cadastrada. Solicite o cadastro ao
                      administrador.
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {!municipioDivergente && codigoArquivo && municipio && (
              <p className="text-xs text-muted-foreground">
                Arquivos identificados como da prefeitura <strong>{municipio.nome}</strong> (código{" "}
                {codigoArquivo}).
              </p>
            )}


            {(ativos || retorno) && (
              alertas.length === 0 ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Competência validada</AlertTitle>
                  <AlertDescription>
                    A competência confere com os nomes dos arquivos enviados.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant={temErroCompetencia ? "destructive" : "default"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>
                    {temErroCompetencia
                      ? "Competência inconsistente"
                      : "Verifique a competência"}
                  </AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc space-y-1 pl-4">
                      {alertas.map((a) => (
                        <li key={a.mensagem}>{a.mensagem}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )
            )}

            {precisaMotivo && (
              <div className="space-y-2 rounded-lg border border-dashed p-4">
                <Label htmlFor="motivo-competencia">
                  Motivo da correção manual da competência
                </Label>
                <p className="text-xs text-muted-foreground">
                  Detectado no arquivo:{" "}
                  <strong>{formatarCompetencia(detectada.mes, detectada.ano)}</strong> · Informado:{" "}
                  <strong>{formatarCompetencia(competenciaMes, competenciaAno)}</strong>
                </p>
                <Textarea
                  id="motivo-competencia"
                  rows={3}
                  placeholder="Ex.: arquivo renomeado pela prefeitura; a remessa 12 refere-se à competência 11/2026."
                  value={motivoAjuste}
                  onChange={(e) => setMotivoAjuste(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  O motivo fica registrado na apuração junto com a competência detectada
                  automaticamente.
                </p>
              </div>
            )}

            {progresso && (
              <div className="space-y-2">
                <Progress value={progresso.percentual} />
                <p className="text-xs text-muted-foreground">
                  {progresso.etapa} · {progresso.percentual}%
                </p>
              </div>
            )}

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            <Button
              type="submit"
              className="w-full"
              disabled={processando || municipioDivergente || arquivosDeMunicipiosDiferentes}
            >
              {processando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Processar apuração
            </Button>
          </CardContent>
        </Card>
      </form>

      <Dialog open={dialogoPrefeitura} onOpenChange={setDialogoPrefeitura}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar prefeitura</DialogTitle>
            <DialogDescription>
              Detectada nos arquivos a prefeitura de código {codigoArquivo}. Confirme o nome para
              cadastrá-la e usá-la nesta apuração.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nova-prefeitura-nome">Nome do município</Label>
              <Input
                id="nova-prefeitura-nome"
                value={novaPrefeituraNome}
                onChange={(e) => setNovaPrefeituraNome(e.target.value)}
                placeholder="Ex.: Martins Soares"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nova-prefeitura-codigo">Código SEF</Label>
              <Input id="nova-prefeitura-codigo" value={codigoArquivo ?? ""} readOnly />
            </div>
            {erroPrefeitura && <p className="text-sm text-destructive">{erroPrefeitura}</p>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogoPrefeitura(false)}
              disabled={salvandoPrefeitura}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={criarPrefeitura} disabled={salvandoPrefeitura}>
              {salvandoPrefeitura && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cadastrar e usar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogoDuplicada} onOpenChange={setDialogoDuplicada}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Competência já processada</DialogTitle>
            <DialogDescription>
              Já existe apuração de {ROTULO_TIPO_RETORNO[tipoRetorno]} para a competência{" "}
              {formatarCompetencia(competenciaMes, competenciaAno)} neste município. Deseja
              substituir pela nova apuração? A apuração anterior e seus dados serão apagados.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {duplicadas.map((c) => (
              <li key={c.id}>
                Exercício {c.exercicio} · processada em{" "}
                {new Date(c.criado_em).toLocaleString("pt-BR")}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogoDuplicada(false)}
              disabled={substituindo}
            >
              Não, manter a atual
            </Button>
            <Button type="button" onClick={() => void substituirEProcessar()} disabled={substituindo}>
              {substituindo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sim, substituir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );

}
