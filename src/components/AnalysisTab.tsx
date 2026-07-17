import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { 
  FileText, 
  Printer, 
  Share2, 
  Download, 
  X, 
  Check, 
  Copy,
  TrendingUp,
  TrendingDown,
  Info,
  ChevronRight
} from 'lucide-react';

// Robust helper to parse different date formats safely (DD/MM/YYYY, YYYY-MM-DD, etc.)
const parseDateParts = (dateStr: string) => {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      return {
        day: parts[0].padStart(2, '0'),
        month: parts[1].padStart(2, '0'),
        year: parts[2]
      };
    }
  } else if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        return {
          day: parts[2].padStart(2, '0'),
          month: parts[1].padStart(2, '0'),
          year: parts[0]
        };
      } else {
        // DD-MM-YYYY
        return {
          day: parts[0].padStart(2, '0'),
          month: parts[1].padStart(2, '0'),
          year: parts[2]
        };
      }
    }
  }
  return null;
};

// Robust helper to parse Brazilian format numbers or raw floats safely
const parseToNumber = (val: any): number => {
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }
  if (!val) return 0;
  let clean = String(val).trim().replace(/\s/g, '').replace('R$', '');
  if (clean === '' || clean === '-') return 0;
  if (clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  }
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-950/95 backdrop-blur-md border border-slate-800 p-3.5 rounded-2xl shadow-2xl font-mono text-[11px] space-y-2">
        <p className="text-slate-400 font-bold border-b border-slate-850 pb-1 mb-1.5">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}:
            </span>
            <span className="text-white font-bold">
              {entry.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

interface AnalysisTabProps {
  transactions: Transaction[];
  onNavigate?: (tab: string) => void;
  showAlert?: (title: string, message: string) => void;
}

export default function AnalysisTab({
  transactions,
  onNavigate,
  showAlert
}: AnalysisTabProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');

  const categoriesList = React.useMemo(() => {
    const cats = new Set<string>();
    // Default standard categories
    cats.add('CASA');
    cats.add('CONSUMO');
    cats.add('ABASTECIMENTO');
    cats.add('PESSOAL');
    cats.add('LAZER');
    cats.add('TAXAS');
    cats.add('OUTROS');

    transactions.forEach(t => {
      if (t.tipo === 'CONTAS BANCARIAS' || t.tipo === 'CARTÃO DE CRÉDITO') return;
      if (t.categoria) {
        const catStr = String(t.categoria).trim().toUpperCase();
        if (catStr !== 'RECEITA' && catStr !== 'RECEITAS') {
          cats.add(catStr);
        }
      }
    });

    return Array.from(cats);
  }, [transactions]);

  // Extract all available months from transactions (format: "MM/YYYY")
  const availableMonths = React.useMemo(() => {
    const monthsSet = new Set<string>();

    // Always include current calendar month (mês vigente) in available months list
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    monthsSet.add(`${mm}/${yyyy}`);

    transactions.forEach(t => {
      if (t.tipo === 'CONTAS BANCARIAS' || t.tipo === 'CARTÃO DE CRÉDITO') return;
      const parsed = parseDateParts(t.data);
      if (parsed) {
        monthsSet.add(`${parsed.month}/${parsed.year}`);
      }
    });

    // Sort months chronologically: newest first
    return Array.from(monthsSet).sort((a, b) => {
      const [ma, ya] = a.split('/').map(Number);
      const [mb, yb] = b.split('/').map(Number);
      if (ya !== yb) return yb - ya;
      return mb - ma;
    });
  }, [transactions]);

  // Generate historical data for line chart (sorted oldest to newest)
  const chartData = React.useMemo(() => {
    const sortedMonths = [...availableMonths].sort((a, b) => {
      const [ma, ya] = a.split('/').map(Number);
      const [mb, yb] = b.split('/').map(Number);
      if (ya !== yb) return ya - yb;
      return ma - mb;
    });

    return sortedMonths.map(monthStr => {
      let totalReceitas = 0;
      let totalDespesas = 0;
      let totalCategoria = 0;

      transactions.forEach(t => {
        if (t.tipo === 'CONTAS BANCARIAS' || t.tipo === 'CARTÃO DE CRÉDITO') return;
        const parsed = parseDateParts(t.data);
        if (!parsed) return;
        if (`${parsed.month}/${parsed.year}` !== monthStr) return;

        const val = parseToNumber(t.valor);
        const tipo = String(t.tipo || '').trim().toUpperCase();
        const cat = String(t.categoria || '').trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        if (tipo === 'RECEITA' || tipo === 'RECEITAS' || cat === 'RECEITA' || cat === 'RECEITAS') {
          totalReceitas += val;
        } else {
          totalDespesas += val;
          const matchesCategory = selectedCategory !== 'TODAS' && 
            cat === selectedCategory.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (matchesCategory) {
            totalCategoria += val;
          }
        }
      });

      const [m, y] = monthStr.split('/');
      const monthNamesShort = [
        'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
        'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
      ];
      const idx = parseInt(m, 10) - 1;
      const label = `${monthNamesShort[idx] || m}/${y.slice(-2)}`;

      return {
        monthStr,
        name: label,
        receitas: totalReceitas,
        gastos: totalDespesas,
        saldo: totalReceitas - totalDespesas,
        gastosCategoria: totalCategoria,
      };
    });
  }, [availableMonths, transactions, selectedCategory]);

  // Default to the current calendar month (mês vigente)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${mm}/${yyyy}`;
  });

  // Investment Allocation preset profiles
  const [investmentProfile, setInvestmentProfile] = useState<'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'CUSTOM'>('CONSERVATIVE');
  const [customFixed, setCustomFixed] = useState<number>(50);
  const [customVariable, setCustomVariable] = useState<number>(30);
  const [customEmergency, setCustomEmergency] = useState<number>(20);

  // Target extra earnings simulator values
  const [averageRideValueStr, setAverageRideValueStr] = useState<string>('25,00');
  const averageRideValue = React.useMemo(() => {
    const parsed = parseFloat(averageRideValueStr.replace(/\./g, "").replace(",", "."));
    return isNaN(parsed) || parsed <= 0 ? 25 : parsed;
  }, [averageRideValueStr]);

  // PDF report export states
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  // Translate month number to Portuguese name
  const getMonthLabel = (monthStr: string) => {
    const [m, y] = monthStr.split('/');
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const idx = parseInt(m, 10) - 1;
    return `${monthNames[idx] || m} de ${y}`;
  };

  // Filter transactions of selected month
  const monthTransactions = React.useMemo(() => {
    return transactions.filter(t => {
      if (t.tipo === 'CONTAS BANCARIAS' || t.tipo === 'CARTÃO DE CRÉDITO') return false;
      const parsed = parseDateParts(t.data);
      if (!parsed) return false;
      return `${parsed.month}/${parsed.year}` === selectedMonth;
    });
  }, [transactions, selectedMonth]);

  // Filter transactions of selected month and category
  const filteredMonthTransactions = React.useMemo(() => {
    return monthTransactions.filter(t => {
      if (selectedCategory === 'TODAS') return true;
      const cat = String(t.categoria || '').trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const filterCat = selectedCategory.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return cat === filterCat;
    });
  }, [monthTransactions, selectedCategory]);

  // Compute metrics
  const metrics = React.useMemo(() => {
    let receitas = 0;
    let casa = 0;
    let consumo = 0;
    let abastecimento = 0;
    let pessoal = 0;
    let lazer = 0;
    let taxas = 0;
    let outros = 0;

    monthTransactions.forEach(t => {
      const val = parseToNumber(t.valor);
      const tipo = String(t.tipo || '').trim().toUpperCase();
      const cat = String(t.categoria || '').trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      if (tipo === 'RECEITA' || tipo === 'RECEITAS' || cat === 'RECEITA' || cat === 'RECEITAS') {
        receitas += val;
      } else {
        if (cat === 'CASA' || cat.includes('CASA')) {
          casa += val;
        } else if (cat === 'CONSUMO' || cat === 'CUMSUMO' || cat.includes('CONSUMO') || cat.includes('CUMSUMO')) {
          consumo += val;
        } else if (
          cat === 'ABASTECIMENTO' || 
          cat.includes('ABASTECIMENTO') || 
          cat.includes('COMBUSTIVEL') || 
          ['ETANOL', 'GASOLINA', 'GAS. COMUM', 'DIESEL', 'GNV', 'GAS. ADITIVADA', 'ETANOL ADITIVADA'].includes(tipo)
        ) {
          abastecimento += val;
        } else if (cat === 'PESSOAL' || cat.includes('PESSOAL')) {
          pessoal += val;
        } else if (cat === 'LAZER' || cat.includes('LAZER')) {
          lazer += val;
        } else if (cat === 'TAXAS' || cat === 'TAXA' || cat.includes('TAXA') || cat.includes('TAXAS')) {
          taxas += val;
        } else {
          outros += val;
        }
      }
    });

    const totalDespesas = casa + consumo + abastecimento + pessoal + lazer + taxas + outros;
    const diferenca = receitas - totalDespesas;

    return {
      receitas,
      casa,
      consumo,
      abastecimento,
      pessoal,
      lazer,
      taxas,
      outros,
      outrasDespesas: pessoal + lazer + taxas + outros,
      totalDespesas,
      diferenca
    };
  }, [monthTransactions]);

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Allocation ratios based on selected profile
  const allocations = React.useMemo(() => {
    let fixed = 0;
    let variable = 0;
    let emergency = 0;

    if (investmentProfile === 'CONSERVATIVE') {
      fixed = 60;
      variable = 10;
      emergency = 30;
    } else if (investmentProfile === 'BALANCED') {
      fixed = 40;
      variable = 40;
      emergency = 20;
    } else if (investmentProfile === 'AGGRESSIVE') {
      fixed = 15;
      variable = 75;
      emergency = 10;
    } else {
      // CUSTOM
      const total = customFixed + customVariable + customEmergency;
      if (total > 0) {
        fixed = Math.round((customFixed / total) * 100);
        variable = Math.round((customVariable / total) * 100);
        emergency = 100 - fixed - variable;
      } else {
        fixed = 33;
        variable = 33;
        emergency = 34;
      }
    }

    const surplus = Math.max(0, metrics.diferenca);
    return {
      fixed: { pct: fixed, val: (surplus * fixed) / 100 },
      variable: { pct: variable, val: (surplus * variable) / 100 },
      emergency: { pct: emergency, val: (surplus * emergency) / 100 }
    };
  }, [investmentProfile, customFixed, customVariable, customEmergency, metrics.diferenca]);

  // Adjust custom percentage sliders and keep total balanced
  const handleCustomSliderChange = (type: 'fixed' | 'variable' | 'emergency', val: number) => {
    if (type === 'fixed') {
      setCustomFixed(val);
    } else if (type === 'variable') {
      setCustomVariable(val);
    } else {
      setCustomEmergency(val);
    }
    setInvestmentProfile('CUSTOM');
  };

  const handleGenerateCSV = () => {
    try {
      const csvRows: string[] = [];
      
      const formatDecimalCSV = (num: number) => {
        return num.toFixed(2).replace('.', ',');
      };

      // 1. Header block
      csvRows.push(`"Resumo Financeiro Mensal - WealthFlow"`);
      csvRows.push(`"Competência";"${getMonthLabel(selectedMonth)}"`);
      csvRows.push(`"Data de Geração";"${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}"`);
      csvRows.push(""); // Empty line

      // 2. Consolidated Summary Metrics
      csvRows.push(`"SUMÁRIO EXECUTIVO"`);
      csvRows.push(`"Métrica";"Valor (R$)"`);
      csvRows.push(`"Receitas Totais";"${formatDecimalCSV(metrics.receitas)}"`);
      csvRows.push(`"Despesas Totais";"${formatDecimalCSV(metrics.totalDespesas)}"`);
      csvRows.push(`"Saldo Líquido";"${formatDecimalCSV(metrics.diferenca)}"`);
      csvRows.push(`"Status";"${metrics.diferenca >= 0 ? 'SUPERÁVIT' : 'DÉFICIT'}"`);
      csvRows.push(""); // Empty line

      // 3. Category Breakdown
      csvRows.push(`"DETALHAMENTO DE DESPESAS POR CATEGORIA"`);
      csvRows.push(`"Categoria";"Gasto Total (R$)";"% das Despesas";"Sugestão de Limite"`);
      
      const categoryRows = [
        { name: "Casa", val: metrics.casa, ideal: "Até 30% do orçamento" },
        { name: "Consumo", val: metrics.consumo, ideal: "Até 20% do orçamento" },
        { name: "Abastecimento", val: metrics.abastecimento, ideal: "Até 15% do orçamento" },
        { name: "Pessoal", val: metrics.pessoal, ideal: "Até 10% do orçamento" },
        { name: "Lazer", val: metrics.lazer, ideal: "Até 10% do orçamento" },
        { name: "Taxas", val: metrics.taxas, ideal: "Reduzir ao mínimo possível" },
        { name: "Outros", val: metrics.outros, ideal: "Manter abaixo de 5%" }
      ];

      categoryRows.forEach(row => {
        const pctExpenses = metrics.totalDespesas > 0 ? (row.val / metrics.totalDespesas) * 100 : 0;
        csvRows.push(`"${row.name}";"${formatDecimalCSV(row.val)}";"${pctExpenses.toFixed(1)}%";"${row.ideal}"`);
      });
      csvRows.push(""); // Empty line

      // 4. Detailed Transactions
      csvRows.push(`"LANÇAMENTOS DO PERÍODO"`);
      csvRows.push(`"Data";"Descrição";"Categoria";"Tipo";"Valor (R$)";"Status"`);

      const sortedTrans = [...monthTransactions].sort((a, b) => {
        return parseToNumber(b.valor) - parseToNumber(a.valor);
      });

      sortedTrans.forEach(t => {
        const val = parseToNumber(t.valor);
        const isIncome = String(t.tipo || '').trim().toUpperCase() === 'RECEITA' || 
          String(t.categoria || '').trim().toUpperCase() === 'RECEITA';
        const typeStr = isIncome ? "RECEITA" : "DESPESA";
        const valFormatted = `${isIncome ? '' : '-'}${formatDecimalCSV(val)}`;
        const descSafe = (t.descricao || 'Sem descrição').replace(/"/g, '""'); // escape double quotes
        csvRows.push(`"${t.data}";"${descSafe}";"${t.categoria || 'Geral'}";"${typeStr}";"${valFormatted}";"${t.status || 'PAGO'}"`);
      });

      // Join with CRLF for standard Windows Excel compatibility
      const csvString = csvRows.join("\r\n");
      
      // UTF-8 BOM to prevent Excel display issues with special characters (accents)
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `Resumo_Financeiro_${selectedMonth.replace('/', '_')}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      if (showAlert) {
        showAlert("Exportação Concluída", `O arquivo CSV do mês ${getMonthLabel(selectedMonth)} foi gerado e baixado com sucesso!`);
      }
    } catch (error) {
      console.error("Erro ao gerar CSV:", error);
      if (showAlert) {
        showAlert("Erro de Exportação", "Ocorreu um problema ao gerar o arquivo CSV.");
      }
    }
  };

  const handleGenerateMonthlySummaryPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const primaryColor = [16, 185, 129]; // Emerald Green
      const secondaryColor = [30, 41, 59]; // Slate Gray

      // Document Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("WealthFlow", 15, 25);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("Inteligência Financeira e Gestão de Fluxo de Caixa", 15, 31);

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text("RESUMO FINANCEIRO POR MÊS", 195, 21, { align: "right" });
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text("Relatório Consolidado de Totais", 195, 26, { align: "right" });
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 195, 31, { align: "right" });

      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.8);
      doc.line(15, 36, 195, 36);

      // Calculate totals across all available months
      let totalAllReceitas = 0;
      let totalAllDespesas = 0;
      chartData.forEach(row => {
        totalAllReceitas += row.receitas;
        totalAllDespesas += row.gastos;
      });
      const totalAllSaldo = totalAllReceitas - totalAllDespesas;

      // Consolidated summary card box
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.3);
      doc.rect(15, 42, 180, 28, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("RECEITAS ACUMULADAS", 25, 51);
      doc.setFontSize(14);
      doc.setTextColor(16, 185, 129); // emerald green
      doc.text(formatBRL(totalAllReceitas), 25, 60);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("DESPESAS ACUMULADAS", 85, 51);
      doc.setFontSize(14);
      doc.setTextColor(239, 68, 68); // rose-500
      doc.text(formatBRL(totalAllDespesas), 85, 60);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("SALDO ACUMULADO", 145, 51);
      doc.setFontSize(14);
      const diffColor = totalAllSaldo >= 0 ? [16, 185, 129] : [239, 68, 68];
      doc.setTextColor(diffColor[0], diffColor[1], diffColor[2]);
      doc.text(`${totalAllSaldo >= 0 ? '+' : ''} ${formatBRL(totalAllSaldo)}`, 145, 60);

      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      const summaryBoxText = `Histórico financeiro consolidado contendo um total de ${chartData.length} competência(s) registrada(s).`;
      doc.text(summaryBoxText, 25, 66);

      // Section Title: Tabela de Totais por Mês
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text("Histórico de Receitas e Despesas por Competência", 15, 78);

      // Sort chronological newest first
      const sortedMonthsData = [...chartData].sort((a, b) => {
        const [ma, ya] = a.monthStr.split('/').map(Number);
        const [mb, yb] = b.monthStr.split('/').map(Number);
        if (ya !== yb) return yb - ya;
        return mb - ma;
      });

      const tableBody = sortedMonthsData.map(row => {
        const status = row.saldo >= 0 ? "SUPERÁVIT" : "DÉFICIT";
        return [
          getMonthLabel(row.monthStr),
          formatBRL(row.receitas),
          formatBRL(row.gastos),
          `${row.saldo >= 0 ? '+' : ''} ${formatBRL(row.saldo)}`,
          status
        ];
      });

      autoTable(doc, {
        startY: 81,
        head: [["Mês de Referência", "Total Receitas", "Total Despesas", "Saldo Líquido", "Status"]],
        body: tableBody,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 41, 59], // slate-800
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'left'
        },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold' },
          1: { cellWidth: 35, halign: 'right', textColor: [16, 185, 129] },
          2: { cellWidth: 35, halign: 'right', textColor: [239, 68, 68] },
          3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
          4: { cellWidth: 25, halign: 'center', fontStyle: 'bold' }
        },
        didParseCell: (data) => {
          if (data.column.index === 3 && data.cell.section === 'body') {
            const rawVal = data.cell.text[0];
            if (rawVal.includes('-')) {
              data.cell.styles.textColor = [239, 68, 68];
            } else {
              data.cell.styles.textColor = [16, 185, 129];
            }
          }
          if (data.column.index === 4 && data.cell.section === 'body') {
            const statusVal = data.cell.text[0];
            if (statusVal === 'DÉFICIT') {
              data.cell.styles.textColor = [239, 68, 68];
            } else {
              data.cell.styles.textColor = [16, 185, 129];
            }
          }
        },
        styles: {
          fontSize: 9,
          cellPadding: 3
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        }
      });

      // Add footers on all pages
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // slate-400
        
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(15, 282, 195, 282);
        
        doc.text(`Documento emitido eletronicamente via WealthFlow em ${new Date().toLocaleDateString('pt-BR')}.`, 15, 287);
        doc.text(`Página ${i} de ${pageCount}`, 195, 287, { align: "right" });
      }

      // Download directly
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Relatorio_Mensal_Consolidado_${new Date().getFullYear()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      if (showAlert) {
        showAlert(
          "Exportação Concluída", 
          "O relatório consolidado com os totais de receitas e despesas por mês foi gerado e baixado com sucesso!"
        );
      }
    } catch (error) {
      console.error("Erro ao gerar PDF Consolidado:", error);
      if (showAlert) {
        showAlert("Erro de Exportação", "Ocorreu um problema ao gerar o PDF de resumo mensal.");
      }
    }
  };

  const handleGeneratePDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const primaryColor = [16, 185, 129]; // Emerald Green
      const secondaryColor = [30, 41, 59]; // Slate Gray

      // Document Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("WealthFlow", 15, 25);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("Inteligência Financeira e Gestão de Fluxo de Caixa", 15, 31);

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text("RELATÓRIO FINANCEIRO MENSAL", 195, 21, { align: "right" });
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Competência: ${getMonthLabel(selectedMonth).toUpperCase()}`, 195, 26, { align: "right" });
      doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 195, 31, { align: "right" });

      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.8);
      doc.line(15, 36, 195, 36);

      // Consolidated summary box
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.3);
      doc.rect(15, 42, 180, 28, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("RECEITAS TOTAIS", 25, 51);
      doc.setFontSize(14);
      doc.setTextColor(16, 185, 129); // emerald green
      doc.text(formatBRL(metrics.receitas), 25, 60);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("DESPESAS TOTAIS", 85, 51);
      doc.setFontSize(14);
      doc.setTextColor(239, 68, 68); // rose-500
      doc.text(formatBRL(metrics.totalDespesas), 85, 60);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("SALDO LÍQUIDO", 145, 51);
      doc.setFontSize(14);
      const diffColor = metrics.diferenca >= 0 ? [16, 185, 129] : [239, 68, 68];
      doc.setTextColor(diffColor[0], diffColor[1], diffColor[2]);
      doc.text(`${metrics.diferenca >= 0 ? '+' : ''} ${formatBRL(metrics.diferenca)}`, 145, 60);

      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      const statusText = metrics.diferenca >= 0
        ? `Resultado positivo (Superávit). Sugerido aplicar em investimentos adequados conforme perfil.`
        : `Atenção: Resultado negativo (Déficit). Recomendamos revisar o simulador de corridas de compensação.`;
      doc.text(statusText, 25, 66);

      // Section: Category breakdown
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text("Detalhamento de Despesas por Categoria", 15, 78);

      const categoryRows = [
        { name: "Casa", val: metrics.casa, desc: "Moradia, aluguel, parcelas, condomínio, contas fixas", ideal: "Até 30% do orçamento" },
        { name: "Consumo", val: metrics.consumo, desc: "Alimentação, compras, faturas de cartão, mercado", ideal: "Até 20% do orçamento" },
        { name: "Abastecimento", val: metrics.abastecimento, desc: "Combustível, etanol, gasolina e manutenção", ideal: "Até 15% do orçamento" },
        { name: "Pessoal", val: metrics.pessoal, desc: "Saúde, vestuário, educação, cuidados pessoais", ideal: "Até 10% do orçamento" },
        { name: "Lazer", val: metrics.lazer, desc: "Restaurantes, lazer, entretenimento, saídas", ideal: "Até 10% do orçamento" },
        { name: "Taxas", val: metrics.taxas, desc: "Impostos, tarifas bancárias, juros de contas", ideal: "Reduzir ao mínimo possível" },
        { name: "Outros", val: metrics.outros, desc: "Despesas gerais diversas não classificadas", ideal: "Manter abaixo de 5%" }
      ];

      const tableBody = categoryRows.map(row => {
        const pctExpenses = metrics.totalDespesas > 0 ? (row.val / metrics.totalDespesas) * 100 : 0;
        return [
          row.name,
          row.desc,
          formatBRL(row.val),
          `${pctExpenses.toFixed(1)}%`,
          row.ideal
        ];
      });

      autoTable(doc, {
        startY: 81,
        head: [["Categoria", "Descrição / Itens comuns", "Gasto Total", "% das Despesas", "Sugestão de Limite"]],
        body: tableBody,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 41, 59], // slate-800
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'left'
        },
        columnStyles: {
          0: { cellWidth: 30, fontStyle: 'bold' },
          1: { cellWidth: 65, fontSize: 8.5 },
          2: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
          3: { cellWidth: 25, halign: 'center' },
          4: { cellWidth: 32, fontSize: 8, textColor: [100, 116, 139] }
        },
        styles: {
          fontSize: 9,
          cellPadding: 2.5
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        }
      });

      // Section: Recommendations
      let finalY = (doc as any).lastAutoTable.finalY + 8;
      if (finalY > 230) {
        doc.addPage();
        finalY = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text("Planejamento & Dicas de Gestão de Caixa", 15, finalY);
      finalY += 3;

      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(metrics.diferenca >= 0 ? 16 : 239, metrics.diferenca >= 0 ? 185 : 68, metrics.diferenca >= 0 ? 129 : 68);
      doc.setLineWidth(0.5);
      doc.rect(15, finalY, 180, 25, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      if (metrics.diferenca >= 0) {
        doc.setTextColor(16, 185, 129); // green
        const profileLabel = investmentProfile === 'CONSERVATIVE' ? 'CONSERVADOR' : investmentProfile === 'BALANCED' ? 'MODERADO' : investmentProfile === 'AGGRESSIVE' ? 'ARROJADO' : 'PERSONALIZADO';
        doc.text(`ALOCAÇÃO DE SOBRAS - PERFIL DE INVESTIMENTO: ${profileLabel}`, 20, finalY + 6);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        const line1 = `Sua sobra de faturamento de ${formatBRL(metrics.diferenca)} foi distribuída conforme sua meta:`;
        const line2 = `• Reserva de Emergência (${allocations.emergency.pct}%): ${formatBRL(allocations.emergency.val)} (Alocar em Tesouro Selic ou CDB Liquidez Diária)`;
        const line3 = `• Renda Fixa (${allocations.fixed.pct}%): ${formatBRL(allocations.fixed.val)} (Alocar em LCIs, LCAs ou CDBs de médio prazo)`;
        const line4 = `• Renda Variável (${allocations.variable.pct}%): ${formatBRL(allocations.variable.val)} (Alocar em Fundos Imobiliários ou Ações)`;

        doc.text(line1, 20, finalY + 11);
        doc.text(line2, 20, finalY + 15);
        doc.text(`${line3}   |   ${line4}`, 20, finalY + 19);
      } else {
        doc.setTextColor(239, 68, 68); // red
        doc.text("ESTRATÉGIA DE COBERTURA DE DÉFICIT FINANCEIRO", 20, finalY + 6);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        const numRides = Math.ceil(Math.abs(metrics.diferenca) / averageRideValue);
        const weeklyRides = Math.ceil(numRides / 4);

        const line1 = `Seu caixa fechou negativo em ${formatBRL(Math.abs(metrics.diferenca))}. Para equilibrar as contas, sugerimos:`;
        const line2 = `• Faturamento extra estimado por corrida: R$ ${averageRideValueStr}.`;
        const line3 = `• Meta de corridas extras: Fazer ${numRides} corridas no mês, o que equivale a ${weeklyRides} por semana.`;
        const line4 = `Dica: Realizando menos de uma corrida extra por dia, você elimina o déficit e reequilibra o fluxo.`;

        doc.text(line1, 20, finalY + 11);
        doc.text(line2, 20, finalY + 15);
        doc.text(`${line3}   |   ${line4}`, 20, finalY + 19);
      }

      // Section: Transactions table
      finalY += 33;
      if (finalY > 210) {
        doc.addPage();
        finalY = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text("Detalhamento das Principais Transações do Período", 15, finalY);
      finalY += 3;

      const sortedTrans = [...monthTransactions]
        .sort((a, b) => parseToNumber(b.valor) - parseToNumber(a.valor))
        .slice(0, 15); // Top 15 largest transactions

      const transBody = sortedTrans.map(t => {
        const value = parseToNumber(t.valor);
        const isIncome = String(t.tipo || '').trim().toUpperCase() === 'RECEITA' || String(t.categoria || '').trim().toUpperCase() === 'RECEITA';
        return [
          t.data,
          t.descricao || "Sem descrição",
          t.categoria ? t.categoria.toUpperCase() : "GERAL",
          isIncome ? "RECEITA" : "DESPESA",
          `${isIncome ? '+' : '-'} ${formatBRL(value)}`,
          t.status || "PAGO"
        ];
      });

      if (transBody.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text("Nenhuma transação financeira detalhada encontrada para este mês.", 15, finalY + 4);
      } else {
        autoTable(doc, {
          startY: finalY,
          head: [["Data", "Descrição da Transação", "Categoria", "Tipo", "Valor", "Status"]],
          body: transBody,
          theme: 'grid',
          headStyles: {
            fillColor: [100, 116, 139], // slate-500
            textColor: [255, 255, 255],
            fontSize: 8.5,
            fontStyle: 'bold',
            halign: 'left'
          },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 70 },
            2: { cellWidth: 25 },
            3: { cellWidth: 20, halign: 'center' },
            4: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
            5: { cellWidth: 20, halign: 'center' }
          },
          styles: {
            fontSize: 8,
            cellPadding: 2
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          }
        });
      }

      // Add footers on all pages
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // slate-400
        
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(15, 282, 195, 282);
        
        doc.text(`Documento emitido eletronicamente via WealthFlow em ${new Date().toLocaleDateString('pt-BR')}.`, 15, 287);
        doc.text(`Página ${i} de ${pageCount}`, 195, 287, { align: "right" });
      }

      const blob = doc.output('blob');
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
      const url = URL.createObjectURL(blob);
      setPdfBlob(blob);
      setPdfBlobUrl(url);
      setIsCopied(false);
      setShowReportModal(true);

    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      if (showAlert) {
        showAlert("Erro de Exportação", "Ocorreu um problema ao gerar o PDF. Verifique os dados das transações.");
      } else {
        alert("Ocorreu um erro ao gerar o PDF.");
      }
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 pb-20"
    >
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold font-display text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-400">query_stats</span>
            PLANEJAMENTO MENSAL
          </h2>
          <p className="text-xs text-slate-400">Visão de caixa, despesas e metas de investimento</p>
        </div>
        
        {/* Export Actions */}
        <div className="flex flex-wrap gap-2 shrink-0">
          {/* CSV Export Action */}
          <button
            onClick={handleGenerateCSV}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 text-slate-200 font-bold rounded-xl text-xs uppercase tracking-wider font-mono transition-all duration-150 cursor-pointer text-center active:scale-95 flex items-center justify-center gap-2 shadow-lg"
          >
            <Download className="w-4 h-4 text-slate-400" />
            Exportar CSV
          </button>

          {/* Monthly Totals PDF Export Action */}
          <button
            onClick={handleGenerateMonthlySummaryPDF}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 text-slate-200 font-bold rounded-xl text-xs uppercase tracking-wider font-mono transition-all duration-150 cursor-pointer text-center active:scale-95 flex items-center justify-center gap-2 shadow-lg"
            title="Exportar totais de receitas e despesas de todos os meses em PDF"
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            Totais por Mês (PDF)
          </button>

          {/* PDF Export Action */}
          <button
            onClick={handleGeneratePDF}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider font-mono transition-all duration-150 cursor-pointer text-center active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 font-semibold"
          >
            <FileText className="w-4 h-4 text-slate-950" />
            Relatório PDF
          </button>
        </div>
      </div>

      {/* Filters Area (Month & Category) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Month Selector Carousel / Card */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col gap-3">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-slate-500 font-bold">calendar_month</span>
            Selecione o Mês de Análise
          </label>
          {availableMonths.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {availableMonths.map(month => {
                const active = month === selectedMonth;
                return (
                  <button
                    key={month}
                    onClick={() => setSelectedMonth(month)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all flex-shrink-0 cursor-pointer border ${
                      active
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-semibold shadow-lg shadow-emerald-500/10'
                        : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {getMonthLabel(month)}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">Nenhum dado mensal encontrado nas transações.</p>
          )}
        </div>

        {/* Category Selector / Card */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col gap-3">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-slate-500 font-bold">filter_alt</span>
            Filtrar por Categoria Específica
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            <button
              onClick={() => setSelectedCategory('TODAS')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all flex-shrink-0 cursor-pointer border ${
                selectedCategory === 'TODAS'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold shadow-lg shadow-amber-500/10'
                  : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              TODAS AS CATEGORIAS
            </button>
            {categoriesList.map(cat => {
              const active = cat === selectedCategory;
              let icon = 'category';
              if (cat === 'ABASTECIMENTO') icon = 'local_gas_station';
              else if (cat === 'CASA') icon = 'home';
              else if (cat === 'CONSUMO') icon = 'shopping_cart';
              else if (cat === 'LAZER') icon = 'sports_esports';
              else if (cat === 'PESSOAL') icon = 'person';
              else if (cat === 'TAXAS') icon = 'receipt_long';

              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all flex-shrink-0 cursor-pointer border flex items-center gap-1.5 ${
                    active
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold shadow-lg shadow-amber-500/10'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-[13px]">{icon}</span>
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dynamic Consolidated Balance Card with glow effects */}
      <div className={`relative overflow-hidden p-6 rounded-3xl border transition-all ${
        metrics.diferenca >= 0 
          ? 'bg-emerald-950/10 border-emerald-500/20 shadow-xl shadow-emerald-500/5' 
          : 'bg-rose-950/10 border-rose-500/20 shadow-xl shadow-rose-500/5'
      }`}>
        {/* Background glow circle */}
        <div className={`absolute -right-12 -top-12 w-32 h-32 rounded-full filter blur-3xl opacity-15 pointer-events-none ${
          metrics.diferenca >= 0 ? 'bg-emerald-400' : 'bg-rose-400'
        }`} />

        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Diferença Final ({getMonthLabel(selectedMonth)})
          </span>
          <span className={`material-symbols-outlined text-lg ${
            metrics.diferenca >= 0 ? 'text-emerald-400' : 'text-rose-400 animate-pulse'
          }`}>
            {metrics.diferenca >= 0 ? 'trending_up' : 'trending_down'}
          </span>
        </div>

        <h3 className={`text-2xl font-bold font-mono tracking-tight ${
          metrics.diferenca >= 0 ? 'text-emerald-400' : 'text-rose-400'
        }`}>
          {metrics.diferenca >= 0 ? '+' : ''} {formatBRL(metrics.diferenca)}
        </h3>

        <p className="text-[11px] text-slate-350 leading-relaxed mt-2 font-mono">
          {metrics.diferenca >= 0 
            ? `Parabéns! Suas receitas superaram suas despesas. Você tem um saldo positivo de ${formatBRL(metrics.diferenca)} livre para poupar ou investir!`
            : `Alerta! Suas contas fecharam negativas em ${formatBRL(Math.abs(metrics.diferenca))}. Você precisa ajustar seu orçamento ou aumentar seus ganhos.`
          }
        </p>

        {/* Breakdown bar */}
        <div className="mt-4 pt-4 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div>
            <span>Receitas: </span>
            <span className="text-emerald-400 font-bold">{formatBRL(metrics.receitas)}</span>
          </div>
          <div>
            <span>Despesas Totais: </span>
            <span className="text-rose-400 font-bold">{formatBRL(metrics.totalDespesas)}</span>
          </div>
        </div>
      </div>

      {/* Evolução de Saldos e Gastos Chart */}
      <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-3xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-400">query_stats</span>
            <h3 className="font-bold text-white font-display text-xs uppercase tracking-wider">Evolução do Saldo & Comportamento de Gastos</h3>
          </div>
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Histórico Mensal</span>
        </div>

        <div className="w-full h-[280px] bg-slate-950/40 rounded-2xl p-2.5 border border-slate-850/60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.4} vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke="#64748b" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                dy={6}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(val) => `R$ ${val}`} 
                dx={-4}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="top" 
                height={36} 
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8' }} 
              />
              {selectedCategory === 'TODAS' ? (
                <>
                  <Line 
                    name="Saldo Mensal" 
                    type="monotone" 
                    dataKey="saldo" 
                    stroke="#10b981" 
                    strokeWidth={2.5} 
                    dot={{ r: 3, stroke: '#10b981', strokeWidth: 1, fill: '#020617' }} 
                    activeDot={{ r: 6 }} 
                  />
                  <Line 
                    name="Gastos Totais" 
                    type="monotone" 
                    dataKey="gastos" 
                    stroke="#f43f5e" 
                    strokeWidth={2} 
                    dot={{ r: 3, stroke: '#f43f5e', strokeWidth: 1, fill: '#020617' }} 
                    activeDot={{ r: 6 }} 
                  />
                </>
              ) : (
                <>
                  <Line 
                    name="Gastos Totais (Geral)" 
                    type="monotone" 
                    dataKey="gastos" 
                    stroke="#f43f5e" 
                    strokeWidth={1.5} 
                    strokeDasharray="4 4"
                    dot={{ r: 2, stroke: '#f43f5e', strokeWidth: 1, fill: '#020617' }} 
                    activeDot={{ r: 4 }} 
                  />
                  <Line 
                    name={`Gastos em ${selectedCategory}`} 
                    type="monotone" 
                    dataKey="gastosCategoria" 
                    stroke="#f59e0b"
                    strokeWidth={3} 
                    dot={{ r: 4, stroke: '#f59e0b', strokeWidth: 1, fill: '#020617' }} 
                    activeDot={{ r: 8 }} 
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Seção de Lançamentos Filtrados */}
      <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-3xl space-y-4 animate-fade-in" id="filtered-transactions-list-section">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-850 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/15 shrink-0">
              <span className="material-symbols-outlined text-lg">receipt_long</span>
            </div>
            <div>
              <h3 className="font-bold text-white font-display text-xs uppercase tracking-wider">
                Lançamentos {selectedCategory === 'TODAS' ? 'Gerais' : `em ${selectedCategory}`}
              </h3>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-0.5">
                {getMonthLabel(selectedMonth)} • {filteredMonthTransactions.length} registros encontrados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">Total no Período:</span>
            <span className={`font-bold ${
              selectedCategory === 'TODAS' 
                ? (metrics.diferenca >= 0 ? 'text-emerald-400' : 'text-rose-400')
                : 'text-amber-400'
            }`}>
              {formatBRL(
                selectedCategory === 'TODAS' 
                  ? filteredMonthTransactions.reduce((acc, t) => {
                      const val = parseToNumber(t.valor);
                      const cat = String(t.categoria || '').trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                      const tipo = String(t.tipo || '').trim().toUpperCase();
                      if (tipo === 'RECEITA' || tipo === 'RECEITAS' || cat === 'RECEITA' || cat === 'RECEITAS') {
                        return acc + val;
                      }
                      return acc - val;
                    }, 0)
                  : filteredMonthTransactions.reduce((acc, t) => acc + parseToNumber(t.valor), 0)
              )}
            </span>
          </div>
        </div>

        {filteredMonthTransactions.length === 0 ? (
          <div className="bg-slate-950/40 border border-slate-850/60 p-8 rounded-2xl text-center space-y-2">
            <span className="material-symbols-outlined text-3xl text-slate-600">receipt_long</span>
            <p className="text-xs text-slate-450 italic font-mono">
              Nenhuma transação encontrada na categoria {selectedCategory} para o mês de {getMonthLabel(selectedMonth)}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-850">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-850">
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60 bg-slate-900/20">
                {filteredMonthTransactions.map((t) => {
                  const val = parseToNumber(t.valor);
                  const isIncome = String(t.tipo || '').trim().toUpperCase() === 'RECEITA' || 
                    String(t.categoria || '').trim().toUpperCase() === 'RECEITA';
                  
                  let catIcon = 'category';
                  const catUpper = String(t.categoria || '').trim().toUpperCase();
                  if (catUpper === 'ABASTECIMENTO') catIcon = 'local_gas_station';
                  else if (catUpper === 'CASA') catIcon = 'home';
                  else if (catUpper === 'CONSUMO') catIcon = 'shopping_cart';
                  else if (catUpper === 'LAZER') catIcon = 'sports_esports';
                  else if (catUpper === 'PESSOAL') catIcon = 'person';
                  else if (catUpper === 'TAXAS') catIcon = 'receipt_long';

                  return (
                    <tr key={`tx-row-${t.id}`} className="hover:bg-slate-850/30 transition-all duration-150">
                      <td className="py-3.5 px-4 text-slate-300">{t.data}</td>
                      <td className="py-3.5 px-4 font-sans font-medium text-white max-w-[200px] truncate">{t.descricao || 'Sem descrição'}</td>
                      <td className="py-3.5 px-4">
                        <span className="flex items-center gap-1 text-slate-300 text-[11px]">
                          <span className="material-symbols-outlined text-[12px] text-slate-500">{catIcon}</span>
                          {t.categoria || 'Geral'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isIncome 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' 
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/15'
                        }`}>
                          {isIncome ? 'RECEITA' : 'DESPESA'}
                        </span>
                      </td>
                      <td className={`py-3.5 px-4 text-right font-bold ${
                        isIncome ? 'text-emerald-400' : 'text-slate-200'
                      }`}>
                        {isIncome ? '+' : '-'} {formatBRL(val)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          String(t.status).trim().toUpperCase() === 'PAGO'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                        }`}>
                          {t.status || 'PAGO'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Interactive Earn or Invest Advisor Widget */}
      <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl space-y-4">
        {metrics.diferenca >= 0 ? (
          <>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="material-symbols-outlined text-lg">savings</span>
              <h3 className="font-bold text-white font-display text-xs uppercase tracking-wider">Como Investir Sua Sobra</h3>
            </div>
            
            <p className="text-xs text-slate-400 leading-normal font-mono">
              Defina um perfil de investimento para alocar os <span className="text-emerald-400 font-bold">{formatBRL(metrics.diferenca)}</span> que sobraram:
            </p>

            {/* Profile Selection Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
              {(['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'] as const).map((profile) => {
                const labels = { CONSERVATIVE: 'Conservador', BALANCED: 'Moderado', AGGRESSIVE: 'Arrojado' };
                return (
                  <button
                    key={profile}
                    onClick={() => setInvestmentProfile(profile)}
                    className={`py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      investmentProfile === profile
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {labels[profile]}
                  </button>
                );
              })}
            </div>

            {/* Allocation Results Breakdown */}
            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800/60">
              {/* Emergency Reserve */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Reserva de Emergência
                  </span>
                  <span className="text-white font-bold">
                    {allocations.emergency.pct}% ({formatBRL(allocations.emergency.val)})
                  </span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${allocations.emergency.pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="bg-amber-400 h-full rounded-full" 
                  />
                </div>
                <p className="text-[9px] text-slate-500 italic font-mono pl-2.5">
                  Poupança, Tesouro Selic ou CDB de Liquidez Diária.
                </p>
              </div>

              {/* Fixed Income */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    Renda Fixa / Tesouro
                  </span>
                  <span className="text-white font-bold">
                    {allocations.fixed.pct}% ({formatBRL(allocations.fixed.val)})
                  </span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${allocations.fixed.pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                    className="bg-sky-400 h-full rounded-full" 
                  />
                </div>
                <p className="text-[9px] text-slate-500 italic font-mono pl-2.5">
                  LCI, LCA, CDBs de médio prazo, títulos indexados ao IPCA.
                </p>
              </div>

              {/* Variable Income */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    Renda Variável / Ações
                  </span>
                  <span className="text-white font-bold">
                    {allocations.variable.pct}% ({formatBRL(allocations.variable.val)})
                  </span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${allocations.variable.pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                    className="bg-purple-400 h-full rounded-full" 
                  />
                </div>
                <p className="text-[9px] text-slate-500 italic font-mono pl-2.5">
                  Fundos Imobiliários (FIIs), ações, ETFs ou investimentos internacionais.
                </p>
              </div>
            </div>

            {/* Custom Sliders Toggle */}
            <div className="pt-2">
              <button
                onClick={() => {
                  if (investmentProfile !== 'CUSTOM') {
                    setInvestmentProfile('CUSTOM');
                  } else {
                    setInvestmentProfile('CONSERVATIVE');
                  }
                }}
                className="text-[10px] text-slate-400 hover:text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">
                  {investmentProfile === 'CUSTOM' ? 'tune' : 'settings'}
                </span>
                {investmentProfile === 'CUSTOM' ? 'Voltar para Presets' : 'Personalizar Distribuição'}
              </button>

              {investmentProfile === 'CUSTOM' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3 mt-3 pt-3 border-t border-slate-800/60 overflow-hidden"
                >
                  {/* Custom Emergency */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold font-mono text-slate-300">
                      <span>Reserva de Emergência</span>
                      <span>{customEmergency}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={customEmergency} 
                      onChange={(e) => handleCustomSliderChange('emergency', Number(e.target.value))}
                      className="w-full accent-emerald-500 bg-slate-950 rounded-lg appearance-none h-1 cursor-pointer"
                    />
                  </div>

                  {/* Custom Fixed */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold font-mono text-slate-300">
                      <span>Renda Fixa</span>
                      <span>{customFixed}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={customFixed} 
                      onChange={(e) => handleCustomSliderChange('fixed', Number(e.target.value))}
                      className="w-full accent-emerald-500 bg-slate-950 rounded-lg appearance-none h-1 cursor-pointer"
                    />
                  </div>

                  {/* Custom Variable */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold font-mono text-slate-300">
                      <span>Renda Variável</span>
                      <span>{customVariable}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={customVariable} 
                      onChange={(e) => handleCustomSliderChange('variable', Number(e.target.value))}
                      className="w-full accent-emerald-500 bg-slate-950 rounded-lg appearance-none h-1 cursor-pointer"
                    />
                  </div>
                </motion.div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-rose-400">
              <span className="material-symbols-outlined text-lg">trending_up</span>
              <h3 className="font-bold text-white font-display text-xs uppercase tracking-wider">Como Cobrir o Déficit Mensal</h3>
            </div>
            
            <p className="text-xs text-slate-400 leading-normal font-mono">
              Suas contas estão negativas em <span className="text-rose-400 font-bold">{formatBRL(Math.abs(metrics.diferenca))}</span>.
              Vamos calcular quanto você precisa fazer em faturamento extra para equilibrar as contas:
            </p>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/60 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase font-mono">Valor Médio por Corrida (R$)</label>
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1">
                    <span className="text-xs font-bold text-slate-500 font-mono">R$</span>
                    <input
                      type="text"
                      value={averageRideValueStr}
                      onChange={(e) => {
                        let raw = e.target.value.replace(/\D/g, "");
                        if (!raw) {
                          setAverageRideValueStr('0,00');
                          return;
                        }
                        let numeric = parseInt(raw, 10) / 100;
                        setAverageRideValueStr(numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                      }}
                      className="bg-transparent text-xs font-mono text-white font-bold focus:outline-none w-full"
                    />
                  </div>
                </div>

                <div className="space-y-1 flex flex-col justify-end text-right">
                  <span className="text-[9px] font-bold text-slate-400 uppercase font-mono">Corridas Necessárias</span>
                  <span className="text-base font-bold text-emerald-400 font-mono">
                    {Math.ceil(Math.abs(metrics.diferenca) / averageRideValue)} corridas
                  </span>
                </div>
              </div>

              {/* Progress target bar */}
              <div className="space-y-1 pt-2 border-t border-slate-900/60">
                <div className="flex justify-between text-[10px] font-mono text-slate-450">
                  <span>Meta de Equilíbrio</span>
                  <span>{formatBRL(metrics.totalDespesas)}</span>
                </div>
                <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden flex">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (metrics.receitas / metrics.totalDespesas) * 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="bg-emerald-500 h-full" 
                  />
                </div>
                <div className="flex justify-between text-[9px] font-mono mt-1 text-slate-400">
                  <span>Conquistado: {formatBRL(metrics.receitas)} ({Math.round(Math.min(100, (metrics.receitas / metrics.totalDespesas) * 100))}% )</span>
                  <span>Falta: {formatBRL(Math.abs(metrics.diferenca))}</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 bg-slate-950/60 border border-slate-850/60 p-3 rounded-xl text-[11px] font-mono text-slate-400 leading-normal">
              <span className="material-symbols-outlined text-rose-400 text-sm">tips_and_updates</span>
              <div>
                <span className="font-bold text-white">Dica de Gestão:</span> Se você fizer cerca de <span className="text-emerald-400 font-bold">{Math.ceil(Math.ceil(Math.abs(metrics.diferenca) / averageRideValue) / 4)} corridas extras por semana</span> (menos de 1 por dia), você fechará o mês no azul!
              </div>
            </div>
          </>
        )}
      </div>

      {/* Structured Category Breakdown Details */}
      <div className="space-y-3.5">
        <h3 className="text-xs font-bold font-display text-white uppercase tracking-wider">Detalhamento de Contas por Categoria</h3>

        {/* 1. Receitas Card */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">trending_up</span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Total de Receitas</h4>
              <p className="text-[10px] text-slate-500 font-mono">Entradas de caixa, pix, uber</p>
            </div>
          </div>
          <span className="text-sm font-bold font-mono text-emerald-400">
            {formatBRL(metrics.receitas)}
          </span>
        </motion.div>

        {/* 2. Casa Card */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.09 }}
          className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">home</span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Total de Casa</h4>
              <p className="text-[10px] text-slate-500 font-mono">Aluguel, parcelas, condomínio</p>
            </div>
          </div>
          <span className="text-sm font-bold font-mono text-slate-300">
            {formatBRL(metrics.casa)}
          </span>
        </motion.div>

        {/* 3. Consumo Card */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.13 }}
          className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">shopping_bag</span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Total de Consumo</h4>
              <p className="text-[10px] text-slate-500 font-mono">Faturas, compras, supermercado</p>
            </div>
          </div>
          <span className="text-sm font-bold font-mono text-slate-300">
            {formatBRL(metrics.consumo)}
          </span>
        </motion.div>

        {/* 4. Abastecimento Card */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.17 }}
          className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">local_gas_station</span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Total de Abastecimento</h4>
              <p className="text-[10px] text-slate-500 font-mono">Combustível, etanol, gasolina</p>
            </div>
          </div>
          <span className="text-sm font-bold font-mono text-slate-300">
            {formatBRL(metrics.abastecimento)}
          </span>
        </motion.div>

        {/* 5. Pessoal Card */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.21 }}
          className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">person</span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Total Pessoal</h4>
              <p className="text-[10px] text-slate-500 font-mono">Gastos pessoais, saúde, vestuário</p>
            </div>
          </div>
          <span className="text-sm font-bold font-mono text-slate-300">
            {formatBRL(metrics.pessoal)}
          </span>
        </motion.div>

        {/* 6. Lazer Card */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
          className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">sports_esports</span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Total Lazer</h4>
              <p className="text-[10px] text-slate-500 font-mono">Restaurantes, saídas, entretenimento</p>
            </div>
          </div>
          <span className="text-sm font-bold font-mono text-slate-300">
            {formatBRL(metrics.lazer)}
          </span>
        </motion.div>

        {/* 7. Taxas Card */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.29 }}
          className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">percent</span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Total Taxas</h4>
              <p className="text-[10px] text-slate-500 font-mono">Impostos, tarifas bancárias, juros</p>
            </div>
          </div>
          <span className="text-sm font-bold font-mono text-slate-300">
            {formatBRL(metrics.taxas)}
          </span>
        </motion.div>

        {/* 8. Outros Card */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.33 }}
          className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">receipt</span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Total Outros</h4>
              <p className="text-[10px] text-slate-500 font-mono">Demais despesas gerais</p>
            </div>
          </div>
          <span className="text-sm font-bold font-mono text-slate-300">
            {formatBRL(metrics.outros)}
          </span>
        </motion.div>

        {/* 6. Total Despesas Somadas Card */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.37 }}
          className="bg-slate-950 border border-slate-800/80 p-4 rounded-2xl flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">payments</span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Soma das Despesas</h4>
              <p className="text-[10px] text-slate-550 font-mono">Todos os gastos mensais somados</p>
            </div>
          </div>
          <span className="text-sm font-bold font-mono text-rose-400">
            {formatBRL(metrics.totalDespesas)}
          </span>
        </motion.div>
      </div>
    </motion.div>

    {/* PDF Report Interactive Modal */}
    <AnimatePresence>
      {showReportModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
          id="pdf-report-modal"
          onClick={() => setShowReportModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, y: 15, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 15, opacity: 0 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowReportModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="p-6 border-b border-slate-850/80 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center animate-pulse">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Relatório Exportado</h3>
                <p className="text-xs text-slate-450 font-mono">Competência: {getMonthLabel(selectedMonth)}</p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
              <div className="text-center space-y-2">
                <p className="text-xs text-slate-300 font-mono leading-relaxed">
                  Seu resumo financeiro resumido foi gerado com sucesso. Selecione uma opção para imprimir, compartilhar ou fazer o download do documento PDF completo.
                </p>
              </div>

              {/* Metrics Summary Grid */}
              <div className="grid grid-cols-3 gap-2.5 bg-slate-950 p-4 rounded-2xl border border-slate-850">
                <div className="text-center space-y-1">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Receitas</span>
                  <p className="text-xs font-bold text-emerald-400 font-mono">{formatBRL(metrics.receitas)}</p>
                </div>
                <div className="text-center space-y-1 border-x border-slate-850">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Despesas</span>
                  <p className="text-xs font-bold text-rose-450 font-mono">{formatBRL(metrics.totalDespesas)}</p>
                </div>
                <div className="text-center space-y-1">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Saldo Líquido</span>
                  <p className={`text-xs font-bold font-mono ${metrics.diferenca >= 0 ? 'text-emerald-400' : 'text-rose-405'}`}>
                    {metrics.diferenca >= 0 ? '+' : ''}{formatBRL(metrics.diferenca)}
                  </p>
                </div>
              </div>

              {/* PDF Content Features */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Estrutura do Documento PDF:</h4>
                <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-start gap-2.5 text-xs text-slate-300 font-mono">
                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>Cabeçalho analítico com controle de competência e data/hora de emissão.</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-slate-300 font-mono">
                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>Sumário executivo das movimentações globais e resultado financeiro.</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-slate-300 font-mono">
                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>Tabela com detalhamento de faturas por categoria e limites recomendados.</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-slate-300 font-mono">
                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>
                      {metrics.diferenca >= 0 
                        ? `Plano de alocação de investimentos (${investmentProfile === 'CUSTOM' ? 'Personalizado' : 'Perfil ' + (investmentProfile === 'CONSERVATIVE' ? 'Conservador' : investmentProfile === 'BALANCED' ? 'Moderado' : 'Arrojado')}).`
                        : "Estratégia de cobertura de déficit com cálculo estimado de corridas extras."
                      }
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-slate-300 font-mono">
                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>Extrato detalhado contendo até 15 dos maiores lançamentos do mês.</span>
                  </div>
                </div>
              </div>

              {/* PDF Preview Optional IFrame */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Pré-visualização do PDF:</span>
                  {pdfBlobUrl && (
                    <a
                      href={pdfBlobUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-mono text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      Abrir em nova aba <ChevronRight className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950 h-36 flex items-center justify-center relative">
                  {pdfBlobUrl ? (
                    <iframe src={`${pdfBlobUrl}#toolbar=0`} className="w-full h-full border-none opacity-80" title="PDF Live Preview" />
                  ) : (
                    <span className="text-xs text-slate-500 font-mono">A carregar o documento...</span>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-6 border-t border-slate-850/80 bg-slate-950/40 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => {
                  if (pdfBlobUrl) {
                    const printIframe = document.createElement('iframe');
                    printIframe.style.display = 'none';
                    printIframe.src = pdfBlobUrl;
                    document.body.appendChild(printIframe);
                    printIframe.contentWindow?.focus();
                    printIframe.contentWindow?.print();
                    setTimeout(() => {
                      document.body.removeChild(printIframe);
                    }, 1500);
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white font-bold rounded-xl text-xs uppercase tracking-wider font-mono transition-all flex items-center justify-center gap-2 border border-slate-800 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-400" />
                Imprimir
              </button>

              <button
                onClick={() => {
                  if (pdfBlob && navigator.share && navigator.canShare && navigator.canShare({ files: [new File([pdfBlob], 'relatorio.pdf', { type: 'application/pdf' })] })) {
                    const file = new File([pdfBlob], `Relatorio_Financeiro_${selectedMonth.replace('/', '_')}.pdf`, { type: 'application/pdf' });
                    navigator.share({
                      files: [file],
                      title: 'Relatório Financeiro WealthFlow',
                      text: `Confira meu resumo financeiro de ${getMonthLabel(selectedMonth)} gerado via WealthFlow.`
                    }).catch(err => console.log('Error sharing:', err));
                  } else {
                    const summaryText = `*Resumo Financeiro Mensal - WealthFlow*\n📅 Competência: ${getMonthLabel(selectedMonth)}\n\n🟢 Receitas Totais: ${formatBRL(metrics.receitas)}\n🔴 Despesas Totais: ${formatBRL(metrics.totalDespesas)}\n📊 Saldo Líquido: ${metrics.diferenca >= 0 ? '+' : ''}${formatBRL(metrics.diferenca)}\n\nStatus: ${metrics.diferenca >= 0 ? 'Superavitário (Investimentos)' : 'Deficitário (Revisar contas)'}\n\nGerado via WealthFlow.`;
                    navigator.clipboard.writeText(summaryText);
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 3000);
                  }
                }}
                className={`flex-1 px-4 py-2.5 font-bold rounded-xl text-xs uppercase tracking-wider font-mono transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                  isCopied 
                    ? 'bg-emerald-950/20 text-emerald-400 border-emerald-500/30' 
                    : 'bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white border-slate-800'
                }`}
              >
                {isCopied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 text-slate-400" />
                    Compartilhar
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  if (pdfBlobUrl) {
                    const link = document.createElement('a');
                    link.href = pdfBlobUrl;
                    link.download = `Relatorio_Financeiro_${selectedMonth.replace('/', '_')}.pdf`;
                    link.click();
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider font-mono transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
              >
                <Download className="w-4 h-4 text-slate-950" />
                Baixar PDF
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  </>
);
}
