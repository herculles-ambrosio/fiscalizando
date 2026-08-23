/**
 * Rodapé exibido somente na impressão / exportação em PDF dos relatórios.
 * Não é usado em ofícios (gerados em .docx).
 */
export function PrintFooter() {
  return (
    <div className="print-footer">
      <span>Apura VAF 2.0 · Relatório gerado em {new Date().toLocaleDateString("pt-BR")}</span>
      <span>H-Tech Minas — Consultoria Tributária</span>
    </div>
  );
}
