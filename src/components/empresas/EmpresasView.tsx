import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, Download, FileArchive, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { usePerfil } from "@/hooks/usePerfil";
import { useCadastroContribuintes } from "@/hooks/useCadastroContribuintes";
import { useEmpresas, type Empresa } from "@/hooks/useEmpresas";
import { enriquecerEmpresas } from "@/lib/empresas/empresas.functions";
import { atividadeExigeIe, ROTULO_TIPO, type TipoEmpresa } from "@/lib/empresas/extrair";
import { filtrarEstabelecimentos, lerMunicipiosReceita } from "@/lib/empresas/baseReceita";
import { limparCnpj } from "@/lib/receita/normalizar";
import { formatarCnpj, formatarData } from "@/lib/format";
import { formatarCodigoCnae, descricaoCnae } from "@/lib/vaf/cnae";
import { baixarCsv, montarCsv } from "@/lib/csv";
import { SituacaoReceitaBadge } from "@/components/SituacaoReceitaBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const tipoDe = (e: Empresa) => (e.tipo_manual ?? e.tipo_auto) as TipoEmpresa;

function alertas(e: Empresa): string[] {
  const a: string[] = [];
  if (tipoDe(e) === "MEI" && e.cnaes_secundarios.length > 15) a.push("MEI com muitas atividades");
  if (e.situacao === "ATIVA" && !e.inscricao_estadual && atividadeExigeIe(e.cnae_principal))
    a.push("Comércio/indústria sem IE");
  if ((e.situacao === "BAIXADA" || e.situacao === "INAPTA" || e.situacao === "NULA") && e.inscricao_estadual)
    a.push("Encerrada na Receita, com IE na SEF");
  return a;
}

const COR_TIPO: Record<TipoEmpresa, string> = {
  MEI: "bg-primary/10 text-primary border-primary/30",
  SIMPLES: "bg-normal text-normal-foreground border-normal-foreground/20",
  OUTRO: "bg-muted text-foreground border-border",
  NAO_CLASSIFICADO: "bg-muted text-muted-foreground border-dashed border-border",
};

