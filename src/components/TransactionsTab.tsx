import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction, Infraction, RegisteredVehicle, BankAccount } from '../types';
import { DateComboInput } from './DateComboInput';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { 
    opacity: 1, 
    y: 0, 
    transition: { 
      type: 'spring', 
      stiffness: 260, 
      damping: 20 
    } 
  }
};

interface TransactionsTabProps {
  transactions: Transaction[];
  infractions: Infraction[];
  onAddTransaction: (tx: Omit<Transaction, 'id'> | Omit<Transaction, 'id'>[]) => void;
  onEditTransaction: (id: number, tx: Partial<Transaction>) => void;
  onDeleteTransaction: (id: number) => void;
  onImportTransactions: (importedTxs: Transaction[]) => Promise<void>;
  onWipeTransactions?: () => Promise<void>;
  onReindexTransactions?: () => Promise<void>;
  showAddForm: boolean;
  setShowAddForm: (show: boolean) => void;

  showAlert?: (title: string, message: string) => void;
  showConfirm?: (title: string, message: string, onConfirm: () => void) => void;

  // Shared Google Sync props
  googleUser: any;
  googleToken: string | null;
  isSyncing: boolean;
  isImporting: boolean;
  spreadsheetUrl: string;
  syncError: string | null;
  lastSyncedTime: string;
  autoSync: boolean;
  onGoogleLogin: () => Promise<void>;
  onGoogleLogout: () => Promise<void>;
  onToggleAutoSync: (checked: boolean) => void;
  onTriggerSync: (token?: string) => Promise<void>;
  onTriggerImport: () => Promise<void>;

  registeredVehicles: RegisteredVehicle[];
  setRegisteredVehicles: React.Dispatch<React.SetStateAction<RegisteredVehicle[]>>;

  bankAccounts?: BankAccount[];
  onUpdateBankAccounts?: (accounts: BankAccount[]) => void;
  customCategories?: string[];
  onTriggerBankIntegration?: (bancoId: number, valor: number, descricao: string) => void;
}

