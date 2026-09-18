import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CONFERIDO_EM, fichaDe } from "@/lib/icms/criterios/cadastro";

/**
 * Onde o município lança/cadastra o critério: órgão, sistema, o que enviar,
 * prazo e o endereço oficial. Aparece junto do "Como melhorar".
 */
export function OndeInscrever({ slug }: { slug: string }) {
  const ficha = fichaDe(slug);
  if (!ficha) return null;
  const locais = ficha.ondeCadastrar ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Como é calculado e onde se inscreve</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {ficha.comoECalculado && (
          <div>
            <p className="text-xs text-muted-foreground">Como o número é apurado</p>
            <p>{ficha.comoECalculado}</p>
          </div>
        )}
        {ficha.deOndeVem && (
          <div>
            <p className="text-xs text-muted-foreground">De onde vem o dado</p>
            <p>{ficha.deOndeVem}</p>
          </div>
        )}

        {locais.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Critério calculado automaticamente: não há cadastro a fazer pela prefeitura.
          </p>
        ) : (
          <div className="space-y-3">
            {locais.map((l) => (
              <div key={`${l.orgao}-${l.onde}`} className="rounded-md border p-3">
                <p className="font-medium">{l.orgao}</p>
                <p className="text-muted-foreground">{l.onde}</p>
                {l.oQueEnviar && (
                  <p className="mt-1">
                    <span className="text-xs text-muted-foreground">O que enviar: </span>
                    {l.oQueEnviar}
                  </p>
                )}
                {l.prazo && (
                  <p className="mt-1">
                    <span className="text-xs text-muted-foreground">Prazo: </span>
                    {l.prazo}
                  </p>
                )}
                {l.url && (
                  <a
                    className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir o site oficial
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Endereços conferidos em {CONFERIDO_EM}; a resolução do ano confirma prazos e
              documentos exigidos.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
