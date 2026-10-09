import { useMemo } from "react";
import DocumentosPrefeituraView from "@/components/DocumentosPrefeituraView";
import { useCartorioConfig, useFiscalizacaoCartorio, type Competencia } from "@/hooks/useCartorios";
import { camposCartorio, PLACEHOLDERS_CARTORIO } from "@/lib/cartorios/modelos";
import type { FonteDestinatario } from "@/lib/documentosPrefeitura";

const GERAIS = new Set(["{{prefeitura}}", "{{municipio}}", "{{cidade_data}}", "{{data_extenso}}", "{{prazo_dias}}"]);

export default function DocumentosPrefeituraCartorio({ competencia }: { competencia: Competencia | null }) {
  const { data: linhas = [] } = useFiscalizacaoCartorio(competencia);
  const { data: cfg } = useCartorioConfig();
  const aliquota = cfg?.aliquota_iss ?? 5;
  const fontes = useMemo<FonteDestinatario[]>(
    () =>
      competencia
        ? linhas.map((l) => ({
            id: `${l.cns}|${l.tipoServico}`,
            nome: l.nome,
            documento: `CNS ${l.cns}`,
            endereco: l.comarca ?? "",
            detalhe: l.tipoServico || undefined,
            campos: camposCartorio({ linha: l, competencia, aliquota, prazoDias: 30 }),
          }))
        : [],
    [linhas, competencia, aliquota],
  );
  return (
    <DocumentosPrefeituraView
      modulo="cartorios"
      fontes={fontes}
      rotuloFontes={competencia ? "Cartórios do mês" : "Cartórios do mês (escolha um mês)"}
      placeholdersModulo={PLACEHOLDERS_CARTORIO.filter((p) => !GERAIS.has(p.chave))}
    />
  );
}
