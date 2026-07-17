import { Transaction, BankAccount, CreditCard } from '../types';

export const bankAccounts: BankAccount[] = [
  { id: 1, nome: "NUBANK", tipo: "BANCO", agencia: "0001", conta: "1234567-8", saldoInicial: 2450.0, limite: 1000.0 },
  { id: 2, nome: "BANCO DO BRASIL", tipo: "BANCO", agencia: "1234-5", conta: "98765-4", saldoInicial: 1540.50, limite: 500.0 },
  { id: 3, nome: "ITAU", tipo: "BANCO", agencia: "4321", conta: "56789-0", saldoInicial: 1200.0, limite: 2000.0 },
  { id: 4, nome: "PESSOAL", tipo: "PESSOAL", saldoInicial: 350.0, limite: 0.0 }
];

export const creditCards: CreditCard[] = [
  { id: 5, nome: "NUBANK", tipo: "CARTÃO", limite: 5000.0, gasto: 601.87 },
  { id: 6, nome: "SANTANDER", tipo: "CARTÃO", limite: 3000.0, gasto: 150.0 },
  { id: 7, nome: "BV", tipo: "CARTÃO", limite: 4000.0, gasto: 0.0 },
  { id: 8, nome: "ATACADÃO", tipo: "CARTÃO", limite: 2500.0, gasto: 417.60 }
];