export default function TransactionsTab({
  transactions,
  infractions,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onImportTransactions,
  onWipeTransactions,
  onReindexTransactions,
  showAddForm,
  setShowAddForm,
  showAlert,
  showConfirm,

  // Google Sync props
  googleUser,
  googleToken,
  isSyncing,
  isImporting,
  spreadsheetUrl,
  syncError,
  lastSyncedTime,
  autoSync,
  onGoogleLogin,
  onGoogleLogout,
  onToggleAutoSync,
  onTriggerSync,
  onTriggerImport,

  registeredVehicles,
  setRegisteredVehicles,

  bankAccounts = [],
  onUpdateBankAccounts,
  customCategories = [],
  onTriggerBankIntegration
}: TransactionsTabProps) {
  const [searchTerm, setSearchInput] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<string>('todos'); // 'todos' | 'receita' | 'despesa' | 'abastecimento' | 'casa' | 'consumo'
  const [statusFilter, setStatusFilter] = useState<'todos' | 'a_pagar' | 'pago' | 'vencendo_48h'>('todos');
  const [periodoInicio, setPeriodoInicio] = useState<string>('');
  const [periodoFim, setPeriodoFim] = useState<string>('');
  const [limiteLancamentos] = useState<number>(15);
  const [ignorarLimite, setIgnorarLimite] = useState<boolean>(false);

  useEffect(() => {
    setIgnorarLimite(false);
  }, [selectedFilter, statusFilter]);

  const setPeriodPreset = (preset: 'este_mes' | 'mes_passado' | '30_dias' | '90_dias' | 'este_ano' | 'tudo') => {
    const today = new Date();
    const formatDate = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    if (preset === 'este_mes') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setPeriodoInicio(formatDate(start));
      setPeriodoFim(formatDate(end));
    } else if (preset === 'mes_passado') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      setPeriodoInicio(formatDate(start));
      setPeriodoFim(formatDate(end));
    } else if (preset === '30_dias') {
      const start = new Date();
      start.setDate(today.getDate() - 30);
      setPeriodoInicio(formatDate(start));
      setPeriodoFim(formatDate(today));
    } else if (preset === '90_dias') {
      const start = new Date();
      start.setDate(today.getDate() - 90);
      setPeriodoInicio(formatDate(start));
      setPeriodoFim(formatDate(today));
    } else if (preset === 'este_ano') {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear(), 11, 31);
      setPeriodoInicio(formatDate(start));
      setPeriodoFim(formatDate(end));
    } else {
      setPeriodoInicio('');
      setPeriodoFim('');
    }
  };

  const isPresetActive = (preset: 'este_mes' | 'mes_passado' | '30_dias' | '90_dias' | 'este_ano'): boolean => {
    if (!periodoInicio || !periodoFim) return false;
    const today = new Date();
    const formatDate = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    if (preset === 'este_mes') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return periodoInicio === formatDate(start) && periodoFim === formatDate(end);
    }
    if (preset === 'mes_passado') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return periodoInicio === formatDate(start) && periodoFim === formatDate(end);
    }
    if (preset === '30_dias') {
      const start = new Date();
      start.setDate(today.getDate() - 30);
      return periodoInicio === formatDate(start) && periodoFim === formatDate(today);
    }
    if (preset === '90_dias') {
      const start = new Date();
      start.setDate(today.getDate() - 90);
      return periodoInicio === formatDate(start) && periodoFim === formatDate(today);
    }
    if (preset === 'este_ano') {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear(), 11, 31);
      return periodoInicio === formatDate(start) && periodoFim === formatDate(end);
    }
    return false;
  };

  const parseTxDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    return new Date(year, month, day);
  };

  const parseInputDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    return new Date(year, month, day);
  };

  const alertUser = (title: string, message: string) => {
    if (showAlert) {
      showAlert(title, message);
    } else {
      alert(message);
    }
  };

  const confirmUser = (title: string, message: string, onConfirm: () => void) => {
    if (showConfirm) {
      showConfirm(title, message, onConfirm);
    } else {
      if (confirm(message)) {
        onConfirm();
      }
    }
  };

  
  // Export Transactions as a CSV Spreadsheet
  const handleExportCSV = () => {
    // Order transactions by date (ascending) to calculate KM differences for fuel efficiency
    const sortedTx = [...transactions].sort((a, b) => {
      const partsA = (a.data || '').split('/');
      const partsB = (b.data || '').split('/');
      const dateA = partsA.length === 3 ? new Date(`${partsA[2]}-${partsA[1]}-${partsA[0]}`).getTime() : 0;
      const dateB = partsB.length === 3 ? new Date(`${partsB[2]}-${partsB[1]}-${partsB[0]}`).getTime() : 0;
      return dateA - dateB;
    });

    const kmMapByVehicle: { [vehicle: string]: number } = {};
    const kmPercorridoByTxId: { [txId: number]: number } = {};
    const mediaMapByTxId: { [txId: number]: number } = {};

    sortedTx.forEach(t => {
      if (t.categoria === 'ABASTECIMENTO' && t.km) {
        const vehicle = (t.veiculo || 'CARRO').toUpperCase();
        const prevKm = kmMapByVehicle[vehicle];
        if (prevKm !== undefined && t.km > prevKm) {
          const distance = t.km - prevKm;
          kmPercorridoByTxId[t.id] = distance;
          if (t.litros && t.litros > 0) {
            mediaMapByTxId[t.id] = distance / t.litros;
          }
        }
        kmMapByVehicle[vehicle] = t.km;
      }
    });

    const headers = [
      "ID", "Data", "Descricao", "Categoria", "Valor (RS)", "Tipo", "Status",
      "Valor_PG", "KM", "Litros", "Preco por Litro", "Veiculo",
      "Completou o Tanque", "KM Percorrido", "Media (Km/L)",
      "Nome Posto", "Localizacao do Posto", "Motorista", "OBS", "Descricao do Veiculo"
    ];

    const rows = transactions.map(t => {
      const isAbastecimento = t.categoria === 'ABASTECIMENTO';
      const media = mediaMapByTxId[t.id];
      const kmPerc = kmPercorridoByTxId[t.id];
      const valorPgVal = t.valorPg !== undefined ? t.valorPg : (t.status === 'PAGO' ? t.valor : 0);

      return [
        t.id,
        t.data,
        `"${t.descricao.replace(/"/g, '""')}"`,
        t.categoria,
        t.valor.toFixed(2).replace('.', ','),
        isAbastecimento ? (t.tipo || 'DESPESA') : (t.tipo === 'RECEITA' ? 'Receita' : 'Despesa'),
        t.status,
        valorPgVal.toFixed(2).replace('.', ','),
        isAbastecimento && t.km ? String(t.km) : '',
        isAbastecimento && t.litros ? t.litros.toFixed(2).replace('.', ',') : '',
        isAbastecimento && t.precoLitro ? t.precoLitro.toFixed(2).replace('.', ',') : '',
        isAbastecimento ? `"${(t.veiculo || 'CARRO').replace(/"/g, '""')}"` : '',
        isAbastecimento ? (t.completouTanque ? 'Sim' : 'Não') : '',
        isAbastecimento && kmPerc !== undefined ? String(kmPerc) : '',
        isAbastecimento && media !== undefined ? media.toFixed(2).replace('.', ',') : '',
        isAbastecimento && t.nomePosto ? `"${t.nomePosto.replace(/"/g, '""')}"` : '',
        isAbastecimento && t.localizacaoPosto ? `"${t.localizacaoPosto.replace(/"/g, '""')}"` : '',
        isAbastecimento && t.motorista ? `"${t.motorista.replace(/"/g, '""')}"` : '',
        t.obs ? `"${t.obs.replace(/"/g, '""')}"` : '',
        isAbastecimento && t.descricaoVeiculo ? `"${t.descricaoVeiculo.replace(/"/g, '""')}"` : ''
      ];
    });
    
    // Prefix UTF-8 Byte Order Mark (BOM) to support correct encoding in Excel (Brazilian locale)
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `planilha_financeira_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Filtered Transactions as PDF Report
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Header Band
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 24, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text("WEALTHFLOW", 14, 11);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(194, 205, 217);
      doc.text("SISTEMA DE GESTAO FINANCEIRA INTEGRADA", 14, 15);

      // Generated timestamp
      doc.setFontSize(8);
      doc.setTextColor(220, 220, 220);
      const nowStr = new Date().toLocaleString('pt-BR');
      doc.text(`Gerado em: ${nowStr}`, pageWidth - 14, 13, { align: 'right' });

      // Title & Filters Info
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text("RELATORIO DE ATIVIDADE FINANCEIRA (FILTRADO)", 14, 32);

      // Active Filter Details
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      
      let filterDetails = `Filtro: "${searchTerm || 'Todos'}" | Categoria: ${selectedFilter.toUpperCase()} | Status: ${statusFilter === 'a_pagar' ? 'A Pagar' : statusFilter === 'pago' ? 'Pago' : statusFilter === 'vencendo_48h' ? 'Vencendo em 48h' : 'Todos'}`;
      if (periodoInicio || periodoFim) {
        filterDetails += ` | Periodo: ${periodoInicio || 'Inicio'} ate ${periodoFim || 'Fim'}`;
      }
      doc.text(filterDetails, 14, 37);

      // Calculate summaries on the filteredTransactions list
      let totalReceitas = 0;
      let totalDespesas = 0;

      filteredTransactions.forEach(t => {
        const val = t.valor || 0;
        if (t.tipo === 'RECEITA') {
          totalReceitas += val;
        } else if (t.tipo === 'DESPESA' || t.tipo === 'COMBUSTIVEL' || t.tipo === 'ABASTECIMENTO') {
          totalDespesas += val;
        } else {
          const typeLower = (t.tipo || '').toLowerCase();
          if (typeLower.includes('receita')) {
            totalReceitas += val;
          } else if (typeLower.includes('despesa')) {
            totalDespesas += val;
          }
        }
      });

      const saldoLiquido = totalReceitas - totalDespesas;

      const formatBRL = (val: number) => {
        return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      };

      // Draw 3 Summary Boxes
      const boxWidth = (pageWidth - 28 - 6) / 3;
      const boxY = 42;
      const boxHeight = 16;

      // Box 1: Receitas
      doc.setFillColor(240, 253, 250); // very soft emerald
      doc.setDrawColor(209, 250, 229);
      doc.roundedRect(14, boxY, boxWidth, boxHeight, 2, 2, 'FD');
      doc.setTextColor(5, 150, 105);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text("TOTAL RECEITAS", 14 + 4, boxY + 5);
      doc.setFontSize(10.5);
      doc.text(formatBRL(totalReceitas), 14 + 4, boxY + 11.5);

      // Box 2: Despesas
      doc.setFillColor(254, 242, 242); // very soft rose
      doc.setDrawColor(254, 226, 226);
      doc.roundedRect(14 + boxWidth + 3, boxY, boxWidth, boxHeight, 2, 2, 'FD');
      doc.setTextColor(220, 38, 38);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text("TOTAL DESPESAS", 14 + boxWidth + 3 + 4, boxY + 5);
      doc.setFontSize(10.5);
      doc.text(formatBRL(totalDespesas), 14 + boxWidth + 3 + 4, boxY + 11.5);

      // Box 3: Saldo Liquido
      const isPositive = saldoLiquido >= 0;
      if (isPositive) {
        doc.setFillColor(240, 253, 250);
        doc.setDrawColor(209, 250, 229);
      } else {
        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(254, 226, 226);
      }
      doc.roundedRect(14 + (boxWidth * 2) + 6, boxY, boxWidth, boxHeight, 2, 2, 'FD');
      if (isPositive) {
        doc.setTextColor(5, 150, 105);
      } else {
        doc.setTextColor(220, 38, 38);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text("SALDO LIQUIDO", 14 + (boxWidth * 2) + 6 + 4, boxY + 5);
      doc.setFontSize(10.5);
      doc.text(formatBRL(saldoLiquido), 14 + (boxWidth * 2) + 6 + 4, boxY + 11.5);

      // Prep Data for AutoTable
      const tableHeaders = [["ID", "Data", "Descricao", "Categoria", "Banco / Conta", "Tipo", "Status", "Valor"]];
      const tableRows = filteredTransactions.map(t => {
        let desc = t.descricao || '';
        if (t.categoria === 'ABASTECIMENTO') {
          const detailParts = [];
          if (t.veiculo) detailParts.push(t.veiculo);
          if (t.km) detailParts.push(`${t.km} km`);
          if (t.litros) detailParts.push(`${t.litros}L`);
          if (detailParts.length > 0) {
            desc += ` [${detailParts.join(' | ')}]`;
          }
        }
        return [
          String(t.id),
          t.data || '',
          desc,
          t.categoria || 'OUTROS',
          t.bancoNome || 'Nao especif.',
          t.tipo === 'RECEITA' ? 'Receita' : t.tipo === 'TRANSFERÊNCIA' || t.tipo === 'TRANSFERENCIA' ? 'Transf.' : 'Despesa',
          t.status || 'PENDENTE',
          formatBRL(t.valor || 0)
        ];
      });

      autoTable(doc, {
        startY: 62,
        head: tableHeaders,
        body: tableRows,
        theme: 'striped',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontSize: 8.5,
          font: 'helvetica',
          fontStyle: 'bold',
          halign: 'left'
        },
        bodyStyles: {
          fontSize: 8,
          font: 'helvetica',
          textColor: [33, 41, 54]
        },
        columnStyles: {
          0: { cellWidth: 10 }, // ID
          1: { cellWidth: 18 }, // Data
          2: { cellWidth: 'auto' }, // Descricao
          3: { cellWidth: 26 }, // Categoria
          4: { cellWidth: 26 }, // Banco
          5: { cellWidth: 18 }, // Tipo
          6: { cellWidth: 18 }, // Status
          7: { cellWidth: 24, halign: 'right' } // Valor
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        margin: { top: 30, bottom: 20, left: 14, right: 14 }
      });

      // Post-process all pages to draw the footers dynamically
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // Footer background
        doc.setFillColor(241, 245, 249);
        doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');

        // Footer text
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text("WealthFlow - Inteligencia Financeira Avancada", 14, pageHeight - 5);

        const pageStr = `Pagina ${i} de ${totalPages}`;
        doc.text(pageStr, pageWidth - 14, pageHeight - 5, { align: 'right' });
      }

      const filterSuffix = selectedFilter !== 'todos' ? `_${selectedFilter}` : '';
      doc.save(`relatorio_financeiro_${new Date().toISOString().split('T')[0]}${filterSuffix}.pdf`);

      if (showAlert) {
        showAlert("Relatorio Exportado", "O PDF foi gerado com sucesso contendo as transacoes filtradas!");
      }
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      if (showAlert) {
        showAlert("Erro de Exportacao", "Ocorreu um erro ao tentar gerar o relatorio em PDF.");
      }
    }
  };

  // Add/Edit Transaction Form States
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [baixaTx, setBaixaTx] = useState<Transaction | null>(null);
  const [baixaValorPg, setBaixaValorPg] = useState<string>('0,00');
  const [baixaTemJuros, setBaixaTemJuros] = useState<boolean>(false);
  const [baixaValorJuros, setBaixaValorJuros] = useState<string>('0,00');
  const [baixaDataPg, setBaixaDataPg] = useState<string>('');
  const [baixaBankId, setBaixaBankId] = useState<number>(0);
  const [txType, setTxType] = useState<string>(() => localStorage.getItem('draft_txType') || 'DESPESA');
  const [newTypeName, setNewTypeName] = useState<string>(() => localStorage.getItem('draft_newTypeName') || '');
  const [amountStr, setAmountStr] = useState<string>(() => localStorage.getItem('draft_amountStr') || '0,00');
  const [category, setCategory] = useState<string>(() => localStorage.getItem('draft_category') || 'ABASTECIMENTO');
  const [newCategoryName, setNewCategoryName] = useState<string>(() => localStorage.getItem('draft_newCategoryName') || '');
  const [date, setDate] = useState<string>(() => localStorage.getItem('draft_date') || new Date().toISOString().split('T')[0]);
  const [desc, setDesc] = useState<string>(() => localStorage.getItem('draft_desc') || '');
  const [status, setStatus] = useState<string>(() => localStorage.getItem('draft_status') || 'PAGO');
  const [formBankId, setFormBankId] = useState<number>(() => {
    const saved = localStorage.getItem('draft_formBankId');
    return saved ? Number(saved) : 0;
  });

  // Installments states
  const [installments, setInstallments] = useState<string>('1');
  const [comoDividir, setComoDividir] = useState<string>('DIVIDIR_TOTAL'); // 'DIVIDIR_TOTAL' | 'REPETIR_VALOR'

  // Fuel-specific states
  const [fuelType, setFuelType] = useState<string>(() => localStorage.getItem('draft_fuelType') || 'ETANOL');
  const [km, setKm] = useState<string>(() => localStorage.getItem('draft_km') || '');
  const [litros, setLitros] = useState<string>(() => localStorage.getItem('draft_litros') || '0,00');
  const [precoLitro, setPrecoLitro] = useState<string>(() => localStorage.getItem('draft_precoLitro') || '0,00');
  const [veiculo, setVeiculo] = useState<string>(() => localStorage.getItem('draft_veiculo') || 'CARRO');
  const [descricaoVeiculo, setDescricaoVeiculo] = useState<string>(() => localStorage.getItem('draft_descricaoVeiculo') || '');
  const [valorPgStr, setValorPgStr] = useState<string>(() => localStorage.getItem('draft_valorPgStr') || '0,00');
  const [completouTanque, setCompletouTanque] = useState<boolean>(() => {
    const val = localStorage.getItem('draft_completouTanque');
    return val !== null ? val === 'true' : true;
  });
  const [nomePosto, setNomePosto] = useState<string>(() => localStorage.getItem('draft_nomePosto') || '');
  const [localizacaoPosto, setLocalizacaoPosto] = useState<string>(() => localStorage.getItem('draft_localizacaoPosto') || '');
  const [motorista, setMotorista] = useState<string>(() => localStorage.getItem('draft_motorista') || '');
  const [obs, setObs] = useState<string>(() => localStorage.getItem('draft_obs') || '');

  // Autocomplete suggestions for gas station (nomePosto)
  const [showPostoSuggestions, setShowPostoSuggestions] = useState<boolean>(false);

  const allGasStations = React.useMemo(() => {
    const stations = transactions
      .filter(t => t.categoria === 'ABASTECIMENTO' && t.nomePosto)
      .map(t => t.nomePosto!.toUpperCase().trim());
    return Array.from(new Set(stations)).sort();
  }, [transactions]);

  const filteredStations = React.useMemo(() => {
    if (!nomePosto.trim()) return [];
    const val = nomePosto.toUpperCase();
    return allGasStations.filter(station => station.includes(val) && station !== val);
  }, [nomePosto, allGasStations]);

  const [coords, setCoords] = useState<{ lat: number, lon: number } | null>(null);
  const [onlinePostoSuggestions, setOnlinePostoSuggestions] = useState<Array<{ name: string, address: string }>>([]);
  const [isSearchingPosto, setIsSearchingPosto] = useState<boolean>(false);

  // Background fetch user's GPS coordinates when adding form is shown
  useEffect(() => {
    if (showAddForm && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        (err) => console.log('Geolocation not available/declined:', err),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, [showAddForm]);

  // Sync form states with localStorage draft whenever showAddForm is set to true and we're not editing
  useEffect(() => {
    if (showAddForm && !editingTx) {
      setTxType(localStorage.getItem('draft_txType') || 'DESPESA');
      setCategory(localStorage.getItem('draft_category') || 'ABASTECIMENTO');
      setNewTypeName(localStorage.getItem('draft_newTypeName') || '');
      setAmountStr(localStorage.getItem('draft_amountStr') || '0,00');
      setNewCategoryName(localStorage.getItem('draft_newCategoryName') || '');
      setDate(localStorage.getItem('draft_date') || new Date().toISOString().split('T')[0]);
      setDesc(localStorage.getItem('draft_desc') || '');
      setStatus(localStorage.getItem('draft_status') || 'PAGO');
      setFuelType(localStorage.getItem('draft_fuelType') || 'ETANOL');
      setKm(localStorage.getItem('draft_km') || '');
      setLitros(localStorage.getItem('draft_litros') || '0,00');
      setPrecoLitro(localStorage.getItem('draft_precoLitro') || '0,00');
      setVeiculo(localStorage.getItem('draft_veiculo') || 'CARRO');
      setDescricaoVeiculo(localStorage.getItem('draft_descricaoVeiculo') || '');
      setValorPgStr(localStorage.getItem('draft_valorPgStr') || '0,00');
      setCompletouTanque(localStorage.getItem('draft_completouTanque') !== 'false');
      setNomePosto(localStorage.getItem('draft_nomePosto') || '');
      setLocalizacaoPosto(localStorage.getItem('draft_localizacaoPosto') || '');
      setMotorista(localStorage.getItem('draft_motorista') || '');
      setObs(localStorage.getItem('draft_obs') || '');
      setFormBankId(Number(localStorage.getItem('draft_formBankId') || '0'));
    }
  }, [showAddForm, editingTx]);

  // Debounced search on Nominatim for gas stations
  useEffect(() => {
    if (!nomePosto || nomePosto.trim().length < 2) {
      setOnlinePostoSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingPosto(true);
      try {
        let url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(nomePosto)}&addressdetails=1&limit=5&countrycodes=br`;
        if (coords) {
          url += `&lat=${coords.lat}&lon=${coords.lon}`;
        }
        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept-Language': 'pt-BR,pt;q=0.9',
            'User-Agent': 'FluxoDeRiqueza/1.0'
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const mapped = data.map((item: any) => {
              const name = (item.name || item.display_name.split(',')[0] || nomePosto).toUpperCase();
              const addr = item.address;
              const street = addr ? (addr.road || addr.pedestrian || addr.suburb || '') : '';
              const number = addr ? (addr.house_number || '') : '';
              const city = addr ? (addr.city || addr.town || addr.village || '') : '';
              const state = addr ? (addr.state ? addr.state.substring(0, 2).toUpperCase() : '') : '';
              
              let formattedAddress = '';
              if (street) {
                formattedAddress += street;
                if (number) formattedAddress += `, ${number}`;
              }
              if (city) {
                if (formattedAddress) formattedAddress += ' - ';
                formattedAddress += city;
                if (state) formattedAddress += `/${state}`;
              }
              if (!formattedAddress && item.display_name) {
                formattedAddress = item.display_name.split(',').slice(1, 4).join(',').trim();
              }
              return { name, address: formattedAddress.toUpperCase() };
            });
            setOnlinePostoSuggestions(mapped);
          }
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error("Erro ao buscar postos online:", error);
        }
      } finally {
        setIsSearchingPosto(false);
      }
    }, 450); // 450ms debounce

    return () => {
      clearTimeout(delayDebounceFn);
      controller.abort();
    };
  }, [nomePosto, coords]);

  // Auto-save draft variables in real-time
  useEffect(() => {
    if (showAddForm && !editingTx) {
      localStorage.setItem('draft_txType', txType);
      localStorage.setItem('draft_newTypeName', newTypeName);
      localStorage.setItem('draft_amountStr', amountStr);
      localStorage.setItem('draft_category', category);
      localStorage.setItem('draft_newCategoryName', newCategoryName);
      localStorage.setItem('draft_date', date);
      localStorage.setItem('draft_desc', desc);
      localStorage.setItem('draft_status', status);
      localStorage.setItem('draft_fuelType', fuelType);
      localStorage.setItem('draft_km', km);
      localStorage.setItem('draft_litros', litros);
      localStorage.setItem('draft_precoLitro', precoLitro);
      localStorage.setItem('draft_veiculo', veiculo);
      localStorage.setItem('draft_descricaoVeiculo', descricaoVeiculo);
      localStorage.setItem('draft_valorPgStr', valorPgStr);
      localStorage.setItem('draft_completouTanque', String(completouTanque));
      localStorage.setItem('draft_nomePosto', nomePosto);
      localStorage.setItem('draft_localizacaoPosto', localizacaoPosto);
      localStorage.setItem('draft_motorista', motorista);
      localStorage.setItem('draft_obs', obs);
      localStorage.setItem('draft_formBankId', String(formBankId));
    }
  }, [
    showAddForm,
    editingTx,
    txType,
    newTypeName,
    amountStr,
    category,
    newCategoryName,
    date,
    desc,
    status,
    fuelType,
    km,
    litros,
    precoLitro,
    veiculo,
    descricaoVeiculo,
    valorPgStr,
    completouTanque,
    nomePosto,
    localizacaoPosto,
    motorista,
    obs,
    formBankId
  ]);

  const clearDraftFromStorage = () => {
    const keys = [
      'draft_txType', 'draft_newTypeName', 'draft_amountStr', 'draft_category',
      'draft_newCategoryName', 'draft_date', 'draft_desc', 'draft_status',
      'draft_fuelType', 'draft_km', 'draft_litros', 'draft_precoLitro',
      'draft_veiculo', 'draft_descricaoVeiculo', 'draft_valorPgStr',
      'draft_completouTanque', 'draft_nomePosto', 'draft_localizacaoPosto',
      'draft_motorista', 'draft_obs', 'draft_formBankId'
    ];
    keys.forEach(k => localStorage.removeItem(k));
  };

  const loadDraft = () => {
    setTxType(localStorage.getItem('draft_txType') || 'DESPESA');
    setNewTypeName(localStorage.getItem('draft_newTypeName') || '');
    setAmountStr(localStorage.getItem('draft_amountStr') || '0,00');
    setCategory(localStorage.getItem('draft_category') || 'ABASTECIMENTO');
    setNewCategoryName(localStorage.getItem('draft_newCategoryName') || '');
    setDate(localStorage.getItem('draft_date') || new Date().toISOString().split('T')[0]);
    setDesc(localStorage.getItem('draft_desc') || '');
    setStatus(localStorage.getItem('draft_status') || 'PAGO');
    setFuelType(localStorage.getItem('draft_fuelType') || 'ETANOL');
    setKm(localStorage.getItem('draft_km') || '');
    setLitros(localStorage.getItem('draft_litros') || '0,00');
    setPrecoLitro(localStorage.getItem('draft_precoLitro') || '0,00');
    setVeiculo(localStorage.getItem('draft_veiculo') || 'CARRO');
    setDescricaoVeiculo(localStorage.getItem('draft_descricaoVeiculo') || '');
    setValorPgStr(localStorage.getItem('draft_valorPgStr') || '0,00');
    setCompletouTanque(localStorage.getItem('draft_completouTanque') !== 'false');
    setNomePosto(localStorage.getItem('draft_nomePosto') || '');
    setLocalizacaoPosto(localStorage.getItem('draft_localizacaoPosto') || '');
    setMotorista(localStorage.getItem('draft_motorista') || '');
    setObs(localStorage.getItem('draft_obs') || '');
    setFormBankId(Number(localStorage.getItem('draft_formBankId') || '0'));
  };

  const [isFetchingLocation, setIsFetchingLocation] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleFetchLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Não suportado pelo navegador.');
      return;
    }

    setIsFetchingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
            {
              headers: {
                'Accept-Language': 'pt-BR,pt;q=0.9',
                'User-Agent': 'FluxoDeRiqueza/1.0'
              }
            }
          );
          if (response.ok) {
            const data = await response.json();
            if (data && data.address) {
              const addr = data.address;
              const street = addr.road || addr.pedestrian || addr.suburb || '';
              const number = addr.house_number || '';
              const city = addr.city || addr.town || addr.village || '';
              const state = addr.state ? addr.state.substring(0, 2).toUpperCase() : '';
              
              let formattedAddress = '';
              if (street) {
                formattedAddress += street;
                if (number) formattedAddress += `, ${number}`;
              }
              if (city) {
                if (formattedAddress) formattedAddress += ' - ';
                formattedAddress += city;
                if (state) formattedAddress += `/${state}`;
              }

              if (!formattedAddress && data.display_name) {
                formattedAddress = data.display_name.split(',').slice(0, 3).join(',').trim();
              }

              setLocalizacaoPosto(formattedAddress || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            } else if (data && data.display_name) {
              const shortName = data.display_name.split(',').slice(0, 3).join(',').trim();
              setLocalizacaoPosto(shortName);
            } else {
              setLocalizacaoPosto(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            }
          } else {
            setLocalizacaoPosto(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          }
        } catch (error) {
          console.error("Erro ao obter endereço descritivo:", error);
          setLocalizacaoPosto(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        } finally {
          setIsFetchingLocation(false);
        }
      },
      (error) => {
        console.error("Erro ao buscar coordenadas:", error);
        let errorMsg = 'Erro ao obter localização.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Permissão negada pelo usuário.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Sinal de GPS indisponível.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Tempo esgotado.';
        }
        setLocationError(errorMsg);
        setIsFetchingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
      }
    );
  };

  const handleLitrosChange = (val: string) => {
    let raw = val.replace(/\D/g, "");
    if (!raw) {
      setLitros('0,00');
      return;
    }
    let numeric = parseInt(raw, 10) / 100;
    const formatted = numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setLitros(formatted);

    const normalizedAmt = amountStr.replace(/\./g, "").replace(",", ".");
    const amt = parseFloat(normalizedAmt);
    const lts = numeric;
    if (!isNaN(amt) && lts > 0) {
      const calculatedPrice = amt / lts;
      setPrecoLitro(calculatedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  };

  const handlePrecoLitroChange = (val: string) => {
    let raw = val.replace(/\D/g, "");
    if (!raw) {
      setPrecoLitro('0,00');
      return;
    }
    let numeric = parseInt(raw, 10) / 100;
    const formatted = numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setPrecoLitro(formatted);

    const normalizedAmt = amountStr.replace(/\./g, "").replace(",", ".");
    const amt = parseFloat(normalizedAmt);
    const preco = numeric;
    if (!isNaN(amt) && preco > 0) {
      const calculatedLiters = amt / preco;
      setLitros(calculatedLiters.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  };

  const getLiveStats = () => {
    if (!km || isNaN(parseInt(km, 10)) || !veiculo) return { kmPercorrido: 0, mediaKmL: 0 };
    const currentKm = parseInt(km, 10);
    const vehicleUpper = veiculo.toUpperCase();
    
    // Find all fueling transactions for this vehicle with km < currentKm
    const prevFuelings = transactions
      .filter(t => t.categoria === 'ABASTECIMENTO' && t.veiculo && t.veiculo.toUpperCase() === vehicleUpper && t.km && t.km < currentKm);
      
    if (prevFuelings.length === 0) return { kmPercorrido: 0, mediaKmL: 0 };
    
    // Sort descending by KM to get the most recent one
    prevFuelings.sort((a, b) => (b.km || 0) - (a.km || 0));
    
    const lastFueling = prevFuelings[0];
    const prevKmVal = lastFueling.km || 0;
    const distance = currentKm - prevKmVal;
    
    const lts = parseFloat(litros.replace(/\./g, "").replace(',', '.'));
    const calculatedMedia = lts > 0 ? distance / lts : 0;
    
    return {
      kmPercorrido: distance,
      mediaKmL: calculatedMedia
    };
  };

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Convert input value to BRL currency string representation
  const handleAmountInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      setAmountStr('0,00');
      setValorPgStr('0,00');
      return;
    }
    let numeric = parseInt(raw, 10) / 100;
    const formatted = numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setAmountStr(formatted);
    setValorPgStr(formatted);

    if (category === 'ABASTECIMENTO') {
      const normalizedPreco = precoLitro.replace(/\./g, "").replace(",", ".");
      const preco = parseFloat(normalizedPreco);
      const amt = numeric;
      if (!isNaN(preco) && preco > 0) {
        const calculatedLiters = amt / preco;
        setLitros(calculatedLiters.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      }
    }
  };

  // Dynamically computed list of available categories
  const categoriesList = React.useMemo(() => {
    const defaultCategories = ['RECEITA', 'ABASTECIMENTO', 'TRABALHO', 'PESSOAL', 'LAZER', 'TAXAS', 'CASA', 'OUTROS', 'CONSUMO'];
    const existingCats = transactions
      .map(t => (t.categoria || '').trim().toUpperCase())
      .filter(Boolean);
    if (editingTx && editingTx.categoria) {
      existingCats.push(editingTx.categoria.trim().toUpperCase());
    }
    const cleanCustoms = customCategories.map(c => c.trim().toUpperCase());
    const combined = new Set([...defaultCategories, ...cleanCustoms, ...existingCats]);
    return Array.from(combined);
  }, [transactions, editingTx, customCategories]);

  // Dynamically computed list of available transaction types
  const typesList = React.useMemo(() => {
    const defaultTypes = ['RECEITA', 'DESPESA'];
    const existingTypes = transactions
      .map(t => (t.tipo || '').trim().toUpperCase())
      .filter(t => t && t !== 'RECEITA' && t !== 'DESPESA' && t !== 'ETANOL' && t !== 'GASOLINA' && t !== 'GAS. COMUM' && t !== 'DIESEL' && t !== 'GNV');
    if (editingTx && editingTx.tipo) {
      existingTypes.push(editingTx.tipo.trim().toUpperCase());
    }
    const combined = new Set([...defaultTypes, ...existingTypes]);
    return Array.from(combined);
  }, [transactions, editingTx]);

  const handleStartEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    const safeTipo = (tx.tipo || '').toUpperCase();
    const safeCategory = (tx.categoria || '').toUpperCase();

    setTxType(safeTipo || 'DESPESA');
    setNewTypeName('');
    setAmountStr((tx.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    
    setCategory(safeCategory);
    setNewCategoryName('');
    
    // Convert DD/MM/YYYY to YYYY-MM-DD
    const parts = (tx.data || '').split('/');
    if (parts.length === 3) {
      setDate(`${parts[2]}-${parts[1]}-${parts[0]}`);
    } else {
      setDate(new Date().toISOString().split('T')[0]);
    }
    
    setDesc(tx.descricao || '');
    setStatus(tx.status || 'PAGO');
    setObs(tx.obs || '');

    // Set fuel fields if category is Abastecimento
    if (safeCategory === 'ABASTECIMENTO') {
      setFuelType(tx.tipo || 'ETANOL');
      setKm(tx.km ? String(tx.km) : '');
      setLitros(tx.litros ? tx.litros.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00');
      setPrecoLitro(tx.precoLitro ? tx.precoLitro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00');
      
      const rawVehicle = (tx.veiculo || '').trim().toUpperCase();
      let mappedVehicle = 'CARRO';
      let mappedDescVehicle = tx.descricaoVeiculo || '';
      if (rawVehicle === 'MOTO' || rawVehicle === 'CARRO') {
        mappedVehicle = rawVehicle;
      } else if (rawVehicle) {
        mappedVehicle = 'CARRO';
        if (!mappedDescVehicle) {
          mappedDescVehicle = rawVehicle;
        }
      }
      setVeiculo(mappedVehicle);
      setDescricaoVeiculo(mappedDescVehicle);
      
      setValorPgStr(tx.valorPg !== undefined ? tx.valorPg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (tx.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setCompletouTanque(tx.completouTanque !== undefined ? tx.completouTanque : true);
      setNomePosto(tx.nomePosto || '');
      setLocalizacaoPosto(tx.localizacaoPosto || '');
      setMotorista(tx.motorista || '');
    } else {
      setFuelType('ETANOL');
      setKm('');
      setLitros('0,00');
      setPrecoLitro('0,00');
      setVeiculo('CARRO');
      setDescricaoVeiculo('');
      setValorPgStr('0,00');
      setCompletouTanque(true);
      setNomePosto('');
      setLocalizacaoPosto('');
      setMotorista('');
    }
    
    setInstallments('1');
    setComoDividir('DIVIDIR_TOTAL');
    setFormBankId(tx.bancoId || 0);
    setShowAddForm(true);
  };

  const handleCancel = () => {
    setEditingTx(null);
    setDesc('');
    setAmountStr('0,00');
    setCategory('ABASTECIMENTO');
    setNewCategoryName('');
    setTxType('DESPESA');
    setNewTypeName('');
    setDate(new Date().toISOString().split('T')[0]);
    setStatus('PAGO');
    setFormBankId(0);
    setInstallments('1');
    setComoDividir('DIVIDIR_TOTAL');
    setFuelType('ETANOL');
    setKm('');
    setLitros('0,00');
    setPrecoLitro('0,00');
    setVeiculo('CARRO');
    setDescricaoVeiculo('');
    setValorPgStr('0,00');
    setCompletouTanque(true);
    setNomePosto('');
    setLocalizacaoPosto('');
    setMotorista('');
    setObs('');
    setShowAddForm(false);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse formatted string back to float number
    const normalized = amountStr.replace(/\./g, "").replace(",", ".");
    const numericAmount = parseFloat(normalized);
    
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alertUser("Campo Inválido", "Por favor, insira um valor válido.");
      return;
    }

    const finalCategory = category === 'NOVA_CATEGORIA' ? newCategoryName.trim().toUpperCase() : category.toUpperCase();
    if (category === 'NOVA_CATEGORIA' && !newCategoryName.trim()) {
      alertUser("Campo Obrigatório", "Por favor, insira o nome da nova categoria.");
      return;
    }

    const isAbastecimento = finalCategory === 'ABASTECIMENTO';
    
    let finalDesc = desc.trim().toUpperCase();
    if (isAbastecimento) {
      finalDesc = `ABASTECIMENTO: ${nomePosto ? nomePosto.trim().toUpperCase() : 'POSTO'}`;
    } else {
      if (!finalDesc) {
        alertUser("Campo Obrigatório", "Por favor, insira uma descrição para a transação.");
        return;
      }
    }

    const finalType = txType === 'NOVO_TIPO' ? newTypeName.trim().toUpperCase() : txType.toUpperCase();
    if (txType === 'NOVO_TIPO' && !newTypeName.trim()) {
      alertUser("Campo Obrigatório", "Por favor, insira o nome do novo tipo.");
      return;
    }

    const parsedKm = isAbastecimento && km ? parseInt(km, 10) : undefined;
    const parsedLitros = isAbastecimento && litros ? parseFloat(litros.replace(',', '.')) : undefined;
    const parsedPrecoLitro = isAbastecimento && precoLitro ? parseFloat(precoLitro.replace(',', '.')) : undefined;
    const parsedValorPg = isAbastecimento && valorPgStr ? parseFloat(valorPgStr.replace(/\./g, "").replace(",", ".")) : undefined;

    const stats = getLiveStats();

    const getInstallmentDate = (startDateStr: string, index: number) => {
      const parts = startDateStr.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      
      let targetMonth = month - 1 + index;
      let targetYear = year + Math.floor(targetMonth / 12);
      targetMonth = targetMonth % 12;
      if (targetMonth < 0) {
        targetMonth += 12;
      }
      
      const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      const targetDay = Math.min(day, lastDayOfTargetMonth);
      
      const dateObj = new Date(targetYear, targetMonth, targetDay);
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const yyyy = dateObj.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    const N = parseInt(installments, 10);
    if (isNaN(N) || N < 1) {
      alertUser("Campo Inválido", "Número de parcelas inválido.");
      return;
    }

    if (editingTx || N === 1) {
      const matchedBank = bankAccounts.find(b => b.id === formBankId);
      const bancoNome = matchedBank ? matchedBank.nome : undefined;

      const payload = {
        data: date.split('-').reverse().join('/'), // format as DD/MM/YYYY
        valor: numericAmount,
        tipo: isAbastecimento ? fuelType : finalType,
        descricao: finalDesc,
        categoria: finalCategory,
        status: status,
        obs: obs.trim() ? obs : undefined,
        bancoId: formBankId > 0 ? formBankId : undefined,
        bancoNome: bancoNome,
        ...(isAbastecimento ? {
          km: isNaN(parsedKm as number) ? undefined : parsedKm,
          litros: isNaN(parsedLitros as number) ? undefined : parsedLitros,
          precoLitro: isNaN(parsedPrecoLitro as number) ? undefined : parsedPrecoLitro,
          veiculo: veiculo || 'CARRO',
          descricaoVeiculo: descricaoVeiculo.trim() || undefined,
          valorPg: isNaN(parsedValorPg as number) ? undefined : parsedValorPg,
          completouTanque: completouTanque,
          kmPercorrido: stats.kmPercorrido > 0 ? stats.kmPercorrido : undefined,
          mediaKmL: stats.mediaKmL > 0 ? stats.mediaKmL : undefined,
          nomePosto: nomePosto || undefined,
          localizacaoPosto: localizacaoPosto || undefined,
          motorista: motorista || undefined
        } : {
          km: undefined,
          litros: undefined,
          precoLitro: undefined,
          veiculo: undefined,
          descricaoVeiculo: undefined,
          valorPg: undefined,
          completouTanque: undefined,
          kmPercorrido: undefined,
          mediaKmL: undefined,
          nomePosto: undefined,
          localizacaoPosto: undefined,
          motorista: undefined
        })
      };

      if (editingTx) {
        if (onUpdateBankAccounts && formBankId > 0) {
          const originalWasPago = editingTx.status === 'PAGO';
          const originalBankId = editingTx.bancoId || 0;
          const originalVal = editingTx.valorPg !== undefined ? editingTx.valorPg : editingTx.valor;
          const newVal = isAbastecimento && parsedValorPg !== undefined ? parsedValorPg : numericAmount;
          const isReceita = (isAbastecimento ? fuelType : finalType) === 'RECEITA';

          let newAccounts = [...bankAccounts];

          // Reverse old impact
          if (originalWasPago && originalBankId > 0) {
            newAccounts = newAccounts.map(b => {
              if (b.id === originalBankId) {
                const originalIsReceita = editingTx.tipo === 'RECEITA';
                const novoSaldo = originalIsReceita
                  ? b.saldoInicial - originalVal
                  : b.saldoInicial + originalVal;
                return { ...b, saldoInicial: novoSaldo };
              }
              return b;
            });
          }

          // Apply new impact
          if (status === 'PAGO') {
            newAccounts = newAccounts.map(b => {
              if (b.id === formBankId) {
                const novoSaldo = isReceita
                  ? b.saldoInicial + newVal
                  : b.saldoInicial - newVal;
                return { ...b, saldoInicial: novoSaldo };
              }
              return b;
            });
          }

          onUpdateBankAccounts(newAccounts);
        }

        onEditTransaction(editingTx.id, payload);
      } else {
        if (onUpdateBankAccounts && formBankId > 0 && status === 'PAGO') {
          const val = isAbastecimento && parsedValorPg !== undefined ? parsedValorPg : numericAmount;
          const isReceita = (isAbastecimento ? fuelType : finalType) === 'RECEITA';
          const updatedAccounts = bankAccounts.map(b => {
            if (b.id === formBankId) {
              const novoSaldo = isReceita
                ? b.saldoInicial + val
                : b.saldoInicial - val;
              return { ...b, saldoInicial: novoSaldo };
            }
            return b;
          });
          onUpdateBankAccounts(updatedAccounts);
        }

        onAddTransaction(payload);
      }
    } else {
      // Create N installments
      const payloads: Omit<Transaction, 'id'>[] = [];
      const totalCents = Math.round(numericAmount * 100);
      const baseCents = Math.floor(totalCents / N);
      const remainderCents = totalCents % N;

      const totalPgCents = parsedValorPg !== undefined ? Math.round(parsedValorPg * 100) : undefined;
      const basePgCents = totalPgCents !== undefined ? Math.floor(totalPgCents / N) : undefined;
      const remainderPgCents = totalPgCents !== undefined ? totalPgCents % N : undefined;

      const matchedBank = bankAccounts.find(b => b.id === formBankId);
      const bancoNome = matchedBank ? matchedBank.nome : undefined;

      let totalImpactVal = 0;

      for (let i = 0; i < N; i++) {
        let finalAmount = numericAmount;
        let finalInstValorPg = parsedValorPg;
        let finalInstLitros = parsedLitros;

        if (comoDividir === 'DIVIDIR_TOTAL') {
          const centsForThisInst = baseCents + (i < remainderCents ? 1 : 0);
          finalAmount = centsForThisInst / 100;

          if (totalPgCents !== undefined && basePgCents !== undefined && remainderPgCents !== undefined) {
            const centsForThisPg = basePgCents + (i < remainderPgCents ? 1 : 0);
            finalInstValorPg = centsForThisPg / 100;
          }
          if (parsedLitros !== undefined) {
            finalInstLitros = Math.round((parsedLitros / N) * 100) / 100;
          }
        }

        const installmentDateStr = getInstallmentDate(date, i);
        const installmentDesc = `${finalDesc} (${i + 1}/${N})`;
        const installmentStatus = (i === 0) ? status : 'PENDENTE';

        const payload = {
          data: installmentDateStr,
          valor: finalAmount,
          tipo: isAbastecimento ? fuelType : finalType,
          descricao: installmentDesc,
          categoria: finalCategory,
          status: installmentStatus,
          obs: obs.trim() ? obs : undefined,
          bancoId: formBankId > 0 ? formBankId : undefined,
          bancoNome: bancoNome,
          ...(isAbastecimento ? {
            km: isNaN(parsedKm as number) ? undefined : parsedKm,
            litros: isNaN(finalInstLitros as number) ? undefined : finalInstLitros,
            precoLitro: isNaN(parsedPrecoLitro as number) ? undefined : parsedPrecoLitro,
            veiculo: veiculo || 'CARRO',
            descricaoVeiculo: descricaoVeiculo.trim() || undefined,
            valorPg: isNaN(finalInstValorPg as number) ? undefined : finalInstValorPg,
            completouTanque: completouTanque,
            kmPercorrido: stats.kmPercorrido > 0 ? stats.kmPercorrido : undefined,
            mediaKmL: stats.mediaKmL > 0 ? stats.mediaKmL : undefined,
            nomePosto: nomePosto || undefined,
            localizacaoPosto: localizacaoPosto || undefined,
            motorista: motorista || undefined
          } : {
            km: undefined,
            litros: undefined,
            precoLitro: undefined,
            veiculo: undefined,
            descricaoVeiculo: undefined,
            valorPg: undefined,
            completouTanque: undefined,
            kmPercorrido: undefined,
            mediaKmL: undefined,
            nomePosto: undefined,
            localizacaoPosto: undefined,
            motorista: undefined
          })
        };
        payloads.push(payload);

        if (installmentStatus === 'PAGO') {
          const valForImpact = isAbastecimento && finalInstValorPg !== undefined ? finalInstValorPg : finalAmount;
          totalImpactVal += valForImpact;
        }
      }

      if (onUpdateBankAccounts && formBankId > 0 && totalImpactVal > 0) {
        const isReceita = (isAbastecimento ? fuelType : finalType) === 'RECEITA';
        const updatedAccounts = bankAccounts.map(b => {
          if (b.id === formBankId) {
            const novoSaldo = isReceita
              ? b.saldoInicial + totalImpactVal
              : b.saldoInicial - totalImpactVal;
            return { ...b, saldoInicial: novoSaldo };
          }
          return b;
        });
        onUpdateBankAccounts(updatedAccounts);
      }

      onAddTransaction(payloads);
    }

    clearDraftFromStorage();

    // Reset Form and close
    handleCancel();
  };

  // Memoized totals for each filter pill based on other active filters (search, status, period)
  const pillTotals = React.useMemo(() => {
    const list = transactions
      .filter(t => t.tipo !== 'CONTAS BANCARIAS' && t.tipo !== 'CARTÃO DE CRÉDITO') // Hide non-ledger configuration rows
      .filter(t => {
        // Search Box Filtering
        const term = searchTerm.toLowerCase();
        if (!term) return true;
        const desc = (t.descricao || '').toLowerCase();
        const cat = (t.categoria || '').toLowerCase();
        const valRaw = t.valor !== undefined && t.valor !== null ? t.valor : 0;
        const valStr = valRaw.toString();
        const valBRL = valRaw.toFixed(2).replace('.', ',');
        return (
          desc.includes(term) ||
          cat.includes(term) ||
          valStr.includes(term) ||
          valBRL.includes(term)
        );
      })
      .filter(t => {
        // Period Filtering
        if (!periodoInicio && !periodoFim) return true;
        const txDateObj = parseTxDate(t.data);
        if (!txDateObj) return false;
        const txTime = txDateObj.getTime();

        if (periodoInicio) {
          const startObj = parseInputDate(periodoInicio);
          if (startObj && txTime < startObj.getTime()) return false;
        }
        if (periodoFim) {
          const endObj = parseInputDate(periodoFim);
          if (endObj && txTime > endObj.getTime()) return false;
        }
        return true;
      })
      .filter(t => {
        // Status Quick Filtering
        if (statusFilter === 'a_pagar') {
          return t.status === 'PENDENTE' || t.status === 'ATRASADO';
        }
        if (statusFilter === 'pago') {
          return t.status === 'PAGO' || t.status === 'REALIZADO';
        }
        if (statusFilter === 'vencendo_48h') {
          const isNotPaid = t.status?.toUpperCase() !== 'PAGO' && t.status?.toUpperCase() !== 'REALIZADO';
          const isAPagarType = t.tipo?.toUpperCase() !== 'RECEITA';
          if (!isNotPaid || !isAPagarType) return false;
          
          const todayObj = new Date();
          todayObj.setHours(0, 0, 0, 0);
          const dueDate = parseTxDate(t.data);
          if (!dueDate) return false;
          dueDate.setHours(0, 0, 0, 0);
          const diffTime = dueDate.getTime() - todayObj.getTime();
          const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return daysRemaining >= 0 && daysRemaining <= 2;
        }
        return true;
      });

    let sumTodosReceitas = 0;
    let sumTodosDespesas = 0;
    let sumReceitas = 0;
    let sumDespesas = 0;
    let sumAbastecimento = 0;
    let sumCasa = 0;
    let sumConsumo = 0;

    list.forEach(t => {
      const val = t.valor || 0;
      const isReceita = t.tipo === 'RECEITA';
      const isDespesa = t.tipo === 'DESPESA' || t.tipo === 'PAGO' || ['ETANOL', 'GAS. COMUM', 'ETANOL ADITIVADA', 'GAS, ADITIVADA'].includes(t.tipo);

      if (isReceita) {
        sumTodosReceitas += val;
        sumReceitas += val;
      }
      if (isDespesa) {
        sumTodosDespesas += val;
        sumDespesas += val;
      }
      if (t.categoria === 'ABASTECIMENTO') {
        sumAbastecimento += val;
      }
      if (t.categoria === 'CASA') {
        sumCasa += val;
      }
      if (t.categoria === 'CONSUMO' || t.categoria === 'CUMSUMO') {
        sumConsumo += val;
      }
    });

    return {
      todos: sumTodosReceitas - sumTodosDespesas,
      receita: sumReceitas,
      despesa: sumDespesas,
      abastecimento: sumAbastecimento,
      casa: sumCasa,
      consumo: sumConsumo,
      totalReceitas: sumTodosReceitas,
      totalDespesas: sumTodosDespesas
    };
  }, [transactions, searchTerm, statusFilter, periodoInicio, periodoFim]);

  const getPillTotal = (val: string) => {
    switch (val) {
      case 'todos': return pillTotals.todos;
      case 'receita': return pillTotals.receita;
      case 'despesa': return pillTotals.despesa;
      case 'abastecimento': return pillTotals.abastecimento;
      case 'casa': return pillTotals.casa;
      case 'consumo': return pillTotals.consumo;
      default: return 0;
    }
  };

  // List categories dynamically for filter pills matching Spreadsheet
  const filterPills = [
    { label: 'Todos', value: 'todos' },
    { label: 'Receitas', value: 'receita' },
    { label: 'Despesas', value: 'despesa' },
    { label: 'Abastecimento', value: 'abastecimento' },
    { label: 'Casa', value: 'casa' },
    { label: 'Consumo', value: 'consumo' }
  ];

  // Apply filters, searches, and period selection
  const rawFilteredTransactions = transactions
    .filter(t => t.tipo !== 'CONTAS BANCARIAS' && t.tipo !== 'CARTÃO DE CRÉDITO') // Hide non-ledger configuration rows
    .filter(t => {
      // Pill Filtering
      if (selectedFilter === 'receita') return t.tipo === 'RECEITA';
      if (selectedFilter === 'despesa') return t.tipo === 'DESPESA' || t.tipo === 'PAGO' || ['ETANOL', 'GAS. COMUM', 'ETANOL ADITIVADA', 'GAS, ADITIVADA'].includes(t.tipo);
      if (selectedFilter === 'abastecimento') return t.categoria === 'ABASTECIMENTO';
      if (selectedFilter === 'casa') return t.categoria === 'CASA';
      if (selectedFilter === 'consumo') return t.categoria === 'CONSUMO' || t.categoria === 'CUMSUMO';
      return true;
    })
    .filter(t => {
      // Status Quick Filtering
      if (statusFilter === 'a_pagar') {
        return t.status === 'PENDENTE' || t.status === 'ATRASADO';
      }
      if (statusFilter === 'pago') {
        return t.status === 'PAGO' || t.status === 'REALIZADO';
      }
      if (statusFilter === 'vencendo_48h') {
        const isNotPaid = t.status?.toUpperCase() !== 'PAGO' && t.status?.toUpperCase() !== 'REALIZADO';
        const isAPagarType = t.tipo?.toUpperCase() !== 'RECEITA';
        if (!isNotPaid || !isAPagarType) return false;
        
        const todayObj = new Date();
        todayObj.setHours(0, 0, 0, 0);
        const dueDate = parseTxDate(t.data);
        if (!dueDate) return false;
        dueDate.setHours(0, 0, 0, 0);
        const diffTime = dueDate.getTime() - todayObj.getTime();
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return daysRemaining >= 0 && daysRemaining <= 2;
      }
      return true;
    })
    .filter(t => {
      // Search Box Filtering
      const term = searchTerm.toLowerCase();
      const desc = (t.descricao || '').toLowerCase();
      const cat = (t.categoria || '').toLowerCase();
      const valRaw = t.valor !== undefined && t.valor !== null ? t.valor : 0;
      const valStr = valRaw.toString();
      const valBRL = valRaw.toFixed(2).replace('.', ',');
      return (
        desc.includes(term) ||
        cat.includes(term) ||
        valStr.includes(term) ||
        valBRL.includes(term)
      );
    })
    .filter(t => {
      // Period Filtering
      if (!periodoInicio && !periodoFim) return true;
      const txDateObj = parseTxDate(t.data);
      if (!txDateObj) return false;
      const txTime = txDateObj.getTime();

      if (periodoInicio) {
        const startObj = parseInputDate(periodoInicio);
        if (startObj && txTime < startObj.getTime()) return false;
      }
      if (periodoFim) {
        const endObj = parseInputDate(periodoFim);
        if (endObj && txTime > endObj.getTime()) return false;
      }
      return true;
    });

  // Sort them by date descending (latest first) to ensure "os últimos lançamentos" are at the top
  const filteredTransactions = [...rawFilteredTransactions].sort((a, b) => {
    const dateA = parseTxDate(a.data)?.getTime() || 0;
    const dateB = parseTxDate(b.data)?.getTime() || 0;
    return dateB - dateA; // latest first
  });

  const hasActivePeriod = !!(periodoInicio || periodoFim);
  const shouldLimit = selectedFilter !== 'todos' && !hasActivePeriod && !ignorarLimite;
  
  const displayedTransactions = shouldLimit 
    ? filteredTransactions.slice(0, limiteLancamentos)
    : filteredTransactions;

  // Compute counts for status quick filter buttons (scoped to other active filters)
  const baseFilteredForStatusCounts = transactions
    .filter(t => t.tipo !== 'CONTAS BANCARIAS' && t.tipo !== 'CARTÃO DE CRÉDITO')
    .filter(t => {
      if (selectedFilter === 'receita') return t.tipo === 'RECEITA';
      if (selectedFilter === 'despesa') return t.tipo === 'DESPESA' || t.tipo === 'PAGO' || ['ETANOL', 'GAS. COMUM', 'ETANOL ADITIVADA', 'GAS, ADITIVADA'].includes(t.tipo);
      if (selectedFilter === 'abastecimento') return t.categoria === 'ABASTECIMENTO';
      if (selectedFilter === 'casa') return t.categoria === 'CASA';
      if (selectedFilter === 'consumo') return t.categoria === 'CONSUMO' || t.categoria === 'CUMSUMO';
      return true;
    })
    .filter(t => {
      const term = searchTerm.toLowerCase();
      const desc = (t.descricao || '').toLowerCase();
      const cat = (t.categoria || '').toLowerCase();
      const valRaw = t.valor !== undefined && t.valor !== null ? t.valor : 0;
      const valStr = valRaw.toString();
      const valBRL = valRaw.toFixed(2).replace('.', ',');
      return (
        desc.includes(term) ||
        cat.includes(term) ||
        valStr.includes(term) ||
        valBRL.includes(term)
      );
    })
    .filter(t => {
      if (!periodoInicio && !periodoFim) return true;
      const txDateObj = parseTxDate(t.data);
      if (!txDateObj) return false;
      const txTime = txDateObj.getTime();
      if (periodoInicio) {
        const startObj = parseInputDate(periodoInicio);
        if (startObj && txTime < startObj.getTime()) return false;
      }
      if (periodoFim) {
        const endObj = parseInputDate(periodoFim);
        if (endObj && txTime > endObj.getTime()) return false;
      }
      return true;
    });

  const countTodos = baseFilteredForStatusCounts.length;
  const countAPagar = baseFilteredForStatusCounts.filter(t => t.status === 'PENDENTE' || t.status === 'ATRASADO').length;
  const countPago = baseFilteredForStatusCounts.filter(t => t.status === 'PAGO' || t.status === 'REALIZADO').length;
  const countVencendo48h = baseFilteredForStatusCounts.filter(t => {
    const isNotPaid = t.status?.toUpperCase() !== 'PAGO' && t.status?.toUpperCase() !== 'REALIZADO';
    const isAPagarType = t.tipo?.toUpperCase() !== 'RECEITA';
    if (!isNotPaid || !isAPagarType) return false;

    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);
    const dueDate = parseTxDate(t.data);
    if (!dueDate) return false;
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - todayObj.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return daysRemaining >= 0 && daysRemaining <= 2;
  }).length;

  const getCategoryIcon = (cat: string) => {
    switch (cat.toUpperCase()) {
      case 'RECEITA': return 'trending_up';
      case 'ABASTECIMENTO': return 'local_gas_station';
      case 'TRABALHO': return 'work';
      case 'PESSOAL': return 'person';
      case 'LAZER': return 'sports_esports';
      case 'TAXAS': case 'TAXA': return 'percent';
      case 'CASA': return 'home';
      case 'CONSUMO': case 'CUMSUMO': return 'electric_bolt';
      case 'OUTROS': return 'more_horiz';
      default: return 'payments';
    }
  };

  const getStatusBadge = (stat: string) => {
    switch (stat.toUpperCase()) {
      case 'PAGO':
        return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">PAGO</span>;
      case 'ATRASADO':
        return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] font-bold">ATRASADO</span>;
      default:
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-bold">PENDENTE</span>;
    }
  };

  const getVencimentoBadge = (tx: Transaction) => {
    if (tx.tipo === 'CONTAS BANCARIAS' || tx.tipo === 'CARTÃO DE CRÉDITO') return null;
    if (tx.status.toUpperCase() === 'PAGO') return null;

    const parts = tx.data.split('/');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    
    const txDate = new Date(year, month, day);
    txDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    if (txDate.getTime() === today.getTime()) {
      return (
        <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded text-[9px] font-bold tracking-tight animate-pulse flex items-center gap-0.5">
          <span className="w-1 h-1 rounded-full bg-rose-400 animate-ping"></span>
          VENCE HOJE
        </span>
      );
    } else if (txDate.getTime() === tomorrow.getTime()) {
      return (
        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[9px] font-bold tracking-tight flex items-center gap-0.5">
          <span className="w-1 h-1 rounded-full bg-amber-400"></span>
          VENCE AMANHÃ
        </span>
      );
    }
    return null;
  };

  if (showAddForm) {
    // Add/Edit Transaction Form Canvas
    return (
      <div className="space-y-6 animate-fade-in">
        <nav className="flex justify-between items-center px-1">
          <button 
            onClick={handleCancel}
            className="p-2 hover:bg-slate-800 rounded-full transition-colors cursor-pointer text-slate-400"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <span className="font-bold text-white text-lg font-display">
            {editingTx ? 'Editar Transação' : 'Adicionar Transação'}
          </span>
          <div className="w-10"></div>
        </nav>

        <form onSubmit={handleFormSubmit} className="space-y-6">
          {/* Transaction Type Combobox */}
          {(category === 'NOVA_CATEGORIA' ? newCategoryName.trim().toUpperCase() : category.toUpperCase()) !== 'ABASTECIMENTO' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Tipo de Transação</label>
              <div className="relative">
                <select
                  value={txType}
                  onChange={(e) => {
                    setTxType(e.target.value);
                    if (e.target.value !== 'NOVO_TIPO') {
                      setNewTypeName('');
                      setFuelType(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none appearance-none cursor-pointer font-sans"
                >
                  {typesList.map((typeName) => (
                    <option key={typeName} value={typeName} className="bg-slate-900 text-white font-sans">
                      {typeName}
                    </option>
                  ))}
                  <option value="NOVO_TIPO" className="bg-slate-900 text-emerald-400 font-bold font-sans">
                    + NOVO TIPO...
                  </option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                  <span className="material-symbols-outlined text-lg">expand_more</span>
                </div>
              </div>

              {/* Input for new custom type */}
              {txType === 'NOVO_TIPO' && (
                <div className="space-y-1.5 mt-2.5 animate-fade-in">
                  <label className="block text-xs font-semibold text-slate-300">Nome do Novo Tipo</label>
                  <input
                    type="text"
                    required
                    value={newTypeName}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setNewTypeName(val);
                      setFuelType(val);
                    }}
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-sans"
                    placeholder="DIGITE O NOME DO TIPO..."
                  />
                </div>
              )}
            </div>
          )}

          {/* Value Numeric Input */}
          <div className="text-center bg-slate-900/40 border border-slate-800 p-6 rounded-2xl">
            <label className="block text-xs font-mono tracking-widest text-slate-400 uppercase mb-2">Valor da Operação</label>
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-lg font-bold text-emerald-400 font-mono">R$</span>
              <input
                type="text"
                value={amountStr}
                onChange={handleAmountInput}
                className="bg-transparent border-none text-3xl font-bold text-white w-full max-w-[200px] text-center p-0 placeholder:opacity-30 focus:ring-0 focus:outline-none font-display"
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Description field */}
          {(category === 'NOVA_CATEGORIA' ? newCategoryName.trim().toUpperCase() : category.toUpperCase()) !== 'ABASTECIMENTO' && (
            <div className="space-y-1.5 animate-fade-in">
              <label className="block text-xs font-semibold text-slate-300">Descrição / Estabelecimento</label>
              <input
                type="text"
                required
                value={desc}
                onChange={(e) => setDesc(e.target.value.toUpperCase())}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                placeholder="Ex: POSTO GUARANI, UBER RECEITA, etc."
              />
            </div>
          )}

          {/* Category Dropdown (Combobox) */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">Categoria da Transação</label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => {
                  const val = e.target.value;
                  setCategory(val);
                  if (val !== 'NOVA_CATEGORIA') {
                    setNewCategoryName('');
                    if (val.toUpperCase() === 'ABASTECIMENTO') {
                      setFuelType('ETANOL');
                      setTxType('ETANOL');
                    }
                  }
                }}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none appearance-none cursor-pointer font-sans"
              >
                {categoriesList.map((catName) => (
                  <option key={catName} value={catName} className="bg-slate-900 text-white font-sans">
                    {catName}
                  </option>
                ))}
                <option value="NOVA_CATEGORIA" className="bg-slate-900 text-emerald-400 font-bold font-sans">
                  + NOVA CATEGORIA...
                </option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                <span className="material-symbols-outlined text-lg">expand_more</span>
              </div>
            </div>

            {/* Input for new custom category */}
            {category === 'NOVA_CATEGORIA' && (
              <div className="space-y-1.5 mt-2.5 animate-fade-in">
                <label className="block text-xs font-semibold text-slate-300">Nome da Nova Categoria</label>
                <input
                  type="text"
                  required
                  value={newCategoryName}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setNewCategoryName(val);
                    if (val === 'ABASTECIMENTO') {
                      setFuelType('ETANOL');
                      setTxType('ETANOL');
                    }
                  }}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-sans"
                  placeholder="DIGITE O NOME DA CATEGORIA..."
                />
              </div>
            )}
          </div>

          {/* Fuel Specific Fields for Abastecimento category */}
          {(category === 'NOVA_CATEGORIA' ? newCategoryName.trim().toUpperCase() : category.toUpperCase()) === 'ABASTECIMENTO' && (
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl space-y-4 animate-fade-in">
              <p className="text-[11px] font-bold text-emerald-400 font-mono uppercase tracking-wider">
                Dados do Combustível &amp; Veículo
              </p>

              {/* Fuel Type selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Tipo de Combustível</label>
                <div className="grid grid-cols-4 gap-2">
                  {['ETANOL', 'GAS. COMUM', 'GAS. ADITIVADA', 'DIESEL'].map((fuel) => (
                    <button
                      key={fuel}
                      type="button"
                      onClick={() => {
                        setFuelType(fuel);
                        setTxType(fuel);
                      }}
                      className={`py-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer border ${
                        fuelType === fuel
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {fuel}
                    </button>
                  ))}
                </div>
              </div>

              {/* KM / Odômetro & Veículo in a grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">KM / Odômetro</label>
                  <input
                    type="number"
                    value={km}
                    onChange={(e) => setKm(e.target.value)}
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                    placeholder="Ex: 125430"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Veículo</label>
                  <div className="relative">
                    <select
                      value={veiculo}
                      onChange={(e) => setVeiculo(e.target.value)}
                      className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none appearance-none cursor-pointer font-sans"
                    >
                      <option value="CARRO" className="bg-slate-900 text-white font-sans">CARRO</option>
                      <option value="MOTO" className="bg-slate-900 text-white font-sans">MOTO</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-slate-400">
                      <span className="material-symbols-outlined text-sm">expand_more</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vehicle Description field */}
              <div className="space-y-1.5 mt-2.5">
                <label className="block text-xs font-semibold text-slate-300">Descrição do Veículo</label>
                <div className="relative">
                  <select
                    value={descricaoVeiculo}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'CUSTOM_ACTION') {
                        if (showAlert) {
                          showAlert("Como Cadastrar", "Para cadastrar novos veículos e motoristas, acesse a aba 'Perfil' na barra de navegação principal e clique em 'Cadastrar Veículo'.");
                        }
                        return;
                      }
                      setDescricaoVeiculo(val);
                      const matched = registeredVehicles.find(v => v.descricao === val);
                      if (matched) {
                        setMotorista(matched.motorista);
                        if (matched.descricao.toUpperCase().includes('MOTO')) {
                          setVeiculo('MOTO');
                        } else {
                          setVeiculo('CARRO');
                        }
                      }
                    }}
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none appearance-none cursor-pointer font-sans"
                  >
                    <option value="" className="bg-slate-900 text-slate-400 font-sans">-- SELECIONE UM VEÍCULO --</option>
                    {registeredVehicles.map(v => (
                      <option key={v.id} value={v.descricao} className="bg-slate-900 text-white font-sans">
                        {v.descricao} {v.placa ? `(${v.placa})` : ''}
                      </option>
                    ))}
                    {descricaoVeiculo && !registeredVehicles.some(v => v.descricao === descricaoVeiculo) && (
                      <option value={descricaoVeiculo} className="bg-slate-900 text-white font-sans">
                        {descricaoVeiculo}
                      </option>
                    )}
                    <option value="CUSTOM_ACTION" className="bg-slate-900 text-emerald-400 font-sans font-bold">+ NOVO VEÍCULO (Cadastrar na aba Perfil)</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined text-sm">expand_more</span>
                  </div>
                </div>
              </div>

              {/* Liters & Price Per Liter in a grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Litros</label>
                  <input
                    type="text"
                    value={litros}
                    onChange={(e) => handleLitrosChange(e.target.value)}
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                    placeholder="Ex: 35,50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Preço por Litro (R$)</label>
                  <input
                    type="text"
                    value={precoLitro}
                    onChange={(e) => handlePrecoLitroChange(e.target.value)}
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                    placeholder="Ex: 5,79"
                  />
                </div>
              </div>

              {/* Valor Pago & Completou o Tanque */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Valor Pago (Valor_PG)</label>
                  <input
                    type="text"
                    value={valorPgStr}
                    onChange={(e) => {
                      let raw = e.target.value.replace(/\D/g, "");
                      if (!raw) {
                        setValorPgStr('0,00');
                        return;
                      }
                      let numeric = parseInt(raw, 10) / 100;
                      setValorPgStr(numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                    }}
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                    placeholder="Ex: 120,00"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Completou o Tanque?</label>
                  <div className="grid grid-cols-2 gap-2 h-[34px]">
                    <button
                      key="sim"
                      type="button"
                      onClick={() => setCompletouTanque(true)}
                      className={`rounded-xl text-[10px] font-bold transition-all cursor-pointer border ${
                        completouTanque
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      SIM
                    </button>
                    <button
                      key="nao"
                      type="button"
                      onClick={() => setCompletouTanque(false)}
                      className={`rounded-xl text-[10px] font-bold transition-all cursor-pointer border ${
                        !completouTanque
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      NÃO
                    </button>
                  </div>
                </div>
              </div>

              {/* Nome Posto & Localização */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 relative">
                  <label className="block text-xs font-semibold text-slate-300">Nome do Posto</label>
                  <input
                    type="text"
                    value={nomePosto}
                    onChange={(e) => {
                      setNomePosto(e.target.value.toUpperCase());
                      setShowPostoSuggestions(true);
                    }}
                    onFocus={() => setShowPostoSuggestions(true)}
                    onBlur={() => {
                      // Slight delay to allow clicks on suggestion options to register
                      setTimeout(() => setShowPostoSuggestions(false), 200);
                    }}
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                    placeholder="Ex: Posto BR"
                  />
                  {showPostoSuggestions && (filteredStations.length > 0 || onlinePostoSuggestions.length > 0 || isSearchingPosto) && (
                    <div className="absolute left-0 right-0 top-[100%] mt-1 max-h-64 overflow-y-auto bg-slate-950 border border-slate-850 rounded-xl z-50 shadow-2xl divide-y divide-slate-900">
                      {isSearchingPosto && (
                        <div className="px-3 py-2 text-xs text-emerald-400 font-mono animate-pulse flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                          Buscando postos próximos...
                        </div>
                      )}
                      
                      {/* Online/GPS suggestions */}
                      {onlinePostoSuggestions.map((item, index) => (
                        <button
                          key={`online-${index}-${item.name}`}
                          type="button"
                          onMouseDown={() => {
                            setNomePosto(item.name);
                            if (item.address) {
                              setLocalizacaoPosto(item.address);
                            }
                            setShowPostoSuggestions(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-slate-100 hover:text-white hover:bg-emerald-500/10 font-sans transition-colors block cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                            <span className="material-symbols-outlined text-xs">my_location</span>
                            {item.name}
                          </div>
                          {item.address && (
                            <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-full font-mono">
                              {item.address}
                            </div>
                          )}
                        </button>
                      ))}

                      {/* Local suggestions */}
                      {filteredStations.map(station => (
                        <button
                          key={`local-${station}`}
                          type="button"
                          onMouseDown={() => {
                            setNomePosto(station);
                            setShowPostoSuggestions(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-900 font-sans transition-colors block cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                            <span className="material-symbols-outlined text-xs">history</span>
                            {station}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300 flex justify-between items-center">
                    <span>Localização do Posto</span>
                    {locationError && (
                      <span className="text-[9px] text-rose-400 font-mono animate-pulse">
                        {locationError}
                      </span>
                    )}
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={localizacaoPosto}
                      onChange={(e) => {
                        setLocalizacaoPosto(e.target.value.toUpperCase());
                        if (locationError) setLocationError(null);
                      }}
                      className="w-full bg-slate-900/60 border border-slate-800 rounded-xl pl-3 pr-9 py-2 text-xs text-white focus:border-emerald-500 outline-none transition-all"
                      placeholder={isFetchingLocation ? "Buscando localização..." : "Ex: Av. Brasil, 1500"}
                      disabled={isFetchingLocation}
                    />
                    <button
                      type="button"
                      onClick={handleFetchLocation}
                      disabled={isFetchingLocation}
                      className={`absolute right-1.5 p-1 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer flex items-center justify-center ${
                        isFetchingLocation ? 'animate-spin text-emerald-400' : 'hover:bg-slate-800'
                      }`}
                      title="Buscar minha localização atual"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isFetchingLocation ? 'sync' : 'my_location'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Motorista */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Motorista</label>
                <div className="relative">
                  <select
                    value={motorista}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'CUSTOM_ACTION') {
                        if (showAlert) {
                          showAlert("Como Cadastrar", "Para cadastrar novos veículos e motoristas, acesse a aba 'Perfil' na barra de navegação principal e clique em 'Cadastrar Veículo'.");
                        }
                        return;
                      }
                      setMotorista(val);
                    }}
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none appearance-none cursor-pointer font-sans"
                  >
                    <option value="" className="bg-slate-900 text-slate-400 font-sans">-- SELECIONE O MOTORISTA --</option>
                    {Array.from(new Set(registeredVehicles.map(v => v.motorista))).filter(Boolean).map(driver => (
                      <option key={driver} value={driver} className="bg-slate-900 text-white font-sans">
                        {driver}
                      </option>
                    ))}
                    {motorista && !registeredVehicles.some(v => v.motorista === motorista) && (
                      <option value={motorista} className="bg-slate-900 text-white font-sans">
                        {motorista}
                      </option>
                    )}
                    <option value="CUSTOM_ACTION" className="bg-slate-900 text-emerald-400 font-sans font-bold">+ NOVO MOTORISTA (Cadastrar na aba Perfil)</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined text-sm">expand_more</span>
                  </div>
                </div>
              </div>

              {/* Live Calculations Section */}
              {(() => {
                const stats = getLiveStats();
                if (stats.kmPercorrido <= 0) return null;
                return (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl space-y-1 text-xs font-mono">
                    <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Cálculos do Abastecimento:</p>
                    <div className="flex justify-between text-slate-300">
                      <span>KM Percorrido:</span>
                      <span className="text-white font-bold">{stats.kmPercorrido.toLocaleString('pt-BR')} KM</span>
                    </div>
                    {stats.mediaKmL > 0 && (
                      <div className="flex justify-between text-slate-300">
                        <span>Média Prevista:</span>
                        <span className="text-white font-bold">{stats.mediaKmL.toFixed(2).replace('.', ',')} Km/L</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Banco / Conta para Lançamento */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">Banco / Conta para Lançamento</label>
            <div className="relative">
              <select
                value={formBankId}
                onChange={(e) => setFormBankId(Number(e.target.value))}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 h-[46px] text-xs text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none appearance-none cursor-pointer"
              >
                <option value={0} className="bg-slate-900 text-slate-400">-- SELECIONE UM BANCO (OPCIONAL) --</option>
                {bankAccounts.map((acc) => {
                  const isNegative = acc.saldoInicial < 0;
                  const saldoText = isNegative
                    ? `Devedor: R$ ${Math.abs(acc.saldoInicial).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : `Saldo: R$ ${acc.saldoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  const limitText = acc.limite !== undefined && acc.limite > 0
                    ? ` | Lim. Restante: R$ ${Math.max(0, acc.limite + acc.saldoInicial).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '';
                  return (
                    <option key={acc.id} value={acc.id} className="bg-slate-900 text-white font-sans">
                      {acc.nome} ({saldoText}{limitText})
                    </option>
                  );
                })}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                <span className="material-symbols-outlined text-lg">expand_more</span>
              </div>
            </div>
            {formBankId > 0 && status !== 'PAGO' && (
              <p className="text-[10px] text-amber-400/80 font-mono italic">
                ℹ️ Como o status está como "{status === 'PENDENTE' ? 'Pendente' : 'Atrasado'}", o saldo da conta não será alterado até que a transação seja paga.
              </p>
            )}
            {formBankId > 0 && status === 'PAGO' && (
              <p className="text-[10px] text-emerald-400/80 font-mono italic">
                ✅ O saldo da conta será atualizado automaticamente ao confirmar a transação.
              </p>
            )}
          </div>

          {/* Date Picker & Status Config */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Data da Operação</label>
              <DateComboInput
                value={date}
                onChange={(val) => setDate(val)}
                required
                className="w-full bg-slate-900/60 border border-slate-800 rounded-xl h-[46px] px-2 text-xs text-white focus:border-emerald-500 outline-none cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-[46px] bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none cursor-pointer"
              >
                <option value="PAGO">Pago / Liquidado</option>
                <option value="PENDENTE">Pendente</option>
                <option value="ATRASADO">Atrasado / Pendência</option>
              </select>
            </div>
          </div>

          {/* Opção de Parcelamento */}
          {!editingTx && (
            <div className="grid grid-cols-2 gap-4 border-t border-slate-800/40 pt-4 mt-1">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Número de Parcelas</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="48"
                    value={installments}
                    onChange={(e) => setInstallments(e.target.value)}
                    className="w-full h-[46px] bg-slate-900/60 border border-slate-800 rounded-xl px-3 text-xs text-white focus:border-emerald-500 outline-none font-mono"
                    placeholder="1 (Lançamento único)"
                  />
                </div>
              </div>

              {parseInt(installments, 10) > 1 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Como dividir o valor?</label>
                  <select
                    value={comoDividir}
                    onChange={(e) => setComoDividir(e.target.value)}
                    className="w-full h-[46px] bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none cursor-pointer"
                  >
                    <option value="DIVIDIR_TOTAL">Dividir valor pelas parcelas</option>
                    <option value="REPETIR_VALOR">Repetir valor em cada parcela</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* OBS */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">Observações (OBS)</label>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value.toUpperCase())}
              className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:border-emerald-500 outline-none h-20 resize-none"
              placeholder="Ex: Nota fiscal enviada por e-mail ou observações adicionais"
            />
          </div>

          {/* Submit Actions */}
          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            {!editingTx && (
              <button
                type="button"
                onClick={() => {
                  clearDraftFromStorage();
                  handleCancel();
                }}
                className="flex-1 border border-rose-500/20 hover:bg-rose-500/10 text-rose-400 h-12 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="Apaga as informações salvas deste rascunho"
              >
                Limpar Rascunho
              </button>
            )}
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 border border-slate-800 hover:bg-slate-900/60 text-slate-300 h-12 rounded-xl text-xs font-bold transition-all cursor-pointer"
              title="Fecha o formulário mantendo as informações para depois"
            >
              {editingTx ? 'Cancelar' : 'Manter Rascunho'}
            </button>
            <button
              type="submit"
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 h-12 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">check_circle</span>
              Salvar Operação
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-display">Atividade Financeira</h2>
          <p className="text-xs text-slate-400">Gerenciamento completo de fluxo de caixa e combustíveis.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onReindexTransactions && (
            <button
              onClick={onReindexTransactions}
              className="bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/25 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
              title="Renumerar e reordenar todos os lançamentos sequencialmente a partir de 1"
            >
              <span className="material-symbols-outlined text-[16px]">format_list_numbered</span> Renumerar IDs
            </button>
          )}
          {onWipeTransactions && (
            <button
              onClick={onWipeTransactions}
              className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
              title="Limpar todas as transações (planilha financeira) do aplicativo"
            >
              <span className="material-symbols-outlined text-[16px]">delete_sweep</span> Limpar
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-750 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="Exportar planilha Excel/CSV"
          >
            <span className="material-symbols-outlined text-[16px]">download</span> Planilha
          </button>
          <button
            onClick={handleExportPDF}
            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="Exportar relatorio PDF para impressao ou compartilhamento"
          >
            <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span> Relatorio PDF
          </button>
          <button
            onClick={() => {
              loadDraft();
              setShowAddForm(true);
            }}
            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span> Adicionar
          </button>
        </div>
      </div>

      {/* Google Sheets Synchronization Card */}
      <div className="bg-slate-900/30 border border-slate-800/40 rounded-2xl p-4 space-y-3" id="google-sync-card">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-400 text-xl">grid_on</span>
            <div>
              <h3 className="text-sm font-bold text-slate-100 font-display">Planilha no Google Drive</h3>
              <p className="text-[10px] text-slate-400">Sincronize suas transações com a planilha do Google Drive</p>
            </div>
          </div>
          {googleUser ? (
            <button 
              onClick={onGoogleLogout}
              className="text-[10px] font-bold text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded border border-red-500/20 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[13px]">logout</span> Desconectar
            </button>
          ) : (
            <button 
              onClick={onGoogleLogin}
              className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow active:scale-95"
            >
              <span className="material-symbols-outlined text-[14px]">link</span> Conectar Drive
            </button>
          )}
        </div>
 
        {googleUser && (
          <div className="pt-2 border-t border-slate-800/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                <span className="text-[11px] font-medium font-mono text-slate-400">
                  Logado como: <strong className="text-slate-200">{googleUser.displayName || googleUser.email}</strong>
                </span>
              </div>
              {lastSyncedTime && (
                <p className="text-[10px] text-slate-400 font-mono">
                  Última sincronização: <span className="text-slate-300">{lastSyncedTime}</span>
                </p>
              )}
              {spreadsheetUrl && (
                <a 
                  href={spreadsheetUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-400 hover:text-sky-300 transition-colors underline"
                >
                  <span className="material-symbols-outlined text-xs">open_in_new</span>
                  Abrir Planilha do Google Sheets
                </a>
              )}
            </div>
 
            <div className="flex flex-wrap items-center gap-3.5 w-full md:w-auto justify-between md:justify-end">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={autoSync}
                  onChange={(e) => onToggleAutoSync(e.target.checked)}
                  className="accent-emerald-500 w-3.5 h-3.5 rounded bg-slate-950 border-slate-850"
                />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Auto-Sincronizar</span>
              </label>
 
              <div className="flex items-center gap-2">
                <button
                  onClick={onTriggerImport}
                  disabled={isImporting || isSyncing}
                  className={`bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer ${isImporting ? 'opacity-50 cursor-wait' : ''}`}
                >
                  <span className={`material-symbols-outlined text-[14px] ${isImporting ? 'animate-spin' : ''}`}>
                    {isImporting ? 'sync' : 'cloud_download'}
                  </span>
                  {isImporting ? 'Buscando...' : 'Atualizar no App'}
                </button>
 
                <button
                  onClick={() => onTriggerSync()}
                  disabled={isSyncing || isImporting}
                  className={`bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer ${isSyncing ? 'opacity-50 cursor-wait' : ''}`}
                >
                  <span className={`material-symbols-outlined text-[14px] ${isSyncing ? 'animate-spin' : ''}`}>
                    {isSyncing ? 'sync' : 'cloud_upload'}
                  </span>
                  {isSyncing ? 'Enviando...' : 'Enviar p/ Planilha'}
                </button>
              </div>
            </div>
          </div>
        )}

        {syncError && (
          <p className="text-[10px] text-red-400 bg-red-500/5 border border-red-500/20 px-3 py-1.5 rounded-lg font-mono">
            <strong>Erro:</strong> {syncError}
          </p>
        )}
      </div>

      {/* Alertas de Vencimento de Lançamentos (Vence Hoje / Vence Amanhã) */}
      {(() => {
        const warningTransactions = transactions.filter(t => {
          if (t.tipo === 'CONTAS BANCARIAS' || t.tipo === 'CARTÃO DE CRÉDITO') return false;
          if (t.status.toUpperCase() === 'PAGO') return false;
          
          const parts = t.data.split('/');
          if (parts.length !== 3) return false;
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          
          const txDate = new Date(year, month, day);
          txDate.setHours(0, 0, 0, 0);

          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const tomorrow = new Date();
          tomorrow.setDate(today.getDate() + 1);
          tomorrow.setHours(0, 0, 0, 0);

          return txDate.getTime() === today.getTime() || txDate.getTime() === tomorrow.getTime();
        });

        if (warningTransactions.length === 0) return null;

        return (
          <div className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-2xl space-y-3 animate-fade-in" id="vencimentos-alerta">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-lg animate-pulse">warning</span>
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-amber-300">
                  Aviso de Vencimentos Importantes
                </h3>
              </div>
              <span className="bg-amber-500/20 text-amber-300 font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded-md">
                {warningTransactions.length} {warningTransactions.length === 1 ? 'LANÇAMENTO' : 'LANÇAMENTOS'}
              </span>
            </div>
            
            <div className="space-y-2">
              {warningTransactions.map(tx => {
                const parts = tx.data.split('/');
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                const txDate = new Date(year, month, day);
                txDate.setHours(0, 0, 0, 0);

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isToday = txDate.getTime() === today.getTime();

                return (
                  <div key={tx.id} className="flex justify-between items-center bg-slate-950/50 p-3 rounded-xl border border-slate-850">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${isToday ? 'bg-rose-500 animate-ping' : 'bg-amber-400'}`} />
                      <div>
                        <p className="text-xs font-bold text-white uppercase tracking-tight flex items-center gap-1.5">
                          <span className="text-[9px] bg-slate-800 text-slate-400 font-mono px-1.5 py-0.5 rounded border border-slate-700">#{tx.id}</span>
                          <span>{tx.descricao}</span>
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">
                          Vence <strong className={isToday ? 'text-rose-400 font-bold' : 'text-amber-400 font-bold'}>{isToday ? 'HOJE' : 'AMANHÃ'}</strong> • {tx.categoria}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold font-mono text-white">
                        {formatBRL(tx.valor)}
                      </p>
                      <button
                        onClick={() => handleStartEdit(tx)}
                        className="text-[9px] font-bold text-sky-400 hover:underline mt-0.5 cursor-pointer"
                      >
                        Liquidar / Editar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Searching input bar */}
      <div className="relative group">
        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg group-focus-within:text-emerald-400 transition-colors">search</span>
        <input
          id="transaction-search-input"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por descrição, valor ou categoria..."
          className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500/80 rounded-xl py-3 pl-11 pr-10 text-xs sm:text-sm text-white focus:outline-none transition-all placeholder:text-slate-500 shadow-inner group-hover:border-slate-700/80"
        />
        {searchTerm && (
          <button 
            onClick={() => setSearchInput('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
            type="button"
            title="Limpar busca"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        )}
      </div>

      {/* Pesquisa por Período */}
      <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="material-symbols-outlined text-base text-emerald-400">calendar_month</span>
            <span className="text-xs font-bold font-mono uppercase tracking-wider">Filtrar Histórico por Período</span>
          </div>
          {(periodoInicio || periodoFim) && (
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                Filtro Ativo
              </span>
              <button
                type="button"
                onClick={() => {
                  setPeriodoInicio('');
                  setPeriodoFim('');
                }}
                className="text-[10px] font-bold text-rose-400 hover:text-rose-300 transition-colors uppercase tracking-wider font-mono flex items-center gap-0.5"
              >
                <span className="material-symbols-outlined text-xs">close</span> Limpar
              </button>
            </div>
          )}
        </div>

        {/* Atalhos Rápidos de Período */}
        <div className="space-y-2">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono block">Atalhos Rápidos de Período</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setPeriodPreset('este_mes')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase font-mono tracking-wider transition-all border cursor-pointer active:scale-95 ${
                isPresetActive('este_mes')
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold shadow-sm shadow-emerald-500/10'
                  : 'bg-slate-950/60 text-slate-400 border-slate-850 hover:text-slate-200 hover:bg-slate-900 hover:border-slate-800'
              }`}
            >
              📅 Este Mês
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('mes_passado')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase font-mono tracking-wider transition-all border cursor-pointer active:scale-95 ${
                isPresetActive('mes_passado')
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold shadow-sm shadow-emerald-500/10'
                  : 'bg-slate-950/60 text-slate-400 border-slate-850 hover:text-slate-200 hover:bg-slate-900 hover:border-slate-800'
              }`}
            >
              📅 Mês Passado
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('30_dias')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase font-mono tracking-wider transition-all border cursor-pointer active:scale-95 ${
                isPresetActive('30_dias')
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold shadow-sm shadow-emerald-500/10'
                  : 'bg-slate-950/60 text-slate-400 border-slate-850 hover:text-slate-200 hover:bg-slate-900 hover:border-slate-800'
              }`}
            >
              ⚡ Últimos 30 Dias
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('90_dias')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase font-mono tracking-wider transition-all border cursor-pointer active:scale-95 ${
                isPresetActive('90_dias')
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold shadow-sm shadow-emerald-500/10'
                  : 'bg-slate-950/60 text-slate-400 border-slate-850 hover:text-slate-200 hover:bg-slate-900 hover:border-slate-800'
              }`}
            >
              ⚡ Últimos 90 Dias
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('este_ano')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase font-mono tracking-wider transition-all border cursor-pointer active:scale-95 ${
                isPresetActive('este_ano')
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold shadow-sm shadow-emerald-500/10'
                  : 'bg-slate-950/60 text-slate-400 border-slate-850 hover:text-slate-200 hover:bg-slate-900 hover:border-slate-800'
              }`}
            >
              🏆 Ano Atual
            </button>
          </div>
        </div>

        {/* Date Inputs Form Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 items-end pt-1">
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Data de Início</span>
            <DateComboInput
              value={periodoInicio}
              onChange={setPeriodoInicio}
              className="!py-2.5 !px-3.5 bg-slate-950 border border-slate-850 focus:border-emerald-500 hover:border-slate-800 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Data de Fim</span>
            <DateComboInput
              value={periodoFim}
              onChange={setPeriodoFim}
              className="!py-2.5 !px-3.5 bg-slate-950 border border-slate-850 focus:border-emerald-500 hover:border-slate-800 transition-colors"
            />
          </div>
          <div className="pt-2">
            {(periodoInicio || periodoFim) ? (
              <button
                type="button"
                onClick={() => {
                  setPeriodoInicio('');
                  setPeriodoFim('');
                }}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 active:scale-[0.98] text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold uppercase font-mono tracking-wide transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">backspace</span>
                Limpar Filtros
              </button>
            ) : (
              <div className="text-[10px] text-slate-500 italic font-mono leading-tight pb-2 block">
                Insira datas customizadas ou use os atalhos para filtrar lançamentos.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter pills list with count and dynamic totals */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full">
        {filterPills.map(p => {
          let icon = 'list';
          let activeColor = 'bg-emerald-500 text-slate-950 font-bold border-emerald-400/20';
          let iconColor = 'text-emerald-950';
          let inactiveIconColor = 'text-slate-400';
          
          if (p.value === 'receita') {
            icon = 'trending_up';
            if (selectedFilter === 'receita') {
              activeColor = 'bg-emerald-500 text-slate-950 font-bold border-emerald-400/20';
              iconColor = 'text-emerald-950';
            }
          } else if (p.value === 'despesa') {
            icon = 'trending_down';
            if (selectedFilter === 'despesa') {
              activeColor = 'bg-rose-500 text-white font-bold border-rose-400/20';
              iconColor = 'text-white';
            }
          } else if (p.value === 'abastecimento') {
            icon = 'local_gas_station';
            if (selectedFilter === 'abastecimento') {
              activeColor = 'bg-sky-500 text-slate-950 font-bold border-sky-400/20';
              iconColor = 'text-sky-950';
            }
          } else if (p.value === 'casa') {
            icon = 'home';
            if (selectedFilter === 'casa') {
              activeColor = 'bg-indigo-500 text-white font-bold border-indigo-400/20';
              iconColor = 'text-white';
            }
          } else if (p.value === 'consumo') {
            icon = 'shopping_bag';
            if (selectedFilter === 'consumo') {
              activeColor = 'bg-amber-500 text-slate-950 font-bold border-amber-400/20';
              iconColor = 'text-amber-950';
            }
          }

          const isSelected = selectedFilter === p.value;
          const pillTotalVal = getPillTotal(p.value);

          return (
            <button
              key={p.value}
              onClick={() => setSelectedFilter(p.value)}
              className={`px-3 py-2.5 sm:px-4 sm:py-2 rounded-xl text-xs font-semibold tracking-tight transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 border active:scale-95 ${
                isSelected
                  ? `${activeColor} shadow-lg border-transparent shadow-emerald-500/10`
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white hover:bg-slate-850 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 justify-center">
                <span className={`material-symbols-outlined text-[16px] ${isSelected ? iconColor : inactiveIconColor}`}>
                  {icon}
                </span>
                <span>{p.label}</span>
              </div>
              <span className={`text-[9px] font-mono font-bold leading-none mt-0.5 ${
                isSelected 
                  ? (p.value === 'despesa' || p.value === 'casa' ? 'text-white/90' : 'text-slate-950/90')
                  : p.value === 'todos'
                    ? (pillTotalVal >= 0 ? 'text-emerald-400' : 'text-rose-400/90')
                    : p.value === 'receita'
                      ? 'text-emerald-400'
                      : 'text-rose-400/90'
              }`}>
                {formatBRL(pillTotalVal)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Seletor de Filtro de Status Rápido */}
      <div className="bg-slate-900/30 border border-slate-800/60 p-3.5 rounded-2xl space-y-2.5 w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="material-symbols-outlined text-[15px] leading-none text-indigo-400">filter_alt</span>
            <span className="text-[10px] font-bold font-mono uppercase tracking-wider">Situação de Pagamento</span>
          </div>
          {statusFilter !== 'todos' && (
            <button
              onClick={() => setStatusFilter('todos')}
              className="text-[9px] font-bold text-rose-400 hover:text-rose-300 transition-all font-mono uppercase tracking-wider flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[11px]">close</span>
              Limpar Situação
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
          {/* Option: Todos */}
          <button
            type="button"
            onClick={() => setStatusFilter('todos')}
            className={`py-2 px-2.5 rounded-xl text-xs font-semibold tracking-tight transition-all cursor-pointer flex items-center justify-center gap-1.5 border active:scale-95 ${
              statusFilter === 'todos'
                ? 'bg-slate-850 text-white font-bold border-indigo-500/30 shadow-md shadow-indigo-500/5'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white hover:bg-slate-850 hover:border-slate-700'
            }`}
          >
            <span className={`material-symbols-outlined text-[15px] ${statusFilter === 'todos' ? 'text-indigo-400' : 'text-slate-500'}`}>
              all_inclusive
            </span>
            <span>Todos</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
              statusFilter === 'todos' ? 'bg-indigo-500/15 text-indigo-300' : 'bg-slate-950 text-slate-500'
            }`}>
              {countTodos}
            </span>
          </button>

          {/* Option: A Pagar */}
          <button
            type="button"
            onClick={() => setStatusFilter('a_pagar')}
            className={`py-2 px-2.5 rounded-xl text-xs font-semibold tracking-tight transition-all cursor-pointer flex items-center justify-center gap-1.5 border active:scale-95 ${
              statusFilter === 'a_pagar'
                ? 'bg-amber-500/10 text-amber-400 font-bold border-amber-500/30 shadow-md shadow-amber-500/5'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white hover:bg-slate-850 hover:border-slate-700'
            }`}
          >
            <span className={`material-symbols-outlined text-[15px] ${statusFilter === 'a_pagar' ? 'text-amber-400' : 'text-slate-500'}`}>
              pending_actions
            </span>
            <span>A Pagar</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
              statusFilter === 'a_pagar' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-950 text-slate-500'
            }`}>
              {countAPagar}
            </span>
          </button>

          {/* Option: Vencendo em 48h */}
          <button
            type="button"
            onClick={() => setStatusFilter('vencendo_48h')}
            className={`py-2 px-2.5 rounded-xl text-xs font-semibold tracking-tight transition-all cursor-pointer flex items-center justify-center gap-1.5 border active:scale-95 ${
              statusFilter === 'vencendo_48h'
                ? 'bg-rose-500/10 text-rose-400 font-bold border-rose-500/30 shadow-md shadow-rose-500/5'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white hover:bg-slate-850 hover:border-slate-700'
            }`}
          >
            <span className={`material-symbols-outlined text-[15px] ${statusFilter === 'vencendo_48h' ? 'text-rose-400' : 'text-slate-500'}`}>
              notifications_active
            </span>
            <span>Vencendo 48h</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
              statusFilter === 'vencendo_48h' ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-950 text-slate-500'
            }`}>
              {countVencendo48h}
            </span>
          </button>

          {/* Option: Pago */}
          <button
            type="button"
            onClick={() => setStatusFilter('pago')}
            className={`py-2 px-2.5 rounded-xl text-xs font-semibold tracking-tight transition-all cursor-pointer flex items-center justify-center gap-1.5 border active:scale-95 ${
              statusFilter === 'pago'
                ? 'bg-emerald-500/10 text-emerald-400 font-bold border-emerald-500/30 shadow-md shadow-emerald-500/5'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white hover:bg-slate-850 hover:border-slate-700'
            }`}
          >
            <span className={`material-symbols-outlined text-[15px] ${statusFilter === 'pago' ? 'text-emerald-400' : 'text-slate-500'}`}>
              check_circle
            </span>
            <span>Pago</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
              statusFilter === 'pago' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-950 text-slate-500'
            }`}>
              {countPago}
            </span>
          </button>
        </div>
      </div>

      {/* Active Filter Summary Card */}
      <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-lg animate-fade-in" id="active-filter-summary-banner">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
            selectedFilter === 'todos'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
              : selectedFilter === 'receita'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
                : selectedFilter === 'despesa'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/15'
                  : selectedFilter === 'abastecimento'
                    ? 'bg-sky-500/10 text-sky-400 border-sky-500/15'
                    : selectedFilter === 'casa'
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/15'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/15'
          }`}>
            <span className="material-symbols-outlined text-[20px]">
              {selectedFilter === 'todos' ? 'all_inclusive' : 
               selectedFilter === 'receita' ? 'trending_up' : 
               selectedFilter === 'despesa' ? 'trending_down' : 
               selectedFilter === 'abastecimento' ? 'local_gas_station' : 
               selectedFilter === 'casa' ? 'home' : 'shopping_bag'}
            </span>
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Totalizadores do Filtro</h4>
            <p className="text-sm font-bold text-white uppercase tracking-tight">
              {filterPills.find(p => p.value === selectedFilter)?.label || 'Todos'}
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right w-full sm:w-auto">
          <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-0.5">
            {selectedFilter === 'todos' ? 'Saldo Líquido Geral' : 
             selectedFilter === 'receita' ? 'Total de Receitas' : 
             selectedFilter === 'despesa' ? 'Total de Despesas' : 
             selectedFilter === 'abastecimento' ? 'Total de Abastecimentos' : 
             selectedFilter === 'casa' ? 'Total de Despesas Casa' : 'Total de Despesas Consumo'}
          </p>
          <div className={`text-xl font-bold font-mono tracking-tight ${
            selectedFilter === 'todos'
              ? (pillTotals.todos >= 0 ? 'text-emerald-400' : 'text-rose-400')
              : selectedFilter === 'receita'
                ? 'text-emerald-400'
                : selectedFilter === 'despesa'
                  ? 'text-rose-400'
                  : selectedFilter === 'abastecimento'
                    ? 'text-sky-400'
                    : selectedFilter === 'casa'
                      ? 'text-indigo-400'
                      : 'text-amber-400'
          }`}>
            {selectedFilter === 'todos' ? (
              <span className="flex flex-col sm:items-end">
                <span>{formatBRL(pillTotals.todos)} <span className="text-[10px] font-normal text-slate-400 font-sans uppercase">({pillTotals.todos >= 0 ? 'Saldo Positivo' : 'Saldo Devedor'})</span></span>
                <span className="text-[10px] text-slate-500 font-sans font-normal uppercase tracking-wider mt-0.5">
                  Receitas: <strong className="text-emerald-500/90 font-mono">{formatBRL(pillTotals.totalReceitas)}</strong> | Despesas: <strong className="text-rose-500/90 font-mono">{formatBRL(pillTotals.totalDespesas)}</strong>
                </span>
              </span>
            ) : (
              formatBRL(getPillTotal(selectedFilter))
            )}
          </div>
        </div>
      </div>

      {/* Smart limit indicator */}
      {shouldLimit && filteredTransactions.length > limiteLancamentos && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-2xl animate-fade-in">
          <p className="text-xs text-amber-300/90 font-mono">
            ⚠️ Mostrando apenas os <strong>{displayedTransactions.length} lançamentos</strong> mais recentes de <strong>"{filterPills.find(p => p.value === selectedFilter)?.label}"</strong>.
          </p>
          <button
            type="button"
            onClick={() => setIgnorarLimite(true)}
            className="self-start sm:self-auto px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 hover:border-amber-500/40 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
          >
            Ver Histórico Completo ({filteredTransactions.length})
          </button>
        </div>
      )}

      {/* Ledgers count */}
      <p className="text-xs text-slate-400 font-mono">
        {hasActivePeriod 
          ? `Exibindo ${displayedTransactions.length} registros no período selecionado`
          : shouldLimit
            ? `Exibindo os últimos ${displayedTransactions.length} de ${filteredTransactions.length} registros correspondentes`
            : `Exibindo ${displayedTransactions.length} registros correspondentes`}
      </p>

      {/* Main transactions scroll list with dynamic deletions */}
      <motion.div 
        key={`${selectedFilter}-${statusFilter}-${searchTerm}-${periodoInicio}-${periodoFim}-${ignorarLimite}-${displayedTransactions.length}`}
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-2.5"
      >
        {displayedTransactions.length > 0 ? (
          displayedTransactions.map((tx) => (
            <motion.div 
              key={tx.id}
              variants={itemVariants}
              className="group bg-slate-900/50 hover:bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 flex items-center justify-center bg-slate-800/80 rounded-xl text-emerald-400 border border-slate-700/50">
                  <span className="material-symbols-outlined text-lg">
                    {getCategoryIcon(tx.categoria)}
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-tight flex items-center gap-1.5">
                    <span className="text-[9px] bg-slate-800 text-slate-400 font-mono px-1.5 py-0.5 rounded border border-slate-700">#{tx.id}</span>
                    <span>{tx.descricao}</span>
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-1">
                    {tx.data} • {tx.categoria} • {tx.tipo}{tx.bancoNome ? ` • 🏦 ${tx.bancoNome.toUpperCase()}` : ''}
                  </p>
                  {tx.categoria.toUpperCase() === 'ABASTECIMENTO' && (tx.km || tx.litros || tx.veiculo || tx.descricaoVeiculo || tx.valorPg !== undefined || tx.completouTanque !== undefined || tx.nomePosto || tx.localizacaoPosto || tx.motorista) && (
                    <div className="flex flex-wrap gap-x-2 gap-y-1 text-[9px] font-semibold text-emerald-400 font-mono mt-1 uppercase">
                      {tx.veiculo && (
                        <span>
                          {tx.veiculo.toUpperCase() === 'MOTO' ? '🏍️' : '🚗'} {tx.veiculo}
                          {tx.descricaoVeiculo ? ` (${tx.descricaoVeiculo})` : ''}
                        </span>
                      )}
                      {tx.km && <span>📍 {tx.km.toLocaleString('pt-BR')} KM</span>}
                      {tx.litros && <span>⛽ {tx.litros.toLocaleString('pt-BR')} L</span>}
                      {tx.precoLitro && <span>💸 R$ {tx.precoLitro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/L</span>}
                      {tx.valorPg !== undefined && <span>💰 PG: R$ {tx.valorPg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                      {tx.completouTanque !== undefined && <span>🔋 TANQUE CHEIO: {tx.completouTanque ? 'SIM' : 'NÃO'}</span>}
                      {tx.kmPercorrido !== undefined && <span>🛣️ +{tx.kmPercorrido.toLocaleString('pt-BR')} KM</span>}
                      {tx.mediaKmL !== undefined && <span>📈 {tx.mediaKmL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM/L</span>}
                      {tx.nomePosto && <span>🏪 {tx.nomePosto}</span>}
                      {tx.localizacaoPosto && <span>🗺️ {tx.localizacaoPosto}</span>}
                      {tx.motorista && <span>👤 {tx.motorista}</span>}
                    </div>
                  )}

                  {(tx.valorPg !== undefined || tx.temJuros || tx.dataPagamento) && tx.status?.toUpperCase() === 'PAGO' && tx.categoria.toUpperCase() !== 'ABASTECIMENTO' && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-semibold text-slate-400 font-mono mt-1 uppercase bg-slate-900/40 p-1.5 rounded-lg border border-slate-800/50 w-fit">
                      {tx.dataPagamento && <span>📅 PGTO: {tx.dataPagamento}</span>}
                      {tx.valorPg !== undefined && <span>💰 PAGO: R$ {tx.valorPg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                      {tx.temJuros && tx.valorJuros !== undefined && tx.valorJuros > 0 && (
                        <span className="text-amber-400 font-bold flex items-center gap-0.5">⚠️ JUROS: R$ {tx.valorJuros.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      )}
                    </div>
                  )}

                  {tx.obs && (
                    <p className="text-[9px] text-slate-400 italic font-mono mt-1 max-w-md">
                      📝 OBS: {tx.obs}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className={`text-xs font-bold font-mono ${tx.tipo === 'RECEITA' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {tx.tipo === 'RECEITA' ? '+' : '-'} {formatBRL(tx.valor)}
                  </span>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    {getVencimentoBadge(tx)}
                    {getStatusBadge(tx.status)}
                  </div>
                </div>
                
                {/* Actions: Edit and Delete */}
                <div className="flex items-center gap-1">
                  {tx.status?.toUpperCase() !== 'PAGO' && (
                    <button
                      onClick={() => {
                        setBaixaTx(tx);
                        setBaixaValorPg((tx.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                        setBaixaTemJuros(tx.temJuros || false);
                        setBaixaValorJuros((tx.valorJuros || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                        setBaixaDataPg(new Date().toISOString().split('T')[0]);
                        setBaixaBankId(tx.bancoId || 0);
                      }}
                      className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 rounded-lg transition-all cursor-pointer border border-emerald-500/20"
                      title="Dar baixa (Marcar como Pago)"
                    >
                      <span className="material-symbols-outlined text-sm">check</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleStartEdit(tx)}
                    className="sm:opacity-0 sm:group-hover:opacity-100 opacity-100 p-1.5 hover:bg-sky-500/10 text-slate-400 hover:text-sky-400 rounded-lg transition-all cursor-pointer"
                    title="Editar"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                  <button
                    onClick={() => {
                      confirmUser(
                        "Excluir Transação",
                        "Deseja realmente remover esta transação?",
                        () => onDeleteTransaction(tx.id)
                      );
                    }}
                    className="sm:opacity-0 sm:group-hover:opacity-100 opacity-100 p-1.5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-lg transition-all cursor-pointer"
                    title="Excluir"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <motion.div 
            variants={itemVariants}
            className="bg-slate-900/20 border border-slate-800/50 rounded-2xl py-12 px-4 text-center"
          >
            <span className="material-symbols-outlined text-slate-500 text-4xl mb-2">account_balance_wallet</span>
            <p className="text-slate-400 text-sm">Nenhum registro localizado</p>
            <p className="text-xs text-slate-500 mt-1">Experimente limpar filtros ou termos de pesquisa.</p>
          </motion.div>
        )}
      </motion.div>

      <AnimatePresence>
        {baixaTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setBaixaTx(null)}
              className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl z-10 overflow-hidden font-sans"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400">payments</span>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Dar Baixa de Transação</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setBaixaTx(null)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* Transaction details card */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 mb-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase">{baixaTx.descricao}</h4>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase">
                      {baixaTx.categoria} • {baixaTx.tipo}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-300 font-mono">
                    R$ {(baixaTx.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1.5 border-t border-slate-800/60">
                  <span>VENCIMENTO: {baixaTx.data}</span>
                  <span className="bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold uppercase font-mono text-[9px]">PENDENTE</span>
                </div>
              </div>

              {/* Inputs */}
              <div className="space-y-4">
                {/* Escolha da Conta / Banco */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Banco / Conta de Origem</label>
                  <div className="relative">
                    <select
                      value={baixaBankId}
                      onChange={(e) => setBaixaBankId(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none appearance-none cursor-pointer font-sans"
                    >
                      <option value={0} className="bg-slate-950 text-slate-400">-- SELECIONE UM BANCO --</option>
                      {bankAccounts.map((acc) => {
                        const isNegative = acc.saldoInicial < 0;
                        const saldoText = isNegative
                          ? `Devedor: R$ ${Math.abs(acc.saldoInicial).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `Saldo: R$ ${acc.saldoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        const limitText = acc.limite !== undefined && acc.limite > 0
                          ? ` | Lim. Restante: R$ ${Math.max(0, acc.limite + acc.saldoInicial).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '';
                        return (
                          <option key={acc.id} value={acc.id} className="bg-slate-950 text-white">
                            {acc.nome} ({saldoText}{limitText})
                          </option>
                        );
                      })}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                      <span className="material-symbols-outlined text-lg">expand_more</span>
                    </div>
                  </div>
                </div>

                {/* Data do Pagamento */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Data de Pagamento</label>
                  <input
                    type="date"
                    value={baixaDataPg}
                    onChange={(e) => setBaixaDataPg(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none font-sans"
                  />
                </div>

                {/* Valor Pago */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Valor Pago (R$)</label>
                  <input
                    type="text"
                    value={baixaValorPg}
                    onChange={(e) => {
                      let raw = e.target.value.replace(/\D/g, "");
                      if (!raw) {
                        setBaixaValorPg('0,00');
                        setBaixaValorJuros('0,00');
                        setBaixaTemJuros(false);
                        return;
                      }
                      let numeric = parseInt(raw, 10) / 100;
                      setBaixaValorPg(numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                      
                      // Auto-calculate interest (difference) between paid value and original value
                      const originalVal = baixaTx.valor || 0;
                      if (numeric > originalVal) {
                        setBaixaTemJuros(true);
                        const diff = numeric - originalVal;
                        setBaixaValorJuros(diff.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                      } else {
                        setBaixaTemJuros(false);
                        setBaixaValorJuros('0,00');
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none font-sans font-semibold text-emerald-400 font-mono"
                  />
                </div>

                {/* Valor do Juros */}
                <div className="space-y-1.5 bg-slate-950/40 border border-slate-800 p-3 rounded-2xl">
                  <label className="block text-xs font-semibold text-slate-300">Valor dos Juros (R$)</label>
                  <input
                    type="text"
                    value={baixaValorJuros}
                    onChange={(e) => {
                      let raw = e.target.value.replace(/\D/g, "");
                      if (!raw) {
                        setBaixaValorJuros('0,00');
                        setBaixaTemJuros(false);
                        // Reset Valor Pago to original
                        const originalVal = baixaTx.valor || 0;
                        setBaixaValorPg(originalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                        return;
                      }
                      let numeric = parseInt(raw, 10) / 100;
                      setBaixaValorJuros(numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                      
                      // Auto-calculate Valor Pago when typing interest
                      const originalVal = baixaTx.valor || 0;
                      const newPg = originalVal + numeric;
                      setBaixaValorPg(newPg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                      setBaixaTemJuros(numeric > 0);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none font-sans font-semibold text-amber-400 font-mono"
                    placeholder="0,00"
                  />
                  <p className="text-[10px] text-slate-500 font-mono mt-1">
                    Calculado automaticamente com base no valor pago.
                  </p>
                </div>
              </div>

              {/* Lower Actions */}
              <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setBaixaTx(null)}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer text-center uppercase tracking-wide font-sans"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const parsedPg = parseFloat(baixaValorPg.replace(/\./g, "").replace(",", "."));
                    const parsedJuros = parseFloat(baixaValorJuros.replace(/\./g, "").replace(",", "."));
                    
                    if (isNaN(parsedPg) || parsedPg < 0) {
                      alertUser("Campo Inválido", "Por favor, insira um valor pago válido.");
                      return;
                    }

                    const parts = baixaDataPg.split('-');
                    const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : new Date().toLocaleDateString('pt-BR');

                    const hasJuros = !isNaN(parsedJuros) && parsedJuros > 0;

                    const matchedBank = bankAccounts.find(b => b.id === baixaBankId);
                    const bancoNome = matchedBank ? matchedBank.nome : undefined;

                    if (onUpdateBankAccounts && matchedBank) {
                      const updatedAccounts = bankAccounts.map(b => {
                        if (b.id === matchedBank.id) {
                          const isReceita = baixaTx.tipo === 'RECEITA';
                          const novoSaldo = isReceita
                            ? b.saldoInicial + parsedPg
                            : b.saldoInicial - parsedPg;
                          return { ...b, saldoInicial: novoSaldo };
                        }
                        return b;
                      });
                      onUpdateBankAccounts(updatedAccounts);
                    }

                    onEditTransaction(baixaTx.id, {
                      status: 'PAGO',
                      valorPg: parsedPg,
                      temJuros: hasJuros,
                      valorJuros: hasJuros ? parsedJuros : 0,
                      dataPagamento: formattedDate,
                      bancoId: baixaBankId > 0 ? baixaBankId : undefined,
                      bancoNome: bancoNome
                    });

                    setBaixaTx(null);
                    if (showAlert) {
                      showAlert('Sucesso', 'Transação baixada com sucesso!');
                    }
                  }}
                  className="py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-emerald-500/10 transition-all cursor-pointer text-center uppercase tracking-wide font-sans flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Confirmar Baixa
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
