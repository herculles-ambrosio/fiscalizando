import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { normalizarRotulo } from "@/lib/icms/criterios";

/**
 * Mapa de Minas Gerais para escolher municípios no comparativo do ICMS.
 * Roda só no navegador: o Leaflet e a malha do IBGE são carregados sob
 * demanda, depois da hidratação.
 */

const MALHA =
  "https://servicodados.ibge.gov.br/api/v3/malhas/estados/31?formato=application/vnd.geo+json&intrarregiao=municipio&qualidade=minima";
const LOCALIDADES = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/31/municipios";

type Props = {
  /** nomes disponíveis no portal (a seleção só devolve nomes que existem lá) */
  disponiveis: string[];
  selecionados: string[];
  aoAlternar: (nome: string) => void;
  /** município da prefeitura ativa, destacado no mapa */
  municipioAtivo?: string | null;
};

export function MapaMunicipios({ disponiveis, selecionados, aoAlternar, municipioAtivo }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const camadasRef = useRef<Map<string, { setStyle: (s: unknown) => void }>>(new Map());
  const selecaoRef = useRef<Set<string>>(new Set());
  const alternarRef = useRef(aoAlternar);
  const disponiveisRef = useRef<Map<string, string>>(new Map());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  alternarRef.current = aoAlternar;
  disponiveisRef.current = new Map(disponiveis.map((n) => [normalizarRotulo(n), n]));

  const ativo = municipioAtivo ? normalizarRotulo(municipioAtivo) : null;

  function estilo(chave: string) {
    const selecionado = selecaoRef.current.has(chave);
    const ehAtivo = chave === ativo;
    const existe = disponiveisRef.current.has(chave);
    return {
      color: "#0f766e",
      weight: selecionado || ehAtivo ? 1.6 : 0.4,
      opacity: existe ? 0.85 : 0.3,
      fillColor: ehAtivo ? "#f59e0b" : selecionado ? "#059669" : "#cbd5e1",
      fillOpacity: ehAtivo ? 0.85 : selecionado ? 0.75 : 0.25,
    };
  }

  // desenha o mapa uma única vez
  useEffect(() => {
    let vivo = true;
    let mapa: { remove: () => void } | null = null;

    (async () => {
      try {
        const [L, malhaResp, localidadesResp] = await Promise.all([
          import("leaflet"),
          fetch(MALHA),
          fetch(LOCALIDADES),
        ]);
        await import("leaflet/dist/leaflet.css");
        if (!malhaResp.ok || !localidadesResp.ok) throw new Error("IBGE indisponível");
        const malha = (await malhaResp.json()) as {
          features: { properties: { codarea: string } }[];
        };
        const localidades = (await localidadesResp.json()) as { id: number; nome: string }[];
        if (!vivo || !divRef.current) return;

        const nomePorCodigo = new Map(localidades.map((m) => [String(m.id), m.nome]));

        const leaflet = L.default ?? (L as unknown as typeof import("leaflet"));
        const instancia = leaflet.map(divRef.current, {
          zoomControl: true,
          attributionControl: false,
        });
        mapa = instancia as unknown as { remove: () => void };

        const camada = leaflet.geoJSON(malha as never, {
          style: (f) => estilo(normalizarRotulo(nomePorCodigo.get(String(f?.properties?.["codarea"])) ?? "")),
          onEachFeature: (feature, layer) => {
            const nome = nomePorCodigo.get(String(feature.properties?.["codarea"])) ?? "";
            const chave = normalizarRotulo(nome);
            camadasRef.current.set(chave, layer as never);
            layer.bindTooltip(nome, { sticky: true });
            layer.on("click", () => {
              const oficial = disponiveisRef.current.get(chave);
              if (oficial) alternarRef.current(oficial);
            });
          },
        });
        camada.addTo(instancia);
        instancia.fitBounds(camada.getBounds(), { padding: [8, 8] });
        setCarregando(false);
      } catch (e) {
        if (vivo) {
          setErro(e instanceof Error ? e.message : "não consegui carregar o mapa");
          setCarregando(false);
        }
      }
    })();

    return () => {
      vivo = false;
      mapa?.remove();
      camadasRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // repinta quando a seleção muda
  useEffect(() => {
    selecaoRef.current = new Set(selecionados.map((n) => normalizarRotulo(n)));
    for (const [chave, layer] of camadasRef.current) layer.setStyle(estilo(chave));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionados, municipioAtivo, disponiveis]);

  return (
    <div className="relative overflow-hidden rounded-md border">
      <div ref={divRef} className="h-[420px] w-full bg-muted/30" />
      {(carregando || erro) && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 text-sm text-muted-foreground">
          {carregando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando o mapa de Minas Gerais…
            </>
          ) : (
            <span>Mapa indisponível ({erro}). Use o seletor por nome.</span>
          )}
        </div>
      )}
    </div>
  );
}

export default MapaMunicipios;
