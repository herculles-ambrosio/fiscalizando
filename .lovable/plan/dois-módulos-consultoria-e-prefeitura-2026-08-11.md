# Dois módulos: Consultoria e Prefeitura

Hoje o sistema é fechado por município: todo usuário pertence a uma prefeitura e só enxerga os dados dela. Vamos abrir um segundo nível acima disso — a sua consultoria — mantendo o isolamento entre as prefeituras.

## Perfis de acesso

- **Superadmin (você)** — acesso total: cria prefeituras, cria usuários (da consultoria e das prefeituras), roda apuração de qualquer município.
- **Consultor (seus funcionários)** — enxerga e opera todas as prefeituras; não cria usuários nem prefeituras.
- **Prefeitura (admin)** — só o município dele: consulta o painel, roda apuração, gera ofícios e edita as configurações/brasão.
- **Prefeitura (operador)** — só o município dele: consulta, roda apuração e gera ofícios; não mexe em configurações.

## Módulo Consultoria

Área nova, visível só para superadmin/consultor:

- **Carteira de prefeituras** — lista todas com município, exercício da última apuração, contagens (omissos, zerados, discrepantes) e status.
- **Seletor de prefeitura ativa** no topo: ao escolher um município, todas as telas atuais (painel, nova apuração, histórico, apuração detalhada, ofícios) passam a operar naquele município.
- **Cadastro de prefeituras** (superadmin) — nome, UF, código SEF.
- **Gestão de usuários** (superadmin) — criar conta informando e-mail, nome, tipo (consultoria ou prefeitura) e, no caso de prefeitura, qual município. Você define uma senha provisória, o sistema mostra a senha uma única vez para você repassar, e o usuário é obrigado a trocá-la no primeiro acesso.

## Módulo Prefeitura

As telas já existentes, sem o seletor de município e sem a área de consultoria — sempre travadas no município do usuário. Prefeitura só vê os próprios dados; nunca dados de outra prefeitura.

## Primeiro acesso

Crio sua conta superadmin `herculles.consultoria@gmail.com` com senha provisória e te informo a senha no chat. Nenhum cadastro público continua permitido — contas só nascem pelo painel.

## Detalhes técnicos

- **Banco**: papéis passam a ser `superadmin`, `consultor`, `prefeitura_admin`, `prefeitura_operador`; `perfis.municipio_id` vira anulável (consultoria não pertence a município). Novas funções no schema `private`: `eh_consultoria()` e `pode_ver_municipio(uuid)`.
- **RLS**: todas as políticas de `municipios`, `perfis`, `cargas`, `contribuintes_apurados`, `configuracoes_municipio` e do storage (`uploads`, `brasoes`) passam a usar `private.pode_ver_municipio(municipio_id)` — verdadeiro para consultoria em qualquer município e para prefeitura só no próprio. `municipios` ganha INSERT/UPDATE restritos a superadmin.
- **Trigger** `perfis_bloqueia_escalonamento` é reescrito: continua bloqueando o próprio usuário de mudar papel/município, mas permite escrita vinda das funções de servidor privilegiadas.
- **Criação de usuários**: `createServerFn` com `requireSupabaseAuth`, valida que o chamador é superadmin via RLS, e só então importa `supabaseAdmin` dentro do handler para criar o usuário já confirmado e inserir o perfil. Senha provisória validada com Zod (mínimo 10 caracteres) e devolvida uma única vez.
- **Contexto de município**: hook `useMunicipioAtivo` (persistido em `localStorage`, validado contra a lista permitida); telas atuais deixam de derivar o município do perfil e passam a ler desse hook.
- **Rotas novas**: `_authenticated/consultoria/prefeituras`, `_authenticated/consultoria/usuarios`, `_authenticated/trocar-senha`, com guarda por papel via `beforeLoad` em layout `consultoria/route.tsx`.
- Menu e navegação passam a ser montados a partir do papel.

## Ordem de execução

1. Migração de papéis, RLS e trigger.
2. Conta superadmin + troca de senha obrigatória.
3. Módulo Consultoria (carteira, seletor, cadastro de prefeituras, usuários).
4. Ajuste das telas existentes ao município ativo e ao papel.
