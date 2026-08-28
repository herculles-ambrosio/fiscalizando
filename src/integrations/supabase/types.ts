export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acoes_recuperacao: {
        Row: {
          acao_chave: string
          acao_titulo: string
          atualizado_em: string
          atualizado_por: string | null
          carga_id: string | null
          cnpj: string | null
          concluida_em: string | null
          criado_em: string
          exercicio: number | null
          id: string
          inscricao_estadual: string
          municipio_id: string
          nome_contribuinte: string | null
          observacao: string | null
          oficio_enviado_em: string | null
          referencia: string
          resposta_em: string | null
          status: string
          valor_recuperavel: number
        }
        Insert: {
          acao_chave: string
          acao_titulo?: string
          atualizado_em?: string
          atualizado_por?: string | null
          carga_id?: string | null
          cnpj?: string | null
          concluida_em?: string | null
          criado_em?: string
          exercicio?: number | null
          id?: string
          inscricao_estadual?: string
          municipio_id: string
          nome_contribuinte?: string | null
          observacao?: string | null
          oficio_enviado_em?: string | null
          referencia?: string
          resposta_em?: string | null
          status?: string
          valor_recuperavel?: number
        }
        Update: {
          acao_chave?: string
          acao_titulo?: string
          atualizado_em?: string
          atualizado_por?: string | null
          carga_id?: string | null
          cnpj?: string | null
          concluida_em?: string | null
          criado_em?: string
          exercicio?: number | null
          id?: string
          inscricao_estadual?: string
          municipio_id?: string
          nome_contribuinte?: string | null
          observacao?: string | null
          oficio_enviado_em?: string | null
          referencia?: string
          resposta_em?: string | null
          status?: string
          valor_recuperavel?: number
        }
        Relationships: [
          {
            foreignKeyName: "acoes_recuperacao_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acoes_recuperacao_municipio_id_fkey"
            columns: ["municipio_id"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["id"]
          },
        ]
      }
      acoes_recuperacao_anexos: {
        Row: {
          acao_chave: string
          arquivo_nome: string
          arquivo_path: string
          criado_em: string
          criado_por: string | null
          descricao: string | null
          id: string
          inscricao_estadual: string
          municipio_id: string
          referencia: string
          tamanho: number | null
          tipo_mime: string | null
        }
        Insert: {
          acao_chave: string
          arquivo_nome: string
          arquivo_path: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          inscricao_estadual?: string
          municipio_id: string
          referencia?: string
          tamanho?: number | null
          tipo_mime?: string | null
        }
        Update: {
          acao_chave?: string
          arquivo_nome?: string
          arquivo_path?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          inscricao_estadual?: string
          municipio_id?: string
          referencia?: string
          tamanho?: number | null
          tipo_mime?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acoes_recuperacao_anexos_municipio_id_fkey"
            columns: ["municipio_id"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["id"]
          },
        ]
      }
      cargas: {
        Row: {
          arquivo_ativos_path: string | null
          arquivo_retorno_path: string | null
          competencia_ajustada: boolean
          competencia_ajustada_em: string | null
          competencia_ajustada_por: string | null
          competencia_ano: number | null
          competencia_detectada_ano: number | null
          competencia_detectada_mes: number | null
          competencia_mes: number | null
          competencia_motivo: string | null
          concluida_em: string | null
          criado_em: string
          criado_por: string | null
          data_limite_entrega: string | null
          exercicio: number
          id: string
          limiar_discrepancia: number
          mensagem_erro: string | null
          mes_referencia: number | null
          municipio_id: string
          status: string
          tipo_retorno: string
          total_ativos: number | null
          total_discrepantes: number | null
          total_fora_prazo: number | null
          total_normais: number | null
          total_omissos: number | null
          total_simei: number | null
          total_simples_nacional: number | null
          total_zerados: number | null
        }
        Insert: {
          arquivo_ativos_path?: string | null
          arquivo_retorno_path?: string | null
          competencia_ajustada?: boolean
          competencia_ajustada_em?: string | null
          competencia_ajustada_por?: string | null
          competencia_ano?: number | null
          competencia_detectada_ano?: number | null
          competencia_detectada_mes?: number | null
          competencia_mes?: number | null
          competencia_motivo?: string | null
          concluida_em?: string | null
          criado_em?: string
          criado_por?: string | null
          data_limite_entrega?: string | null
          exercicio: number
          id?: string
          limiar_discrepancia?: number
          mensagem_erro?: string | null
          mes_referencia?: number | null
          municipio_id: string
          status?: string
          tipo_retorno?: string
          total_ativos?: number | null
          total_discrepantes?: number | null
          total_fora_prazo?: number | null
          total_normais?: number | null
          total_omissos?: number | null
          total_simei?: number | null
          total_simples_nacional?: number | null
          total_zerados?: number | null
        }
        Update: {
          arquivo_ativos_path?: string | null
          arquivo_retorno_path?: string | null
          competencia_ajustada?: boolean
          competencia_ajustada_em?: string | null
          competencia_ajustada_por?: string | null
          competencia_ano?: number | null
          competencia_detectada_ano?: number | null
          competencia_detectada_mes?: number | null
          competencia_mes?: number | null
          competencia_motivo?: string | null
          concluida_em?: string | null
          criado_em?: string
          criado_por?: string | null
          data_limite_entrega?: string | null
          exercicio?: number
          id?: string
          limiar_discrepancia?: number
          mensagem_erro?: string | null
          mes_referencia?: number | null
          municipio_id?: string
          status?: string
          tipo_retorno?: string
          total_ativos?: number | null
          total_discrepantes?: number | null
          total_fora_prazo?: number | null
          total_normais?: number | null
          total_omissos?: number | null
          total_simei?: number | null
          total_simples_nacional?: number | null
          total_zerados?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cargas_municipio_id_fkey"
            columns: ["municipio_id"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_municipio: {
        Row: {
          atualizado_em: string
          brasao_path: string | null
          cidade_data: string
          criado_em: string
          endereco_rodape: string
          estado: string
          id: string
          municipio_id: string
          nome_prefeitura: string
          secretaria: string
          setor: string
          signatario_cargo: string
          signatario_nome: string
          texto_assinatura: string
        }
        Insert: {
          atualizado_em?: string
          brasao_path?: string | null
          cidade_data?: string
          criado_em?: string
          endereco_rodape?: string
          estado?: string
          id?: string
          municipio_id: string
          nome_prefeitura?: string
          secretaria?: string
          setor?: string
          signatario_cargo?: string
          signatario_nome?: string
          texto_assinatura?: string
        }
        Update: {
          atualizado_em?: string
          brasao_path?: string | null
          cidade_data?: string
          criado_em?: string
          endereco_rodape?: string
          estado?: string
          id?: string
          municipio_id?: string
          nome_prefeitura?: string
          secretaria?: string
          setor?: string
          signatario_cargo?: string
          signatario_nome?: string
          texto_assinatura?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_municipio_municipio_id_fkey"
            columns: ["municipio_id"]
            isOneToOne: true
            referencedRelation: "municipios"
            referencedColumns: ["id"]
          },
        ]
      }
      contribuintes_apurados: {
        Row: {
          carga_id: string
          cnae: string | null
          cnpj: string | null
          criado_em: string
          data_entrega: string | null
          endereco: string | null
          entregou_declaracao: boolean
          id: string
          inscricao_estadual: string
          mes_fim_atividade: number | null
          mes_inicio_atividade: number | null
          municipio_id: string
          nome: string | null
          oficio_path: string | null
          regime_recolhimento: string | null
          situacao_cadastral: string | null
          situacao_cadastral_data: string | null
          situacoes: string[]
          vaf_anterior: number | null
          vaf_atual: number | null
          variacao_pct: number | null
        }
        Insert: {
          carga_id: string
          cnae?: string | null
          cnpj?: string | null
          criado_em?: string
          data_entrega?: string | null
          endereco?: string | null
          entregou_declaracao?: boolean
          id?: string
          inscricao_estadual: string
          mes_fim_atividade?: number | null
          mes_inicio_atividade?: number | null
          municipio_id: string
          nome?: string | null
          oficio_path?: string | null
          regime_recolhimento?: string | null
          situacao_cadastral?: string | null
          situacao_cadastral_data?: string | null
          situacoes?: string[]
          vaf_anterior?: number | null
          vaf_atual?: number | null
          variacao_pct?: number | null
        }
        Update: {
          carga_id?: string
          cnae?: string | null
          cnpj?: string | null
          criado_em?: string
          data_entrega?: string | null
          endereco?: string | null
          entregou_declaracao?: boolean
          id?: string
          inscricao_estadual?: string
          mes_fim_atividade?: number | null
          mes_inicio_atividade?: number | null
          municipio_id?: string
          nome?: string | null
          oficio_path?: string | null
          regime_recolhimento?: string | null
          situacao_cadastral?: string | null
          situacao_cadastral_data?: string | null
          situacoes?: string[]
          vaf_anterior?: number | null
          vaf_atual?: number | null
          variacao_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contribuintes_apurados_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribuintes_apurados_municipio_id_fkey"
            columns: ["municipio_id"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["id"]
          },
        ]
      }
      evolucoes_salvas: {
        Row: {
          arquivo_atual_nome: string
          arquivo_base_nome: string
          atual: Json
          atualizado_em: string
          base: Json
          criado_em: string
          criado_por: string | null
          id: string
          municipio_id: string
          nome: string
          observacao: string | null
          vaf_referencia: string | null
        }
        Insert: {
          arquivo_atual_nome: string
          arquivo_base_nome: string
          atual: Json
          atualizado_em?: string
          base: Json
          criado_em?: string
          criado_por?: string | null
          id?: string
          municipio_id: string
          nome: string
          observacao?: string | null
          vaf_referencia?: string | null
        }
        Update: {
          arquivo_atual_nome?: string
          arquivo_base_nome?: string
          atual?: Json
          atualizado_em?: string
          base?: Json
          criado_em?: string
          criado_por?: string | null
          id?: string
          municipio_id?: string
          nome?: string
          observacao?: string | null
          vaf_referencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evolucoes_salvas_municipio_id_fkey"
            columns: ["municipio_id"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["id"]
          },
        ]
      }
      indices_apurados: {
        Row: {
          acerto_credito: number
          acerto_debito: number
          arquivo_credito_proprio: string | null
          arquivo_nome: string | null
          atualizado_em: string
          carga_id: string | null
          competencia_ano: number | null
          competencia_mes: number | null
          credito_externo: number
          credito_interno: number
          credito_proprio: number
          criado_em: string
          criado_por: string | null
          debito: number
          detalhamento_path: string | null
          estimado: boolean
          exercicio: number
          fator_calibragem: number
          id: string
          indice: number
          municipio_id: string
          origem_credito_proprio: string | null
          origem_vaf_estadual: string | null
          periodo_fim: string | null
          periodo_inicio: string | null
          tipo_indice: string
          total_declaracoes: number
          vaf_estadual: number
          vaf_proprio: number
          valor_liquido: number
        }
        Insert: {
          acerto_credito?: number
          acerto_debito?: number
          arquivo_credito_proprio?: string | null
          arquivo_nome?: string | null
          atualizado_em?: string
          carga_id?: string | null
          competencia_ano?: number | null
          competencia_mes?: number | null
          credito_externo?: number
          credito_interno?: number
          credito_proprio?: number
          criado_em?: string
          criado_por?: string | null
          debito?: number
          detalhamento_path?: string | null
          estimado?: boolean
          exercicio: number
          fator_calibragem?: number
          id?: string
          indice?: number
          municipio_id: string
          origem_credito_proprio?: string | null
          origem_vaf_estadual?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          tipo_indice?: string
          total_declaracoes?: number
          vaf_estadual?: number
          vaf_proprio?: number
          valor_liquido?: number
        }
        Update: {
          acerto_credito?: number
          acerto_debito?: number
          arquivo_credito_proprio?: string | null
          arquivo_nome?: string | null
          atualizado_em?: string
          carga_id?: string | null
          competencia_ano?: number | null
          competencia_mes?: number | null
          credito_externo?: number
          credito_interno?: number
          credito_proprio?: number
          criado_em?: string
          criado_por?: string | null
          debito?: number
          detalhamento_path?: string | null
          estimado?: boolean
          exercicio?: number
          fator_calibragem?: number
          id?: string
          indice?: number
          municipio_id?: string
          origem_credito_proprio?: string | null
          origem_vaf_estadual?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          tipo_indice?: string
          total_declaracoes?: number
          vaf_estadual?: number
          vaf_proprio?: number
          valor_liquido?: number
        }
        Relationships: [
          {
            foreignKeyName: "indices_apurados_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indices_apurados_municipio_id_fkey"
            columns: ["municipio_id"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs_lease: {
        Row: {
          atualizado_em: string
          chave: string
          expira_em: string
        }
        Insert: {
          atualizado_em?: string
          chave: string
          expira_em: string
        }
        Update: {
          atualizado_em?: string
          chave?: string
          expira_em?: string
        }
        Relationships: []
      }
      modelos_oficio: {
        Row: {
          ativo: boolean
          atualizado_em: string
          chave: string
          corpo: string
          criado_em: string
          id: string
          municipio_id: string
          nome: string
          situacao: string
          titulo: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          chave: string
          corpo?: string
          criado_em?: string
          id?: string
          municipio_id: string
          nome: string
          situacao: string
          titulo?: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          chave?: string
          corpo?: string
          criado_em?: string
          id?: string
          municipio_id?: string
          nome?: string
          situacao?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "modelos_oficio_municipio_id_fkey"
            columns: ["municipio_id"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["id"]
          },
        ]
      }
      municipios: {
        Row: {
          codigo_sef: string
          criado_em: string
          id: string
          nome: string
          uf: string
        }
        Insert: {
          codigo_sef: string
          criado_em?: string
          id?: string
          nome: string
          uf?: string
        }
        Update: {
          codigo_sef?: string
          criado_em?: string
          id?: string
          nome?: string
          uf?: string
        }
        Relationships: []
      }
      oficios_emitidos: {
        Row: {
          arquivo_nome: string | null
          baixado_em: string | null
          carga_id: string | null
          cnpj: string | null
          contribuinte_id: string | null
          criado_em: string
          emitido_por: string | null
          emitido_por_nome: string | null
          erro_mensagem: string | null
          exercicio: number
          id: string
          inscricao_estadual: string
          modelo_chave: string
          modelo_nome: string
          municipio_id: string
          nome_contribuinte: string | null
          situacao: string
          status_download: string
          tipo_emissao: string
        }
        Insert: {
          arquivo_nome?: string | null
          baixado_em?: string | null
          carga_id?: string | null
          cnpj?: string | null
          contribuinte_id?: string | null
          criado_em?: string
          emitido_por?: string | null
          emitido_por_nome?: string | null
          erro_mensagem?: string | null
          exercicio: number
          id?: string
          inscricao_estadual: string
          modelo_chave: string
          modelo_nome: string
          municipio_id: string
          nome_contribuinte?: string | null
          situacao?: string
          status_download?: string
          tipo_emissao?: string
        }
        Update: {
          arquivo_nome?: string | null
          baixado_em?: string | null
          carga_id?: string | null
          cnpj?: string | null
          contribuinte_id?: string | null
          criado_em?: string
          emitido_por?: string | null
          emitido_por_nome?: string | null
          erro_mensagem?: string | null
          exercicio?: number
          id?: string
          inscricao_estadual?: string
          modelo_chave?: string
          modelo_nome?: string
          municipio_id?: string
          nome_contribuinte?: string | null
          situacao?: string
          status_download?: string
          tipo_emissao?: string
        }
        Relationships: [
          {
            foreignKeyName: "oficios_emitidos_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oficios_emitidos_contribuinte_id_fkey"
            columns: ["contribuinte_id"]
            isOneToOne: false
            referencedRelation: "contribuintes_apurados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oficios_emitidos_municipio_id_fkey"
            columns: ["municipio_id"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          criado_em: string
          id: string
          municipio_id: string | null
          nome: string | null
          papel: string
          precisa_trocar_senha: boolean
        }
        Insert: {
          criado_em?: string
          id: string
          municipio_id?: string | null
          nome?: string | null
          papel?: string
          precisa_trocar_senha?: boolean
        }
        Update: {
          criado_em?: string
          id?: string
          municipio_id?: string | null
          nome?: string | null
          papel?: string
          precisa_trocar_senha?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "perfis_municipio_id_fkey"
            columns: ["municipio_id"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["id"]
          },
        ]
      }
      preferencias_usuario: {
        Row: {
          atualizado_em: string
          chave: string
          criado_em: string
          usuario_id: string
          valor: Json
        }
        Insert: {
          atualizado_em?: string
          chave: string
          criado_em?: string
          usuario_id: string
          valor: Json
        }
        Update: {
          atualizado_em?: string
          chave?: string
          criado_em?: string
          usuario_id?: string
          valor?: Json
        }
        Relationships: []
      }
      receita_fila: {
        Row: {
          atualizado_em: string
          cnpj: string
          criado_em: string
          proxima_em: string
          status: string
          tentativas: number
          ultimo_erro: string | null
        }
        Insert: {
          atualizado_em?: string
          cnpj: string
          criado_em?: string
          proxima_em?: string
          status?: string
          tentativas?: number
          ultimo_erro?: string | null
        }
        Update: {
          atualizado_em?: string
          cnpj?: string
          criado_em?: string
          proxima_em?: string
          status?: string
          tentativas?: number
          ultimo_erro?: string | null
        }
        Relationships: []
      }
      situacoes_receita: {
        Row: {
          atualizado_em: string
          cnae_principal: string | null
          cnpj: string
          consultado_em: string
          criado_em: string
          fonte: string
          motivo: string | null
          municipio: string | null
          nome_fantasia: string | null
          payload: Json | null
          razao_social: string | null
          situacao: string
          situacao_data: string | null
          uf: string | null
        }
        Insert: {
          atualizado_em?: string
          cnae_principal?: string | null
          cnpj: string
          consultado_em?: string
          criado_em?: string
          fonte: string
          motivo?: string | null
          municipio?: string | null
          nome_fantasia?: string | null
          payload?: Json | null
          razao_social?: string | null
          situacao: string
          situacao_data?: string | null
          uf?: string | null
        }
        Update: {
          atualizado_em?: string
          cnae_principal?: string | null
          cnpj?: string
          consultado_em?: string
          criado_em?: string
          fonte?: string
          motivo?: string | null
          municipio?: string | null
          nome_fantasia?: string | null
          payload?: Json | null
          razao_social?: string | null
          situacao?: string
          situacao_data?: string | null
          uf?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
