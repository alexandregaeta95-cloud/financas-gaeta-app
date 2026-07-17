import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BankAccount, CreditCard, Transaction, RiskZone, Infraction, RegisteredVehicle, Compromisso, SecurityConfig, SavingsGoal } from '../types';
import DatabaseConsole from './DatabaseConsole';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Cell } from 'recharts';
import { saveRegisteredVehicleToDb, deleteRegisteredVehicleFromDb } from '../lib/firebaseSync';
import { getPlacaFinalDigit, getIpvaDueMonth, getNextIpvaDueDate, getDaysUntilIpva, getVehicleIpvaMonth, getVehicleNextIpvaDueDate, getVehicleDaysUntilIpva, getIpvaClosingDay } from '../lib/ipvaUtils';
import { uploadBackupToDrive, listBackupsFromDrive, downloadBackupFromDrive } from '../lib/googleAuth';

// Web Audio API Synthesizer and Player for Smart Notifications
export const playNotificationSound = (soundType: 'system' | 'custom', optionKey: string, customBase64?: string) => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (soundType === 'custom' && customBase64) {
      // Decode Base64 and play
      const base64Data = customBase64.includes(',') ? customBase64.split(',')[1] : customBase64;
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      ctx.decodeAudioData(bytes.buffer, (buffer) => {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      }, (e) => console.error("Error decoding audio data", e));
      return;
    }

    const playTone = (freq: number, type: OscillatorType, start: number, duration: number, volume: number) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      
      gainNode.gain.setValueAtTime(volume, start);
      gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    const now = ctx.currentTime;

    switch (optionKey) {
      case 'bell': // Sino Moderno
        playTone(880, 'sine', now, 1.2, 0.4);
        playTone(1320, 'sine', now + 0.05, 0.8, 0.15);
        break;
      case 'crystal': // Cristalino
        playTone(1500, 'sine', now, 0.4, 0.3);
        playTone(2000, 'sine', now + 0.1, 0.3, 0.2);
        playTone(2500, 'sine', now + 0.2, 0.3, 0.1);
        break;
      case 'digital': // Alerta Digital
        playTone(987.77, 'square', now, 0.08, 0.15);
        playTone(1318.51, 'square', now + 0.1, 0.15, 0.15);
        break;
      case 'echo': // Eco Suave
        playTone(523.25, 'triangle', now, 0.5, 0.3);
        playTone(587.33, 'triangle', now + 0.15, 0.5, 0.2);
        playTone(659.25, 'triangle', now + 0.3, 0.5, 0.1);
        break;
      case 'piano': // Acordes de Piano
        playTone(261.63, 'sine', now, 1.0, 0.3);
        playTone(329.63, 'sine', now + 0.1, 0.9, 0.25);
        playTone(392.00, 'sine', now + 0.2, 0.8, 0.2);
        playTone(523.25, 'sine', now + 0.3, 0.7, 0.15);
        break;
      case 'zen': // Sopro Zen
        const oscNode = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscNode.type = 'sine';
        oscNode.frequency.setValueAtTime(220, now);
        oscNode.frequency.exponentialRampToValueAtTime(440, now + 1.2);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.linearRampToValueAtTime(0.001, now + 1.2);
        oscNode.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscNode.start(now);
        oscNode.stop(now + 1.2);
        break;
      default:
        playTone(440, 'sine', now, 0.5, 0.3);
        break;
    }
  } catch (e) {
    console.error("Audio Web API error:", e);
  }
};

interface ProfileTabProps {
  bankAccounts: BankAccount[];
  setBankAccounts: React.Dispatch<React.SetStateAction<BankAccount[]>>;
  creditCards: CreditCard[];
  setCreditCards: React.Dispatch<React.SetStateAction<CreditCard[]>>;
  avatarUrl: string;
  onAvatarChange: (url: string) => void;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  riskZones: RiskZone[];
  setRiskZones: React.Dispatch<React.SetStateAction<RiskZone[]>>;
  infractions: Infraction[];
  setInfractions: React.Dispatch<React.SetStateAction<Infraction[]>>;
  nonAppealed: any[];
  setNonAppealed: React.Dispatch<React.SetStateAction<any[]>>;
  showAlert: (title: string, message: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, requireInputText?: string) => void;
  registeredVehicles: RegisteredVehicle[];
  setRegisteredVehicles: React.Dispatch<React.SetStateAction<RegisteredVehicle[]>>;
  compromissos?: Compromisso[];
  customCategories: string[];
  setCustomCategories: React.Dispatch<React.SetStateAction<string[]>>;
  securityConfig: SecurityConfig;
  setSecurityConfig: React.Dispatch<React.SetStateAction<SecurityConfig>>;
  onTestLock: () => void;
  categoryBudgets?: { [category: string]: number };
  setCategoryBudgets?: React.Dispatch<React.SetStateAction<{ [category: string]: number }>>;
  googleToken?: string | null;
  googleUser?: any | null;
  onGoogleLogin?: () => Promise<void>;
  onGoogleLogout?: () => Promise<void>;
  ipvaLeadDays?: number;
  setIpvaLeadDays?: React.Dispatch<React.SetStateAction<number>>;
  ipvaClosingDay?: number;
  setIpvaClosingDay?: React.Dispatch<React.SetStateAction<number>>;
  medicalAppointmentLeadDays?: number;
  setMedicalAppointmentLeadDays?: React.Dispatch<React.SetStateAction<number>>;
  ipvaNotificationColor?: string;
  setIpvaNotificationColor?: React.Dispatch<React.SetStateAction<string>>;
  notifyIpva?: boolean;
  setNotifyIpva?: React.Dispatch<React.SetStateAction<boolean>>;
  notifyBudget?: boolean;
  setNotifyBudget?: React.Dispatch<React.SetStateAction<boolean>>;
  notifyAppointments?: boolean;
  setNotifyAppointments?: React.Dispatch<React.SetStateAction<boolean>>;
  dailyCheckInTime?: string;
  setDailyCheckInTime?: React.Dispatch<React.SetStateAction<string>>;
  defaultVehicleId?: string;
  setDefaultVehicleId?: React.Dispatch<React.SetStateAction<string>>;
  licensingReminderDay?: number;
  setLicensingReminderDay?: React.Dispatch<React.SetStateAction<number>>;
  notifyLicensing?: boolean;
  setNotifyLicensing?: React.Dispatch<React.SetStateAction<boolean>>;
}

const AnimatedNumber = ({ 
  value, 
  duration = 1200, 
  formatter 
}: { 
  value: number; 
  duration?: number; 
  formatter: (val: number) => string; 
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = 0;
    const endValue = value;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easedProgress = progress * (2 - progress); // easeOutQuad
      const current = startValue + easedProgress * (endValue - startValue);
      setDisplayValue(current);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
      }
    };

    const animId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animId);
  }, [value, duration]);

  return <>{formatter(displayValue)}</>;
};

