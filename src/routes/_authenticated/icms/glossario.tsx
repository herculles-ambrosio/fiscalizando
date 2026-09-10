/**
 * Glossário de consulta: o que cada critério do ICMS mede e o que significa
 * cada indicador da Educação. Serve para decidir, com segurança, se cabe
 * recurso antes do fim do prazo.
 */

import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CRITERIOS } from "@/lib/icms/criterios";
import { GLOSSARIO_EDUCACAO } from "@/lib/icms/educacao/glossario";

export const Route = createFileRoute("/_authenticated/icms/glossario")({
  head: () => ({
    meta: [
      { title: "Glossário do ICMS e da Educação — Apura VAF 2.0" },
      {
        name: "description",
        content:
          "Explicação de cada critério de repasse do ICMS e de cada indicador da Educação, para consultar antes de decidir recurso.",
      },
      { property: "og:title", content: "Glossário do ICMS e da Educação" },
      {
        property: "og:description",
        content:
          "Consulte o que cada critério do ICMS e cada indicador da Educação medem antes de entrar com recurso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Glossario,
});

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function Glossario() {
  const [busca, setBusca] = useState("");
  const termo = semAcento(busca.trim());

  const criterios = useMemo(
    () =>
      CRITERIOS.filter((c) => !c.agregado).filter(
        (c) =>
          !termo ||
          semAcento(`${c.nome} ${c.oQueMede} ${c.baseLegal} ${c.orgao}`).includes(termo),
      ),
    [termo],
  );

  const indicadores = useMemo(
    () =>
      GLOSSARIO_EDUCACAO.filter(
        (v) => !termo || semAcento(`${v.titulo} ${v.chave} ${v.descricao}`).includes(termo),
      ),
    [termo],
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <BookOpen className="size-6 text-primary" />
          Glossário
        </h1>
        <p className="text-sm text-muted-foreground">
          O que cada critério do ICMS e cada indicador da Educação medem — consulte antes de
          decidir se vale entrar com recurso.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Procurar por palavra (ex.: abandono, turismo, gestão)"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <Tabs defaultValue="criterios">
        <TabsList>
          <TabsTrigger value="criterios">Critérios do ICMS ({criterios.length})</TabsTrigger>
          <TabsTrigger value="educacao">Indicadores da Educação ({indicadores.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="criterios" className="space-y-4 pt-4">
          {criterios.length ? (
            criterios.map((c) => (
              <Card key={c.slug}>
                <CardHeader className="gap-2 pb-3">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {c.nome}
                    {c.percentual != null ? (
                      <Badge variant="secondary">{c.percentual}% do repasse</Badge>
                    ) : null}
                    {c.estrutural ? <Badge variant="outline">Sem ação municipal</Badge> : null}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{c.oQueMede}</p>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid gap-1 text-muted-foreground sm:grid-cols-3">
                    <span>
                      <strong className="text-foreground">Base legal:</strong> {c.baseLegal}
                    </span>
                    <span>
                      <strong className="text-foreground">Quem apura:</strong> {c.orgao}
                    </span>
                    <span>
                      <strong className="text-foreground">Periodicidade:</strong> {c.periodicidade}
                    </span>
                  </div>
                  {c.comoMelhorar.length ? (
                    <div>
                      <p className="font-medium">Como melhorar</p>
                      <ul className="ml-5 list-disc space-y-1 text-muted-foreground">
                        {c.comoMelhorar.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum critério encontrado.</p>
          )}
        </TabsContent>

        <TabsContent value="educacao" className="pt-4">
          {indicadores.length ? (
            <Card>
              <CardContent className="divide-y p-0">
                {indicadores.map((v) => (
                  <div key={v.chave} className="space-y-1 p-4">
                    <p className="text-sm font-semibold">{v.titulo}</p>
                    <p className="text-xs text-muted-foreground">{v.chave}</p>
                    <p className="text-sm text-muted-foreground">{v.descricao}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum indicador encontrado.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
