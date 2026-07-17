import { Infraction } from '../types';

export const initialInfractions: Infraction[] = [
  {
    id: "1",
    protocolo: "PR-2023-8842",
    titulo: "Excesso de Velocidade (>20%)",
    placa: "ABC-1234",
    veiculo: "Toyota Hilux",
    dataSubmissao: "12 Out 2023",
    dataOcorrencia: "10 Out 2023, 14:32",
    localizacao: "Av. Paulista, 1000 - São Paulo, SP",
    status: "EM_ANALISE",
    valorMulta: 195.23,
    pontosCnh: 5,
    justificativa: "O veículo estava em conformidade com a velocidade permitida no momento do registro. O painel de instrumentos marcava 48km/h, conforme foto em anexo. Solicito revisão baseada no log de GPS do veículo que comprova que a velocidade máxima atingida naquela via foi de 50km/h.",
    evidencias: [
      { nome: "foto_painel.jpg", tamanho: "2.4 MB", tipo: "image" },
      { nome: "log_gps_veiculo.pdf", tamanho: "850 KB", tipo: "pdf" }
    ]
  },
  {
    id: "2",
    protocolo: "PR-2023-7710",
    titulo: "Estacionamento Proibido",
    placa: "XYZ-5678",
    veiculo: "Ford Cargo",
    dataSubmissao: "05 Set 2023",
    dataOcorrencia: "03 Set 2023, 11:20",
    localizacao: "Av. Faria Lima, 2500 - São Paulo, SP",
    status: "APROVADO",
    valorMulta: 130.16,
    pontosCnh: 4,
    justificativa: "O recurso foi deferido com base na comprovação de pane mecânica grave. A multa foi cancelada e a pontuação removida.",
    evidencias: [
      { nome: "laudo_guincho.pdf", tamanho: "1.1 MB", tipo: "pdf" }
    ]
  },
  {
    id: "3",
    protocolo: "PR-2023-4421",
    titulo: "Avanço de Sinal Vermelho",
    placa: "JKL-9012",
    veiculo: "Volkswagen Delivery",
    dataSubmissao: "22 Ago 2023",
    dataOcorrencia: "20 Ago 2023, 03:15",
    localizacao: "Rua da Consolação, 500 - São Paulo, SP",
    status: "NEGADO",
    valorMulta: 293.47,
    pontosCnh: 7,
    justificativa: "Recurso indeferido por insuficiência de provas. A sinalização local encontra-se em conformidade com o CTB.",
    evidencias: []
  },
  {
    id: "4",
    protocolo: "PR-2023-9102",
    titulo: "Conversão Proibida",
    placa: "MNO-3456",
    veiculo: "Mercedes-Benz Accelo",
    dataSubmissao: "01 Nov 2023",
    dataOcorrencia: "28 Out 2023, 17:40",
    localizacao: "Av. Brigadeiro Luís Antônio, 3000 - São Paulo, SP",
    status: "EM_ANALISE",
    valorMulta: 195.23,
    pontosCnh: 5,
    justificativa: "Conversão efetuada sob orientação de agente de trânsito devido a bloqueio de via por acidente à frente.",
    evidencias: [
      { nome: "foto_agente_transito.jpg", tamanho: "3.2 MB", tipo: "image" }
    ]
  }
];

export const nonAppealedInfractions: Omit<Infraction, 'status' | 'justificativa' | 'evidencias' | 'dataSubmissao'>[] = [
  {
    id: "N1",
    protocolo: "PR-2026-1021",
    titulo: "Excesso de Velocidade - 110km/h",
    placa: "ABC-1234",
    veiculo: "Caminhão Scania R450",
    dataOcorrencia: "02 Jul 2026, 14:30",
    localizacao: "Rodovia BR-101, Km 234 - Joinville/SC",
    valorMulta: 195.23,
    pontosCnh: 5
  },
  {
    id: "N2",
    protocolo: "PR-2026-1022",
    titulo: "Entrada em Área de Risco Crítico",
    placa: "XYZ-9876",
    veiculo: "Van Mercedes Sprinter",
    dataOcorrencia: "02 Jul 2026, 10:15",
    localizacao: "Zona Industrial Norte - Rio de Janeiro/RJ",
    valorMulta: 0.00,
    pontosCnh: 0
  },
  {
    id: "N3",
    protocolo: "PR-2026-1023",
    titulo: "Tempo de Condução Excedido (>4.5h)",
    placa: "JKL-5544",
    veiculo: "Caminhão Volvo FH540",
    dataOcorrencia: "01 Jul 2026, 22:45",
    localizacao: "Posto Graal, BR-116 - Curitiba/PR",
    valorMulta: 130.16,
    pontosCnh: 4
  },
  {
    id: "N4",
    protocolo: "PR-2026-1024",
    titulo: "Excesso de Velocidade - 95km/h",
    placa: "OPQ-2233",
    veiculo: "VW Delivery Express",
    dataOcorrencia: "01 Jul 2026, 16:20",
    localizacao: "Avenida Paulista, 1500 - São Paulo/SP",
    valorMulta: 130.16,
    pontosCnh: 4
  }
];