export function EmpresasView() {
  const { municipioId, municipio } = useMunicipioAtivo();
  const { data: perfil } = usePerfil();
  const { data: empresas = [], isLoading } = useEmpresas(municipioId);
  const { data: cadastro } = useCadastroContribuintes(municipioId);
  const enriquecer = useServerFn(enriquecerEmpresas);
  const qc = useQueryClient();

  const [progresso, setProgresso] = useState<{ rotulo: string; feito: number; total: number } | null>(null);
  const [busca, setBusca] = useState("");
  const [fTipo, setFTipo] = useState("todos");
  const [fSit, setFSit] = useState("todos");
  const [fIe, setFIe] = useState("todos");
  const [fAlerta, setFAlerta] = useState(false);
  const [detalhe, setDetalhe] = useState<Empresa | null>(null);
  const [baseAberta, setBaseAberta] = useState(false);
  const [listaAberta, setListaAberta] = useState(false);
  const [textoLista, setTextoLista] = useState("");
  const cnpjsLista = useMemo(
    () => [...new Set((textoLista.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g) ?? []).map((c) => c.replace(/\D/g, "")))],
    [textoLista],
  );

  const iePorCnpj = useMemo(() => {
    const m = new Map<string, string>();
    for (const [ie, c] of Object.entries(cadastro ?? {})) {
      const cnpj = limparCnpj(c.cnpj);
      if (cnpj && !m.has(cnpj)) m.set(cnpj, ie);
    }
    return m;
  }, [cadastro]);

  async function processar(lista: { cnpj: string; ie?: string | null; origem?: string }[], rotulo: string) {
    if (!municipioId || !lista.length) {
      toast.info("Nada para consultar.");
      return;
    }
    let ok = 0;
    let falhas = 0;
    setProgresso({ rotulo, feito: 0, total: lista.length });
    try {
      for (let i = 0; i < lista.length; i += 40) {
        const r = await enriquecer({ data: { municipioId, empresas: lista.slice(i, i + 40) } });
        ok += r.atualizados;
        falhas += r.falhas;
        setProgresso({ rotulo, feito: Math.min(i + 40, lista.length), total: lista.length });
      }
      toast.success(`${ok} empresa(s) atualizadas${falhas ? ` · ${falhas} sem resposta (tente de novo)` : ""}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na consulta.");
    } finally {
      setProgresso(null);
      void qc.invalidateQueries({ queryKey: ["empresas", municipioId] });
    }
  }

  function importarSef(forcar: boolean) {
    const ja = new Set(empresas.filter((e) => e.consultado_em && !e.erro_consulta).map((e) => e.cnpj));
    const lista = [...iePorCnpj.entries()]
      .filter(([cnpj]) => forcar || !ja.has(cnpj))
      .map(([cnpj, ie]) => ({ cnpj, ie, origem: "sef" }));
    void processar(lista, "Importando do cadastro da SEF");
  }

  function completarPendentes() {
    const lista = empresas
      .filter((e) => !e.consultado_em || e.erro_consulta)
      .map((e) => ({ cnpj: e.cnpj, ie: e.inscricao_estadual, origem: e.origem }));
    void processar(lista, "Completando dados na Receita");
  }

  async function mudarTipo(e: Empresa, tipo: string) {
    const valor = tipo === "auto" ? null : tipo;
    const { error } = await supabase
      .from("empresas")
      .update({ tipo_manual: valor, tipo_manual_por: valor ? perfil?.id ?? null : null, tipo_manual_em: valor ? new Date().toISOString() : null })
      .eq("id", e.id);
    if (error) { toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: ["empresas", municipioId] });
    setDetalhe((d) => (d && d.id === e.id ? { ...d, tipo_manual: valor } : d));
  }

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qd = q.replace(/\D/g, "");
    return empresas.filter((e) => {
      if (fTipo !== "todos" && tipoDe(e) !== fTipo) return false;
      if (fSit !== "todos" && (e.situacao ?? "NAO") !== fSit) return false;
      if (fIe === "com" && !e.inscricao_estadual) return false;
      if (fIe === "sem" && e.inscricao_estadual) return false;
      if (fAlerta && !alertas(e).length) return false;
      if (q) {
        const alvo = `${e.razao_social ?? ""} ${e.nome_fantasia ?? ""} ${e.bairro ?? ""} ${e.cnae_descricao ?? ""}`.toLowerCase();
        if (!alvo.includes(q) && !(qd && (e.cnpj.includes(qd) || e.cnae_principal?.includes(qd)))) return false;
      }
      return true;
    });
  }, [empresas, busca, fTipo, fSit, fIe, fAlerta]);

  const totais = useMemo(() => {
    const t: Record<string, number> = { MEI: 0, SIMPLES: 0, OUTRO: 0, NAO_CLASSIFICADO: 0, ATIVA: 0, alertas: 0 };
    for (const e of empresas) {
      t[tipoDe(e)] = (t[tipoDe(e)] ?? 0) + 1;
      if (e.situacao === "ATIVA") t["ATIVA"]! += 1;
      if (alertas(e).length) t["alertas"]! += 1;
    }
    return t;
  }, [empresas]);

  function exportar() {
    const cab = ["CNPJ", "Razão social", "Nome fantasia", "Inscrição estadual", "Tipo", "Situação", "Data situação", "Simples", "MEI", "CNAE", "Atividade", "Endereço", "Bairro", "CEP", "E-mail", "Telefone", "Origem", "Alertas"];
    const linhas = filtradas.map((e) => [
      formatarCnpj(e.cnpj), e.razao_social, e.nome_fantasia, e.inscricao_estadual, ROTULO_TIPO[tipoDe(e)], e.situacao, e.situacao_data,
      e.opcao_simples == null ? "" : e.opcao_simples ? "Sim" : "Não", e.opcao_mei == null ? "" : e.opcao_mei ? "Sim" : "Não",
      formatarCodigoCnae(e.cnae_principal), e.cnae_descricao ?? descricaoCnae(e.cnae_principal),
      [e.logradouro, e.numero, e.complemento].filter(Boolean).join(", "), e.bairro, e.cep, e.email, e.telefone,
      e.origem === "sef" ? "Cadastro SEF" : e.origem === "lista" ? "Lista de CNPJs" : "Base Receita", alertas(e).join("; "),
    ]);
    baixarCsv(`empresas-${municipio?.nome ?? "municipio"}.csv`, montarCsv(cab, linhas));
  }

  if (!municipioId) return <p className="p-8 text-sm text-muted-foreground">Selecione a prefeitura ativa.</p>;

  const pendentes = empresas.filter((e) => !e.consultado_em || e.erro_consulta).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Empresas — {municipio?.nome}</h1>
          <p className="text-sm text-muted-foreground">
            Dados da Receita Federal (dados abertos do CNPJ), com inscrição estadual cruzada do cadastro da SEF.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setListaAberta(true)} disabled={!!progresso}>
            <Search className="mr-2 h-4 w-4" /> Importar lista de CNPJs
          </Button>
          <Button
            onClick={() => importarSef(false)}
            disabled={!!progresso || !iePorCnpj.size}
            title={iePorCnpj.size ? undefined : "Esta prefeitura não tem arquivo da SEF carregado. Use a base da Receita ou uma lista de CNPJs."}
          >
            <Building2 className="mr-2 h-4 w-4" /> Importar do cadastro da SEF ({iePorCnpj.size})
          </Button>
          <Button variant="outline" onClick={() => setBaseAberta(true)} disabled={!!progresso}>
            <FileArchive className="mr-2 h-4 w-4" /> Importar base da Receita
          </Button>
          <Button variant="outline" onClick={completarPendentes} disabled={!!progresso || !pendentes}>
            <RefreshCw className="mr-2 h-4 w-4" /> Completar na Receita ({pendentes})
          </Button>
          <Button variant="ghost" onClick={() => importarSef(true)} disabled={!!progresso}>
            Reconsultar todas do cadastro
          </Button>
        </div>
      </div>

      {progresso && (
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-2 text-sm">{progresso.rotulo}: {progresso.feito} de {progresso.total}</p>
          <Progress value={(progresso.feito / progresso.total) * 100} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {[
          ["Total", empresas.length, "todos"],
          ["MEI", totais["MEI"], "MEI"],
          ["Simples Nacional", totais["SIMPLES"], "SIMPLES"],
          ["Outro", totais["OUTRO"], "OUTRO"],
          ["Não classificado", totais["NAO_CLASSIFICADO"], "NAO_CLASSIFICADO"],
        ].map(([r, n, t]) => (
          <button
            key={r as string}
            onClick={() => setFTipo(t as string)}
            className={cn("rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary", fTipo === t && "border-primary")}
          >
            <p className="text-xs text-muted-foreground">{r}</p>
            <p className="font-display text-2xl font-semibold">{(n as number).toLocaleString("pt-BR")}</p>
          </button>
        ))}
        <button
          onClick={() => setFAlerta((v) => !v)}
          className={cn("rounded-xl border bg-card p-4 text-left hover:border-destructive", fAlerta && "border-destructive")}
        >
          <p className="text-xs text-muted-foreground">Para fiscalizar</p>
          <p className="font-display text-2xl font-semibold text-destructive">{totais["alertas"]}</p>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Nome, CNPJ, bairro ou atividade" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={fTipo} onValueChange={setFTipo}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(ROTULO_TIPO).map(([k, r]) => <SelectItem key={k} value={k}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fSit} onValueChange={setFSit}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
            {["ATIVA", "SUSPENSA", "INAPTA", "BAIXADA", "NULA"].map((s) => <SelectItem key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fIe} onValueChange={setFIe}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Com e sem IE</SelectItem>
            <SelectItem value="com">Com inscrição estadual</SelectItem>
            <SelectItem value="sem">Sem inscrição estadual</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportar} disabled={!filtradas.length}>
          <Download className="mr-2 h-4 w-4" /> CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Empresa</th><th className="p-3">CNPJ / IE</th><th className="p-3">Tipo</th>
              <th className="p-3">Situação</th><th className="p-3">Atividade</th><th className="p-3">Endereço</th><th className="p-3">Fiscalização</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>}
            {!isLoading && !filtradas.length && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">
                {empresas.length ? "Nenhuma empresa com estes filtros." : "Nenhuma empresa importada. Use “Importar do cadastro da SEF” ou “Importar base da Receita”."}
              </td></tr>
            )}
            {filtradas.slice(0, 500).map((e) => (
              <tr key={e.id} className="cursor-pointer border-t hover:bg-muted/30" onClick={() => setDetalhe(e)}>
                <td className="p-3">
                  <p className="font-medium">{e.razao_social ?? e.nome_fantasia ?? "—"}</p>
                  {e.nome_fantasia && e.razao_social && <p className="text-xs text-muted-foreground">{e.nome_fantasia}</p>}
                </td>
                <td className="p-3 whitespace-nowrap">
                  <p>{formatarCnpj(e.cnpj)}</p>
                  <p className="text-xs text-muted-foreground">IE {e.inscricao_estadual ?? "—"}</p>
                </td>
                <td className="p-3">
                  <span className={cn("rounded-full border px-2 py-0.5 text-xs whitespace-nowrap", COR_TIPO[tipoDe(e)])}>
                    {ROTULO_TIPO[tipoDe(e)]}{e.tipo_manual ? " *" : ""}
                  </span>
                </td>
                <td className="p-3">
                  <SituacaoReceitaBadge situacao={e.situacao} motivo={e.situacao_data ? `Desde ${formatarData(e.situacao_data)}` : e.erro_consulta} />
                </td>
                <td className="max-w-64 p-3 text-xs">{formatarCodigoCnae(e.cnae_principal)} {e.cnae_descricao ?? descricaoCnae(e.cnae_principal) ?? ""}</td>
                <td className="max-w-56 p-3 text-xs">{[e.logradouro, e.numero].filter(Boolean).join(", ")}{e.bairro ? ` — ${e.bairro}` : ""}</td>
                <td className="p-3 text-xs text-destructive">{alertas(e).join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtradas.length > 500 && (
          <p className="border-t p-3 text-xs text-muted-foreground">Mostrando 500 de {filtradas.length}. Refine os filtros ou exporte o CSV.</p>
        )}
      </div>

      <Dialog open={listaAberta} onOpenChange={setListaAberta}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Importar lista de CNPJs</DialogTitle>
            <DialogDescription>
              Cole os CNPJs (de uma planilha do ISS, alvarás, JUCEMG etc.) ou envie um arquivo CSV/TXT. O sistema consulta cada um na Receita.
            </DialogDescription>
          </DialogHeader>
          <Input type="file" accept=".csv,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) void f.text().then(setTextoLista); }} />
          <textarea
            className="min-h-40 w-full rounded-md border bg-background p-2 text-sm"
            placeholder="00.000.000/0001-91"
            value={textoLista}
            onChange={(e) => setTextoLista(e.target.value)}
          />
          <Button
            disabled={!cnpjsLista.length}
            onClick={() => {
              setListaAberta(false);
              void processar(cnpjsLista.map((cnpj) => ({ cnpj, ie: iePorCnpj.get(cnpj) ?? null, origem: "lista" })), "Importando lista de CNPJs");
            }}
          >
            Consultar {cnpjsLista.length} CNPJ(s)
          </Button>
        </DialogContent>
      </Dialog>

      <DetalheEmpresa empresa={detalhe} onClose={() => setDetalhe(null)} onTipo={mudarTipo} onReconsultar={(e) => void processar([{ cnpj: e.cnpj, ie: e.inscricao_estadual, origem: e.origem }], "Reconsultando")} />
      <ImportarBase
        aberto={baseAberta}
        onClose={() => setBaseAberta(false)}
        municipioId={municipioId}
        municipioNome={municipio?.nome ?? ""}
        iePorCnpj={iePorCnpj}
        aoConcluir={() => void qc.invalidateQueries({ queryKey: ["empresas", municipioId] })}
      />
    </div>
  );
}

function DetalheEmpresa({ empresa: e, onClose, onTipo, onReconsultar }: {
  empresa: Empresa | null; onClose: () => void; onTipo: (e: Empresa, t: string) => void; onReconsultar: (e: Empresa) => void;
}) {
  const sn = (b: boolean | null) => (b == null ? "—" : b ? "Sim" : "Não");
  return (
    <Dialog open={!!e} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        {e && (
          <>
            <DialogHeader>
              <DialogTitle>{e.razao_social ?? e.nome_fantasia ?? formatarCnpj(e.cnpj)}</DialogTitle>
              <DialogDescription>{formatarCnpj(e.cnpj)} · IE {e.inscricao_estadual ?? "não encontrada no cadastro da SEF"}</DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {[
                ["Nome fantasia", e.nome_fantasia],
                ["Situação", `${e.situacao ?? "Não consultada"}${e.situacao_data ? ` desde ${formatarData(e.situacao_data)}` : ""}`],
                ["Motivo", e.motivo],
                ["Início da atividade", formatarData(e.data_inicio)],
                ["Simples Nacional", `${sn(e.opcao_simples)}${e.data_opcao_simples ? ` (desde ${formatarData(e.data_opcao_simples)})` : ""}${e.data_exclusao_simples ? ` · excluída ${formatarData(e.data_exclusao_simples)}` : ""}`],
                ["MEI", `${sn(e.opcao_mei)}${e.data_opcao_mei ? ` (desde ${formatarData(e.data_opcao_mei)})` : ""}${e.data_exclusao_mei ? ` · excluído ${formatarData(e.data_exclusao_mei)}` : ""}`],
                ["Natureza jurídica", e.natureza_juridica],
                ["Porte", e.porte],
                ["Atividade principal", `${formatarCodigoCnae(e.cnae_principal)} ${e.cnae_descricao ?? descricaoCnae(e.cnae_principal) ?? ""}`],
                ["Atividades secundárias", e.cnaes_secundarios.map(formatarCodigoCnae).join(", ") || "—"],
                ["Endereço", [e.logradouro, e.numero, e.complemento].filter(Boolean).join(", ")],
                ["Bairro / CEP", `${e.bairro ?? "—"} · ${e.cep ?? "—"}`],
                ["Município", `${e.municipio_nome ?? "—"}/${e.uf ?? ""}`],
                ["E-mail", e.email],
                ["Telefone", e.telefone],
                ["Origem", `${e.origem === "sef" ? "Cadastro da SEF" : e.origem === "lista" ? "Lista de CNPJs" : "Base completa da Receita"}${e.referencia_base ? ` (${e.referencia_base})` : ""}`],
                ["Última consulta", e.consultado_em ? `${new Date(e.consultado_em).toLocaleString("pt-BR")} · ${e.fonte ?? ""}` : "Nunca"],
              ].map(([r, v]) => (
                <div key={r} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{r}</dt>
                  <dd className="break-words">{v || "—"}</dd>
                </div>
              ))}
            </dl>
            {alertas(e).length > 0 && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{alertas(e).join(" · ")}</p>}
            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <span className="text-sm">Classificação:</span>
              <Select value={e.tipo_manual ?? "auto"} onValueChange={(t) => onTipo(e, t)}>
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automática ({ROTULO_TIPO[e.tipo_auto as TipoEmpresa]})</SelectItem>
                  <SelectItem value="MEI">MEI</SelectItem>
                  <SelectItem value="SIMPLES">Simples Nacional</SelectItem>
                  <SelectItem value="OUTRO">Outro</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="ml-auto" onClick={() => onReconsultar(e)}>
                <RefreshCw className="mr-2 h-4 w-4" /> Reconsultar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ImportarBase({ aberto, onClose, municipioId, municipioNome, iePorCnpj, aoConcluir }: {
  aberto: boolean; onClose: () => void; municipioId: string; municipioNome: string; iePorCnpj: Map<string, string>; aoConcluir: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [referencia, setReferencia] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  // A Receita migrou os dados abertos para um compartilhamento público (Nextcloud).
  const COMPARTILHAMENTO = "https://arquivos.receitafederal.gov.br/index.php/s/gn672Ad4CF8N6TK";
  const pasta = `${COMPARTILHAMENTO}?dir=/Dados/Cadastros/CNPJ/${referencia}`;
  const baixar = (arquivo: string) =>
    `${COMPARTILHAMENTO}/download?path=/Dados/Cadastros/CNPJ/${referencia}&files=${arquivo}`;
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [estado, setEstado] = useState<string | null>(null);
  const [pct, setPct] = useState(0);
  const [lendo, setLendo] = useState(false);

  async function lerMunicipios(f: File) {
    setEstado("Lendo a tabela de municípios…");
    const mapa = await lerMunicipiosReceita(f);
    const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    const alvo = norm(municipioNome);
    // A tabela não traz UF; vários municípios homônimos existem — confira o código.
    const achados = [...mapa.entries()].filter(([, n]) => norm(n) === alvo);
    if (achados.length === 1) {
      setCodigo(achados[0]![0]);
      setEstado(`Código encontrado: ${achados[0]![0]}.`);
    } else if (achados.length > 1) {
      setEstado(`Há ${achados.length} municípios com esse nome (${achados.map((a) => a[0]).join(", ")}). Informe o de Minas Gerais.`);
    } else setEstado("Município não encontrado na tabela; informe o código manualmente.");
  }

  async function importar() {
    if (!/^\d{4}$/.test(codigo)) { toast.error("Informe o código do município na Receita (4 dígitos)."); return; }
    if (!arquivos.length) { toast.error("Selecione os arquivos de Estabelecimentos."); return; }
    setLendo(true);
    let total = 0;
    try {
      for (const [i, f] of arquivos.entries()) {
        const achados = await filtrarEstabelecimentos(f, codigo, (lidos, tam, n) => {
          setPct(((i + lidos / tam) / arquivos.length) * 100);
          setEstado(`Arquivo ${i + 1} de ${arquivos.length} (${f.name}): ${n} empresa(s) do município`);
        });
        for (let j = 0; j < achados.length; j += 500) {
          const lote = achados.slice(j, j + 500).map((a) => ({
            ...a,
            municipio_id: municipioId,
            situacao_data: a.situacao_data,
            inscricao_estadual: iePorCnpj.get(a.cnpj) ?? null,
            origem: "base_receita",
            referencia_base: referencia || null,
            municipio_nome: municipioNome,
          }));
          const { error } = await supabase.from("empresas").upsert(lote, { onConflict: "municipio_id,cnpj" });
          if (error) throw error;
        }
        total += achados.length;
      }
      toast.success(`${total} empresa(s) da base da Receita gravadas. Use “Completar na Receita” para trazer Simples/MEI e razão social.`);
      aoConcluir();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ler o arquivo.");
    } finally {
      setLendo(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !lendo && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Importar base completa da Receita</DialogTitle>
          <DialogDescription>
            Baixe os arquivos <b>Estabelecimentos0.zip</b> a <b>Estabelecimentos9.zip</b> (e o <b>Municipios.zip</b>) em{" "}
            <a className="underline" href="https://arquivos.receitafederal.gov.br/index.php/s/gn672Ad4CF8N6TK?dir=/Dados/Cadastros/CNPJ" target="_blank" rel="noreferrer">
              dados abertos do CNPJ
            </a>{" "}
            e selecione aqui. O navegador lê os arquivos e guarda só as empresas de {municipioNome}. Mantenha a tela aberta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-medium">Baixar da Receita — mês</span>
              <Input type="month" className="h-8 w-40" value={referencia} onChange={(e) => setReferencia(e.target.value)} disabled={lendo} />
              <a className="ml-auto text-xs underline" href={pasta} target="_blank" rel="noreferrer">Abrir pasta do mês</a>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              Clique para baixar (cada arquivo tem algumas centenas de MB). Se o mês ainda não foi publicado, escolha o mês anterior.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <a className="rounded-md border bg-card px-2 py-1 text-xs hover:border-primary" href={baixar("Municipios.zip")} target="_blank" rel="noreferrer">Municipios.zip</a>
              {Array.from({ length: 10 }, (_, n) => (
                <a key={n} className="rounded-md border bg-card px-2 py-1 text-xs hover:border-primary" href={baixar(`Estabelecimentos${n}.zip`)} target="_blank" rel="noreferrer">
                  Estabelecimentos{n}.zip
                </a>
              ))}
            </div>
          </div>
          <label className="block space-y-1">
            <span>1. Tabela de municípios (opcional, encontra o código)</span>
            <Input type="file" accept=".zip,.csv,.MUNICCSV" disabled={lendo} onChange={(e) => e.target.files?.[0] && void lerMunicipios(e.target.files[0])} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span>Código do município na Receita</span>
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="ex.: 4123" disabled={lendo} />
            </label>
            <div className="space-y-1 text-xs text-muted-foreground">
              <span>Referência gravada</span>
              <p className="pt-2 text-sm text-foreground">{referencia}</p>
            </div>
          </div>
          <label className="block space-y-1">
            <span>2. Arquivos de Estabelecimentos (pode selecionar vários)</span>
            <Input type="file" multiple accept=".zip,.csv,.ESTABELE" disabled={lendo} onChange={(e) => setArquivos([...(e.target.files ?? [])])} />
          </label>
          {estado && <p className="text-muted-foreground">{estado}</p>}
          {lendo && <Progress value={pct} />}
          <Button className="w-full" onClick={() => void importar()} disabled={lendo}>
            {lendo ? "Lendo…" : `Importar ${arquivos.length || ""} arquivo(s)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
