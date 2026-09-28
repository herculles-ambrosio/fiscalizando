import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ExternalLink,
  EyeOff,
  Eye,
  Loader2,
  Newspaper,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { usePerfil } from "@/hooks/usePerfil";
import {
  useApagarNoticia,
  useFontes,
  useNoticias,
  useSalvarFonte,
  useSalvarNoticia,
  type Noticia,
} from "@/hooks/useNoticias";
import { buscarNoticiasAgora } from "@/lib/noticias/noticias.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const TEMAS_NOTICIA = [
  "VAF",
  "ICMS",
  "ITBI",
  "ISS",
  "IPTU",
  "Nota Fiscal",
  "Simples Nacional",
  "Reforma Tributária",
  "TCE-MG",
  "Legislação",
];

const PERIODOS = [
  { v: 0, r: "Todas" },
  { v: 7, r: "7 dias" },
  { v: 30, r: "30 dias" },
  { v: 90, r: "90 dias" },
];

function data(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function CartaoNoticia({
  n,
  gerir,
  compacto,
}: {
  n: Noticia;
  gerir?: boolean;
  compacto?: boolean;
}) {
  const salvar = useSalvarNoticia();
  const apagar = useApagarNoticia();
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-soft",
        n.fixada && "border-gold",
        n.oculta && "opacity-50",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {n.fixada && <Pin className="h-3.5 w-3.5 text-gold" />}
        <span className="font-medium">{n.fonte ?? "—"}</span>
        <span>· {data(n.publicada_em)}</span>
        {n.origem === "manual" && <Badge variant="secondary">Publicado pela consultoria</Badge>}
      </div>
      <a
        href={n.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-display text-base leading-snug font-semibold hover:underline"
      >
        {n.titulo}
      </a>
      {!compacto && n.resumo && <p className="text-sm text-muted-foreground">{n.resumo}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
        {n.temas.map((t) => (
          <Badge key={t} variant="outline" className="text-[11px]">
            {t}
          </Badge>
        ))}
        <div className="ml-auto flex gap-1">
          {gerir && (
            <>
              <Button
                size="icon"
                variant="ghost"
                title={n.fixada ? "Desafixar" : "Fixar no topo"}
                onClick={() => salvar.mutate({ id: n.id, fixada: !n.fixada })}
              >
                {n.fixada ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title={n.oculta ? "Mostrar" : "Ocultar"}
                onClick={() => salvar.mutate({ id: n.id, oculta: !n.oculta })}
              >
                {n.oculta ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title="Excluir"
                onClick={() => confirm("Excluir esta notícia?") && apagar.mutate(n.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button asChild size="sm" variant="outline">
            <a href={n.url} target="_blank" rel="noopener noreferrer">
              Abrir matéria <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

function FormNoticia({ fechar }: { fechar: () => void }) {
  const salvar = useSalvarNoticia();
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [resumo, setResumo] = useState("");
  const [temas, setTemas] = useState<string[]>([]);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Publicar notícia</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <Input placeholder="Link da matéria (https://...)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Textarea placeholder="Resumo" value={resumo} onChange={(e) => setResumo(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {TEMAS_NOTICIA.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTemas((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]))}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs",
                temas.includes(t) ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            disabled={!titulo.trim() || !/^https?:\/\//.test(url) || salvar.isPending}
            onClick={() =>
              salvar.mutate(
                { titulo: titulo.trim(), url: url.trim(), resumo: resumo.trim() || null, temas },
                {
                  onSuccess: () => {
                    toast.success("Notícia publicada.");
                    fechar();
                  },
                  onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao publicar"),
                },
              )
            }
          >
            Publicar
          </Button>
          <Button variant="ghost" onClick={fechar}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FontesNoticias() {
  const { data: fontes } = useFontes();
  const salvar = useSalvarFonte();
  const [nome, setNome] = useState("");
  const [url, setUrl] = useState("");
  const [tipo, setTipo] = useState("rss");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fontes consultadas todo dia</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(fontes ?? []).map((f) => (
          <div key={f.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={f.ativa}
              onChange={() => salvar.mutate({ id: f.id, ativa: !f.ativa })}
            />
            <span className="font-medium">{f.nome}</span>
            <span className="truncate text-xs text-muted-foreground">{f.url}</span>
            <Badge variant="outline" className="ml-auto">
              {f.tipo === "rss" ? "RSS" : "Página"}
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => confirm("Remover fonte?") && salvar.mutate({ id: f.id, remover: true })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Input className="w-48" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Input className="min-w-64 flex-1" placeholder="Endereço" value={url} onChange={(e) => setUrl(e.target.value)} />
          <select className="rounded-md border bg-background px-2 text-sm" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="rss">RSS</option>
            <option value="pagina">Página</option>
          </select>
          <Button
            disabled={!nome.trim() || !/^https?:\/\//.test(url)}
            onClick={() =>
              salvar.mutate(
                { nome: nome.trim(), url: url.trim(), tipo },
                { onSuccess: () => { setNome(""); setUrl(""); } },
              )
            }
          >
            Adicionar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function MuralNoticias() {
  const { data: perfil } = usePerfil();
  const gerir = !!perfil?.ehConsultoria;
  const { data: noticias, isLoading } = useNoticias();
  const qc = useQueryClient();
  const buscar = useServerFn(buscarNoticiasAgora);
  const [buscando, setBuscando] = useState(false);
  const [tema, setTema] = useState<string | null>(null);
  const [fonte, setFonte] = useState("");
  const [periodo, setPeriodo] = useState(0);
  const [texto, setTexto] = useState("");
  const [novo, setNovo] = useState(false);
  const [verFontes, setVerFontes] = useState(false);

  const fontes = useMemo(
    () => [...new Set((noticias ?? []).map((n) => n.fonte).filter(Boolean) as string[])].sort(),
    [noticias],
  );
  const lista = useMemo(() => {
    const limite = periodo ? Date.now() - periodo * 86400000 : 0;
    const q = texto.toLowerCase();
    return (noticias ?? []).filter(
      (n) =>
        (!tema || n.temas.includes(tema)) &&
        (!fonte || n.fonte === fonte) &&
        (!limite || new Date(n.publicada_em).getTime() >= limite) &&
        (!q || `${n.titulo} ${n.resumo ?? ""}`.toLowerCase().includes(q)),
    );
  }, [noticias, tema, fonte, periodo, texto]);

  async function buscarAgora() {
    setBuscando(true);
    try {
      const r = await buscar();
      toast.success(`${r.novas} notícia(s) nova(s) encontrada(s).`);
      qc.invalidateQueries({ queryKey: ["noticias"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao buscar novidades");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
            <Newspaper className="h-7 w-7" /> Notícias tributárias
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            VAF, ICMS, ITBI, ISS, nota fiscal e tudo o que importa aos municípios mineiros. Atualizado todo dia pela manhã.
          </p>
        </div>
        {gerir && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setVerFontes((v) => !v)}>
              Fontes
            </Button>
            <Button variant="outline" onClick={() => setNovo(true)}>
              <Plus className="mr-1 h-4 w-4" /> Publicar notícia
            </Button>
            <Button onClick={buscarAgora} disabled={buscando}>
              {buscando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
              Buscar novidades agora
            </Button>
          </div>
        )}
      </div>

      {novo && <FormNoticia fechar={() => setNovo(false)} />}
      {verFontes && <FontesNoticias />}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTema(null)}
          className={cn("rounded-full border px-3 py-1 text-xs", !tema ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
        >
          Todos
        </button>
        {TEMAS_NOTICIA.map((t) => (
          <button
            key={t}
            onClick={() => setTema(t === tema ? null : t)}
            className={cn("rounded-full border px-3 py-1 text-xs", tema === t ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Buscar por palavra" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <select className="rounded-md border bg-background px-2 text-sm" value={fonte} onChange={(e) => setFonte(e.target.value)}>
          <option value="">Todas as fontes</option>
          {fontes.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <select className="rounded-md border bg-background px-2 text-sm" value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))}>
          {PERIODOS.map((p) => (
            <option key={p.v} value={p.v}>{p.r}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : lista.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nenhuma notícia encontrada{gerir ? ". Clique em \"Buscar novidades agora\" para a primeira coleta." : "."}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((n) => (
            <CartaoNoticia key={n.id} n={n} gerir={gerir} />
          ))}
        </div>
      )}
    </div>
  );
}

export function UltimasNoticias() {
  const { data } = useNoticias(20);
  const lista = (data ?? []).filter((n) => !n.oculta).slice(0, 5);
  if (!lista.length) return null;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Newspaper className="h-4 w-4" /> Últimas notícias
        </CardTitle>
        <a href="/noticias" className="text-sm text-primary hover:underline">Ver todas</a>
      </CardHeader>
      <CardContent className="space-y-3">
        {lista.map((n) => (
          <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg p-2 hover:bg-muted">
            <p className="text-sm font-medium leading-snug">{n.titulo}</p>
            <p className="text-xs text-muted-foreground">{n.fonte} · {data(n.publicada_em)}</p>
          </a>
        ))}
      </CardContent>
    </Card>
  );
}
