import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Empresa } from "@/hooks/useEmpresas";
import {
  divergencias, lerCadastroPrefeitura, ROTULO_ALERTA_MUNICIPIO, ROTULO_DIVERGENCIA,
  type Divergencia, type LinhaPrefeitura,
} from "@/lib/empresas/prefeitura";
import { formatarCnpj } from "@/lib/format";
import { baixarCsv, montarCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Gravada = LinhaPrefeitura & { id: string; carga_ref: string | null; arquivo_nome: string | null; criado_em: string };

export function useEmpresasPrefeitura(municipioId: string | null | undefined) {
  return useQuery({
    queryKey: ["empresas_prefeitura", municipioId],
    enabled: !!municipioId,
    queryFn: async (): Promise<Gravada[]> => {
      const todas: Gravada[] = [];
      for (let i = 0; i < 100000; i += 1000) {
        const { data, error } = await supabase.from("empresas_prefeitura").select("*").eq("municipio_id", municipioId!).range(i, i + 999);
        if (error) throw error;
        todas.push(...((data ?? []) as unknown as Gravada[]));
        if (!data || data.length < 1000) break;
      }
      return todas;
    },
  });
}

type Linha = {
  chave: string;
  cnpj: string;
  grupo: "AMBOS" | "SO_PREFEITURA" | "SO_RECEITA";
  p?: Gravada;
  r?: Empresa;
  div: Divergencia[];
};

const sim = (b: boolean | null | undefined) => (b == null ? "—" : b ? "Sim" : "Não");
const OBS_TODAS = "todas";
// Versão curta exibida no seletor fechado; a lista e a coluna mantêm o texto completo.
const OBS_CURTA: Record<string, string> = {
  "Não encontrada na base importada da Receita (confira filtro de data ou endereço)": "Não encontrada na base importada da Receita",
};
const obsCurta = (r: string) => OBS_CURTA[r] ?? r;



export function ComparacaoPrefeitura({ municipioId, municipioNome, empresas, onClose }: {
  municipioId: string; municipioNome: string; empresas: Empresa[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: pref = [] } = useEmpresasPrefeitura(municipioId);
  const [enviando, setEnviando] = useState(false);
  const [ref, setRef] = useState(() => new Date().toISOString().slice(0, 7));
  const [filtro, setFiltro] = useState("divergentes");
  const [obs, setObs] = useState(OBS_TODAS);
  const [busca, setBusca] = useState("");
  const [porPagina, setPorPagina] = useState(20);
  const [pagina, setPagina] = useState(1);

  function mudarFiltro(v: string) {
    setFiltro(v);
    setObs(OBS_TODAS);
    setPagina(1);
  }

  function mudarObs(v: string) {
    setObs(v);
    // Observações como "Ativa na Receita e sem cadastro na prefeitura" só
    // existem em grupos que o filtro de divergências esconde, então o filtro
    // principal volta para "Todos" quando uma observação é escolhida.
    if (v !== OBS_TODAS) setFiltro("todos");
    setPagina(1);
  }



  async function importar(f: File) {
    setEnviando(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer());
      const bruto = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0] ?? ""]!, { raw: false, defval: "" });
      const r = lerCadastroPrefeitura(bruto, municipioNome);
      if (!r.ok) { toast.error(r.erro); return; }
      const { data: u } = await supabase.auth.getUser();
      const del = await supabase.from("empresas_prefeitura").delete().eq("municipio_id", municipioId);
      if (del.error) throw del.error;
      for (let i = 0; i < r.linhas.length; i += 500) {
        const { error } = await supabase.from("empresas_prefeitura").insert(
          r.linhas.slice(i, i + 500).map((l) => ({ ...l, municipio_id: municipioId, carga_ref: ref, arquivo_nome: f.name, criado_por: u.user?.id ?? null })),
        );
        if (error) throw error;
      }
      const fora = r.linhas.filter((l) => l.alerta_municipio).length;
      toast.success(`${r.linhas.length} cadastro(s) da prefeitura gravados${fora ? ` · ${fora} com endereço em outro município` : ""}.`);
      await qc.invalidateQueries({ queryKey: ["empresas_prefeitura", municipioId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar a planilha.");
    } finally {
      setEnviando(false);
    }
  }

  const { linhas, resumo } = useMemo(() => {
    const porCnpj = new Map(empresas.map((e) => [e.cnpj, e]));
    const cnpjsPref = new Set<string>();
    const out: Linha[] = [];
    for (const p of pref) {
      if (p.tipo_documento !== "CNPJ" || p.repetido) continue;
      cnpjsPref.add(p.documento);
      const r = porCnpj.get(p.documento);
      out.push(r ? { chave: p.id, cnpj: p.documento, grupo: "AMBOS", p, r, div: divergencias(p, r) } : { chave: p.id, cnpj: p.documento, grupo: "SO_PREFEITURA", p, div: [] });
    }
    for (const r of empresas) if (!cnpjsPref.has(r.cnpj)) out.push({ chave: r.id, cnpj: r.cnpj, grupo: "SO_RECEITA", r, div: [] });
    const conta = (f: (l: Linha) => boolean) => out.filter(f).length;
    return {
      linhas: out,
      resumo: {
        pref: cnpjsPref.size,
        receita: empresas.length,
        ambos: conta((l) => l.grupo === "AMBOS"),
        soPref: conta((l) => l.grupo === "SO_PREFEITURA"),
        soRec: conta((l) => l.grupo === "SO_RECEITA"),
        soRecAtivas: conta((l) => l.grupo === "SO_RECEITA" && l.r?.situacao === "ATIVA"),
        cpf: pref.filter((p) => p.tipo_documento === "CPF").length,
        repetidos: pref.filter((p) => p.repetido).length,
        simples: conta((l) => l.div.includes("SIMPLES")),
        mei: conta((l) => l.div.includes("MEI")),
        situacao: conta((l) => l.div.includes("SITUACAO")),
        foraMun: pref.filter((p) => p.alerta_municipio).length,
      },
    };
  }, [pref, empresas]);

  const motivo = (l: Linha) => {
    if (l.grupo === "SO_RECEITA") return l.r?.situacao === "ATIVA" ? "Ativa na Receita e sem cadastro na prefeitura" : "Encerrada na Receita, sem cadastro na prefeitura";
    if (l.grupo === "SO_PREFEITURA") {
      if (l.p?.alerta_municipio) return ROTULO_ALERTA_MUNICIPIO[l.p.alerta_municipio];
      return l.p?.situacao_normalizada === "BAIXADA" ? "Baixada na prefeitura; fora da base importada da Receita" : "Não encontrada na base importada da Receita (confira filtro de data ou endereço)";
    }
    return l.div.map((d) => ROTULO_DIVERGENCIA[d]).join(" · ");
  };

  const rotuloObs = (l: Linha) => motivo(l) || "Sem observação";

  const observacoes = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const l of linhas) {
      const k = rotuloObs(l);
      contagem.set(k, (contagem.get(k) ?? 0) + 1);
    }
    return [...contagem.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
  }, [linhas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (filtro === "divergentes" && !l.div.length) return false;
      if (["SIMPLES", "MEI", "SITUACAO"].includes(filtro) && !l.div.includes(filtro as Divergencia)) return false;
      if (["AMBOS", "SO_PREFEITURA", "SO_RECEITA"].includes(filtro) && l.grupo !== filtro) return false;
      if (filtro === "SO_RECEITA_ATIVAS" && !(l.grupo === "SO_RECEITA" && l.r?.situacao === "ATIVA")) return false;
      if (filtro === "FORA" && !l.p?.alerta_municipio) return false;
      if (obs !== OBS_TODAS && rotuloObs(l) !== obs) return false;
      if (q && !`${l.cnpj} ${l.p?.nome ?? ""} ${l.r?.razao_social ?? ""} ${l.r?.nome_fantasia ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [linhas, filtro, busca, obs]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const naPagina = filtradas.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);


  function exportar() {
    const cab = ["CNPJ", "Grupo", "Nome prefeitura", "Razão social Receita", "Regime prefeitura", "MEI Receita", "Simples prefeitura", "Simples Receita", "Situação prefeitura", "Situação Receita", "Município (endereço)", "Observação"];
    baixarCsv(`comparacao-prefeitura-${municipioNome}.csv`, montarCsv(cab, filtradas.map((l) => [
      formatarCnpj(l.cnpj), l.grupo === "AMBOS" ? "Nos dois" : l.grupo === "SO_PREFEITURA" ? "Só prefeitura" : "Só Receita",
      l.p?.nome, l.r?.razao_social ?? l.r?.nome_fantasia, l.p?.regime, sim(l.r?.opcao_mei), sim(l.p?.simples_optante), sim(l.r?.opcao_simples),
      l.p?.situacao, l.r?.situacao, l.p?.municipio_endereco, motivo(l),
    ])));
  }

  const carga = pref[0];
  const n = (x: number) => x.toLocaleString("pt-BR");
  const cards: [string, number, string, string?][] = [
    ["Cadastro da prefeitura (CNPJs)", resumo.pref, "todos"],
    ["Nosso cadastro (Receita)", resumo.receita, "todos"],
    ["Nos dois cadastros", resumo.ambos, "AMBOS"],
    ["Só na prefeitura", resumo.soPref, "SO_PREFEITURA"],
    ["Só na Receita", resumo.soRec, "SO_RECEITA", `${n(resumo.soRecAtivas)} ativas`],
    ["Simples divergente", resumo.simples, "SIMPLES"],
    ["MEI divergente", resumo.mei, "MEI"],
    ["Situação divergente", resumo.situacao, "SITUACAO"],
    ["Endereço em outro município", resumo.foraMun, "FORA"],
  ];

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Comparação com o cadastro da prefeitura</h2>
          <p className="text-xs text-muted-foreground">
            {carga ? `Planilha ${carga.arquivo_nome ?? ""} · referência ${carga.carga_ref ?? "—"} · ${n(pref.length)} linha(s), ${n(resumo.cpf)} CPF/autônomo(s) fora do cruzamento, ${n(resumo.repetidos)} repetida(s).` : "Importe o Excel do cadastro econômico exportado do sistema da prefeitura."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="month" className="h-9 w-40" value={ref} onChange={(e) => setRef(e.target.value)} disabled={enviando} />
          <label className={cn("inline-flex h-9 cursor-pointer items-center rounded-md border px-3 text-sm hover:border-primary", enviando && "pointer-events-none opacity-50")}>
            <Upload className="mr-2 h-4 w-4" /> {enviando ? "Importando…" : carga ? "Substituir planilha" : "Importar planilha"}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void importar(f); }} />
          </label>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar comparação"><X className="h-4 w-4" /></Button>
        </div>
      </div>

      {carga && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
            {cards.map(([t, v, f, extra]) => (
              <button key={t} onClick={() => mudarFiltro(f)} className={cn("rounded-lg border p-3 text-left hover:border-primary", filtro === f && "border-primary")}>
                <p className="text-xs text-muted-foreground">{t}</p>
                <p className="font-display text-xl font-semibold">{n(v)}</p>
                {extra && <p className="text-xs text-muted-foreground">{extra}</p>}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Input className="max-w-xs" placeholder="Nome ou CNPJ" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} />
            <Select value={filtro} onValueChange={mudarFiltro}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="divergentes">Todas as divergências</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="AMBOS">Nos dois cadastros</SelectItem>
                <SelectItem value="SO_PREFEITURA">Só na prefeitura</SelectItem>
                <SelectItem value="SO_RECEITA">Só na Receita</SelectItem>
                <SelectItem value="SO_RECEITA_ATIVAS">Só na Receita (ativas)</SelectItem>
                <SelectItem value="SIMPLES">Simples divergente</SelectItem>
                <SelectItem value="MEI">MEI divergente</SelectItem>
                <SelectItem value="SITUACAO">Situação divergente</SelectItem>
                <SelectItem value="FORA">Endereço em outro município</SelectItem>
              </SelectContent>
            </Select>
            <Select value={obs} onValueChange={mudarObs}>
              <SelectTrigger className="w-[26rem] max-w-full"><SelectValue placeholder="Observação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={OBS_TODAS}>Todas as observações</SelectItem>
                {observacoes.map(([rotulo, qt]) => (
                  <SelectItem key={rotulo} value={rotulo} textValue={obsCurta(rotulo)}>{rotulo} ({n(qt)})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportar} disabled={!filtradas.length}><Download className="mr-2 h-4 w-4" /> CSV</Button>
          </div>

          <div className="max-h-[32rem] overflow-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
                <tr>
                  <th className="p-2">Empresa / CNPJ</th><th className="p-2">Regime (prefeitura × Receita)</th>
                  <th className="p-2">Simples (pref. × Receita)</th><th className="p-2">Situação (pref. × Receita)</th><th className="p-2">Observação</th>
                </tr>
              </thead>
              <tbody>
                {naPagina.map((l) => (
                  <tr key={l.chave} className="border-t align-top">
                    <td className="p-2">
                      <p className="font-medium">{l.p?.nome ?? l.r?.razao_social ?? l.r?.nome_fantasia ?? "—"}</p>
                      <p className="text-muted-foreground">{formatarCnpj(l.cnpj)}{l.p?.municipio_endereco && l.p.alerta_municipio ? ` · ${l.p.municipio_endereco}` : ""}</p>
                    </td>
                    <td className={cn("p-2", l.div.includes("MEI") && "font-semibold text-destructive")}>
                      {l.p?.regime ?? "—"} × {l.r ? (l.r.opcao_mei ? "MEI" : l.r.opcao_mei === false ? "Não MEI" : "—") : "—"}
                    </td>
                    <td className={cn("p-2", l.div.includes("SIMPLES") && "font-semibold text-destructive")}>{sim(l.p?.simples_optante)} × {sim(l.r?.opcao_simples)}</td>
                    <td className={cn("p-2", l.div.includes("SITUACAO") && "font-semibold text-destructive")}>{l.p?.situacao ?? "—"} × {l.r?.situacao ?? "—"}</td>
                    <td className="p-2">{motivo(l)}</td>
                  </tr>
                ))}
                {!filtradas.length && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Nada com este filtro.</td></tr>}
              </tbody>
              <tfoot className="sticky bottom-0 border-t-2 bg-muted font-medium">
                <tr>
                  <td className="p-2">Total: {n(filtradas.length)}</td>
                  <td className="p-2">{n(filtradas.filter((l) => l.div.includes("MEI")).length)} divergente(s)</td>
                  <td className="p-2">{n(filtradas.filter((l) => l.div.includes("SIMPLES")).length)} divergente(s)</td>
                  <td className="p-2">{n(filtradas.filter((l) => l.div.includes("SITUACAO")).length)} divergente(s)</td>
                  <td className="p-2">{n(filtradas.filter((l) => l.grupo === "SO_RECEITA").length)} só Receita · {n(filtradas.filter((l) => l.grupo === "SO_PREFEITURA").length)} só prefeitura</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Empresas por página</span>
              <Select
                value={String(porPagina)}
                onValueChange={(v) => { setPorPagina(Number(v)); setPagina(1); }}
              >
                <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 15, 20, 25].map((tamanho) => (
                    <SelectItem key={tamanho} value={String(tamanho)}>{tamanho}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span>Página {paginaAtual} de {totalPaginas}</span>
              <Button size="sm" variant="outline" disabled={paginaAtual <= 1} onClick={() => setPagina(paginaAtual - 1)}>
                Anterior
              </Button>
              <Button size="sm" variant="outline" disabled={paginaAtual >= totalPaginas} onClick={() => setPagina(paginaAtual + 1)}>
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
