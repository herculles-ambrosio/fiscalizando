import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { extrairBlocos, extrairRanking, mapearAtividade, normalizarMunicipio } from "./parser";

const PDF = "/mnt/user-uploads/relatorio_definitivo_anobase_2024-compressed.pdf";

describe("ranking", () => {
  it("lê nomes quebrados em várias linhas e as cinco colunas numéricas", () => {
    const linhas = [
      { y: 700, texto: "LAGOA DA" },
      { y: 690, texto: "1 9481,5 0 126 0 9607,5 1,24560%" },
      { y: 680, texto: "PRATA" },
      { y: 660, texto: "2 NOVA SERRANA 9120 4 112 0 9236 1,19740%" },
      { y: 630, texto: "24 RAUL SOARES 5120 0 96 0 5216 0,67620%" },
    ];
    const r = extrairRanking([{ pagina: 2, linhas }]);
    expect(r[0]).toMatchObject({ posicao: 1, municipio: "LAGOA DA PRATA", notaFinal: 9607.5 });
    expect(r[1]?.municipio).toBe("NOVA SERRANA");
    expect(r[2]).toMatchObject({
      municipio: "RAUL SOARES",
      notaAtividades: 5120,
      notaJimi: 0,
      notaJemg: 96,
      notaBabt: 0,
      notaFinal: 5216,
      indicePercentual: 0.6762,
    });
  });
});

describe("blocos da memória de cálculo", () => {
  const texto = [
    "Município: AIMORÉS",
    "Atividade Esportiva: Atividades de Lazer",
    "Eventos Realizados (Número de Participantes):",
    "1º Festival Esportivo da Escola Municipal Raul Soares (230), Corrida da Cidade (100)",
    "Modalidades Oferecidas:",
    "ATLETISMO, RECREAÇÃO",
    "Peso Atividade Esportiva Peso Receita Líquida per Capita Pontuação Atletas Pontuação Modalidades Pontuação",
    "0.5 8 10 10 400",
    "Município: ABAETÉ",
    "Atividade Esportiva: Esporte Terceira Idade",
    "Eventos Realizados (Número de Participantes):",
    "Projeto 3ª Idade 60tões (195)",
    "Modalidades Oferecidas:",
    "CAMINHADA",
    "Peso Atividade Esportiva Peso Receita Líquida per Capita Pontuação Atletas Pontuação Modalidades Pontuação",
    "1 8 6 3 144",
  ];

  it("nunca abre bloco por menção ao nome de outro município no texto de eventos", () => {
    const blocos = extrairBlocos(texto);
    expect(blocos.map((b) => b.municipio)).toEqual(["AIMORES", "ABAETE"]);
    expect(blocos.some((b) => b.municipio === "RAUL SOARES")).toBe(false);
  });

  it("extrai pontuações, eventos e participantes", () => {
    const [primeiro, segundo] = extrairBlocos(texto);
    expect(primeiro).toMatchObject({
      atividadeNome: "Atividades de Lazer",
      pesoAtividade: 0.5,
      pesoRcl: 8,
      pontuacaoAtletas: 10,
      pontuacaoModalidades: 10,
      pontuacao: 400,
      qtdEventos: 2,
      totalParticipantes: 330,
    });
    expect(segundo?.totalParticipantes).toBe(195);
  });
});

describe("mapeamento com o Anexo V", () => {
  const referencia = [
    { codigo: "AL", nome_oficial: "Atividades de Lazer", sinonimos: [], peso: 0.5 },
    {
      codigo: "BABTE",
      nome_oficial: "Bolsa Atleta e Bolsa-Técnico (Municipal/Estadual)",
      sinonimos: ["BOLSA ATLETA E BOLSA TECNICO ESTADUAL E MUNICIPAL BABTE"],
      peso: 1,
    },
  ];
  it("casa nomes com acento e variações", () => {
    expect(mapearAtividade("Atividades de Lazer", referencia)?.codigo).toBe("AL");
    expect(
      mapearAtividade("Bolsa Atleta e Bolsa Técnico - Estadual e Municipal –BABTE", referencia)
        ?.codigo,
    ).toBe("BABTE");
    expect(mapearAtividade("Vela Oceânica", referencia)).toBeNull();
  });
});

describe.skipIf(!existsSync(PDF))("relatório definitivo ano-base 2024", () => {
  it("traz Raul Soares no ranking e não cria blocos falsos para ele", async () => {
    const { extrairPaginas } = await import("./pdf");
    const paginas = await extrairPaginas(new Uint8Array(readFileSync(PDF)));

    const ranking = extrairRanking(paginas);
    const raul = ranking.find((l) => l.municipio === normalizarMunicipio("Raul Soares"));
    expect(raul).toBeTruthy();
    expect(raul).toMatchObject({
      notaAtividades: 5120,
      notaJimi: 0,
      notaJemg: 96,
      notaBabt: 0,
      notaFinal: 5216,
      indicePercentual: 0.6762,
    });

    const blocos = extrairBlocos(paginas.flatMap((p) => p.linhas.map((l) => l.texto)));
    expect(blocos.length).toBeGreaterThan(1000);
    const deRaul = blocos.filter((b) => b.municipio === "RAUL SOARES");
    expect(deRaul.length).toBe(11);
    // A soma das atividades bate exatamente com a coluna ATIVIDADES do ranking.
    expect(deRaul.reduce((s, b) => s + (b.pontuacao ?? 0), 0)).toBe(5120);
    // Eventos de outros municípios que citam "Raul Soares" não entram aqui.
    expect(
      deRaul.some((b) => /Escola Municipal Raul Soares/i.test(b.eventosTexto)),
    ).toBe(false);

    // Nomes de município quebrados em várias linhas no ranking.
    for (const nome of ["LAGOA DA PRATA", "SAO JOAO DEL REI", "ENTRE RIOS DE MINAS"]) {
      expect(ranking.some((l) => l.municipio === nome)).toBe(true);
    }
  }, 300000);
});
