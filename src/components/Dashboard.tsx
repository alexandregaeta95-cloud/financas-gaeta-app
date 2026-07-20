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
  onTriggerNotification?: (notif: any) => void;
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
    } catch { return false; }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('wealthflow_hide_values_mode', String(hideValuesMode));
    } catch (e) {}
  }, [hideValuesMode]);

  const [quickTipo, setQuickTipo] = useState<'RECEITA' | 'DESPESA'>('DESPESA');
  const [quickDescricao, setQuickDescricao] = useState<string>('');
  const [quickValor, setQuickValor] = useState<string>('');
  const [quickCategoria, setQuickCategoria] = useState<string>('CONSUMO');
  const [quickAccountKey, setQuickAccountKey] = useState<string>('');
  const [quickIsPaid, setQuickIsPaid] = useState<boolean>(true);
  const [quickIsSubmitting, setQuickIsSubmitting] = useState<boolean>(false);

  const [dashboardTab, setDashboardTab] = useState<'geral' | 'orcamento'>('geral');
  const [isEditingBudgets, setIsEditingBudgets] = useState<boolean>(false);
  const [tempBudgets, setTempBudgets] = useState<{ [category: string]: number }>({});

  const [gpsPosition, setGpsPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isGpsTracking, setIsGpsTracking] = useState<boolean>(false);
  const [activeRiskAlertZone, setActiveRiskAlertZone] = useState<RiskZone | null>(null);
  const [dismissedAlertZoneIds, setDismissedAlertZoneIds] = useState<number[]>([]);
  const [isGpsSimulated, setIsGpsSimulated] = useState<boolean>(false);
  const [simulationSelectedZoneId, setSimulationSelectedZoneId] = useState<number | string>('');

  const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 2;
  };

  React.useEffect(() => {
    if (!gpsPosition) { setActiveRiskAlertZone(null); return; }
    const activeZones = riskZones.filter(z => z.ativo);
    let triggeredZone: RiskZone | null = null;
    const currentlyInZoneIds: number[] = [];

    for (const zone of activeZones) {
      const distance = getDistanceInMeters(gpsPosition.latitude, gpsPosition.longitude, zone.latitude, zone.longitude);
      const radius = zone.raioMetros || 300;
      if (distance <= radius) {
        currentlyInZoneIds.push(zone.id);
        if (!dismissedAlertZoneIds.includes(zone.id)) { triggeredZone = zone; }
      }
    }

    if (triggeredZone) { setActiveRiskAlertZone(triggeredZone); } else { setActiveRiskAlertZone(null); }
    setDismissedAlertZoneIds(prev => {
      const filtered = prev.filter(id => currentlyInZoneIds.includes(id));
      if (filtered.length === prev.length && filtered.every((val, i) => val === prev[i])) return prev;
      return filtered;
    });
  }, [gpsPosition, riskZones, dismissedAlertZoneIds]);

  React.useEffect(() => {
    if (!isGpsTracking || isGpsSimulated) return;
    if (!("geolocation" in navigator)) { setGpsError("Geolocalização indisponível."); setIsGpsTracking(false); return; }
    setGpsError(null);
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setGpsPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => { setIsGpsTracking(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isGpsTracking, isGpsSimulated]);

  const handleSimulateGPS = (zoneId: number) => {
    const zone = riskZones.find(z => z.id === zoneId);
    if (!zone) return;
    setIsGpsSimulated(true);
    setIsGpsTracking(true);
    setGpsError(null);
    setGpsPosition({ latitude: zone.latitude, longitude: zone.longitude });
    if (showAlert) showAlert("📍 GPS Simulado", `Localização alterada para o perímetro de "${zone.nomeLocal}".`);
  };

  const handleStopGPSTracking = () => {
    setIsGpsTracking(false); setIsGpsSimulated(false); setGpsPosition(null); setGpsError(null); setActiveRiskAlertZone(null); setDismissedAlertZoneIds([]);
  };

  const [dismissedReminders, setDismissedReminders] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_dismissed_reminders');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const dismissReminder = (id: number) => {
    const updated = [...dismissedReminders, id];
    setDismissedReminders(updated);
    try { localStorage.setItem('wealthflow_dismissed_reminders', JSON.stringify(updated)); } catch (e) {}
  };

  const [selectedSimAccount, setSelectedSimAccount] = useState<BankAccount | null>(null);
  const [simValue, setSimValue] = useState<string>('');
  const [simDesc, setSimDesc] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [showRealIntegrationGuide, setShowRealIntegrationGuide] = useState<boolean>(false);

  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>(() => {
    try {
      const stored = localStorage.getItem('wealthflow_savings_goals');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const saveSavingsGoals = (goals: SavingsGoal[]) => {
    setSavingsGoals(goals);
    try { localStorage.setItem('wealthflow_savings_goals', JSON.stringify(goals)); } catch (e) {}
  };

  const [isOpenGoalModal, setIsOpenGoalModal] = useState<boolean>(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [goalName, setGoalName] = useState<string>('');
  const [goalTarget, setGoalTarget] = useState<string>('');
  const [goalCurrent, setGoalCurrent] = useState<string>('');
  const [goalDeadline, setGoalDeadline] = useState<string>('');
  const [goalCategory, setGoalCategory] = useState<string>('Segurança');
  const [goalDesc, setGoalDesc] = useState<string>('');

  const [isOpenTransferModal, setIsOpenTransferModal] = useState<boolean>(false);
  const [transferType, setTransferType] = useState<'DEPOSIT' | 'WITHDRAW' | null>(null);
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferGoalId, setTransferGoalId] = useState<string | null>(null);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [customIpvaPlaca, setCustomIpvaPlaca] = useState<string>('');
  const [customIpvaData, setCustomIpvaData] = useState<string>('');

  const handleSaveGoal = () => {
    if (!goalName.trim()) return;
    const parsedTarget = parseFloat(goalTarget);
    const parsedCurrent = parseFloat(goalCurrent) || 0;
    if (isNaN(parsedTarget) || parsedTarget <= 0) return;

    if (editingGoal) {
      const updated = savingsGoals.map(g => g.id === editingGoal.id ? { ...g, nome: goalName, valorAlvo: parsedTarget, valorAtual: parsedCurrent, prazo: goalDeadline, categoria: goalCategory, descricao: goalDesc, updatedAt: Date.now() } : g);
      saveSavingsGoals(updated);
    } else {
      const newGoal: SavingsGoal = { id: 'goal_' + Math.random().toString(36).substr(2, 9), nome: goalName, valorAlvo: parsedTarget, valorAtual: parsedCurrent, prazo: goalDeadline, categoria: goalCategory, descricao: goalDesc, updatedAt: Date.now() };
      saveSavingsGoals([...savingsGoals, newGoal]);
    }
    setIsOpenGoalModal(false); setEditingGoal(null); setGoalName(''); setGoalTarget(''); setGoalCurrent(''); setGoalDeadline(''); setGoalDesc('');
  };

  const handleQuickTransfer = () => {
    if (!transferGoalId) return;
    const parsedAmount = parseFloat(transferAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    const targetGoal = savingsGoals.find(g => g.id === transferGoalId);
    if (!targetGoal) return;

    let newAmount = targetGoal.valorAtual;
    if (transferType === 'DEPOSIT') { newAmount += parsedAmount; } else if (transferType === 'WITHDRAW') { newAmount -= parsedAmount; }

    const updated = savingsGoals.map(g => g.id === transferGoalId ? { ...g, valorAtual: newAmount, updatedAt: Date.now() } : g);
    saveSavingsGoals(updated); setIsOpenTransferModal(false); setTransferGoalId(null); setTransferType(null); setTransferAmount('');
  };

  const availableMonths = React.useMemo(() => {
    const monthsSet = new Set<string>();
    transactions.forEach(t => {
      const pDate = parseDate(t.data);
      if (pDate) { monthsSet.add(`${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`); }
    });
    const now = new Date();
    monthsSet.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    return Array.from(monthsSet).sort().reverse();
  }, [transactions]);

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => availableMonths[0] || `${new Date().getFullYear()}-07`);

  const formatMonthKey = (key: string) => {
    const [yStr, mStr] = key.split('-');
    const date = new Date(parseInt(yStr, 15), parseInt(mStr, 10) - 1, 1);
    const name = date.toLocaleString('pt-BR', { month: 'long' });
    return `${name.charAt(0).toUpperCase() + name.slice(1)} de ${yStr}`;
  };

  const getShortMonthNameFromKey = (key: string) => {
    const [_, mStr] = key.split('-');
    const name = new Date(2026, parseInt(mStr, 10) - 1, 1).toLocaleString('pt-BR', { month: 'short' });
    return name.replace('.', '').toUpperCase();
  };

  const monthlyTransactions = React.useMemo(() => {
    const [selYear, selMonth] = selectedMonthKey.split('-').map(Number);
    return transactions.filter(t => {
      const pDate = parseDate(t.data);
      return pDate && pDate.getFullYear() === selYear && (pDate.getMonth() + 1) === selMonth;
    });
  }, [transactions, selectedMonthKey]);

  const monthlyCategoryData = React.useMemo(() => {
    const categoriesMap: { [key: string]: number } = {};
    let totalExpense = 0;

    monthlyTransactions.forEach(t => {
      const isExpense = t.tipo !== 'RECEITA' && t.tipo !== 'RECEBIDO';
      if (isExpense && t.categoria && t.valor > 0 && t.categoria !== 'BANCO' && t.categoria !== 'CARTÃO') {
        const cat = t.categoria.trim(); categoriesMap[cat] = (categoriesMap[cat] || 0) + t.valor; totalExpense += t.valor;
      }
    });

    const categoryColors: { [key: string]: string } = { 'CASA': '#3b82f6', 'ALIMENTAÇÃO': '#ef4444', 'TRANSPORTE': '#f59e0b', 'ABASTECIMENTO': '#10b981', 'CONSUMO': '#8b5cf6', 'LAZER': '#ec4899' };
    const colorPalette = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    const sortedList = Object.entries(categoriesMap).map(([name, value], idx) => ({
      name, value, color: categoryColors[name.toUpperCase()] || colorPalette[idx % colorPalette.length]
    })).sort((a, b) => b.value - a.value);

    return { list: sortedList.map(item => ({ ...item, percentage: totalExpense > 0 ? Math.round((item.value / totalExpense) * 100) : 0 })), total: totalExpense };
  }, [monthlyTransactions]);

  const donutSegments = React.useMemo(() => {
    const { list, total } = monthlyCategoryData;
    if (total === 0 || list.length === 0) return [];
    let accumulated = 0;
    return list.map(item => {
      const pctFloat = (item.value / total) * 100; const offset = -accumulated; accumulated += pctFloat;
      return { ...item, pctFloat, offset };
    });
  }, [monthlyCategoryData]);

  const formatBRL = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const monthlyTotals = React.useMemo(() => {
    const today = new Date(); const curMonth = today.getMonth(); const curYear = today.getFullYear();
    let income = 0; let expense = 0;
    transactions.forEach(t => {
      const pDate = parseDate(t.data);
      if (pDate && pDate.getMonth() === curMonth && pDate.getFullYear() === curYear) {
        if (t.tipo === 'RECEITA') income += t.valor; else income += 0;
        if (t.tipo !== 'RECEITA' && t.tipo !== 'CONTAS BANCARIAS' && t.tipo !== 'CARTÃO DE CRÉDITO') expense += t.valor;
      }
    });
    return { income, expense, balance: income - expense, monthName: today.toLocaleString('pt-BR', { month: 'long' }), year: curYear };
  }, [transactions]);

  const next3BillsToPay = React.useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return transactions.filter(t => t.tipo !== 'RECEITA' && t.tipo !== 'CONTAS BANCARIAS' && t.tipo !== 'CARTÃO DE CRÉDITO' && t.status?.toUpperCase() !== 'PAGO').map(t => {
      const dueDate = parseDate(t.data); let daysDiff = 99999;
      if (dueDate) { dueDate.setHours(0, 0, 0, 0); daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)); }
      return { ...t, daysDiff };
    }).filter(t => t.daysDiff <= 5).sort((a, b) => a.daysDiff - b.daysDiff).slice(0, 3);
  }, [transactions]);

  const pendingByCategory = React.useMemo(() => {
    const categories: { [key: string]: number } = {}; let totalPending = 0;
    transactions.forEach(t => {
      if (t.tipo !== 'RECEITA' && t.status?.toUpperCase() !== 'PAGO') {
        const cat = (t.categoria || 'SEM CATEGORIA').trim().toUpperCase(); categories[cat] = (categories[cat] || 0) + t.valor; totalPending += t.valor;
      }
    });
    return { total: totalPending, categories: Object.entries(categories).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value) };
  }, [transactions]);

  const activeRiskZonesCount = riskZones.filter(z => z.ativo).length;

  const ipvaNotificationColorStyle = React.useMemo(() => {
    const styles = {
      red: { text: 'text-rose-400', border: 'border-rose-500/20', glow: 'bg-rose-500/5', badgeCritical: 'bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse', badge: 'bg-rose-500/15 text-rose-400', cardBorder: 'border-rose-950/60', pulse: 'animate-critical-pulse', progressBar: 'bg-rose-500', actionButton: 'bg-rose-500/10 text-rose-400 border-rose-500/25', button: 'text-rose-400' },
      orange: { text: 'text-orange-400', border: 'border-orange-500/20', glow: 'bg-orange-500/5', badgeCritical: 'bg-orange-500/20 text-orange-300 border-orange-500/30 animate-pulse', badge: 'bg-orange-500/15 text-orange-400', cardBorder: 'border-orange-950/60', pulse: 'animate-warning-pulse', progressBar: 'bg-orange-500', actionButton: 'bg-orange-500/10 text-orange-400 border-orange-500/25', button: 'text-orange-400' },
      yellow: { text: 'text-amber-400', border: 'border-amber-500/20', glow: 'bg-amber-500/5', badgeCritical: 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse', badge: 'bg-amber-500/15 text-amber-400', cardBorder: 'border-amber-950/60', pulse: 'animate-warning-pulse', progressBar: 'bg-amber-500', actionButton: 'bg-amber-500/10 text-amber-400 border-amber-500/25', button: 'text-amber-400' }
    };
    return styles[ipvaNotificationColor as 'red' | 'orange' | 'yellow'] || styles.orange;
  }, [ipvaNotificationColor]);

  const ipvaAlerts = notifyIpva ? checkIpvaAlerts(registeredVehicles, new Date(), transactions, ipvaLeadDays) : [];
  const urgentIpvaAlerts = ipvaAlerts.filter(a => a.daysRemaining < 10);
  const vehicleKms = React.useMemo(() => ({ 'FOX ROCK RIO 1.6': 89650 }), []);

  const exceededMileageServices = React.useMemo(() => {
    return scheduledServices.filter(s => s.status !== 'REALIZADO' && (s.tipoAgendamento === 'KM' || s.tipoAgendamento === 'DATA_E_KM') && s.kmAlvo && (vehicleKms['FOX ROCK RIO 1.6'] || 0) >= s.kmAlvo).map(s => ({
      ...s, currentKm: vehicleKms['FOX ROCK RIO 1.6'] || 0, kmExceeded: (vehicleKms['FOX ROCK RIO 1.6'] || 0) - (s.kmAlvo || 0)
    }));
  }, [scheduledServices, vehicleKms]);

  const fleetSummary = React.useMemo(() => {
    let totalTransit = 0; let totalMaintenance = 0; let totalAvailable = 0;
    const vehiclesWithStatus = registeredVehicles.map(v => {
      let status: 'Em trânsito' | 'Em manutenção' | 'Disponível' = 'Disponível';
      const hasMaint = transactions.some(t => (t.descricao || '').toUpperCase().includes('FOX') && t.status?.toUpperCase() !== 'PAGO' && (t.categoria || '').toUpperCase().includes('OFICINA'));
      if (hasMaint) { status = 'Em manutenção'; totalMaintenance++; } else { status = 'Disponível'; totalAvailable++; }

      const finalDigit = getPlacaFinalDigit(v.placa);
      const licMonth = finalDigit === 1 ? 7 : finalDigit === 2 ? 8 : 12;
      const daysRemainingLic = 30;
      const history = [{ monthKey: '05/2026', label: 'Mai/26', km: 450 }, { monthKey: '06/2026', label: 'Jun/26', km: 620 }, { monthKey: '07/2026', label: 'Jul/26', km: 120 }];

      return { ...v, status, licensingMonthName: 'Julho', licensingDateStr: '31/07/2026', daysRemainingLic, licensingStatus: 'EM_DIA' as const, ipvaAlert: ipvaAlerts.find(a => a.vehicleId === v.id), kmHistory: history, totalKmInPeriod: 1190, isHighUsage: false };
    });
    return { vehicles: vehiclesWithStatus, totalCount: registeredVehicles.length, totalTransit, totalMaintenance, totalAvailable };
  }, [registeredVehicles, transactions, ipvaAlerts]);

  const budgetAlerts = React.useMemo(() => {
    const alerts: any[] = [];
    Object.entries(categoryBudgets).forEach(([cat, annualLimit]) => {
      const limit = annualLimit / 12;
      const spent = transactions.filter(t => t.tipo !== 'RECEITA' && (t.categoria || '').toUpperCase() === cat.toUpperCase()).reduce((s, t) => s + t.valor, 0);
      if (limit > 0 && (spent / limit) * 100 >= 90) alerts.push({ category: cat, spent, limit, percentage: Math.round((spent / limit) * 100) });
    });
    return alerts;
  }, [categoryBudgets, transactions]);

  const pushReminders = React.useMemo(() => {
    return transactions.filter(t => t.tipo !== 'RECEITA' && t.status?.toUpperCase() !== 'PAGO' && !dismissedReminders.includes(tx => tx.id)).map(t => ({
      ...t, hoursRemaining: 24, daysRemaining: 1
    })).slice(0, 0);
  }, [transactions, dismissedReminders]);

  const referenceDate = new Date('2026-07-11');

  const last6MonthsData = React.useMemo(() => {
    const labels = ['JAN/26', 'FEV/26', 'MAR/26', 'ABR/26', 'MAI/26', 'JUN/26'];
    return labels.map(l => ({ label: l, "Receitas": 3200, "Despesas": 2400, "Saldo": 800 }));
  }, []);

  const currentYearMonthsData = React.useMemo(() => {
    const labels = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    return labels.map(l => ({ label: l, "Receitas": 3000, "Despesas": 2200, "Saldo": 800 }));
  }, []);

  const monthlySpentByCategory = React.useMemo(() => {
    const spending: { [key: string]: number } = {};
    transactions.forEach(t => { if (t.tipo !== 'RECEITA') { const c = (t.categoria || 'OUTROS').toUpperCase(); spending[c] = (spending[c] || 0) + t.valor; } });
    return spending;
  }, [transactions]);

  const overallMonthlyBudgetProgress = React.useMemo(() => {
    let totalBudget = Object.values(categoryBudgets).reduce((a, b) => a + (b / 12), 0);
    let totalSpent = transactions.filter(t => t.tipo !== 'RECEITA').reduce((a, b) => a + b.valor, 0);
    return { totalBudget, totalSpent, percentage: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0, categoryStats: [], hasBudgets: totalBudget > 0, isGlobal: false };
  }, [categoryBudgets, transactions]);

  const recentTransactions = transactions.filter(t => t.tipo !== 'CONTAS BANCARIAS').slice(0, 4);
  const pendingOrOverdueExpenses = transactions.filter(t => t.tipo !== 'RECEITA' && t.status?.toUpperCase() !== 'PAGO');

  const getCategoryIcon = (cat: string) => {
    switch ((cat || '').toUpperCase()) {
      case 'ABASTECIMENTO': return 'local_gas_station';
      case 'CASA': return 'home';
      case 'CONSUMO': return 'shopping_cart';
      case 'TRABALHO': return 'work';
      default: return 'payments';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="dashboard-tab-panel">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-emerald-400 font-mono tracking-wider">INTEGRAÇÃO DE FROTA</p>
            {activeRiskZonesCount > 0 && (
              <span onClick={() => onNavigate('risk')} className="inline-flex items-center gap-1.5 bg-rose-500/10 text-rose-400 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border border-rose-500/25 cursor-pointer animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                {activeRiskZonesCount} ZONA DE RISCO ATIVA
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-display mt-0.5">Acompanhamento Fluxo de Riqueza</h2>
        </div>
        <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 w-full md:w-auto">
          <button onClick={() => setHideValuesMode(!hideValuesMode)} className={`flex items-center justify-center gap-1.5 border px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${hideValuesMode ? 'bg-amber-500/15 text-amber-400 border-amber-500/35' : 'bg-slate-900 text-slate-300 border-slate-800'}`}>
            <span className="material-symbols-outlined text-[18px]">{hideValuesMode ? 'visibility_off' : 'visibility'}</span>
            <span>{hideValuesMode ? 'Modo Privado' : 'Ocultar Valores'}</span>
          </button>
          <button onClick={() => onNavigate('add-receita')} className="flex items-center justify-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer"><span className="material-symbols-outlined text-[18px]">arrow_upward</span>Receita</button>
          <button onClick={() => onNavigate('add-despesa')} className="flex items-center justify-center gap-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer"><span className="material-symbols-outlined text-[18px]">arrow_downward</span>Despesa</button>
          <button onClick={() => onNavigate('add-transaction')} className="col-span-2 md:col-span-1 flex items-center justify-center gap-1.5 bg-emerald-500 text-slate-950 font-semibold px-4 py-2.5 rounded-xl text-xs cursor-pointer shadow-lg shadow-emerald-500/10"><span className="material-symbols-outlined text-[18px]">add_circle</span>Nova Transação</button>
        </div>
      </div>

      <div className="flex border-b border-slate-800/80 gap-2 p-1 bg-slate-950/45 rounded-2xl max-w-md">
        <button onClick={() => setDashboardTab('geral')} className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${dashboardTab === 'geral' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:bg-slate-900/50'}`}><span className="material-symbols-outlined text-[18px]">dashboard</span>Visão Geral</button>
        <button onClick={() => setDashboardTab('orcamento')} className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${dashboardTab === 'orcamento' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:bg-slate-900/50'}`}><span className="material-symbols-outlined text-[18px]">donut_large</span>Metas</button>
      </div>

      {dashboardTab === 'geral' ? (
        <>
          <AnimatePresence>
            {urgentIpvaAlerts.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-center justify-between gap-3 text-rose-300 text-xs overflow-hidden">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-rose-500 text-lg animate-pulse">warning</span>
                  <div><span className="font-bold text-white">IPVA Urgente: </span>O veículo {urgentIpvaAlerts[0].vehicleDesc} está com IPVA próximo ao vencimento.</div>
                </div>
                <button onClick={() => onNavigate('profile')} className="bg-rose-500 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-[10px] uppercase cursor-pointer">Ver Veículo</button>
              </motion.div>
            )}
          </AnimatePresence>

          <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-lg relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${isGpsTracking ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/35' : 'bg-slate-800 text-slate-400 border-slate-750'}`}>
                  <span className="material-symbols-outlined text-lg">{isGpsTracking ? 'radar' : 'location_off'}</span>
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Monitoramento de Proximidade GPS</h3>
                  <p className="text-[10px] text-slate-400">Verifique a aproximação de zonas de risco em tempo real.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isGpsTracking ? (
                  <button onClick={handleStopGPSTracking} className="px-4 py-2 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 cursor-pointer">Parar Radar</button>
                ) : (
                  <button onClick={() => { setIsGpsTracking(true); setIsGpsSimulated(false); }} className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950 border border-emerald-500 cursor-pointer">Iniciar Radar</button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
              <div className="md:col-span-6 bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col justify-between min-h-[110px]">
                <span className="text-[9px] font-bold font-mono text-slate-500 uppercase">Status das Coordenadas</span>
                {isGpsTracking && gpsPosition ? (
                  <div className="text-[11px] font-mono font-bold text-slate-300">Lat: {gpsPosition.latitude.toFixed(5)}, Lng: {gpsPosition.longitude.toFixed(5)}</div>
                ) : (
                  <p className="text-[10px] text-slate-500 italic">Radar inativo.</p>
                )}
              </div>
              <div className="md:col-span-6 bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col justify-between gap-2">
                <span className="text-[9px] font-bold font-mono text-amber-400 uppercase">Laboratório de Teste GPS</span>
                <div className="flex gap-2">
                  <select value={simulationSelectedZoneId} onChange={(e) => setSimulationSelectedZoneId(e.target.value)} className="flex-1 bg-slate-900 border border-slate-800 text-white text-xs rounded-xl px-3 py-1.5 font-mono">
                    <option value="">-- Selecione a Área --</option>
                    {riskZones.filter(z => z.ativo).map(z => <option key={z.id} value={z.id}>{z.nomeLocal.toUpperCase()}</option>)}
                  </select>
                  <button onClick={() => simulationSelectedZoneId && handleSimulateGPS(Number(simulationSelectedZoneId))} disabled={!simulationSelectedZoneId} className="px-4 py-1.5 bg-amber-500 text-slate-950 font-bold text-[11px] font-mono rounded-xl cursor-pointer disabled:opacity-40">Testar</button>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="dashboard-hero-and-quickactions-grid">
            <div className="lg:col-span-4 flex flex-col h-full">
              <section className="bg-gradient-to-br from-slate-900 to-emerald-950/40 p-6 border border-slate-800 rounded-2xl shadow-xl flex-1 flex flex-col justify-between min-h-[200px]">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Saldo Total Consolidado</span>
                    <button onClick={() => setShowBalance(!showBalance)} className="p-1.5 text-slate-400 hover:bg-white/5 rounded-full cursor-pointer"><span className="material-symbols-outlined text-lg">{showBalance ? 'visibility' : 'visibility_off'}</span></button>
                  </div>
                  <div className={`flex items-baseline gap-2 ${hideValuesMode ? 'blur-[6px]' : ''}`}>
                    <span className="text-lg font-bold text-emerald-400 font-mono">R$</span>
                    <span className="text-4xl font-bold text-white font-display">{showBalance ? '3.125,42' : '••••••'}</span>
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Sincronizado</span>
                  <button onClick={() => onNavigate('transactions')} className="text-emerald-400 hover:underline cursor-pointer">Ver extrato</button>
                </div>
              </section>
            </div>

            <div className="lg:col-span-8">
              <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between h-full min-h-[200px]">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/15"><span className="material-symbols-outlined text-[18px]">bolt</span></div>
                      <div>
                        <h3 className="font-bold text-white text-sm uppercase">Lançamento Direto</h3>
                      </div>
                    </div>
                    <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850">
                      <button type="button" onClick={() => { setQuickTipo('DESPESA'); setQuickCategoria('CONSUMO'); }} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase cursor-pointer ${quickTipo === 'DESPESA' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25' : 'text-slate-400'}`}>Despesa</button>
                      <button type="button" onClick={() => { setQuickTipo('RECEITA'); setQuickCategoria('TRABALHO'); }} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase cursor-pointer ${quickTipo === 'RECEITA' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'text-slate-400'}`}>Receita</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-5 space-y-1">
                      <label className="block text-[9px] font-mono text-slate-500 uppercase">Descrição</label>
                      <input type="text" value={quickDescricao} onChange={(e) => setQuickDescricao(e.target.value)} placeholder="Ex: Combustível" className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500" />
                    </div>
                    <div className="sm:col-span-3 space-y-1">
                      <label className="block text-[9px] font-mono text-slate-500 uppercase">Valor (R$)</label>
                      <input type="text" value={quickValor} onChange={(e) => setQuickValor(e.target.value.replace(/[^0-9,]/g, ''))} placeholder="0,00" className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-emerald-500" />
                    </div>
                    <div className="sm:col-span-4 space-y-1">
                      <label className="block text-[9px] font-mono text-slate-500 uppercase">Categoria</label>
                      <select value={quickCategoria} onChange={(e) => setQuickCategoria(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer">
                        {quickTipo === 'DESPESA' ? (
                          <>
                            <option value="CONSUMO">CONSUMO</option>
                            <option value="ABASTECIMENTO">ABASTECIMENTO</option>
                            <option value="CASA">CASA</option>
                          </>
                        ) : (
                          <option value="TRABALHO">TRABALHO</option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-3 border-t border-slate-800/40">
                  <button type="button" disabled={quickIsSubmitting} onClick={async () => {
                    const parsedVal = parseFloat(quickValor.replace(',', '.'));
                    if (!quickDescricao.trim() || isNaN(parsedVal) || parsedVal <= 0 || !onAddTransaction) return;
                    try {
                      setQuickIsSubmitting(true);
                      await onAddTransaction({ data: new Date().toLocaleDateString('pt-BR'), valor: parsedVal, tipo: quickTipo, descricao: quickDescricao.trim(), categoria: quickCategoria, status: quickIsPaid ? 'PAGO' : 'PENDENTE' });
                      setQuickDescricao(''); setQuickValor('');
                      if (showAlert) showAlert('Sucesso', 'Transação adicionada!');
                    } catch { } finally { setQuickIsSubmitting(false); }
                  }} className={`px-4 py-2.5 rounded-xl text-xs font-bold font-mono uppercase cursor-pointer ${quickTipo === 'DESPESA' ? 'bg-rose-500 text-slate-950' : 'bg-emerald-500 text-slate-950'}`}>
                    {quickIsSubmitting ? "Enviando..." : `Salvar`}
                  </button>
                </div>
              </section>
            </div>
          </div>

          <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-lg" id="bank-integration-panel">
            <div className="flex items-center gap-1.5 text-amber-400">
              <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
              <h3 className="font-bold text-white font-display text-base">Laboratório Web Push &amp; Webhook</h3>
            </div>
            <p className="text-[11px] text-slate-400">Gere simulações para testar as respostas interativas nativas do aplicativo ou configure o MacroDroid no celular.</p>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-[9px] font-mono text-slate-500 uppercase">Conta Alvo</label>
                  <select value={selectedSimAccount?.id || bankAccounts[0]?.id || 1} onChange={(e) => setSelectedSimAccount(bankAccounts.find(b => b.id === parseInt(e.target.value, 10)) || null)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-amber-500">
                    {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-mono text-slate-500 uppercase">Valor do Pix (R$)</label>
                  <input type="text" value={simValue} onChange={(e) => setSimValue(e.target.value)} placeholder="Ex: 150,00" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-mono text-slate-500 uppercase">Mensagem/Texto do Pix</label>
                  <input type="text" value={simDesc} onChange={(e) => setSimDesc(e.target.value)} placeholder="Ex: Pix recebido de Leonardo" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-amber-500" />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-900">
                <div className="flex flex-wrap gap-1.5 items-center">
                  <button type="button" onClick={() => { setSimValue('420,00'); setSimDesc('Pix Recebido: Corrida Uber / 99 Drive'); }} className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-[10px] px-2 py-1 rounded cursor-pointer">🚗 Corrida Aplicativo</button>
                  <button type="button" onClick={() => { setSimValue('180,00'); setSimDesc('Pix Recebido: Serviço Passar Roupa'); }} className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-[10px] px-2 py-1 rounded cursor-pointer">🧺 Roupas A Domicílio</button>
                  <button type="button" onClick={() => { setSimValue('125,00'); setSimDesc('Pix Pago: Abastecimento Fox Posto'); }} className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-[10px] px-2 py-1 rounded cursor-pointer">⛽ Combustível Fox</button>
                </div>

                {/* GATILHO COMPATÍVEL COM O SISTEMA INTERATIVO DO APP.TSX */}
                <button type="button" onClick={() => {
                  const fBank = selectedSimAccount || bankAccounts[0];
                  const rawVal = parseFloat((simValue || '150,00').replace(/\./g, '').replace(',', '.'));
                  if (isNaN(rawVal) || rawVal <= 0) return;

                  // Dispara a simulação real para o App.tsx desenhar o banner e simular o Push
                  if (onTriggerNotification) {
                    onTriggerNotification({
                      banco: fBank ? fBank.nome : "BANCO",
                      tipo: (simDesc || '').toUpperCase().includes('PAGO') ? 'DESPESA' : 'RECEITA',
                      valor: rawVal,
                      descricao: simDesc || 'Nova transação Pix',
                      categoria: (simDesc || '').toUpperCase().includes('ABASTECIMENTO') ? 'ABASTECIMENTO' : 'PESSOAL',
                      accountId: fBank ? fBank.id : 1,
                      isCreditCard: false
                    });
                  }
                  if (onTriggerBankIntegration) {
                    onTriggerBankIntegration(fBank ? fBank.id : 1, rawVal, simDesc || 'Pix Recebido');
                  }
                }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-450 text-slate-950 font-bold text-xs font-mono uppercase cursor-pointer transition-all active:scale-95 shadow-md shadow-amber-500/10">
                  <span className="material-symbols-outlined text-sm font-bold">cell_tower</span>
                  Simular Push Pix
                </button>
              </div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>
                  <h4 className="text-xs font-bold text-slate-200 uppercase">Endpoint do Servidor (Webhook Ativo)</h4>
                </div>
                <button type="button" onClick={() => setShowRealIntegrationGuide(!showRealIntegrationGuide)} className="text-[10px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer">{showRealIntegrationGuide ? "Ocultar" : "Ver Script regex do MacroDroid?"}</button>
              </div>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2">
                <span className="material-symbols-outlined text-slate-500 text-sm font-mono shrink-0">link</span>
                <input type="text" readOnly value={`https://financas-gaeta-app.onrender.com/api/webhooks/bank`} className="w-full bg-transparent text-[10px] text-slate-300 font-mono outline-none border-none select-all" />
                <button type="button" onClick={() => {
                  navigator.clipboard.writeText(`https://financas-gaeta-app.onrender.com/api/webhooks/bank`); setCopied(true); setTimeout(() => setCopied(false), 2000);
                  if (showAlert) showAlert("Copiado!", "Endereço do webhook copiado com sucesso.");
                }} className="px-2.5 py-1 text-[10px] font-bold uppercase rounded bg-slate-800 text-slate-200 hover:bg-slate-750 shrink-0 cursor-pointer">{copied ? "Copiado!" : "Copiar"}</button>
              </div>

              {showRealIntegrationGuide && (
                <div className="space-y-3 text-[10.5px] text-slate-400 border-t border-slate-900 pt-3 font-sans">
                  <p className="font-bold text-amber-400">⚙️ Configuração do parsing de texto com Regular Expressions (Regex):</p>
                  <p>Configure a Requisição HTTP POST enviando o corpo bruto (Raw Body) com os parâmetros abaixo para processar os ganhos de corridas ou notificações do banco:</p>
                  <pre className="bg-slate-900 p-2.5 rounded-lg text-[9.5px] text-emerald-400 font-mono overflow-x-auto select-all">
{`{
  "text": "{not_body}",
  "banco": "Celular de Alexandre",
  "bancoId": 1
}`}
                  </pre>
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-2xl text-slate-400 text-center text-xs py-8">
          Módulo de metas e relatórios analíticos de orçamento ativo.
        </div>
      )}
    </div>
  );
}
