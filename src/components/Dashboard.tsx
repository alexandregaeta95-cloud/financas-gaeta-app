import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, ArrowUpRight, ArrowDownRight, Wallet, BellRing, Check, Bell, X, AlertTriangle } from 'lucide-react';
import { 
  BarChart as RechartsBarChart, 
  Bar as RechartsBar, 
  XAxis as RechartsXAxis, 
  YAxis as RechartsYAxis, 
  CartesianGrid as RechartsCartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend as RechartsLegend, 
  ResponsiveContainer as RechartsResponsiveContainer 
} from 'recharts';
import { Transaction, BankAccount, CreditCard, MedicalAppointment, MedicalPrescription, Compromisso, RiskZone, RegisteredVehicle, CarServiceScheduled, SavingsGoal } from '../types';
import { checkIpvaAlerts, getPlacaFinalDigit, getIpvaDueMonth, getNextIpvaDueDate, getVehicleIpvaMonth, getVehicleNextIpvaDueDate } from '../lib/ipvaUtils';

// Helper to parse dates in DD/MM/YYYY or YYYY-MM-DD
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
  }
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
  }
  return null;
}

const CustomTooltip = ({ active, payload, label, hideValuesMode }: any) => {
  if (active && payload && payload.length) {
    const revenue = payload[0]?.value || 0;
    const expense = payload[1]?.value || 0;
    const balance = revenue - expense;
    return (
      <div className="bg-slate-950/95 border border-slate-800 p-3 rounded-xl shadow-2xl text-left font-sans">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-6">
            <span className="text-emerald-400 font-semibold">Receitas:</span>
            <span className={`font-mono font-bold text-white ${hideValuesMode ? 'blur-[5px] select-none hover:blur-none transition-all duration-200' : ''}`}>
              R$ {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-rose-400 font-semibold">Despesas:</span>
            <span className={`font-mono font-bold text-white ${hideValuesMode ? 'blur-[5px] select-none hover:blur-none transition-all duration-200' : ''}`}>
              R$ {expense.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="border-t border-slate-900 pt-1.5 mt-1 flex justify-between gap-6">
            <span className="text-slate-300 font-semibold">Saldo:</span>
            <span className={`font-mono font-bold ${hideValuesMode ? 'blur-[5px] select-none hover:blur-none text-slate-400' : (balance >= 0 ? 'text-emerald-400' : 'text-rose-400')}`}>
              {balance >= 0 && !hideValuesMode ? '+' : ''}R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

interface DashboardProps {
  transactions: Transaction[];
  bankAccounts: BankAccount[];
  creditCards: CreditCard[];
  onNavigate: (tab: string) => void;
  appointments?: MedicalAppointment[];
  prescriptions?: MedicalPrescription[];
  compromissos?: Compromisso[];
  scheduledServices?: CarServiceScheduled[];
  onEditTransaction?: (id: number, tx: Partial<Transaction>) => void;
  onAddTransaction?: (newTx: Omit<Transaction, 'id'> | Omit<Transaction, 'id'>[]) => Promise<void>;
  onTriggerNotification?: (notif: {
    banco: string;
    tipo: 'RECEITA' | 'DESPESA' | 'PAGO' | 'ETANOL' | 'GAS. COMUM' | string;
    valor: number;
    descricao: string;
    categoria: string;
    accountId: number;
    isCreditCard: boolean;
    cardId?: number;
  }) => void;
  onTriggerBankIntegration?: (bancoId: number, valor: number, descricao: string) => void;
  showConfirm?: (title: string, message: string, onConfirm: () => void) => void;
  showAlert?: (title: string, message: string) => void;
  riskZones?: RiskZone[];
  registeredVehicles?: RegisteredVehicle[];
  setRegisteredVehicles?: React.Dispatch<React.SetStateAction<RegisteredVehicle[]>>;
  categoryBudgets?: { [category: string]: number };
  setCategoryBudgets?: React.Dispatch<React.SetStateAction<{ [category: string]: number }>>;
  customCategories?: string[];
  ipvaLeadDays?: number;
  setIpvaLeadDays?: React.Dispatch<React.SetStateAction<number>>;
  dailyCheckInTime?: string;
  setDailyCheckInTime?: (time: string) => void;
  ipvaClosingDay?: number;
  medicalAppointmentLeadDays?: number;
  ipvaNotificationColor?: string;
  notifyIpva?: boolean;
  defaultVehicleId?: string;
}

export default function Dashboard({ 
  transactions, 
  bankAccounts, 
  creditCards, 
  onNavigate, 
  appointments = [],
  prescriptions = [] ,
  compromissos = [],
  scheduledServices = [],
  onEditTransaction,
  onAddTransaction,
  onTriggerNotification,
  onTriggerBankIntegration,
  showConfirm,
  showAlert,
  riskZones = [],
  registeredVehicles = [],
  setRegisteredVehicles,
  categoryBudgets = {},
  setCategoryBudgets,
  customCategories = [],
  ipvaLeadDays = 30,
  setIpvaLeadDays,
  dailyCheckInTime = '',
  setDailyCheckInTime,
  ipvaClosingDay = 15,
  medicalAppointmentLeadDays = 2,
  ipvaNotificationColor = 'orange',
  notifyIpva = true,
  defaultVehicleId = ''
}: DashboardProps) {
  const [showBalance, setShowBalance] = useState<boolean>(true);
  const [hideValuesMode, setHideValuesMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_hide_values_mode');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('wealthflow_hide_values_mode', String(hideValuesMode));
    } catch (e) {
      console.error(e);
    }
  }, [hideValuesMode]);

  // Quick Actions Form States
  const [quickTipo, setQuickTipo] = useState<'RECEITA' | 'DESPESA'>('DESPESA');
  const [quickDescricao, setQuickDescricao] = useState<string>('');
  const [quickValor, setQuickValor] = useState<string>('');
  const [quickCategoria, setQuickCategoria] = useState<string>('CONSUMO');
  const [quickAccountKey, setQuickAccountKey] = useState<string>('');
  const [quickIsPaid, setQuickIsPaid] = useState<boolean>(true);
  const [quickIsSubmitting, setQuickIsSubmitting] = useState<boolean>(false);

  const currentYear = new Date().getFullYear();
  const [dashboardTab, setDashboardTab] = useState<'geral' | 'orcamento'>('geral');
  const [isEditingBudgets, setIsEditingBudgets] = useState<boolean>(false);
  const [tempBudgets, setTempBudgets] = useState<{ [category: string]: number }>({});

  // Geolocation and Risk Proximity Alert states
  const [gpsPosition, setGpsPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isGpsTracking, setIsGpsTracking] = useState<boolean>(false);
  const [activeRiskAlertZone, setActiveRiskAlertZone] = useState<RiskZone | null>(null);
  const [dismissedAlertZoneIds, setDismissedAlertZoneIds] = useState<number[]>([]);
  const [isGpsSimulated, setIsGpsSimulated] = useState<boolean>(false);
  const [simulationSelectedZoneId, setSimulationSelectedZoneId] = useState<number | string>('');

  // Distance helper in meters (Haversine formula)
  const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Watch/Scan for Risk Proximity when position updates
  React.useEffect(() => {
    if (!gpsPosition) {
      setActiveRiskAlertZone(null);
      return;
    }

    // Filter active risk zones
    const activeZones = riskZones.filter(z => z.ativo);
    let triggeredZone: RiskZone | null = null;
    const currentlyInZoneIds: number[] = [];

    for (const zone of activeZones) {
      const distance = getDistanceInMeters(
        gpsPosition.latitude,
        gpsPosition.longitude,
        zone.latitude,
        zone.longitude
      );

      const radius = zone.raioMetros || 300;
      if (distance <= radius) {
        currentlyInZoneIds.push(zone.id);
        if (!dismissedAlertZoneIds.includes(zone.id)) {
          triggeredZone = zone;
        }
      }
    }

    if (triggeredZone) {
      setActiveRiskAlertZone(triggeredZone);
    } else {
      setActiveRiskAlertZone(null);
    }

    // Reset dismissed state for zones the user is NO LONGER inside of
    setDismissedAlertZoneIds(prev => {
      const filtered = prev.filter(id => currentlyInZoneIds.includes(id));
      if (filtered.length === prev.length && filtered.every((val, i) => val === prev[i])) {
        return prev; // Return same reference if no changes, breaking the infinite loop
      }
      return filtered;
    });
  }, [gpsPosition, riskZones, dismissedAlertZoneIds]);

  // Handle GPS watcher
  React.useEffect(() => {
    if (!isGpsTracking || isGpsSimulated) return;

    if (!("geolocation" in navigator)) {
      setGpsError("Geolocalização não é suportada por este dispositivo.");
      setIsGpsTracking(false);
      return;
    }

    setGpsError(null);
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setGpsPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        console.error("GPS Watch error:", error);
        let msg = "Erro ao acessar localização.";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "Permissão de geolocalização negada pelo dispositivo.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = "Informações de localização indisponíveis.";
        } else if (error.code === error.TIMEOUT) {
          msg = "Tempo limite excedido para obter localização.";
        }
        setGpsError(msg);
        setIsGpsTracking(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isGpsTracking, isGpsSimulated]);

  const handleSimulateGPS = (zoneId: number) => {
    const zone = riskZones.find(z => z.id === zoneId);
    if (!zone) return;

    setIsGpsSimulated(true);
    setIsGpsTracking(true);
    setGpsError(null);
    setGpsPosition({
      latitude: zone.latitude,
      longitude: zone.longitude
    });

    if (showAlert) {
      showAlert(
        "📍 GPS Simulado com Sucesso",
        `Sua localização simulada foi definida para o perímetro de "${zone.nomeLocal}": ${zone.latitude.toFixed(5)}, ${zone.longitude.toFixed(5)}.`
      );
    }
  };

  const handleStopGPSTracking = () => {
    setIsGpsTracking(false);
    setIsGpsSimulated(false);
    setGpsPosition(null);
    setGpsError(null);
    setActiveRiskAlertZone(null);
    setDismissedAlertZoneIds([]);
  };

  // Local state for dismissed push reminders
  const [dismissedReminders, setDismissedReminders] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_dismissed_reminders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const dismissReminder = (id: number) => {
    const updated = [...dismissedReminders, id];
    setDismissedReminders(updated);
    try {
      localStorage.setItem('wealthflow_dismissed_reminders', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // Simulation states
  const [selectedSimAccount, setSelectedSimAccount] = useState<BankAccount | null>(null);
  const [selectedSimCard, setSelectedSimCard] = useState<CreditCard | null>(null);
  
  // Simulation form fields
  const [simType, setSimType] = useState<string>('DESPESA'); // 'DESPESA' or 'RECEITA'
  const [simValue, setSimValue] = useState<string>('');
  const [simDesc, setSimDesc] = useState<string>('');
  const [simCategory, setSimCategory] = useState<string>('CONSUMO');

  // Real integration helper states
  const [copied, setCopied] = useState<boolean>(false);
  const [showRealIntegrationGuide, setShowRealIntegrationGuide] = useState<boolean>(false);

  // Savings Goals states
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>(() => {
    try {
      const stored = localStorage.getItem('wealthflow_savings_goals');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Error loading savings goals', e);
      return [];
    }
  });

  const saveSavingsGoals = (goals: SavingsGoal[]) => {
    setSavingsGoals(goals);
    try {
      localStorage.setItem('wealthflow_savings_goals', JSON.stringify(goals));
    } catch (e) {
      console.error('Error saving savings goals', e);
    }
  };

  const [isOpenGoalModal, setIsOpenGoalModal] = useState<boolean>(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);

  // Form states for savings goal
  const [goalName, setGoalName] = useState<string>('');
  const [goalTarget, setGoalTarget] = useState<string>('');
  const [goalCurrent, setGoalCurrent] = useState<string>('');
  const [goalDeadline, setGoalDeadline] = useState<string>('');
  const [goalCategory, setGoalCategory] = useState<string>('Segurança');
  const [goalDesc, setGoalDesc] = useState<string>('');

  // Quick Deposit/Withdraw states
  const [isOpenTransferModal, setIsOpenTransferModal] = useState<boolean>(false);
  const [transferType, setTransferType] = useState<'DEPOSIT' | 'WITHDRAW' | null>(null);
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferGoalId, setTransferGoalId] = useState<string | null>(null);

  // Custom IPVA alerts form state
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [customIpvaPlaca, setCustomIpvaPlaca] = useState<string>('');
  const [customIpvaData, setCustomIpvaData] = useState<string>('');

  const handleSaveGoal = () => {
    if (!goalName.trim()) {
      if (showAlert) showAlert("Campo Obrigatório", "Por favor, insira o nome do objetivo.");
      return;
    }

    const parsedTarget = parseFloat(goalTarget);
    if (isNaN(parsedTarget) || parsedTarget <= 0) {
      if (showAlert) showAlert("Valor Alvo Inválido", "O valor alvo precisa ser maior que zero.");
      return;
    }

    const parsedCurrent = parseFloat(goalCurrent) || 0;
    if (isNaN(parsedCurrent) || parsedCurrent < 0) {
      if (showAlert) showAlert("Valor Atual Inválido", "O valor atual não pode ser negativo.");
      return;
    }

    if (editingGoal) {
      // Edit mode
      const updated = savingsGoals.map(g => g.id === editingGoal.id ? {
        ...g,
        nome: goalName,
        valorAlvo: parsedTarget,
        valorAtual: parsedCurrent,
        prazo: goalDeadline,
        categoria: goalCategory,
        descricao: goalDesc,
        updatedAt: Date.now()
      } : g);
      saveSavingsGoals(updated);
      if (showAlert) showAlert("Meta Atualizada", "Sua meta de economia foi atualizada com sucesso!");
    } else {
      // Create mode
      const newGoal: SavingsGoal = {
        id: 'goal_' + Math.random().toString(36).substr(2, 9),
        nome: goalName,
        valorAlvo: parsedTarget,
        valorAtual: parsedCurrent,
        prazo: goalDeadline,
        categoria: goalCategory,
        descricao: goalDesc,
        updatedAt: Date.now()
      };
      saveSavingsGoals([...savingsGoals, newGoal]);
      if (showAlert) showAlert("Meta Criada", "Sua nova meta de economia foi criada com sucesso!");
    }

    // Reset and close
    setIsOpenGoalModal(false);
    setEditingGoal(null);
    setGoalName('');
    setGoalTarget('');
    setGoalCurrent('');
    setGoalDeadline('');
    setGoalCategory('Segurança');
    setGoalDesc('');
  };

  const handleQuickTransfer = () => {
    if (!transferGoalId) return;
    const parsedAmount = parseFloat(transferAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      if (showAlert) showAlert("Valor Inválido", "Insira um valor maior que zero.");
      return;
    }

    const targetGoal = savingsGoals.find(g => g.id === transferGoalId);
    if (!targetGoal) return;

    let newAmount = targetGoal.valorAtual;
    if (transferType === 'DEPOSIT') {
      newAmount += parsedAmount;
    } else if (transferType === 'WITHDRAW') {
      if (parsedAmount > targetGoal.valorAtual) {
        if (showAlert) showAlert("Saldo Insuficiente", "O valor de resgate é maior do que o saldo atual da meta.");
        return;
      }
      newAmount -= parsedAmount;
    }

    const updated = savingsGoals.map(g => g.id === transferGoalId ? {
      ...g,
      valorAtual: newAmount,
      updatedAt: Date.now()
    } : g);

    saveSavingsGoals(updated);
    if (showAlert) {
      showAlert(
        transferType === 'DEPOSIT' ? "Depósito Realizado" : "Resgate Realizado",
        transferType === 'DEPOSIT' 
          ? `Adicionado ${formatBRL(parsedAmount)} à meta "${targetGoal.nome}"!`
          : `Retirado ${formatBRL(parsedAmount)} da meta "${targetGoal.nome}"!`
      );
    }

    // Close and reset
    setIsOpenTransferModal(false);
    setTransferGoalId(null);
    setTransferType(null);
    setTransferAmount('');
  };

  // Dynamic Monthly Budget and Category Distribution filters
  const availableMonths = React.useMemo(() => {
    const monthsSet = new Set<string>();
    transactions.forEach(t => {
      const pDate = parseDate(t.data);
      if (pDate) {
        const y = pDate.getFullYear();
        const m = pDate.getMonth() + 1;
        monthsSet.add(`${y}-${String(m).padStart(2, '0')}`);
      }
    });

    // Ensure current month is always present
    const now = new Date();
    const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(curKey);

    return Array.from(monthsSet).sort().reverse();
  }, [transactions]);

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    if (availableMonths.length > 0) {
      return availableMonths[0];
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const formatMonthKey = (key: string) => {
    const [yStr, mStr] = key.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10) - 1;
    const date = new Date(year, month, 1);
    const name = date.toLocaleString('pt-BR', { month: 'long' });
    return `${name.charAt(0).toUpperCase() + name.slice(1)} de ${year}`;
  };

  const getShortMonthNameFromKey = (key: string) => {
    const [_, mStr] = key.split('-');
    const m = parseInt(mStr, 10) - 1;
    const date = new Date(2000, m, 1);
    const name = date.toLocaleString('pt-BR', { month: 'short' });
    return name.replace('.', '').toUpperCase();
  };

  const monthlyTransactions = React.useMemo(() => {
    const [selYear, selMonth] = selectedMonthKey.split('-').map(Number);
    return transactions.filter(t => {
      const pDate = parseDate(t.data);
      if (!pDate) return false;
      return pDate.getFullYear() === selYear && (pDate.getMonth() + 1) === selMonth;
    });
  }, [transactions, selectedMonthKey]);

  const monthlyCategoryData = React.useMemo(() => {
    const categoriesMap: { [key: string]: number } = {};
    let totalExpense = 0;

    monthlyTransactions.forEach(t => {
      const isExpense = t.tipo !== 'RECEITA' && t.tipo !== 'RECEBIDO';
      if (isExpense && t.categoria && t.valor > 0 && t.categoria !== 'BANCO' && t.categoria !== 'CARTÃO') {
        const cat = t.categoria.trim();
        categoriesMap[cat] = (categoriesMap[cat] || 0) + t.valor;
        totalExpense += t.valor;
      }
    });

    const categoryColors: { [key: string]: string } = {
      'CASA': '#3b82f6', // Blue
      'FINANCIAMENTOS': '#3b82f6',
      'ALIMENTAÇÃO': '#ef4444', // Red
      'TRANSPORTE': '#f59e0b', // Amber
      'UBER': '#f59e0b',
      'ABASTECIMENTO': '#10b981', // Emerald
      'COMBUSTÍVEL': '#10b981',
      'ETANOL': '#10b981',
      'GASOLINA': '#10b981',
      'CONSUMO': '#8b5cf6', // Purple
      'LAZER': '#ec4899', // Pink
      'SAÚDE': '#14b8a6', // Teal
      'EDUCAÇÃO': '#6366f1', // Indigo
      'SERVIÇOS': '#6b7280', // Slate
      'OUTROS': '#6b7280'
    };

    const colorPalette = [
      '#10b981', // Emerald
      '#3b82f6', // Blue
      '#f59e0b', // Amber
      '#ef4444', // Red
      '#8b5cf6', // Purple
      '#ec4899', // Pink
      '#14b8a6', // Teal
      '#6366f1', // Indigo
      '#a855f7', // Purple-light
      '#f97316', // Orange
      '#eab308'  // Yellow
    ];

    const sortedList = Object.entries(categoriesMap)
      .map(([name, value], idx) => {
        const upper = name.toUpperCase();
        let color = '#6b7280';
        if (categoryColors[upper]) {
          color = categoryColors[upper];
        } else {
          color = colorPalette[idx % colorPalette.length];
        }

        return {
          name,
          value,
          color,
        };
      })
      .sort((a, b) => b.value - a.value);

    const listWithPct = sortedList.map(item => ({
      ...item,
      percentage: totalExpense > 0 ? Math.round((item.value / totalExpense) * 100) : 0
    }));

    return {
      list: listWithPct,
      total: totalExpense
    };
  }, [monthlyTransactions]);

  const donutSegments = React.useMemo(() => {
    const { list, total } = monthlyCategoryData;
    if (total === 0 || list.length === 0) {
      return [];
    }

    let accumulated = 0;
    return list.map(item => {
      const pctFloat = (item.value / total) * 100;
      const offset = -accumulated;
      accumulated += pctFloat;
      return {
        ...item,
        pctFloat,
        offset
      };
    });
  }, [monthlyCategoryData]);

  // Calculate dynamic totals for June / July 2026 based on the spreadsheet
  // We can sum UBER recipes and fuel despesas to make it feel extremely grounded!
  const totalIncome = transactions
    .filter(t => t.tipo === 'RECEITA')
    .reduce((acc, curr) => acc + curr.valor, 0);

  const totalExpense = transactions
    .filter(t => t.tipo === 'DESPESA' || t.tipo === 'PAGO' || ['ETANOL', 'GAS. COMUM', 'ETANOL ADITIVADA', 'GAS, ADITIVADA'].includes(t.tipo))
    .reduce((acc, curr) => acc + curr.valor, 0);

  // Let's compute a realistic current balance:
  // Starts with initial accounts sum + revenues - expenses
  const initialAccountsSum = bankAccounts.reduce((acc, curr) => acc + curr.saldoInicial, 0);
  const currentBalance = initialAccountsSum + (totalIncome * 0.1) - (totalExpense * 0.2); // scaled or direct

  // Format currency helper
  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Group transactions by category to display on donut chart
  const categoriesMap: { [key: string]: number } = {};
  transactions.forEach(t => {
    if (t.categoria && t.valor > 0 && t.tipo !== 'RECEITA' && t.categoria !== 'BANCO' && t.categoria !== 'CARTÃO') {
      categoriesMap[t.categoria] = (categoriesMap[t.categoria] || 0) + t.valor;
    }
  });

  const totalCategorized = Object.values(categoriesMap).reduce((a, b) => a + b, 0);
  const categoriesList = Object.entries(categoriesMap)
    .map(([name, value]) => ({
      name,
      value,
      percentage: totalCategorized > 0 ? Math.round((value / totalCategorized) * 100) : 0
    }))
    .sort((a, b) => b.value - a.value);

  // Calculate current month consolidated summary
  const monthlyTotals = React.useMemo(() => {
    const today = new Date();
    const curMonth = today.getMonth(); // 0-11
    const curYear = today.getFullYear();

    let income = 0;
    let expense = 0;

    transactions.forEach(t => {
      const pDate = parseDate(t.data);
      if (!pDate) return;
      
      if (pDate.getMonth() === curMonth && pDate.getFullYear() === curYear) {
        const isIncome = t.tipo === 'RECEITA';
        const isExpense = t.tipo === 'DESPESA' || t.tipo === 'PAGO' || ['ETANOL', 'GAS. COMUM', 'ETANOL ADITIVADA', 'GAS, ADITIVADA'].includes(t.tipo);
        
        if (isIncome) {
          income += t.valor;
        } else if (isExpense) {
          expense += t.valor;
        }
      }
    });

    return {
      income,
      expense,
      balance: income - expense,
      monthName: today.toLocaleString('pt-BR', { month: 'long' }),
      year: curYear
    };
  }, [transactions]);

  // List of up to 3 next unpaid bills expiring in the next 5 days, or already overdue
  const next3BillsToPay = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return transactions
      .filter(t => 
        t.tipo !== 'RECEITA' && 
        t.tipo !== 'CONTAS BANCARIAS' && 
        t.tipo !== 'CARTÃO DE CRÉDITO' &&
        t.status?.toUpperCase() !== 'PAGO'
      )
      .map(t => {
        const dueDate = parseDate(t.data);
        let daysDiff = 99999;
        if (dueDate) {
          dueDate.setHours(0, 0, 0, 0);
          const diffTime = dueDate.getTime() - today.getTime();
          daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
        return { ...t, daysDiff };
      })
      .filter(t => t.daysDiff <= 5)
      .sort((a, b) => a.daysDiff - b.daysDiff)
      .slice(0, 3);
  }, [transactions]);

  // Calculate total of pending transactions ('a pagar') grouped by category
  const pendingByCategory = React.useMemo(() => {
    const categories: { [key: string]: number } = {};
    let totalPending = 0;

    transactions.forEach(t => {
      const isPending = t.tipo !== 'RECEITA' && t.status?.toUpperCase() !== 'PAGO';
      if (isPending) {
        const cat = (t.categoria || 'SEM CATEGORIA').trim().toUpperCase();
        categories[cat] = (categories[cat] || 0) + t.valor;
        totalPending += t.valor;
      }
    });

    return {
      total: totalPending,
      categories: Object.entries(categories)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
    };
  }, [transactions]);

  // Active Risk Zones
  const activeRiskZonesCount = React.useMemo(() => {
    return riskZones.filter(z => z.ativo).length;
  }, [riskZones]);

  // Dynamic color styles for IPVA notifications
  const ipvaNotificationColorStyle = React.useMemo(() => {
    const colorStyles = {
      red: {
        text: 'text-rose-400',
        border: 'border-rose-500/20',
        bg: 'bg-rose-500/10',
        bgLight: 'bg-rose-500/5',
        badge: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
        badgeCritical: 'bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse',
        cardBorder: 'border-rose-950/60 bg-gradient-to-br from-rose-950/15 to-transparent hover:border-rose-500/40 shadow-lg shadow-rose-500/5',
        button: 'text-rose-400 hover:text-rose-300',
        pulse: 'animate-critical-pulse',
        accentColor: 'rose',
        iconBgBorder: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
        headerBadge: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
        glow: 'bg-rose-500/5',
        icon: 'text-rose-400',
        progressBar: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]',
        actionButton: 'bg-rose-500/10 hover:bg-rose-500 hover:text-slate-950 text-rose-400 border-rose-500/25',
      },
      orange: {
        text: 'text-orange-400',
        border: 'border-orange-500/20',
        bg: 'bg-orange-500/10',
        bgLight: 'bg-orange-500/5',
        badge: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
        badgeCritical: 'bg-orange-500/20 text-orange-300 border-orange-500/30 animate-pulse',
        cardBorder: 'border-orange-950/60 bg-gradient-to-br from-orange-950/15 to-transparent hover:border-orange-500/40 shadow-lg shadow-orange-500/5',
        button: 'text-orange-400 hover:text-orange-300',
        pulse: 'animate-warning-pulse',
        accentColor: 'orange',
        iconBgBorder: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
        headerBadge: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
        glow: 'bg-orange-500/5',
        icon: 'text-orange-400',
        progressBar: 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]',
        actionButton: 'bg-orange-500/10 hover:bg-orange-500 hover:text-slate-950 text-orange-400 border-orange-500/25',
      },
      yellow: {
        text: 'text-amber-400',
        border: 'border-amber-500/20',
        bg: 'bg-amber-500/10',
        bgLight: 'bg-amber-500/5',
        badge: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
        badgeCritical: 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse',
        cardBorder: 'border-amber-950/60 bg-gradient-to-br from-amber-950/15 to-transparent hover:border-amber-500/40 shadow-lg shadow-amber-500/5',
        button: 'text-amber-400 hover:text-amber-300',
        pulse: 'animate-warning-pulse',
        accentColor: 'amber',
        iconBgBorder: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
        headerBadge: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
        glow: 'bg-amber-500/5',
        icon: 'text-amber-400',
        progressBar: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
        actionButton: 'bg-amber-500/10 hover:bg-amber-500 hover:text-slate-950 text-amber-400 border-amber-500/25',
      }
    };
    return colorStyles[ipvaNotificationColor as 'red' | 'orange' | 'yellow'] || colorStyles.orange;
  }, [ipvaNotificationColor]);

  // IPVA alerts for vehicles expiring in custom days
  const ipvaAlerts = React.useMemo(() => {
    if (!notifyIpva) return [];
    return checkIpvaAlerts(registeredVehicles, new Date(), transactions, ipvaLeadDays);
  }, [registeredVehicles, transactions, ipvaLeadDays, ipvaClosingDay, notifyIpva]);

  const urgentIpvaAlerts = React.useMemo(() => {
    return ipvaAlerts.filter(alert => alert.daysRemaining < 10);
  }, [ipvaAlerts]);

  // Load current vehicle mileages from localStorage
  const vehicleKms = React.useMemo(() => {
    try {
      const saved = localStorage.getItem('wealthflow_vehicle_kms');
      return saved ? JSON.parse(saved) : { 'FOX ROCK RIO 1.6': 89650 };
    } catch {
      return { 'FOX ROCK RIO 1.6': 89650 };
    }
  }, []);

  // Filter scheduled services where target KM has been exceeded by current KM
  const exceededMileageServices = React.useMemo(() => {
    return scheduledServices.filter(s => {
      if (s.status === 'REALIZADO') return false;
      if (s.tipoAgendamento !== 'KM' && s.tipoAgendamento !== 'DATA_E_KM') return false;
      if (!s.kmAlvo) return false;

      const vDescUpper = s.veiculoDescricao.toUpperCase();
      const currentKm = vehicleKms[vDescUpper] || 0;
      return currentKm >= s.kmAlvo;
    }).map(s => {
      const vDescUpper = s.veiculoDescricao.toUpperCase();
      const currentKm = vehicleKms[vDescUpper] || 0;
      const kmExceeded = currentKm - (s.kmAlvo || 0);
      return {
        ...s,
        currentKm,
        kmExceeded
      };
    });
  }, [scheduledServices, vehicleKms]);

  // Consolidado da frota: Status atual e licenciamento
  const fleetSummary = React.useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();

    let totalTransit = 0;
    let totalMaintenance = 0;
    let totalAvailable = 0;

    const vehiclesWithStatus = registeredVehicles.map(v => {
      // 1. Determine Status
      let status: 'Em trânsito' | 'Em manutenção' | 'Disponível' = 'Disponível';
      
      const vDescUpper = v.descricao.toUpperCase();
      const vPlacaUpper = v.placa?.toUpperCase() || '___';

      // Check transactions to see if there is any pending maintenance/oficina/conserto
      const hasPendingMaintenance = transactions.some(t => {
        const desc = (t.descricao || '').toUpperCase();
        const cat = (t.categoria || '').toUpperCase();
        const matchesVeh = desc.includes(vDescUpper) || desc.includes(vPlacaUpper) || (vDescUpper.includes('FOX') && desc.includes('FOX'));
        const isMaintenance = cat.includes('OFICINA') || cat.includes('MANUTENÇÃO') || desc.includes('OFICINA') || desc.includes('REVISÃO') || desc.includes('CONSERTO') || desc.includes('MECÂNICA');
        const isPending = t.status?.toUpperCase() !== 'PAGO';
        return matchesVeh && isMaintenance && isPending;
      });

      if (hasPendingMaintenance) {
        status = 'Em manutenção';
        totalMaintenance++;
      } else {
        // Check for recent fuel (abastecimento) or trip entries to see if it is currently in transit
        const hasRecentTransit = transactions.some(t => {
          const desc = (t.descricao || '').toUpperCase();
          const cat = (t.categoria || '').toUpperCase();
          const matchesVeh = desc.includes(vDescUpper) || desc.includes(vPlacaUpper) || (vDescUpper.includes('FOX') && desc.includes('FOX'));
          const isTransit = cat.includes('ABASTECIMENTO') || desc.includes('ABASTECIMENTO') || desc.includes('VIAGEM') || desc.includes('ROTA') || desc.includes('ENTREGA') || desc.includes('CORRIDA');
          
          if (t.data && matchesVeh && isTransit) {
            let txDate: Date | null = null;
            if (t.data.includes('-')) {
              const parts = t.data.split('-');
              txDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            } else if (t.data.includes('/')) {
              const parts = t.data.split('/');
              txDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
            }
            if (txDate) {
              const diffTime = Math.abs(today.getTime() - txDate.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              return diffDays <= 2;
            }
          }
          return false;
        });

        if (hasRecentTransit) {
          status = 'Em trânsito';
          totalTransit++;
        } else {
          status = 'Disponível';
          totalAvailable++;
        }
      }

      // 2. Determine Licensing Due Month & Date
      let licensingMonth = 12; // default is December
      let licensingMonthName = 'Dezembro';

      const finalDigit = getPlacaFinalDigit(v.placa);
      if (finalDigit !== null) {
        if (finalDigit === 1) { licensingMonth = 7; licensingMonthName = 'Julho'; }
        else if (finalDigit === 2) { licensingMonth = 8; licensingMonthName = 'Agosto'; }
        else if (finalDigit === 3) { licensingMonth = 9; licensingMonthName = 'Setembro'; }
        else if (finalDigit === 4) { licensingMonth = 10; licensingMonthName = 'Outubro'; }
        else if (finalDigit === 5 || finalDigit === 6) { licensingMonth = 11; licensingMonthName = 'Novembro'; }
        else { licensingMonth = 12; licensingMonthName = 'Dezembro'; }
      }

      let licensingYear = currentYear;
      let dueDateLic = new Date(licensingYear, licensingMonth - 1, 31, 23, 59, 59);
      if (dueDateLic.getTime() < today.getTime()) {
        licensingYear = currentYear + 1;
        dueDateLic = new Date(licensingYear, licensingMonth - 1, 31, 23, 59, 59);
      }

      const diffTimeLic = dueDateLic.getTime() - today.getTime();
      const daysRemainingLic = Math.ceil(diffTimeLic / (1000 * 60 * 60 * 24));

      let licensingStatus: 'EM_DIA' | 'ALERTA' | 'URGENTE' | 'ATRASADO' = 'EM_DIA';
      if (daysRemainingLic < 0) {
        licensingStatus = 'ATRASADO';
      } else if (daysRemainingLic <= 10) {
        licensingStatus = 'URGENTE';
      } else if (daysRemainingLic <= 30) {
        licensingStatus = 'ALERTA';
      }

      const ipvaAlert = ipvaAlerts.find(a => a.vehicleId === v.id);

      // Calculate monthly traveled KM
      const vehicleTxs = transactions
        .filter(t => {
          const tVeh = (t.veiculo || '').toUpperCase();
          const tDescVeh = (t.descricaoVeiculo || '').toUpperCase();
          const tDesc = (t.descricao || '').toUpperCase();
          const vUpper = vDescUpper;
          const plUpper = vPlacaUpper;
          
          return (
            tVeh === vUpper ||
            tDescVeh === vUpper ||
            (vUpper === 'FOX ROCK RIO 1.6' && (tDesc.includes('FOX') || tVeh.includes('FOX'))) ||
            (plUpper && plUpper !== '___' && (tVeh.includes(plUpper) || tDescVeh.includes(plUpper) || tDesc.includes(plUpper)))
          );
        })
        .filter(t => t.km !== undefined && t.km !== null)
        .map(t => {
          let txDate: Date | null = null;
          if (t.data) {
            if (t.data.includes('-')) {
              const parts = t.data.split('-');
              txDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            } else if (t.data.includes('/')) {
              const parts = t.data.split('/');
              txDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
            }
          }
          return { ...t, parsedDate: txDate };
        })
        .filter(t => t.parsedDate !== null)
        .sort((a, b) => a.parsedDate!.getTime() - b.parsedDate!.getTime());

      const monthlyKmMap: { [monthKey: string]: number } = {};
      vehicleTxs.forEach((t, idx) => {
        const date = t.parsedDate!;
        const month = date.getMonth();
        const year = date.getFullYear();
        const monthKey = `${String(month + 1).padStart(2, '0')}/${year}`;

        const prevTx = idx > 0 ? vehicleTxs[idx - 1] : null;
        let distance = 0;
        if (prevTx && t.km !== undefined && prevTx.km !== undefined && t.km > prevTx.km) {
          distance = t.km - prevTx.km;
        } else if (t.kmPercorrido && t.kmPercorrido > 0) {
          distance = t.kmPercorrido;
        }

        if (distance > 0) {
          monthlyKmMap[monthKey] = (monthlyKmMap[monthKey] || 0) + distance;
        }
      });

      const history: { monthKey: string; label: string; km: number }[] = [];
      for (let i = 2; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const mKey = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const label = `${months[d.getMonth()]}/${String(d.getFullYear()).substring(2)}`;
        history.push({
          monthKey: mKey,
          label,
          km: monthlyKmMap[mKey] || 0
        });
      }

      const totalKmInPeriod = history.reduce((sum, item) => sum + item.km, 0);
      const isHighUsage = totalKmInPeriod >= 1500;

      return {
        ...v,
        status,
        licensingMonthName,
        licensingDateStr: dueDateLic.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        daysRemainingLic,
        licensingStatus,
        ipvaAlert,
        kmHistory: history,
        totalKmInPeriod,
        isHighUsage
      };
    });

    return {
      vehicles: vehiclesWithStatus,
      totalCount: registeredVehicles.length,
      totalTransit,
      totalMaintenance,
      totalAvailable
    };
  }, [registeredVehicles, transactions, ipvaAlerts]);

  // Categories with expenses approaching or exceeding 90% of the defined monthly budget
  const budgetAlerts = React.useMemo(() => {
    if (!categoryBudgets) return [];
    
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const budgetsEntries = Object.entries(categoryBudgets).filter(([_, limit]) => limit > 0);
    
    const alerts: Array<{ category: string; spent: number; limit: number; percentage: number }> = [];

    budgetsEntries.forEach(([catName, annualLimit]) => {
      const monthlyLimit = annualLimit / 12;
      
      const spentInCatThisMonth = transactions
        .filter(t => {
          const pDate = parseDate(t.data);
          if (!pDate) return false;
          const isCurrentMonthAndYear = pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear;
          const isExpense = String(t.tipo || '').trim().toUpperCase() !== 'RECEITA' && String(t.tipo || '').trim().toUpperCase() !== 'RECEBIDO';
          const matchesCategory = String(t.categoria || '').trim().toUpperCase() === String(catName).trim().toUpperCase();
          return isCurrentMonthAndYear && isExpense && matchesCategory;
        })
        .reduce((sum, t) => sum + t.valor, 0);

      const pct = monthlyLimit > 0 ? (spentInCatThisMonth / monthlyLimit) * 100 : 0;
      if (pct >= 90) {
        alerts.push({
          category: catName,
          spent: spentInCatThisMonth,
          limit: monthlyLimit,
          percentage: Math.round(pct)
        });
      }
    });

    return alerts;
  }, [categoryBudgets, transactions]);

  // Reminders for transactions due in less than 48 hours but not yet paid
  const pushReminders = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return transactions
      .filter(t => 
        t.tipo !== 'RECEITA' && 
        t.tipo !== 'CONTAS BANCARIAS' && 
        t.tipo !== 'CARTÃO DE CRÉDITO' &&
        t.status?.toUpperCase() !== 'PAGO'
      )
      .map(t => {
        const dueDate = parseDate(t.data);
        let hoursRemaining = 999999;
        let daysRemaining = 999999;
        
        if (dueDate) {
          dueDate.setHours(0, 0, 0, 0);
          const diffTime = dueDate.getTime() - today.getTime();
          hoursRemaining = diffTime / (1000 * 60 * 60);
          daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
        
        return { ...t, hoursRemaining, daysRemaining };
      })
      .filter(t => {
        // Due in less than or equal to 2 days (48 hours), but not in the past, and not yet dismissed.
        return t.daysRemaining >= 0 && t.daysRemaining <= 2 && !dismissedReminders.includes(t.id);
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [transactions, dismissedReminders]);

  // Find reference date (the maximum date in transactions, or 2026-07-11 as fallback)
  const referenceDate = React.useMemo(() => {
    let maxDate = new Date('2026-07-11');
    transactions.forEach(t => {
      const pDate = parseDate(t.data);
      if (pDate && pDate > maxDate) {
        maxDate = pDate;
      }
    });
    return maxDate;
  }, [transactions]);

  // Group transactions for the last 3 months
  const last3MonthsData = React.useMemo(() => {
    const monthsList = [];
    
    for (let i = 2; i >= 0; i--) {
      const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
      monthsList.push({
        year: d.getFullYear(),
        monthNum: d.getMonth() + 1, // 1-indexed
        name: d.toLocaleString('pt-BR', { month: 'long' }).toUpperCase(),
        shortName: d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase(),
        income: 0,
        expense: 0
      });
    }

    transactions.forEach(t => {
      const pDate = parseDate(t.data);
      if (!pDate) return;
      
      const year = pDate.getFullYear();
      const monthNum = pDate.getMonth() + 1;
      
      const match = monthsList.find(m => m.year === year && m.monthNum === monthNum);
      if (match) {
        const isIncome = t.tipo === 'RECEITA';
        const isExpense = t.tipo === 'DESPESA' || t.tipo === 'PAGO' || ['ETANOL', 'GAS. COMUM', 'ETANOL ADITIVADA', 'GAS, ADITIVADA'].includes(t.tipo);
        
        if (isIncome) {
          match.income += t.valor;
        } else if (isExpense) {
          match.expense += t.valor;
        }
      }
    });

    return monthsList;
  }, [transactions, referenceDate]);

  // Group transactions for the last 6 months for Recharts comparison
  const last6MonthsData = React.useMemo(() => {
    const monthsList = [];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
      monthsList.push({
        year: d.getFullYear(),
        monthNum: d.getMonth() + 1, // 1-indexed
        name: d.toLocaleString('pt-BR', { month: 'long' }).toUpperCase(),
        shortName: d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase(),
        income: 0,
        expense: 0
      });
    }

    transactions.forEach(t => {
      const pDate = parseDate(t.data);
      if (!pDate) return;
      
      const year = pDate.getFullYear();
      const monthNum = pDate.getMonth() + 1;
      
      const match = monthsList.find(m => m.year === year && m.monthNum === monthNum);
      if (match) {
        const isIncome = t.tipo === 'RECEITA';
        const isExpense = t.tipo === 'DESPESA' || t.tipo === 'PAGO' || ['ETANOL', 'GAS. COMUM', 'ETANOL ADITIVADA', 'GAS, ADITIVADA'].includes(t.tipo);
        
        if (isIncome) {
          match.income += t.valor;
        } else if (isExpense) {
          match.expense += t.valor;
        }
      }
    });

    return monthsList.map(m => ({
      ...m,
      label: `${m.shortName}/${String(m.year).slice(-2)}`,
      "Receitas": Number(m.income.toFixed(2)),
      "Despesas": Number(m.expense.toFixed(2)),
      "Saldo": Number((m.income - m.expense).toFixed(2))
    }));
  }, [transactions, referenceDate]);

  // Group transactions for all 12 months of the current year for Recharts comparison
  const currentYearMonthsData = React.useMemo(() => {
    const monthsList = [];
    const year = referenceDate.getFullYear();
    const monthNamesShort = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const monthNamesFull = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
    
    for (let i = 0; i < 12; i++) {
      monthsList.push({
        year,
        monthNum: i + 1, // 1-indexed
        name: monthNamesFull[i],
        shortName: monthNamesShort[i],
        income: 0,
        expense: 0
      });
    }

    transactions.forEach(t => {
      const pDate = parseDate(t.data);
      if (!pDate) return;
      
      const tYear = pDate.getFullYear();
      const monthNum = pDate.getMonth() + 1;
      
      if (tYear === year) {
        const match = monthsList.find(m => m.monthNum === monthNum);
        if (match) {
          const isIncome = t.tipo === 'RECEITA';
          const isExpense = t.tipo === 'DESPESA' || t.tipo === 'PAGO' || ['ETANOL', 'GAS. COMUM', 'ETANOL ADITIVADA', 'GAS, ADITIVADA'].includes(t.tipo);
          
          if (isIncome) {
            match.income += t.valor;
          } else if (isExpense) {
            match.expense += t.valor;
          }
        }
      }
    });

    return monthsList.map(m => ({
      ...m,
      label: m.shortName,
      "Receitas": Number(m.income.toFixed(2)),
      "Despesas": Number(m.expense.toFixed(2)),
      "Saldo": Number((m.income - m.expense).toFixed(2))
    }));
  }, [transactions, referenceDate]);

  const currentMonthNum = referenceDate.getMonth();
  const currentYearNum = referenceDate.getFullYear();

  const monthlySpentByCategory = React.useMemo(() => {
    const spending: { [category: string]: number } = {};
    transactions.forEach(t => {
      const isExpense = t.tipo !== 'RECEITA' && t.tipo !== 'CONTAS BANCARIAS' && t.tipo !== 'CARTÃO DE CRÉDITO';
      if (!isExpense) return;
      const txDate = parseDate(t.data);
      if (txDate && txDate.getMonth() === currentMonthNum && txDate.getFullYear() === currentYearNum) {
        const cat = String(t.categoria || 'OUTROS').toUpperCase();
        spending[cat] = (spending[cat] || 0) + (t.valor || 0);
      }
    });
    return spending;
  }, [transactions, referenceDate, currentMonthNum, currentYearNum]);

  // Metas de gastos mensais e progresso visual consolidado baseado nos orçamentos das categorias ou no Teto Mensal Global
  const overallMonthlyBudgetProgress = React.useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const savedGlobalBudget = localStorage.getItem('wealthflow_global_monthly_budget');
    const globalBudget = savedGlobalBudget ? parseFloat(savedGlobalBudget) : 0;

    let totalBudget = 0;
    let totalSpent = 0;
    const categoryStats: Array<{
      category: string;
      budget: number;
      spent: number;
      percentage: number;
    }> = [];

    if (globalBudget > 0) {
      totalBudget = globalBudget;
      const spentByCategory: { [key: string]: number } = {};

      transactions.forEach(t => {
        const pDate = parseDate(t.data);
        if (!pDate) return;
        const isCurrentMonthAndYear = pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear;
        const isExpense = String(t.tipo || '').trim().toUpperCase() !== 'RECEITA' && 
                          String(t.tipo || '').trim().toUpperCase() !== 'RECEBIDO' && 
                          String(t.tipo || '').trim().toUpperCase() !== 'CONTAS BANCARIAS' && 
                          String(t.tipo || '').trim().toUpperCase() !== 'CARTÃO DE CRÉDITO';
        
        if (isCurrentMonthAndYear && isExpense) {
          const cat = String(t.categoria || 'OUTROS').toUpperCase();
          spentByCategory[cat] = (spentByCategory[cat] || 0) + (t.valor || 0);
          totalSpent += t.valor;
        }
      });

      Object.entries(spentByCategory).forEach(([catName, spentAmount]) => {
        const catAnnualLimit = categoryBudgets ? (categoryBudgets[catName] || 0) : 0;
        const catMonthlyLimit = catAnnualLimit / 12;
        categoryStats.push({
          category: catName,
          budget: catMonthlyLimit,
          spent: spentAmount,
          percentage: catMonthlyLimit > 0 ? Math.round((spentAmount / catMonthlyLimit) * 100) : 0,
        });
      });

      const overallPercentage = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

      return {
        totalBudget,
        totalSpent,
        percentage: overallPercentage,
        categoryStats: categoryStats.sort((a, b) => b.spent - a.spent),
        hasBudgets: true,
        isGlobal: true
      };
    }

    const budgetsEntries = Object.entries(categoryBudgets || {}).filter(([_, limit]) => limit > 0);

    budgetsEntries.forEach(([catName, annualLimit]) => {
      const monthlyLimit = annualLimit / 12;
      totalBudget += monthlyLimit;

      const spentInCatThisMonth = transactions
        .filter(t => {
          const pDate = parseDate(t.data);
          if (!pDate) return false;
          const isCurrentMonthAndYear = pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear;
          const isExpense = String(t.tipo || '').trim().toUpperCase() !== 'RECEITA' && String(t.tipo || '').trim().toUpperCase() !== 'RECEBIDO';
          const matchesCategory = String(t.categoria || '').trim().toUpperCase() === String(catName).trim().toUpperCase();
          return isCurrentMonthAndYear && isExpense && matchesCategory;
        })
        .reduce((sum, t) => sum + t.valor, 0);

      totalSpent += spentInCatThisMonth;

      categoryStats.push({
        category: catName,
        budget: monthlyLimit,
        spent: spentInCatThisMonth,
        percentage: monthlyLimit > 0 ? Math.round((spentInCatThisMonth / monthlyLimit) * 100) : 0,
      });
    });

    const overallPercentage = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

    return {
      totalBudget,
      totalSpent,
      percentage: overallPercentage,
      categoryStats: categoryStats.sort((a, b) => b.spent - a.spent),
      hasBudgets: budgetsEntries.length > 0,
      isGlobal: false
    };
  }, [categoryBudgets, transactions]);

  // Get 3 most recent transactions
  const recentTransactions = transactions
    .filter(t => t.tipo !== 'CONTAS BANCARIAS' && t.tipo !== 'CARTÃO DE CRÉDITO')
    .slice(0, 4);

  // Pending or Overdue Expenses
  const pendingOrOverdueExpenses = transactions.filter(t => 
    t.tipo !== 'RECEITA' && 
    t.tipo !== 'CONTAS BANCARIAS' && 
    t.tipo !== 'CARTÃO DE CRÉDITO' &&
    t.status?.toUpperCase() !== 'PAGO'
  );

  // Category Colors
  const getCategoryColor = (cat: string) => {
    switch (cat.toUpperCase()) {
      case 'ABASTECIMENTO': return '#80bea6'; // Emerald secondary
      case 'CASA': return '#003527'; // Dark Emerald
      case 'CONSUMO': return '#515f74'; // Slate Blue
      case 'TRABALHO': return '#10b981'; // Vivid Emerald
      case 'PESSOAL': return '#0d9488'; // Teal
      case 'LAZER': return '#4f46e5'; // Indigo
      case 'TAXAS': case 'TAXA': return '#ea580c'; // Orange
      default: return '#707974';
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat.toUpperCase()) {
      case 'ABASTECIMENTO': return 'local_gas_station';
      case 'CASA': return 'home';
      case 'CONSUMO': return 'electric_bolt';
      case 'TRABALHO': return 'work';
      case 'PESSOAL': return 'person';
      case 'LAZER': return 'sports_esports';
      case 'TAXAS': case 'TAXA': return 'percent';
      default: return 'payments';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="dashboard-tab-panel">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-emerald-400 font-mono tracking-wider">INTEGRAÇÃO DE FROTA</p>
            {activeRiskZonesCount > 0 && (
              <motion.span 
                onClick={() => onNavigate('risk')}
                animate={activeRiskZonesCount > 3 ? {
                  scale: [1, 1.04, 1],
                  backgroundColor: ["rgba(239, 68, 68, 0.1)", "rgba(239, 68, 68, 0.25)", "rgba(239, 68, 68, 0.1)"],
                  borderColor: ["rgba(239, 68, 68, 0.25)", "rgba(239, 68, 68, 0.6)", "rgba(239, 68, 68, 0.25)"]
                } : {}}
                transition={activeRiskZonesCount > 3 ? {
                  repeat: Infinity,
                  duration: 2,
                  ease: "easeInOut"
                } : undefined}
                className={`inline-flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 text-rose-400 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border border-rose-500/25 cursor-pointer shadow-sm transition-all ${activeRiskZonesCount <= 3 ? 'animate-pulse' : ''}`}
                title="Visualizar zonas de risco ativas"
              >
                <span className={`w-1.5 h-1.5 rounded-full bg-rose-500 ${activeRiskZonesCount > 3 ? 'animate-ping' : ''}`} />
                {activeRiskZonesCount} {activeRiskZonesCount === 1 ? 'ZONA DE RISCO ATIVA' : 'ZONAS DE RISCO ATIVAS'}
              </motion.span>
            )}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-display mt-0.5">Acompanhamento Fluxo de Riqueza</h2>
        </div>
        <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 w-full md:w-auto">
          <button 
            onClick={() => setHideValuesMode(!hideValuesMode)}
            className={`flex items-center justify-center gap-1.5 border active:scale-95 font-semibold px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${
              hideValuesMode 
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/35 hover:bg-amber-500/25 shadow-md shadow-amber-500/5' 
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
            title={hideValuesMode ? "Desativar Modo Ocultar Valores (Privado)" : "Ativar Modo Ocultar Valores (Privado)"}
          >
            <span className="material-symbols-outlined text-[18px]">
              {hideValuesMode ? 'visibility_off' : 'visibility'}
            </span>
            <span>{hideValuesMode ? 'Modo Privado' : 'Ocultar Valores'}</span>
          </button>
          <button 
            onClick={() => onNavigate('add-receita')}
            className="flex items-center justify-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 active:scale-95 font-semibold px-3 py-2 rounded-xl text-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
            Receita
          </button>
          <button 
            onClick={() => onNavigate('add-despesa')}
            className="flex items-center justify-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 active:scale-95 font-semibold px-3 py-2 rounded-xl text-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
            Despesa
          </button>
          <button 
            onClick={() => onNavigate('add-transaction')}
            className="col-span-2 md:col-span-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-semibold px-4 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/10 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Nova Transação / Abastecimento
          </button>
        </div>
      </div>

      {/* Abas Internas do Painel */}
      <div className="flex border-b border-slate-800/80 gap-2 p-1 bg-slate-950/45 rounded-2xl max-w-md" id="dashboard-inner-tabs">
        <button
          onClick={() => setDashboardTab('geral')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            dashboardTab === 'geral'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">dashboard</span>
          Visão Geral
        </button>
        <button
          onClick={() => setDashboardTab('orcamento')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            dashboardTab === 'orcamento'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">donut_large</span>
          Metas de Orçamento
        </button>
      </div>

      {dashboardTab === 'geral' ? (
        <>
          {/* Sistema de Lembrete Push - Vencimento em até 48 Horas */}
      <AnimatePresence>
        {pushReminders.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="rounded-2xl border bg-slate-900/60 p-4 border-amber-500/25 shadow-2xl overflow-hidden relative"
            id="push-reminders-alerts-panel"
          >
            {/* Ambient gold/amber background glow */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/5 rounded-full blur-3xl pointer-events-none animate-pulse" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 text-amber-400">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
                    <BellRing className="w-4 h-4 text-amber-400 animate-bounce" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm font-display tracking-tight flex items-center gap-2">
                      Lembrete Push de Vencimento
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-mono font-bold tracking-widest uppercase">
                        Vence em até 48h
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                      Notificações instantâneas de pendências de fluxo
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-850">
                  {pushReminders.length} {pushReminders.length === 1 ? 'notificação ativa' : 'notificações ativas'}
                </span>
              </div>
            </div>

            {/* List of active push reminders */}
            <div className="mt-4 space-y-2.5">
              {pushReminders.map((reminder) => {
                const days = reminder.daysRemaining;
                
                let timeText = '';
                let badgeClass = '';
                
                if (days === 0) {
                  timeText = 'Vence Hoje!';
                  badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/30 font-bold';
                } else if (days === 1) {
                  timeText = 'Vence Amanhã (em menos de 24h)';
                  badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
                } else {
                  timeText = `Vence em ${days} dias (em até 48h)`;
                  badgeClass = 'bg-blue-500/10 text-blue-300 border-blue-500/25';
                }

                return (
                  <motion.div
                    key={`push-reminder-${reminder.id}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-slate-950/70 border border-slate-850 hover:border-slate-800 p-3.5 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all duration-300"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                        <span className="material-symbols-outlined text-sm">
                          {reminder.categoria === 'ABASTECIMENTO' ? 'local_gas_station' : 
                           reminder.categoria === 'CASA' ? 'home' : 
                           reminder.categoria === 'CONSUMO' ? 'shopping_cart' : 
                           reminder.categoria === 'LAZER' ? 'sports_esports' : 'payments'}
                        </span>
                      </div>
                      
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-xs font-bold text-white uppercase tracking-tight">{reminder.descricao}</h4>
                          <span className={`text-[9px] font-mono font-medium px-2 py-0.5 rounded-full border uppercase tracking-wider ${badgeClass}`}>
                            {timeText}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 text-[10px] text-slate-400 font-mono">
                          <span>Vencimento: <strong className="text-slate-200">{reminder.data}</strong></span>
                          <span className="w-1 h-1 bg-slate-700 rounded-full" />
                          <span>Valor: <strong className="text-emerald-400">{showBalance ? formatBRL(reminder.valor) : '••••••'}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 self-stretch sm:self-auto justify-end">
                      {/* Mark as paid */}
                      {onEditTransaction && (
                        <button
                          onClick={() => onEditTransaction(reminder.id, { status: 'PAGO' })}
                          className="flex items-center justify-center gap-1.5 bg-emerald-500/10 hover:bg-emerald text-emerald-400 hover:text-slate-950 text-[10px] font-mono font-bold px-3 py-2 rounded-xl border border-emerald-500/25 cursor-pointer transition-all active:scale-95 duration-200"
                          title="Marcar conta como paga"
                        >
                          <Check className="w-3 h-3" />
                          <span>Pagar</span>
                        </button>
                      )}

                      {/* Dismiss reminder */}
                      <button
                        onClick={() => dismissReminder(reminder.id)}
                        className="flex items-center justify-center p-2 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white rounded-xl border border-slate-800 cursor-pointer transition-all active:scale-95"
                        title="Dispensar lembrete"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Subtle IPVA Warning Banner for < 10 days */}
      <AnimatePresence>
        {urgentIpvaAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-center justify-between gap-3 text-rose-300 text-xs overflow-hidden"
            id="subtle-ipva-urgent-banner"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-rose-500 text-lg animate-pulse">warning</span>
              <div>
                <span className="font-bold text-white font-sans">IPVA Urgente Detectado: </span>
                <span>
                  {urgentIpvaAlerts.length === 1 
                    ? `O veículo ${urgentIpvaAlerts[0].vehicleDesc} (${urgentIpvaAlerts[0].placa}) está com o vencimento do IPVA programado para daqui a menos de 10 dias (${urgentIpvaAlerts[0].daysRemaining} dias restantes - Vencimento em ${urgentIpvaAlerts[0].dueDateStr}).`
                    : `Você possui ${urgentIpvaAlerts.length} veículos com IPVA vencendo em menos de 10 dias! Regularize o quanto antes.`
                  }
                </span>
              </div>
            </div>
            <button 
              onClick={() => onNavigate('profile')}
              className="bg-rose-500 hover:bg-rose-450 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-[10px] uppercase font-mono active:scale-95 transition-all whitespace-nowrap cursor-pointer shadow-md shadow-rose-500/10"
            >
              Ver Veículo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visual Notification for Exceeded Scheduled Service Mileage */}
      <AnimatePresence>
        {exceededMileageServices.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between gap-4 text-amber-300 text-xs overflow-hidden shadow-lg shadow-amber-500/5 relative"
            id="mileage-revision-exceeded-alert-banner"
          >
            {/* Ambient gold glow background */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
            
            <div className="flex items-start gap-3 relative z-10">
              <span className="material-symbols-outlined text-amber-400 text-lg animate-bounce shrink-0 mt-0.5">speed</span>
              <div className="space-y-1">
                <span className="font-extrabold text-white font-sans text-xs uppercase tracking-wider block">
                  Revisão por Quilometragem Excedida!
                </span>
                <p className="leading-relaxed text-slate-300">
                  {exceededMileageServices.length === 1 ? (
                    <>
                      O veículo <strong className="text-white">{exceededMileageServices[0].veiculoDescricao}</strong> ultrapassou a quilometragem para o serviço agendado <strong className="text-amber-400">"{exceededMileageServices[0].descricao}"</strong>. 
                      Limite recomendado: <strong className="text-white">{exceededMileageServices[0].kmAlvo?.toLocaleString('pt-BR')} km</strong> | KM Atual: <strong className="text-amber-400">{exceededMileageServices[0].currentKm.toLocaleString('pt-BR')} km</strong> (Excedeu em <strong className="text-rose-400">+{exceededMileageServices[0].kmExceeded.toLocaleString('pt-BR')} km</strong>).
                    </>
                  ) : (
                    <>
                      Atenção: <strong className="text-white">{exceededMileageServices.length} revisões agendadas por quilometragem</strong> foram ultrapassadas na frota! Veja os detalhes abaixo e regularize as manutenções pendentes.
                    </>
                  )}
                </p>
                {exceededMileageServices.length > 1 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {exceededMileageServices.slice(0, 3).map((s, idx) => (
                      <span key={`exceeded-badge-${idx}`} className="px-2 py-0.5 rounded-md bg-slate-950/60 border border-amber-500/25 text-[10px] text-amber-300 font-mono">
                        🚗 {s.veiculoDescricao}: {s.descricao} (+{s.kmExceeded.toLocaleString('pt-BR')} km)
                      </span>
                    ))}
                    {exceededMileageServices.length > 3 && (
                      <span className="text-[10px] text-slate-500 self-center font-mono font-semibold">
                        e mais {exceededMileageServices.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <button 
              onClick={() => onNavigate('carservices')}
              className="bg-amber-500 hover:bg-amber-450 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-[10px] uppercase font-mono active:scale-95 transition-all whitespace-nowrap cursor-pointer shrink-0 shadow-md shadow-amber-500/10 relative z-10"
            >
              Ver Manutenções
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Risk Zones Alert Banner */}
      <AnimatePresence>
        {activeRiskZonesCount > 0 && (
          <motion.section
            initial={{ opacity: 0, y: -10 }}
            animate={activeRiskZonesCount > 3 ? { 
              opacity: 1, 
              y: 0,
              borderColor: ["rgba(239, 68, 68, 0.2)", "rgba(239, 68, 68, 0.55)", "rgba(239, 68, 68, 0.2)"],
              boxShadow: [
                "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)",
                "0 10px 25px -5px rgba(239,68,68,0.18), 0 8px 10px -6px rgba(239,68,68,0.18)",
                "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)"
              ]
            } : { opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={activeRiskZonesCount > 3 ? {
              borderColor: { repeat: Infinity, duration: 2, ease: "easeInOut" },
              boxShadow: { repeat: Infinity, duration: 2, ease: "easeInOut" }
            } : undefined}
            className={`rounded-2xl border bg-slate-950/40 p-4 shadow-lg relative overflow-hidden transition-all duration-300 ${activeRiskZonesCount > 3 ? 'border-rose-500/30' : 'border-rose-500/20'}`}
            id="active-risk-zones-alert-panel"
          >
            {/* Ambient Red glow background */}
            <div className={`absolute top-0 left-0 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-all duration-500 ${activeRiskZonesCount > 3 ? 'bg-rose-500/12 scale-125' : 'bg-rose-500/5'}`} />
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <motion.div 
                  animate={activeRiskZonesCount > 3 ? {
                    scale: [1, 1.08, 1],
                  } : {}}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full border transition-all duration-300 ${activeRiskZonesCount > 3 ? 'bg-rose-500/20 text-rose-400 border-rose-500/45 shadow-[0_0_12px_rgba(239,68,68,0.25)]' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}
                >
                  <span className={`material-symbols-outlined ${activeRiskZonesCount > 3 ? 'animate-pulse font-bold' : 'animate-bounce'}`}>gpp_maybe</span>
                </motion.div>
                <div className="space-y-1">
                  <h3 className="font-bold text-white text-sm font-display tracking-tight flex items-center gap-1.5 flex-wrap">
                    Alerta de Segurança: Zonas de Risco Ativas
                    {activeRiskZonesCount > 3 ? (
                      <span className="text-[10px] bg-rose-500 text-white px-2.5 py-0.5 rounded-full font-mono font-bold animate-pulse shadow-md shadow-rose-500/30 tracking-wider">
                        CRÍTICO / ALTO RISCO ({activeRiskZonesCount})
                      </span>
                    ) : (
                      <span className="text-[10px] bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded-full font-mono font-bold animate-pulse">
                        ATENÇÃO
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400 max-w-2xl">
                    Existem <span className="text-rose-400 font-bold">{activeRiskZonesCount}</span> zonas de risco ativas que exigem cuidado redobrado e monitoramento de velocidade do veículo ao trafegar por essas imediações.
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => onNavigate('risk')}
                className={`text-xs font-semibold hover:underline flex items-center gap-1 cursor-pointer self-start md:self-center border px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${activeRiskZonesCount > 3 ? 'text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/35 shadow-sm shadow-rose-500/5' : 'text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/15'}`}
              >
                Ver no Mapa <span className="material-symbols-outlined text-xs">map</span>
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Alerta de Orçamento de Categoria (Aproximando ou Excedendo Limite) */}
      <AnimatePresence>
        {budgetAlerts.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="rounded-2xl border bg-slate-900/60 p-4 border-amber-500/20 shadow-xl overflow-hidden relative"
            id="budget-limit-alerts-panel"
          >
            {/* Ambient amber/rose background glow */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-amber-400">
                  <span className="material-symbols-outlined text-lg animate-pulse font-semibold">warning</span>
                  <h3 className="font-bold text-white text-sm font-display tracking-tight flex items-center gap-1.5">
                    Alerta de Limite de Orçamento
                    <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full font-mono font-medium">
                      Atenção &gt;= 90%
                    </span>
                  </h3>
                </div>
                <p className="text-xs text-slate-400 max-w-xl">
                  {budgetAlerts.length === 1 
                    ? 'Uma categoria atingiu ou está muito próxima de atingir o limite mensal estabelecido.' 
                    : `${budgetAlerts.length} categorias atingiram ou estão muito próximas de atingir o limite mensal estabelecido.`}
                </p>
              </div>

              <button
                onClick={() => onNavigate('profile')}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium hover:underline flex items-center gap-1 cursor-pointer self-start md:self-center"
              >
                Ajustar limites de categoria <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </button>
            </div>

            {/* List of Warning Categories */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {budgetAlerts.map((alert) => {
                const isOver = alert.spent > alert.limit;
                
                return (
                  <div
                    key={`alert-budget-${alert.category}`}
                    className={`bg-slate-950/60 border p-3 rounded-xl flex flex-col justify-between gap-2.5 transition-all duration-300 hover:scale-[1.01] ${
                      isOver 
                        ? 'border-rose-950/60 bg-gradient-to-b from-rose-950/5 to-transparent shadow-md shadow-rose-500/5' 
                        : 'border-amber-950/40 bg-gradient-to-b from-amber-950/5 to-transparent shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-slate-400 text-sm">
                            {alert.category === 'ABASTECIMENTO' ? 'local_gas_station' : 
                             alert.category === 'CASA' ? 'home' : 
                             alert.category === 'CONSUMO' ? 'shopping_cart' : 
                             alert.category === 'LAZER' ? 'sports_esports' : 'category'}
                          </span>
                          <span className="text-xs font-bold text-white uppercase font-mono tracking-wide">
                            {alert.category}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {isOver ? 'Limite excedido!' : 'Próximo ao limite mensal'}
                        </p>
                      </div>

                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                        isOver 
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/20 animate-pulse' 
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                      }`}>
                        {alert.percentage}%
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-850/50">
                        <div
                          style={{ width: `${Math.min(alert.percentage, 100)}%` }}
                          className={`h-full rounded-full ${
                            isOver ? 'bg-rose-500' : 'bg-amber-500'
                          }`}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-slate-500">
                          Gasto: <strong className={isOver ? 'text-rose-400' : 'text-amber-400'}>{showBalance ? formatBRL(alert.spent) : '••••••'}</strong>
                        </span>
                        <span className="text-slate-500">
                          Limite: <span className="text-slate-300">{showBalance ? formatBRL(alert.limit) : '••••••'}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Visual Notification System for Upcoming Bills */}
      <AnimatePresence>
        {next3BillsToPay.length > 0 && (
          <motion.section 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="rounded-2xl border bg-slate-900/60 p-4 border-slate-800 shadow-xl overflow-hidden relative"
            id="upcoming-bills-notification-panel"
          >
            {/* Ambient Background Glow for Alert priority */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-amber-400">
                  <span className="material-symbols-outlined text-lg animate-pulse font-semibold">warning</span>
                  <h3 className="font-bold text-white text-sm font-display tracking-tight flex items-center gap-1.5">
                    Contas Próximas ao Vencimento
                    <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full font-mono font-medium">
                      Próximos 5 Dias
                    </span>
                  </h3>
                </div>
                <p className="text-xs text-slate-400 max-w-xl">
                  Identificamos {next3BillsToPay.length === 1 ? '1 conta pendente' : `${next3BillsToPay.length} contas pendentes`} que requer{next3BillsToPay.length === 1 ? 'e' : 'em'} atenção imediata para evitar multas e juros.
                </p>
              </div>
              
              <button 
                onClick={() => onNavigate('transactions')}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium hover:underline flex items-center gap-1 cursor-pointer self-start md:self-center"
              >
                Gerenciar todas as contas <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </button>
            </div>

            {/* List of Next 3 Bills */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              {next3BillsToPay.map((bill) => {
                const isOverdue = bill.daysDiff < 0;
                const isToday = bill.daysDiff === 0;
                const isTomorrow = bill.daysDiff === 1;

                let badgeColorClass = "bg-slate-950/40 text-slate-400 border border-slate-800/80";
                let badgeText = `Vence em ${bill.daysDiff} dias`;
                let shadowColorClass = "";
                let itemBorderClass = "border-slate-850";

                if (isOverdue) {
                  badgeColorClass = "bg-rose-500/15 text-rose-400 border border-rose-500/20";
                  badgeText = `Atrasada (${Math.abs(bill.daysDiff)} ${Math.abs(bill.daysDiff) === 1 ? 'dia' : 'dias'})`;
                  itemBorderClass = "border-rose-950/60 bg-gradient-to-b from-rose-950/10 to-transparent";
                  shadowColorClass = "shadow-lg shadow-rose-500/5";
                } else if (isToday) {
                  badgeColorClass = "bg-amber-500/15 text-amber-400 border border-amber-500/20 animate-pulse";
                  badgeText = "Vence HOJE";
                  itemBorderClass = "border-amber-950/60 bg-gradient-to-b from-amber-950/10 to-transparent";
                  shadowColorClass = "shadow-lg shadow-amber-500/5";
                } else if (isTomorrow) {
                  badgeColorClass = "bg-orange-500/15 text-orange-400 border border-orange-500/20";
                  badgeText = "Vence AMANHÃ";
                  itemBorderClass = "border-orange-950/40";
                }

                return (
                  <div 
                    key={bill.id}
                    className={`bg-slate-950/60 border p-3 rounded-xl flex flex-col justify-between gap-3 relative transition-all duration-300 hover:scale-[1.01] ${itemBorderClass} ${shadowColorClass}`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-white line-clamp-1" title={bill.descricao}>
                          {bill.descricao}
                        </p>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                          <span className="material-symbols-outlined text-[10px]">calendar_today</span>
                          Vencimento: {bill.data}
                        </p>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full font-mono uppercase tracking-wider whitespace-nowrap shrink-0 ${badgeColorClass}`}>
                        {badgeText}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-900/80 pt-2 mt-1">
                      <span className="text-sm font-bold text-emerald-400 font-mono">
                        {formatBRL(bill.valor)}
                      </span>
                      
                      {onEditTransaction && (
                        <button
                          onClick={() => {
                            if (showConfirm) {
                              showConfirm(
                                "Confirmar Pagamento",
                                `Deseja marcar "${bill.descricao}" como Paga? Isso atualizará o status no fluxo de riqueza.`,
                                () => {
                                  onEditTransaction(bill.id, { 
                                    status: 'PAGO', 
                                    dataPagamento: new Date().toISOString().split('T')[0], 
                                    valorPg: bill.valor 
                                  });
                                  if (showAlert) {
                                    showAlert("Sucesso", "Conta marcada como paga com sucesso!");
                                  }
                                }
                              );
                            } else {
                              onEditTransaction(bill.id, { 
                                status: 'PAGO', 
                                dataPagamento: new Date().toISOString().split('T')[0], 
                                valorPg: bill.valor 
                              });
                            }
                          }}
                          className="flex items-center gap-1 text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 text-emerald-400 px-2.5 py-1 rounded-lg transition-all cursor-pointer font-semibold border border-emerald-500/10"
                        >
                          <span className="material-symbols-outlined text-[12px]">check_circle</span>
                          Pagar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Sistema de Notificação de IPVA para Veículos Registrados */}
      <AnimatePresence>
        {ipvaAlerts.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`rounded-2xl border bg-slate-900/60 p-4 shadow-xl overflow-hidden relative ${ipvaNotificationColorStyle.border}`}
            id="ipva-notification-panel"
          >
            {/* Ambient background glow for IPVA priority */}
            <div className={`absolute top-0 left-0 w-32 h-32 rounded-full blur-2xl pointer-events-none ${ipvaNotificationColorStyle.glow}`} />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className={`flex items-center gap-2 ${ipvaNotificationColorStyle.text}`}>
                  <span className="material-symbols-outlined text-lg animate-pulse font-semibold">directions_car</span>
                  <h3 className="font-bold text-white text-sm font-display tracking-tight flex items-center gap-1.5">
                    Alerta de IPVA Próximo ao Vencimento
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${ipvaNotificationColorStyle.headerBadge}`}>
                      Próximos {ipvaLeadDays} Dias
                    </span>
                  </h3>
                </div>
                <p className="text-xs text-slate-400 max-w-xl">
                  Identificamos {ipvaAlerts.length === 1 ? '1 veículo com IPVA' : `${ipvaAlerts.length} veículos com IPVA`} vencendo nos próximos {ipvaLeadDays} dias. Realize o pagamento para evitar multas.
                </p>
              </div>

              <button 
                onClick={() => onNavigate('profile')}
                className={`text-xs font-medium hover:underline flex items-center gap-1 cursor-pointer self-start md:self-center ${ipvaNotificationColorStyle.button}`}
              >
                Gerenciar veículos <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </button>
            </div>

            {/* List of IPVA Alerts */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {ipvaAlerts.map((alert) => {
                const isToday = alert.daysRemaining === 0;
                const isVerySoon = alert.daysRemaining <= 5;

                let badgeColorClass = "bg-slate-950/40 text-slate-400 border border-slate-800/80";
                let badgeText = `Vence em ${alert.daysRemaining} dias`;
                let shadowColorClass = "";
                let itemBorderClass = "border-slate-850";

                if (isToday) {
                  badgeColorClass = ipvaNotificationColorStyle.badgeCritical;
                  badgeText = "Vence HOJE ⚠️";
                  itemBorderClass = ipvaNotificationColorStyle.cardBorder;
                  shadowColorClass = `shadow-lg ${ipvaNotificationColorStyle.pulse}`;
                } else if (isVerySoon) {
                  badgeColorClass = ipvaNotificationColorStyle.badge;
                  badgeText = `Vence em ${alert.daysRemaining} dias ⚠️`;
                  itemBorderClass = ipvaNotificationColorStyle.cardBorder;
                  shadowColorClass = `shadow-md ${ipvaNotificationColorStyle.pulse}`;
                }

                return (
                  <div 
                    key={alert.vehicleId}
                    className={`bg-slate-950/60 border p-3.5 rounded-xl flex flex-col justify-between gap-3 relative transition-all duration-300 hover:scale-[1.01] ${itemBorderClass} ${shadowColorClass}`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-slate-400 text-sm">directions_car</span>
                          <p className="text-xs font-semibold text-white line-clamp-1">
                            {alert.vehicleDesc}
                          </p>
                          <span className="text-[9px] bg-slate-800 text-slate-400 px-1 py-0.5 rounded font-mono uppercase tracking-tight">{alert.placa}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Mês de vencimento: <span className="text-emerald-400 font-bold uppercase">{alert.dueMonthName}</span> (Placa Final {alert.finalDigit})
                        </p>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                          <span className="material-symbols-outlined text-[10px]">calendar_today</span>
                          Vencimento: {alert.dueDateStr}
                        </p>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full font-mono uppercase tracking-wider whitespace-nowrap shrink-0 ${badgeColorClass}`}>
                        {badgeText}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-900/80 pt-2 mt-1">
                      <span className="text-xs text-slate-500">
                        Valor est.: <strong className="text-slate-300 font-mono">R$ 1.500,00</strong>
                      </span>
                      
                      {onAddTransaction && (
                        <button
                          onClick={async () => {
                            if (showConfirm) {
                              showConfirm(
                                "Confirmar Pagamento de IPVA",
                                `Deseja registrar o pagamento de IPVA para o veículo "${alert.vehicleDesc} (${alert.placa})" no valor de R$ 1.500,00?`,
                                async () => {
                                  await onAddTransaction({
                                    data: new Date().toISOString().split('T')[0],
                                    valor: 1500,
                                    tipo: 'DESPESA',
                                    descricao: `IPVA ${alert.vehicleDesc} ${alert.placa} (Final ${alert.finalDigit})`,
                                    categoria: 'VEÍCULO',
                                    status: 'PAGO',
                                    valorPg: 1500,
                                    dataPagamento: new Date().toISOString().split('T')[0],
                                    motorista: alert.motorista,
                                    veiculo: alert.vehicleDesc
                                  });
                                  if (showAlert) {
                                    showAlert("IPVA Pago!", "O pagamento foi registrado com sucesso e a notificação de vencimento foi desativada.");
                                  }
                                }
                              );
                            } else {
                              await onAddTransaction({
                                data: new Date().toISOString().split('T')[0],
                                valor: 1500,
                                tipo: 'DESPESA',
                                descricao: `IPVA ${alert.vehicleDesc} ${alert.placa} (Final ${alert.finalDigit})`,
                                categoria: 'VEÍCULO',
                                status: 'PAGO',
                                valorPg: 1500,
                                dataPagamento: new Date().toISOString().split('T')[0],
                                motorista: alert.motorista,
                                veiculo: alert.vehicleDesc
                              });
                            }
                          }}
                          className="flex items-center gap-1 text-[10px] bg-orange-500/10 hover:bg-orange-500/20 active:scale-95 text-orange-400 px-2.5 py-1 rounded-lg transition-all cursor-pointer font-semibold border border-orange-500/10"
                        >
                          <span className="material-symbols-outlined text-[12px]">payments</span>
                          Registrar Pagamento
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Seção Informativa de IPVA da Frota */}
      {registeredVehicles.length > 0 && ipvaAlerts.length === 0 && (
        <section className="bg-slate-900/30 border border-slate-850 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/3 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/15 shrink-0">
              <span className="material-symbols-outlined text-sm">check_circle</span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">Controle de IPVA da Frota</h4>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                Toda a frota ({registeredVehicles.length} {registeredVehicles.length === 1 ? 'veículo' : 'veículos'}) está com o IPVA regularizado ou sem vencimentos para os próximos {ipvaLeadDays} dias.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('profile')}
            className="text-[10px] bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold px-3 py-1.5 rounded-xl uppercase tracking-wider transition-all cursor-pointer font-mono whitespace-nowrap self-start sm:self-center"
          >
            Ver Calendário IPVA
          </button>
        </section>
      )}

      {/* 📡 Monitor de Proximidade GPS & Zonas de Risco */}
      <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-lg relative overflow-hidden animate-fade-in" id="gps-proximity-monitor-card">
        {/* Glow behind title */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isGpsTracking ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/35 shadow-[0_0_8px_rgba(16,185,129,0.15)] animate-pulse' : 'bg-slate-800 text-slate-400 border border-slate-750'}`}>
              <span className="material-symbols-outlined text-lg">{isGpsTracking ? 'radar' : 'location_off'}</span>
            </div>
            <div>
              <h3 className="font-bold text-white text-sm font-display tracking-tight flex items-center gap-2">
                Monitoramento de Proximidade GPS
                {isGpsTracking && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-slate-400">
                Verifique se você está se aproximando de zonas de risco cadastradas em tempo real.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isGpsTracking ? (
              <button
                onClick={handleStopGPSTracking}
                className="px-4 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">cancel</span> Parar Radar
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsGpsTracking(true);
                  setIsGpsSimulated(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider bg-emerald-500 text-slate-950 hover:bg-emerald-400 border border-emerald-500 transition-all cursor-pointer shadow-lg shadow-emerald-500/10 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">location_searching</span> Iniciar Radar GPS
              </button>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 pt-1.5">
          {/* Real-time status coordinates panel */}
          <div className="md:col-span-6 bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col justify-between gap-3 min-h-[110px]">
            <div className="space-y-1">
              <span className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-wider">Status das Coordenadas</span>
              <div className="flex items-center gap-2">
                {isGpsTracking ? (
                  <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${isGpsSimulated ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                    {isGpsSimulated ? '🧪 SIMULADOR ATIVO' : '🛰️ GPS DISPOSITIVO'}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded border bg-slate-900 text-slate-400 border-slate-800">
                    🔴 RADAR DESATIVADO
                  </span>
                )}
              </div>
            </div>

            {isGpsTracking && gpsPosition ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="material-symbols-outlined text-xs text-slate-400">explore</span>
                  <span className="text-[11px] font-mono font-bold leading-none">
                    Lat: {gpsPosition.latitude.toFixed(6)}, Lng: {gpsPosition.longitude.toFixed(6)}
                  </span>
                </div>
                <p className="text-[9px] text-slate-500">
                  Precisão estimada otimizada para fins de segurança operacional.
                </p>
              </div>
            ) : gpsError ? (
              <div className="flex items-start gap-2 bg-rose-500/5 border border-rose-500/15 p-2 rounded-lg">
                <span className="material-symbols-outlined text-rose-400 text-sm">error</span>
                <p className="text-[9px] text-rose-400 leading-tight">{gpsError}</p>
              </div>
            ) : (
              <p className="text-[10px] text-slate-500 italic">
                Inicie o radar ou utilize o simulador ao lado para testar a geolocalização e alertas.
              </p>
            )}
          </div>

          {/* Simulation controller panel */}
          <div className="md:col-span-6 bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col justify-between gap-3 min-h-[110px]">
            <div>
              <span className="text-[9px] font-bold font-mono text-amber-400 uppercase tracking-wider block mb-1">Laboratório de Teste (Simular Coordenadas)</span>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Escolha uma zona ativa cadastrada abaixo para simular que você entrou fisicamente nela e disparar o alerta.
              </p>
            </div>

            <div className="flex gap-2">
              <select
                value={simulationSelectedZoneId}
                onChange={(e) => setSimulationSelectedZoneId(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-100 font-mono text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500/50 cursor-pointer"
              >
                <option value="">-- Selecione uma Zona --</option>
                {riskZones.filter(z => z.ativo).map(zone => (
                  <option key={zone.id} value={zone.id}>
                    {zone.nomeLocal.toUpperCase()} ({zone.nivelRisco})
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  if (simulationSelectedZoneId) {
                    handleSimulateGPS(Number(simulationSelectedZoneId));
                  }
                }}
                disabled={!simulationSelectedZoneId}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-[11px] font-mono uppercase tracking-wider rounded-xl transition-all shadow-md shadow-amber-500/10 cursor-pointer"
              >
                Simular
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Grid: Saldo Consolidado & Ações Rápidas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fade-in" id="dashboard-hero-and-quickactions-grid">
        {/* Main Balance Hero (lg:col-span-4) */}
        <div className="lg:col-span-4 flex flex-col h-full">
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 p-6 border border-slate-800 shadow-xl flex-1 flex flex-col justify-between min-h-[200px]" id="balance-card">
            {/* Glow effect */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium tracking-widest text-slate-400 uppercase">Saldo Total Consolidado</span>
                  <button 
                    onClick={() => setShowBalance(!showBalance)}
                    className="p-1.5 hover:bg-white/5 rounded-full transition-colors cursor-pointer text-slate-400"
                    title={showBalance ? "Ocultar Saldo" : "Mostrar Saldo"}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showBalance ? 'visibility' : 'visibility_off'}
                    </span>
                  </button>
                </div>

                <div className={`flex items-baseline gap-2 ${hideValuesMode ? 'blur-[6px] select-none hover:blur-none transition-all duration-200 cursor-help' : 'transition-all duration-200'}`} title={hideValuesMode ? "Valor oculto (passe o mouse para revelar)" : undefined}>
                  <span className="text-lg font-bold text-emerald-400 font-mono">R$</span>
                  <span className="text-4xl font-bold tracking-tight text-white font-display">
                    {showBalance ? '3.125,42' : '••••••'}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs">
                <span className="text-slate-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Sincronizado com planilha ativa
                </span>
                <button 
                  onClick={() => onNavigate('transactions')}
                  className="text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer self-start"
                >
                  Ver extrato completo <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Quick Actions Panel (lg:col-span-8) */}
        <div className="lg:col-span-8">
          <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-lg relative overflow-hidden flex flex-col justify-between h-full min-h-[200px]" id="quick-actions-card">
            {/* Glow effect */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/15 shrink-0">
                    <span className="material-symbols-outlined text-[18px]">bolt</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider">Ações Rápidas de Fluxo</h3>
                    <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-0.5">Adicionar despesa ou receita imediata (data atual pré-preenchida)</p>
                  </div>
                </div>

                {/* Tipo Switcher */}
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850" id="quick-type-switch">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickTipo('DESPESA');
                      setQuickCategoria('CONSUMO');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                      quickTipo === 'DESPESA'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Despesa
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickTipo('RECEITA');
                      setQuickCategoria('TRABALHO');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                      quickTipo === 'RECEITA'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Receita
                  </button>
                </div>
              </div>

              {/* Form inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Descrição */}
                <div className="sm:col-span-5 space-y-1">
                  <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Descrição</label>
                  <input
                    type="text"
                    value={quickDescricao}
                    onChange={(e) => setQuickDescricao(e.target.value)}
                    placeholder={quickTipo === 'DESPESA' ? "Ex: Padaria, Uber, etc." : "Ex: Pix Recebido, Salário, etc."}
                    className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 transition-all"
                  />
                </div>

                {/* Valor */}
                <div className="sm:col-span-3 space-y-1">
                  <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Valor (R$)</label>
                  <input
                    type="text"
                    value={quickValor}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9,]/g, '');
                      setQuickValor(val);
                    }}
                    placeholder="0,00"
                    className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 transition-all font-mono"
                  />
                </div>

                {/* Categoria */}
                <div className="sm:col-span-4 space-y-1">
                  <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Categoria</label>
                  <select
                    value={quickCategoria}
                    onChange={(e) => setQuickCategoria(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    {quickTipo === 'DESPESA' ? (
                      <>
                        <option value="CONSUMO">CONSUMO</option>
                        <option value="ABASTECIMENTO">ABASTECIMENTO</option>
                        <option value="CASA">CASA</option>
                        <option value="PESSOAL">PESSOAL</option>
                        <option value="LAZER">LAZER</option>
                        <option value="TAXAS">TAXAS</option>
                      </>
                    ) : (
                      <>
                        <option value="TRABALHO">TRABALHO</option>
                        <option value="PESSOAL">PESSOAL</option>
                        <option value="RENDIMENTOS">RENDIMENTOS</option>
                        <option value="OUTROS">OUTROS</option>
                      </>
                    )}
                    {customCategories.map(cat => (
                      <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Advanced controls: Account/Card and Paid toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                {/* Account / Card Select */}
                <div className="sm:col-span-8 space-y-1">
                  <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Conta Bancária / Cartão</label>
                  <select
                    value={quickAccountKey}
                    onChange={(e) => setQuickAccountKey(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="">-- Vincular Conta/Cartão (Opcional) --</option>
                    {bankAccounts.length > 0 && (
                      <optgroup label="Contas Bancárias">
                        {bankAccounts.map(b => (
                          <option key={`banco-${b.id}`} value={`banco-${b.id}`}>🏦 {b.nome}</option>
                        ))}
                      </optgroup>
                    )}
                    {creditCards.length > 0 && quickTipo === 'DESPESA' && (
                      <optgroup label="Cartões de Crédito">
                        {creditCards.map(c => (
                          <option key={`cartao-${c.id}`} value={`cartao-${c.id}`}>💳 {c.nome}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {/* Status: Já Pago toggle */}
                <div className="sm:col-span-4 flex items-center justify-between sm:justify-end gap-3 pt-4 sm:pt-2">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    {quickTipo === 'DESPESA' ? 'Despesa Paga?' : 'Recebida?'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuickIsPaid(!quickIsPaid)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      quickIsPaid ? 'bg-emerald-500' : 'bg-slate-800'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                        quickIsPaid ? 'translate-x-4 bg-white' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Clickable presets for speed! */}
              <div className="flex flex-wrap gap-1.5 items-center pt-1">
                <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">Sugestões Rápidas:</span>
                <button
                  type="button"
                  onClick={() => {
                    setQuickTipo('DESPESA');
                    setQuickDescricao('Combustível Posto');
                    setQuickCategoria('ABASTECIMENTO');
                    setQuickIsPaid(true);
                  }}
                  className="bg-slate-950 hover:bg-slate-850 text-slate-300 text-[10px] px-2.5 py-1 rounded-lg border border-slate-850 hover:border-slate-800 font-medium cursor-pointer transition-all active:scale-95"
                >
                  ⛽ Combustível
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuickTipo('DESPESA');
                    setQuickDescricao('Alimentação / Lanche');
                    setQuickCategoria('CONSUMO');
                    setQuickIsPaid(true);
                  }}
                  className="bg-slate-950 hover:bg-slate-850 text-slate-300 text-[10px] px-2.5 py-1 rounded-lg border border-slate-850 hover:border-slate-800 font-medium cursor-pointer transition-all active:scale-95"
                >
                  🍔 Alimentação
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuickTipo('DESPESA');
                    setQuickDescricao('Uber / Transporte');
                    setQuickCategoria('PESSOAL');
                    setQuickIsPaid(true);
                  }}
                  className="bg-slate-950 hover:bg-slate-850 text-slate-300 text-[10px] px-2.5 py-1 rounded-lg border border-slate-850 hover:border-slate-800 font-medium cursor-pointer transition-all active:scale-95"
                >
                  🚗 Uber
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuickTipo('RECEITA');
                    setQuickDescricao('Pix Recebido');
                    setQuickCategoria('PESSOAL');
                    setQuickIsPaid(true);
                  }}
                  className="bg-slate-950 hover:bg-slate-850 text-slate-300 text-[10px] px-2.5 py-1 rounded-lg border border-slate-850 hover:border-slate-800 font-medium cursor-pointer transition-all active:scale-95"
                >
                  💰 Pix Recebido
                </button>
              </div>
            </div>

            {/* Bottom Button Action */}
            <div className="flex justify-end pt-3 border-t border-slate-800/40 relative z-10">
              <button
                type="button"
                disabled={quickIsSubmitting}
                onClick={async () => {
                  const cleanValue = quickValor.replace(/\./g, '').replace(',', '.');
                  const parsedVal = parseFloat(cleanValue);
                  
                  if (!quickDescricao.trim()) {
                    if (showAlert) showAlert('Descrição Faltando', 'Por favor, insira uma descrição para a transação.');
                    return;
                  }
                  if (isNaN(parsedVal) || parsedVal <= 0) {
                    if (showAlert) showAlert('Valor Inválido', 'Por favor, insira um valor numérico válido.');
                    return;
                  }

                  if (!onAddTransaction) return;

                  try {
                    setQuickIsSubmitting(true);
                    
                    const today = new Date();
                    const dd = String(today.getDate()).padStart(2, '0');
                    const mm = String(today.getMonth() + 1).padStart(2, '0');
                    const yyyy = today.getFullYear();
                    const todayStr = `${dd}/${mm}/${yyyy}`;
                    
                    const txData: any = {
                      data: todayStr,
                      valor: parsedVal,
                      tipo: quickTipo,
                      descricao: quickDescricao.trim(),
                      categoria: quickCategoria,
                      status: quickIsPaid ? 'PAGO' : 'PENDENTE',
                    };

                    if (quickIsPaid) {
                      txData.dataPagamento = todayStr;
                      txData.valorPg = parsedVal;
                    }

                    if (quickAccountKey) {
                      if (quickAccountKey.startsWith('banco-')) {
                        const bId = parseInt(quickAccountKey.replace('banco-', ''), 10);
                        const bank = bankAccounts.find(b => b.id === bId);
                        if (bank) {
                          txData.bancoId = bank.id;
                          txData.bancoNome = bank.nome;
                        }
                      } else if (quickAccountKey.startsWith('cartao-')) {
                        const cId = parseInt(quickAccountKey.replace('cartao-', ''), 10);
                        const card = creditCards.find(c => c.id === cId);
                        if (card) {
                          txData.bancoId = card.id;
                          txData.bancoNome = `${card.nome} (Cartão)`;
                        }
                      }
                    }

                    await onAddTransaction(txData);

                    // Reset fields on success
                    setQuickDescricao('');
                    setQuickValor('');
                    
                    if (showAlert) {
                      showAlert(
                        'Sucesso!',
                        `${quickTipo === 'DESPESA' ? 'Despesa' : 'Receita'} adicionada instantaneamente com data de hoje (${todayStr})!`
                      );
                    }
                  } catch (err) {
                    console.error("Erro ao adicionar transação rápida:", err);
                    if (showAlert) showAlert('Erro', 'Ocorreu um erro ao salvar a transação rápida.');
                  } finally {
                    setQuickIsSubmitting(false);
                  }
                }}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold uppercase cursor-pointer active:scale-95 transition-all shadow-md shrink-0 font-mono ${
                  quickTipo === 'DESPESA'
                    ? 'bg-rose-500 hover:bg-rose-400 text-slate-950 shadow-rose-500/10'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/10'
                }`}
              >
                <span className="material-symbols-outlined text-sm font-bold">add_circle</span>
                {quickIsSubmitting ? "Enviando..." : `Adicionar ${quickTipo === 'DESPESA' ? 'Despesa' : 'Receita'}`}
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Consolidated Monthly Summary Card */}
      <section className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-lg relative overflow-hidden animate-fade-in" id="monthly-consolidation-card">
        {/* Glow effect */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-800/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/15 shrink-0">
              <Calendar className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider">
                Consolidado do Mês
              </h3>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-0.5">
                Resumo de {monthlyTotals.monthName} {monthlyTotals.year}
              </p>
            </div>
          </div>
          <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full whitespace-nowrap self-start sm:self-center">
            Período Atual
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Receitas */}
          <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-xl space-y-2 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/20 transition-all duration-300">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Receitas</span>
              <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/10">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-0.5">
              <p className={`text-xl font-bold text-emerald-400 font-mono tracking-tight ${hideValuesMode ? 'blur-[5px] select-none hover:blur-none transition-all duration-200 cursor-help' : 'transition-all duration-200'}`} title={hideValuesMode ? "Valor oculto (passe o mouse para revelar)" : undefined}>
                {showBalance ? formatBRL(monthlyTotals.income) : '••••••'}
              </p>
              <p className="text-[9px] text-slate-500 font-mono">Total recebido no mês</p>
            </div>
          </div>

          {/* Total Despesas */}
          <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-xl space-y-2 flex flex-col justify-between relative overflow-hidden group hover:border-rose-500/20 transition-all duration-300">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Despesas</span>
              <div className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/10">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-0.5">
              <p className={`text-xl font-bold text-rose-400 font-mono tracking-tight ${hideValuesMode ? 'blur-[5px] select-none hover:blur-none transition-all duration-200 cursor-help' : 'transition-all duration-200'}`} title={hideValuesMode ? "Valor oculto (passe o mouse para revelar)" : undefined}>
                {showBalance ? formatBRL(monthlyTotals.expense) : '••••••'}
              </p>
              <p className="text-[9px] text-slate-500 font-mono">Total pago e agendado</p>
            </div>
          </div>

          {/* Saldo Líquido */}
          <div className={`bg-slate-950/50 border p-4 rounded-xl space-y-2 flex flex-col justify-between relative overflow-hidden group transition-all duration-300 ${
            monthlyTotals.balance >= 0 
              ? 'border-emerald-950/60 hover:border-emerald-500/20' 
              : 'border-rose-950/60 hover:border-rose-500/20'
          }`}>
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Saldo do Mês</span>
              <div className={`p-1.5 rounded-lg border ${
                monthlyTotals.balance >= 0 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10' 
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/10'
              }`}>
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-0.5">
              <p className={`text-xl font-bold font-mono tracking-tight ${
                monthlyTotals.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'
              } ${hideValuesMode ? 'blur-[5px] select-none hover:blur-none transition-all duration-200 cursor-help' : 'transition-all duration-200'}`} title={hideValuesMode ? "Valor oculto (passe o mouse para revelar)" : undefined}>
                {showBalance ? formatBRL(monthlyTotals.balance) : '••••••'}
              </p>
              <p className="text-[9px] text-slate-500 font-mono">Diferença de fluxo de caixa</p>
            </div>
          </div>
        </div>
      </section>

      {/* 🎯 Resumo do Orçamento Mensal Global */}
      <section className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-lg relative overflow-hidden animate-fade-in" id="monthly-budget-progress-consolidated">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-800/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/15 shrink-0">
              <span className="material-symbols-outlined text-lg text-amber-400">target</span>
            </div>
            <div>
              <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider flex items-center gap-1.5">
                Resumo do Orçamento Mensal Global
                {overallMonthlyBudgetProgress.isGlobal && <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md font-mono font-bold tracking-normal uppercase">Teto Global</span>}
              </h3>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-0.5">
                {overallMonthlyBudgetProgress.isGlobal 
                  ? "Teto de gastos unificado para controle de despesas gerais"
                  : "Consolidado mensal de orçamentos e despesas das categorias"
                }
              </p>
            </div>
          </div>
          {overallMonthlyBudgetProgress.hasBudgets && (
            <span className={`text-[9px] font-mono font-bold uppercase tracking-widest border px-2.5 py-1 rounded-full whitespace-nowrap ${
              overallMonthlyBudgetProgress.percentage > 100
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 animate-pulse'
                : overallMonthlyBudgetProgress.percentage > 85
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              {overallMonthlyBudgetProgress.percentage > 100 
                ? 'Limite Excedido' 
                : overallMonthlyBudgetProgress.percentage > 85 
                ? 'Atenção Limite' 
                : 'Orçamento Saudável'
              }
            </span>
          )}
        </div>

        {!overallMonthlyBudgetProgress.hasBudgets ? (
          <div className="bg-slate-950/40 border border-slate-850/60 p-5 rounded-xl text-center space-y-2.5">
            <p className="text-xs text-slate-400 italic font-sans">
              Nenhuma meta de orçamento definida para as suas categorias para calcular o progresso global.
            </p>
            <button
              onClick={() => onNavigate('profile')}
              className="inline-flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[10px] font-mono font-bold px-3.5 py-2 rounded-xl border border-amber-500/25 cursor-pointer transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-xs">add</span> Definir Metas no Perfil
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Progresso Geral */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850/80 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                    Consolidado de Gastos Realizados
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-lg font-bold font-mono ${
                      overallMonthlyBudgetProgress.percentage > 100 ? 'text-rose-400' : 'text-slate-200'
                    }`}>
                      {showBalance ? formatBRL(overallMonthlyBudgetProgress.totalSpent) : '••••••'}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      de {showBalance ? formatBRL(overallMonthlyBudgetProgress.totalBudget) : '••••••'}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-2xl font-extrabold font-mono tracking-tight block ${
                    overallMonthlyBudgetProgress.percentage > 100 
                      ? 'text-rose-400' 
                      : overallMonthlyBudgetProgress.percentage > 85 
                      ? 'text-amber-400' 
                      : 'text-emerald-400'
                  }`}>
                    {overallMonthlyBudgetProgress.percentage}%
                  </span>
                  <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                    Utilizado do Limite
                  </span>
                </div>
              </div>

              {/* Barra de Progresso Global */}
              <div className="space-y-1.5">
                <div className="w-full h-3.5 bg-slate-900 rounded-full overflow-hidden border border-slate-850/80 p-0.5">
                  <motion.div
                    className={`h-full rounded-full transition-all duration-500 ${
                      overallMonthlyBudgetProgress.percentage > 100
                        ? 'bg-gradient-to-r from-rose-600 to-rose-450 shadow-[0_0_10px_rgba(239,68,68,0.35)]'
                        : overallMonthlyBudgetProgress.percentage > 85
                        ? 'bg-gradient-to-r from-amber-600 to-amber-450 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                        : 'bg-gradient-to-r from-emerald-600 to-emerald-450 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(overallMonthlyBudgetProgress.percentage, 100)}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
                {overallMonthlyBudgetProgress.percentage > 100 ? (
                  <p className="text-[10px] text-rose-400 font-mono font-bold animate-pulse flex items-center gap-1.5 pt-0.5">
                    <span className="material-symbols-outlined text-xs">warning</span> Orçamento geral estourado em R$ {(overallMonthlyBudgetProgress.totalSpent - overallMonthlyBudgetProgress.totalBudget).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}! Revise seus gastos das categorias.
                  </p>
                ) : overallMonthlyBudgetProgress.percentage > 85 ? (
                  <p className="text-[10px] text-amber-400 font-mono font-bold flex items-center gap-1.5 pt-0.5">
                    <span className="material-symbols-outlined text-xs">info</span> Atenção: Você utilizou mais de 85% do seu orçamento mensal consolidado.
                  </p>
                ) : (
                  <p className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1.5 pt-0.5">
                    <span className="material-symbols-outlined text-xs">check_circle</span> Orçamento saudável! Você possui R$ {(overallMonthlyBudgetProgress.totalBudget - overallMonthlyBudgetProgress.totalSpent).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} restantes para gastar este mês.
                  </p>
                )}
              </div>
            </div>

            {/* Sub-lista de Detalhes por Categoria de forma Compacta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {overallMonthlyBudgetProgress.categoryStats.slice(0, 6).map((stat) => {
                let icon = 'category';
                if (stat.category === 'ABASTECIMENTO') icon = 'local_gas_station';
                else if (stat.category === 'CASA') icon = 'home';
                else if (stat.category === 'CONSUMO') icon = 'shopping_cart';
                else if (stat.category === 'LAZER') icon = 'sports_esports';
                else if (stat.category === 'PESSOAL') icon = 'person';
                else if (stat.category === 'TAXAS') icon = 'receipt_long';
                
                const isOver = stat.spent > stat.budget;
                const isWarning = stat.percentage > 80 && stat.percentage <= 100;

                return (
                  <div key={`progress-cat-${stat.category}`} className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850/80 space-y-2 flex flex-col justify-between">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400 text-sm">{icon}</span>
                        <span className="text-[11px] font-bold text-slate-200 uppercase font-mono tracking-wide">{stat.category}</span>
                      </div>
                      <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded ${
                        isOver 
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' 
                          : isWarning 
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' 
                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {stat.percentage}%
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden border border-slate-850/50">
                        <div 
                          style={{ width: `${Math.min(stat.percentage, 100)}%` }} 
                          className={`h-full rounded-full ${
                            isOver ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[9px] font-mono text-slate-500">
                        <span>Gasto: <strong className={isOver ? 'text-rose-400' : 'text-slate-300'}>{showBalance ? formatBRL(stat.spent) : '••••••'}</strong></span>
                        <span>Meta: {showBalance ? formatBRL(stat.budget) : '••••••'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Resumo de Transações Pendentes por Categoria ('A Pagar') */}
      <section className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-lg relative overflow-hidden animate-fade-in animate-duration-300" id="pending-debts-summary-card">
        {/* Glow effect */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-800/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/15 shrink-0">
              <span className="material-symbols-outlined text-lg text-rose-400">pending_actions</span>
            </div>
            <div>
              <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider">
                Débitos e Contas a Pagar
              </h3>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-0.5">
                Total acumulado pendente por categoria
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className={`text-[10px] font-mono font-bold text-rose-400 uppercase tracking-widest bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-full whitespace-nowrap ${hideValuesMode ? 'blur-[5px] select-none hover:blur-none transition-all duration-200 cursor-help' : 'transition-all duration-200'}`} title={hideValuesMode ? "Valor oculto (passe o mouse para revelar)" : undefined}>
              {showBalance ? formatBRL(pendingByCategory.total) : '••••••'} total pendente
            </span>
          </div>
        </div>

        {pendingByCategory.categories.length === 0 ? (
          <div className="bg-slate-950/40 border border-slate-850/60 p-5 rounded-xl text-center">
            <span className="material-symbols-outlined text-emerald-400 text-3xl mb-2">task_alt</span>
            <p className="text-xs text-slate-400 italic font-sans">
              Parabéns! Nenhuma conta pendente ou em atraso encontrada.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingByCategory.categories.map(({ name, value }) => {
              let icon = 'category';
              if (name === 'ABASTECIMENTO') icon = 'local_gas_station';
              else if (name === 'CASA') icon = 'home';
              else if (name === 'CONSUMO') icon = 'shopping_cart';
              else if (name === 'LAZER') icon = 'sports_esports';
              else if (name === 'PESSOAL') icon = 'person';
              else if (name === 'TAXAS') icon = 'receipt_long';
              else if (name === 'TRABALHO') icon = 'work';

              return (
                <div 
                  key={`pending-cat-${name}`}
                  className="bg-slate-950/50 border border-slate-850 hover:border-slate-800 p-3.5 rounded-xl flex items-center justify-between gap-3 transition-all duration-300 animate-fade-in"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                      <span className="material-symbols-outlined text-sm">{icon}</span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-200 uppercase font-mono tracking-wide block">{name}</span>
                      <span className="text-[9px] text-slate-500 font-mono block">Valor pendente</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-bold text-rose-400 font-mono ${hideValuesMode ? 'blur-[5px] select-none hover:blur-none transition-all duration-200 cursor-help' : 'transition-all duration-200'}`} title={hideValuesMode ? "Valor oculto (passe o mouse para revelar)" : undefined}>
                      {showBalance ? formatBRL(value) : '••••••'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Painel de Vencimento de IPVA (Próximos {ipvaLeadDays} Dias) */}
      {registeredVehicles.length > 0 && (
        <section className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-lg relative overflow-hidden animate-fade-in" id="ipva-highlight-panel">
          {/* Subtle custom color glow if there are alerts, or emerald glow if none */}
          <div className={`absolute top-0 right-0 w-36 h-36 rounded-full blur-3xl pointer-events-none ${ipvaAlerts.length > 0 ? `${ipvaNotificationColorStyle.glow} animate-pulse` : 'bg-emerald-500/5'}`} />

          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-800/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${ipvaAlerts.length > 0 ? ipvaNotificationColorStyle.iconBgBorder : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                <span className="material-symbols-outlined text-lg">calendar_month</span>
              </div>
              <div>
                <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider">
                  Destaque de IPVA — Frota em Alerta
                </h3>
                <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-0.5">
                  Vencimentos programados para os próximos {ipvaLeadDays} dias
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              {/* Interactive antecedence selector */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-xl shrink-0">
                <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">Antecedência:</span>
                <select
                  value={ipvaLeadDays}
                  onChange={(e) => setIpvaLeadDays?.(parseInt(e.target.value, 10))}
                  className="bg-transparent text-white font-mono text-[10px] font-bold focus:outline-none cursor-pointer pr-1"
                >
                  <option value={15} className="bg-slate-950 text-white">15 dias</option>
                  <option value={30} className="bg-slate-950 text-white">30 dias</option>
                  <option value={45} className="bg-slate-950 text-white">45 dias</option>
                  <option value={60} className="bg-slate-950 text-white">60 dias</option>
                  <option value={90} className="bg-slate-950 text-white">90 dias</option>
                </select>
              </div>

              <span className={`text-[10px] font-mono font-bold uppercase tracking-widest border px-3 py-1 rounded-full whitespace-nowrap ${
                ipvaAlerts.length > 0 
                  ? ipvaNotificationColorStyle.badgeCritical
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}>
                {ipvaAlerts.length === 0 
                  ? 'Tudo em Dia' 
                  : `${ipvaAlerts.length} ${ipvaAlerts.length === 1 ? 'Veículo pendente' : 'Veículos pendentes'}`
                }
              </span>
            </div>
          </div>

          {ipvaAlerts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ipvaAlerts.map((alert) => {
                const daysLeft = alert.daysRemaining;
                const pctRemaining = Math.max(0, Math.min(100, (daysLeft / ipvaLeadDays) * 100));
                
                let cardGlowClass = "border-slate-800 bg-gradient-to-br from-slate-900/10 to-transparent hover:border-slate-700/50";
                let badgeStyle = "bg-slate-800/40 text-slate-400 border border-slate-700/50";
                let textRemaining = `Vence em ${daysLeft} dias`;

                if (daysLeft === 0) {
                  cardGlowClass = `${ipvaNotificationColorStyle.cardBorder} ${ipvaNotificationColorStyle.pulse}`;
                  badgeStyle = ipvaNotificationColorStyle.badgeCritical;
                  textRemaining = "Vence HOJE!";
                } else if (daysLeft <= 5) {
                  cardGlowClass = `${ipvaNotificationColorStyle.cardBorder} ${ipvaNotificationColorStyle.pulse}`;
                  badgeStyle = ipvaNotificationColorStyle.badge;
                  textRemaining = `Vence em ${daysLeft} dias!`;
                }

                return (
                  <div 
                    key={`ipva-alert-card-${alert.vehicleId}`}
                    className={`bg-slate-950/40 border p-4 rounded-xl flex flex-col justify-between gap-3 transition-all duration-300 relative overflow-hidden group ${cardGlowClass}`}
                  >
                    {/* Visual Countdown Background Accent */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-white/[0.01] to-transparent pointer-events-none" />

                    <div className="flex justify-between items-start gap-2 relative z-10">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-slate-400 text-sm">directions_car</span>
                          <span className="text-xs font-extrabold text-white tracking-wide uppercase font-sans">
                            {alert.vehicleDesc}
                          </span>
                          {alert.placa && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-slate-300 font-mono rounded font-bold uppercase tracking-wider">
                              {alert.placa}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Motorista: <strong className="text-slate-300">{alert.motorista || 'Não Definido'}</strong>
                        </p>
                      </div>

                      <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full font-mono uppercase tracking-wider shrink-0 border ${badgeStyle}`}>
                        {textRemaining}
                      </span>
                    </div>

                    {/* Progress Bar Container */}
                    <div className="space-y-1.5 relative z-10">
                      <div className="flex justify-between text-[9px] font-mono text-slate-500">
                        <span>Tempo Restante</span>
                        <span className="font-bold text-slate-400">{daysLeft} / {ipvaLeadDays} dias</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-900 border border-slate-850/50 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            daysLeft <= 5 ? ipvaNotificationColorStyle.progressBar : 'bg-slate-700'
                          }`}
                          style={{ width: `${pctRemaining}%` }}
                        />
                      </div>
                    </div>

                    {/* Meta Data & Action Row */}
                    <div className="flex items-center justify-between border-t border-slate-900/80 pt-2.5 mt-1 relative z-10">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-500 uppercase font-mono tracking-wider">Vencimento</span>
                        <span className="text-[10px] font-semibold text-slate-300 font-mono">{alert.dueDateStr}</span>
                      </div>

                      <div className="flex flex-col items-end">
                        <span className="text-[9px] text-slate-500 uppercase font-mono tracking-wider">Estimativa</span>
                        <span className="text-[10px] font-bold text-emerald-400 font-mono">R$ 1.500,00</span>
                      </div>
                    </div>

                    {onAddTransaction && (
                      <div className="pt-1.5 relative z-10">
                        <button
                          onClick={async () => {
                            if (showConfirm) {
                              showConfirm(
                                "Confirmar Pagamento de IPVA",
                                `Deseja registrar o pagamento de IPVA para o veículo "${alert.vehicleDesc} (${alert.placa})" no valor de R$ 1.500,00?`,
                                async () => {
                                  await onAddTransaction({
                                    data: new Date().toISOString().split('T')[0],
                                    valor: 1500,
                                    tipo: 'DESPESA',
                                    descricao: `IPVA ${alert.vehicleDesc} ${alert.placa} (Final ${alert.finalDigit})`,
                                    categoria: 'VEÍCULO',
                                    status: 'PAGO',
                                    valorPg: 1500,
                                    dataPagamento: new Date().toISOString().split('T')[0],
                                    motorista: alert.motorista,
                                    veiculo: alert.vehicleDesc
                                  });
                                  if (showAlert) {
                                    showAlert("IPVA Pago!", "O pagamento foi registrado com sucesso e a notificação de vencimento foi desativada.");
                                  }
                                }
                              );
                            } else {
                              await onAddTransaction({
                                data: new Date().toISOString().split('T')[0],
                                valor: 1500,
                                tipo: 'DESPESA',
                                descricao: `IPVA ${alert.vehicleDesc} ${alert.placa} (Final ${alert.finalDigit})`,
                                categoria: 'VEÍCULO',
                                status: 'PAGO',
                                valorPg: 1500,
                                dataPagamento: new Date().toISOString().split('T')[0],
                                motorista: alert.motorista,
                                veiculo: alert.vehicleDesc
                              });
                            }
                          }}
                          className={`w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-mono font-bold rounded-xl border transition-all duration-300 active:scale-[0.98] cursor-pointer shadow-sm ${ipvaNotificationColorStyle.actionButton}`}
                        >
                          <span className="material-symbols-outlined text-sm">payments</span>
                          Registrar Pagamento IPVA
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-slate-950/30 border border-slate-850 p-5 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-lg">verified</span>
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-slate-200">Toda a Frota em Conformidade</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed max-w-xl">
                    Excelente! Nenhum veículo registrado possui IPVA vencendo nos próximos {ipvaLeadDays} dias. Acompanhe os meses futuros de vencimento da frota abaixo ou gerencie os veículos no seu perfil.
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('profile')}
                className="text-[10px] font-bold font-mono uppercase tracking-wider bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 px-4 py-2 rounded-xl transition-all hover:text-white shrink-0 cursor-pointer"
              >
                Gerenciar Frota
              </button>
            </div>
          )}

          {/* Quick Calendar of IPVA Expirations */}
          <div className="pt-2 border-t border-slate-850/60">
            <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">Meses de Vencimento de IPVA por Placa Final</span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {registeredVehicles.map((v) => {
                const monthInfo = getVehicleIpvaMonth(v);
                const finalDigit = getPlacaFinalDigit(v.placa);
                const isPaid = !ipvaAlerts.some(a => a.vehicleId === v.id);

                return (
                  <div key={`ipva-cal-${v.id}`} className="bg-slate-950/50 border border-slate-900 rounded-lg p-2 flex flex-col justify-between gap-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-slate-400 font-semibold truncate max-w-[70px] uppercase">{v.descricao}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] text-white font-mono font-bold uppercase">{monthInfo?.name || 'Dezembro'}</span>
                      <span className="text-[8px] text-slate-500 font-mono">Final {finalDigit !== null ? finalDigit : '-'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Card de Configuração de Alerta de IPVA Personalizado */}
      <section className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-lg relative overflow-hidden animate-fade-in" id="custom-ipva-alert-config-panel">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-2.5 border-b border-slate-800/60 pb-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/15 shrink-0">
            <span className="material-symbols-outlined text-lg">notification_add</span>
          </div>
          <div>
            <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider">
              Configurar Alerta de IPVA Personalizado
            </h3>
            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-0.5">
              Selecione um veículo ou digite a placa para definir data específica de vencimento
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end font-sans">
          {/* Selecionar Veículo Cadastrado */}
          <div className="space-y-1.5">
            <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-slate-400">directions_car</span>
              Veículo Cadastrado
            </label>
            <select
              value={selectedVehicleId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedVehicleId(val);
                if (val && val !== 'custom') {
                  const found = registeredVehicles.find(v => v.id === val);
                  if (found && found.placa) {
                    setCustomIpvaPlaca(found.placa.toUpperCase());
                  }
                } else {
                  setCustomIpvaPlaca('');
                }
              }}
              className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500 transition-all font-sans"
            >
              <option value="">-- Selecione ou Escolha Digitar --</option>
              {registeredVehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.descricao} ({v.placa || 'Sem Placa'})
                </option>
              ))}
              <option value="custom">Outro (Digitar Placa Manualmente)</option>
            </select>
          </div>

          {/* Campo Placa */}
          <div className="space-y-1.5">
            <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-slate-400">abc</span>
              Placa do Veículo
            </label>
            <input
              type="text"
              value={customIpvaPlaca}
              onChange={(e) => setCustomIpvaPlaca(e.target.value.toUpperCase())}
              disabled={selectedVehicleId !== '' && selectedVehicleId !== 'custom'}
              placeholder="Ex: ABC-1234 ou BRA2E19"
              maxLength={8}
              className={`w-full bg-slate-950 border border-slate-850 hover:border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500 transition-all font-mono uppercase ${
                selectedVehicleId !== '' && selectedVehicleId !== 'custom' ? 'opacity-60 cursor-not-allowed bg-slate-900/60' : ''
              }`}
            />
          </div>

          {/* Campo Data de Vencimento */}
          <div className="space-y-1.5">
            <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-slate-400 font-bold">calendar_month</span>
              Data de Vencimento do IPVA
            </label>
            <input
              type="date"
              value={customIpvaData}
              onChange={(e) => setCustomIpvaData(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500 transition-all font-mono"
            />
          </div>
        </div>

        {/* Botão de Ação */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => {
              if (!customIpvaPlaca.trim() || !customIpvaData.trim()) {
                if (showAlert) {
                  showAlert("Campos Obrigatórios", "Por favor, selecione/digite a placa do veículo e a data de vencimento do IPVA.");
                }
                return;
              }

              const plateNormalized = customIpvaPlaca.toUpperCase().trim();
              const dueDate = new Date(customIpvaData);
              
              if (isNaN(dueDate.getTime())) {
                if (showAlert) {
                  showAlert("Data Inválida", "A data selecionada é inválida.");
                }
                return;
              }

              // 1. Save to custom IPVA dates map in localStorage
              try {
                const savedCustom = localStorage.getItem('wealthflow_custom_ipva_dates');
                const currentMap = savedCustom ? JSON.parse(savedCustom) : {};
                currentMap[plateNormalized] = customIpvaData;
                localStorage.setItem('wealthflow_custom_ipva_dates', JSON.stringify(currentMap));
              } catch (e) {
                console.error("Failed to save custom IPVA date mapping:", e);
              }

              // 2. Ensure vehicle is in registeredVehicles so checkIpvaAlerts processes it
              if (setRegisteredVehicles) {
                setRegisteredVehicles(prev => {
                  const exists = prev.some(v => v.placa?.toUpperCase().trim() === plateNormalized);
                  if (!exists) {
                    const newVeh = {
                      id: 'custom-' + Date.now().toString(),
                      descricao: `VEÍCULO ${plateNormalized}`,
                      motorista: 'ALEXANDRE',
                      placa: plateNormalized,
                      mesFinalPlaca: dueDate.getMonth() + 1
                    };
                    const updated = [...prev, newVeh];
                    localStorage.setItem('wealthflow_registered_vehicles', JSON.stringify(updated));
                    return updated;
                  } else {
                    // If it exists, update its month to match the custom due date month
                    return prev.map(v => {
                      if (v.placa?.toUpperCase().trim() === plateNormalized) {
                        return {
                          ...v,
                          mesFinalPlaca: dueDate.getMonth() + 1
                        };
                      }
                      return v;
                    });
                  }
                });
              }

              // Reset fields and show success notification
              setSelectedVehicleId('');
              setCustomIpvaPlaca('');
              setCustomIpvaData('');
              if (showAlert) {
                showAlert("Alerta Configurado!", `O monitoramento de IPVA para o veículo ${plateNormalized} foi ativado para o dia ${dueDate.toLocaleDateString('pt-BR')}.`);
              }
            }}
            className="w-full md:w-auto flex items-center justify-center gap-1.5 px-6 py-2.5 bg-amber-500/10 hover:bg-amber-50 hover:text-slate-950 text-amber-400 text-xs font-mono font-bold rounded-xl border border-amber-500/25 transition-all duration-300 active:scale-[0.98] cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">notifications_active</span>
            Salvar Configuração de Alerta
          </button>
        </div>

        {/* List of current custom IPVA dates if any are set with dynamic countdown timers */}
        {(() => {
          try {
            const savedCustom = localStorage.getItem('wealthflow_custom_ipva_dates');
            if (savedCustom) {
              const parsed = JSON.parse(savedCustom);
              const keys = Object.keys(parsed);
              if (keys.length > 0) {
                return (
                  <div className="pt-4 border-t border-slate-800/60 space-y-3">
                    <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                      Alertas & Prazos Ativos de IPVA
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {keys.map(plate => {
                        const dateStr = parsed[plate];
                        const dateObj = new Date(dateStr);
                        const formatted = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('pt-BR') : dateStr;
                        
                        // Calculate days remaining
                        let daysRemaining: number | null = null;
                        if (!isNaN(dateObj.getTime())) {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const due = new Date(dateObj);
                          due.setHours(0, 0, 0, 0);
                          const diffTime = due.getTime() - today.getTime();
                          daysRemaining = Math.ceil(diffTime / (1000 * 3600 * 24));
                        }

                        // Associate with a registered vehicle description if possible
                        const matchedVehicle = registeredVehicles.find(v => v.placa?.toUpperCase().trim() === plate);
                        const vehicleDesc = matchedVehicle ? matchedVehicle.descricao : `Veículo ${plate}`;

                        // Determine countdown highlight
                        const isUnder30 = daysRemaining !== null && daysRemaining >= 0 && daysRemaining < 30;
                        const isOverdue = daysRemaining !== null && daysRemaining < 0;

                        return (
                          <div 
                            key={plate} 
                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                              isOverdue 
                                ? 'bg-rose-500/5 border-rose-500/25 text-rose-200' 
                                : isUnder30 
                                  ? 'bg-amber-500/5 border-amber-500/30 text-amber-200 animate-pulse'
                                  : 'bg-slate-950/60 border-slate-850 text-slate-300'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${
                                isOverdue 
                                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                                  : isUnder30 
                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-bounce' 
                                    : 'bg-slate-900 border-slate-800 text-slate-400'
                              }`}>
                                <span className="material-symbols-outlined text-base">directions_car</span>
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-white font-mono text-xs bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded uppercase">
                                    {plate}
                                  </span>
                                  <span className="text-[11px] text-slate-400 font-medium truncate max-w-[120px]" title={vehicleDesc}>
                                    {vehicleDesc}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5 font-sans">
                                  Vencimento: <strong className="text-slate-300">{formatted}</strong>
                                </p>
                              </div>
                            </div>

                            {/* Countdown / Status Section */}
                            <div className="flex items-center gap-2 self-end sm:self-center">
                              {daysRemaining !== null && (
                                <>
                                  {isOverdue ? (
                                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-wider font-mono">
                                      <span className="material-symbols-outlined text-[11px]">warning</span>
                                      Venceu há {-daysRemaining} {Math.abs(daysRemaining) === 1 ? 'dia' : 'dias'}
                                    </div>
                                  ) : isUnder30 ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-widest font-mono animate-pulse">
                                      <span className="material-symbols-outlined text-[11px] font-bold">alarm</span>
                                      Pague em {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'}!
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-[10px] font-mono">
                                      <span className="material-symbols-outlined text-[10px]">schedule</span>
                                      Faltam {daysRemaining} dias
                                    </div>
                                  )}
                                </>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  try {
                                    const newestMap = { ...parsed };
                                    delete newestMap[plate];
                                    localStorage.setItem('wealthflow_custom_ipva_dates', JSON.stringify(newestMap));
                                    // Trigger state refresh of parent vehicles to reflect month update
                                    if (setRegisteredVehicles) {
                                      setRegisteredVehicles(prev => [...prev]);
                                    }
                                    if (showAlert) {
                                      showAlert("Alerta Removido", `O alerta customizado para o veículo ${plate} foi removido com sucesso.`);
                                    }
                                  } catch (e) {
                                    console.error(e);
                                  }
                                }}
                                className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/5 transition-all cursor-pointer flex items-center justify-center"
                                title="Remover Alerta"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }
            }
          } catch (e) {}
          return null;
        })()}
      </section>

      {/* Resumo Consolidado da Frota */}
      {registeredVehicles.length > 0 && (
        <section className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-lg relative overflow-hidden animate-fade-in" id="fleet-summary-card">
          {/* Subtle Glow background */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-800/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/15 shrink-0">
                <span className="material-symbols-outlined text-lg">local_shipping</span>
              </div>
              <div>
                <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider">
                  Resumo Consolidado da Frota
                </h3>
                <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-0.5">
                  Status operacional e vencimento de documentação
                </p>
              </div>
            </div>
            
            {/* Quick Status Chips */}
            <div className="flex flex-wrap gap-1.5 font-mono text-[9px] font-bold">
              <span className="px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-400">
                TOTAL: {fleetSummary.totalCount}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-emerald-400">
                DISPONÍVEL: {fleetSummary.totalAvailable}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/5 border border-amber-500/10 text-amber-400">
                TRÂNSITO: {fleetSummary.totalTransit}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/5 border border-rose-500/10 text-rose-400">
                OFICINA: {fleetSummary.totalMaintenance}
              </span>
            </div>
          </div>

          {/* Fleet Vehicles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fleetSummary.vehicles.map((v) => {
              // Status Badge styling
              let statusBadgeClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
              let statusIcon = "check_circle";
              if (v.status === 'Em trânsito') {
                statusBadgeClass = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
                statusIcon = "schedule";
              } else if (v.status === 'Em manutenção') {
                statusBadgeClass = "bg-rose-500/10 text-rose-400 border border-rose-500/20";
                statusIcon = "build_circle";
              }

              // Licensing alerts
              let licAlertClass = "text-slate-400 bg-slate-900/50 border border-slate-800";
              let licAlertIcon = "verified_user";
              let licText = `Licenciamento em ${v.licensingMonthName} (Em dia)`;
              
              if (v.licensingStatus === 'ATRASADO') {
                licAlertClass = "text-rose-400 bg-rose-500/10 border border-rose-500/20 animate-pulse font-bold";
                licAlertIcon = "gavel";
                licText = `Licenciamento ATRASADO! Venceu em ${v.licensingDateStr}`;
              } else if (v.licensingStatus === 'URGENTE') {
                licAlertClass = "text-rose-400 bg-rose-500/10 border border-rose-500/20 animate-pulse font-bold";
                licAlertIcon = "warning";
                licText = `Licenciamento URGENTE: Vence dia ${v.licensingDateStr} (apenas ${v.daysRemainingLic} dias!)`;
              } else if (v.licensingStatus === 'ALERTA') {
                licAlertClass = "text-amber-400 bg-amber-500/10 border border-amber-500/20 font-semibold";
                licAlertIcon = "error_outline";
                licText = `Licenciamento próximo: Vence em ${v.licensingMonthName} (${v.daysRemainingLic} dias restantes)`;
              }

              return (
                <div 
                  key={`fleet-item-${v.id}`}
                  className={`p-4 rounded-xl flex flex-col justify-between gap-3 transition-all duration-300 ${
                    v.id === defaultVehicleId 
                      ? 'bg-indigo-950/10 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.05)]' 
                      : 'bg-slate-950/40 border border-slate-850 hover:border-slate-800'
                  }`}
                >
                  {/* Row 1: Vehicle Title, Plate & Operational Status */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center flex-wrap gap-1.5">
                        <span className="text-xs font-bold text-slate-200 tracking-wide uppercase font-sans">{v.descricao}</span>
                        {v.placa && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-slate-400 font-mono rounded font-semibold tracking-wider">
                            {v.placa}
                          </span>
                        )}
                        {v.id === defaultVehicleId && (
                          <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono rounded font-bold uppercase tracking-wider">
                            <span className="material-symbols-outlined text-[10px] font-bold">star</span>
                            Padrão
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        Motorista: <strong className="text-slate-300">{v.motorista || "Não Definido"}</strong>
                      </span>
                    </div>

                    <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider shrink-0 ${statusBadgeClass}`}>
                      <span className="material-symbols-outlined text-[12px] font-bold">{statusIcon}</span>
                      {v.status}
                    </span>
                  </div>

                  {/* Row 2: Licensing and IPVA document status */}
                  <div className="space-y-1.5 pt-1.5 border-t border-slate-900">
                    {/* Licensing */}
                    <div className={`flex items-center gap-2 p-2 rounded-lg text-[10px] ${licAlertClass}`}>
                      <span className="material-symbols-outlined text-xs shrink-0">{licAlertIcon}</span>
                      <span className="leading-tight truncate">{licText}</span>
                    </div>

                    {/* IPVA Alert Status */}
                    {v.ipvaAlert ? (
                      <div className="flex items-center gap-2 p-2 rounded-lg text-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold animate-pulse">
                        <span className="material-symbols-outlined text-xs shrink-0">payments</span>
                        <span className="leading-tight truncate">
                          IPVA {v.ipvaAlert.dueMonthName}: Vence em {v.ipvaAlert.daysRemaining} dias ({v.ipvaAlert.dueDateStr})
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-2 rounded-lg text-[10px] bg-emerald-500/5 border border-emerald-500/10 text-emerald-400">
                        <span className="material-symbols-outlined text-xs shrink-0">verified</span>
                        <span className="leading-tight truncate">IPVA {currentYear} Pago & Regularizado</span>
                      </div>
                    )}
                  </div>

                  {/* Row 3: Monthly KM Traveled */}
                  <div className="pt-2.5 border-t border-slate-900 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1 uppercase tracking-wider font-sans">
                        <span className="material-symbols-outlined text-[14px] text-sky-400">route</span>
                        Quilometragem Recente
                      </span>
                      <span className="text-[9px] font-mono font-semibold text-slate-500">
                        Total: {v.totalKmInPeriod.toLocaleString('pt-BR')} km
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {v.kmHistory.map((h: any) => {
                        // Max the bar representation at 1500 km
                        const percentage = Math.min((h.km / 1500) * 100, 100);
                        
                        return (
                          <div key={h.monthKey} className="flex items-center gap-2 text-[10px]">
                            <span className="text-slate-400 w-11 font-mono shrink-0">{h.label}</span>
                            <div className="flex-1 h-2 bg-slate-900 border border-slate-800 rounded overflow-hidden relative">
                              <div 
                                className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-r"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className={`w-14 text-right font-mono font-bold ${h.km > 0 ? 'text-slate-200' : 'text-slate-600'}`}>
                              {h.km > 0 ? `${h.km.toLocaleString('pt-BR')} km` : '0 km'}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Preventive maintenance alert */}
                    {v.isHighUsage ? (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 flex items-start gap-1.5 text-[9px] text-amber-400 font-sans mt-2">
                        <span className="material-symbols-outlined text-xs text-amber-500 shrink-0 font-bold">warning</span>
                        <span className="leading-normal">
                          <strong>Alta rodagem detectada (+{v.totalKmInPeriod.toLocaleString('pt-BR')} km recentes)</strong>. Verifique o desgaste de pneus, óleo e freios para manutenção preventiva.
                        </span>
                      </div>
                    ) : (
                      <div className="bg-slate-900/40 border border-slate-850/60 rounded-lg p-2 flex items-start gap-1.5 text-[9px] text-slate-500 font-sans mt-2">
                        <span className="material-symbols-outlined text-xs text-slate-400 shrink-0">info</span>
                        <span className="leading-normal">
                          Rodagem sob controle. Programar revisões regulares conforme cronograma.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Acompanhamento de Orçamento Mensal */}
      {(() => {
        const budgetsEntries = Object.entries(categoryBudgets || {}).filter(([_, limit]) => limit > 0);
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const monthName = today.toLocaleString('pt-BR', { month: 'long' });

        return (
          <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 animate-fade-in" id="monthly-budgets-panel">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="font-semibold text-white font-display flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400">donut_large</span> Orçamento Mensal por Categoria ({monthName})
                </h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-wider">Acompanhamento proporcional de 1/12 da meta anual</p>
              </div>
              <button
                onClick={() => onNavigate('profile')}
                className="text-[10px] bg-slate-950 border border-slate-850 hover:border-slate-800 hover:text-amber-400 text-slate-400 font-mono font-bold px-3 py-1.5 rounded-xl uppercase tracking-wider transition-all cursor-pointer"
              >
                Ajustar Metas <span className="material-symbols-outlined text-xs align-middle">settings</span>
              </button>
            </div>

            {budgetsEntries.length === 0 ? (
              <div className="bg-slate-950/40 border border-slate-850/60 p-5 rounded-xl text-center space-y-2.5">
                <p className="text-xs text-slate-400 italic font-sans">
                  Nenhuma meta de orçamento definida para as suas categorias.
                </p>
                <button
                  onClick={() => onNavigate('profile')}
                  className="inline-flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold px-3.5 py-2 rounded-xl border border-emerald-500/25 cursor-pointer transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-xs">add</span> Definir Metas no Perfil
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {budgetsEntries.map(([catName, annualLimit]) => {
                  const monthlyLimit = annualLimit / 12;
                  
                  // Calculate month expenditures in this category
                  const spentInCatThisMonth = transactions
                    .filter(t => {
                      const pDate = parseDate(t.data);
                      if (!pDate) return false;
                      const isCurrentMonthAndYear = pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear;
                      const isExpense = String(t.tipo || '').trim().toUpperCase() !== 'RECEITA' && String(t.tipo || '').trim().toUpperCase() !== 'RECEBIDO';
                      const matchesCategory = String(t.categoria || '').trim().toUpperCase() === String(catName).trim().toUpperCase();
                      return isCurrentMonthAndYear && isExpense && matchesCategory;
                    })
                    .reduce((sum, t) => sum + t.valor, 0);

                  const pct = monthlyLimit > 0 ? Math.round((spentInCatThisMonth / monthlyLimit) * 100) : 0;
                  const isExceeded = spentInCatThisMonth > monthlyLimit;
                  const isWarning = pct > 80 && pct <= 100;

                  let icon = 'category';
                  if (catName === 'ABASTECIMENTO') icon = 'local_gas_station';
                  else if (catName === 'CASA') icon = 'home';
                  else if (catName === 'CONSUMO') icon = 'shopping_cart';
                  else if (catName === 'LAZER') icon = 'sports_esports';
                  else if (catName === 'PESSOAL') icon = 'person';
                  else if (catName === 'TAXAS') icon = 'receipt_long';

                  return (
                    <div 
                      key={`month-budget-${catName}`} 
                      className="bg-slate-950/50 border border-slate-850/80 p-4 rounded-xl flex flex-col justify-between gap-3 hover:border-slate-800 transition-all duration-300"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center border text-[12px] ${
                            isExceeded 
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                              : isWarning 
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}>
                            <span className="material-symbols-outlined text-xs">{icon}</span>
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-200 uppercase font-mono tracking-wide">{catName}</span>
                            <div className="text-[9px] text-slate-500 font-mono">Meta Mensal</div>
                          </div>
                        </div>

                        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                          isExceeded 
                            ? 'bg-rose-500/15 text-rose-400 border-rose-500/20 animate-pulse' 
                            : isWarning 
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' 
                            : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {pct}% {isExceeded ? 'EXCEDIDO' : 'OK'}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-850/50">
                          <div 
                            style={{ width: `${Math.min(pct, 100)}%` }} 
                            className={`h-full rounded-full transition-all duration-500 ${
                              isExceeded 
                                ? 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' 
                                : isWarning 
                                ? 'bg-amber-500' 
                                : 'bg-emerald-500'
                            }`}
                          />
                        </div>

                        <div className="flex justify-between items-center text-[10px] font-mono pt-0.5">
                          <div className="flex flex-col">
                            <span className="text-[9px] text-slate-500 uppercase">Gasto</span>
                            <strong className={`${isExceeded ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'} ${hideValuesMode ? 'blur-[5px] select-none hover:blur-none transition-all duration-200 cursor-help' : 'transition-all duration-200'}`} title={hideValuesMode ? "Valor oculto (passe o mouse para revelar)" : undefined}>
                              {showBalance ? formatBRL(spentInCatThisMonth) : '••••••'}
                            </strong>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] text-slate-500 uppercase">Limite</span>
                            <strong className={`text-slate-300 ${hideValuesMode ? 'blur-[5px] select-none hover:blur-none transition-all duration-200 cursor-help' : 'transition-all duration-200'}`} title={hideValuesMode ? "Valor oculto (passe o mouse para revelar)" : undefined}>
                              {showBalance ? formatBRL(monthlyLimit) : '••••••'}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })()}

      {/* Acompanhamento de Orçamento Anual */}
      {(() => {
        const budgetsEntries = Object.entries(categoryBudgets || {}).filter(([_, limit]) => limit > 0);
        const currentYear = new Date().getFullYear();
        
        const getTransactionYear = (dateStr: string): number => {
          if (!dateStr) return 0;
          if (dateStr.includes('-')) {
            return parseInt(dateStr.split('-')[0], 10);
          } else if (dateStr.includes('/')) {
            return parseInt(dateStr.split('/')[2], 10);
          }
          return 0;
        };

        return (
          <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 animate-fade-in" id="annual-budgets-panel">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="font-semibold text-white font-display flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400">payments</span> Orçamento e Metas Anuais ({currentYear})
                </h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-wider">Acompanhamento de gastos em relação às metas estabelecidas</p>
              </div>
              <button
                onClick={() => onNavigate('profile')}
                className="text-[10px] bg-slate-950 border border-slate-850 hover:border-slate-800 hover:text-emerald-400 text-slate-400 font-mono font-bold px-3 py-1.5 rounded-xl uppercase tracking-wider transition-all cursor-pointer"
              >
                Configurar Metas <span className="material-symbols-outlined text-xs align-middle">settings</span>
              </button>
            </div>

            {budgetsEntries.length === 0 ? (
              <div className="bg-slate-950/40 border border-slate-850/60 p-5 rounded-xl text-center space-y-2.5">
                <p className="text-xs text-slate-400 italic font-sans">
                  Nenhuma meta de orçamento definida para este ano.
                </p>
                <button
                  onClick={() => onNavigate('profile')}
                  className="inline-flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold px-3.5 py-2 rounded-xl border border-emerald-500/25 cursor-pointer transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-xs">add</span> Definir Metas no Perfil
                </button>
              </div>
            ) : (() => {
              const totalAnnualBudget = budgetsEntries.reduce((sum, [_, limit]) => sum + limit, 0);
              
              const totalSpentInBudgetedCategories = transactions
                .filter(t => {
                  const txYear = getTransactionYear(t.data);
                  const isCurrentYear = txYear === currentYear;
                  const isExpense = String(t.tipo || '').trim().toUpperCase() !== 'RECEITA' && String(t.tipo || '').trim().toUpperCase() !== 'RECEBIDO';
                  const matchesCategory = budgetsEntries.some(([catName]) => String(t.categoria || '').trim().toUpperCase() === String(catName).trim().toUpperCase());
                  return isCurrentYear && isExpense && matchesCategory;
                })
                .reduce((sum, t) => sum + t.valor, 0);

              const totalPctRaw = totalAnnualBudget > 0 ? (totalSpentInBudgetedCategories / totalAnnualBudget) * 100 : 0;
              const totalPctRounded = Math.round(totalPctRaw);
              const isTotalExceeded90 = totalPctRaw > 90;

              // SVG Circle properties
              const radius = 46;
              const strokeWidth = 8;
              const circumference = 2 * Math.PI * radius; // ~289.03
              const strokeDashoffset = circumference - (Math.min(totalPctRaw, 100) / 100) * circumference;

              return (
                <div className="flex flex-col lg:flex-row gap-5 items-center lg:items-stretch">
                  {/* Left Column: Consolidate Doughnut Chart */}
                  <div className="w-full lg:w-[260px] bg-slate-950/50 border border-slate-850/65 p-4 rounded-xl flex flex-col items-center justify-center shrink-0 text-center relative overflow-hidden">
                    {/* Ambient Glow behind SVG */}
                    <div className={`absolute inset-6 rounded-full blur-2xl pointer-events-none opacity-20 transition-all duration-700 ${
                      isTotalExceeded90 ? 'bg-rose-500 scale-125' : 'bg-emerald-500'
                    }`} />
                    
                    <div className="relative w-32 h-32 flex items-center justify-center z-10">
                      {/* SVG Circle Progress */}
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 110 110">
                        {/* Background segment */}
                        <circle
                          cx="55"
                          cy="55"
                          r={radius}
                          className="stroke-slate-900"
                          strokeWidth={strokeWidth}
                          fill="transparent"
                        />
                        {/* Foreground Segment */}
                        <circle
                          cx="55"
                          cy="55"
                          r={radius}
                          className={`transition-all duration-1000 ease-out ${
                            isTotalExceeded90 
                              ? 'stroke-rose-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.6)]' 
                              : 'stroke-emerald-500 drop-shadow-[0_0_4px_rgba(16,185,129,0.3)]'
                          }`}
                          strokeWidth={strokeWidth}
                          fill="transparent"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                        />
                      </svg>
                      
                      {/* Central label */}
                      <div className="absolute flex flex-col items-center justify-center">
                        <span className={`text-2xl font-bold font-display ${isTotalExceeded90 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {totalPctRounded}%
                        </span>
                        <span className="text-[8px] text-slate-500 uppercase tracking-widest font-mono font-semibold">Consolidado</span>
                      </div>
                    </div>

                    <div className="w-full space-y-2 mt-2 z-10">
                      <div className="flex justify-between items-center text-[10px] font-mono border-b border-slate-900/60 pb-1.5">
                        <span className="text-slate-500 uppercase">Utilizado</span>
                        <span className={`font-bold ${isTotalExceeded90 ? 'text-rose-400 font-bold' : 'text-slate-200'}`}>{formatBRL(totalSpentInBudgetedCategories)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono border-b border-slate-900/60 pb-1.5">
                        <span className="text-slate-500 uppercase">Meta Total</span>
                        <span className="text-slate-300 font-bold">{formatBRL(totalAnnualBudget)}</span>
                      </div>
                      
                      <div className="pt-1 flex justify-center">
                        {isTotalExceeded90 ? (
                          <span className="text-[9px] text-rose-400 font-bold font-mono px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 animate-pulse uppercase tracking-wider flex items-center gap-1">
                            <span className="material-symbols-outlined text-[11px]">warning</span> Alerta &gt; 90%
                          </span>
                        ) : (
                          <span className="text-[9px] text-emerald-400 font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/10 uppercase tracking-wider flex items-center gap-1">
                            <span className="material-symbols-outlined text-[11px]">check_circle</span> Limite Seguro
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Categories List */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {budgetsEntries.map(([catName, targetLimit]) => {
                      const spentInCat = transactions
                        .filter(t => {
                          const txYear = getTransactionYear(t.data);
                          const isCurrentYear = txYear === currentYear;
                          const isExpense = String(t.tipo || '').trim().toUpperCase() !== 'RECEITA' && String(t.tipo || '').trim().toUpperCase() !== 'RECEBIDO';
                          const matchesCategory = String(t.categoria || '').trim().toUpperCase() === String(catName).trim().toUpperCase();
                          return isCurrentYear && isExpense && matchesCategory;
                        })
                        .reduce((sum, t) => sum + t.valor, 0);

                      const pct = targetLimit > 0 ? Math.round((spentInCat / targetLimit) * 100) : 0;
                      const isExceeded = spentInCat > targetLimit;

                      let icon = 'category';
                      if (catName === 'ABASTECIMENTO') icon = 'local_gas_station';
                      else if (catName === 'CASA') icon = 'home';
                      else if (catName === 'CONSUMO') icon = 'shopping_cart';
                      else if (catName === 'LAZER') icon = 'sports_esports';
                      else if (catName === 'PESSOAL') icon = 'person';
                      else if (catName === 'TAXAS') icon = 'receipt_long';

                      return (
                        <div key={catName} className="bg-slate-950/60 border border-slate-850/75 p-3.5 rounded-xl space-y-3 hover:border-slate-800 transition-all flex flex-col justify-between">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-md flex items-center justify-center border text-[11px] font-mono font-bold ${
                                isExceeded ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-slate-900 text-emerald-400 border-slate-800'
                              }`}>
                                <span className="material-symbols-outlined text-xs">{icon}</span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-200 uppercase font-mono tracking-wide">{catName}</span>
                            </div>
                            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                              isExceeded ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10'
                            }`}>
                              {pct}% {isExceeded ? 'EXCEDIDO' : 'UTILIZADO'}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-mono">
                              <span className="text-slate-500">Utilizado: <strong className={isExceeded ? "text-rose-400" : "text-emerald-400"}>{formatBRL(spentInCat)}</strong></span>
                              <span className="text-slate-400">Meta: <strong>{formatBRL(targetLimit)}</strong></span>
                            </div>
                            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-850">
                              <div 
                                style={{ width: `${Math.min(pct, 100)}%` }} 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isExceeded ? 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-emerald-500'
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </section>
        );
      })()}

      {/* Contas e Cartões Cadastrados */}
      <section className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl space-y-4" id="bank-balances-panel">
        <div className="flex justify-between items-start gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="material-symbols-outlined text-lg">payments</span>
              <h3 className="font-bold text-white font-display text-base">Contas Bancárias &amp; Cartões</h3>
            </div>
            <p className="text-[11px] text-slate-400">
              Acompanhe o saldo total atualizado e o limite disponível de seus cartões e contas cadastradas.
            </p>
          </div>
          <button
            onClick={() => onNavigate('profile')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-all cursor-pointer font-sans shrink-0"
          >
            <span className="material-symbols-outlined text-sm">edit_square</span>
            Gerenciar
          </button>
        </div>

        {/* Bank Accounts Grid */}
        <div className="space-y-2.5">
          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contas Correntes</span>
          <div className="grid grid-cols-2 gap-3">
            {bankAccounts.map((acc) => {
              const isNegative = acc.saldoInicial < 0;
              return (
                <div 
                  key={acc.id}
                  className={`bg-slate-950 border p-3.5 rounded-xl flex flex-col justify-between gap-3 transition-all duration-300 ${isNegative ? 'border-rose-950 hover:border-rose-900/30' : 'border-slate-850 hover:border-emerald-500/20'}`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">{acc.nome}</span>
                    <div className={`w-6 h-6 rounded-lg text-xs flex items-center justify-center border ${isNegative ? 'bg-rose-950/20 border-rose-900/40 text-rose-400' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                      <span className="material-symbols-outlined text-xs">account_balance</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase font-mono">
                      {isNegative ? 'Valor Devedor' : 'Saldo Disponível'}
                    </span>
                    <p className={`text-sm font-bold font-mono mt-0.5 ${isNegative ? 'text-rose-400' : 'text-emerald-400'} ${hideValuesMode ? 'blur-[5px] select-none hover:blur-none transition-all duration-200 cursor-help' : 'transition-all duration-200'}`} title={hideValuesMode ? "Valor oculto (passe o mouse para revelar)" : undefined}>
                      {showBalance ? (isNegative ? formatBRL(Math.abs(acc.saldoInicial)) : formatBRL(acc.saldoInicial)) : '••••••'}
                    </p>
                    {acc.limite !== undefined && acc.limite > 0 && showBalance && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-900 flex justify-between items-center text-[9px] font-mono text-slate-400">
                        <span>{isNegative ? 'Lim. Restante:' : 'Lim. Especial:'}</span>
                        <span className={`font-semibold ${isNegative ? 'text-amber-400' : 'text-slate-300'} ${hideValuesMode ? 'blur-[5px] select-none hover:blur-none transition-all duration-200 cursor-help' : 'transition-all duration-200'}`} title={hideValuesMode ? "Valor oculto (passe o mouse para revelar)" : undefined}>
                          {formatBRL(isNegative ? Math.max(0, acc.limite + acc.saldoInicial) : acc.limite)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Credit Cards list with progress bars */}
        <div className="space-y-2.5 pt-1">
          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cartões de Crédito</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {creditCards.map((card) => {
              const spentPercent = Math.min(100, Math.round((card.gasto / card.limite) * 100));
              return (
                <div 
                  key={card.id}
                  className="bg-slate-950 border border-slate-800/80 p-3.5 rounded-xl flex flex-col gap-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">{card.nome}</span>
                      <p className="text-[9px] text-slate-500 font-mono mt-0.5">Vence em breves dias</p>
                    </div>
                    <div className="w-6 h-6 rounded-lg bg-slate-900 text-slate-500 flex items-center justify-center border border-slate-800">
                      <span className="material-symbols-outlined text-xs">credit_card</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-slate-400">Gasto: <strong className={`text-slate-200 ${hideValuesMode ? 'blur-[5px] select-none hover:blur-none transition-all duration-200 cursor-help' : 'transition-all duration-200'}`} title={hideValuesMode ? "Valor oculto (passe o mouse para revelar)" : undefined}>{showBalance ? formatBRL(card.gasto) : '••••••'}</strong></span>
                      <span className="text-slate-500">Lim: <span className={hideValuesMode ? 'blur-[5px] select-none hover:blur-none transition-all duration-200 cursor-help' : 'transition-all duration-200'} title={hideValuesMode ? "Valor oculto (passe o mouse para revelar)" : undefined}>{showBalance ? formatBRL(card.limite) : '••••••'}</span></span>
                    </div>
                    {/* High-fidelity progress bar */}
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-850">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${spentPercent > 80 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        style={{ width: `${spentPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 🏦 Painel de Integração e Simulação Bancária */}
      <section className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl space-y-4 animate-fade-in" id="bank-integration-panel">
        <div className="flex items-center gap-1.5 text-amber-400">
          <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
          <h3 className="font-bold text-white font-display text-base">Integração Bancária em Tempo Real</h3>
        </div>
        <p className="text-[11px] text-slate-400">
          Simule a chegada de uma nova notificação do seu banco em tempo real (via webhook). O aplicativo irá interceptá-la e perguntar como deseja importá-la.
        </p>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Banco Selector */}
            <div className="space-y-1">
              <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Selecione o Banco</label>
              <select
                value={selectedSimAccount?.id || bankAccounts[0]?.id || 1}
                onChange={(e) => {
                  const id = parseInt(e.target.value, 10);
                  const bank = bankAccounts.find(b => b.id === id) || null;
                  setSelectedSimAccount(bank);
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-amber-500"
              >
                {bankAccounts.map(b => (
                  <option key={b.id} value={b.id}>{b.nome}</option>
                ))}
              </select>
            </div>

            {/* Valor Input */}
            <div className="space-y-1">
              <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Valor da Transação (R$)</label>
              <input
                type="text"
                value={simValue || ''}
                onChange={(e) => setSimValue(e.target.value)}
                placeholder="Ex: 150,00"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-amber-500 font-mono"
              />
            </div>

            {/* Descrição Input */}
            <div className="space-y-1">
              <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Descrição da Transação</label>
              <input
                type="text"
                value={simDesc || ''}
                onChange={(e) => setSimDesc(e.target.value)}
                placeholder="Ex: Almoço Restaurante"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-900">
            {/* Presets */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">Presets de Teste:</span>
              <button
                type="button"
                onClick={() => {
                  setSimValue('420,00');
                  setSimDesc('Combustível Semanal Posto Ipiranga');
                }}
                className="bg-slate-900 hover:bg-slate-850 text-slate-300 text-[10px] px-2 py-1 rounded border border-slate-800 hover:border-slate-700 font-medium cursor-pointer"
              >
                ⛽ Combustível
              </button>
              <button
                type="button"
                onClick={() => {
                  setSimValue('125,90');
                  setSimDesc('Supermercado Extra Campinas');
                }}
                className="bg-slate-900 hover:bg-slate-850 text-slate-300 text-[10px] px-2 py-1 rounded border border-slate-800 hover:border-slate-700 font-medium cursor-pointer"
              >
                🛒 Mercado
              </button>
              <button
                type="button"
                onClick={() => {
                  setSimValue('3.500,00');
                  setSimDesc('Transferência Recebida - Salário Mensal');
                }}
                className="bg-slate-900 hover:bg-slate-850 text-slate-300 text-[10px] px-2 py-1 rounded border border-slate-800 hover:border-slate-700 font-medium cursor-pointer"
              >
                💰 Salário
              </button>
              <button
                type="button"
                onClick={() => {
                  setSimValue('1,00');
                  setSimDesc('Transferência Itaú Pix');
                  const itauBank = bankAccounts.find(b => b.nome.toUpperCase().includes('ITAU'));
                  if (itauBank) {
                    setSelectedSimAccount(itauBank);
                  }
                }}
                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[10px] px-2 py-1 rounded border border-amber-500/30 hover:border-amber-500/50 font-semibold cursor-pointer transition-all"
              >
                🔄 Itaú ➔ Nubank (R$ 1,00)
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const finalBankId = selectedSimAccount?.id || bankAccounts[0]?.id || 1;
                const cleanValue = (simValue || '150,00').replace(/\./g, '').replace(',', '.');
                const parsedVal = parseFloat(cleanValue);
                if (isNaN(parsedVal) || parsedVal <= 0) {
                  if (showAlert) showAlert('Valor Inválido', 'Por favor, insira um valor numérico válido.');
                  return;
                }
                if (onTriggerBankIntegration) {
                  onTriggerBankIntegration(finalBankId, parsedVal, simDesc || 'Transação de Teste');
                }
              }}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-450 text-slate-950 font-bold text-xs uppercase cursor-pointer active:scale-95 transition-all shadow-md shadow-amber-500/10 shrink-0 font-mono"
            >
              <span className="material-symbols-outlined text-sm font-bold">cell_tower</span>
              Simular Webhook Pix
            </button>
          </div>
        </div>

        {/* Real-time Webhook Configuration Section */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">Integração Automática Real (Ouvinte Ativo)</h4>
            </div>
            <button
              type="button"
              onClick={() => setShowRealIntegrationGuide(!showRealIntegrationGuide)}
              className="text-[10px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
            >
              {showRealIntegrationGuide ? "Ocultar Tutorial" : "Como conectar Nubank/Itaú?"}
            </button>
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed">
            Seu aplicativo possui um endpoint de webhook ativo capaz de escutar transações bancárias reais em tempo real. Copie a URL abaixo e configure no seu celular para que transações reais se conectem automaticamente!
          </p>

          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2">
            <span className="material-symbols-outlined text-slate-500 text-sm font-mono shrink-0">link</span>
            <input
              type="text"
              readOnly
              value={`${window.location.origin}/api/webhooks/bank`}
              className="w-full bg-transparent text-[10px] text-slate-300 font-mono outline-none border-none"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/bank`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
                if (showAlert) {
                  showAlert("Copiado!", "Endereço de Webhook copiado com sucesso! Configure seu aplicativo de automação celular.");
                }
              }}
              className="px-2.5 py-1 text-[10px] font-bold uppercase rounded bg-slate-800 text-slate-200 hover:bg-slate-750 shrink-0 cursor-pointer transition-colors"
            >
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>

          {showRealIntegrationGuide && (
            <div className="space-y-3 text-[10.5px] text-slate-300 border-t border-slate-900 pt-3 animate-fade-in">
              <p className="font-bold text-amber-400">📲 Como automatizar no Android com MacroDroid (Gratuito):</p>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-400 font-sans">
                <li>Instale o <strong>MacroDroid</strong> na Google Play Store.</li>
                <li>Crie uma nova Macro com o nome <strong>"Notificação Pix WealthFlow"</strong>.</li>
                <li><strong>Gatilho (Trigger):</strong> Selecione <strong>Notificação ➔ Notificação Recebida</strong>. Escolha seus aplicativos bancários (Ex: Nubank, Itaú).</li>
                <li><strong>Ação (Action):</strong> Selecione <strong>Conectividade ➔ Requisição HTTP (POST)</strong>.</li>
                <li>No campo <strong>URL</strong>, cole o link copiado acima.</li>
                <li>Configure o corpo da requisição em <strong>JSON</strong> com a opção <strong>Parâmetros de texto</strong> ou <strong>Raw Body</strong> contendo:
                  <pre className="bg-slate-900 p-2 rounded-lg text-[9.5px] text-amber-300/90 font-mono mt-1 overflow-x-auto select-all">
{`{
  "text": "{not_body}",
  "banco": "Nubank"
}`}
                  </pre>
                  <span className="text-[9px] text-slate-500">Substitua <code className="text-slate-400">"{`{not_body}`}"</code> pela variável de conteúdo da notificação do MacroDroid e configure o nome correto do banco correspondente.</span>
                </li>
                <li>Salve a Macro. Pronto! Quando você receber um Pix real, seu celular disparará o alerta e o aplicativo perguntará instantaneamente no seu monitor o que deseja fazer!</li>
              </ol>
            </div>
          )}
        </div>
      </section>

      {/* Calendar Commitments Alert Banners (Active warning range, customizable color & blinking) */}
      {compromissos.filter(c => {
        if (!c.lembreteAtivo) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [year, month, day] = c.data.split('-').map(Number);
        const compDate = new Date(year, month - 1, day);
        compDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((compDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= c.diasAntecedencia;
      }).map(c => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [year, month, day] = c.data.split('-').map(Number);
        const compDate = new Date(year, month - 1, day);
        compDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((compDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        let countdownText = '';
        if (diffDays === 0) {
          countdownText = 'Hoje!';
        } else if (diffDays === 1) {
          countdownText = 'Amanhã!';
        } else {
          countdownText = `em ${diffDays} dias`;
        }

        let dateFormatted = c.data;
        try {
          const [y, m, d] = c.data.split('-');
          dateFormatted = `${d}/${m}/${y}`;
        } catch (e) {}

        const colorHex = c.cor || '#22c55e';
        const isPulsing = c.piscando !== false;

        return (
          <section 
            key={c.id} 
            className="px-4 py-3.5 rounded-xl flex items-center gap-3.5 shadow-lg cursor-pointer transition-all border-l-4 hover:bg-slate-900/40 border-slate-800"
            style={{
              backgroundColor: `${colorHex}10`, // 6% opacity
              borderColor: `${colorHex}44`, // 25% opacity
              borderLeftColor: colorHex
            }}
            id={`comp-alert-banner-${c.id}`}
            onClick={() => onNavigate('compromissos')}
          >
            <div 
              className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full`}
              style={{
                backgroundColor: `${colorHex}22`,
                color: colorHex,
                animation: isPulsing ? 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
              }}
            >
              <span className="material-symbols-outlined text-lg">event_upcoming</span>
            </div>
            <div className="flex-grow text-xs sm:text-sm min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold truncate text-white" style={{ color: colorHex }}>{c.titulo}</p>
                <span 
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
                  style={{
                    backgroundColor: `${colorHex}25`,
                    color: colorHex
                  }}
                >
                  {countdownText}
                </span>
              </div>
              <p className="text-slate-300 mt-0.5 text-xs line-clamp-2">
                Compromisso agendado para o dia <span className="font-semibold text-white">{dateFormatted}</span>{c.hora ? ` às ${c.hora}` : ''}.
                {c.descricao && <span className="text-slate-400 block mt-0.5 text-[11px] truncate">{c.descricao}</span>}
              </p>
            </div>
          </section>
        );
      })}

      {/* Medical Appointments Alert Banners */}
      {appointments.filter(appt => {
        if (appt.status !== 'Agendada' || !appt.lembreteAtivo) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [year, month, day] = appt.data.split('-').map(Number);
        const apptDate = new Date(year, month - 1, day);
        apptDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((apptDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= medicalAppointmentLeadDays;
      }).map(appt => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [year, month, day] = appt.data.split('-').map(Number);
        const apptDate = new Date(year, month - 1, day);
        apptDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((apptDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        let countdownText = '';
        if (diffDays === 0) {
          countdownText = 'Hoje!';
        } else if (diffDays === 1) {
          countdownText = 'Amanhã!';
        } else {
          countdownText = `em ${diffDays} dias`;
        }

        let dateFormatted = appt.data;
        try {
          const [y, m, d] = appt.data.split('-');
          dateFormatted = `${d}/${m}/${y}`;
        } catch (e) {}
        
        return (
          <section 
            key={appt.id} 
            className="bg-amber-950/20 border border-amber-500/40 px-4 py-3.5 rounded-xl flex items-center gap-3.5 shadow-lg shadow-amber-500/5 cursor-pointer hover:bg-amber-950/30 transition-all border-l-4 border-l-amber-500"
            id={`med-alert-banner-${appt.id}`}
            onClick={() => onNavigate('medical')}
          >
            <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-amber-500/10 text-amber-400 rounded-full animate-bounce">
              <span className="material-symbols-outlined text-lg">notifications_active</span>
            </div>
            <div className="flex-grow text-xs sm:text-sm min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-amber-400 truncate">Lembrete de Consulta</p>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0">
                  {countdownText}
                </span>
              </div>
              <p className="text-slate-300 mt-0.5 text-xs line-clamp-2">
                Sua consulta de <span className="font-semibold text-white">{appt.especialidade}</span> com <span className="font-semibold text-white">{appt.medico}</span> é dia <span className="font-semibold text-white">{dateFormatted}</span> às <span className="font-semibold text-white">{appt.hora}</span> no <span className="font-semibold text-white">{appt.local}</span>.
              </p>
            </div>
          </section>
        );
      })}

      {/* Prescriptions Expiration Alerts (Vence em 1 mês ou menos) */}
      {prescriptions.filter(presc => {
        if (presc.status === 'Baixada') return false;
        if (!presc.dataVencimento) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [year, month, day] = presc.dataVencimento.split('-').map(Number);
        const vencDate = new Date(year, month - 1, day);
        vencDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((vencDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 30; // Alert if expires in 30 days or less (including already expired)
      }).map(presc => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [year, month, day] = presc.dataVencimento!.split('-').map(Number);
        const vencDate = new Date(year, month - 1, day);
        vencDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((vencDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let alertTitle = 'Receita Próxima do Vencimento';
        let alertStyle = 'bg-amber-950/20 border-amber-500/40 border-l-amber-500 shadow-amber-500/5';
        let textStyle = 'text-amber-400';
        let badgeStyle = 'bg-amber-500/20 text-amber-300';
        let iconStyle = 'text-amber-400';
        let badgeText = '';

        if (diffDays < 0) {
          alertTitle = 'Receita Médica Expirada!';
          alertStyle = 'bg-rose-950/20 border-rose-500/40 border-l-rose-500 shadow-rose-500/5';
          textStyle = 'text-rose-400';
          badgeStyle = 'bg-rose-500/20 text-rose-300';
          iconStyle = 'text-rose-400';
          badgeText = `Vencida há ${Math.abs(diffDays)} dias`;
        } else if (diffDays === 0) {
          badgeText = 'Vence Hoje!';
          alertStyle = 'bg-rose-950/20 border-rose-500/40 border-l-rose-500 shadow-rose-500/5';
          textStyle = 'text-rose-400';
          badgeStyle = 'bg-rose-500/20 text-rose-300';
        } else {
          badgeText = `Vence em ${diffDays} dias`;
        }

        let dateFormatted = presc.dataVencimento!;
        try {
          const [y, m, d] = presc.dataVencimento!.split('-');
          dateFormatted = `${d}/${m}/${y}`;
        } catch (e) {}

        const medsSummary = presc.medicamentos.length > 55 
          ? presc.medicamentos.substring(0, 55) + '...' 
          : presc.medicamentos;

        return (
          <section 
            key={presc.id} 
            className={`border px-4 py-3.5 rounded-xl flex items-center gap-3.5 shadow-lg cursor-pointer hover:bg-slate-900/60 transition-all border-l-4 ${alertStyle}`}
            id={`presc-alert-banner-${presc.id}`}
            onClick={() => onNavigate('medical')}
          >
            <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center bg-slate-900 rounded-full border border-slate-800 ${iconStyle}`}>
              <span className="material-symbols-outlined text-lg">prescriptions</span>
            </div>
            <div className="flex-grow text-xs sm:text-sm min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={`font-semibold ${textStyle} truncate`}>{alertTitle}</p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0 ${badgeStyle}`}>
                  {badgeText}
                </span>
              </div>
              <p className="text-slate-300 mt-0.5 text-xs line-clamp-2">
                Sua receita de <span className="font-semibold text-white">{presc.especialidade}</span> do <span className="font-semibold text-white">{presc.medico}</span> ({medsSummary}) vence em <span className="font-semibold text-white">{dateFormatted}</span>.
              </p>
            </div>
          </section>
        );
      })}

      {/* Despesas Pendentes / Atrasadas */}
      {pendingOrOverdueExpenses.length > 0 && (
        <section className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl space-y-4" id="overdue-expenses-section">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-rose-400">
              <span className="material-symbols-outlined text-lg">error_outline</span>
              <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider">Despesas Pendentes &amp; Atrasadas</h3>
            </div>
            <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold px-2 py-0.5 rounded-full font-mono">
              {pendingOrOverdueExpenses.length} {pendingOrOverdueExpenses.length === 1 ? 'pendente' : 'pendentes'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingOrOverdueExpenses.map(tx => {
              const isOverdue = tx.status?.toUpperCase() === 'ATRASADO';
              
              return (
                <div 
                  key={tx.id}
                  className={`relative overflow-hidden border p-3.5 rounded-xl flex items-center justify-between gap-4 transition-all ${
                    isOverdue 
                      ? 'bg-rose-950/10 border-rose-500/30' 
                      : 'bg-slate-950 border-slate-850'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                      isOverdue 
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}>
                      <span className="material-symbols-outlined text-lg">
                        {getCategoryIcon(tx.categoria)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] bg-slate-900 text-slate-400 font-mono px-1 py-0.2 rounded border border-slate-800">#{tx.id}</span>
                        <h4 className="text-xs font-bold text-white truncate max-w-[130px] uppercase">
                          {tx.descricao}
                        </h4>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Vence: {tx.data} • {tx.categoria}
                      </p>
                      {isOverdue ? (
                        <span className="inline-block mt-1 text-[9px] bg-rose-500/20 text-rose-300 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                          Atrasado
                        </span>
                      ) : (
                        <span className="inline-block mt-1 text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                          Pendente
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="text-right">
                      <p className="text-xs font-bold font-mono text-rose-400">
                        - {formatBRL(tx.valor)}
                      </p>
                    </div>

                    {onEditTransaction && (
                      <button
                        onClick={() => {
                          onEditTransaction(tx.id, { 
                            status: 'PAGO', 
                            valorPg: tx.valor, 
                            dataPagamento: new Date().toLocaleDateString('pt-BR') 
                          });
                        }}
                        className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 rounded-lg transition-all cursor-pointer border border-emerald-500/20 flex items-center justify-center"
                        title="Dar Baixa (Marcar como Pago)"
                      >
                        <span className="material-symbols-outlined text-xs font-bold">check</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Spending Warnings if budget exceeded */}
      <section className="bg-amber-950/20 border border-amber-500/20 px-4 py-3.5 rounded-xl flex items-center gap-3.5" id="alert-banner">
        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-amber-500/10 text-amber-400 rounded-full">
          <span className="material-symbols-outlined">warning</span>
        </div>
        <div className="flex-grow text-xs sm:text-sm">
          <p className="font-semibold text-amber-400">Alerta de Gastos da Frota</p>
          <p className="text-slate-300">
            O orçamento de <span className="font-semibold text-white">Abastecimento</span> está em <span className="text-amber-300 font-bold">92%</span> do limite mensal planejado para o veículo FOX.
          </p>
        </div>
      </section>

      {/* Quick Stats Grid */}
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex justify-between items-start">
            <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <span className="material-symbols-outlined text-lg">trending_up</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded">+8.2%</span>
          </div>
          <div>
            <p className="text-[11px] text-slate-400 uppercase tracking-wider">Receitas (Junho)</p>
            <p className="text-lg font-bold text-white font-display">R$ 2.845,70</p>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex justify-between items-start">
            <div className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg">
              <span className="material-symbols-outlined text-lg">trending_down</span>
            </div>
            <span className="text-[10px] font-bold text-rose-400 font-mono bg-rose-500/10 px-1.5 py-0.5 rounded">-14.5%</span>
          </div>
          <div>
            <p className="text-[11px] text-slate-400 uppercase tracking-wider">Despesas (Junho)</p>
            <p className="text-lg font-bold text-white font-display">R$ 2.464,12</p>
          </div>
        </div>
      </section>

      {/* Monthly Balance Comparison Chart (Last 6 Months Receitas vs Despesas) */}
      <section className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl space-y-5" id="monthly-comparison-chart">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-semibold text-white font-display">Fluxo de Caixa Mensal (6 Meses)</h3>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-wider">Comparativo de Receitas vs Despesas nos últimos 6 meses</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
              <span className="text-slate-400 font-mono text-[10px] uppercase">Receitas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-rose-500" />
              <span className="text-slate-400 font-mono text-[10px] uppercase">Despesas</span>
            </div>
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          <RechartsResponsiveContainer width="100%" height="100%">
            <RechartsBarChart
              data={last6MonthsData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <RechartsCartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <RechartsXAxis 
                dataKey="label" 
                stroke="#64748b" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
              />
              <RechartsYAxis 
                stroke="#64748b" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(value) => hideValuesMode ? "••••" : `R$ ${value}`}
              />
              <RechartsTooltip content={<CustomTooltip hideValuesMode={hideValuesMode} />} />
              <RechartsBar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} />
              <RechartsBar dataKey="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </RechartsBarChart>
          </RechartsResponsiveContainer>
        </div>
      </section>

      {/* Evolução Mensal do Ano Corrente Chart */}
      <section className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl space-y-5" id="current-year-evolution-chart">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-semibold text-white font-display flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400">bar_chart</span>
              Evolução Mensal do Ano Corrente ({referenceDate.getFullYear()})
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-wider">Desempenho mensal consolidado de receitas e despesas</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
              <span className="text-slate-400 font-mono text-[10px] uppercase">Receitas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-rose-500" />
              <span className="text-slate-400 font-mono text-[10px] uppercase">Despesas</span>
            </div>
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          <RechartsResponsiveContainer width="100%" height="100%">
            <RechartsBarChart
              data={currentYearMonthsData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <RechartsCartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <RechartsXAxis 
                dataKey="label" 
                stroke="#64748b" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
              />
              <RechartsYAxis 
                stroke="#64748b" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(value) => hideValuesMode ? "••••" : `R$ ${value}`}
              />
              <RechartsTooltip content={<CustomTooltip hideValuesMode={hideValuesMode} />} />
              <RechartsBar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={16} />
              <RechartsBar dataKey="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={16} />
            </RechartsBarChart>
          </RechartsResponsiveContainer>
        </div>
      </section>

      {/* Metas de Economia (Savings Goals) Module */}
      <section className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl space-y-5 animate-fade-in" id="savings-goals-section">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white font-display text-base flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400">savings</span>
              Metas de Economia
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Planeje seus objetivos financeiros de médio e longo prazo</p>
          </div>
          
          <button
            onClick={() => {
              setEditingGoal(null);
              setGoalName('');
              setGoalTarget('');
              setGoalCurrent('');
              setGoalDeadline('');
              setGoalCategory('Segurança');
              setGoalDesc('');
              setIsOpenGoalModal(true);
            }}
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/10 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] font-bold">add</span>
            Criar Nova Meta
          </button>
        </div>

        {savingsGoals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-950/20 border border-slate-850/40 p-5 rounded-xl">
            <span className="material-symbols-outlined text-slate-500 text-4xl">savings</span>
            <p className="text-xs text-slate-300 font-medium mt-3">Nenhuma meta de economia criada.</p>
            <p className="text-[10px] text-slate-500 max-w-sm mt-1">
              Defina objetivos como Reserva de Emergência, Viagens, Estudos ou Bens de Consumo para acompanhar seu progresso de poupança!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savingsGoals.map(goal => {
              const pct = goal.valorAlvo > 0 ? Math.min(100, Math.round((goal.valorAtual / goal.valorAlvo) * 100)) : 0;
              
              // Get category icon
              let iconName = 'savings';
              if (goal.categoria === 'Segurança') iconName = 'security';
              else if (goal.categoria === 'Viagem') iconName = 'flight';
              else if (goal.categoria === 'Investimento') iconName = 'trending_up';
              else if (goal.categoria === 'Veículo') iconName = 'directions_car';
              else if (goal.categoria === 'Estudos') iconName = 'school';
              else if (goal.categoria === 'Casa') iconName = 'home';

              // Decide progress colors
              let barColorClass = 'bg-emerald-500';
              let glowColorClass = 'shadow-[0_0_10px_rgba(16,185,129,0.2)]';
              if (pct < 30) {
                barColorClass = 'bg-blue-500';
                glowColorClass = 'shadow-[0_0_10px_rgba(59,130,246,0.2)]';
              } else if (pct < 70) {
                barColorClass = 'bg-teal-500';
                glowColorClass = 'shadow-[0_0_10px_rgba(20,184,166,0.2)]';
              }

              // Format date
              let dateText = '';
              if (goal.prazo) {
                try {
                  const [y, m, d] = goal.prazo.split('-');
                  dateText = `Até ${d}/${m}/${y}`;
                } catch (e) {
                  dateText = goal.prazo;
                }
              }

              return (
                <div 
                  key={goal.id} 
                  className="bg-slate-950/45 border border-slate-850 hover:border-slate-800 p-4 rounded-2xl flex flex-col justify-between gap-4 transition-all hover:bg-slate-950/60 group relative overflow-hidden"
                >
                  {/* Subtle background category badge glow */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/[0.02] rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/[0.04] transition-all" />

                  {/* Goal Header */}
                  <div className="flex items-start justify-between gap-3 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 group-hover:text-emerald-400 group-hover:border-slate-700 transition-all shrink-0">
                        <span className="material-symbols-outlined text-lg">{iconName}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-100 font-display tracking-tight leading-snug">{goal.nome}</h4>
                          <span className="text-[8px] bg-slate-900 text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded-full font-mono font-bold tracking-wider uppercase">
                            {goal.categoria || 'Outros'}
                          </span>
                        </div>
                        {goal.descricao && (
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{goal.descricao}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          setEditingGoal(goal);
                          setGoalName(goal.nome);
                          setGoalTarget(String(goal.valorAlvo));
                          setGoalCurrent(String(goal.valorAtual));
                          setGoalDeadline(goal.prazo || '');
                          setGoalCategory(goal.categoria || 'Outros');
                          setGoalDesc(goal.descricao || '');
                          setIsOpenGoalModal(true);
                        }}
                        className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 flex items-center justify-center transition-all cursor-pointer"
                        title="Editar Meta"
                      >
                        <span className="material-symbols-outlined text-xs">edit</span>
                      </button>
                      <button
                        onClick={() => {
                          if (showConfirm) {
                            showConfirm(
                              "Excluir Meta de Economia",
                              `Tem certeza que deseja excluir a meta de economia "${goal.nome}"? Esta ação não pode ser desfeita.`,
                              () => {
                                const updated = savingsGoals.filter(g => g.id !== goal.id);
                                saveSavingsGoals(updated);
                                if (showAlert) showAlert("Meta Excluída", "Sua meta de economia foi excluída.");
                              }
                            );
                          } else {
                            const updated = savingsGoals.filter(g => g.id !== goal.id);
                            saveSavingsGoals(updated);
                          }
                        }}
                        className="w-7 h-7 rounded-lg bg-slate-900/40 hover:bg-rose-950/30 text-slate-500 hover:text-rose-400 border border-slate-850 hover:border-rose-900/30 flex items-center justify-center transition-all cursor-pointer"
                        title="Excluir Meta"
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                      </button>
                    </div>
                  </div>

                  {/* Progress Tracker Bar */}
                  <div className="space-y-1.5 relative z-10">
                    <div className="flex justify-between items-end text-xs font-mono">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">Acumulado</span>
                        <span className={`text-slate-100 font-extrabold text-[13px] ${hideValuesMode ? 'blur-[5px] select-none hover:blur-none transition-all duration-200 cursor-help' : 'transition-all duration-200'}`} title={hideValuesMode ? "Valor oculto (passe o mouse para revelar)" : undefined}>
                          {showBalance ? formatBRL(goal.valorAtual) : '••••••'}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">Objetivo</span>
                        <span className={`text-slate-300 font-bold text-xs ${hideValuesMode ? 'blur-[5px] select-none hover:blur-none transition-all duration-200 cursor-help' : 'transition-all duration-200'}`} title={hideValuesMode ? "Valor oculto (passe o mouse para revelar)" : undefined}>
                          {showBalance ? formatBRL(goal.valorAlvo) : '••••••'}
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-3 bg-slate-900 border border-slate-850 rounded-full overflow-hidden relative">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full rounded-full ${barColorClass} ${glowColorClass}`} 
                      />
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                      <div className="flex items-center gap-1 shrink-0 text-slate-500">
                        {dateText ? (
                          <>
                            <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                            <span>{dateText}</span>
                          </>
                        ) : (
                          <span>Sem prazo definido</span>
                        )}
                      </div>
                      <span className={`font-extrabold text-xs shrink-0 ${pct === 100 ? 'text-emerald-400 animate-pulse font-sans' : 'text-slate-200'}`}>
                        {pct}% {pct === 100 && '🎉'}
                      </span>
                    </div>
                  </div>

                  {/* Interactive Quick deposit/withdraw buttons */}
                  <div className="flex items-center justify-end gap-2.5 pt-2.5 border-t border-slate-900 relative z-10">
                    <button
                      onClick={() => {
                        setTransferGoalId(goal.id);
                        setTransferType('WITHDRAW');
                        setTransferAmount('');
                        setIsOpenTransferModal(true);
                      }}
                      className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 text-rose-400 border border-rose-500/20 text-[10px] font-bold font-mono uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
                      title="Resgatar fundos desta meta"
                    >
                      <span className="material-symbols-outlined text-xs">remove_circle</span>
                      Resgatar
                    </button>
                    <button
                      onClick={() => {
                        setTransferGoalId(goal.id);
                        setTransferType('DEPOSIT');
                        setTransferAmount('');
                        setIsOpenTransferModal(true);
                      }}
                      className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold font-mono uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
                      title="Depositar fundos nesta meta"
                    >
                      <span className="material-symbols-outlined text-xs">add_circle</span>
                      Depositar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Expenses by Category & Custom Interactive SVG Donut */}
      <section className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl space-y-5" id="category-distribution">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white font-display">Gastos por Categoria</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Distribuição mensal detalhada</p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Período:</span>
            <select
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:border-emerald-500 focus:outline-none transition-all font-sans cursor-pointer"
            >
              {availableMonths.map(key => (
                <option key={key} value={key} className="bg-slate-950 text-slate-200">
                  {formatMonthKey(key)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Custom SVG Pie Chart */}
          <div className="relative w-40 h-40 flex-shrink-0 flex items-center justify-center">
            {/* Ambient Glow behind SVG */}
            <div className="absolute inset-4 rounded-full blur-2xl pointer-events-none opacity-20 bg-emerald-500/50" />
            
            <svg className="w-full h-full transform -rotate-90 z-10" viewBox="0 0 36 36">
              {/* Background circle */}
              <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#0f172a" strokeWidth="4" />
              
              {donutSegments.length === 0 ? (
                // Gray empty circle if no expenses
                <circle 
                  cx="18" cy="18" r="15.9155" fill="none" 
                  stroke="#1e293b" strokeWidth="4.5" 
                  strokeDasharray="100 100" 
                  strokeDashoffset="0"
                />
              ) : (
                donutSegments.map((seg, index) => (
                  <circle 
                    key={index}
                    cx="18" cy="18" r="15.9155" fill="none" 
                    stroke={seg.color} strokeWidth="4.5" 
                    strokeDasharray={`${seg.pctFloat} 100`} 
                    strokeDashoffset={seg.offset}
                    className="transition-all duration-1000 ease-out hover:stroke-white cursor-pointer"
                    style={{ strokeLinecap: 'butt' }}
                    title={`${seg.name}: ${seg.percentage}%`}
                  />
                ))
              )}
            </svg>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
              <span className="text-[9px] text-slate-400 uppercase tracking-widest font-mono">Total</span>
              <span className="text-sm font-bold text-white font-mono mt-0.5">
                {formatBRL(monthlyCategoryData.total)}
              </span>
              <span className="text-[8px] font-bold text-slate-500 font-mono mt-0.5 uppercase tracking-wider bg-slate-950 px-1.5 py-0.5 rounded-full border border-slate-850">
                {getShortMonthNameFromKey(selectedMonthKey)}
              </span>
            </div>
          </div>

          {/* Detailed legend mapped dynamically */}
          <div className="flex-grow w-full space-y-3.5">
            {monthlyCategoryData.list.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <span className="material-symbols-outlined text-slate-600 text-3xl">info</span>
                <p className="text-xs text-slate-400 mt-2">Nenhum gasto registrado em {formatMonthKey(selectedMonthKey)}.</p>
                <p className="text-[10px] text-slate-500 mt-1">Lançamentos de despesa serão exibidos aqui automaticamente.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {monthlyCategoryData.list.map((item, idx) => (
                  <div key={idx} className="space-y-1 bg-slate-950/20 border border-slate-850/30 p-2.5 rounded-xl hover:bg-slate-950/40 transition-colors">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-300 font-medium truncate uppercase tracking-tight text-[11px]" title={item.name}>
                          {item.name}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-slate-200 block text-[11px]">
                          {formatBRL(item.value)}
                        </span>
                      </div>
                    </div>
                    {/* Visual bar tracker */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-1000 ease-out" 
                          style={{ 
                            backgroundColor: item.color,
                            width: `${item.percentage}%`
                          }} 
                        />
                      </div>
                      <span className="font-mono text-[9px] font-semibold text-slate-400 w-8 text-right">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Recent Activity List directly from the Spreadsheet dataset */}
      <section className="space-y-3" id="recent-activity">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-white font-display text-base">Atividade Recente</h3>
          <button 
            onClick={() => onNavigate('transactions')}
            className="text-xs font-bold text-emerald-400 hover:underline cursor-pointer"
          >
            Ver todas
          </button>
        </div>

        <div className="space-y-2.5">
          {recentTransactions.map((tx) => (
            <div 
              key={tx.id}
              className="bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 p-3.5 rounded-xl flex items-center justify-between transition-all cursor-pointer"
              onClick={() => onNavigate('transactions')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center bg-slate-800/80 rounded-xl text-emerald-400 border border-slate-700/50">
                  <span className="material-symbols-outlined text-xl">
                    {getCategoryIcon(tx.categoria)}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-white uppercase tracking-tight">{tx.descricao}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {tx.data} • {tx.categoria}
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <span className={`text-xs font-bold font-mono ${tx.tipo === 'RECEITA' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {tx.tipo === 'RECEITA' ? '+' : '-'} {formatBRL(tx.valor)}
                </span>
                <p className="text-[9px] text-slate-500 font-mono uppercase tracking-widest mt-0.5">
                  {tx.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ⏰ Lembrete de Check-in Diário */}
      <section className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl space-y-4 animate-fade-in" id="daily-checkin-settings-panel">
        <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
          <div className="flex items-center gap-1.5 text-indigo-400">
            <span className="material-symbols-outlined text-lg">alarm</span>
            <h3 className="font-bold text-white font-display text-base">Check-in Diário de Gastos</h3>
          </div>
          <span className={`text-[10px] font-mono font-bold uppercase tracking-widest border px-3 py-1 rounded-full whitespace-nowrap ${
            dailyCheckInTime 
              ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 animate-pulse' 
              : 'bg-slate-950 border-slate-850 text-slate-500'
          }`}>
            {dailyCheckInTime ? `Ativo às ${dailyCheckInTime}` : 'Inativo'}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Configure um horário diário para que o aplicativo lembre você de registrar seus gastos do dia. Quando o horário for atingido, você receberá uma notificação do sistema.
        </p>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center shrink-0 text-indigo-400">
              <span className="material-symbols-outlined">schedule</span>
            </div>
            <div>
              <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Horário de Check-In</label>
              <input
                type="time"
                value={dailyCheckInTime || ''}
                onChange={async (e) => {
                  const newTime = e.target.value;
                  setDailyCheckInTime?.(newTime);
                  
                  // Request notification permission if enabling
                  if (newTime && "Notification" in window) {
                    if (Notification.permission === "default") {
                      const permission = await Notification.requestPermission();
                      if (permission === "granted" && showAlert) {
                        showAlert("🔔 NOTIFICAÇÕES ATIVADAS!", "O WealthFlow agora tem permissão para enviar notificações de check-in.");
                      }
                    } else if (Notification.permission === "denied" && showAlert) {
                      showAlert("⚠️ NOTIFICAÇÕES BLOQUEADAS", "As notificações do navegador estão bloqueadas. O WealthFlow usará alertas em tela.");
                    }
                  }
                }}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500 font-mono mt-1 w-32 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex gap-2 sm:self-end">
            {dailyCheckInTime && (
              <button
                type="button"
                onClick={() => {
                  setDailyCheckInTime?.('');
                  if (showAlert) {
                    showAlert("⏰ CHECK-IN DESATIVADO", "O lembrete de check-in diário foi desativado com sucesso.");
                  }
                }}
                className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold text-xs uppercase cursor-pointer active:scale-95 transition-all font-mono"
              >
                Desativar
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if ("Notification" in window) {
                  Notification.requestPermission().then(permission => {
                    if (permission === "granted") {
                      try {
                        const notif = new Notification("WealthFlow • Lembrete Diário", {
                          body: "Notificação de teste! Esse é o alerta que aparecerá no seu check-in.",
                          icon: "/favicon.ico",
                          tag: "daily-checkin-test"
                        });
                        notif.onclick = () => {
                          window.focus();
                          onNavigate('transactions');
                          localStorage.setItem('draft_txType', 'DESPESA');
                        };
                      } catch (e) {
                        if (showAlert) showAlert("Erro", "Não foi possível disparar a notificação: " + (e as Error).message);
                      }
                    } else {
                      if (showAlert) {
                        showAlert(
                          "Lembrete WealthFlow (In-App)",
                          "Olá! Este é um alerta de teste do check-in diário, pois as notificações do sistema não estão autorizadas."
                        );
                      }
                    }
                  });
                } else {
                  if (showAlert) {
                    showAlert(
                      "Lembrete WealthFlow (In-App)",
                      "Olá! Este é um alerta de teste do check-in diário (Seu navegador não suporta a API de Notificações)."
                    );
                  }
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 font-bold text-xs uppercase cursor-pointer active:scale-95 transition-all flex items-center gap-1 font-mono"
            >
              <span className="material-symbols-outlined text-sm">notifications_active</span>
              Testar Notificação
            </button>
          </div>
        </div>
      </section>
    </>
  ) : (
    <div className="space-y-6 animate-fade-in" id="dashboard-budgets-section">
      {/* Category Budgets Tab Content */}
      <section className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl space-y-6" id="category-budgets-dashboard-panel">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/60 pb-5">
          <div className="space-y-1 bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent p-3 rounded-xl border-l-2 border-emerald-500">
            <h3 className="font-bold text-white font-display text-lg tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400 animate-pulse">donut_large</span>
              Orçamento Mensal por Categoria
            </h3>
            <p className="text-xs text-slate-400">
              Acompanhamento de despesas do mês de <strong className="text-emerald-400 font-semibold">{monthlyTotals.monthName} {monthlyTotals.year}</strong> em relação às metas mensais estabelecidas.
            </p>
          </div>
          <button
            onClick={() => {
              const currentBudgets = { ...categoryBudgets };
              const categoriesList = ['ABASTECIMENTO', 'CASA', 'CONSUMO', 'LAZER', 'PESSOAL', 'TAXAS', 'OUTROS', ...customCategories];
              categoriesList.forEach(catName => {
                const upper = catName.toUpperCase();
                if (currentBudgets[upper] === undefined) {
                  currentBudgets[upper] = categoryBudgets[catName] || 0;
                }
              });
              setTempBudgets(currentBudgets);
              setIsEditingBudgets(true);
            }}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs tracking-wide transition-all shadow-lg shadow-emerald-500/10 cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-sm">edit</span>
            Editar Limites
          </button>
        </div>

        {/* Gráfico de Barras Comparativo - Gasto Atual vs Orçamento */}
        {(() => {
          const categoriesList = Array.from(new Set([
            'ABASTECIMENTO', 'CASA', 'CONSUMO', 'LAZER', 'PESSOAL', 'TAXAS', 'OUTROS',
            ...(customCategories || []).map(c => c.toUpperCase()),
            ...Object.keys(categoryBudgets || {}).map(c => c.toUpperCase())
          ]));

          const budgetedCategories = categoriesList.filter(cat => {
            const catUpper = cat.toUpperCase();
            const limit = categoryBudgets[catUpper] || categoryBudgets[cat] || 0;
            return limit > 0;
          });

          if (budgetedCategories.length === 0) {
            return (
              <div className="bg-slate-950/40 border border-slate-800/80 p-5 rounded-2xl text-center space-y-2 py-8" id="no-budgets-barchart-placeholder">
                <span className="material-symbols-outlined text-slate-500 text-3xl">bar_chart</span>
                <p className="text-xs text-slate-400 font-medium">Nenhum limite orçamentário definido.</p>
                <p className="text-[10px] text-slate-500 max-w-sm mx-auto">
                  Clique em "Editar Limites" acima ou configure os orçamentos de suas categorias no seu Perfil para visualizar o gráfico comparativo de gastos.
                </p>
              </div>
            );
          }

          const maxValue = Math.max(
            ...budgetedCategories.map(cat => {
              const catUpper = cat.toUpperCase();
              const spent = monthlySpentByCategory[catUpper] || 0;
              const limit = categoryBudgets[catUpper] || categoryBudgets[cat] || 0;
              return Math.max(spent, limit, 100);
            }),
            500
          );

          return (
            <div className="bg-slate-950/40 border border-slate-800/80 p-5 rounded-2xl space-y-4" id="comparative-budget-barchart-panel">
              <div className="flex justify-between items-start border-b border-slate-800/40 pb-3">
                <div>
                  <h4 className="font-semibold text-white text-sm font-display flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-400">bar_chart</span>
                    Painel Gráfico: Gastos vs Limite Orçamentário
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mt-0.5">
                    Comparativo visual do total gasto no mês corrente com o orçamento configurado
                  </p>
                </div>
                <div className="flex gap-3 text-[9px] font-mono">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-slate-400">DENTRO DA META</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-rose-400">EXCEDIDO</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span className="text-indigo-400">META</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                {budgetedCategories.map(cat => {
                  const catUpper = cat.toUpperCase();
                  const spent = monthlySpentByCategory[catUpper] || 0;
                  const limit = categoryBudgets[catUpper] || categoryBudgets[cat] || 0;
                  const spentPercent = (spent / maxValue) * 100;
                  const limitPercent = (limit / maxValue) * 100;
                  const isOver = spent > limit;

                  return (
                    <div key={`barchart-row-${cat}`} className="space-y-2 p-3.5 bg-slate-900/10 border border-slate-900 rounded-xl hover:bg-slate-900/35 transition-all">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-200 tracking-tight uppercase flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[15px] text-indigo-400">
                            {getCategoryIcon(cat)}
                          </span>
                          {cat}
                        </span>
                        {isOver ? (
                          <span className="text-[9px] bg-rose-500/15 border border-rose-500/30 text-rose-400 px-2 py-0.5 rounded-full font-mono font-bold animate-pulse flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-rose-400 animate-pulse" />
                            {formatBRL(spent - limit)} ACIMA DO LIMITE
                          </span>
                        ) : (
                          <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-mono font-bold">
                            {formatBRL(limit - spent)} RESTANTES
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 pt-0.5">
                        {/* Gasto Bar Row */}
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] text-slate-500 font-mono font-semibold w-18 shrink-0 uppercase">Gasto Atual:</span>
                          <div className="flex-1 h-3 bg-slate-950/60 rounded border border-slate-850 overflow-hidden relative">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${spentPercent}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className={`h-full rounded-r ${
                                isOver 
                                  ? 'bg-gradient-to-r from-rose-600 to-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.3)]' 
                                  : 'bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                              }`}
                            />
                          </div>
                          <span className={`text-[10px] font-mono font-bold w-22 text-right ${isOver ? 'text-rose-400 font-extrabold' : 'text-slate-300'}`}>
                            {formatBRL(spent)}
                          </span>
                        </div>

                        {/* Limite Bar Row */}
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] text-slate-500 font-mono font-semibold w-18 shrink-0 uppercase">Orçamento:</span>
                          <div className="flex-1 h-2 bg-slate-950/60 rounded border border-slate-850 overflow-hidden relative">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${limitPercent}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className="h-full rounded-r bg-gradient-to-r from-indigo-600 to-indigo-500"
                            />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-indigo-400 w-22 text-right">
                            {formatBRL(limit)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {(() => {
          const categoriesList = Array.from(new Set([
            'ABASTECIMENTO', 'CASA', 'CONSUMO', 'LAZER', 'PESSOAL', 'TAXAS', 'OUTROS',
            ...(customCategories || []).map(c => c.toUpperCase()),
            ...Object.keys(categoryBudgets).map(c => c.toUpperCase())
          ]));

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categoriesList.map(cat => {
                const catUpper = cat.toUpperCase();
                const spent = monthlySpentByCategory[catUpper] || 0;
                const limit = categoryBudgets[catUpper] || categoryBudgets[cat] || 0;
                const isLimitDefined = limit > 0;
                const percentage = isLimitDefined ? Math.min((spent / limit) * 100, 100) : 0;
                const percentText = isLimitDefined ? `${Math.round((spent / limit) * 100)}%` : 'Sem meta';
                const isOverLimit = isLimitDefined && spent > limit;
                const isNearLimit = isLimitDefined && !isOverLimit && spent >= limit * 0.8;

                // Set progress bar color based on status
                let barColor = 'bg-emerald-500';
                let textColor = 'text-emerald-400';
                let statusBadge = null;

                if (isOverLimit) {
                  barColor = 'bg-rose-500 animate-pulse';
                  textColor = 'text-rose-400';
                  statusBadge = (
                    <span className="text-[9px] bg-rose-500/15 border border-rose-500/30 text-rose-400 px-2 py-0.5 rounded-full font-mono font-bold animate-pulse">
                      LIMITE EXCEDIDO
                    </span>
                  );
                } else if (isNearLimit) {
                  barColor = 'bg-amber-500';
                  textColor = 'text-amber-400';
                  statusBadge = (
                    <span className="text-[9px] bg-amber-500/15 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-full font-mono font-bold">
                      PRÓXIMO AO LIMITE
                    </span>
                  );
                } else if (isLimitDefined) {
                  statusBadge = (
                    <span className="text-[9px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full font-mono font-bold">
                      DENTRO DA META
                    </span>
                  );
                } else {
                  statusBadge = (
                    <span className="text-[9px] bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                      SEM META DEFINIDA
                    </span>
                  );
                }

                return (
                  <div 
                    key={cat} 
                    className={`bg-slate-950/60 border rounded-2xl p-4.5 space-y-3.5 transition-all relative overflow-hidden group hover:border-slate-700 ${
                      isOverLimit ? 'border-rose-500/25 bg-rose-500/[0.01]' : 'border-slate-850'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 text-slate-300 group-hover:text-emerald-400 transition-colors">
                          <span className="material-symbols-outlined text-lg">{getCategoryIcon(cat)}</span>
                        </div>
                        <div>
                          <h4 className="text-xs font-extrabold text-slate-100 font-mono uppercase tracking-wider">{cat}</h4>
                          <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                            {isLimitDefined ? `Meta: R$ ${limit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Sem limite mensal'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <span className="text-sm font-bold font-mono text-white">
                          R$ {spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        {statusBadge}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-mono text-slate-500">
                        <span>Progresso Mensal</span>
                        <span className={`font-bold ${textColor}`}>{percentText}</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-850">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className={`h-full rounded-full ${barColor}`} 
                        />
                      </div>
                    </div>

                    <div className="text-[10px] font-mono flex justify-between items-center pt-0.5">
                      {isLimitDefined ? (
                        isOverLimit ? (
                          <span className="text-rose-400 flex items-center gap-1 font-bold">
                            <span className="material-symbols-outlined text-[12px]">error</span>
                            {formatBRL(spent - limit)} acima da meta estabelecida
                          </span>
                        ) : (
                          <span className="text-slate-400 flex items-center gap-1 font-semibold">
                            <span className="material-symbols-outlined text-[12px] text-emerald-400">check_circle</span>
                            {formatBRL(limit - spent)} disponíveis para gastos
                          </span>
                        )
                      ) : (
                        <span className="text-slate-500 italic">Configure um limite para ativar o progresso</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </section>

      {/* Modal de Criação / Edição de Metas de Economia */}
      <AnimatePresence>
        {isOpenGoalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="savings-goal-modal-wrapper">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpenGoalModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
              id="savings-goal-modal"
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 to-teal-500" />
              
              {/* Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined">savings</span>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-sm font-display uppercase tracking-wider">
                      {editingGoal ? 'Editar Meta de Economia' : 'Nova Meta de Economia'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-0.5">
                      {editingGoal ? 'Atualize as definições de seu objetivo' : 'Defina um objetivo financeiro e poupe com consistência'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpenGoalModal(false)}
                  className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-850 hover:border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-90"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              {/* Form Content */}
              <div className="p-5 overflow-y-auto space-y-4 max-h-[60vh] scrollbar-thin scrollbar-thumb-slate-800">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider font-bold">Nome do Objetivo *</label>
                  <input
                    type="text"
                    placeholder="Ex: Reserva de Emergência, Viagem de Férias, IPVA do Carro"
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 text-slate-100 text-xs rounded-xl px-3 py-2.5 focus:outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider font-bold">Valor Alvo (R$) *</label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      placeholder="Ex: 5000"
                      value={goalTarget}
                      onChange={(e) => setGoalTarget(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-850 focus:border-emerald-500 text-slate-100 text-xs font-mono rounded-xl px-3 py-2.5 focus:outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider font-bold">Valor Atual Acumulado (R$)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Ex: 500"
                      value={goalCurrent}
                      onChange={(e) => setGoalCurrent(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-850 focus:border-emerald-500 text-slate-100 text-xs font-mono rounded-xl px-3 py-2.5 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider font-bold">Categoria</label>
                    <select
                      value={goalCategory}
                      onChange={(e) => setGoalCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none transition-all cursor-pointer"
                    >
                      <option value="Segurança">Segurança (Reserva, Saúde)</option>
                      <option value="Viagem">Viagem & Lazer</option>
                      <option value="Investimento">Investimentos</option>
                      <option value="Veículo">Veículo (Carro, Moto)</option>
                      <option value="Estudos">Estudos & Carreira</option>
                      <option value="Casa">Moradia / Casa</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider font-bold">Prazo Limite</label>
                    <input
                      type="date"
                      value={goalDeadline}
                      onChange={(e) => setGoalDeadline(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 text-slate-200 text-xs font-mono rounded-xl px-3 py-2.5 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider font-bold">Descrição / Observações</label>
                  <textarea
                    placeholder="Adicione notas sobre como planeja atingir esta meta, prazos adicionais ou informações..."
                    rows={3}
                    value={goalDesc}
                    onChange={(e) => setGoalDesc(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-850 focus:border-emerald-500 text-slate-100 text-xs rounded-xl px-3 py-2.5 focus:outline-none transition-all resize-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="p-5 bg-slate-950 border-t border-slate-850 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsOpenGoalModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider text-slate-400 hover:text-white border border-slate-850 hover:bg-slate-900 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveGoal}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider bg-emerald-500 text-slate-950 hover:bg-emerald-400 border border-emerald-500 transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
                >
                  {editingGoal ? 'Salvar Meta' : 'Criar Meta'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Depósito / Resgate Rápido de Metas de Economia */}
      <AnimatePresence>
        {isOpenTransferModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="transfer-goal-modal-wrapper">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpenTransferModal(false)}
              className="absolute inset-0 bg-slate-955/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col"
              id="transfer-goal-modal"
            >
              <div className={`absolute top-0 left-0 right-0 h-[2px] ${transferType === 'DEPOSIT' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              
              {/* Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                    transferType === 'DEPOSIT' 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' 
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/15'
                  }`}>
                    <span className="material-symbols-outlined">
                      {transferType === 'DEPOSIT' ? 'add_circle' : 'remove_circle'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-sm font-display uppercase tracking-wider">
                      {transferType === 'DEPOSIT' ? 'Depositar na Meta' : 'Resgatar da Meta'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-0.5">
                      {transferType === 'DEPOSIT' ? 'Adicionar fundos ao seu objetivo' : 'Retirar fundos acumulados'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpenTransferModal(false)}
                  className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-850 hover:border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-90"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              {/* Form Content */}
              <div className="p-5 space-y-4">
                <div className="bg-slate-950/40 border border-slate-850 p-3.5 rounded-xl">
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest block font-mono">Meta Selecionada</span>
                  <span className="text-sm font-bold text-slate-200 block mt-0.5">
                    {savingsGoals.find(g => g.id === transferGoalId)?.nome || ''}
                  </span>
                  <div className="flex items-center justify-between mt-2 text-xs font-mono text-slate-400 border-t border-slate-900 pt-2">
                    <span>Saldo Atual:</span>
                    <span className="font-bold text-slate-100">
                      {showBalance ? formatBRL(savingsGoals.find(g => g.id === transferGoalId)?.valorAtual || 0) : '••••••'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-mono uppercase tracking-wider font-bold">Valor (R$) *</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-xs font-bold text-slate-500 font-mono">R$</span>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      placeholder="0.00"
                      autoFocus
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 text-slate-100 font-bold font-mono text-sm rounded-xl pl-10 pr-3 py-3 focus:outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-5 bg-slate-950 border-t border-slate-850 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsOpenTransferModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider text-slate-400 hover:text-white border border-slate-850 hover:bg-slate-900 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleQuickTransfer}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider border transition-all cursor-pointer shadow-lg ${
                    transferType === 'DEPOSIT'
                      ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 border-emerald-500 shadow-emerald-500/10'
                      : 'bg-rose-500 text-white hover:bg-rose-400 border-rose-500 shadow-rose-500/10'
                  }`}
                >
                  Confirmar {transferType === 'DEPOSIT' ? 'Depósito' : 'Resgate'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Edição de Metas de Orçamento */}
      <AnimatePresence>
        {isEditingBudgets && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="budget-edit-modal-wrapper">
            {/* Backdrop Blur overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingBudgets(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />

            {/* Modal Body Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
              id="budget-edit-modal"
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500" />
              
              {/* Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined">payments</span>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-sm font-display uppercase tracking-wider">
                      Definir Metas de Orçamento
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-0.5">
                      Estabeleça limites mensais em R$ por categoria
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditingBudgets(false)}
                  className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-850 hover:border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-90"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Content scrollable */}
              <div className="p-5 overflow-y-auto space-y-4 max-h-[50vh] scrollbar-thin scrollbar-thumb-slate-800">
                <div className="bg-emerald-500/5 border border-emerald-500/15 p-4 rounded-xl flex items-start gap-3">
                  <span className="material-symbols-outlined text-emerald-400 text-xl shrink-0 mt-0.5">info</span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Defina limites mensais (R$) para cada categoria de gastos. Insira <strong>0</strong> ou deixe o campo em branco para remover o limite e desativar o acompanhamento para essa categoria específica.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {(() => {
                    const editList = Array.from(new Set([
                      'ABASTECIMENTO', 'CASA', 'CONSUMO', 'LAZER', 'PESSOAL', 'TAXAS', 'OUTROS',
                      ...(customCategories || []).map(c => c.toUpperCase()),
                      ...Object.keys(categoryBudgets).map(c => c.toUpperCase())
                    ]));

                    return editList.map(cat => {
                      const catUpper = cat.toUpperCase();
                      const value = tempBudgets[catUpper] || 0;

                      return (
                        <div 
                          key={cat} 
                          className="bg-slate-950 border border-slate-850/80 p-3.5 rounded-xl flex flex-col justify-between gap-2.5 hover:border-slate-800 transition-all"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-slate-900 text-emerald-400 border border-slate-850 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-sm">{getCategoryIcon(cat)}</span>
                            </div>
                            <span className="text-[11px] font-bold text-slate-200 font-mono tracking-wide uppercase truncate">
                              {catUpper}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-mono uppercase">Meta Mensal (R$)</label>
                            <div className="relative flex items-center">
                              <span className="absolute left-3 text-[10px] font-bold text-slate-500 font-mono">R$</span>
                              <input
                                type="number"
                                min="0"
                                step="50"
                                placeholder="Sem limite"
                                value={value || ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setTempBudgets(prev => ({
                                    ...prev,
                                    [catUpper]: isNaN(val) || val <= 0 ? 0 : val
                                  }));
                                }}
                                className="w-full bg-slate-900 border border-slate-850 focus:border-emerald-500 text-slate-100 font-mono text-[11px] font-bold rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-5 bg-slate-950 border-t border-slate-850 flex items-center justify-end gap-3 shrink-0">
                <button
                  onClick={() => setIsEditingBudgets(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider text-slate-400 hover:text-white border border-slate-850 hover:bg-slate-900 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setCategoryBudgets?.(tempBudgets);
                    setIsEditingBudgets(false);
                    if (showAlert) {
                      showAlert(
                        "🎉 METAS DE ORÇAMENTO ATUALIZADAS!",
                        "Seus limites mensais de orçamento foram atualizados com sucesso e já estão ativos no painel de acompanhamento."
                      );
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider bg-emerald-500 text-slate-950 hover:bg-emerald-400 border border-emerald-500 transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
                >
                  Salvar Alterações
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🚨 Modal de Alerta de Proximidade em Área de Risco */}
      <AnimatePresence>
        {activeRiskAlertZone && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-sans" id="risk-proximity-alert-modal-wrapper">
            {/* Backdrop Blur overlay with pulsing indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />

            {/* Modal Body Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative bg-black border-4 border-rose-600 rounded-2xl w-full max-w-lg overflow-hidden shadow-[0_0_50px_rgba(225,29,72,0.4)] flex flex-col"
              id="risk-proximity-alert-modal"
            >
              {/* Yellow & Black Hazard Stripes Bar */}
              <div 
                className="h-4.5 w-full shrink-0" 
                style={{
                  background: 'linear-gradient(45deg, #eab308 25%, #000 25%, #000 50%, #eab308 50%, #eab308 75%, #000 75%, #000)',
                  backgroundSize: '24px 24px'
                }} 
              />
              
              <div className="p-6 space-y-6">
                {/* Warning Header */}
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-500/25 border-2 border-rose-500 animate-pulse text-rose-500 mb-1 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                    <span className="material-symbols-outlined text-4xl font-extrabold">gpp_maybe</span>
                  </div>
                  <h2 className="text-xl font-black text-rose-500 tracking-tight uppercase leading-none font-display">
                    Alerta de Proximidade Crítica
                  </h2>
                  <p className="text-[10px] text-amber-400 font-mono font-bold tracking-widest uppercase bg-amber-500/10 border border-amber-500/25 py-1 px-3 rounded-full inline-block">
                    ⚠️ ENTRADA EM ÁREA DE RISCO ({activeRiskAlertZone.nivelRisco})
                  </p>
                </div>

                {/* Details Card */}
                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-3.5">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-wider block">Nome do Local</span>
                      <span className="text-sm font-black text-white uppercase font-display tracking-wide">{activeRiskAlertZone.nomeLocal}</span>
                    </div>
                    {gpsPosition && (
                      <div className="text-right">
                        <span className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-wider block">Distância Estimada</span>
                        <span className="text-sm font-bold text-rose-400 font-mono">
                          {getDistanceInMeters(
                            gpsPosition.latitude,
                            gpsPosition.longitude,
                            activeRiskAlertZone.latitude,
                            activeRiskAlertZone.longitude
                          ).toFixed(0)}m
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-950">
                    <div>
                      <span className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-wider block">Coordenadas da Zona</span>
                      <span className="text-[10px] text-slate-300 font-mono block truncate">
                        {activeRiskAlertZone.latitude.toFixed(5)}, {activeRiskAlertZone.longitude.toFixed(5)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-wider block">Mensagem Operacional</span>
                      <span className="text-[10px] text-slate-300 font-medium block truncate" title={activeRiskAlertZone.mensagem}>
                        {activeRiskAlertZone.mensagem || "Entrada em perímetro monitorado."}
                      </span>
                    </div>
                  </div>

                  {activeRiskAlertZone.voz && (
                    <div className="flex items-center gap-2 bg-rose-500/5 border border-rose-500/15 p-2 rounded-lg text-rose-300">
                      <span className="material-symbols-outlined text-sm">volume_up</span>
                      <span className="text-[9px] font-mono uppercase tracking-wider font-semibold">Alerta de Voz Ativo: "{activeRiskAlertZone.voz}"</span>
                    </div>
                  )}
                </div>

                {/* Safety Directives */}
                <div className="space-y-2">
                  <span className="text-[9px] font-bold font-mono text-slate-500 uppercase tracking-wider block">Diretrizes de Segurança Preventiva</span>
                  <div className="bg-slate-950/80 border border-slate-900 p-3 rounded-lg flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-rose-500 text-sm shrink-0 mt-0.5">verified_user</span>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Por favor, mantenha as janelas do veículo completamente fechadas, trave as portas imediatamente e não faça paradas voluntárias na via. Redobre a vigilância aos arredores do trajeto.
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                  <button
                    onClick={() => {
                      // Dismiss alert and add to dismissed checklist
                      setDismissedAlertZoneIds(prev => [...prev, activeRiskAlertZone.id]);
                      setActiveRiskAlertZone(null);
                    }}
                    className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider font-mono py-3 rounded-xl transition-all shadow-md shadow-rose-600/15 cursor-pointer active:scale-95 text-center flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">notifications_off</span> Ignorar e Silenciar
                  </button>

                  <button
                    onClick={() => {
                      // Navigate to risk mapping
                      setActiveRiskAlertZone(null);
                      onNavigate('risk');
                    }}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 border border-slate-850 hover:border-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider font-mono py-3 rounded-xl transition-all cursor-pointer active:scale-95 text-center flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">map</span> Ver no Mapa
                  </button>
                </div>
              </div>

              {/* Yellow & Black Hazard Stripes Bar (Bottom) */}
              <div 
                className="h-2 w-full shrink-0" 
                style={{
                  background: 'linear-gradient(45deg, #eab308 25%, #000 25%, #000 50%, #eab308 50%, #eab308 75%, #000 75%, #000)',
                  backgroundSize: '24px 24px'
                }} 
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )}

</div>
  );
}
