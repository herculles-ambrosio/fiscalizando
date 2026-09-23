import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ExternalLink, History, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type RelatorioLink = { url: string; texto: string; tipo: string; ano?: number | null };

type Linha = {
  id: string;
  url: string;
  texto: string;
  tipo: string | null;
  ano: number | null;
  vezes: number;
  primeiro_em: string;
  ultimo_em: string;
};

/** Grava (ou atualiza) os relatórios encontrados na busca do site oficial. */
export async function registrarRelatoriosEncontrados(criterio: string, links: RelatorioLink[]) {
  if (!links.length) return;
  const urls = links.map((l) => l.url);
  const { data: existentes } = await supabase
    .from("criterio_relatorios_encontrados")
    .select("url, vezes")
    .eq("criterio", criterio)
    .in("url", urls);
  const vezes = new Map((existentes ?? []).map((e) => [e.url, e.vezes]));
  const agora = new Date().toISOString();
  await supabase.from("criterio_relatorios_encontrados").upsert(
    links.map((l) => ({
      criterio,
      url: l.url,
      texto: l.texto,
      tipo: l.tipo,
      ano: l.ano ?? null,
      vezes: (vezes.get(l.url) ?? 0) + 1,
      ultimo_em: agora,
    })),
    { onConflict: "criterio,url" },
  );
}

/** Botões para abrir/baixar o PDF direto no site oficial. */
export function LinksDiretos({ url }: { url: string }) {
  return (
    <>
      <Button size="sm" variant="ghost" asChild title="Abrir no site oficial">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-4 w-4" />
          Abrir
        </a>
      </Button>
      <Button size="sm" variant="ghost" asChild title="Baixar o arquivo">
        <a href={url} download target="_blank" rel="noopener noreferrer">
          <Download className="h-4 w-4" />
          Baixar
        </a>
      </Button>
    </>
  );
}

export function HistoricoRelatoriosEncontrados({
  criterio,
  onUsar,
  desabilitado,
}: {
  criterio: string;
  onUsar: (l: RelatorioLink) => void;
  desabilitado?: boolean;
}) {
  const cliente = useQueryClient();
  const { data } = useQuery({
    queryKey: ["relatorios-encontrados", criterio],
    queryFn: async (): Promise<Linha[]> => {
      const { data, error } = await supabase
        .from("criterio_relatorios_encontrados")
        .select("id, url, texto, tipo, ano, vezes, primeiro_em, ultimo_em")
        .eq("criterio", criterio)
        .order("ultimo_em", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Linha[];
    },
  });

  async function remover(id: string) {
    const { error } = await supabase.from("criterio_relatorios_encontrados").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await cliente.invalidateQueries({ queryKey: ["relatorios-encontrados", criterio] });
  }

  if (!data?.length) return null;
  const fmt = (d: string) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <History className="h-4 w-4" /> Histórico de relatórios encontrados no site oficial
        <Badge variant="secondary">{data.length}</Badge>
      </p>
      {data.map((l) => (
        <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm">
          <div className="min-w-0 flex-1">
            <p className="truncate">
              {l.tipo && (
                <Badge variant="outline" className="mr-2 capitalize">
                  {l.tipo}
                </Badge>
              )}
              {l.texto}
              {l.ano ? <span className="ml-2 text-xs text-muted-foreground">ano-base {l.ano}</span> : null}
            </p>
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-xs text-primary underline"
            >
              {l.url}
            </a>
            <p className="text-xs text-muted-foreground">
              Encontrado em {fmt(l.primeiro_em)} · última busca {fmt(l.ultimo_em)} · {l.vezes}×
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1">
            <LinksDiretos url={l.url} />
            <Button
              size="sm"
              variant="ghost"
              disabled={desabilitado}
              onClick={() => onUsar({ url: l.url, texto: l.texto, tipo: l.tipo ?? "", ano: l.ano })}
            >
              <Upload className="h-4 w-4" /> Usar
            </Button>
            <Button size="sm" variant="ghost" title="Remover do histórico" onClick={() => remover(l.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </span>
        </div>
      ))}
    </div>
  );
}