export const initialTransactions: Transaction[] = [
  // Accounts Setup Rows
  { id: 1, data: "28/06/2026", valor: 0, tipo: "CONTAS BANCARIAS", descricao: "NUBANK", categoria: "BANCO", status: "PAGO" },
  { id: 2, data: "28/06/2026", valor: 0, tipo: "CONTAS BANCARIAS", descricao: "BANCO DO BRASIL", categoria: "BANCO", status: "PAGO" },
  { id: 3, data: "28/06/2026", valor: 0, tipo: "CONTAS BANCARIAS", descricao: "ITAU", categoria: "BANCO", status: "PAGO" },
  { id: 4, data: "28/06/2026", valor: 0, tipo: "CONTAS BANCARIAS", descricao: "PESSOAL", categoria: "PESSOAL", status: "PAGO" },
  { id: 5, data: "28/06/2026", valor: 0, tipo: "CARTÃO DE CRÉDITO", descricao: "NUBANK", categoria: "CARTÃO", status: "PAGO" },
  { id: 6, data: "28/06/2026", valor: 0, tipo: "CARTÃO DE CRÉDITO", descricao: "SANTANDER", categoria: "CARTÃO", status: "PAGO" },
  { id: 7, data: "28/06/2026", valor: 0, tipo: "CARTÃO DE CRÉDITO", descricao: "BV", categoria: "CARTÃO", status: "PAGO" },
  { id: 8, data: "28/06/2026", valor: 0, tipo: "CARTÃO DE CRÉDITO", descricao: "ATACADÃO", categoria: "CARTÃO", status: "PAGO" },

  // Live Transactions
  { id: 220, data: "08/07/2026", valor: 150.00, tipo: "DESPESA", descricao: "FATURA INTERNET VENCENDO AMANHÃ", categoria: "CONSUMO", status: "PENDENTE" },
  { id: 219, data: "07/07/2026", valor: 350.00, tipo: "DESPESA", descricao: "CONDOMÍNIO VENCENDO HOJE", categoria: "CASA", status: "PENDENTE" },
  { id: 218, data: "01/07/2026", valor: 40.0, tipo: "ETANOL", descricao: "POSTO GUARANI CAMPINAS", categoria: "ABASTECIMENTO", status: "PENDENTE", origemAbastecimentoId: 69 },
  { id: 217, data: "30/06/2026", valor: 50.0, tipo: "GAS. COMUM", descricao: "TOFLL", categoria: "ABASTECIMENTO", status: "PAGO", origemAbastecimentoId: 68 },
  { id: 216, data: "29/06/2026", valor: 50.0, tipo: "ETANOL", descricao: "TOFLL", categoria: "ABASTECIMENTO", status: "PAGO", origemAbastecimentoId: 67 },
  { id: 140, data: "29/06/2026", valor: 1089.60, tipo: "PAGO", descricao: "PARCELA DO FOX", categoria: "CASA", status: "PAGO" },
  { id: 139, data: "28/06/2026", valor: 417.60, tipo: "PAGO", descricao: "ACORDO ATACADÃO", categoria: "CASA", status: "PAGO" },
  { id: 138, data: "26/06/2026", valor: 106.07, tipo: "PAGO", descricao: "FATURA AGUA", categoria: "CONSUMO", status: "PAGO" },
  { id: 137, data: "24/06/2026", valor: 601.87, tipo: "PAGO", descricao: "FATURA DO CARTÃO NUBANK", categoria: "CASA", status: "PAGO" },
  { id: 149, data: "23/06/2026", valor: 78.27, tipo: "RECEITA", descricao: "UBER", categoria: "TRABALHO", status: "PAGO" },
  { id: 148, data: "22/06/2026", valor: 63.48, tipo: "RECEITA", descricao: "UBER", categoria: "TRABALHO", status: "PAGO" },
  { id: 136, data: "17/06/2026", valor: 105.48, tipo: "PAGO", descricao: "FATURA CPFL", categoria: "CONSUMO", status: "PAGO" },
  
  // Historical receipts (June 2026)
  { id: 133, data: "10/06/2026", valor: 100.20, tipo: "RECEITA", descricao: "UBER", categoria: "TRABALHO", status: "PAGO" },
  { id: 126, data: "08/06/2026", valor: 63.22, tipo: "RECEITA", descricao: "UBER", categoria: "TRABALHO", status: "PAGO" },
  { id: 124, data: "06/06/2026", valor: 200.10, tipo: "RECEITA", descricao: "UBER", categoria: "TRABALHO", status: "PAGO" },
  { id: 120, data: "04/06/2026", valor: 141.99, tipo: "RECEITA", descricao: "UBER", categoria: "TRABALHO", status: "PAGO" },
  { id: 118, data: "03/06/2026", valor: 73.44, tipo: "RECEITA", descricao: "UBER", categoria: "TRABALHO", status: "PAGO" },
  { id: 114, data: "01/06/2026", valor: 62.08, tipo: "RECEITA", descricao: "UBER", categoria: "TRABALHO", status: "PAGO" },
  { id: 116, data: "01/06/2026", valor: 40.00, tipo: "PAGO", descricao: "FOX", categoria: "ABASTECIMENTO", status: "PAGO" },

  // Fuel list (May 2026 sample)
  { id: 215, data: "25/05/2026", valor: 50.00, tipo: "ETANOL", descricao: "Posto Ipiranga Vinhedo Guarita", categoria: "ABASTECIMENTO", status: "PAGO", origemAbastecimentoId: 66 },
  { id: 214, data: "24/05/2026", valor: 50.00, tipo: "ETANOL", descricao: "Br Rodoviária Vinhedo", categoria: "ABASTECIMENTO", status: "PAGO", origemAbastecimentoId: 65 },
  { id: 213, data: "23/05/2026", valor: 50.00, tipo: "ETANOL", descricao: "Tauris Portal de Valinhos", categoria: "ABASTECIMENTO", status: "PAGO", origemAbastecimentoId: 64 },
  { id: 212, data: "22/05/2026", valor: 50.00, tipo: "ETANOL", descricao: "São Fernando Sesi Valinhos", categoria: "ABASTECIMENTO", status: "PAGO", origemAbastecimentoId: 63 },
  { id: 211, data: "20/05/2026", valor: 47.02, tipo: "GAS. COMUM", descricao: "Br vl Santana", categoria: "ABASTECIMENTO", status: "PAGO", origemAbastecimentoId: 62 },
  { id: 210, data: "20/05/2026", valor: 50.00, tipo: "ETANOL", descricao: "GasPrime", categoria: "ABASTECIMENTO", status: "PAGO", origemAbastecimentoId: 61 },
  { id: 209, data: "18/05/2026", valor: 50.00, tipo: "ETANOL", descricao: "GasPrime", categoria: "ABASTECIMENTO", status: "PAGO", origemAbastecimentoId: 60 },
  { id: 208, data: "17/05/2026", valor: 50.00, tipo: "ETANOL", descricao: "Ipiranga", categoria: "ABASTECIMENTO", status: "PAGO", origemAbastecimentoId: 59 },

  // Late Debts
  { id: 69, data: "26/05/2026", valor: 88.66, tipo: "DESPESA", descricao: "IPTU 2016 5/12", categoria: "CASA", status: "ATRASADO" },
  { id: 66, data: "26/04/2026", valor: 88.66, tipo: "DESPESA", descricao: "IPTU 2016 4/12", categoria: "CASA", status: "ATRASADO" },
  { id: 68, data: "22/05/2026", valor: 87.05, tipo: "DESPESA", descricao: "EMPRESA", categoria: "PESSOAL", status: "ATRASADO" },
  { id: 67, data: "20/05/2026", valor: 87.05, tipo: "DESPESA", descricao: "EMPRESA", categoria: "PESSOAL", status: "ATRASADO" },
  { id: 65, data: "20/04/2026", valor: 93.96, tipo: "DESPESA", descricao: "EMPRESA", categoria: "PESSOAL", status: "ATRASADO" },
  { id: 64, data: "20/03/2026", valor: 103.51, tipo: "DESPESA", descricao: "EMPRESA", categoria: "PESSOAL", status: "ATRASADO" },
  { id: 63, data: "20/02/2026", valor: 107.32, tipo: "DESPESA", descricao: "EMPRESA", categoria: "PESSOAL", status: "ATRASADO" },
  { id: 62, data: "21/01/2026", valor: 101.80, tipo: "DESPESA", descricao: "EMPRESA", categoria: "PESSOAL", status: "ATRASADO" },
  { id: 61, data: "22/12/2025", valor: 102.74, tipo: "DESPESA", descricao: "EMPRESA", categoria: "PESSOAL", status: "ATRASADO" },
  { id: 60, data: "21/11/2025", valor: 103.75, tipo: "DESPESA", descricao: "EMPRESA", categoria: "PESSOAL", status: "ATRASADO" },
  { id: 59, data: "20/10/2025", valor: 104.62, tipo: "DESPESA", descricao: "EMPRESA", categoria: "PESSOAL", status: "ATRASADO" },
  { id: 58, data: "22/09/2025", valor: 105.66, tipo: "DESPESA", descricao: "EMPRESA", categoria: "PESSOAL", status: "ATRASADO" },
  { id: 57, data: "20/08/2025", valor: 106.65, tipo: "DESPESA", descricao: "EMPRESA", categoria: "PESSOAL", status: "ATRASADO" },
  { id: 56, data: "21/07/2025", valor: 107.61, tipo: "DESPESA", descricao: "EMPRESA", categoria: "PESSOAL", status: "ATRASADO" },

  // Historical UBER & 99 records
  { id: 111, data: "23/10/2025", valor: 50.57, tipo: "RECEITA", descricao: "UBER", categoria: "TRABALHO", status: "PAGO" },
  { id: 101, data: "10/10/2025", valor: 130.48, tipo: "RECEITA", descricao: "UBER", categoria: "TRABALHO", status: "PAGO" },
  { id: 91, data: "25/09/2025", valor: 168.42, tipo: "RECEITA", descricao: "UBER", categoria: "TRABALHO", status: "PAGO" },
  { id: 83, data: "09/09/2025", valor: 146.67, tipo: "RECEITA", descricao: "UBER", categoria: "TRABALHO", status: "PAGO" },
  { id: 79, data: "29/08/2025", valor: 105.57, tipo: "RECEITA", descricao: "UBER", categoria: "TRABALHO", status: "PAGO" },
  { id: 45, data: "18/07/2025", valor: 124.59, tipo: "RECEITA", descricao: "UBER", categoria: "TRABALHO", status: "PAGO" },
  { id: 35, data: "19/06/2025", valor: 154.21, tipo: "RECEITA", descricao: "UBER", categoria: "TRABALHO", status: "PAGO" },
  { id: 24, data: "14/03/2025", valor: 198.41, tipo: "RECEITA", descricao: "UBER", categoria: "TRABALHO", status: "PAGO" },
  { id: 11, data: "03/03/2025", valor: 259.72, tipo: "RECEITA", descricao: "UBER", categoria: "TRABALHO", status: "PAGO" }
];
