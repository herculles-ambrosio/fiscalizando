/** Emissão dos documentos de fiscalização de cartório (notificações, intimações e termos). */

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useConfiguracao } from "@/hooks/useConfiguracao";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";

import { useCartorioConfig, useFiscalizacaoCartorio, type Competencia } from "@/hooks/useCartorios";
import { useModelosCartorio } from "@/hooks/useCartorioModelos";
import {
  gerarDocxCartorio,
  gerarZipCartorio,
  nomeArquivoDocCartorio,
} from "@/lib/cartorios/documento";
import { ROTULO_TIPO_DOC, type ModeloCartorio } from "@/lib/cartorios/modelos";
import { MESES_NOME } from "@/lib/cartorios/parser";
import { carregarBrasao, baixarBlob } from "@/lib/oficios/pacote";
import { hojeIso } from "@/lib/oficios/texto";
import { formatarMoeda } from "@/lib/format";

type Filtro = "diferenca" | "sem_declaracao" | "nao_pago" | "todos";

const FILTRO_DO_TIPO: Partial<Record<string, Filtro>> = { DIFERENCA: "diferenca", SEM_DECLARACAO: "sem_declaracao", NAO_PAGO: "nao_pago" };

export default function DocumentosView({ competencia }: { competencia: Competencia | null }) {
  const { data: config } = useConfiguracao();
  const { municipio } = useMunicipioAtivo();

  const { data: cartorioConfig } = useCartorioConfig();
  const { data: linhas } = useFiscalizacaoCartorio(competencia);
  const { data: modelos } = useModelosCartorio();

  const aliquota = cartorioConfig?.aliquota_iss ?? 5;
  const [chaveModelo, setChaveModelo] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("diferenca");
  const [prazo, setPrazo] = useState("30");
  const [data, setData] = useState(hojeIso());
  const [marcados, setMarcados] = useState<string[]>([]);
  const [gerando, setGerando] = useState(false);
  const [previaBlob, setPreviaBlob] = useState<Blob | null>(null);
  const previaRef = useRef<HTMLDivElement | null>(null);

  const modelo: ModeloCartorio | undefined = useMemo(
    () => modelos?.find((m) => m.chave === chaveModelo) ?? modelos?.[0],
    [modelos, chaveModelo],
  );

  useEffect(() => {
    if (!chaveModelo && modelos?.length) setChaveModelo(modelos[0]!.chave);
  }, [modelos, chaveModelo]);

  const candidatos = useMemo(() => {
    const l = linhas ?? [];
    if (filtro === "diferenca") return l.filter((x) => (x.diferencaIss ?? 0) > 0.5);
    if (filtro === "sem_declaracao") return l.filter((x) => !x.temDeclaracao);
    if (filtro === "nao_pago")
      return l.filter((x) => x.temDeclaracao && (x.issPago ?? 0) < 0.01 && Math.max(x.issDeclarado ?? 0, x.issDevido) > 0.5);
    return l;
  }, [linhas, filtro]);

  useEffect(() => {
    setMarcados(candidatos.map((c) => `${c.cns}|${c.tipoServico}`));
  }, [candidatos]);

  useEffect(() => {
    if (!previaBlob || !previaRef.current) return;
    let cancelado = false;
    const destino = previaRef.current;
    void (async () => {
      const { renderAsync } = await import("docx-preview");
      if (cancelado) return;
      destino.innerHTML = "";
      await renderAsync(previaBlob, destino, undefined, {
        className: "docx",
        inWrapper: true,
        ignoreHeight: true,
        ignoreWidth: false,
      });
    })();
    return () => {
      cancelado = true;
    };
  }, [previaBlob]);

  const selecionados = useMemo(
    () => candidatos.filter((c) => marcados.includes(`${c.cns}|${c.tipoServico}`)),
    [candidatos, marcados],
  );

  function faltaConfig(): boolean {
    if (!config?.nome_prefeitura || !config.cidade_data) {
      toast.error("Preencha os dados da prefeitura em Configurações antes de emitir.");
      return true;
    }
    if (!competencia) {
      toast.error("Escolha o mês na parte de cima da tela.");
      return true;
    }
    if (!modelo) {
      toast.error("Nenhum modelo disponível.");
      return true;
    }
    return false;
  }

  async function verPrevia() {
    if (faltaConfig()) return;
    const linha = selecionados[0] ?? candidatos[0];
    if (!linha) {
      toast.error("Nenhum cartório na lista para a prévia.");
      return;
    }
    setGerando(true);
    try {
      const brasao = await carregarBrasao(config!.brasao_path);
      const blob = await gerarDocxCartorio({
        modelo: modelo!,
        linha,
        competencia: competencia!,
        aliquota,
        prazoDias: Number(prazo) || 30,
        config: config!,
        dataDocumento: data,
        brasao,
      });
      setPreviaBlob(blob);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar a prévia.");
    } finally {
      setGerando(false);
    }
  }

  async function emitir() {
    if (faltaConfig()) return;
    if (!selecionados.length) {
      toast.error("Selecione ao menos um cartório.");
      return;
    }
    setGerando(true);
    try {
      const brasao = await carregarBrasao(config!.brasao_path);
      const documentos: { nome: string; blob: Blob }[] = [];
      for (const linha of selecionados) {
        const blob = await gerarDocxCartorio({
          modelo: modelo!,
          linha,
          competencia: competencia!,
          aliquota,
          prazoDias: Number(prazo) || 30,
          config: config!,
          dataDocumento: data,
          brasao,
        });
        documentos.push({
          nome: nomeArquivoDocCartorio(modelo!.chave, linha.cns, linha.nome, competencia!),
          blob: blob,
        });
      }
      const mes = String(competencia!.mes).padStart(2, "0");
      if (documentos.length === 1) {
        baixarBlob(documentos[0]!.blob, documentos[0]!.nome);
      } else {
        const zip = await gerarZipCartorio(documentos);
        baixarBlob(zip, `documentos_cartorio_${modelo!.chave}_${mes}${competencia!.ano}.zip`);
      }
      toast.success(`${documentos.length} documento(s) gerado(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar os documentos.");
    } finally {
      setGerando(false);
    }
  }

  const totalDiferenca = selecionados.reduce((s, x) => s + Math.max(x.diferencaIss ?? 0, 0), 0);

  const semAcento = (t: string) =>
    t
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const nomeCabecalho = config?.nome_prefeitura ?? "";
  const cabecalhoDivergente =
    !!nomeCabecalho &&
    !!municipio?.nome &&
    !semAcento(nomeCabecalho).includes(semAcento(municipio.nome));

  return (
    <div className="space-y-4">
      {!config?.nome_prefeitura && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Os dados de prefeitura, brasão, assinatura e rodapé destes documentos vêm da tela
          Configurações. Preencha-a antes de emitir.
        </p>
      )}

      {cabecalhoDivergente && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Atenção: o cabeçalho salvo é de “{nomeCabecalho}”, mas a prefeitura ativa é{" "}
          {municipio?.nome}. Corrija os dados na tela Configurações antes de emitir os documentos.
        </p>
      )}


      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documento a emitir</CardTitle>
          <p className="text-sm text-muted-foreground">
            {competencia
              ? `Competência ${MESES_NOME[competencia.mes - 1]} de ${competencia.ano} — alíquota de ${aliquota}%.`
              : "Escolha o mês na parte de cima da tela."}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label>Modelo</Label>
              <Select value={modelo?.chave ?? ""} onValueChange={(v) => {
                setChaveModelo(v);
                const f = FILTRO_DO_TIPO[modelos?.find((m) => m.chave === v)?.tipo ?? ""];
                if (f) setFiltro(f);
              }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Modelo" />
                </SelectTrigger>
                <SelectContent>
                  {(modelos ?? [])
                    .filter((m) => m.ativo)
                    .map((m) => (
                      <SelectItem key={m.chave} value={m.chave}>
                        {m.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Quem recebe</Label>
              <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diferenca">Com ISS a menor</SelectItem>
                  <SelectItem value="sem_declaracao">Sem declaração no mês</SelectItem>
                  <SelectItem value="nao_pago">Declarou e não pagou o ISS</SelectItem>
                  <SelectItem value="todos">Todos os cartórios do mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Prazo (dias)</Label>
              <Input
                className="h-9"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1">
              <Label>Data do documento</Label>
              <Input
                className="h-9"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
          </div>

          {modelo && (
            <p className="text-xs text-muted-foreground">
              <Badge variant="secondary" className="mr-2">
                {ROTULO_TIPO_DOC[modelo.tipo]}
              </Badge>
              {selecionados.length} cartório(s) selecionado(s) — diferença somada de{" "}
              {formatarMoeda(totalDiferenca)}.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void emitir()} disabled={gerando || !selecionados.length}>
              {gerando ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Download className="mr-2 size-4" />
              )}
              Gerar documentos
            </Button>
            <Button variant="outline" onClick={() => void verPrevia()} disabled={gerando}>
              <Eye className="mr-2 size-4" />
              Ver prévia
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" />
            Cartórios
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setMarcados(
                marcados.length === candidatos.length
                  ? []
                  : candidatos.map((c) => `${c.cns}|${c.tipoServico}`),
              )
            }
          >
            {marcados.length === candidatos.length ? "Desmarcar todos" : "Marcar todos"}
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Serventia</TableHead>
                <TableHead className="text-right">Emolumentos</TableHead>
                <TableHead className="text-right">ISS devido</TableHead>
                <TableHead className="text-right">ISS pago</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidatos.map((l) => {
                const id = `${l.cns}|${l.tipoServico}`;
                return (
                  <TableRow key={id}>
                    <TableCell>
                      <Checkbox
                        checked={marcados.includes(id)}
                        onCheckedChange={(v) =>
                          setMarcados((m) => (v ? [...m, id] : m.filter((x) => x !== id)))
                        }
                        aria-label={`Selecionar ${l.nome}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{l.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        CNS {l.cns}
                        {l.tipoServico ? ` — ${l.tipoServico}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatarMoeda(l.emolumentos)}</TableCell>
                    <TableCell className="text-right">{formatarMoeda(l.issDevido)}</TableCell>
                    <TableCell className="text-right">
                      {l.temDeclaracao ? (
                        formatarMoeda(l.issPago ?? 0)
                      ) : (
                        <Badge variant="secondary">sem declaração</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatarMoeda(l.diferencaIss ?? l.issDevido)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!candidatos.length && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum cartório nesta situação no mês selecionado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {previaBlob && (
        <div
          ref={previaRef}
          className="max-h-[60vh] overflow-auto rounded-md border bg-muted/30 p-2 [&_.docx-wrapper]:bg-transparent [&_.docx-wrapper]:p-0 [&_.docx-wrapper>section.docx]:mx-auto [&_.docx-wrapper>section.docx]:shadow-sm"
        />
      )}
    </div>
  );
}
