export interface Transaction {
  id: number;
  data: string;
  valor: number;
  dataPagamento?: string;
  valorPg?: number;
  tipo: string; // 'RECEITA' | 'DESPESA' | 'PAGO' | 'ETANOL' | 'GAS. COMUM' | etc.
  descricao: string;
  categoria: string; // 'TRABALHO' | 'ABASTECIMENTO' | 'CASA' | 'CONSUMO' | 'PESSOAL' | etc.
  status: string; // 'PAGO' | 'PENDENTE' | 'ATRASADO'
  bancoId?: number;
  bancoNome?: string;
  destBancoId?: number;
  destBancoNome?: string;
  origemAbastecimentoId?: number;
  km?: number;
  litros?: number;
  precoLitro?: number;
  veiculo?: string;
  descricaoVeiculo?: string;
  completouTanque?: boolean;
  mediaKmL?: number;
  kmPercorrido?: number;
  nomePosto?: string;
  localizacaoPosto?: string;
  motorista?: string;
  obs?: string;
  temJuros?: boolean;
  valorJuros?: number;
  updatedAt?: number;
}

export interface RiskZone {
  id: number;
  localizacao: string; // "latitude, longitude"
  latitude: number;
  longitude: number;
  dataRegistro: string;
  dataHora: string;
  status: string; // '⚠️ EM ÁREA DE RISCO!' | '✅ Seguro'
  nomeLocal: string;
  raioMetros: number;
  nivelRisco: 'ALTO' | 'BAIXO' | 'MEDIO';
  statusGeral: 'DISPARAR' | 'VAZIO' | 'ALERTA';
  ativo: boolean;
  mensagem?: string;
  som?: string;
  voz?: string;
  sentido?: string;
}

export interface Infraction {
  id: string;
  protocolo: string;
  titulo: string;
  placa: string;
  veiculo: string;
  dataSubmissao: string;
  dataOcorrencia: string;
  localizacao: string;
  status: 'EM_ANALISE' | 'APROVADO' | 'NEGADO';
  valorMulta: number;
  pontosCnh: number;
  justificativa?: string;
  evidencias: { nome: string; tamanho: string; tipo: 'image' | 'pdf' }[];
}

export interface BankAccount {
  id: number;
  nome: string;
  tipo: 'BANCO' | 'PESSOAL';
  agencia?: string;
  conta?: string;
  saldoInicial: number;
  limite?: number;
}

export interface CreditCard {
  id: number;
  nome: string;
  tipo: 'CARTÃO';
  limite: number;
  gasto: number;
}

export interface MedicalAppointment {
  id: string;
  especialidade: string;
  medico: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  local: string;
  observacoes?: string;
  status: 'Agendada' | 'Realizada' | 'Cancelada';
  lembreteAtivo: boolean;
  updatedAt?: number;
}

export interface MedicalPrescription {
  id: string;
  medico: string;
  especialidade: string;
  data: string; // YYYY-MM-DD
  medicamentos: string; // Rich text list of medications
  instrucoes?: string; // Instructions for taking
  observacoes?: string;
  dataVencimento?: string; // YYYY-MM-DD expiration date
  arquivoAnexo?: string; // Base64 data of prescription (PDF or Image)
  nomeArquivoAnexo?: string; // original filename
  tipoArquivoAnexo?: string; // mime type (e.g. application/pdf, image/*)
  status?: 'Ativa' | 'Baixada';
  updatedAt?: number;
}

export interface RegisteredVehicle {
  id: string;
  descricao: string; // ex: "FOX PRATA"
  motorista: string; // ex: "ALEXANDRE"
  placa?: string; // ex: "ABC-1234"
  mesFinalPlaca?: number; // Mês final/vencimento (1-12) para o IPVA
}

export interface Compromisso {
  id: string;
  titulo: string;
  data: string; // YYYY-MM-DD
  hora?: string; // HH:MM
  descricao?: string;
  cor: string; // Hex color (e.g., "#22c55e", "#3b82f6", etc.)
  piscando?: boolean; // whether the indicator should flash/pulse
  lembreteAtivo: boolean;
  diasAntecedencia: number; // default is 2 days
  concluido?: boolean;
  updatedAt?: number;
}

export interface CarServicePerformed {
  id: string;
  veiculoDescricao: string;
  descricao: string;
  data: string; // YYYY-MM-DD
  km?: number;
  valor?: number;
  oficina?: string;
  observacoes?: string;
  updatedAt?: number;
}

export interface CarServiceScheduled {
  id: string;
  veiculoDescricao: string;
  descricao: string;
  tipoAgendamento: 'DATA' | 'KM' | 'DATA_E_KM';
  dataAlvo?: string; // YYYY-MM-DD
  kmAlvo?: number;
  recorrente: boolean;
  frequenciaMeses?: number;
  frequenciaKm?: number;
  status: 'PENDENTE' | 'REALIZADO' | 'ATRASADO';
  updatedAt?: number;
}export interface SecurityConfig {
  enabled: boolean;
  mode: 'SENHA' | 'PIN' | 'BIOMETRIA';
  password?: string;
  pin?: string;
  biometricType?: 'FACE_ID' | 'TOUCH_ID';
}

export interface SavingsGoal {
  id: string;
  nome: string;
  valorAlvo: number;
  valorAtual: number;
  prazo?: string; // YYYY-MM-DD
  categoria?: string;
  descricao?: string;
  updatedAt?: number;
}

