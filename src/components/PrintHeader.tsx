import logoAsset from "@/assets/htechminas-logo.png.asset.json";

/**
 * Cabeçalho exibido somente na impressão / exportação em PDF dos relatórios.
 * Não é usado em ofícios (gerados em .docx).
 */
export function PrintHeader() {
  return (
    <div className="print-header">
      <img src={logoAsset.url} alt="H-Tech Minas — Consultoria Tributária" />
    </div>
  );
}