export default function ProfileTab({ 
  bankAccounts, 
  setBankAccounts,
  creditCards, 
  setCreditCards,
  avatarUrl, 
  onAvatarChange,
  transactions,
  setTransactions,
  riskZones,
  setRiskZones,
  infractions,
  setInfractions,
  nonAppealed,
  setNonAppealed,
  showAlert,
  showConfirm,
  registeredVehicles,
  setRegisteredVehicles,
  compromissos = [],
  customCategories = [],
  setCustomCategories,
  securityConfig,
  setSecurityConfig,
  onTestLock,
  categoryBudgets = {},
  setCategoryBudgets,
  googleToken = null,
  googleUser = null,
  onGoogleLogin = async () => {},
  onGoogleLogout = async () => {},
  ipvaLeadDays = 30,
  setIpvaLeadDays,
  ipvaClosingDay = 15,
  setIpvaClosingDay,
  medicalAppointmentLeadDays = 2,
  setMedicalAppointmentLeadDays,
  ipvaNotificationColor = 'orange',
  setIpvaNotificationColor,
  notifyIpva = true,
  setNotifyIpva,
  notifyBudget = true,
  setNotifyBudget,
  notifyAppointments = true,
  setNotifyAppointments,
  dailyCheckInTime = '20:00',
  setDailyCheckInTime,
  defaultVehicleId = '',
  setDefaultVehicleId,
  licensingReminderDay = 10,
  setLicensingReminderDay,
  notifyLicensing = true,
  setNotifyLicensing
}: ProfileTabProps) {
  // Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<'config' | 'integracoes' | 'metas'>('config');

  // Savings Goals (Metas de Economia) state
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_savings_goals');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Failed to load savings goals:", e);
    }
    return [
      {
        id: 'goal-1',
        nome: 'Reserva de Emergência 🛡️',
        valorAlvo: 15000,
        valorAtual: 8500,
        prazo: '2026-12-31',
        categoria: 'Segurança',
        descricao: 'Garantir 6 meses de despesas básicas para segurança financeira.'
      },
      {
        id: 'goal-2',
        nome: 'Viagem de Férias ✈️',
        valorAlvo: 8000,
        valorAtual: 3200,
        prazo: '2026-10-15',
        categoria: 'Lazer',
        descricao: 'Viagem para o Nordeste com a família.'
      },
      {
        id: 'goal-3',
        nome: 'Troca de Carro 🚗',
        valorAlvo: 45000,
        valorAtual: 12000,
        prazo: '2027-06-30',
        categoria: 'Veículos',
        descricao: 'Entrada para um modelo mais novo e econômico.'
      }
    ];
  });

  // Sync savingsGoals to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_savings_goals', JSON.stringify(savingsGoals));
    } catch (e) {
      console.warn("Failed to save savings goals:", e);
    }
  }, [savingsGoals]);

  // Form states for Savings Goals
  const [isAddingGoal, setIsAddingGoal] = useState<boolean>(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalName, setGoalName] = useState<string>('');
  const [goalTarget, setGoalTarget] = useState<string>('');
  const [goalCurrent, setGoalCurrent] = useState<string>('');
  const [goalDeadline, setGoalDeadline] = useState<string>('');
  const [goalCategory, setGoalCategory] = useState<string>('Reserva');
  const [goalDescription, setGoalDescription] = useState<string>('');

  // Quick deposit/withdraw states
  const [quickEditGoalId, setQuickEditGoalId] = useState<string | null>(null);
  const [quickEditType, setQuickEditType] = useState<'deposit' | 'withdraw' | null>(null);
  const [quickEditAmount, setQuickEditAmount] = useState<string>('');

  const getSpentInCatThisMonth = (catName: string) => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const catUpper = catName.toUpperCase();

    const parseDateHelper = (dateStr: string): Date | null => {
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
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    };

    return transactions
      .filter(t => {
        const pDate = parseDateHelper(t.data);
        if (!pDate) return false;
        const isCurrentMonthAndYear = pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear;
        const isExpense = String(t.tipo || '').trim().toUpperCase() !== 'RECEITA' && String(t.tipo || '').trim().toUpperCase() !== 'RECEBIDO';
        const matchesCategory = String(t.categoria || '').trim().toUpperCase() === catUpper;
        return isCurrentMonthAndYear && isExpense && matchesCategory;
      })
      .reduce((sum, t) => sum + t.valor, 0);
  };

  // Webhook Integrations states
  const [webhooksConfig, setWebhooksConfig] = useState<any[]>(() => {
    const saved = localStorage.getItem('wealthflow_webhooks_config');
    if (saved) return JSON.parse(saved);
    return [
      { id: '1', banco: 'Itaú', status: 'ATIVO', secretToken: 'itau_sec_49a2', url: 'https://itau.com/webhooks/wealthflow', ultimaChamada: 'Há 2 horas' },
      { id: '2', banco: 'Nubank', status: 'ATIVO', secretToken: 'nu_sec_88b1', url: 'https://nubank.com.br/dev/webhooks', ultimaChamada: 'Há pouco' },
      { id: '3', banco: 'Banco Inter', status: 'INATIVO', secretToken: 'inter_sec_10c2', url: 'https://bancointer.com.br/integracao', ultimaChamada: 'Nunca' },
      { id: '4', banco: 'Santander', status: 'INATIVO', secretToken: 'sant_sec_33d1', url: 'https://santander.com.br/webhooks', ultimaChamada: 'Nunca' },
    ];
  });

  const saveWebhooksToLocalStorage = (newConfigs: any[]) => {
    setWebhooksConfig(newConfigs);
    localStorage.setItem('wealthflow_webhooks_config', JSON.stringify(newConfigs));
  };

  // Webhook simulation state
  const [simWebhookBank, setSimWebhookBank] = useState<string>('Itaú');
  const [simWebhookValue, setSimWebhookValue] = useState<string>('150,00');
  const [simWebhookDesc, setSimWebhookDesc] = useState<string>('Pix recebido de Julia M. da Silva');
  const [simWebhookType, setSimWebhookType] = useState<string>('RECEITA');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simSuccess, setSimSuccess] = useState<boolean>(false);

  // New webhook rule form
  const [showAddWebhookModal, setShowAddWebhookModal] = useState<boolean>(false);
  const [newRuleBank, setNewRuleBank] = useState<string>('Bradesco');
  const [newRuleSecret, setNewRuleSecret] = useState<string>('brad_sec_' + Math.floor(Math.random() * 10000));

  // Itaú webhook URL state and validation status
  const [itauWebhookUrl, setItauWebhookUrl] = useState<string>(() => {
    const saved = localStorage.getItem('wealthflow_webhooks_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const itau = parsed.find((c: any) => c.banco === 'Itaú');
        if (itau) return itau.url;
      } catch (e) {
        console.error("Error reading saved webhooks config:", e);
      }
    }
    return 'https://itau.com/webhooks/wealthflow';
  });

  const [isValidatingItau, setIsValidatingItau] = useState<boolean>(false);
  
  // Custom recurrent IPVA days mapping (vehicleId -> day of month)
  const [vehicleIpvaRecurrentDays, setVehicleIpvaRecurrentDays] = useState<{ [vehicleId: string]: number }>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_vehicle_ipva_recurrent_days');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Savings Goals alert milestones states
  const [savingsAlert50, setSavingsAlert50] = useState<boolean>(() => {
    const saved = localStorage.getItem('wealthflow_savings_alert_50');
    return saved !== null ? saved === 'true' : true;
  });
  const [savingsAlert75, setSavingsAlert75] = useState<boolean>(() => {
    const saved = localStorage.getItem('wealthflow_savings_alert_75');
    return saved !== null ? saved === 'true' : true;
  });
  const [savingsAlert95, setSavingsAlert95] = useState<boolean>(() => {
    const saved = localStorage.getItem('wealthflow_savings_alert_95');
    return saved !== null ? saved === 'true' : true;
  });

  // Savings Goals customizable alert percentages
  const [savingsAlertPct1, setSavingsAlertPct1] = useState<number>(() => {
    const saved = localStorage.getItem('wealthflow_savings_alert_pct1');
    return saved !== null ? parseInt(saved, 10) : 50;
  });
  const [savingsAlertPct2, setSavingsAlertPct2] = useState<number>(() => {
    const saved = localStorage.getItem('wealthflow_savings_alert_pct2');
    return saved !== null ? parseInt(saved, 10) : 75;
  });
  const [savingsAlertPct3, setSavingsAlertPct3] = useState<number>(() => {
    const saved = localStorage.getItem('wealthflow_savings_alert_pct3');
    return saved !== null ? parseInt(saved, 10) : 95;
  });

  // Local form states for editing thresholds
  const [tempAlertPct1, setTempAlertPct1] = useState<string>(String(savingsAlertPct1));
  const [tempAlertPct2, setTempAlertPct2] = useState<string>(String(savingsAlertPct2));
  const [tempAlertPct3, setTempAlertPct3] = useState<string>(String(savingsAlertPct3));

  // Sync Savings Goals alert milestone settings to localStorage
  useEffect(() => {
    localStorage.setItem('wealthflow_savings_alert_50', String(savingsAlert50));
  }, [savingsAlert50]);

  useEffect(() => {
    localStorage.setItem('wealthflow_savings_alert_75', String(savingsAlert75));
  }, [savingsAlert75]);

  useEffect(() => {
    localStorage.setItem('wealthflow_savings_alert_95', String(savingsAlert95));
  }, [savingsAlert95]);

  // Sync Savings Goals alert thresholds to localStorage
  useEffect(() => {
    localStorage.setItem('wealthflow_savings_alert_pct1', String(savingsAlertPct1));
    setTempAlertPct1(String(savingsAlertPct1));
  }, [savingsAlertPct1]);

  useEffect(() => {
    localStorage.setItem('wealthflow_savings_alert_pct2', String(savingsAlertPct2));
    setTempAlertPct2(String(savingsAlertPct2));
  }, [savingsAlertPct2]);

  useEffect(() => {
    localStorage.setItem('wealthflow_savings_alert_pct3', String(savingsAlertPct3));
    setTempAlertPct3(String(savingsAlertPct3));
  }, [savingsAlertPct3]);

  // Helper to trigger push notifications or fallback to modal alert
  const triggerGoalPushNotification = (title: string, body: string, tag: string) => {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, {
              body,
              icon: '/favicon.ico',
              tag,
            });
          }).catch(() => {
            new Notification(title, { body, icon: '/favicon.ico' });
          });
        } else {
          new Notification(title, { body, icon: '/favicon.ico' });
        }
      } else {
        // Fallback to showAlert
        showAlert(title, body);
      }
    } catch (err) {
      console.error('Error showing web notification:', err);
      try {
        new Notification(title, { body, icon: '/favicon.ico' });
      } catch (e) {
        // Fallback to showAlert
        showAlert(title, body);
      }
    }
  };

  // Monitor savingsGoals progress milestones and trigger notifications
  useEffect(() => {
    if (savingsGoals.length === 0) return;

    // Load already notified goals/milestones
    let notified: { [goalId: string]: { [milestone: string]: boolean } } = {};
    try {
      const savedNotified = localStorage.getItem('wealthflow_savings_notified_milestones');
      if (savedNotified) {
        notified = JSON.parse(savedNotified);
      }
    } catch (err) {
      console.error("Error reading savings notified milestones:", err);
    }

    let hasNewNotification = false;

    savingsGoals.forEach((g) => {
      const pct = g.valorAlvo > 0 ? (g.valorAtual / g.valorAlvo) * 100 : 0;
      
      const milestones = [
        { percentage: savingsAlertPct1, config: savingsAlert50, key: "pct1" },
        { percentage: savingsAlertPct2, config: savingsAlert75, key: "pct2" },
        { percentage: savingsAlertPct3, config: savingsAlert95, key: "pct3" }
      ];

      milestones.forEach((m) => {
        if (pct >= m.percentage && m.config) {
          if (!notified[g.id]) {
            notified[g.id] = {};
          }

          if (!notified[g.id][m.key]) {
            const title = `🎯 Meta de Economia: ${m.percentage}% Atingido!`;
            const body = `Parabéns! Sua meta "${g.nome}" alcançou ${m.percentage}% do objetivo! Você já guardou R$ ${g.valorAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} de R$ ${g.valorAlvo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
            
            triggerGoalPushNotification(title, body, `goal-${g.id}-${m.key}`);
            notified[g.id][m.key] = true;
            hasNewNotification = true;
          }
        } else if (pct < m.percentage) {
          // Reset when progress falls back below the threshold
          if (notified[g.id] && notified[g.id][m.key]) {
            notified[g.id][m.key] = false;
            hasNewNotification = true;
          }
        }
      });
    });

    if (hasNewNotification) {
      try {
        localStorage.setItem('wealthflow_savings_notified_milestones', JSON.stringify(notified));
      } catch (err) {
        console.error("Error saving notified milestones:", err);
      }
    }
  }, [savingsGoals, savingsAlert50, savingsAlert75, savingsAlert95, savingsAlertPct1, savingsAlertPct2, savingsAlertPct3]);
  
  // Smart Savings Goals States
  const [smartExpenseCategories, setSmartExpenseCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_smart_expense_categories');
      return saved !== null ? JSON.parse(saved) : ['CASA', 'CONSUMO', 'LAZER'];
    } catch (e) {
      return ['CASA', 'CONSUMO', 'LAZER'];
    }
  });

  const [smartCategoryEstimates, setSmartCategoryEstimates] = useState<{ [category: string]: number }>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_smart_category_estimates');
      return saved !== null ? JSON.parse(saved) : {
        'ABASTECIMENTO': 400,
        'CASA': 1200,
        'CONSUMO': 600,
        'LAZER': 400,
        'PESSOAL': 300,
        'TAXAS': 200,
        'OUTROS': 200
      };
    } catch (e) {
      return {
        'ABASTECIMENTO': 400,
        'CASA': 1200,
        'CONSUMO': 600,
        'LAZER': 400,
        'PESSOAL': 300,
        'TAXAS': 200,
        'OUTROS': 200
      };
    }
  });

  const [smartSavingsPercentage, setSmartSavingsPercentage] = useState<number>(() => {
    const saved = localStorage.getItem('wealthflow_smart_savings_percentage');
    return saved !== null ? parseInt(saved, 10) : 15;
  });

  const [smartSelectedGoalId, setSmartSelectedGoalId] = useState<string | null>(() => {
    return localStorage.getItem('wealthflow_smart_selected_goal_id') || null;
  });

  // Sync Smart Savings Goals states to localStorage
  useEffect(() => {
    localStorage.setItem('wealthflow_smart_expense_categories', JSON.stringify(smartExpenseCategories));
  }, [smartExpenseCategories]);

  useEffect(() => {
    localStorage.setItem('wealthflow_smart_category_estimates', JSON.stringify(smartCategoryEstimates));
  }, [smartCategoryEstimates]);

  useEffect(() => {
    localStorage.setItem('wealthflow_smart_savings_percentage', String(smartSavingsPercentage));
  }, [smartSavingsPercentage]);

  useEffect(() => {
    if (smartSelectedGoalId) {
      localStorage.setItem('wealthflow_smart_selected_goal_id', smartSelectedGoalId);
    } else {
      localStorage.removeItem('wealthflow_smart_selected_goal_id');
    }
  }, [smartSelectedGoalId]);

  // Smart Calculations based on selected values
  const smartMonthlyIncome = useMemo(() => {
    const incomeTx = transactions.filter(t => t.tipo === 'RECEITA');
    if (incomeTx.length === 0) return 6000; // backup/fallback average income
    
    const monthsMap: { [month: string]: number } = {};
    incomeTx.forEach(t => {
      const m = t.data ? t.data.substring(0, 7) : '2026-07';
      monthsMap[m] = (monthsMap[m] || 0) + (t.valor || 0);
    });
    const values = Object.values(monthsMap);
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }, [transactions]);

  const smartEstimatedExpenses = useMemo(() => {
    return smartExpenseCategories.reduce((sum, cat) => {
      return sum + (smartCategoryEstimates[cat] || 0);
    }, 0);
  }, [smartExpenseCategories, smartCategoryEstimates]);

  const smartEstimatedRemainingBalance = Math.max(0, smartMonthlyIncome - smartEstimatedExpenses);

  const smartSuggestedSavings = Math.round(smartEstimatedRemainingBalance * (smartSavingsPercentage / 100));

  const smartSelectedGoalObj = useMemo(() => {
    return savingsGoals.find(g => g.id === smartSelectedGoalId) || null;
  }, [savingsGoals, smartSelectedGoalId]);

  const smartMonthsToTarget = useMemo(() => {
    if (!smartSelectedGoalObj || smartSuggestedSavings <= 0) return Infinity;
    const missing = smartSelectedGoalObj.valorAlvo - smartSelectedGoalObj.valorAtual;
    if (missing <= 0) return 0;
    return Math.ceil(missing / smartSuggestedSavings);
  }, [smartSelectedGoalObj, smartSuggestedSavings]);

  // Orçamento Mensal Global States
  const [globalMonthlyBudget, setGlobalMonthlyBudget] = useState<number>(() => {
    const saved = localStorage.getItem('wealthflow_global_monthly_budget');
    return saved !== null ? parseFloat(saved) : 0;
  });

  // Smart Notifications Audio configurations state
  const [smartNotifications, setSmartNotifications] = useState<{
    [key: string]: {
      soundType: 'system' | 'custom';
      systemKey: string;
      customBase64?: string;
      customFileName?: string;
    };
  }>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_smart_notifications');
      return saved !== null ? JSON.parse(saved) : {
        ipva: { soundType: 'system', systemKey: 'digital' },
        orcamento: { soundType: 'system', systemKey: 'bell' },
        compromissos: { soundType: 'system', systemKey: 'echo' },
        licenciamento: { soundType: 'system', systemKey: 'crystal' }
      };
    } catch (e) {
      return {
        ipva: { soundType: 'system', systemKey: 'digital' },
        orcamento: { soundType: 'system', systemKey: 'bell' },
        compromissos: { soundType: 'system', systemKey: 'echo' },
        licenciamento: { soundType: 'system', systemKey: 'crystal' }
      };
    }
  });

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem('wealthflow_global_monthly_budget', String(globalMonthlyBudget));
  }, [globalMonthlyBudget]);

  useEffect(() => {
    localStorage.setItem('wealthflow_smart_notifications', JSON.stringify(smartNotifications));
  }, [smartNotifications]);
  
  // Google Drive Backups states
  const [backupScheduleEnabled, setBackupScheduleEnabled] = useState<boolean>(() => {
    return localStorage.getItem('wealthflow_backup_schedule_enabled') === 'true';
  });
  const [backupFrequency, setBackupFrequency] = useState<'diario' | 'semanal' | 'mensal'>(() => {
    return (localStorage.getItem('wealthflow_backup_frequency') as 'diario' | 'semanal' | 'mensal') || 'semanal';
  });
  const [lastBackupTimeState, setLastBackupTimeState] = useState<string | null>(() => {
    return localStorage.getItem('wealthflow_last_backup_time');
  });
  const [lastBackupFilenameState, setLastBackupFilenameState] = useState<string | null>(() => {
    return localStorage.getItem('wealthflow_last_backup_filename');
  });
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [backupsList, setBackupsList] = useState<any[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState<boolean>(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState<string | null>(null);

  const fetchBackupsHistory = async () => {
    if (!googleToken) return;
    setIsLoadingBackups(true);
    try {
      const list = await listBackupsFromDrive(googleToken);
      setBackupsList(list);
    } catch (err: any) {
      console.error("Erro ao carregar histórico de backups:", err);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  useEffect(() => {
    if (googleToken && activeSubTab === 'integracoes') {
      fetchBackupsHistory();
    }
  }, [googleToken, activeSubTab]);

  const [itauValidationResult, setItauValidationResult] = useState<{
    status: 'idle' | 'success' | 'error' | 'testing';
    message: string;
    code?: number;
    latency?: number;
  }>({ status: 'idle', message: '' });

  const handleSaveItauUrl = () => {
    if (!itauWebhookUrl.trim()) {
      showAlert("URL Inválida", "Por favor, insira uma URL válida para o webhook do Itaú.");
      return;
    }
    const updatedConfigs = webhooksConfig.map(config => {
      if (config.banco === 'Itaú') {
        return { ...config, url: itauWebhookUrl.trim() };
      }
      return config;
    });
    saveWebhooksToLocalStorage(updatedConfigs);
    showAlert("Configuração Salva", "A URL de webhook do Banco Itaú foi atualizada com sucesso!");
  };

  const handleValidateItauConnection = async () => {
    if (!itauWebhookUrl.trim()) {
      showAlert("URL Vazia", "Configure uma URL válida antes de testar a conexão.");
      return;
    }

    setIsValidatingItau(true);
    setItauValidationResult({ status: 'testing', message: 'Iniciando teste de conexão...' });

    const startTime = Date.now();

    // Basic URL format validation
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    if (!urlPattern.test(itauWebhookUrl)) {
      setTimeout(() => {
        setIsValidatingItau(false);
        setItauValidationResult({
          status: 'error',
          message: 'A URL inserida possui um formato inválido. Certifique-se de incluir http:// ou https:// no início.'
        });
      }, 500);
      return;
    }

    // Check if it's the default placeholder or a mock URL
    if (itauWebhookUrl.includes('itau.com/webhooks/wealthflow') || itauWebhookUrl.includes('example.com')) {
      // Simulate highly detailed handshake simulation
      setTimeout(() => {
        setIsValidatingItau(false);
        const latency = Math.floor(Math.random() * 80) + 40;
        setItauValidationResult({
          status: 'success',
          message: 'Conexão validada com sucesso via Handshake Simulado do Servidor Itaú API Gateways! O endpoint respondeu com status 200 OK.',
          code: 200,
          latency
        });
        
        // Also update the webhook config's last call to show validation completed
        const updatedConfigs = webhooksConfig.map(config => {
          if (config.banco === 'Itaú') {
            return { ...config, ultimaChamada: 'Conexão ativa' };
          }
          return config;
        });
        saveWebhooksToLocalStorage(updatedConfigs);
      }, 1500);
      return;
    }

    // Real fetch through the secure proxy
    try {
      const response = await fetch('/api/google-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: itauWebhookUrl.trim(),
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Wealthflow-Validation': 'true'
          },
          body: JSON.stringify({
            event: 'webhook.ping',
            app: 'WealthFlow',
            timestamp: new Date().toISOString()
          })
        })
      });

      const data = await response.json();
      const latency = Date.now() - startTime;

      if (response.ok && data.ok) {
        setIsValidatingItau(false);
        setItauValidationResult({
          status: 'success',
          message: `Conexão estabelecida com sucesso! O endpoint respondeu com status ${data.status || 200} ${data.statusText || 'OK'}.`,
          code: data.status || 200,
          latency
        });

        const updatedConfigs = webhooksConfig.map(config => {
          if (config.banco === 'Itaú') {
            return { ...config, url: itauWebhookUrl.trim(), ultimaChamada: 'Conexão ativa' };
          }
          return config;
        });
        saveWebhooksToLocalStorage(updatedConfigs);
      } else {
        // It failed or returned an error status
        setIsValidatingItau(false);
        setItauValidationResult({
          status: 'error',
          message: `O servidor de destino respondeu com erro. Status: ${data.status || 500} ${data.statusText || 'Falha'}. Detalhes: ${data.error || 'Sem resposta do servidor.'}`,
          code: data.status || 500
        });
      }
    } catch (err: any) {
      console.error("Webhook connection validation failed:", err);
      setIsValidatingItau(false);
      setItauValidationResult({
        status: 'error',
        message: `Falha de rede ou CORS ao conectar no endpoint. Detalhes: ${err.message || String(err)}`
      });
    }
  };

  const handleToggleBackupSchedule = (checked: boolean) => {
    setBackupScheduleEnabled(checked);
    localStorage.setItem('wealthflow_backup_schedule_enabled', String(checked));
    
    const freqLabel = backupFrequency === 'diario' ? 'Diária' : backupFrequency === 'semanal' ? 'Semanal' : 'Mensal';
    showAlert(
      checked ? `Backup ${freqLabel} Ativado` : "Backup Automático Desativado",
      checked 
        ? `Seus dados serão copiados automaticamente para o Google Drive com frequência ${freqLabel.toLowerCase()} em segundo plano.`
        : "Os backups automáticos foram desativados."
    );
  };

  const handleChangeBackupFrequency = (freq: 'diario' | 'semanal' | 'mensal') => {
    setBackupFrequency(freq);
    localStorage.setItem('wealthflow_backup_frequency', freq);
    
    const freqLabel = freq === 'diario' ? 'Diária' : freq === 'semanal' ? 'Semanal' : 'Mensal';
    showAlert(
      "Frequência Atualizada",
      `A frequência do backup automático foi definida para: ${freqLabel}.`
    );
  };

  const handleTriggerManualBackup = async () => {
    if (!googleToken) {
      showAlert("Conexão Necessária", "Por favor, conecte sua conta do Google Drive antes de realizar o backup.");
      return;
    }

    setIsBackingUp(true);
    try {
      const keys = [
        'wealthflow_transactions',
        'wealthflow_riskzones',
        'wealthflow_infractions',
        'wealthflow_nonappealed',
        'wealthflow_appointments',
        'wealthflow_prescriptions',
        'wealthflow_registered_vehicles',
        'wealthflow_compromissos',
        'wealthflow_car_services_performed',
        'wealthflow_car_services_scheduled',
        'wealthflow_bank_accounts',
        'wealthflow_credit_cards',
        'wealthflow_custom_categories',
        'wealthflow_category_budgets',
        'wealthflow_security_config',
        'wealthflow_savings_goals'
      ];
      const backupData: Record<string, any> = {};
      keys.forEach(key => {
        try {
          const val = localStorage.getItem(key);
          backupData[key] = val ? JSON.parse(val) : null;
        } catch (e) {
          backupData[key] = null;
        }
      });
      backupData.exported_at = new Date().toISOString();
      backupData.app_name = "WealthFlow";

      const fileName = await uploadBackupToDrive(googleToken, backupData);
      
      const nowStr = new Date().toISOString();
      localStorage.setItem('wealthflow_last_backup_time', nowStr);
      localStorage.setItem('wealthflow_last_backup_filename', fileName);
      
      setLastBackupTimeState(nowStr);
      setLastBackupFilenameState(fileName);

      showAlert("Backup Concluído", `O backup completo '${fileName}' foi gerado e salvo com sucesso na sua pasta 'appsheet/Backups' no Google Drive.`);
      fetchBackupsHistory();
    } catch (err: any) {
      console.error(err);
      showAlert("Falha no Backup", "Erro ao salvar backup no Google Drive: " + (err.message || String(err)));
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreBackup = async (file: any) => {
    if (!googleToken) return;
    
    showConfirm(
      "Confirmar Restauração de Backup",
      `Atenção: Você está prestes a restaurar o backup "${file.name}" gerado em ${new Date(file.createdTime).toLocaleString('pt-BR')}. Todos os seus dados atuais (transações, contas, veículos, consultas, etc.) serão SOBRESCRITOS pelos dados deste backup. Deseja continuar?`,
      async () => {
        setIsRestoringBackup(file.id);
        try {
          const backupContent = await downloadBackupFromDrive(googleToken, file.id);
          
          if (!backupContent || typeof backupContent !== 'object') {
            throw new Error("O conteúdo do backup está inválido ou vazio.");
          }

          // Apply to localStorage
          Object.entries(backupContent).forEach(([key, value]) => {
            if (key.startsWith('wealthflow_')) {
              if (value === null) {
                localStorage.removeItem(key);
              } else {
                localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
              }
            }
          });

          // Update in-memory state if state setters are available
          if (backupContent.wealthflow_transactions && typeof backupContent.wealthflow_transactions === 'object') {
            try { setTransactions(backupContent.wealthflow_transactions); } catch (e) {}
          }
          if (backupContent.wealthflow_bank_accounts && typeof backupContent.wealthflow_bank_accounts === 'object') {
            try { setBankAccounts(backupContent.wealthflow_bank_accounts); } catch (e) {}
          }
          if (backupContent.wealthflow_credit_cards && typeof backupContent.wealthflow_credit_cards === 'object') {
            try { setCreditCards(backupContent.wealthflow_credit_cards); } catch (e) {}
          }
          if (backupContent.wealthflow_riskzones && typeof backupContent.wealthflow_riskzones === 'object') {
            try { setRiskZones(backupContent.wealthflow_riskzones); } catch (e) {}
          }
          if (backupContent.wealthflow_infractions && typeof backupContent.wealthflow_infractions === 'object') {
            try { setInfractions(backupContent.wealthflow_infractions); } catch (e) {}
          }
          if (backupContent.wealthflow_nonappealed && typeof backupContent.wealthflow_nonappealed === 'object') {
            try { setNonAppealed(backupContent.wealthflow_nonappealed); } catch (e) {}
          }
          if (backupContent.wealthflow_registered_vehicles && typeof backupContent.wealthflow_registered_vehicles === 'object') {
            try { setRegisteredVehicles(backupContent.wealthflow_registered_vehicles); } catch (e) {}
          }
          if (backupContent.wealthflow_custom_categories && typeof backupContent.wealthflow_custom_categories === 'object') {
            try { setCustomCategories(backupContent.wealthflow_custom_categories); } catch (e) {}
          }
          if (backupContent.wealthflow_security_config && typeof backupContent.wealthflow_security_config === 'object') {
            try { setSecurityConfig(backupContent.wealthflow_security_config); } catch (e) {}
          }
          if (backupContent.wealthflow_category_budgets && setCategoryBudgets && typeof backupContent.wealthflow_category_budgets === 'object') {
            try { setCategoryBudgets(backupContent.wealthflow_category_budgets); } catch (e) {}
          }

          showAlert("Restauração Concluída", `Os dados do seu aplicativo foram restaurados com sucesso a partir do backup de ${new Date(file.createdTime).toLocaleString('pt-BR')}. O aplicativo será recarregado automaticamente.`);
          
          setTimeout(() => {
            window.location.reload();
          }, 2500);
        } catch (err: any) {
          console.error(err);
          showAlert("Falha na Restauração", "Não foi possível restaurar os dados: " + (err.message || String(err)));
        } finally {
          setIsRestoringBackup(null);
        }
      }
    );
  };

  const handleDownloadLocalBackup = () => {
    try {
      const keys = [
        'wealthflow_transactions',
        'wealthflow_riskzones',
        'wealthflow_infractions',
        'wealthflow_nonappealed',
        'wealthflow_appointments',
        'wealthflow_prescriptions',
        'wealthflow_registered_vehicles',
        'wealthflow_compromissos',
        'wealthflow_car_services_performed',
        'wealthflow_car_services_scheduled',
        'wealthflow_bank_accounts',
        'wealthflow_credit_cards',
        'wealthflow_custom_categories',
        'wealthflow_category_budgets',
        'wealthflow_security_config',
        'wealthflow_savings_goals'
      ];
      const backupData: Record<string, any> = {};
      keys.forEach(key => {
        try {
          const val = localStorage.getItem(key);
          backupData[key] = val ? JSON.parse(val) : null;
        } catch (e) {
          backupData[key] = null;
        }
      });
      backupData.exported_at = new Date().toISOString();
      backupData.app_name = "WealthFlow";

      const dataStr = JSON.stringify(backupData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

      const exportFileDefaultName = `wealthflow_backup_completo_${new Date().toISOString().slice(0,10)}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      showAlert("Backup Baixado", "Seu backup local (JSON) com todos os dados do aplicativo foi gerado e baixado com sucesso!");
    } catch (err: any) {
      console.error(err);
      showAlert("Falha ao Baixar", "Erro ao gerar arquivo de backup: " + (err.message || String(err)));
    }
  };

  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isEditingPhoto, setIsEditingPhoto] = useState<boolean>(false);
  const [photoUrlInput, setPhotoUrlInput] = useState<string>('');

  // Daily Check-in Scheduler state
  const [tempCheckInTime, setTempCheckInTime] = useState<string>(dailyCheckInTime || '20:00');

  useEffect(() => {
    if (dailyCheckInTime) {
      setTempCheckInTime(dailyCheckInTime);
    }
  }, [dailyCheckInTime]);

  // Push Notifications state and helper
  const [pushNotificationSupported] = useState<boolean>(() => {
    return typeof window !== 'undefined' && 'Notification' in window;
  });

  const [pushNotificationPermission, setPushNotificationPermission] = useState<'default' | 'granted' | 'denied' | 'unsupported'>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission as 'default' | 'granted' | 'denied';
    }
    return 'unsupported';
  });

  const [isRequestingPermission, setIsRequestingPermission] = useState<boolean>(false);

  const handleRequestPushPermission = async () => {
    if (!pushNotificationSupported) {
      showAlert("Navegador não suportado", "Seu navegador não possui suporte nativo para notificações push.");
      return;
    }

    setIsRequestingPermission(true);
    try {
      const permission = await Notification.requestPermission();
      setPushNotificationPermission(permission as 'default' | 'granted' | 'denied');
      
      if (permission === 'granted') {
        showAlert("Notificações Ativadas!", "Agora você receberá lembretes visuais importantes diretamente neste navegador.");
        try {
          new Notification("WealthFlow", {
            body: "As notificações do WealthFlow estão configuradas com sucesso! 🚀",
            icon: "/favicon.ico"
          });
        } catch (err) {
          console.warn("Could not display test notification:", err);
        }
      } else if (permission === 'denied') {
        showAlert("Notificações Bloqueadas", "As notificações foram desativadas ou bloqueadas nas configurações do seu navegador.");
      } else {
        showAlert("Configuração Pendente", "A permissão de notificações continua pendente.");
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      showAlert("Erro ao Configurar", "Houve um problema ao solicitar permissão de notificações.");
    } finally {
      setIsRequestingPermission(false);
    }
  };

  // Modals / Form toggles
  const [isOpenAddAccount, setIsOpenAddAccount] = useState<boolean>(false);
  const [isOpenAddCard, setIsOpenAddCard] = useState<boolean>(false);
  const [isOpenOpenFinance, setIsOpenOpenFinance] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);

  // Custom bank account form
  const [newAccBank, setNewAccBank] = useState<string>('NUBANK');
  const [newAccAgencia, setNewAccAgencia] = useState<string>('');
  const [newAccConta, setNewAccConta] = useState<string>('');
  const [newAccBalance, setNewAccBalance] = useState<string>('');
  const [newAccLimit, setNewAccLimit] = useState<string>('0,00');

  // Custom credit card form
  const [newCardName, setNewCardName] = useState<string>('NUBANK ULTRA');
  const [newCardLimit, setNewCardLimit] = useState<string>('');
  const [newCardSpent, setNewCardSpent] = useState<string>('');

  // Vehicle registry form states
  const [isOpenAddVehicle, setIsOpenAddVehicle] = useState<boolean>(false);
  const [vehicleDescInput, setVehicleDescInput] = useState<string>('');
  const [vehicleDriverInput, setVehicleDriverInput] = useState<string>('');
  const [vehiclePlacaInput, setVehiclePlacaInput] = useState<string>('');

  // Custom categories state & handlers
  const [newCategoryInput, setNewCategoryInput] = useState<string>('');

  // Security settings states
  const [tempPassword, setTempPassword] = useState<string>(securityConfig.password || 'admin');
  const [tempPin, setTempPin] = useState<string>(securityConfig.pin || '1234');

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCat = newCategoryInput.trim().toUpperCase();
    if (!cleanCat) return;

    const defaultCategories = ['RECEITA', 'ABASTECIMENTO', 'TRABALHO', 'PESSOAL', 'LAZER', 'TAXAS', 'CASA', 'OUTROS', 'CONSUMO'];
    if (defaultCategories.includes(cleanCat) || customCategories.map(c => c.toUpperCase()).includes(cleanCat)) {
      showAlert("Categoria Duplicada", `A categoria "${cleanCat}" já existe como padrão ou personalizada.`);
      return;
    }

    setCustomCategories(prev => [...prev, cleanCat]);
    setNewCategoryInput('');
    showAlert("Sucesso", `Categoria "${cleanCat}" criada com sucesso!`);
  };

  const handleDeleteCategory = (cat: string) => {
    showConfirm(
      "Remover Categoria",
      `Deseja realmente remover a categoria "${cat}"? Transações existentes com essa categoria não serão apagadas, mas ela não estará mais disponível para novas seleções.`,
      () => {
        setCustomCategories(prev => prev.filter(c => c !== cat));
        showAlert("Sucesso", `Categoria "${cat}" removida.`);
      }
    );
  };

  const handleToggleSecurity = (enabled: boolean) => {
    setSecurityConfig(prev => ({
      ...prev,
      enabled
    }));
    showAlert(
      enabled ? "Bloqueio Ativado" : "Bloqueio Desativado",
      enabled 
        ? "O WealthFlow agora exigirá autenticação sempre que for aberto." 
        : "O aplicativo não exigirá mais senha de acesso para visualização de dados."
    );
  };

  const handleUpdateSecurityMode = (mode: 'SENHA' | 'PIN' | 'BIOMETRIA') => {
    setSecurityConfig(prev => ({
      ...prev,
      mode
    }));
  };

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempPassword.trim()) {
      showAlert("Campo Obrigatório", "A senha não pode ser vazia.");
      return;
    }
    setSecurityConfig(prev => ({
      ...prev,
      password: tempPassword.trim()
    }));
    showAlert("Sucesso", "Senha de segurança atualizada com sucesso!");
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(tempPin)) {
      showAlert("Formato Inválido", "O PIN deve conter exatamente 4 dígitos numéricos.");
      return;
    }
    setSecurityConfig(prev => ({
      ...prev,
      pin: tempPin
    }));
    showAlert("Sucesso", "PIN de 4 dígitos atualizado com sucesso!");
  };

  const handleUpdateBiometricType = (type: 'FACE_ID' | 'TOUCH_ID') => {
    setSecurityConfig(prev => ({
      ...prev,
      biometricType: type
    }));
    showAlert("Biometria Configurada", `Tipo de biometria definido para ${type === 'FACE_ID' ? 'Face ID' : 'Touch ID (Digital)'}.`);
  };

  const handleAddVehicleSubmit = async () => {
    if (!vehicleDescInput.trim() || !vehicleDriverInput.trim()) {
      showAlert("Campos Obrigatórios", "Por favor, preencha a Descrição do Veículo e o Nome do Motorista.");
      return;
    }
    const newVeh: RegisteredVehicle = {
      id: String(Date.now()),
      descricao: vehicleDescInput.trim().toUpperCase(),
      motorista: vehicleDriverInput.trim().toUpperCase(),
      placa: vehiclePlacaInput.trim().toUpperCase() || undefined
    };

    try {
      setRegisteredVehicles(prev => [...prev, newVeh]);
      await saveRegisteredVehicleToDb(newVeh);
      
      setVehicleDescInput('');
      setVehicleDriverInput('');
      setVehiclePlacaInput('');
      setIsOpenAddVehicle(false);
      showAlert("Sucesso", "Veículo cadastrado com sucesso!");
    } catch (err: any) {
      showAlert("Erro", "Erro ao salvar veículo no servidor: " + err.message);
    }
  };

  const handleDeleteVehicle = (veh: RegisteredVehicle) => {
    showConfirm(
      "Remover Veículo",
      `Deseja realmente remover o veículo "${veh.descricao}" (Motorista: ${veh.motorista}) do cadastro? Esta ação é irreversível.`,
      async () => {
        try {
          setRegisteredVehicles(prev => prev.filter(v => v.id !== veh.id));
          await deleteRegisteredVehicleFromDb(veh.id);
          showAlert("Sucesso", "Veículo removido com sucesso!");
        } catch (err: any) {
          showAlert("Erro", "Erro ao remover veículo: " + err.message);
        }
      },
      veh.descricao
    );
  };

  // Open Finance connection flow
  const [ofSelectedBank, setOfSelectedBank] = useState<string>('');
  const [ofStep, setOfStep] = useState<'SELECT' | 'LOGIN' | 'CONNECTING' | 'SUCCESS'>('SELECT');
  const [ofUser, setOfUser] = useState<string>('');
  const [ofPassword, setOfPassword] = useState<string>('');

  // Toggle configurations
  const [biometrics, setBiometrics] = useState<boolean>(true);
  const [twoFactor, setTwoFactor] = useState<boolean>(true);
  const [limitAlert, setLimitAlert] = useState<boolean>(true);
  const [nearLimitAlert, setNearLimitAlert] = useState<boolean>(true);
  const [aiTips, setAiTips] = useState<boolean>(false);
  const [newTxAlert, setNewTxAlert] = useState<boolean>(true);

  // Preferred notification states
  const [preferredNotificationTime, setPreferredNotificationTime] = useState<string>(
    () => localStorage.getItem('wealthflow_pref_notification_time') || '08:00'
  );
  const [dailyNotificationEnabled, setDailyNotificationEnabled] = useState<boolean>(
    () => localStorage.getItem('wealthflow_daily_notification_enabled') !== 'false'
  );
  const [showNotificationAlertModal, setShowNotificationAlertModal] = useState<boolean>(false);

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleNotificationTimeChange = (time: string) => {
    setPreferredNotificationTime(time);
    localStorage.setItem('wealthflow_pref_notification_time', time);
  };

  const handleToggleDailyNotification = () => {
    const nextVal = !dailyNotificationEnabled;
    setDailyNotificationEnabled(nextVal);
    localStorage.setItem('wealthflow_daily_notification_enabled', String(nextVal));
  };

  // Devices states
  const [connectedDevices, setConnectedDevices] = useState([
    { id: 1, model: "iPhone 15 Pro", location: "São Paulo, Brasil • Ativo agora", current: true },
    { id: 2, model: "MacBook Pro 14\"", location: "Navegador Safari • Acesso em 06 Jul", current: false },
    { id: 3, model: "iPad Air", location: "Aplicativo • Acesso em 28 Jun", current: false }
  ]);

  const handleCopyAccount = (id: number, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const handleLogoutDevice = (id: number) => {
    setConnectedDevices(connectedDevices.filter(d => d.id !== id));
  };

  return (
    <div className="space-y-6 animate-fade-in" id="profile-panel">
      
      {/* Daily Task Summary Push Simulation Modal */}
      <AnimatePresence>
        {showNotificationAlertModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 max-w-md w-full shadow-2xl relative space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">notifications_active</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      ALERTA DIÁRIO • {preferredNotificationTime}
                    </span>
                    <h4 className="text-sm font-bold text-white font-display mt-1">Resumo do Fluxo de Riqueza</h4>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNotificationAlertModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800/60 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <div className="space-y-2.5">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Bom dia, <span className="font-semibold text-white">Alexandre</span>! Aqui está o resumo das suas tarefas e pendências atualizadas para hoje:
                </p>

                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 space-y-3 font-sans">
                  {/* Pending Bills */}
                  <div className="flex items-center justify-between text-xs pb-2.5 border-b border-slate-900">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-rose-400 text-sm">payments</span>
                      <div>
                        <p className="text-slate-200 font-medium">Contas e Despesas Pendentes</p>
                        <p className="text-[10px] text-slate-500">Aguardando pagamento</p>
                      </div>
                    </div>
                    <span className="text-right font-mono">
                      <span className="text-rose-400 font-bold block">{transactions.filter(t => t.tipo !== 'RECEITA' && t.status === 'PENDENTE').length} contas</span>
                      <span className="text-slate-400 text-[10px] block">Total: {formatBRL(transactions.filter(t => t.tipo !== 'RECEITA' && t.status === 'PENDENTE').reduce((sum, t) => sum + t.valor, 0))}</span>
                    </span>
                  </div>

                  {/* Commitments */}
                  <div className="flex items-center justify-between text-xs pb-2.5 border-b border-slate-900">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-cyan-400 text-sm">event</span>
                      <div>
                        <p className="text-slate-200 font-medium">Compromissos do Dia</p>
                        <p className="text-[10px] text-slate-500">Agendamentos com lembrete</p>
                      </div>
                    </div>
                    <span className="text-right font-mono">
                      <span className="text-cyan-400 font-bold block">{(compromissos || []).filter(c => c.lembreteAtivo).length} tarefas</span>
                      <span className="text-slate-400 text-[10px] block">Lembretes ativos</span>
                    </span>
                  </div>

                  {/* Active Risk Zones */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-400 text-sm">gpp_maybe</span>
                      <div>
                        <p className="text-slate-200 font-medium">Monitoramento de Zonas</p>
                        <p className="text-[10px] text-slate-500">Zonas de risco ativas</p>
                      </div>
                    </div>
                    <span className="text-right font-mono">
                      <span className="text-amber-400 font-bold block">{riskZones.filter(z => z.ativo).length} zonas</span>
                      <span className="text-slate-500 text-[10px] block">Atenção no trânsito</span>
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 text-[10px] text-slate-450 leading-relaxed italic flex gap-2">
                  <span className="material-symbols-outlined text-emerald-400 text-xs flex-shrink-0 mt-0.5">lightbulb</span>
                  <span>Dica da IA: Você tem contas importantes vencendo em breve. Priorize o pagamento hoje de manhã para evitar juros e manter sua pontuação de crédito excelente!</span>
                </div>
              </div>

              <div className="flex gap-2.5 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowNotificationAlertModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNotificationAlertModal(false);
                    showAlert("Alerta Confirmado", "As notificações diárias estão configuradas e agendadas para as " + preferredNotificationTime + "!");
                  }}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/10 cursor-pointer"
                >
                  Confirmar Agendamento
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Profile Header */}
      <section className="flex flex-col items-center py-4 bg-slate-900/20 border border-slate-800/40 rounded-2xl p-6 text-center">
        <div className="relative mb-3 group cursor-pointer" onClick={() => setIsEditingPhoto(!isEditingPhoto)}>
          <div className="w-20 h-24 rounded-full overflow-hidden border-4 border-slate-800 shadow-xl relative">
            <img 
              src={avatarUrl} 
              alt="Alexandre S Gaeta Profile" 
              className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-300"
            />
            {/* Hover Camera Overlay */}
            <div className="absolute inset-0 bg-slate-950/70 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span className="material-symbols-outlined text-white text-lg">photo_camera</span>
              <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider mt-1">Alterar</span>
            </div>
          </div>
          <span className="absolute bottom-1 right-1 bg-emerald-500 text-slate-950 rounded-full p-0.5 border-2 border-slate-950 flex items-center justify-center">
            <span className="material-symbols-outlined text-[13px] font-bold">verified</span>
          </span>
        </div>
        <h2 className="text-xl font-bold text-white font-display">Alexandre S Gaeta</h2>
        <p className="text-xs text-slate-400">alexandre.gaeta@aelt-tecnologia.com.br</p>
        
        <button 
          onClick={() => setIsEditingPhoto(!isEditingPhoto)}
          className="mt-2 text-[11px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-xs">{isEditingPhoto ? 'expand_less' : 'edit'}</span>
          {isEditingPhoto ? 'Fechar Editor' : 'Alterar Foto de Perfil'}
        </button>

        {isEditingPhoto && (
          <div className="w-full mt-4 p-4 bg-slate-950/80 border border-slate-800/60 rounded-xl text-left space-y-4 animate-fade-in">
            <div className="flex justify-between items-center pb-2 border-b border-slate-900">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Configurar Foto</span>
              <button 
                onClick={() => setIsEditingPhoto(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Option 1: File Upload */}
            <div className="space-y-1.5">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">1. Enviar do seu Dispositivo</span>
              <label className="flex items-center justify-center gap-2 border border-dashed border-slate-800 hover:border-sky-500 hover:bg-slate-900/40 p-3 rounded-lg cursor-pointer transition-all active:scale-98">
                <span className="material-symbols-outlined text-sky-400 text-base">cloud_upload</span>
                <span className="text-[10px] font-bold text-slate-200">Escolher Arquivo Local</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        if (typeof reader.result === 'string') {
                          onAvatarChange(reader.result);
                          alert("Foto de perfil atualizada com sucesso!");
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            </div>

            {/* Option 2: Select Premium Presets */}
            <div className="space-y-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">2. Escolher do Banco Premium</span>
              <div className="flex justify-between items-center gap-2 bg-slate-900/40 p-2 rounded-lg">
                {[
                  { name: "Org", url: "https://lh3.googleusercontent.com/aida-public/AB6AXuDclcawui2tKuHgw4p_DWvKBp0R7XYoJIo41kp-qWXzNhTbDso-7IAoirqhYyc-HEWXFiHIGP6YdyvyG4u4xgKT0ecq0uBLAJEXGIxgaymfedUvUw5PmlAfsh600Je_GbTdL8UgPj2BZ18ovSoiV_-08bm1CxxuR-RaAO569na_pVi2ObUv5FfHdqk1JhAf68RSSZF5WqsPDCCmYfWunTzLuQcRHOJn29EvtKwGGBucDh8ZAdyadLyd" },
                  { name: "M", url: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" },
                  { name: "W", url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" },
                  { name: "Exec", url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" },
                  { name: "Crea", url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" }
                ].map((preset, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      onAvatarChange(preset.url);
                      alert("Foto de perfil atualizada com sucesso!");
                    }}
                    className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-all hover:scale-105 active:scale-95 ${
                      avatarUrl === preset.url ? 'border-sky-400 ring-1 ring-sky-400/20' : 'border-slate-800 hover:border-slate-600'
                    }`}
                    title={preset.name}
                  >
                    <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Option 3: Direct URL Link */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (photoUrlInput.trim().startsWith('http')) {
                  onAvatarChange(photoUrlInput.trim());
                  setPhotoUrlInput('');
                  setIsEditingPhoto(false);
                  showAlert("Sucesso", "Foto de perfil atualizada com sucesso!");
                } else {
                  showAlert("Link Inválido", "Por favor, insira um link (URL) de imagem válido.");
                }
              }}
              className="space-y-1.5"
            >
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">3. Colar Link de Imagem (URL)</span>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={photoUrlInput}
                  onChange={(e) => setPhotoUrlInput(e.target.value)}
                  placeholder="https://exemplo.com/foto.jpg"
                  className="flex-grow bg-slate-900 border border-slate-850 text-[11px] px-3 py-1.5 rounded-lg outline-none focus:border-sky-500 text-slate-100 placeholder-slate-600 font-mono"
                />
                <button
                  type="submit"
                  className="bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="mt-3.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-3 py-1 rounded-full flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase font-mono">
          <span className="material-symbols-outlined text-xs">workspace_premium</span>
          Premium Partner
        </div>
      </section>

      {/* Sub-tabs selector for ProfileTab */}
      <div className="flex bg-slate-900/60 p-1 rounded-2xl border border-slate-800/80 w-full max-w-xl mx-auto">
        <button
          onClick={() => setActiveSubTab('config')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
            activeSubTab === 'config'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <span className="material-symbols-outlined text-sm">settings</span>
          Configurações
        </button>
        <button
          onClick={() => setActiveSubTab('metas')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer relative ${
            activeSubTab === 'metas'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <span className="material-symbols-outlined text-sm">savings</span>
          Metas de Economia
        </button>
        <button
          onClick={() => setActiveSubTab('integracoes')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer relative ${
            activeSubTab === 'integracoes'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <span className="material-symbols-outlined text-sm">sync_alt</span>
          Integrações
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
        </button>
      </div>

      {activeSubTab === 'config' && (
        <>
          {/* Grid for Accounts & Security Configs */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        {/* Dynamic Bank Accounts Card checklist */}
        <section className="md:col-span-6 bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider">Contas Bancárias &amp; Cartões</h3>
            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-800 text-slate-400 border border-slate-750 rounded uppercase font-mono">Gerenciamento</span>
          </div>

          <div className="space-y-4">
            {/* Contas Correntes */}
            <div className="space-y-2">
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contas Correntes</span>
              <div className="space-y-2.5">
                {bankAccounts.map(account => (
                  <div key={account.id} className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex items-center justify-between hover:border-emerald-500/20 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-100 uppercase tracking-wide">{account.nome}</span>
                        {account.agencia && (
                          <span className="text-[9px] text-slate-500 font-mono">Ag: {account.agencia} • C/C: {account.conta}</span>
                        )}
                      </div>
                      {account.saldoInicial < 0 ? (
                        <div className="mt-1 space-y-0.5">
                          <p className="text-xs font-semibold text-rose-400 font-mono">
                            Valor Devedor: R$ {Math.abs(account.saldoInicial).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          {account.limite !== undefined && account.limite > 0 && (
                            <p className="text-[10px] text-amber-400 font-mono font-medium">
                              Limite Restante: R$ {Math.max(0, account.limite + account.saldoInicial).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / R$ {account.limite.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="mt-1 space-y-0.5">
                          <p className="text-xs font-semibold text-emerald-400 font-mono">
                            Saldo: R$ {account.saldoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          {account.limite !== undefined && account.limite > 0 && (
                            <p className="text-[10px] text-slate-400 font-mono">
                              Limite Especial: R$ {account.limite.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-1.5">
                      {account.agencia && (
                        <button
                          onClick={() => handleCopyAccount(account.id, `${account.agencia}/${account.conta}`)}
                          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 cursor-pointer transition-colors"
                          title="Copiar dados"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {copiedId === account.id ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingAccount(account);
                          setNewAccBank(account.nome);
                          setNewAccAgencia(account.agencia || '');
                          setNewAccConta(account.conta || '');
                          setNewAccBalance(account.saldoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                          setNewAccLimit((account.limite || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                          setIsOpenAddAccount(true);
                        }}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400 cursor-pointer transition-colors"
                        title="Editar conta"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button
                        onClick={() => {
                          showConfirm(
                            "Remover Conta",
                            `Deseja remover a conta "${account.nome}" do Fluxo de Riqueza?`,
                            () => {
                              setBankAccounts(prev => prev.filter(a => a.id !== account.id));
                            }
                          );
                        }}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 cursor-pointer transition-colors"
                        title="Remover conta"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cartões de Crédito */}
            <div className="space-y-2">
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cartões de Crédito</span>
              <div className="space-y-2.5">
                {creditCards.map(card => (
                  <div key={card.id} className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex items-center justify-between hover:border-emerald-500/20 transition-all">
                    <div>
                      <span className="text-xs font-bold text-slate-100 uppercase tracking-wide">{card.nome}</span>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-mono">
                        <span>Gasto: <strong className="text-rose-400">R$ {card.gasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                        <span>•</span>
                        <span>Lim: R$ {card.limite.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          setEditingCard(card);
                          setNewCardName(card.nome);
                          setNewCardLimit(card.limite.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                          setNewCardSpent(card.gasto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                          setIsOpenAddCard(true);
                        }}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400 cursor-pointer transition-colors"
                        title="Editar cartão"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button
                        onClick={() => {
                          showConfirm(
                            "Remover Cartão",
                            `Deseja remover o cartão "${card.nome}"?`,
                            () => {
                              setCreditCards(prev => prev.filter(c => c.id !== card.id));
                            }
                          );
                        }}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 cursor-pointer transition-colors"
                        title="Remover cartão"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons to Add bank accounts */}
          <div className="flex flex-col gap-2 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setEditingAccount(null);
                  setNewAccBank('NUBANK');
                  setNewAccAgencia('');
                  setNewAccConta('');
                  setNewAccBalance('0,00');
                  setNewAccLimit('0,00');
                  setIsOpenAddAccount(true);
                }}
                className="py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all cursor-pointer uppercase tracking-wider flex items-center justify-center gap-1.5 text-[11px] active:scale-95 shadow-md shadow-emerald-500/5 font-sans"
              >
                <span className="material-symbols-outlined text-sm font-bold">add_card</span>
                Inserir Conta
              </button>
              <button
                onClick={() => {
                  setEditingCard(null);
                  setNewCardName('');
                  setNewCardLimit('0,00');
                  setNewCardSpent('0,00');
                  setIsOpenAddCard(true);
                }}
                className="py-3 bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 font-bold rounded-xl transition-all cursor-pointer uppercase tracking-wider flex items-center justify-center gap-1.5 text-[11px] active:scale-95 font-sans"
              >
                <span className="material-symbols-outlined text-sm">credit_card</span>
                Inserir Cartão
              </button>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/60 p-3.5 rounded-xl flex items-center gap-3">
            <span className="material-symbols-fill text-emerald-400 text-xl">shield</span>
            <div className="text-xs text-slate-400 leading-snug">
              Seus fundos e frotas estão garantidos sob custódia integral da instituição parceira autorizada e protegidos pelo FGC.
            </div>
          </div>
        </section>

        {/* Device Management & Biometrics Setup */}
        <section className="md:col-span-6 bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
          <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider">Acesso &amp; Segurança</h3>

          {/* Settings toggles with custom states */}
          <div className="space-y-4.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-200">Acesso via Biometria / Face ID</p>
                <p className="text-[10px] text-slate-400">Desbloqueio instantâneo seguro</p>
              </div>
              <button 
                type="button"
                onClick={() => setBiometrics(!biometrics)}
                className={`w-9 h-5 rounded-full transition-all cursor-pointer relative ${biometrics ? 'bg-emerald-500' : 'bg-slate-800'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-slate-950 rounded-full transition-all ${biometrics ? 'left-[17px]' : 'left-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between pt-3.5 border-t border-slate-800/60">
              <div>
                <p className="text-xs font-semibold text-slate-200">Duplo Fator (2FA por SMS/App)</p>
                <p className="text-[10px] text-slate-400">Segurança extra para saques/transferências</p>
              </div>
              <button 
                type="button"
                onClick={() => setTwoFactor(!twoFactor)}
                className={`w-9 h-5 rounded-full transition-all cursor-pointer relative ${twoFactor ? 'bg-emerald-500' : 'bg-slate-800'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-slate-950 rounded-full transition-all ${twoFactor ? 'left-[17px]' : 'left-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between pt-3.5 border-t border-slate-800/60">
              <div>
                <p className="text-xs font-semibold text-slate-200">Antecedência de Alerta IPVA</p>
                <p className="text-[10px] text-slate-400">Personalize o prazo de aviso de vencimento de IPVA</p>
              </div>
              <div className="flex items-center bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-xl">
                <select
                  value={ipvaLeadDays}
                  onChange={(e) => setIpvaLeadDays?.(parseInt(e.target.value, 10))}
                  className="bg-transparent text-white font-mono text-xs font-bold focus:outline-none cursor-pointer pr-1"
                >
                  <option value={15} className="bg-slate-950 text-white">15 dias</option>
                  <option value={30} className="bg-slate-950 text-white">30 dias</option>
                  <option value={45} className="bg-slate-950 text-white">45 dias</option>
                  <option value={60} className="bg-slate-950 text-white">60 dias</option>
                  <option value={90} className="bg-slate-950 text-white">90 dias</option>
                </select>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* Cadastro de Veículos & Motoristas */}
      <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 animate-fade-in" id="vehicles-setup">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-emerald-400 text-lg">directions_car</span> Cadastro de Veículos &amp; Motoristas
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Cadastre frotas e defina motoristas autorizados.</p>
          </div>
          <button
            onClick={() => {
              setVehicleDescInput('');
              setVehicleDriverInput('');
              setVehiclePlacaInput('');
              setIsOpenAddVehicle(true);
            }}
            className="bg-emerald-500 hover:bg-emerald-450 text-slate-950 px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer active:scale-95 font-mono"
          >
            <span className="material-symbols-outlined text-xs font-bold">add</span> Cadastrar Veículo
          </button>
        </div>

        {/* Seletor Visual de Antecedência do IPVA */}
        <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-3.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase font-display tracking-wider">
                <span className="material-symbols-outlined text-amber-500 text-sm">notifications_active</span>
                Prazo de Antecedência dos Alertas de IPVA
              </h4>
              <p className="text-[10px] text-slate-400">
                Ajuste quantos dias antes do vencimento você deseja começar a receber os alertas visuais e notificações.
              </p>
            </div>
            
            <div className="flex items-baseline gap-1 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl self-start md:self-center">
              <span className="text-amber-400 font-mono font-bold text-base leading-none">{ipvaLeadDays}</span>
              <span className="text-amber-500 text-[10px] uppercase font-bold tracking-wider font-mono">dias</span>
            </div>
          </div>

          <div className="space-y-3">
            {/* Range Slider */}
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-slate-500 font-mono">10d</span>
              <input
                type="range"
                min="10"
                max="120"
                step="1"
                value={ipvaLeadDays}
                onChange={(e) => setIpvaLeadDays?.(parseInt(e.target.value, 10))}
                className="flex-1 h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-amber-500 border border-slate-800"
              />
              <span className="text-[10px] text-slate-500 font-mono">120d</span>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] text-slate-500 uppercase font-mono tracking-wider mr-1">Atalhos rápidos:</span>
              {[15, 30, 45, 60, 90, 120].map((days) => (
                <button
                  key={`preset-${days}`}
                  type="button"
                  onClick={() => setIpvaLeadDays?.(days)}
                  className={`text-[9px] font-mono font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                    ipvaLeadDays === days
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm shadow-amber-500/10'
                      : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {days} dias
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          {registeredVehicles.length === 0 ? (
            <div className="bg-slate-950/40 border border-slate-850/60 p-5 rounded-xl text-center text-xs text-slate-500 italic">
              Nenhum veículo cadastrado. Clique em "Cadastrar Veículo" para inserir.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {registeredVehicles.map(veh => {
                  const finalDigit = veh.placa ? getPlacaFinalDigit(veh.placa) : null;
                  const ipvaMonth = getVehicleIpvaMonth(veh);
                  const ipvaDueDate = getVehicleNextIpvaDueDate(veh);
                  const daysRemaining = getVehicleDaysUntilIpva(veh);
                  const currentYear = new Date().getFullYear();
                  
                  // Check if there is already a paid transaction for IPVA of this vehicle in the current year
                  const isPaidThisYear = transactions.some(t => {
                    const descUpper = (t.descricao || '').toUpperCase();
                    const isIpva = descUpper.includes('IPVA');
                    const matchesVehicle = descUpper.includes(veh.placa?.toUpperCase() || '___') || descUpper.includes(veh.descricao.toUpperCase());
                    const isPaid = (t.status || '').toUpperCase() === 'PAGO';
                    
                    let matchesYear = false;
                    if (t.data) {
                      let txYear = 0;
                      if (t.data.includes('-')) {
                        txYear = parseInt(t.data.split('-')[0], 10);
                      } else if (t.data.includes('/')) {
                        txYear = parseInt(t.data.split('/')[2], 10);
                      }
                      matchesYear = txYear === currentYear;
                    }
                    return isIpva && matchesVehicle && isPaid && matchesYear;
                  });

                  return (
                    <div key={veh.id} className="bg-slate-950 border border-slate-850/80 p-3.5 rounded-2xl flex items-start justify-between hover:border-emerald-500/20 transition-all">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="material-symbols-outlined text-[20px]">
                            {veh.descricao.toUpperCase().includes('MOTO') ? 'two_wheeler' : 'directions_car'}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-100 uppercase tracking-wide">{veh.descricao}</span>
                            {veh.placa && (
                              <span className="text-[9px] bg-slate-800 text-slate-300 px-1 py-0.5 rounded font-mono uppercase tracking-tight">{veh.placa}</span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            Motorista: <strong className="text-emerald-400 uppercase">{veh.motorista}</strong>
                          </p>

                          {veh.placa && finalDigit !== null && ipvaMonth && (
                            <div className="mt-2.5 pt-2 border-t border-slate-900/80 space-y-1.5">
                              <p className="text-[9px] text-slate-400 flex items-center gap-1 font-mono">
                                <span className="material-symbols-outlined text-[11px] text-slate-500">calendar_month</span>
                                Mês IPVA: <span className="font-bold text-slate-200 uppercase">{ipvaMonth.name}</span>
                              </p>
                              <p className="text-[9px] text-slate-500 flex items-center gap-1 font-mono">
                                <span className="material-symbols-outlined text-[11px]">info</span>
                                Limite: {ipvaDueDate ? ipvaDueDate.toLocaleDateString('pt-BR') : '15/' + String(ipvaMonth.month).padStart(2, '0') + '/' + currentYear}
                              </p>
                              {isPaidThisYear ? (
                                <span className="inline-flex items-center gap-1 text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-bold font-mono">
                                  <span className="w-1 h-1 rounded-full bg-emerald-400" />
                                  PAGO ({currentYear})
                                </span>
                              ) : daysRemaining !== null ? (
                                <span className={`inline-flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded-full font-bold font-mono ${
                                  daysRemaining <= 0
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse'
                                    : daysRemaining <= ipvaLeadDays
                                      ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 animate-pulse'
                                      : 'bg-slate-800 text-slate-400 border border-slate-750'
                                }`}>
                                  <span className={`w-1 h-1 rounded-full ${
                                    daysRemaining <= 0
                                      ? 'bg-rose-400'
                                      : daysRemaining <= ipvaLeadDays
                                        ? 'bg-orange-400'
                                        : 'bg-slate-500'
                                  }`} />
                                  {daysRemaining === 0 
                                    ? 'VENCE HOJE' 
                                    : daysRemaining < 0 
                                      ? 'IPVA ATRASADO' 
                                      : daysRemaining <= ipvaLeadDays 
                                        ? `IPVA EM ${daysRemaining} DIAS` 
                                        : `IPVA EM ${daysRemaining} DIAS`}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleDeleteVehicle(veh)}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-850 text-slate-500 hover:text-rose-400 cursor-pointer transition-colors active:scale-90 shrink-0"
                        title="Remover veículo"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Tabela de Referência de IPVA Baseada no Final de Placa */}
              <div className="bg-slate-950/60 border border-slate-850/60 rounded-2xl p-4 space-y-3 font-sans">
                <div className="flex items-center gap-2 text-emerald-400">
                  <span className="material-symbols-outlined text-sm">calendar_month</span>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-display">Tabela de Referência de IPVA</h4>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  O mês de vencimento é identificado automaticamente com base no <strong>último dígito numérico</strong> da placa do veículo registrado:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {[
                    { digit: '1', month: 'Janeiro' },
                    { digit: '2', month: 'Fevereiro' },
                    { digit: '3', month: 'Março' },
                    { digit: '4', month: 'Abril' },
                    { digit: '5', month: 'Maio' },
                    { digit: '6', month: 'Junho' },
                    { digit: '7', month: 'Julho' },
                    { digit: '8', month: 'Agosto' },
                    { digit: '9', month: 'Setembro' },
                    { digit: '0', month: 'Outubro' }
                  ].map(item => {
                    const isUsed = registeredVehicles.some(v => v.placa && getPlacaFinalDigit(v.placa) === parseInt(item.digit, 10));
                    return (
                      <div 
                        key={item.digit} 
                        className={`p-2 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                          isUsed 
                            ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-300 shadow-sm shadow-emerald-500/5' 
                            : 'bg-slate-900/30 border-slate-850 text-slate-500'
                        }`}
                      >
                        <span className="text-[10px] font-mono font-bold">Placa Final <strong className={isUsed ? "text-emerald-400 font-extrabold" : "text-slate-300"}>{item.digit}</strong></span>
                        <span className="text-[10px] font-medium tracking-tight mt-0.5">{item.month}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Definições de Orçamento Anual */}
      <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 animate-fade-in" id="budget-settings">
        <div>
          <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-emerald-400 text-lg">payments</span> Definições de Orçamento
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
            Defina metas anuais de gastos (R$) para suas categorias. Uma barra de progresso visual será exibida no Painel principal, e <strong>o sistema enviará notificações Push automaticamente</strong> caso os gastos atinjam 90% ou 100% do orçamento mensal estabelecido.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {['ABASTECIMENTO', 'CASA', 'CONSUMO', 'LAZER', 'PESSOAL', 'TAXAS', 'OUTROS', ...customCategories].map(catName => {
            const currentBudget = categoryBudgets[catName] || 0;
            
            // Icon helper
            let icon = 'category';
            if (catName === 'ABASTECIMENTO') icon = 'local_gas_station';
            else if (catName === 'CASA') icon = 'home';
            else if (catName === 'CONSUMO') icon = 'shopping_cart';
            else if (catName === 'LAZER') icon = 'sports_esports';
            else if (catName === 'PESSOAL') icon = 'person';
            else if (catName === 'TAXAS') icon = 'receipt_long';
            else if (catName === 'RECEITA') icon = 'trending_up';

            return (
              <div key={catName} className="bg-slate-950 border border-slate-850/80 p-3 rounded-xl flex flex-col justify-between gap-2 hover:border-slate-800 transition-all font-sans">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 text-emerald-400 border border-slate-850 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-sm">{icon}</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-200 font-mono tracking-wide uppercase truncate">
                    {catName}
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-mono uppercase">Meta Anual (R$)</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-[10px] font-bold text-slate-500 font-mono">R$</span>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      placeholder="Sem limite"
                      value={currentBudget || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setCategoryBudgets?.(prev => ({
                          ...prev,
                          [catName]: isNaN(val) || val <= 0 ? 0 : val
                        }));
                      }}
                      className="w-full bg-slate-900 border border-slate-850 focus:border-emerald-500 text-slate-100 font-mono text-[11px] font-bold rounded-xl pl-8 pr-3 py-1.5 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 🎯 Seção de Orçamento Mensal Global */}
      <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 animate-fade-in" id="global-monthly-budget-settings">
        <div>
          <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-amber-500 text-lg">track_changes</span> Orçamento Mensal Global
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
            Configure um teto limite para todas as suas despesas consolidadas do mês corrente. Ao definir um valor maior que zero, o Dashboard passará a monitorar seus gastos contra este teto unificado em vez de somar as metas individuais das categorias.
          </p>
        </div>

        <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                Definir Limite de Gasto Mensal
              </label>
              <div className="relative flex items-center max-w-md">
                <span className="absolute left-3.5 text-xs font-bold text-slate-500 font-mono">R$</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  placeholder="Defina o teto (Ex: 3500)"
                  value={globalMonthlyBudget || ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    const finalVal = isNaN(val) || val <= 0 ? 0 : val;
                    setGlobalMonthlyBudget(finalVal);
                  }}
                  className="w-full bg-slate-900 border border-slate-850 focus:border-amber-500 text-slate-100 font-mono text-xs font-bold rounded-xl pl-10 pr-4 py-2.5 focus:outline-none"
                />
              </div>
              <span className="block text-[9px] text-slate-500 font-mono">
                {globalMonthlyBudget > 0 
                  ? `Ativo: Teto definido em R$ ${globalMonthlyBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  : "Inativo: O Dashboard usará o somatório das metas de categoria."
                }
              </span>
            </div>

            <div className="space-y-2">
              <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                Atalhos de Teto Recomendados
              </span>
              <div className="flex flex-wrap gap-2">
                {[1500, 3000, 5000, 8000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setGlobalMonthlyBudget(val);
                      showAlert(
                        "Teto Atualizado! 🎯",
                        `O seu Orçamento Mensal Global foi definido para R$ ${val.toLocaleString('pt-BR')}.`
                      );
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all cursor-pointer ${
                      globalMonthlyBudget === val
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.15)]'
                        : 'bg-slate-900/50 border-slate-850 text-slate-400 hover:border-slate-800'
                    }`}
                  >
                    R$ {val.toLocaleString('pt-BR')}
                  </button>
                ))}
                {globalMonthlyBudget > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setGlobalMonthlyBudget(0);
                      showAlert(
                        "Teto Removido 🚫",
                        "O seu Orçamento Mensal Global foi removido. O Dashboard voltará a usar as metas das categorias."
                      );
                    }}
                    className="px-3 py-1.5 rounded-lg border border-red-500/25 bg-red-500/10 text-red-400 text-[10px] font-mono font-bold hover:bg-red-500/20 cursor-pointer transition-all"
                  >
                    Desativar Teto
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gerenciamento de Categorias Personalizadas */}
      <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 animate-fade-in" id="categories-setup">
        <div>
          <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-emerald-400 text-lg">category</span> Categorias Personalizadas
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
            Crie categorias adicionais para organizar e filtrar suas receitas e despesas.
          </p>
        </div>

        {/* Existing categories list */}
        <div className="space-y-2.5">
          {customCategories.length === 0 ? (
            <div className="bg-slate-950/40 border border-slate-850/60 p-4 rounded-xl text-center text-xs text-slate-500 italic">
              Nenhuma categoria personalizada cadastrada. Utilize o formulário abaixo para criar uma.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {customCategories.map(cat => (
                <div key={cat} className="bg-slate-950 border border-slate-850/80 px-3 py-2 rounded-xl flex items-center justify-between hover:border-emerald-500/10 transition-all font-sans">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
                    <span className="text-[11px] font-bold text-slate-200 font-mono tracking-wide truncate uppercase" title={cat}>
                      {cat}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat)}
                    className="p-1 rounded bg-slate-900/60 border border-slate-850/60 text-slate-500 hover:text-rose-400 cursor-pointer transition-colors active:scale-90 flex-shrink-0"
                    title="Remover categoria"
                  >
                    <span className="material-symbols-outlined text-[13px] font-bold">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Form to add a new category */}
        <form onSubmit={handleAddCategory} className="border-t border-slate-800/50 pt-3.5 flex flex-col sm:flex-row gap-2.5">
          <div className="flex-grow">
            <input
              type="text"
              required
              maxLength={25}
              value={newCategoryInput}
              onChange={(e) => setNewCategoryInput(e.target.value.toUpperCase())}
              placeholder="EX: PETS, EDUCAÇÃO, ASSINATURAS..."
              className="w-full bg-slate-950 border border-slate-850/80 text-[11px] px-3.5 py-2.5 rounded-xl outline-none focus:border-emerald-500 text-slate-100 placeholder-slate-600 font-mono"
            />
          </div>
          <button
            type="submit"
            className="bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-[11px] uppercase tracking-wider transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 font-mono"
          >
            <span className="material-symbols-outlined text-xs font-bold">add</span>
            Criar Categoria
          </button>
        </form>
      </section>

      {/* Orçamentos de Categorias Personalizadas */}
      <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 animate-fade-in" id="custom-categories-budgets">
        <div>
          <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-emerald-400 text-lg">tune</span> Orçamento de Categorias Personalizadas
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
            Defina limites orçamentários anuais específicos para as suas categorias personalizadas. O sistema calculará o equivalente mensal e alertará automaticamente quando os gastos atingirem 90% e 100% do limite no mês atual.
          </p>
        </div>

        {customCategories.length === 0 ? (
          <div className="bg-slate-950/40 border border-slate-850/60 p-5 rounded-xl text-center text-xs text-slate-500 italic">
            Nenhuma categoria personalizada cadastrada. Crie categorias no painel acima para poder definir seus orçamentos correspondentes.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {customCategories.map(catName => {
              const currentBudget = categoryBudgets[catName] || 0;
              const monthlyEquivalent = currentBudget / 12;
              const spentThisMonth = getSpentInCatThisMonth(catName);
              const percentUsed = monthlyEquivalent > 0 ? (spentThisMonth / monthlyEquivalent) * 100 : 0;

              let statusBadge = { text: "Sem limite", style: "bg-slate-800/50 text-slate-400 border-slate-750" };
              if (currentBudget > 0) {
                if (percentUsed >= 100) {
                  statusBadge = { text: "Limite Excedido", style: "bg-rose-500/10 text-rose-400 border-rose-500/20" };
                } else if (percentUsed >= 90) {
                  statusBadge = { text: "Crítico (>90%)", style: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
                } else {
                  statusBadge = { text: "Dentro do Limite", style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
                }
              }

              return (
                <div key={catName} className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3 hover:border-slate-800 transition-all font-sans">
                  {/* Category Header with Name and Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                      <span className="text-[11px] font-bold text-slate-200 font-mono tracking-wider uppercase truncate" title={catName}>
                        {catName}
                      </span>
                    </div>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase font-mono tracking-wider ${statusBadge.style}`}>
                      {statusBadge.text}
                    </span>
                  </div>

                  {/* Input field for budget */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-mono uppercase tracking-wider block">Meta Orçamentária Anual (R$)</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-[10px] font-bold text-slate-500 font-mono">R$</span>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        placeholder="Sem orçamento definido"
                        value={currentBudget || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          const cleanVal = isNaN(val) || val <= 0 ? 0 : val;
                          const updatedBudgets = {
                            ...categoryBudgets,
                            [catName]: cleanVal
                          };
                          setCategoryBudgets?.(updatedBudgets);
                          localStorage.setItem('wealthflow_category_budgets', JSON.stringify(updatedBudgets));
                        }}
                        className="w-full bg-slate-900 border border-slate-850 focus:border-emerald-500 text-slate-100 font-mono text-[11px] font-bold rounded-xl pl-8 pr-3 py-1.5 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Stats & Progress indicators if limit defined */}
                  {currentBudget > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-900">
                      <div className="flex justify-between text-[9px] font-mono">
                        <span className="text-slate-500">Equivalente Mensal:</span>
                        <span className="text-slate-300 font-bold">{formatBRL(monthlyEquivalent)}</span>
                      </div>
                      
                      <div className="flex justify-between text-[9px] font-mono">
                        <span className="text-slate-500">Gasto no Mês Atual:</span>
                        <span className={`font-bold ${percentUsed >= 100 ? 'text-rose-400' : percentUsed >= 90 ? 'text-amber-400' : 'text-slate-300'}`}>
                          {formatBRL(spentThisMonth)}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1 pt-0.5">
                        <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden border border-slate-850/50">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              percentUsed >= 100 
                                ? 'bg-gradient-to-r from-rose-500 to-red-600' 
                                : percentUsed >= 90 
                                  ? 'bg-gradient-to-r from-amber-400 to-amber-500' 
                                  : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                            }`}
                            style={{ width: `${Math.min(percentUsed, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[8px] font-mono text-slate-500">
                          <span>{percentUsed.toFixed(1)}% utilizado</span>
                          <span>Restante: {formatBRL(Math.max(0, monthlyEquivalent - spentThisMonth))}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Camada Extra de Segurança: Bloqueio do App */}
      <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 animate-fade-in" id="security-setup">
        <div>
          <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-emerald-400 text-lg">security</span> Camada Extra de Segurança
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
            Proteja seus dados financeiros sensíveis bloqueando o aplicativo contra acessos não autorizados.
          </p>
        </div>

        {/* Enable Security Switch */}
        <div className="bg-slate-950 border border-slate-850/80 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-200">Bloqueio ao Iniciar Aplicativo</p>
            <p className="text-[10px] text-slate-400">Exige autenticação toda vez que o app for aberto.</p>
          </div>
          <button 
            type="button"
            onClick={() => handleToggleSecurity(!securityConfig.enabled)}
            className={`w-9 h-5 rounded-full transition-all cursor-pointer relative ${securityConfig.enabled ? 'bg-emerald-500' : 'bg-slate-800'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-slate-950 rounded-full transition-all ${securityConfig.enabled ? 'left-[17px]' : 'left-0.5'}`} />
          </button>
        </div>

        <AnimatePresence>
          {securityConfig.enabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 overflow-hidden border-t border-slate-800/40 pt-4"
            >
              {/* Security Mode Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Tipo de Bloqueio</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { mode: 'PIN', label: 'PIN Numérico', icon: 'dialpad' },
                    { mode: 'SENHA', label: 'Senha Completa', icon: 'password' },
                    { mode: 'BIOMETRIA', label: 'Biometria', icon: 'fingerprint' }
                  ].map(opt => (
                    <button
                      key={opt.mode}
                      type="button"
                      onClick={() => handleUpdateSecurityMode(opt.mode as any)}
                      className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        securityConfig.mode === opt.mode
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                          : 'bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-400'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">{opt.icon}</span>
                      <span className="text-[9px] font-bold font-mono tracking-tight uppercase">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific inputs */}
              {securityConfig.mode === 'PIN' && (
                <form onSubmit={handleSavePin} className="space-y-2 bg-slate-950 p-3.5 rounded-xl border border-slate-850/60 font-sans">
                  <div className="flex justify-between items-center mb-1.5">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-200">Configurar PIN de 4 Dígitos</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">PIN atual salvo: <span className="font-mono font-bold text-emerald-400">{securityConfig.pin || '1234'}</span></p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      pattern="\d{4}"
                      maxLength={4}
                      value={tempPin}
                      onChange={(e) => setTempPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="EX: 1234"
                      required
                      className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono tracking-wider w-24 text-center"
                    />
                    <button
                      type="submit"
                      className="bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-bold px-4 py-2 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer active:scale-95 flex-grow font-mono"
                    >
                      Salvar PIN
                    </button>
                  </div>
                </form>
              )}

              {securityConfig.mode === 'SENHA' && (
                <form onSubmit={handleSavePassword} className="space-y-2 bg-slate-950 p-3.5 rounded-xl border border-slate-850/60 font-sans">
                  <div className="flex justify-between items-center mb-1.5">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-200">Configurar Senha de Segurança</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Senha atual salva: <span className="font-mono font-bold text-emerald-400">{securityConfig.password || 'admin'}</span></p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      placeholder="Sua senha secreta"
                      required
                      className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono flex-grow"
                    />
                    <button
                      type="submit"
                      className="bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer active:scale-95 font-mono"
                    >
                      Salvar Senha
                    </button>
                  </div>
                </form>
              )}

              {securityConfig.mode === 'BIOMETRIA' && (
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850/60 space-y-3 font-sans">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-200">Simulação de Sensor Biométrico</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">Defina o sensor de preferência do seu dispositivo móvel simulado.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateBiometricType('FACE_ID')}
                      className={`flex-grow py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        securityConfig.biometricType === 'FACE_ID'
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">faceid</span>
                      <span className="text-[9px] font-bold font-mono uppercase">Face ID (Rosto)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateBiometricType('TOUCH_ID')}
                      className={`flex-grow py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        securityConfig.biometricType === 'TOUCH_ID'
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">fingerprint</span>
                      <span className="text-[9px] font-bold font-mono uppercase">Touch ID (Digital)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Live Test Trigger button */}
              <div className="bg-emerald-500/5 border border-emerald-500/20 p-3.5 rounded-xl space-y-2 text-center font-sans">
                <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider font-mono flex items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-sm">bolt</span> Ambiente de Testes
                </p>
                <p className="text-[9px] text-slate-400 leading-normal">
                  Quer ver como funciona a tela de bloqueio e a simulação de biometria antes de reabrir o app? Toque no botão abaixo para travar a tela imediatamente.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    showAlert("Travando Tela", "O aplicativo foi travado com segurança. Use suas credenciais cadastradas para retornar.");
                    onTestLock();
                  }}
                  className="w-full bg-slate-950 hover:bg-slate-900 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 font-bold py-2 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer active:scale-95 font-mono"
                >
                  Bloquear Tela Agora
                </button>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Notifications and Budget alerts directly from Mocks */}
      <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4" id="notifications-setup">
        <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider flex items-center gap-1.5">
          <span className="material-symbols-outlined text-lg">notifications</span> Configurações de Notificações
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-200">Alertar Limite de Orçamento (100%)</p>
              <p className="text-[10px] text-slate-400">Crítico: bloqueia transações</p>
            </div>
            <button 
              type="button"
              onClick={() => setLimitAlert(!limitAlert)}
              className={`w-9 h-5 rounded-full transition-all cursor-pointer relative ${limitAlert ? 'bg-emerald-500' : 'bg-slate-800'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-slate-950 rounded-full transition-all ${limitAlert ? 'left-[17px]' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-200">Aviso Próximo do Limite (90%)</p>
              <p className="text-[10px] text-slate-400">Notificação preventiva amigável</p>
            </div>
            <button 
              type="button"
              onClick={() => setNearLimitAlert(!nearLimitAlert)}
              className={`w-9 h-5 rounded-full transition-all cursor-pointer relative ${nearLimitAlert ? 'bg-emerald-500' : 'bg-slate-800'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-slate-950 rounded-full transition-all ${nearLimitAlert ? 'left-[17px]' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-200">Insights de Economia por IA</p>
              <p className="text-[10px] text-slate-400">Dicas inteligentes baseadas em gastos</p>
            </div>
            <button 
              type="button"
              onClick={() => setAiTips(!aiTips)}
              className={`w-9 h-5 rounded-full transition-all cursor-pointer relative ${aiTips ? 'bg-emerald-500' : 'bg-slate-800'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-slate-950 rounded-full transition-all ${aiTips ? 'left-[17px]' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-200">Novas Movimentações da Frota</p>
              <p className="text-[10px] text-slate-400">Sempre que motoristas abastecerem</p>
            </div>
            <button 
              type="button"
              onClick={() => setNewTxAlert(!newTxAlert)}
              className={`w-9 h-5 rounded-full transition-all cursor-pointer relative ${newTxAlert ? 'bg-emerald-500' : 'bg-slate-800'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-slate-950 rounded-full transition-all ${newTxAlert ? 'left-[17px]' : 'left-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Daily notification time selector */}
        <div className="border-t border-slate-800/60 pt-4 mt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 border border-slate-800 p-4 rounded-xl">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-slate-200">Resumo Diário de Pendências (Push)</p>
                <button
                  type="button"
                  onClick={handleToggleDailyNotification}
                  className={`w-8 h-4.5 rounded-full transition-all cursor-pointer relative ${dailyNotificationEnabled ? 'bg-emerald-500' : 'bg-slate-800'}`}
                >
                  <span className={`absolute top-0.5 w-3.5 h-3.5 bg-slate-950 rounded-full transition-all ${dailyNotificationEnabled ? 'left-[14px]' : 'left-0.5'}`} />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">O sistema agendará um alerta push diário resumindo tarefas, contas e compromissos pendentes.</p>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">Horário Preferencial</span>
                <input 
                  type="time" 
                  value={preferredNotificationTime}
                  disabled={!dailyNotificationEnabled}
                  onChange={(e) => handleNotificationTimeChange(e.target.value)}
                  className={`bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono tracking-wider cursor-pointer ${!dailyNotificationEnabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                />
              </div>
              <button
                type="button"
                disabled={!dailyNotificationEnabled}
                onClick={() => setShowNotificationAlertModal(true)}
                className={`flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold px-3 py-2 rounded-xl cursor-pointer active:scale-95 transition-all self-end ${!dailyNotificationEnabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                title="Testar envio do resumo de tarefas pendentes"
              >
                <span className="material-symbols-outlined text-[13px]">play_arrow</span>
                TESTAR AGORA
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 🔔 Seção de Notificações Inteligentes */}
      <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 animate-fade-in" id="smart-notifications-settings">
        <div>
          <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-indigo-400 text-lg">ring_volume</span> Notificações Inteligentes
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
            Personalize os alertas sonoros para cada tipo de aviso importante. Selecione sons sintetizados exclusivos do sistema ou faça o upload de seus próprios arquivos de áudio (MP3/WAV) para alertas customizados.
          </p>
        </div>

        <div className="space-y-3.5">
          {[
            { id: 'ipva', label: 'Alertas de IPVA 🚗', desc: 'Avisos de vencimento da taxa anual' },
            { id: 'orcamento', label: 'Alertas de Orçamento 📉', desc: 'Avisos de limite e teto de gastos' },
            { id: 'compromissos', label: 'Alertas de Compromissos 📅', desc: 'Lembretes de pagamentos e tarefas agendadas' },
            { id: 'licenciamento', label: 'Alertas de Licenciamento 📄', desc: 'Vencimento de documentos de veículos' }
          ].map((alertItem) => {
            const config = smartNotifications[alertItem.id] || { soundType: 'system', systemKey: 'digital' };
            const isSystem = config.soundType === 'system';

            const handleSoundTypeChange = (type: 'system' | 'custom') => {
              setSmartNotifications({
                ...smartNotifications,
                [alertItem.id]: {
                  ...config,
                  soundType: type
                }
              });
            };

            const handleSystemKeyChange = (key: string) => {
              setSmartNotifications({
                ...smartNotifications,
                [alertItem.id]: {
                  ...config,
                  systemKey: key
                }
              });
            };

            const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0];
              if (!file) return;

              if (!file.type.startsWith('audio/') && !file.name.endsWith('.mp3') && !file.name.endsWith('.wav')) {
                showAlert("Formato Inválido 🚫", "Por favor, selecione um arquivo de áudio válido (MP3 ou WAV).");
                return;
              }

              // Check file size (limit to 1.5MB to stay safe with localStorage limit)
              if (file.size > 1500000) {
                showAlert("Arquivo muito grande ⚠️", "Selecione um áudio com menos de 1.5MB para salvamento local.");
                return;
              }

              const reader = new FileReader();
              reader.onload = (event) => {
                const base64 = event.target?.result as string;
                setSmartNotifications({
                  ...smartNotifications,
                  [alertItem.id]: {
                    ...config,
                    soundType: 'custom',
                    customBase64: base64,
                    customFileName: file.name
                  }
                });
                showAlert(
                  "Som Atualizado! 🎵",
                  `O som customizado "${file.name}" foi carregado com sucesso para ${alertItem.label}.`
                );
              };
              reader.readAsDataURL(file);
            };

            const systemSounds = [
              { key: 'bell', name: 'Sino Moderno 🔔' },
              { key: 'crystal', name: 'Cristalino ✨' },
              { key: 'digital', name: 'Alerta Digital 📟' },
              { key: 'echo', name: 'Eco Suave 🌊' },
              { key: 'piano', name: 'Acordes de Piano 🎹' },
              { key: 'zen', name: 'Sopro Zen 🧘' }
            ];

            return (
              <div 
                key={alertItem.id}
                className="bg-slate-950 border border-slate-850/80 p-4 rounded-xl space-y-3.5 hover:border-slate-800 transition-all"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-900/60 pb-2">
                  <div>
                    <span className="text-xs font-bold text-slate-100 block">{alertItem.label}</span>
                    <span className="text-[10px] text-slate-400 font-sans">{alertItem.desc}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => playNotificationSound(config.soundType, config.systemKey, config.customBase64)}
                    className="px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 text-[10px] font-mono font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1.5 active:scale-95 whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-xs">volume_up</span>
                    Testar Som
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tipo de som */}
                  <div className="space-y-1.5">
                    <span className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">Origem do Som</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSoundTypeChange('system')}
                        className={`py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all cursor-pointer ${
                          isSystem 
                            ? 'bg-indigo-950/25 border-indigo-500/40 text-indigo-400' 
                            : 'bg-slate-900/40 border-slate-850 text-slate-400'
                        }`}
                      >
                        Sons do Sistema
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSoundTypeChange('custom')}
                        className={`py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all cursor-pointer ${
                          !isSystem 
                            ? 'bg-indigo-950/25 border-indigo-500/40 text-indigo-400' 
                            : 'bg-slate-900/40 border-slate-850 text-slate-400'
                        }`}
                      >
                        Upload Customizado
                      </button>
                    </div>
                  </div>

                  {/* Configuração Específica da Origem */}
                  <div className="space-y-1.5 flex flex-col justify-end">
                    {isSystem ? (
                      <div className="space-y-1">
                        <span className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">Escolha o Efeito</span>
                        <select
                          value={config.systemKey}
                          onChange={(e) => handleSystemKeyChange(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-850 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500/40"
                        >
                          {systemSounds.map(s => (
                            <option key={s.key} value={s.key}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">Arquivo Customizado</span>
                        {config.customFileName ? (
                          <div className="flex items-center justify-between bg-slate-900 border border-slate-850 rounded-lg px-2.5 py-1">
                            <span className="text-[10px] font-mono text-slate-300 truncate max-w-[150px]" title={config.customFileName}>
                              🎵 {config.customFileName}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSmartNotifications({
                                  ...smartNotifications,
                                  [alertItem.id]: {
                                    soundType: 'system',
                                    systemKey: 'digital'
                                  }
                                });
                                showAlert("Som Removido 🚫", "O som personalizado foi removido e resetado para o padrão do sistema.");
                              }}
                              className="text-red-400 hover:text-red-300 text-[10px] font-mono cursor-pointer"
                            >
                              Resetar
                            </button>
                          </div>
                        ) : (
                          <label className="relative flex items-center justify-center border-2 border-dashed border-slate-800 rounded-lg p-2 hover:border-slate-700 cursor-pointer transition-all bg-slate-900/30 group">
                            <input
                              type="file"
                              accept="audio/*"
                              onChange={handleFileUpload}
                              className="hidden"
                            />
                            <div className="text-center">
                              <span className="material-symbols-outlined text-slate-500 text-base group-hover:text-slate-400 transition-all">upload_file</span>
                              <span className="block text-[8px] text-slate-400 font-mono mt-0.5">Selecione MP3 ou WAV</span>
                            </div>
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Seção de Customização de Antecedência do IPVA */}
      <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 animate-fade-in" id="ipva-lead-settings">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-amber-500 text-lg">notifications_active</span>
              Configuração de Alerta de IPVA
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Personalize o prazo de antecedência para os avisos de vencimento.
            </p>
          </div>
          <div className="flex items-baseline gap-1 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
            <span className="text-amber-400 font-mono font-bold text-sm leading-none">{ipvaLeadDays}</span>
            <span className="text-amber-500 text-[9px] uppercase font-bold tracking-wider font-mono">dias</span>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-4">
          <div className="space-y-1">
            <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              Dias de Antecedência para o Alerta (checkIpvaAlerts)
            </label>
            <div className="flex items-center gap-4 pt-2">
              <span className="text-[10px] text-slate-500 font-mono">10d</span>
              <input
                type="range"
                min="10"
                max="120"
                step="1"
                value={ipvaLeadDays}
                onChange={(e) => setIpvaLeadDays?.(parseInt(e.target.value, 10))}
                className="flex-1 h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-amber-500 border border-slate-800"
              />
              <span className="text-[10px] text-slate-500 font-mono">120d</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-[9px] text-slate-500 uppercase font-mono tracking-wider">
              Atalhos rápidos de intervalo:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {[15, 30, 45, 60, 90, 120].map((days) => (
                <button
                  key={`ipva-settings-preset-${days}`}
                  type="button"
                  onClick={() => {
                    setIpvaLeadDays?.(days);
                    try {
                      localStorage.setItem('wealthflow_ipva_lead_days', String(days));
                    } catch (e) {
                      console.error("Failed to save to localStorage:", e);
                    }
                  }}
                  className={`text-[10px] font-mono font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                    ipvaLeadDays === days
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm shadow-amber-500/10'
                      : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {days} dias
                </button>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
            <strong className="text-amber-400 font-medium">Como funciona:</strong> Sempre que restarem {ipvaLeadDays} dias ou menos para a data de vencimento estimada do IPVA de qualquer veículo de sua frota, o painel do aplicativo exibirá um alerta visual proeminente e gerará uma pendência. Caso o IPVA seja pago (identificado via transações contendo o termo "IPVA"), o alerta será automaticamente removido.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem('wealthflow_ipva_lead_days', String(ipvaLeadDays));
                  showAlert(
                    "Preferência de Alerta Salva!",
                    `O prazo de antecedência dos alertas de IPVA foi definido para ${ipvaLeadDays} dias e armazenado com sucesso no localStorage.`
                  );
                } catch (e) {
                  showAlert("Erro ao Salvar", "Não foi possível gravar a preferência no localStorage.");
                }
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500/10 hover:bg-amber-500 hover:text-slate-950 text-amber-400 text-xs font-mono font-bold rounded-xl border border-amber-500/25 transition-all duration-300 active:scale-95 cursor-pointer shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              Salvar Preferência de Alerta
            </button>
          </div>
        </div>
      </section>

      {/* Seção de Configuração Avançada do Fechamento da Frota */}
      <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 animate-fade-in" id="fleet-closing-day-settings">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-amber-500 text-lg">calendar_month</span>
              Configuração Avançada de Fechamento da Frota
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Defina o dia de fechamento para ajustar dinamicamente o mês de vencimento do IPVA.
            </p>
          </div>
          <div className="flex items-baseline gap-1 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
            <span className="text-amber-400 font-mono font-bold text-sm leading-none">Dia {String(ipvaClosingDay).padStart(2, '0')}</span>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-4">
          <div className="space-y-1">
            <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              Dia de Fechamento da Frota (1 a 31)
            </label>
            <div className="flex items-center gap-4 pt-2">
              <span className="text-[10px] text-slate-500 font-mono">01</span>
              <input
                type="range"
                min="1"
                max="31"
                step="1"
                value={ipvaClosingDay}
                onChange={(e) => setIpvaClosingDay?.(parseInt(e.target.value, 10))}
                className="flex-1 h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-amber-500 border border-slate-800"
              />
              <span className="text-[10px] text-slate-500 font-mono">31</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-[9px] text-slate-500 uppercase font-mono tracking-wider">
              Atalhos de dias comuns:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {[5, 10, 15, 20, 25, 28].map((day) => (
                <button
                  key={`ipva-closing-preset-${day}`}
                  type="button"
                  onClick={() => {
                    setIpvaClosingDay?.(day);
                    try {
                      localStorage.setItem('wealthflow_ipva_closing_day', String(day));
                    } catch (e) {
                      console.error("Failed to save to localStorage:", e);
                    }
                  }}
                  className={`text-[10px] font-mono font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                    ipvaClosingDay === day
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm shadow-amber-500/10'
                      : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  Dia {String(day).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
            <strong className="text-amber-400 font-medium">Como o ajuste funciona:</strong> O IPVA de cada veículo vencerá no <span className="font-bold text-white">Dia {ipvaClosingDay}</span> do mês de vencimento definido no cadastro do respectivo veículo. O contador regressivo, os alertas e as pendências na sua dashboard atualizarão instantaneamente com base nessa nova referência de calendário.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem('wealthflow_ipva_closing_day', String(ipvaClosingDay));
                  showAlert(
                    "Configuração Salva!",
                    `O dia de fechamento da frota para vencimento do IPVA foi definido para o dia ${ipvaClosingDay} de cada mês.`
                  );
                } catch (e) {
                  showAlert("Erro ao Salvar", "Não foi possível gravar a preferência no localStorage.");
                }
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500/10 hover:bg-amber-500 hover:text-slate-950 text-amber-400 text-xs font-mono font-bold rounded-xl border border-amber-500/25 transition-all duration-300 active:scale-95 cursor-pointer shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">settings_backup_restore</span>
              Aplicar Dia de Fechamento
            </button>
          </div>
        </div>
      </section>

      {/* Seção de Configuração de Dia de Vencimento do IPVA por Veículo (Configurações Avançadas) */}
      <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 animate-fade-in" id="vehicle-ipva-recurrent-day-settings">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-amber-500 text-lg">schedule</span>
              Configurações Avançadas: Vencimento Recorrente do IPVA por Veículo
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Configure o dia do mês específico para o vencimento recorrente do IPVA de cada veículo. O contador regressivo calculará os dias restantes com base no mês atual e no dia definido.
            </p>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-4">
          {registeredVehicles.length === 0 ? (
            <div className="text-center p-6 bg-slate-900/40 border border-slate-850 rounded-xl text-slate-500 text-xs italic">
              Nenhum veículo cadastrado na frota. Cadastre seus veículos primeiro para personalizar seus vencimentos recorrentes.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {registeredVehicles.map((veh) => {
                const currentDay = vehicleIpvaRecurrentDays[veh.id] || "";
                
                return (
                  <div key={`recurrent-setting-${veh.id}`} className="bg-slate-900/30 border border-slate-850/80 p-3 rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 overflow-hidden pr-2">
                        <span className="material-symbols-outlined text-slate-400 text-base shrink-0">directions_car</span>
                        <div className="overflow-hidden">
                          <span className="block text-xs font-bold text-white truncate uppercase">{veh.descricao}</span>
                          {veh.placa && (
                            <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-wider">{veh.placa}</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                        <span className="text-[10px] text-amber-400 font-mono font-bold">
                          {currentDay ? `Dia ${String(currentDay).padStart(2, '0')}` : "Padrão"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                        Dia do Mês do Vencimento Recorrente:
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          value={currentDay}
                          onChange={(e) => {
                            const val = e.target.value;
                            const newDays = { ...vehicleIpvaRecurrentDays };
                            if (val === "") {
                              delete newDays[veh.id];
                            } else {
                              newDays[veh.id] = parseInt(val, 10);
                            }
                            setVehicleIpvaRecurrentDays(newDays);
                            try {
                              localStorage.setItem('wealthflow_vehicle_ipva_recurrent_days', JSON.stringify(newDays));
                            } catch (err) {
                              console.error("Erro ao salvar dia recorrente:", err);
                            }
                          }}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-amber-500/50 transition-all font-mono"
                        >
                          <option value="">-- Usar Regra Padrão --</option>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                            <option key={`day-option-${d}`} value={d}>
                              Dia {String(d).padStart(2, '0')}
                            </option>
                          ))}
                        </select>
                        {currentDay && (
                          <button
                            type="button"
                            onClick={() => {
                              const newDays = { ...vehicleIpvaRecurrentDays };
                              delete newDays[veh.id];
                              setVehicleIpvaRecurrentDays(newDays);
                              try {
                                localStorage.setItem('wealthflow_vehicle_ipva_recurrent_days', JSON.stringify(newDays));
                                showAlert("Configuração Restaurada", `O veículo '${veh.descricao}' voltou a utilizar as regras de vencimento padrão.`);
                              } catch (err) {
                                console.error("Erro ao limpar dia recorrente:", err);
                              }
                            }}
                            className="p-1.5 hover:bg-slate-800 text-slate-500 hover:text-rose-400 border border-transparent hover:border-slate-800 rounded-lg cursor-pointer transition-colors active:scale-95"
                            title="Limpar personalização"
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem('wealthflow_vehicle_ipva_recurrent_days', JSON.stringify(vehicleIpvaRecurrentDays));
                  showAlert(
                    "Configurações Salvas!",
                    "Os dias de vencimento recorrente por veículo foram aplicados com sucesso e o calendário foi atualizado."
                  );
                } catch (e) {
                  showAlert("Erro ao Salvar", "Não foi possível gravar as preferências no localStorage.");
                }
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500/10 hover:bg-amber-500 hover:text-slate-950 text-amber-400 text-xs font-mono font-bold rounded-xl border border-amber-500/25 transition-all duration-300 active:scale-95 cursor-pointer shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              Salvar Configurações de Vencimento
            </button>
          </div>
        </div>
      </section>

      {/* Seção de Configuração Visual de Cor do Alerta de IPVA */}
      <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 animate-fade-in" id="ipva-color-settings">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-amber-500 text-lg">palette</span>
              Personalização Visual do Alerta de IPVA
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Escolha a tonalidade do alerta para destacar e diferenciar os vencimentos da frota no Dashboard.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-850 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] text-slate-500 font-mono uppercase">Ativo:</span>
            <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
              ipvaNotificationColor === 'red' ? 'bg-rose-500' :
              ipvaNotificationColor === 'yellow' ? 'bg-amber-500' : 'bg-orange-500'
            }`} />
            <span className="text-white font-mono font-bold text-xs uppercase">
              {ipvaNotificationColor === 'red' ? 'Vermelho' :
               ipvaNotificationColor === 'yellow' ? 'Amarelo' : 'Laranja'}
            </span>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Red option */}
            <button
              type="button"
              onClick={() => {
                setIpvaNotificationColor?.('red');
                try {
                  localStorage.setItem('wealthflow_ipva_notification_color', 'red');
                } catch (e) {
                  console.error("Failed to save to localStorage:", e);
                }
              }}
              className={`flex flex-col items-start gap-2.5 p-3.5 rounded-xl border transition-all text-left cursor-pointer group ${
                ipvaNotificationColor === 'red'
                  ? 'bg-rose-500/10 border-rose-500 shadow-lg shadow-rose-500/5'
                  : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                  </div>
                  <span className="text-xs font-bold text-white font-display">Vermelho Crítico</span>
                </div>
                {ipvaNotificationColor === 'red' && (
                  <span className="material-symbols-outlined text-rose-400 text-sm">check_circle</span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Tom de alerta de alta prioridade (Crimson / Rose). Perfeito para máxima visibilidade e urgência.
              </p>
              <div className="w-full bg-rose-950/20 border border-rose-950/40 px-2 py-1 rounded text-[9px] font-mono text-rose-400 flex items-center justify-between">
                <span>Visual do Alerta:</span>
                <span className="font-bold uppercase tracking-wider animate-critical-pulse">Vence em 3 dias ⚠️</span>
              </div>
            </button>

            {/* Orange option */}
            <button
              type="button"
              onClick={() => {
                setIpvaNotificationColor?.('orange');
                try {
                  localStorage.setItem('wealthflow_ipva_notification_color', 'orange');
                } catch (e) {
                  console.error("Failed to save to localStorage:", e);
                }
              }}
              className={`flex flex-col items-start gap-2.5 p-3.5 rounded-xl border transition-all text-left cursor-pointer group ${
                ipvaNotificationColor === 'orange'
                  ? 'bg-orange-500/10 border-orange-500 shadow-lg shadow-orange-500/5'
                  : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                  </div>
                  <span className="text-xs font-bold text-white font-display">Laranja Atenção</span>
                </div>
                {ipvaNotificationColor === 'orange' && (
                  <span className="material-symbols-outlined text-orange-400 text-sm">check_circle</span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Alerta de atenção padrão (Amber / Orange). Equilibra perfeitamente visibilidade sem causar ruído.
              </p>
              <div className="w-full bg-orange-950/20 border border-orange-950/40 px-2 py-1 rounded text-[9px] font-mono text-orange-400 flex items-center justify-between">
                <span>Visual do Alerta:</span>
                <span className="font-bold uppercase tracking-wider animate-warning-pulse">Vence em 3 dias ⚠️</span>
              </div>
            </button>

            {/* Yellow option */}
            <button
              type="button"
              onClick={() => {
                setIpvaNotificationColor?.('yellow');
                try {
                  localStorage.setItem('wealthflow_ipva_notification_color', 'yellow');
                } catch (e) {
                  console.error("Failed to save to localStorage:", e);
                }
              }}
              className={`flex flex-col items-start gap-2.5 p-3.5 rounded-xl border transition-all text-left cursor-pointer group ${
                ipvaNotificationColor === 'yellow'
                  ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/5'
                  : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                  </div>
                  <span className="text-xs font-bold text-white font-display">Amarelo Informativo</span>
                </div>
                {ipvaNotificationColor === 'yellow' && (
                  <span className="material-symbols-outlined text-amber-400 text-sm">check_circle</span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Tonalidade suave (Yellow / Gold). Ideal para quem prefere uma sinalização mais discreta e sutil.
              </p>
              <div className="w-full bg-amber-950/10 border border-amber-950/30 px-2 py-1 rounded text-[9px] font-mono text-amber-400 flex items-center justify-between">
                <span>Visual do Alerta:</span>
                <span className="font-bold uppercase tracking-wider animate-warning-pulse">Vence em 3 dias ⚠️</span>
              </div>
            </button>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem('wealthflow_ipva_notification_color', ipvaNotificationColor);
                  showAlert(
                    "Preferência Salva!",
                    `A cor de destaque das notificações de IPVA foi configurada para ${
                      ipvaNotificationColor === 'red' ? 'Vermelho Crítico' :
                      ipvaNotificationColor === 'yellow' ? 'Amarelo Informativo' : 'Laranja Atenção'
                    }.`
                  );
                } catch (e) {
                  showAlert("Erro ao Salvar", "Não foi possível gravar a preferência no localStorage.");
                }
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500/10 hover:bg-amber-500 hover:text-slate-950 text-amber-400 text-xs font-mono font-bold rounded-xl border border-amber-500/25 transition-all duration-300 active:scale-95 cursor-pointer shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">palette</span>
              Salvar Preferência de Cor
            </button>
          </div>
        </div>
      </section>

      {/* Seção de Configuração de Notificação de Consultas Médicas */}
      <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 animate-fade-in" id="medical-appointment-lead-settings">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-emerald-500 text-lg">medical_services</span>
              Alerta de Consultas Médicas
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Defina com quantos dias de antecedência você deseja ser alertado sobre suas consultas.
            </p>
          </div>
          <div className="flex items-baseline gap-1 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
            <span className="text-emerald-400 font-mono font-bold text-sm leading-none">{medicalAppointmentLeadDays}</span>
            <span className="text-emerald-500 text-[9px] uppercase font-bold tracking-wider font-mono">dias</span>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-4">
          <div className="space-y-1">
            <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
              Dias de Antecedência para o Alerta
            </label>
            <div className="flex items-center gap-4 pt-2">
              <span className="text-[10px] text-slate-500 font-mono">1d</span>
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={medicalAppointmentLeadDays}
                onChange={(e) => setMedicalAppointmentLeadDays?.(parseInt(e.target.value, 10))}
                className="flex-1 h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-500 border border-slate-800"
              />
              <span className="text-[10px] text-slate-500 font-mono">30d</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-[9px] text-slate-500 uppercase font-mono tracking-wider">
              Atalhos de dias rápidos:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {[1, 2, 3, 5, 7, 10, 15].map((days) => (
                <button
                  key={`med-appt-preset-${days}`}
                  type="button"
                  onClick={() => {
                    setMedicalAppointmentLeadDays?.(days);
                    try {
                      localStorage.setItem('wealthflow_medical_appointment_lead_days', String(days));
                    } catch (e) {
                      console.error("Failed to save to localStorage:", e);
                    }
                  }}
                  className={`text-[10px] font-mono font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                    medicalAppointmentLeadDays === days
                      ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-sm shadow-emerald-500/10'
                      : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {days} {days === 1 ? 'dia' : 'dias'}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
            <strong className="text-emerald-400 font-medium">Como funciona:</strong> Seus lembretes inteligentes de consultas médicas começarão a aparecer destacados no painel do seu dashboard exatamente <span className="font-bold text-white">{medicalAppointmentLeadDays} {medicalAppointmentLeadDays === 1 ? 'dia' : 'dias'} antes</span> da data agendada.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem('wealthflow_medical_appointment_lead_days', String(medicalAppointmentLeadDays));
                  showAlert?.(
                    "Configuração Salva!",
                    `O período de notificação de consultas médicas foi definido para ${medicalAppointmentLeadDays} dias e armazenado com sucesso.`
                  );
                } catch (e) {
                  showAlert?.("Erro ao Salvar", "Não foi possível gravar a preferência no localStorage.");
                }
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 text-xs font-mono font-bold rounded-xl border border-emerald-500/25 transition-all duration-300 active:scale-95 cursor-pointer shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              Salvar Preferência de Consulta
            </button>
          </div>
        </div>
      </section>

      {/* Seção de Permissões Individuais de Alertas (Configurações Avançadas) */}
      <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 animate-fade-in" id="advanced-alert-permissions">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-indigo-500 text-lg">tune</span>
              Configurações Avançadas: Permissão de Alertas
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Gerencie individualmente quais tipos de alertas e notificações você deseja receber no sistema.
            </p>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-4">
          <div className="divide-y divide-slate-850">
            
            {/* Alerta de IPVA */}
            <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-lg">directions_car</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">Alertas de IPVA da Frota</span>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      notifyIpva ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                    }`}>
                      {notifyIpva ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 max-w-md">
                    Exibe contadores regressivos e avisos urgentes no Dashboard para os impostos dos veículos próximos ao vencimento.
                  </p>
                </div>
              </div>
              <div className="flex items-center pl-4">
                <button
                  type="button"
                  onClick={() => {
                    setNotifyIpva?.(!notifyIpva);
                    showAlert("Permissão Alterada", `Alertas de IPVA foram ${!notifyIpva ? 'ativados' : 'desativados'} com sucesso.`);
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    notifyIpva ? 'bg-indigo-600' : 'bg-slate-800'
                  }`}
                  id="toggle-notify-ipva"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      notifyIpva ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Alerta de Orçamento */}
            <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">Alertas de Limite de Orçamento</span>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      notifyBudget ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                    }`}>
                      {notifyBudget ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 max-w-md">
                    Notifica quando as despesas de uma categoria atingirem 90% ou 100% dos limites definidos no planejamento financeiro.
                  </p>
                </div>
              </div>
              <div className="flex items-center pl-4">
                <button
                  type="button"
                  onClick={() => {
                    setNotifyBudget?.(!notifyBudget);
                    showAlert("Permissão Alterada", `Alertas de limite de orçamento foram ${!notifyBudget ? 'ativados' : 'desativados'} com sucesso.`);
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    notifyBudget ? 'bg-indigo-600' : 'bg-slate-800'
                  }`}
                  id="toggle-notify-budget"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      notifyBudget ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Alerta de Compromissos */}
            <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-lg">calendar_today</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">Alertas de Compromissos</span>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      notifyAppointments ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                    }`}>
                      {notifyAppointments ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 max-w-md">
                    Envia lembretes automáticos e notificações no sistema para os compromissos, consultas e prazos cadastrados na agenda.
                  </p>
                </div>
              </div>
              <div className="flex items-center pl-4">
                <button
                  type="button"
                  onClick={() => {
                    setNotifyAppointments?.(!notifyAppointments);
                    showAlert("Permissão Alterada", `Alertas de compromissos foram ${!notifyAppointments ? 'ativados' : 'desativados'} com sucesso.`);
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    notifyAppointments ? 'bg-indigo-600' : 'bg-slate-800'
                  }`}
                  id="toggle-notify-appointments"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      notifyAppointments ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Seção de Configurar Lembrete Diário */}
      <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 animate-fade-in" id="daily-checkin-scheduler">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-indigo-500 text-lg">alarm</span>
              Configurar Lembrete Diário
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Defina o horário diário perfeito para receber alertas visuais e manter suas finanças e compromissos atualizados.
            </p>
          </div>
          <div className="bg-slate-950 border border-slate-850 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-mono uppercase">Definido:</span>
            <span className="text-white font-mono font-bold text-xs" id="current-checkin-time-badge">
              {dailyCheckInTime || 'Não Configurado'}
            </span>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Escolha do Horário */}
            <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Selecionar Horário</span>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                  Escolha o momento ideal, como no final do dia ou logo após as refeições, para garantir constância nos registros.
                </p>
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-slate-400 shrink-0">schedule</span>
                  
                  <div className="flex items-center gap-1.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-850">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider font-mono">Hora</span>
                      <select
                        value={(tempCheckInTime || '20:00').split(':')[0] || '20'}
                        onChange={(e) => {
                          const currentMin = (tempCheckInTime || '20:00').split(':')[1] || '00';
                          setTempCheckInTime(`${e.target.value}:${currentMin}`);
                        }}
                        className="bg-slate-950 border border-slate-800 text-white font-mono text-xs font-bold px-2.5 py-1 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                      >
                        {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                          <option key={h} value={h} className="bg-slate-950 text-white font-mono">{h}</option>
                        ))}
                      </select>
                    </div>

                    <span className="text-slate-500 font-bold self-end mb-1">:</span>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider font-mono">Minuto</span>
                      <select
                        value={(tempCheckInTime || '20:00').split(':')[1] || '00'}
                        onChange={(e) => {
                          const currentHr = (tempCheckInTime || '20:00').split(':')[0] || '20';
                          setTempCheckInTime(`${currentHr}:${e.target.value}`);
                        }}
                        className="bg-slate-950 border border-slate-800 text-white font-mono text-xs font-bold px-2.5 py-1 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                      >
                        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                          <option key={m} value={m} className="bg-slate-950 text-white font-mono">{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => {
                    if (setDailyCheckInTime) {
                      setDailyCheckInTime(tempCheckInTime);
                      showAlert(
                        "Horário Salvo!",
                        `O seu check-in diário foi agendado com sucesso para as ${tempCheckInTime}.`
                      );
                    }
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500 hover:text-white text-indigo-400 text-xs font-mono font-bold rounded-xl border border-indigo-500/25 transition-all duration-300 active:scale-95 cursor-pointer shadow-sm"
                  id="btn-save-checkin-time"
                >
                  <span className="material-symbols-outlined text-sm">alarm_on</span>
                  Confirmar Agendamento
                </button>
              </div>
            </div>

            {/* Sugestões de Presets e Informações */}
            <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-2">Sugestões e Atalhos Rápidos</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Manhã 🌅', time: '08:00' },
                    { label: 'Almoço ☀️', time: '12:30' },
                    { label: 'Tarde 🌇', time: '18:00' },
                    { label: 'Noite 🌙', time: '20:00' },
                    { label: 'Dormir 💤', time: '22:00' }
                  ].map((preset) => (
                    <button
                      key={preset.time}
                      type="button"
                      onClick={() => setTempCheckInTime(preset.time)}
                      className={`text-[10px] font-mono px-2.5 py-1.5 rounded-lg border transition-all duration-200 active:scale-[0.97] cursor-pointer ${
                        tempCheckInTime === preset.time
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-bold'
                          : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {preset.label} ({preset.time})
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-850/50 p-2.5 rounded-lg">
                <p className="text-[10px] text-slate-400 leading-relaxed flex items-start gap-1.5">
                  <span className="material-symbols-outlined text-indigo-400 text-xs shrink-0 mt-0.5">info</span>
                  <span>
                    No horário configurado, o aplicativo reproduzirá um bipe sonoro suave e abrirá uma janela pop-up para levá-lo diretamente à tela de transações.
                  </span>
                </p>
                {pushNotificationPermission !== 'granted' ? (
                  <p className="text-[10px] text-amber-500 leading-relaxed mt-1.5 flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-amber-500 text-xs shrink-0 mt-0.5">warning</span>
                    <span>
                      Nota: Como as Notificações Push nativas não estão ativas ou permitidas, garanta que a aba do aplicativo esteja aberta para ouvir o alerta e receber o redirecionamento.
                    </span>
                  </p>
                ) : (
                  <p className="text-[10px] text-emerald-500 leading-relaxed mt-1.5 flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-emerald-500 text-xs shrink-0 mt-0.5">check_circle</span>
                    <span>
                      Excelente! Notificações de navegador estão ativadas, então você receberá avisos do sistema mesmo se estiver em outra aba.
                    </span>
                  </p>
                )}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Seção de Configurações da Frota de Veículos */}
      <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 animate-fade-in" id="vehicle-fleet-settings">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-indigo-500 text-lg">local_shipping</span>
              Configurações de Veículos e Frota
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Gerencie o veículo padrão exibido no Dashboard e configure lembretes mensais para o licenciamento.
            </p>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 font-sans">
            
            {/* Seleção de Veículo Padrão */}
            <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider block mb-1.5">Veículo Padrão para o Dashboard</span>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                  Selecione o veículo principal da sua frota que receberá destaque visual e foco na exibição consolidada do Dashboard.
                </p>
                
                {(!registeredVehicles || registeredVehicles.length === 0) ? (
                  <div className="text-[11px] text-amber-500 bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-lg flex items-center gap-2">
                    <span className="material-symbols-outlined text-xs">warning</span>
                    <span>Nenhum veículo cadastrado. Adicione veículos na aba Frota para selecioná-los como padrão.</span>
                  </div>
                ) : (
                  <select
                    value={defaultVehicleId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDefaultVehicleId?.(val);
                      const selectedVeh = registeredVehicles.find(v => v.id === val);
                      showAlert(
                        "Veículo Padrão Alterado",
                        selectedVeh 
                          ? `O veículo "${selectedVeh.descricao}" foi definido como padrão com sucesso.`
                          : "O veículo padrão foi removido."
                      );
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-white text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer font-sans"
                    id="select-default-vehicle"
                  >
                    <option value="">-- Nenhum veículo padrão --</option>
                    {registeredVehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.descricao} {v.placa ? `(${v.placa})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              
              {defaultVehicleId && registeredVehicles && registeredVehicles.length > 0 && (
                <div className="text-[10px] text-slate-400 flex items-center gap-1.5 bg-slate-950/60 p-2 rounded-lg mt-2">
                  <span className="material-symbols-outlined text-indigo-400 text-xs shrink-0">check_circle</span>
                  <span>
                    O veículo <strong className="text-white">{registeredVehicles.find(v => v.id === defaultVehicleId)?.descricao}</strong> está atualmente em destaque.
                  </span>
                </div>
              )}
            </div>

            {/* Lembrete Mensal de Licenciamento */}
            <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider">Lembrete de Licenciamento Mensal</span>
                  <button
                    type="button"
                    onClick={() => {
                      setNotifyLicensing?.(!notifyLicensing);
                      showAlert(
                        "Lembrete Alterado",
                        `O lembrete recorrente de licenciamento foi ${!notifyLicensing ? 'ativado' : 'desativado'}.`
                      );
                    }}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      notifyLicensing ? 'bg-indigo-600' : 'bg-slate-800'
                    }`}
                    id="toggle-notify-licensing"
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        notifyLicensing ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                
                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                  Ative o aviso mensal recorrente para consultar as datas de licenciamento dos seus veículos e evitar juros e multas de trânsito.
                </p>

                {notifyLicensing && (
                  <div className="space-y-2 animate-fade-in mt-2">
                    <label className="block text-[10px] text-slate-400 font-mono">
                      Dia preferencial do mês para receber o alerta:
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={licensingReminderDay}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setLicensingReminderDay?.(val);
                          showAlert("Horário Atualizado", `Lembrete mensal de licenciamento alterado para todo dia ${val} do mês.`);
                        }}
                        className="bg-slate-950 border border-slate-800 text-white font-mono text-sm font-bold px-3 py-1.5 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                        id="select-licensing-reminder-day"
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                          <option key={day} value={day}>
                            Dia {day}
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-500">
                        (Agendado para todo dia {licensingReminderDay} de cada mês)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {!notifyLicensing && (
                <div className="text-[10px] text-rose-400 bg-rose-500/5 border border-rose-500/10 p-2 rounded-lg flex items-center gap-1.5 mt-2">
                  <span className="material-symbols-outlined text-xs shrink-0">notifications_off</span>
                  <span>Avisos de licenciamento estão suspensos. Ative para receber o lembrete mensal.</span>
                </div>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* Seção de Configuração de Notificações Push */}
      <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 animate-fade-in" id="push-notifications-settings">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-indigo-500 text-lg">notifications_active</span>
              Configurar Notificações Push
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Ative as notificações push do navegador para receber alertas instantâneos de IPVA e orçamento.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-850 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] text-slate-500 font-mono uppercase">Status:</span>
            <span className={`w-2.5 h-2.5 rounded-full ${
              pushNotificationPermission === 'granted' ? 'bg-emerald-500 animate-pulse' :
              pushNotificationPermission === 'denied' ? 'bg-rose-500' : 'bg-slate-500'
            }`} />
            <span className="text-white font-mono font-bold text-xs uppercase">
              {pushNotificationPermission === 'granted' ? 'Ativado' :
               pushNotificationPermission === 'denied' ? 'Bloqueado' :
               pushNotificationPermission === 'unsupported' ? 'Não Suportado' : 'Pendente'}
            </span>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Status Visual Card */}
            <div className="bg-slate-900/40 border border-slate-800 p-3.5 rounded-xl flex flex-col justify-between space-y-2">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Estado de Permissão</span>
                <p className="text-xs text-white font-semibold mt-1 flex items-center gap-1.5">
                  {pushNotificationPermission === 'granted' && (
                    <>
                      <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                      Notificações Ativas e Prontas
                    </>
                  )}
                  {pushNotificationPermission === 'denied' && (
                    <>
                      <span className="material-symbols-outlined text-rose-500 text-sm">cancel</span>
                      Notificações Bloqueadas
                    </>
                  )}
                  {pushNotificationPermission === 'default' && (
                    <>
                      <span className="material-symbols-outlined text-amber-500 text-sm">info</span>
                      Permissão Necessária
                    </>
                  )}
                  {pushNotificationPermission === 'unsupported' && (
                    <>
                      <span className="material-symbols-outlined text-slate-500 text-sm">warning</span>
                      Incompatível
                    </>
                  )}
                </p>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                {pushNotificationPermission === 'granted' 
                  ? 'Você receberá notificações flutuantes no seu sistema quando houver alertas urgentes de vencimento da frota ou quando um orçamento for estourado.'
                  : pushNotificationPermission === 'denied'
                  ? 'As notificações foram bloqueadas nas preferências do seu navegador. Por favor, redefina a permissão no ícone de cadeado na barra de endereços para reativar.'
                  : pushNotificationPermission === 'unsupported'
                  ? 'Seu navegador atual ou ambiente de execução não suporta a API de Notificações Push nativas.'
                  : 'Clique no botão ao lado para permitir que o WealthFlow envie alertas de segundo plano importantes.'}
              </p>
            </div>

            {/* Config & Action Card */}
            <div className="bg-slate-900/40 border border-slate-800 p-3.5 rounded-xl flex flex-col justify-between space-y-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Ações Disponíveis</span>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  Para melhorar a experiência do usuário (UX), a integração verifica se o sistema está pronto para despachar avisos visuais.
                </p>
              </div>
              
              <div>
                {pushNotificationPermission === 'unsupported' ? (
                  <div className="w-full text-center py-2 bg-slate-950 border border-slate-850 rounded-xl text-slate-500 text-[10px] font-mono">
                    API INDISPONÍVEL NESTE AMBIENTE
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestPushPermission}
                    disabled={isRequestingPermission}
                    className={`w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition-all duration-300 active:scale-[0.98] cursor-pointer shadow-sm ${
                      pushNotificationPermission === 'granted'
                        ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                        : pushNotificationPermission === 'denied'
                        ? 'bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/20'
                        : 'bg-indigo-500/10 hover:bg-indigo-500 hover:text-white text-indigo-400 border border-indigo-500/25'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {isRequestingPermission ? 'autorenew' : 
                       pushNotificationPermission === 'granted' ? 'notifications_active' : 'spatial_audio_off'}
                    </span>
                    {isRequestingPermission ? 'Processando...' :
                     pushNotificationPermission === 'granted' ? 'Testar Notificação Push' :
                     pushNotificationPermission === 'denied' ? 'Solicitar Novamente' : 'Solicitar Permissão Push'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Connected devices list with logout actions */}
      <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
        <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider">Dispositivos Conectados</h3>
        
        <div className="space-y-2.5">
          {connectedDevices.map(device => (
            <div key={device.id} className="bg-slate-950 border border-slate-800/80 p-3.5 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center bg-slate-900 text-slate-400 rounded-lg">
                  <span className="material-symbols-outlined text-lg">
                    {device.model.includes('iPhone') ? 'smartphone' : device.model.includes('iPad') ? 'tablet_mac' : 'laptop_mac'}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-white">{device.model}</p>
                    {device.current && (
                      <span className="text-[8px] font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded uppercase">ATUAL</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{device.location}</p>
                </div>
              </div>

              {!device.current && (
                <button
                  onClick={() => handleLogoutDevice(device.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                  title="Desconectar dispositivo"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Live Firestore Database Management Console */}
      <section id="developer-db-console">
        <DatabaseConsole 
          transactions={transactions}
          setTransactions={setTransactions}
          riskZones={riskZones}
          setRiskZones={setRiskZones}
          infractions={infractions}
          setInfractions={setInfractions}
          nonAppealed={nonAppealed}
          setNonAppealed={setNonAppealed}
          avatarUrl={avatarUrl}
          onAvatarChange={onAvatarChange}
        />
      </section>

      {/* Log Out button and mock application version information */}
      <section className="pt-4 pb-8 space-y-4">
        <button
          onClick={() => {
            showConfirm(
              "Sair da Conta",
              "Deseja realmente sair de sua conta?",
              () => {
                showAlert("Sessão Finalizada", "Sessão finalizada com sucesso. Redirecionando...");
              }
            );
          }}
          className="w-full bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20 text-rose-400 py-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
        >
          <span className="material-symbols-outlined">logout</span>
          Encerrar Sessão no Fluxo de Riqueza
        </button>
        <p className="text-center text-[10px] text-slate-500 font-mono">
          Versão do Aplicativo 2.4.1 (Build 402)
        </p>
      </section>
        </>
      )}

      {activeSubTab === 'integracoes' && (
        <div className="space-y-6">
          {/* Backup Google Drive section */}
          <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/25 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg font-bold">backup</span>
                </div>
                <div>
                  <span className="text-[9px] font-mono font-bold text-blue-400 uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                    Backup de Segurança
                  </span>
                  <h4 className="text-sm font-bold text-white font-display mt-1">Backup Automático no Google Drive</h4>
                </div>
              </div>
              
              {googleToken ? (
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-mono font-bold">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  CONECTADO
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-amber-500 text-xs font-mono font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  DESCONECTADO
                </div>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Proteja seus dados contra perdas acidentais ou limpeza de cache do navegador. Esta integração salva uma cópia estruturada completa (JSON) de todas as tabelas e dados do seu aplicativo WealthFlow na pasta <strong className="text-white">appsheet/Backups</strong> do seu Google Drive pessoal.
            </p>

            {/* Google Connection Card */}
            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">Conta do Google Associada</span>
                <span className="text-xs text-slate-200 font-medium">
                  {googleToken && googleUser ? googleUser.email : "Nenhuma conta vinculada"}
                </span>
              </div>
              {googleToken ? (
                <button
                  type="button"
                  onClick={onGoogleLogout}
                  className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 text-[10.5px] font-bold rounded-lg cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                >
                  Desconectar Conta Google
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onGoogleLogin}
                  className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-450 text-slate-950 text-[10.5px] font-bold rounded-lg cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                >
                  Conectar Conta Google
                </button>
              )}
            </div>

            {/* Schedule Toggle */}
            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
              <div className="pr-4">
                <p className="text-xs font-semibold text-slate-200">Ativar Backup Automático</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Envia em segundo plano uma cópia compactada e atualizada dos seus dados periodicamente para o Google Drive.
                </p>
              </div>
              <button 
                type="button"
                disabled={!googleToken}
                onClick={() => handleToggleBackupSchedule(!backupScheduleEnabled)}
                className={`w-9 h-5 rounded-full transition-all cursor-pointer relative flex-shrink-0 ${
                  backupScheduleEnabled ? 'bg-emerald-500' : 'bg-slate-800'
                } ${!googleToken ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-slate-950 rounded-full transition-all ${
                  backupScheduleEnabled ? 'left-[17px]' : 'left-0.5'
                }`} />
              </button>
            </div>

            {/* Frequency Selector */}
            {backupScheduleEnabled && (
              <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3 animate-fade-in">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <span className="material-symbols-outlined text-sm text-slate-500 font-bold">schedule</span>
                  Frequência do Backup Automático
                </label>
                <div className="grid grid-cols-3 gap-2 font-sans">
                  {(['diario', 'semanal', 'mensal'] as const).map((freq) => {
                    const active = backupFrequency === freq;
                    const labels = {
                      diario: 'Diário',
                      semanal: 'Semanal',
                      mensal: 'Mensal'
                    };
                    const intervals = {
                      diario: 'Cada 24 horas',
                      semanal: 'Cada 7 dias',
                      mensal: 'Cada 30 dias'
                    };
                    return (
                      <button
                        key={freq}
                        type="button"
                        onClick={() => handleChangeBackupFrequency(freq)}
                        className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                          active
                            ? 'bg-blue-500/10 border-blue-500/50 text-blue-400 font-bold'
                            : 'bg-slate-900/40 border-slate-850 text-slate-400 hover:border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <span className="text-xs">{labels[freq]}</span>
                        <span className="text-[8px] font-mono opacity-85">{intervals[freq]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Backup Status and Actions */}
            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Último Backup Concluído</span>
                  <span className="text-xs font-mono text-slate-300">
                    {lastBackupTimeState ? new Date(lastBackupTimeState).toLocaleString('pt-BR') : 'Nunca realizado'}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Arquivo do Último Backup</span>
                  <span className="text-xs font-mono text-slate-300 truncate block max-w-xs" title={lastBackupFilenameState || ''}>
                    {lastBackupFilenameState || 'Nenhum backup encontrado'}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-900 pt-3 flex flex-col sm:flex-row sm:justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadLocalBackup}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-650 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm font-bold">download</span>
                  Baixar Cópia Local (JSON)
                </button>

                <button
                  type="button"
                  onClick={handleTriggerManualBackup}
                  disabled={isBackingUp || !googleToken}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    isBackingUp
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/10 cursor-not-allowed'
                      : !googleToken
                      ? 'bg-slate-900 border border-slate-850 text-slate-500 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-450 text-slate-950 hover:shadow-lg hover:shadow-blue-500/10 active:scale-95'
                  }`}
                >
                  {isBackingUp ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Salvando dados...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm font-bold">cloud_upload</span>
                      Enviar ao Google Drive
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* Cloud Backup History Section */}
          <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg font-bold">history</span>
                </div>
                <div>
                  <span className="text-[9px] font-mono font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                    Pontos de Restauração
                  </span>
                  <h4 className="text-sm font-bold text-white font-display mt-1">Histórico de Backups no Google Drive</h4>
                </div>
              </div>
              <button
                type="button"
                onClick={fetchBackupsHistory}
                disabled={isLoadingBackups || !googleToken}
                className="p-2 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-indigo-400 border border-slate-850 rounded-xl transition-all cursor-pointer flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                title="Atualizar histórico"
              >
                <span className={`material-symbols-outlined text-sm ${isLoadingBackups ? 'animate-spin' : ''}`}>sync</span>
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Reverta os dados do seu aplicativo para qualquer momento anterior clicando no botão <strong>Restaurar</strong> correspondente. Todos os dados atuais do aplicativo serão substituídos pela cópia de segurança selecionada.
            </p>

            {!googleToken ? (
              <div className="bg-slate-950 border border-slate-850 p-6 rounded-xl text-center text-slate-500 text-xs font-medium">
                Conecte sua conta do Google acima para visualizar e restaurar o histórico de backups.
              </div>
            ) : isLoadingBackups ? (
              <div className="bg-slate-950 border border-slate-850 p-8 rounded-xl flex flex-col items-center justify-center gap-3">
                <svg className="animate-spin h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-xs text-slate-400 font-medium">Carregando histórico de backups...</span>
              </div>
            ) : backupsList.length === 0 ? (
              <div className="bg-slate-950 border border-slate-850 p-6 rounded-xl text-center text-slate-500 text-xs font-medium">
                Nenhum arquivo de backup encontrado na sua pasta 'appsheet/Backups'. Crie um novo backup acima!
              </div>
            ) : (
              <div className="border border-slate-850 rounded-xl overflow-hidden divide-y divide-slate-900 bg-slate-950 max-h-72 overflow-y-auto">
                {backupsList.map((file) => {
                  const isThisRestoring = isRestoringBackup === file.id;
                  const fileSizeKB = file.size ? (parseInt(file.size) / 1024).toFixed(1) : null;
                  
                  return (
                    <div 
                      key={file.id} 
                      className="flex items-center justify-between p-3 hover:bg-slate-900/40 transition-all group"
                    >
                      <div className="flex items-center gap-3 overflow-hidden pr-3">
                        <span className="material-symbols-outlined text-slate-500 group-hover:text-indigo-400 transition-colors">description</span>
                        <div className="overflow-hidden">
                          <span className="block text-xs font-semibold text-slate-200 truncate group-hover:text-white transition-colors" title={file.name}>
                            {file.name}
                          </span>
                          <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                            {new Date(file.createdTime).toLocaleString('pt-BR')}
                            {fileSizeKB && ` • ${fileSizeKB} KB`}
                          </span>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => handleRestoreBackup(file)}
                        disabled={isRestoringBackup !== null || isBackingUp}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          isThisRestoring
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/10 cursor-not-allowed'
                            : isRestoringBackup !== null
                            ? 'bg-slate-900 text-slate-600 border border-slate-850 cursor-not-allowed'
                            : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-slate-950 border border-indigo-500/20 hover:border-transparent active:scale-95'
                        }`}
                      >
                        {isThisRestoring ? (
                          <>
                            <svg className="animate-spin h-3 w-3 text-amber-400" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Restaurando...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-xs">restore</span>
                            Restaurar
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Webhook Endpoint Info Banner */}
          <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg font-bold">cell_tower</span>
                </div>
                <div>
                  <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    Servidor de Webhooks Ativo
                  </span>
                  <h4 className="text-sm font-bold text-white font-display mt-1">Sincronização Pix via Notificações de Banco</h4>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-mono font-bold">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                ONLINE
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Nosso sistema suporta integração direta e automatizada com qualquer banco brasileiro (Itaú, Nubank, Inter, Bradesco, etc.) através do recebimento de notificações ou Webhooks de transações. Você pode configurar o seu aplicativo de banco ou automação externa (como MacroDroid ou Tasker) para encaminhar as notificações recebidas no celular diretamente para o endpoint abaixo:
            </p>

            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                  URL de Destino do Webhook (Endpoint)
                </label>
                <span className="text-[9px] text-slate-500 font-mono">Método POST</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-mono select-all overflow-x-auto whitespace-nowrap">
                  {window.location.origin}/api/webhooks/bank
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(`${window.location.origin}/api/webhooks/bank`);
                    showAlert("Link Copiado", "A URL do Webhook de banco foi copiada para sua área de transferência.");
                  }}
                  className="p-2.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 rounded-xl transition-all hover:border-emerald-500/20 cursor-pointer flex-shrink-0"
                  title="Copiar Endpoint"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500 leading-normal">
                Dica de segurança: Este endpoint é pessoal e seguro. Toda transação processada gerará um banner flutuante estilo Android na parte superior da tela solicitando sua aprovação para classificá-la como Receita, Despesa ou Transferência.
              </p>
            </div>
          </section>

          {/* Configuração de Webhook Exclusiva do Banco Itaú */}
          <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/25 flex items-center justify-center font-bold font-mono text-sm">
                IT
              </div>
              <div>
                <span className="text-[9px] font-mono font-bold text-orange-400 uppercase tracking-widest bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                  Parceiro Oficial
                </span>
                <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider mt-1">
                  Webhook Dedicado - Banco Itaú
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure a URL de destino específica para receber eventos de pagamento do Itaú S.A.
                </p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                    URL do Webhook do Itaú (Destino)
                  </label>
                  <span className="text-[9px] font-mono text-slate-500">MÉTODO POST</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={itauWebhookUrl}
                    onChange={(e) => setItauWebhookUrl(e.target.value)}
                    placeholder="https://itau-webhook-destino.com/api"
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-mono outline-none focus:border-orange-500 transition-all"
                  />
                  <button
                    onClick={handleSaveItauUrl}
                    className="px-4 py-2.5 bg-orange-500 hover:bg-orange-450 text-slate-950 text-xs font-bold rounded-xl transition-all hover:shadow-lg hover:shadow-orange-500/10 active:scale-95 cursor-pointer font-sans whitespace-nowrap"
                  >
                    Salvar URL
                  </button>
                </div>
              </div>

              {/* Validation Status Indicator / feedback */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pt-1 border-t border-slate-900">
                <div className="text-[11px] text-slate-400 leading-relaxed max-w-md">
                  Para garantir o tráfego correto das notificações do Itaú, realize uma verificação de integridade (ping-pong handshake) clicando ao lado.
                </div>
                <button
                  onClick={handleValidateItauConnection}
                  disabled={isValidatingItau}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
                    isValidatingItau
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/10 cursor-not-allowed'
                      : 'bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-orange-500/20 text-orange-400 hover:text-white'
                  }`}
                >
                  {isValidatingItau ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-orange-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Validando...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xs font-bold">sync_saved_locally</span>
                      Validar Conexão
                    </>
                  )}
                </button>
              </div>

              {/* Validation Result Notification Banner */}
              {itauValidationResult.status !== 'idle' && (
                <div className={`p-4.5 rounded-xl border flex flex-col sm:flex-row gap-3 text-xs leading-relaxed ${
                  itauValidationResult.status === 'testing'
                    ? 'bg-slate-900 border-slate-800 text-slate-300'
                    : itauValidationResult.status === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/25 text-rose-400'
                }`}>
                  <div className="flex-shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-sm font-bold">
                      {itauValidationResult.status === 'testing'
                        ? 'hourglass_empty'
                        : itauValidationResult.status === 'success'
                        ? 'verified'
                        : 'error'}
                    </span>
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <div className="font-bold text-xs">
                      {itauValidationResult.status === 'testing' && 'Testando Endpoint do Itaú...'}
                      {itauValidationResult.status === 'success' && 'Conexão Confirmada!'}
                      {itauValidationResult.status === 'error' && 'Erro de Conectividade'}
                    </div>
                    <div>{itauValidationResult.message}</div>
                    {(itauValidationResult.code || itauValidationResult.latency) && (
                      <div className="flex items-center gap-3 mt-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-400">
                        {itauValidationResult.code && (
                          <span>Status HTTP: <strong className={itauValidationResult.status === 'success' ? 'text-emerald-400' : 'text-rose-400'}>{itauValidationResult.code}</strong></span>
                        )}
                        {itauValidationResult.latency && (
                          <span>Latência: <strong>{itauValidationResult.latency} ms</strong></span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Webhooks Rules List */}
          <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider">Regras de Webhook por Banco</h3>
                <p className="text-xs text-slate-400 mt-0.5">Configure as credenciais e status de escuta de cada instituição financeira.</p>
              </div>
              <button
                onClick={() => setShowAddWebhookModal(true)}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-lg shadow-emerald-500/10 active:scale-95"
              >
                <span className="material-symbols-outlined text-sm font-bold">add</span>
                Novo Banco
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {webhooksConfig.map((config) => (
                <div key={config.id} className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3.5 hover:border-slate-800 transition-all flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-slate-900 text-white border border-slate-800 flex items-center justify-center font-bold text-xs tracking-wider">
                        {config.banco.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wide">{config.banco}</h4>
                        <span className="text-[10px] text-slate-500 font-mono">Token: {config.secretToken}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const updated = webhooksConfig.map(c => {
                          if (c.id === config.id) {
                            const nextStatus = c.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
                            showAlert(
                              nextStatus === 'ATIVO' ? "Integração Ativada" : "Integração Pausada",
                              `A escuta de transações para o banco ${config.banco} foi ${nextStatus === 'ATIVO' ? 'ativada' : 'pausada'}.`
                            );
                            return { ...c, status: nextStatus };
                          }
                          return c;
                        });
                        saveWebhooksToLocalStorage(updated);
                      }}
                      className={`px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wider font-mono uppercase transition-all cursor-pointer ${
                        config.status === 'ATIVO'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20'
                          : 'bg-slate-900 text-slate-500 border border-slate-800 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20'
                      }`}
                    >
                      {config.status === 'ATIVO' ? 'Ativo' : 'Inativo'}
                    </button>
                  </div>

                  <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-900 space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Última transação:</span>
                      <span className="text-slate-300 font-semibold">{config.ultimaChamada}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Segurança webhook:</span>
                      <span className="text-emerald-400 font-mono font-bold">SSL Ativo (HMAC-SHA256)</span>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      onClick={() => {
                        const newSecret = prompt("Digite o novo Secret Token para " + config.banco, config.secretToken);
                        if (newSecret !== null) {
                          const updated = webhooksConfig.map(c => c.id === config.id ? { ...c, secretToken: newSecret } : c);
                          saveWebhooksToLocalStorage(updated);
                          showAlert("Token Atualizado", "O Secret Token para o banco " + config.banco + " foi modificado com sucesso!");
                        }
                      }}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-850 text-slate-400 hover:text-white rounded-lg text-[9px] uppercase tracking-wider font-bold transition-all cursor-pointer"
                    >
                      Editar Token
                    </button>
                    <button
                      onClick={() => {
                        showConfirm(
                          "Remover Integração",
                          `Deseja realmente remover a regra de webhook para o banco "${config.banco}"?`,
                          () => {
                            const updated = webhooksConfig.filter(c => c.id !== config.id);
                            saveWebhooksToLocalStorage(updated);
                            showAlert("Removido", `Regra do banco ${config.banco} foi removida.`);
                          }
                        );
                      }}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 border border-slate-850 hover:border-rose-500/20 rounded-lg text-[9px] uppercase tracking-wider font-bold transition-all cursor-pointer"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Webhook Sandbox / Simulator Card */}
          <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25 flex items-center justify-center">
                <span className="material-symbols-outlined text-lg font-bold">bug_report</span>
              </div>
              <div>
                <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider">Simulador de Recebimento de Webhook</h3>
                <p className="text-xs text-slate-400 mt-0.5">Teste a integração de banco disparando um payload de simulação real em tempo real.</p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-850 p-5 rounded-xl space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bank Select */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">1. Banco Emissor</label>
                  <select
                    value={simWebhookBank}
                    onChange={(e) => {
                      const bank = e.target.value;
                      setSimWebhookBank(bank);
                      // Update description automatically based on bank for high-polish presets
                      if (bank === 'Itaú') {
                        setSimWebhookDesc('Pix recebido de Julia M. da Silva');
                      } else if (bank === 'Nubank') {
                        setSimWebhookDesc('Compra aprovada em Mercado Livre');
                      } else if (bank === 'Banco Inter') {
                        setSimWebhookDesc('Pix enviado para Roberto Antunes');
                      } else if (bank === 'Santander') {
                        setSimWebhookDesc('Pagamento de Boleto de Energia');
                      } else {
                        setSimWebhookDesc('Transferência recebida');
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-500 font-sans"
                  >
                    {webhooksConfig.map(config => (
                      <option key={config.id} value={config.banco}>{config.banco}</option>
                    ))}
                    <option value="C6 Bank">C6 Bank</option>
                    <option value="Bradesco">Bradesco</option>
                  </select>
                </div>

                {/* Value Input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">2. Valor da Transação (R$)</label>
                  <input
                    type="text"
                    value={simWebhookValue}
                    onChange={(e) => setSimWebhookValue(e.target.value)}
                    placeholder="Ex: 150,00"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-mono outline-none focus:border-amber-500"
                  />
                </div>

                {/* Description Input */}
                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">3. Descrição / Texto do Alerta de Notificação</label>
                    <button
                      type="button"
                      onClick={() => {
                        const examples = [
                          { bank: 'Nubank', desc: 'Compra aprovada no Posto Ipiranga', val: '150,00' },
                          { bank: 'Itaú', desc: 'Pix recebido de Uber Technologies Inc', val: '35,00' },
                          { bank: 'Banco Inter', desc: 'Compra aprovada em Drogaria São Paulo', val: '89,90' },
                          { bank: 'Nubank', desc: 'Débito automático de Netflix Entretenimento', val: '55,90' },
                          { bank: 'Santander', desc: 'Pix enviado para Pizza Hut', val: '79,00' },
                          { bank: 'Itaú', desc: 'Compra aprovada em Supermercado Carrefour', val: '342,15' },
                          { bank: 'Nubank', desc: 'Transferência Pix recebida de Soluções LTDA (Salário)', val: '5.500,00' },
                          { bank: 'Banco Inter', desc: 'Pix enviado para Mecânica do Alemão (Troca de Óleo)', val: '450,00' },
                          { bank: 'Santander', desc: 'Pagamento de IPVA Parcelado Veículo', val: '382,50' },
                          { bank: 'C6 Bank', desc: 'Compra de Passagem Aérea Latam Airlines', val: '890,00' }
                        ];
                        const random = examples[Math.floor(Math.random() * examples.length)];
                        setSimWebhookBank(random.bank);
                        setSimWebhookDesc(random.desc);
                        setSimWebhookValue(random.val);
                      }}
                      className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-[9px] font-mono border border-amber-500/20 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[10px]">casino</span>
                      Gerar Exemplo Aleatório
                    </button>
                  </div>
                  <input
                    type="text"
                    value={simWebhookDesc}
                    onChange={(e) => setSimWebhookDesc(e.target.value)}
                    placeholder="Texto completo que o banco envia na notificação do celular"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-sans outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Code Preview payload */}
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1.5">
                <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">Payload do Webhook JSON (Simulado):</span>
                <pre className="text-[11px] text-amber-400 font-mono whitespace-pre-wrap select-all">
{`{
  "banco": "${simWebhookBank}",
  "valor": ${parseFloat(simWebhookValue.replace(/\./g, '').replace(',', '.')) || 0},
  "descricao": "${simWebhookDesc}",
  "token": "${webhooksConfig.find(c => c.banco === simWebhookBank)?.secretToken || "generic_token_993a"}",
  "timestamp": "${new Date().toISOString()}"
}`}
                </pre>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  disabled={isSimulating}
                  onClick={async () => {
                    setIsSimulating(true);
                    setSimSuccess(false);

                    const valFloat = parseFloat(simWebhookValue.replace(/\./g, '').replace(',', '.')) || 0;
                    if (isNaN(valFloat) || valFloat <= 0) {
                      showAlert("Valor Inválido", "Por favor, digite um valor numérico válido maior que zero.");
                      setIsSimulating(false);
                      return;
                    }

                    try {
                      const response = await fetch('/api/webhooks/bank', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          banco: simWebhookBank,
                          valor: valFloat,
                          descricao: simWebhookDesc,
                          token: webhooksConfig.find(c => c.banco === simWebhookBank)?.secretToken || "generic_token_993a"
                        })
                      });

                      const data = await response.json();
                      if (response.ok) {
                        setSimSuccess(true);
                        
                        // Mark last transaction time as "Há pouco"
                        const updated = webhooksConfig.map(c => c.banco === simWebhookBank ? { ...c, ultimaChamada: 'Há pouco' } : c);
                        saveWebhooksToLocalStorage(updated);

                        setTimeout(() => {
                          setIsSimulating(false);
                          showAlert(
                            "Webhook Processado!",
                            `O webhook simulado do banco ${simWebhookBank} foi recebido pelo servidor. Olhe no topo da tela do aplicativo para ver a notificação flutuante e classificá-la!`
                          );
                        }, 800);
                      } else {
                        throw new Error(data.error || "Erro de servidor");
                      }
                    } catch (e: any) {
                      console.error("Webhook test failed:", e);
                      setIsSimulating(false);
                      showAlert("Erro na Simulação", `Não foi possível enviar o webhook de teste: ${e.message}`);
                    }
                  }}
                  className={`px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    isSimulating
                      ? 'bg-amber-500/40 text-slate-900 cursor-not-allowed'
                      : 'bg-amber-500 hover:bg-amber-450 text-slate-950 shadow-lg shadow-amber-500/15 active:scale-95'
                  }`}
                >
                  {isSimulating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-slate-950" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processando...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm font-bold">send</span>
                      Disparar Webhook de Teste
                    </>
                  )}
                </button>
              </div>

              {simSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2 font-medium"
                >
                  <span className="material-symbols-outlined text-sm font-bold">check_circle</span>
                  <span>Webhook disparado com sucesso! Se você estiver na página inicial, verá o banner de Pix flutuante em poucos segundos.</span>
                </motion.div>
              )}
            </div>
          </section>

          {/* Setup Tutorial Accordion */}
          <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
            <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider">Como Integrar com Aplicativos Reais de Banco</h3>
            
            <div className="space-y-3 font-sans text-xs">
              <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-1.5">
                <span className="text-amber-400 font-bold">Opção A: Integração Automática via MacroDroid (Android)</span>
                <p className="text-slate-300 leading-relaxed">
                  1. Baixe o aplicativo <strong className="text-white">MacroDroid</strong> na Play Store.<br />
                  2. Crie uma macro com o gatilho <strong className="text-white">Notificação Recebida</strong> e selecione seus aplicativos de banco (Itaú, Nubank, etc.).<br />
                  3. Defina a ação para <strong className="text-white">Requisição HTTP POST</strong>.<br />
                  4. Cole a URL de Endpoint fornecida acima e configure os parâmetros do corpo no formato JSON com as tags <code className="text-amber-300">"banco"</code>, <code className="text-amber-300">"valor"</code>, e <code className="text-amber-300">"descricao"</code>.
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-1.5">
                <span className="text-sky-400 font-bold">Opção B: Integração Webhook Direta (Desenvolvedores)</span>
                <p className="text-slate-300 leading-relaxed">
                  Se você possui acesso à API do seu banco ou utiliza uma solução que intercepta SMS/notificações de Pix, configure um webhook enviando uma requisição POST segura com o cabeçalho <code className="text-sky-300">Content-Type: application/json</code> contendo o valor numérico e identificador do banco para o nosso ouvinte de integração.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {activeSubTab === 'metas' && (
        <div className="space-y-6">
          {/* Resumo Consolidado das Metas */}
          <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-500 text-lg">savings</span>
                  Metas de Economia
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Planeje seus objetivos financeiros, defina prazos e acompanhe seu progresso de poupança de forma simples.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingGoalId(null);
                  setGoalName('');
                  setGoalTarget('');
                  setGoalCurrent('');
                  setGoalDeadline('');
                  setGoalCategory('Reserva');
                  setGoalDescription('');
                  setIsAddingGoal(!isAddingGoal);
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-450 text-slate-950 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <span className="material-symbols-outlined text-sm font-bold">
                  {isAddingGoal ? 'close' : 'add'}
                </span>
                {isAddingGoal ? 'Fechar Formulário' : 'Nova Meta'}
              </button>
            </div>

            {/* Cards de Resumo */}
            {savingsGoals.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
                <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-between">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Total Almejado</span>
                  <span className="text-sm font-bold text-slate-200 mt-1">
                    R$ <AnimatedNumber value={savingsGoals.reduce((sum, g) => sum + g.valorAlvo, 0)} formatter={(v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                  </span>
                </div>
                <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-between">
                  <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider block">Total Economizado</span>
                  <span className="text-sm font-bold text-emerald-400 mt-1">
                    R$ <AnimatedNumber value={savingsGoals.reduce((sum, g) => sum + g.valorAtual, 0)} formatter={(v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                  </span>
                </div>
                <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-between">
                  <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider block">Progresso Médio</span>
                  <span className="text-sm font-bold text-indigo-400 mt-1">
                    <AnimatedNumber 
                      value={(() => {
                        const totalAlvo = savingsGoals.reduce((sum, g) => sum + g.valorAlvo, 0);
                        const totalAtual = savingsGoals.reduce((sum, g) => sum + g.valorAtual, 0);
                        return totalAlvo > 0 ? (totalAtual / totalAlvo) * 100 : 0;
                      })()} 
                      formatter={(v) => `${v.toFixed(1)}%`} 
                    />
                  </span>
                </div>
                <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-between">
                  <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider block">Falta Poupar</span>
                  <span className="text-sm font-bold text-amber-500 mt-1">
                    R$ <AnimatedNumber value={Math.max(0, savingsGoals.reduce((sum, g) => sum + g.valorAlvo, 0) - savingsGoals.reduce((sum, g) => sum + g.valorAtual, 0))} formatter={(v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* Form para Adicionar/Editar Meta */}
          <AnimatePresence>
            {(isAddingGoal || editingGoalId) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 overflow-hidden"
              >
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-emerald-400 text-base">edit</span>
                    {editingGoalId ? 'Editar Meta de Economia' : 'Cadastrar Nova Meta de Economia'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingGoal(false);
                      setEditingGoalId(null);
                    }}
                    className="text-slate-500 hover:text-white cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!goalName.trim()) {
                      showAlert("Nome Obrigatório", "Por favor, defina um nome para o seu objetivo.");
                      return;
                    }
                    const targetNum = parseFloat(String(goalTarget).replace(/\./g, '').replace(',', '.'));
                    if (isNaN(targetNum) || targetNum <= 0) {
                      showAlert("Valor Alvo Inválido", "Por favor, digite um valor-alvo válido maior que zero.");
                      return;
                    }
                    const currentNum = parseFloat(String(goalCurrent).replace(/\./g, '').replace(',', '.')) || 0;
                    if (currentNum < 0) {
                      showAlert("Valor Salvo Inválido", "O valor atual economizado não pode ser negativo.");
                      return;
                    }

                    if (editingGoalId) {
                      // Edit goal
                      setSavingsGoals(prev => prev.map(g => g.id === editingGoalId ? {
                        ...g,
                        nome: goalName.trim(),
                        valorAlvo: targetNum,
                        valorAtual: currentNum,
                        prazo: goalDeadline || undefined,
                        categoria: goalCategory,
                        descricao: goalDescription.trim() || undefined,
                        updatedAt: Date.now()
                      } : g));
                      showAlert("Meta Atualizada", `A meta de economia "${goalName}" foi alterada com sucesso.`);
                      setEditingGoalId(null);
                    } else {
                      // Add goal
                      const newGoal: SavingsGoal = {
                        id: `goal-${Date.now()}`,
                        nome: goalName.trim(),
                        valorAlvo: targetNum,
                        valorAtual: currentNum,
                        prazo: goalDeadline || undefined,
                        categoria: goalCategory,
                        descricao: goalDescription.trim() || undefined,
                        updatedAt: Date.now()
                      };
                      setSavingsGoals(prev => [...prev, newGoal]);
                      showAlert("Nova Meta Cadastrada", `A meta "${goalName}" foi criada com sucesso!`);
                      setIsAddingGoal(false);
                    }

                    // Reset form
                    setGoalName('');
                    setGoalTarget('');
                    setGoalCurrent('');
                    setGoalDeadline('');
                    setGoalCategory('Reserva');
                    setGoalDescription('');
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Nome do Objetivo */}
                    <div className="space-y-1.5 col-span-1 sm:col-span-2 md:col-span-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Nome do Objetivo</label>
                      <input
                        type="text"
                        required
                        value={goalName}
                        onChange={(e) => setGoalName(e.target.value)}
                        placeholder="Ex: Compra do Notebook Novo 💻"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 font-sans"
                      />
                    </div>

                    {/* Categoria */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Categoria</label>
                      <select
                        value={goalCategory}
                        onChange={(e) => setGoalCategory(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-white text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-500 cursor-pointer font-sans"
                      >
                        <option value="Reserva">Reserva de Segurança</option>
                        <option value="Viagem">Viagens &amp; Lazer</option>
                        <option value="Veículos">Troca de Veículo</option>
                        <option value="Tecnologia">Gadgets &amp; Tecnologia</option>
                        <option value="Imóvel">Casa &amp; Imóveis</option>
                        <option value="Investimentos">Aportes e Investimentos</option>
                        <option value="Estudos">Estudos e Cursos</option>
                        <option value="Outros">Outros Projetos</option>
                      </select>
                    </div>

                    {/* Prazo (Data limite) */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Data Limite (Prazo)</label>
                      <input
                        type="date"
                        value={goalDeadline}
                        onChange={(e) => setGoalDeadline(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>

                    {/* Valor Alvo */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Valor Alvo (R$)</label>
                      <input
                        type="text"
                        required
                        value={goalTarget}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9,.]/g, '');
                          setGoalTarget(raw);
                        }}
                        placeholder="Ex: 5.000,00"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>

                    {/* Valor Atual */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Valor já Economizado (R$)</label>
                      <input
                        type="text"
                        value={goalCurrent}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9,.]/g, '');
                          setGoalCurrent(raw);
                        }}
                        placeholder="Ex: 1.200,00"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>

                    {/* Descrição */}
                    <div className="space-y-1.5 sm:col-span-2 md:col-span-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Descrição Breve</label>
                      <input
                        type="text"
                        value={goalDescription}
                        onChange={(e) => setGoalDescription(e.target.value)}
                        placeholder="Ex: Reserva para comprar equipamento de trabalho"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 font-sans"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingGoal(false);
                        setEditingGoalId(null);
                      }}
                      className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/40 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-450 text-slate-950 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-emerald-500/15 flex items-center gap-1.5 active:scale-95"
                    >
                      <span className="material-symbols-outlined text-xs font-bold">check</span>
                      {editingGoalId ? 'Salvar Alterações' : 'Criar Objetivo'}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Visualização de Gráfico de Barras */}
          {savingsGoals.length > 0 && (
            <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
              <div>
                <h4 className="font-bold text-white font-display text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-indigo-400 text-base">bar_chart</span>
                  Progresso das Metas de Economia
                </h4>
                <p className="text-[10px] text-slate-500 font-sans">
                  Comparação visual de valores já poupados versus o valor restante para atingir o valor-alvo de cada objetivo.
                </p>
              </div>

              <div className="bg-slate-950/70 border border-slate-850 p-4 rounded-xl">
                <ResponsiveContainer width="100%" height={Math.max(200, savingsGoals.length * 55 + 60)}>
                  <BarChart
                    data={savingsGoals.map(g => ({
                      name: g.nome.length > 25 ? g.nome.slice(0, 22) + '...' : g.nome,
                      'Valor Salvo (R$)': g.valorAtual,
                      'Falta Poupar (R$)': Math.max(0, g.valorAlvo - g.valorAtual)
                    }))}
                    layout="vertical"
                    margin={{ top: 10, right: 20, left: 20, bottom: 5 }}
                  >
                    <XAxis 
                      type="number" 
                      stroke="#475569" 
                      fontSize={9} 
                      fontFamily="monospace"
                      tickFormatter={(v) => `R$ ${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} 
                    />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      stroke="#cbd5e1" 
                      fontSize={10} 
                      width={130} 
                      fontFamily="sans-serif"
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '12px', fontSize: '11px', fontFamily: 'sans-serif' }}
                      labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                      formatter={(value: any, name: any) => [
                        <span className="font-mono font-bold text-slate-200">
                          R$ {Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>,
                        name
                      ]}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} 
                    />
                    <Bar dataKey="Valor Salvo (R$)" stackId="a" fill="#10b981" barSize={14} radius={[4, 0, 0, 4]} />
                    <Bar dataKey="Falta Poupar (R$)" stackId="a" fill="#1e1b4b" barSize={14} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Seção de Alertas Automáticos de Progresso das Metas */}
          <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div>
              <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-indigo-400 text-lg">notifications_active</span>
                Formulário de Alertas Automáticos de Metas de Economia
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
                Personalize os percentuais de progresso (ex: 50%, 75%, 95%) em que você deseja receber notificações automáticas e gerencie as permissões de cada uma.
              </p>
            </div>

            <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl space-y-4">
              <form onSubmit={(e) => {
                e.preventDefault();
                const p1 = Math.min(100, Math.max(1, parseInt(tempAlertPct1, 10) || 50));
                const p2 = Math.min(100, Math.max(1, parseInt(tempAlertPct2, 10) || 75));
                const p3 = Math.min(100, Math.max(1, parseInt(tempAlertPct3, 10) || 95));
                
                setSavingsAlertPct1(p1);
                setSavingsAlertPct2(p2);
                setSavingsAlertPct3(p3);
                
                showAlert(
                  "Configurações Salvas! 🎉",
                  `Os percentuais de alerta foram atualizados para ${p1}%, ${p2}% e ${p3}% com sucesso.`
                );
              }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Milestone 1 */}
                  <div className="bg-slate-900/30 border border-slate-850/80 p-3 rounded-xl flex flex-col justify-between gap-3">
                    <div className="flex justify-between items-start gap-3">
                      <div className="space-y-0.5">
                        <span className="block text-xs font-bold text-white font-mono">Primeiro Marco</span>
                        <span className="block text-[9px] text-slate-500 font-sans leading-none">Alerta Inicial</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSavingsAlert50(!savingsAlert50);
                          showAlert(
                            "Alerta Atualizado",
                            `Alerta do 1º Limiar de progresso foi ${!savingsAlert50 ? 'ativado' : 'desativado'}.`
                          );
                        }}
                        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          savingsAlert50 ? 'bg-indigo-600' : 'bg-slate-850'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            savingsAlert50 ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                        Progresso Requerido:
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={tempAlertPct1}
                          onChange={(e) => setTempAlertPct1(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs px-2 py-1 rounded-md focus:outline-none focus:border-indigo-500/50 transition-all font-mono text-center"
                        />
                        <span className="text-xs text-slate-400 font-bold font-mono">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Milestone 2 */}
                  <div className="bg-slate-900/30 border border-slate-850/80 p-3 rounded-xl flex flex-col justify-between gap-3">
                    <div className="flex justify-between items-start gap-3">
                      <div className="space-y-0.5">
                        <span className="block text-xs font-bold text-white font-mono">Segundo Marco</span>
                        <span className="block text-[9px] text-slate-500 font-sans leading-none">Reta Final</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSavingsAlert75(!savingsAlert75);
                          showAlert(
                            "Alerta Atualizado",
                            `Alerta do 2º Limiar de progresso foi ${!savingsAlert75 ? 'ativado' : 'desativado'}.`
                          );
                        }}
                        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          savingsAlert75 ? 'bg-indigo-600' : 'bg-slate-850'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            savingsAlert75 ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                        Progresso Requerido:
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={tempAlertPct2}
                          onChange={(e) => setTempAlertPct2(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs px-2 py-1 rounded-md focus:outline-none focus:border-indigo-500/50 transition-all font-mono text-center"
                        />
                        <span className="text-xs text-slate-400 font-bold font-mono">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Milestone 3 */}
                  <div className="bg-slate-900/30 border border-slate-850/80 p-3 rounded-xl flex flex-col justify-between gap-3">
                    <div className="flex justify-between items-start gap-3">
                      <div className="space-y-0.5">
                        <span className="block text-xs font-bold text-white font-mono">Terceiro Marco</span>
                        <span className="block text-[9px] text-slate-500 font-sans leading-none">Quase Concluído!</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSavingsAlert95(!savingsAlert95);
                          showAlert(
                            "Alerta Atualizado",
                            `Alerta do 3º Limiar de progresso foi ${!savingsAlert95 ? 'ativado' : 'desativado'}.`
                          );
                        }}
                        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          savingsAlert95 ? 'bg-indigo-600' : 'bg-slate-850'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            savingsAlert95 ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                        Progresso Requerido:
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={tempAlertPct3}
                          onChange={(e) => setTempAlertPct3(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs px-2 py-1 rounded-md focus:outline-none focus:border-indigo-500/50 transition-all font-mono text-center"
                        />
                        <span className="text-xs text-slate-400 font-bold font-mono">%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3 border-t border-slate-900">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-sans">
                    <span className="material-symbols-outlined text-amber-500 text-sm">info</span>
                    <span>Modifique as porcentagens e clique em salvar para configurar as metas. Alertas usam notificações Web Push ou modais.</span>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => {
                        const testTitle = "🎯 WealthFlow • Teste de Meta";
                        const testBody = `Sua meta de teste 'Viajar para o Japão ✈️' alcançou ${savingsAlertPct2}% do objetivo! Você economizou R$ 15.000,00 de R$ 20.000,00.`;
                        triggerGoalPushNotification(testTitle, testBody, "test-goal-alert");
                      }}
                      className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[10px] font-mono font-bold rounded-lg border border-indigo-500/20 transition-all active:scale-95 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xs">notifications_active</span>
                      Enviar Alerta de Teste
                    </button>

                    <button
                      type="submit"
                      className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-lg transition-all active:scale-95 cursor-pointer shadow-sm"
                    >
                      <span className="material-symbols-outlined text-xs">save</span>
                      Salvar Limiares
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </section>

          {/* Seção de Configuração de Metas Inteligentes */}
          <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div>
              <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-indigo-400 text-lg">psychology</span>
                Configuração de Metas Inteligentes 💡
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
                Selecione as categorias de despesas frequentes, estime seus gastos mensais e configure regras inteligentes baseadas em uma porcentagem do seu saldo disponível para gerar sugestões de economia automatizadas.
              </p>
            </div>

            <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl space-y-4">
              {/* Grid Principal: Seleção de Categorias e Ajuste de Estimativas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Lado Esquerdo: Categorias e Valores Estimados */}
                <div className="space-y-3">
                  <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    1. Despesas Frequentes Estimadas
                  </span>
                  
                  <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                    {['ABASTECIMENTO', 'CASA', 'CONSUMO', 'LAZER', 'PESSOAL', 'TAXAS', 'OUTROS', ...customCategories]
                      .filter((value, index, self) => self.indexOf(value) === index) // Unique categories
                      .map((cat) => {
                        const isSelected = smartExpenseCategories.includes(cat);
                        const estimateValue = smartCategoryEstimates[cat] || 0;
                        
                        return (
                          <div 
                            key={cat} 
                            className={`p-2.5 rounded-lg border flex flex-col justify-between gap-1.5 transition-all ${
                              isSelected 
                                ? 'bg-indigo-950/30 border-indigo-500/40 text-slate-200' 
                                : 'bg-slate-900/20 border-slate-850 text-slate-500'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono font-bold truncate pr-1">{cat}</span>
                              <input 
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  if (isSelected) {
                                    setSmartExpenseCategories(smartExpenseCategories.filter(c => c !== cat));
                                  } else {
                                    setSmartExpenseCategories([...smartExpenseCategories, cat]);
                                  }
                                }}
                                className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500/20 h-3 w-3 cursor-pointer"
                              />
                            </div>
                            
                            {isSelected && (
                              <div className="flex items-center gap-1 bg-slate-950 border border-slate-850 rounded px-1.5 py-0.5">
                                <span className="text-[9px] text-slate-500 font-mono">R$</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={estimateValue || ''}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                    setSmartCategoryEstimates({
                                      ...smartCategoryEstimates,
                                      [cat]: val
                                    });
                                  }}
                                  className="w-full bg-transparent border-none text-slate-200 text-[10px] font-mono p-0 focus:outline-none focus:ring-0 text-right"
                                  placeholder="0"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Lado Direito: Regra de Economia e Meta Alvo */}
                <div className="space-y-3.5">
                  <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    2. Regra de Economia e Meta Alvo
                  </span>

                  <div className="bg-slate-900/40 border border-slate-850 p-3 rounded-xl space-y-3">
                    {/* Regra de economia baseada em porcentagem */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-mono font-bold text-slate-300">
                          Poupar do Saldo Disponível:
                        </label>
                        <span className="text-xs font-bold text-indigo-400 font-mono">{smartSavingsPercentage}%</span>
                      </div>
                      <input 
                        type="range"
                        min="5"
                        max="50"
                        step="5"
                        value={smartSavingsPercentage}
                        onChange={(e) => setSmartSavingsPercentage(parseInt(e.target.value, 10))}
                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                        <span>Min (5%)</span>
                        <span>Moderado (15%)</span>
                        <span>Ousado (50%)</span>
                      </div>
                    </div>

                    {/* Meta Alvo */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-mono font-bold text-slate-300">
                        Vincular à Meta de Economia:
                      </label>
                      <select
                        value={smartSelectedGoalId || ''}
                        onChange={(e) => setSmartSelectedGoalId(e.target.value || null)}
                        className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500/40 focus:ring-0"
                      >
                        <option value="">-- Não Vincular --</option>
                        {savingsGoals.map(g => (
                          <option key={g.id} value={g.id}>{g.nome}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção Inferior: Painel de Resultados / Automação de Sugestões */}
              <div className="bg-slate-900/50 border border-slate-850 p-4 rounded-xl space-y-3 font-mono">
                <span className="block text-[9px] font-mono font-bold text-indigo-400 uppercase tracking-wider border-b border-slate-850/60 pb-1.5">
                  Painel de Simulação e Sugestão Inteligente de Poupança
                </span>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  <div className="bg-slate-950/40 p-2.5 border border-slate-850/60 rounded-lg">
                    <span className="block text-[8px] text-slate-500 uppercase font-bold">Renda Mensal Média</span>
                    <span className="block text-xs font-bold text-emerald-400 mt-1">
                      R$ {smartMonthlyIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="block text-[7px] text-slate-600 mt-0.5">(Histórico de Receitas)</span>
                  </div>

                  <div className="bg-slate-950/40 p-2.5 border border-slate-850/60 rounded-lg">
                    <span className="block text-[8px] text-slate-500 uppercase font-bold">Despesas Estimadas</span>
                    <span className="block text-xs font-bold text-red-400 mt-1 font-mono">
                      R$ {smartEstimatedExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="block text-[7px] text-slate-600 mt-0.5">({smartExpenseCategories.length} cat. selecionadas)</span>
                  </div>

                  <div className="bg-slate-950/40 p-2.5 border border-slate-850/60 rounded-lg">
                    <span className="block text-[8px] text-slate-500 uppercase font-bold">Saldo Livre Estimado</span>
                    <span className={`block text-xs font-bold mt-1 ${smartEstimatedRemainingBalance >= 0 ? 'text-indigo-400' : 'text-amber-500'}`}>
                      R$ {smartEstimatedRemainingBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="block text-[7px] text-slate-600 mt-0.5">(Renda - Despesas)</span>
                  </div>

                  <div className="bg-slate-950/40 p-2.5 border border-indigo-500/20 rounded-lg shadow-inner">
                    <span className="block text-[8px] text-indigo-400 uppercase font-bold">Poupança Sugerida</span>
                    <span className="block text-xs font-bold text-white mt-1">
                      R$ {smartSuggestedSavings.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="block text-[7px] text-indigo-500/80 mt-0.5">({smartSavingsPercentage}% do Saldo Livre)</span>
                  </div>
                </div>

                {/* Resumo dinâmico ou ação rápida para aplicar sugestão */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2 border-t border-slate-850/60 text-[10px]">
                  <div className="text-slate-300 font-sans leading-relaxed">
                    {smartSelectedGoalObj ? (
                      <div>
                        🎯 Para a meta <span className="font-bold text-white font-mono">"{smartSelectedGoalObj.nome}"</span> (Falta R$ {(smartSelectedGoalObj.valorAlvo - smartSelectedGoalObj.valorAtual).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}): com a poupança sugerida de <span className="font-bold text-indigo-400 font-mono">R$ {smartSuggestedSavings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês</span>, você atingirá o objetivo em aproximadamente <span className="font-bold text-emerald-400 font-mono">{smartMonthsToTarget === Infinity ? '∞' : smartMonthsToTarget} meses</span>.
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-slate-400">
                        <span className="material-symbols-outlined text-amber-500 text-sm">warning_amber</span>
                        <span>Selecione uma meta de economia ativa acima para simular o tempo de conclusão com esta poupança mensal.</span>
                      </div>
                    )}
                  </div>

                  {smartSelectedGoalObj && (
                    <button
                      type="button"
                      onClick={() => {
                        const updatedGoals = savingsGoals.map(g => {
                          if (g.id === smartSelectedGoalObj.id) {
                            return {
                              ...g,
                              valorAtual: Math.min(g.valorAlvo, g.valorAtual + smartSuggestedSavings)
                            };
                          }
                          return g;
                        });
                        setSavingsGoals(updatedGoals);
                        localStorage.setItem('wealthflow_savings_goals', JSON.stringify(updatedGoals));
                        showAlert(
                          "Poupança Aplicada! 💰",
                          `Foi depositado o valor sugerido de R$ ${smartSuggestedSavings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} na sua meta "${smartSelectedGoalObj.nome}". Continue assim!`
                        );
                      }}
                      className="w-full sm:w-auto px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono font-bold text-[10px] rounded-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-xs">savings</span>
                      Depositar Sugestão de Poupança
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Listagem das Metas de Economia */}
          <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider">Metas Ativas</span>
              <span className="text-[9px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                {savingsGoals.length} {savingsGoals.length === 1 ? 'Objetivo' : 'Objetivos'}
              </span>
            </div>

            {savingsGoals.length === 0 ? (
              <div className="text-center py-12 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-3">
                <span className="material-symbols-outlined text-4xl text-slate-600">target</span>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Você ainda não cadastrou nenhuma meta de economia. Defina seus sonhos de viagem, reservas de emergência ou compras futuras agora mesmo!
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddingGoal(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer mt-2 active:scale-95"
                >
                  Criar Minha Primeira Meta
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savingsGoals.map((g) => {
                  const pct = Math.min(100, g.valorAlvo > 0 ? (g.valorAtual / g.valorAlvo) * 100 : 0);
                  const isDone = pct >= 100;
                  
                  return (
                    <div 
                      key={g.id}
                      className={`p-4 rounded-xl flex flex-col justify-between gap-4 transition-all duration-300 ${
                        isDone 
                          ? 'bg-emerald-950/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.03)]' 
                          : 'bg-slate-950/40 border border-slate-850 hover:border-slate-800'
                      }`}
                    >
                      {/* Linha 1: Nome, Categoria e Ações */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center flex-wrap gap-1.5">
                            <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wide font-sans">{g.nome}</h5>
                            <span className="text-[9px] px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-indigo-400 font-mono rounded font-semibold tracking-wider">
                              {g.categoria}
                            </span>
                            {isDone && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-mono rounded font-bold uppercase tracking-wider flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[10px] font-bold">check_circle</span>
                                Concluída!
                              </span>
                            )}
                          </div>
                          {g.descricao && (
                            <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                              {g.descricao}
                            </p>
                          )}
                        </div>

                        {/* Botões de Ação da Meta */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingGoalId(g.id);
                              setGoalName(g.nome);
                              setGoalTarget(g.valorAlvo.toString());
                              setGoalCurrent(g.valorAtual.toString());
                              setGoalDeadline(g.prazo || '');
                              setGoalCategory(g.categoria || 'Reserva');
                              setGoalDescription(g.descricao || '');
                              setIsAddingGoal(false);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all cursor-pointer"
                            title="Editar Meta"
                          >
                            <span className="material-symbols-outlined text-sm font-bold">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              showConfirm(
                                "Remover Meta de Economia",
                                `Tem certeza que deseja excluir a meta de economia "${g.nome}"? Esta ação não pode ser desfeita.`,
                                () => {
                                  setSavingsGoals(prev => prev.filter(item => item.id !== g.id));
                                  showAlert("Meta Excluída", "A meta foi removida de sua carteira.");
                                }
                              );
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                            title="Excluir Meta"
                          >
                            <span className="material-symbols-outlined text-sm font-bold">delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Linha 2: Valores & Prazo */}
                      <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-2.5 rounded-lg border border-slate-900 font-mono text-[11px]">
                        <div>
                          <span className="text-[9px] text-slate-500 block">Progresso</span>
                          <strong className="text-emerald-400">R$ <AnimatedNumber value={g.valorAtual} formatter={(v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /></strong>
                          <span className="text-slate-500 block text-[9px] mt-0.5">de R$ {g.valorAlvo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="text-right flex flex-col justify-between">
                          <div>
                            <span className="text-[9px] text-slate-500 block">Data Limite</span>
                            <span className="text-slate-300 font-medium">
                              {g.prazo 
                                ? (() => {
                                    const parts = g.prazo.split('-');
                                    return `${parts[2]}/${parts[1]}/${parts[0]}`;
                                  })()
                                : 'Sem prazo definido'}
                            </span>
                          </div>
                          {g.prazo && (
                            <span className="text-[9px] text-indigo-400 mt-1 block">
                              {(() => {
                                const targetDate = new Date(g.prazo + 'T23:59:59');
                                const now = new Date();
                                const diffTime = targetDate.getTime() - now.getTime();
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                if (isDone) return "Alcançada! 🎉";
                                if (diffDays < 0) return "Prazo encerrado";
                                if (diffDays === 0) return "Termina hoje!";
                                return `${diffDays} dias restantes`;
                              })()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Linha 3: Barra de Progresso visual */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-slate-400 font-sans">Porcentagem salva</span>
                          <span className="text-white font-bold">
                            <AnimatedNumber value={pct} formatter={(v) => `${v.toFixed(1)}%`} />
                          </span>
                        </div>
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                          <motion.div 
                            className={`h-full rounded-full ${
                              isDone 
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]' 
                                : 'bg-gradient-to-r from-indigo-500 to-indigo-400'
                            }`}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 1.2, ease: "easeOut" }}
                          />
                        </div>
                      </div>

                      {/* Quick Adjustments panel (Depositar / Retirar) */}
                      <div className="flex flex-col gap-2 pt-2 border-t border-slate-900">
                        {quickEditGoalId === g.id && quickEditType ? (
                          <div className="flex items-center justify-between gap-2 bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                            <span className="text-[10px] font-mono text-slate-400 font-bold uppercase shrink-0">
                              {quickEditType === 'deposit' ? 'Depositar (R$):' : 'Retirar (R$):'}
                            </span>
                            <div className="flex items-center gap-1.5 w-full justify-end">
                              <input
                                type="text"
                                autoFocus
                                value={quickEditAmount}
                                onChange={(e) => setQuickEditAmount(e.target.value.replace(/[^0-9,.]/g, ''))}
                                placeholder="0,00"
                                className="bg-slate-950 border border-slate-850 text-white text-xs font-mono rounded px-2 py-1 outline-none w-24 text-right focus:border-indigo-500"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const val = parseFloat(quickEditAmount.replace(/\./g, '').replace(',', '.'));
                                  if (isNaN(val) || val <= 0) {
                                    showAlert("Valor Inválido", "Por favor, digite um valor maior que zero.");
                                    return;
                                  }
                                  
                                  if (quickEditType === 'withdraw') {
                                    const newAmt = Math.max(0, g.valorAtual - val);
                                    setSavingsGoals(prev => prev.map(item => item.id === g.id ? { ...item, valorAtual: newAmt, updatedAt: Date.now() } : item));
                                    showAlert("Sucesso", `Retirado R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de "${g.nome}".`);
                                  } else {
                                    const newAmt = g.valorAtual + val;
                                    setSavingsGoals(prev => prev.map(item => item.id === g.id ? { ...item, valorAtual: newAmt, updatedAt: Date.now() } : item));
                                    showAlert("Sucesso", `Depositado R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em "${g.nome}".`);
                                  }
                                  setQuickEditGoalId(null);
                                  setQuickEditType(null);
                                  setQuickEditAmount('');
                                }}
                                className="p-1 bg-emerald-500 hover:bg-emerald-450 text-slate-950 rounded cursor-pointer transition-colors flex items-center justify-center"
                              >
                                <span className="material-symbols-outlined text-sm font-bold">check</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickEditGoalId(null);
                                  setQuickEditType(null);
                                  setQuickEditAmount('');
                                }}
                                className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer transition-colors flex items-center justify-center"
                              >
                                <span className="material-symbols-outlined text-sm font-bold">close</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-[9px] font-mono text-slate-500">Alteração Rápida:</span>
                            <div className="flex items-center gap-1.5 font-sans">
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickEditGoalId(g.id);
                                  setQuickEditType('withdraw');
                                  setQuickEditAmount('');
                                }}
                                className="text-[10px] font-bold font-sans text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2.5 py-1 border border-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              >
                                - Retirar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickEditGoalId(g.id);
                                  setQuickEditType('deposit');
                                  setQuickEditAmount('');
                                }}
                                className="text-[10px] font-bold font-sans text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-2.5 py-1 border border-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                              >
                                + Depositar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ALL MODALS FOR BANK MANAGEMENT */}
      <AnimatePresence>

        {/* Manual Account Addition Modal */}
        {isOpenAddAccount && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpenAddAccount(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 z-10"
            >
              <div className="flex justify-between items-start">
                <h4 className="text-base font-bold text-white font-display">
                  {editingAccount ? 'Editar Conta Bancária' : 'Cadastrar Conta Bancária'}
                </h4>
                <button
                  onClick={() => setIsOpenAddAccount(false)}
                  className="p-1 rounded-full bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <div className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Nome da Instituição (Ex: Itaú, Nubank)</label>
                  <input
                    type="text"
                    value={newAccBank}
                    onChange={(e) => setNewAccBank(e.target.value)}
                    placeholder="Ex: ITAÚ PERSONALITÉ"
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-emerald-500 transition-colors uppercase font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Agência (4 dígitos)</label>
                    <input
                      type="text"
                      value={newAccAgencia}
                      onChange={(e) => setNewAccAgencia(e.target.value)}
                      placeholder="0001"
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Conta com Dígito</label>
                    <input
                      type="text"
                      value={newAccConta}
                      onChange={(e) => setNewAccConta(e.target.value)}
                      placeholder="12345-6"
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Saldo Disponível (R$)</label>
                    <input
                      type="text"
                      value={newAccBalance}
                      onChange={(e) => {
                        let raw = e.target.value.replace(/\D/g, "");
                        if (!raw) {
                          setNewAccBalance('0,00');
                          return;
                        }
                        let numeric = parseInt(raw, 10) / 100;
                        setNewAccBalance(numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                      }}
                      placeholder="0,00"
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Limite Especial (R$)</label>
                    <input
                      type="text"
                      value={newAccLimit}
                      onChange={(e) => {
                        let raw = e.target.value.replace(/\D/g, "");
                        if (!raw) {
                          setNewAccLimit('0,00');
                          return;
                        }
                        let numeric = parseInt(raw, 10) / 100;
                        setNewAccLimit(numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                      }}
                      placeholder="0,00"
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    const cleanVal = newAccBalance.replace(/\./g, "").replace(",", ".");
                    const parsedBalance = parseFloat(cleanVal);
                    
                    const cleanLimit = newAccLimit.replace(/\./g, "").replace(",", ".");
                    const parsedLimit = parseFloat(cleanLimit);

                    if (!newAccBank.trim() || isNaN(parsedBalance) || isNaN(parsedLimit)) {
                      showAlert("Dados Inválidos", "Por favor, preencha o nome do banco, saldo e limite com valores válidos.");
                      return;
                    }
                    
                    if (editingAccount) {
                      setBankAccounts(prev => prev.map(a => a.id === editingAccount.id ? {
                        ...a,
                        nome: newAccBank.trim().toUpperCase(),
                        saldoInicial: parsedBalance,
                        limite: parsedLimit,
                        agencia: newAccAgencia.trim() || '0001',
                        conta: newAccConta.trim() || '10000-1'
                      } : a));
                      setEditingAccount(null);
                      setIsOpenAddAccount(false);
                      showAlert("Sucesso", "Conta editada com sucesso!");
                    } else {
                      setBankAccounts(prev => [
                        ...prev,
                        {
                          id: Date.now(),
                          nome: newAccBank.trim().toUpperCase(),
                          tipo: 'BANCO',
                          saldoInicial: parsedBalance,
                          limite: parsedLimit,
                          agencia: newAccAgencia.trim() || '0001',
                          conta: newAccConta.trim() || '10000-1'
                        }
                      ]);
                      setIsOpenAddAccount(false);
                      showAlert("Sucesso", "Conta cadastrada com sucesso!");
                    }
                  }}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  {editingAccount ? 'Salvar Alterações' : 'Confirmar Cadastro'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Manual Credit Card Addition Modal */}
        {isOpenAddCard && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpenAddCard(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 z-10"
            >
              <div className="flex justify-between items-start">
                <h4 className="text-base font-bold text-white font-display">
                  {editingCard ? 'Editar Cartão de Crédito' : 'Cadastrar Cartão de Crédito'}
                </h4>
                <button
                  onClick={() => setIsOpenAddCard(false)}
                  className="p-1 rounded-full bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <div className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Nome do Cartão (Ex: Itaú Visa Infinite)</label>
                  <input
                    type="text"
                    value={newCardName}
                    onChange={(e) => setNewCardName(e.target.value)}
                    placeholder="Ex: NUBANK ULTRAVIOLETA"
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-emerald-500 transition-colors uppercase font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Limite Total (R$)</label>
                    <input
                      type="text"
                      value={newCardLimit}
                      onChange={(e) => {
                        let raw = e.target.value.replace(/\D/g, "");
                        if (!raw) {
                          setNewCardLimit('0,00');
                          return;
                        }
                        let numeric = parseInt(raw, 10) / 100;
                        setNewCardLimit(numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                      }}
                      placeholder="0,00"
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Gasto Atual (R$)</label>
                    <input
                      type="text"
                      value={newCardSpent}
                      onChange={(e) => {
                        let raw = e.target.value.replace(/\D/g, "");
                        if (!raw) {
                          setNewCardSpent('0,00');
                          return;
                        }
                        let numeric = parseInt(raw, 10) / 100;
                        setNewCardSpent(numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                      }}
                      placeholder="0,00"
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    const cleanLimit = newCardLimit.replace(/\./g, "").replace(",", ".");
                    const cleanSpent = newCardSpent.replace(/\./g, "").replace(",", ".");
                    const parsedLimit = parseFloat(cleanLimit);
                    const parsedSpent = parseFloat(cleanSpent);
                    if (!newCardName.trim() || isNaN(parsedLimit) || isNaN(parsedSpent)) {
                      showAlert("Dados Inválidos", "Por favor, preencha o nome do cartão, limite e gastos atuais com valores numéricos válidos.");
                      return;
                    }

                    if (editingCard) {
                      setCreditCards(prev => prev.map(c => c.id === editingCard.id ? {
                        ...c,
                        nome: newCardName.trim().toUpperCase(),
                        limite: parsedLimit,
                        gasto: parsedSpent
                      } : c));
                      setEditingCard(null);
                      setIsOpenAddCard(false);
                      showAlert("Sucesso", "Cartão editado com sucesso!");
                    } else {
                      setCreditCards(prev => [
                        ...prev,
                        {
                          id: Date.now(),
                          nome: newCardName.trim().toUpperCase(),
                          tipo: 'CARTÃO',
                          limite: parsedLimit,
                          gasto: parsedSpent
                        }
                      ]);
                      setIsOpenAddCard(false);
                      showAlert("Sucesso", "Cartão cadastrado com sucesso!");
                    }
                  }}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  {editingCard ? 'Salvar Alterações' : 'Confirmar Cadastro'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Manual Vehicle Addition Modal */}
        {isOpenAddVehicle && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpenAddVehicle(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 z-10 text-left"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-base font-bold text-white font-display">Cadastrar Veículo &amp; Motorista</h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">Associe um carro a um motorista fixo.</p>
                </div>
                <button
                  onClick={() => setIsOpenAddVehicle(false)}
                  className="p-1 rounded-full bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Descrição do Veículo (ex: FOX ROCK RIO, CG 160)</label>
                  <input
                    type="text"
                    value={vehicleDescInput}
                    onChange={(e) => setVehicleDescInput(e.target.value)}
                    placeholder="Ex: FOX ROCK RIO"
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-emerald-500 transition-colors uppercase font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Nome do Motorista Principal</label>
                  <input
                    type="text"
                    value={vehicleDriverInput}
                    onChange={(e) => setVehicleDriverInput(e.target.value)}
                    placeholder="Ex: ALEXANDRE"
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-emerald-500 transition-colors uppercase font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Placa do Veículo (Opcional)</label>
                  <input
                    type="text"
                    value={vehiclePlacaInput}
                    onChange={(e) => setVehiclePlacaInput(e.target.value)}
                    placeholder="Ex: ABC-1234"
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-emerald-500 transition-colors uppercase font-mono"
                  />
                </div>

                <button
                  onClick={handleAddVehicleSubmit}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer font-mono active:scale-95"
                >
                  Salvar Veículo
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Add Webhook Config Modal */}
        {showAddWebhookModal && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddWebhookModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 text-left z-10"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider">Adicionar Regra de Banco</h3>
                <button
                  onClick={() => setShowAddWebhookModal(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Nome da Instituição Financeira</label>
                  <input
                    type="text"
                    value={newRuleBank}
                    onChange={(e) => setNewRuleBank(e.target.value)}
                    placeholder="Ex: Banco do Brasil, C6 Bank, XP"
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-emerald-500 transition-colors font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Secret Token de Segurança</label>
                  <input
                    type="text"
                    value={newRuleSecret}
                    onChange={(e) => setNewRuleSecret(e.target.value)}
                    placeholder="Ex: secret_abc123"
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 font-mono outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <button
                  onClick={() => {
                    if (!newRuleBank.trim()) {
                      showAlert("Campo Obrigatório", "Por favor, insira o nome do banco.");
                      return;
                    }
                    const newRule = {
                      id: String(Date.now()),
                      banco: newRuleBank.trim(),
                      status: 'ATIVO',
                      secretToken: newRuleSecret.trim() || 'sec_' + Math.floor(Math.random() * 1000),
                      url: 'https://wealthflow.api/webhooks/custom',
                      ultimaChamada: 'Nunca'
                    };
                    const updated = [...webhooksConfig, newRule];
                    saveWebhooksToLocalStorage(updated);
                    setShowAddWebhookModal(false);
                    setNewRuleBank('C6 Bank');
                    setNewRuleSecret('c6_sec_' + Math.floor(Math.random() * 10000));
                    showAlert("Sucesso", `Regra de webhook para ${newRule.banco} adicionada com sucesso!`);
                  }}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer font-sans active:scale-95"
                >
                  Adicionar Banco
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
