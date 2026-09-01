import { Link } from "@tanstack/react-router";
import { FileUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function VazioIcms({ mensagem }: { mensagem?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <FileUp className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
        <p className="max-w-md text-sm text-muted-foreground">
          {mensagem ??
            "Nenhum extrato do Robin Hood importado para esta prefeitura. Importe o índice anual e o extrato de transferências para começar."}
        </p>
        <Button asChild size="sm">
          <Link to="/icms/cargas">Importar extratos</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
