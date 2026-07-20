import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, RiskZone, Infraction, MedicalAppointment, MedicalPrescription, BankAccount, CreditCard, RegisteredVehicle, Compromisso, CarServicePerformed, CarServiceScheduled, SecurityConfig } from './types';
import { initialTransactions, bankAccounts, creditCards } from './data/transactions';
import { initialRiskZones } from './data/riskZones';
import { initialInfractions, nonAppealedInfractions } from './data/infractions';

// Tab imports
import Dashboard from './components/Dashboard';
import TransactionsTab from './components/TransactionsTab';
import AnalysisTab from './components/AnalysisTab';
import RiskZonesTab from './components/RiskZonesTab';
import ProfileTab from './components/ProfileTab';
import MedicalAppointmentsTab, { isNotificationPeriod } from './components/MedicalAppointmentsTab';
import CompromissosTab from './components/CompromissosTab';
import CarServicesTab from './components/CarServicesTab';
import LockScreen from './components/LockScreen';
import { checkIpvaAlerts } from './lib/ipvaUtils';

// Database Sync API
import { 
  getTransactionsFromDb, 
  saveTransactionToDb, 
  deleteTransactionFromDb, 
  getRiskZonesFromDb, 
  saveRiskZoneToDb, 
  deleteRiskZoneFromDb, 
  getInfractionsFromDb, 
  saveInfractionToDb, 
  deleteInfractionFromDb,
  getNonAppealedFromDb, 
  deleteNonAppealedFromDb, 
  getAvatarUrlFromDb, 
  saveAvatarUrlToDb,
  getMedicalAppointmentsFromDb,
  saveMedicalAppointmentToDb,
  deleteMedicalAppointmentFromDb,
  getMedicalPrescriptionsFromDb,
  saveMedicalPrescriptionToDb,
  deleteMedicalPrescriptionFromDb,
  getRegisteredVehiclesFromDb,
  saveRegisteredVehicleToDb,
  deleteRegisteredVehicleFromDb,
  getSyncTimestampFromDb,
  saveSyncTimestampToDb,
  getCompromissosFromDb,
  saveCompromissoToDb,
  deleteCompromissoFromDb,
  getCustomCategoriesFromDb,
  saveCustomCategoriesToDb,
  getSecurityConfigFromDb,
  saveSecurityConfigToDb,
  getPerformedServicesFromDb,
  savePerformedServiceToDb,
  deletePerformedServiceFromDb,
  getScheduledServicesFromDb,
  saveScheduledServiceToDb,
  deleteScheduledServiceFromDb
} from './lib/firebaseSync';

// Google Sheets synchronization API
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  findOrCreateSpreadsheet, 
  syncDataToSpreadsheet,
  fetchTransactionsFromSpreadsheet,
  uploadBackupToDrive
} from './lib/googleAuth';

// Helper to deduplicate transactions securely
function cleanDuplicateTransactions(txs: Transaction[]): Transaction[] {
  const seenIds = new Set<number>();
  const uniqueTxs: Transaction[] = [];

  txs.forEach(t => {
    if (!t) return;
    
    let idNum = Number(t.id);
    if (isNaN(idNum) || idNum <= 0) {
      idNum = Math.floor(Math.random() * 1000000000) + 1000000000;
      t.id = idNum;
    }

    if (seenIds.has(idNum)) {
      return;
    }
    seenIds.add(idNum);
    uniqueTxs.push(t);
  });

  return uniqueTxs;
}

// Converte a chave pública VAPID do servidor para o formato do navegador
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [showAddTxForm, setShowAddTxForm] = useState<boolean>(false);
  const [isMaisMenuOpen, setIsMaisMenuOpen] = useState<boolean>(false);
  const [isDbLoaded, setIsDbLoaded] = useState<boolean>(false);

  // Synchronization locking references
  const syncLockRef = React.useRef<boolean>(false);
  const lastSyncedTxRef = React.useRef<string>('');
  const syncPendingRef = React.useRef<boolean>(false);
  const pendingSyncParamsRef = React.useRef<{
    tokenToUse?: string;
    isBackground?: boolean;
    overrideTxs?: Transaction[];
    overrideInfracs?: Infraction[];
    overrideZones?: RiskZone[];
    overrideAppts?: MedicalAppointment[];
    overridePrescs?: MedicalPrescription[];
  } | null>(null);

  // Live state lists
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_transactions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return cleanDuplicateTransactions(parsed);
      }
    } catch (e) {
      console.error("Failed to parse transactions state:", e);
    }
    return cleanDuplicateTransactions(initialTransactions);
  });
  const [riskZones, setRiskZones] = useState<RiskZone[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_riskzones');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Failed to parse risk zones state:", e);
    }
    return initialRiskZones;
  });
  const [infractions, setInfractions] = useState<Infraction[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_infractions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Failed to parse infractions state:", e);
    }
    return initialInfractions;
  });
  const [nonAppealed, setNonAppealed] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_nonappealed');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Failed to parse non-appealed infractions state:", e);
    }
    return nonAppealedInfractions;
  });
  const [appointments, setAppointments] = useState<MedicalAppointment[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_appointments');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Failed to parse appointments state:", e);
    }
    return [];
  });
  const [prescriptions, setPrescriptions] = useState<MedicalPrescription[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_prescriptions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Failed to parse prescriptions state:", e);
    }
    return [];
  });

  const [registeredVehicles, setRegisteredVehicles] = useState<RegisteredVehicle[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_registered_vehicles');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(v => v.descricao.toUpperCase() !== 'FOX PRATA');
        }
      }
    } catch (e) {
      console.error("Failed to parse registered vehicles state:", e);
    }
    return [{ id: '1', descricao: 'FOX ROCK RIO 1.6', motorista: 'ALEXANDRE', placa: 'FVS4I24' }];
  });

  const [compromissos, setCompromissos] = useState<Compromisso[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_compromissos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Failed to parse compromissos state:", e);
    }
    return [];
  });

  const [performedServices, setPerformedServices] = useState<CarServicePerformed[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_car_services_performed');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter(s => s.veiculoDescricao?.toUpperCase() !== 'FOX PRATA');
      }
    } catch (e) {
      console.error("Failed to parse performed services state:", e);
    }
    return [
      {
        id: 'p1',
        veiculoDescricao: 'FOX ROCK RIO 1.6',
        descricao: 'Troca de Óleo e Filtro',
        data: '2026-04-11',
        km: 82350,
        valor: 250,
        oficina: 'Auto Center Gaeta',
        observacoes: 'Óleo Shell Helix 10w40 semissintético.',
        updatedAt: Date.now()
      }
    ];
  });

  const [scheduledServices, setScheduledServices] = useState<CarServiceScheduled[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_car_services_scheduled');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter(s => s.veiculoDescricao?.toUpperCase() !== 'FOX PRATA');
      }
    } catch (e) {
      console.error("Failed to parse scheduled services state:", e);
    }
    return [
      {
        id: 's1',
        veiculoDescricao: 'FOX ROCK RIO 1.6',
        descricao: 'Revisão Geral',
        tipoAgendamento: 'DATA_E_KM',
        dataAlvo: '2026-08-15',
        kmAlvo: 90000,
        recorrente: false,
        status: 'PENDENTE',
        updatedAt: Date.now()
      }
    ];
  });

  const [avatarUrl, setAvatarUrl] = useState<string>(() => localStorage.getItem('wealthflow_avatarurl') || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDclcawui2tKuHgw4p_DWvKBp0R7XYoJIo41kp-qWXzNhTbDso-7IAoirqhYyc-HEWXFiHIGP6YdyvyG4u4xgKT0ecq0uBLAJEXGIxgaymfedUvUw5PmlAfsh600Je_GbTdL8UgPj2BZ18ovSoiV_-08bm1CxxuR-RaAO569na_pVi2ObUv5FfHdqk1JhAf68RSSZF5WqsPDCCmYfWunTzLuQcRHOJn29EvtKwGGBucDh8ZAdyadLyd');
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_custom_categories');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [categoryBudgets, setCategoryBudgets] = useState<{ [category: string]: number }>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_category_budgets');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    localStorage.setItem('wealthflow_category_budgets', JSON.stringify(categoryBudgets));
  }, [categoryBudgets]);

  const [ipvaLeadDays, setIpvaLeadDays] = useState<number>(() => Number(localStorage.getItem('wealthflow_ipva_lead_days') || '30'));
  const [ipvaClosingDay, setIpvaClosingDay] = useState<number>(() => Number(localStorage.getItem('wealthflow_ipva_closing_day') || '15'));
  const [ipvaNotificationColor, setIpvaNotificationColor] = useState<string>(() => localStorage.getItem('wealthflow_ipva_notification_color') || 'orange');
  const [dailyCheckInTime, setDailyCheckInTime] = useState<string>(() => localStorage.getItem('wealthflow_daily_checkin_time') || '');
  const [medicalAppointmentLeadDays, setMedicalAppointmentLeadDays] = useState<number>(() => Number(localStorage.getItem('wealthflow_medical_appointment_lead_days') || '2'));
  const [notifyIpva, setNotifyIpva] = useState<boolean>(() => localStorage.getItem('wealthflow_notify_ipva') !== 'false');
  const [defaultVehicleId, setDefaultVehicleId] = useState<string>(() => localStorage.getItem('wealthflow_default_vehicle_id') || '');
  const [licensingReminderDay, setLicensingReminderDay] = useState<number>(() => Number(localStorage.getItem('wealthflow_licensing_reminder_day') || '10'));
  const [notifyLicensing, setNotifyLicensing] = useState<boolean>(() => localStorage.getItem('wealthflow_notify_licensing') !== 'false');
  const [notifyBudget, setNotifyBudget] = useState<boolean>(() => localStorage.getItem('wealthflow_notify_budget') !== 'false');
  const [notifyAppointments, setNotifyAppointments] = useState<boolean>(() => localStorage.getItem('wealthflow_notify_appointments') !== 'false');

  useEffect(() => { localStorage.setItem('wealthflow_ipva_lead_days', String(ipvaLeadDays)); }, [ipvaLeadDays]);
  useEffect(() => { localStorage.setItem('wealthflow_ipva_closing_day', String(ipvaClosingDay)); }, [ipvaClosingDay]);
  useEffect(() => { localStorage.setItem('wealthflow_ipva_notification_color', ipvaNotificationColor); }, [ipvaNotificationColor]);
  useEffect(() => { localStorage.setItem('wealthflow_daily_checkin_time', dailyCheckInTime); }, [dailyCheckInTime]);
  useEffect(() => { localStorage.setItem('wealthflow_medical_appointment_lead_days', String(medicalAppointmentLeadDays)); }, [medicalAppointmentLeadDays]);
  useEffect(() => { localStorage.setItem('wealthflow_default_vehicle_id', defaultVehicleId); }, [defaultVehicleId]);
  useEffect(() => { localStorage.setItem('wealthflow_licensing_reminder_day', String(licensingReminderDay)); }, [licensingReminderDay]);
  useEffect(() => { localStorage.setItem('wealthflow_notify_licensing', String(notifyLicensing)); }, [notifyLicensing]);
  useEffect(() => { localStorage.setItem('wealthflow_notify_ipva', String(notifyIpva)); }, [notifyIpva]);
  useEffect(() => { localStorage.setItem('wealthflow_notify_budget', String(notifyBudget)); }, [notifyBudget]);
  useEffect(() => { localStorage.setItem('wealthflow_notify_appointments', String(notifyAppointments)); }, [notifyAppointments]);

  // Captura automática de deep links originados do clique dos botões da notificação nativa
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('add') === 'true') {
      const tipo = params.get('tipo');
      const valor = params.get('valor');
      const descricao = params.get('descricao');
      const banco = params.get('banco');

      if (tipo) localStorage.setItem('draft_txType', tipo);
      if (valor) localStorage.setItem('draft_valor', valor);
      if (descricao) localStorage.setItem('draft_descricao', banco ? `${descricao} (via ${banco})` : descricao);
      
      localStorage.setItem('draft_category', tipo === 'RECEITA' ? 'TRABALHO' : 'ABASTECIMENTO');
      
      setCurrentTab('transactions');
      setShowAddTxForm(true);

      // Limpa os parâmetros da URL para evitar recarregamento em loop
      window.history.replaceState({}, document.title, window.location.pathname);
      showAlert("Pix Detectado", "Os dados do seu Pix foram inseridos com sucesso no formulário!");
    }
  }, []);

  // REGISTRO AUTOMÁTICO DO NATIVE WEB PUSH COM O BACKEND NA RENDER
  useEffect(() => {
    async function registerPushSystem() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn("Este navegador não suporta notificações Web Push nativas.");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        // 1. Busca a chave pública VAPID do backend
        const keyResponse = await fetch('https://financas-gaeta-app.onrender.com/api/webhooks/push-public-key');
        if (!keyResponse.ok) throw new Error("Falha ao ler chave pública do servidor");
        const { publicKey } = await keyResponse.json();

        // 2. Inscreve o navegador no gateway de mensagens
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        // 3. Envia os dados de inscrição do celular para o servidor na Render
        await fetch('https://financas-gaeta-app.onrender.com/api/webhooks/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription })
        });

        console.log("[Web Push] Dispositivo inscrito e salvo no servidor com sucesso.");
      } catch (err) {
        console.error("[Web Push] Erro na sincronização automática do push:", err);
      }
    }

    if (isDbLoaded) {
      registerPushSystem();
    }
  }, [isDbLoaded]);

  // Check check-in time every 30 seconds
  useEffect(() => {
    const checkDailyCheckIn = () => {
      if (!dailyCheckInTime) return;
      const now = new Date();
      const currentHM = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      if (currentHM === dailyCheckInTime) {
        const todayStr = now.toDateString();
        const lastNotified = localStorage.getItem('wealthflow_last_checkin_notified_date');
        
        if (lastNotified !== todayStr) {
          localStorage.setItem('wealthflow_last_checkin_notified_date', todayStr);
          
          showConfirm(
            "⏰ CHECK-IN DIÁRIO",
            "Chegou o seu horário de check-in diário! Deseja abrir a página de transações para registrar seus gastos e receitas de hoje?",
            () => {
              setCurrentTab('transactions');
              setShowAddTxForm(true);
            }
          );
        }
      }
    };

    checkDailyCheckIn();
    const interval = setInterval(checkDailyCheckIn, 30000);
    return () => clearInterval(interval);
  }, [dailyCheckInTime]);

  // Security Lock Config
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_security_config');
      return saved ? JSON.parse(saved) : { enabled: false, mode: 'PIN', password: 'admin', pin: '1234', biometricType: 'FACE_ID' };
    } catch { return { enabled: false, mode: 'PIN', password: 'admin', pin: '1234', biometricType: 'FACE_ID' }; }
  });

  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_security_config');
      if (saved) return !!JSON.parse(saved).enabled;
    } catch {}
    return false;
  });

  // Load Firestore on mount
  useEffect(() => {
    async function loadData() {
      try {
        const txList = await getTransactionsFromDb();
        const cleanList = cleanDuplicateTransactions(txList);
        setTransactions(cleanList);
        
        if (cleanList.length < txList.length) {
          const cleanIds = new Set(cleanList.map(t => t.id));
          const duplicateTxs = txList.filter(t => !cleanIds.has(t.id));
          for (const dup of duplicateTxs) {
            await deleteTransactionFromDb(dup.id);
          }
          localStorage.setItem('wealthflow_transactions', JSON.stringify(cleanList));
        }
        
        setRiskZones(await getRiskZonesFromDb());
        const dbSyncTimestamp = await getSyncTimestampFromDb();
        if (dbSyncTimestamp > 0) localStorage.setItem('wealthflow_last_synced_timestamp', String(dbSyncTimestamp));
        setInfractions(await getInfractionsFromDb());
        setNonAppealed(await getNonAppealedFromDb());
        setAppointments(await getMedicalAppointmentsFromDb());
       setPrescriptions(await getMedicalPrescriptionsFromDb());
        
        const vehicleList = await getRegisteredVehiclesFromDb();
        if (vehicleList?.length > 0) setRegisteredVehicles(vehicleList);

        const compList = await getCompromissosFromDb();
        setCompromissos(compList);
        localStorage.setItem('wealthflow_compromissos', JSON.stringify(compList));

        const dbPerfList = await getPerformedServicesFromDb();
        if (dbPerfList?.length > 0) setPerformedServices(dbPerfList);

        const dbSchedList = await getScheduledServicesFromDb();
        if (dbSchedList?.length > 0) setScheduledServices(dbSchedList);

        setAvatarUrl(await getAvatarUrlFromDb());
        const customCats = await getCustomCategoriesFromDb();
        if (customCats?.length > 0) setCustomCategories(customCats);

        const secConfig = await getSecurityConfigFromDb();
        if (secConfig) {
          setSecurityConfig(secConfig);
          setIsAppLocked(!!secConfig.enabled);
        }

        lastSyncedTxRef.current = `${JSON.stringify(cleanList)}_${JSON.stringify(infractions)}_${JSON.stringify(riskZones)}`;
      } catch (e) {
        console.error("Error loading data from Firestore, using offline cache:", e);
      } finally {
        setIsDbLoaded(true);
      }
    }
    loadData();
  }, []);

  useEffect(() => { saveCustomCategoriesToDb(customCategories); }, [customCategories]);
  useEffect(() => { saveSecurityConfigToDb(securityConfig); }, [securityConfig]);
  useEffect(() => { localStorage.setItem('wealthflow_transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('wealthflow_riskzones', JSON.stringify(riskZones)); }, [riskZones]);
  useEffect(() => { localStorage.setItem('wealthflow_infractions', JSON.stringify(infractions)); }, [infractions]);
  useEffect(() => { localStorage.setItem('wealthflow_appointments', JSON.stringify(appointments)); }, [appointments]);
  useEffect(() => { localStorage.setItem('wealthflow_prescriptions', JSON.stringify(prescriptions)); }, [prescriptions]);
  useEffect(() => { localStorage.setItem('wealthflow_registered_vehicles', JSON.stringify(registeredVehicles)); }, [registeredVehicles]);
  useEffect(() => { localStorage.setItem('wealthflow_car_services_performed', JSON.stringify(performedServices)); }, [performedServices]);
  useEffect(() => { localStorage.setItem('wealthflow_car_services_scheduled', JSON.stringify(scheduledServices)); }, [scheduledServices]);

  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>(() => localStorage.getItem('wealthflow_spreadsheet_url') || '');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>(() => localStorage.getItem('wealthflow_last_synced_time') || '');
  const [autoSync, setAutoSync] = useState<boolean>(() => localStorage.getItem('wealthflow_auto_sync') === 'true');

  const [bankAccountsState, setBankAccountsState] = useState<BankAccount[]>(() => bankAccounts);
  const [creditCardsState, setCreditCardsState] = useState<CreditCard[]>(() => creditCards);

  const hasExpiringTransactions = React.useMemo(() => {
    return transactions.some(t => {
      if (t.tipo === 'CONTAS BANCARIAS' || t.tipo === 'CARTÃO DE CRÉDITO') return false;
      if (['PAGO', 'RECEBIDO'].includes(String(t.status || '').trim().toUpperCase())) return false;
      return true;
    });
  }, [transactions]);

  const hasActiveAppointments = React.useMemo(() => {
    return appointments.some(appt => appt.status === 'Agendada');
  }, [appointments]);

  const hasUrgentIpva = React.useMemo(() => {
    const alerts = checkIpvaAlerts(registeredVehicles, new Date(), transactions, ipvaLeadDays);
    return alerts.some(alert => alert.daysRemaining < 10);
  }, [registeredVehicles, transactions, ipvaLeadDays]);

  const hasOverdueServices = React.useMemo(() => {
    return scheduledServices.some(s => s.status === 'PENDENTE');
  }, [scheduledServices]);

  interface PendingChange {
    id: string;
    type: string;
    title: string;
    timestamp: number;
    status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
    error?: string;
  }

  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSyncQueueModal, setShowSyncQueueModal] = useState(false);

  const runTrackedSync = async <T,>(type: string, title: string, operation: () => Promise<T>): Promise<T> => {
    const changeId = Date.now().toString();
    const newChange: PendingChange = { id: changeId, type, title, timestamp: Date.now(), status: 'PENDING' };
    setPendingChanges(prev => [newChange, ...prev]);
    try {
      const res = await operation();
      setPendingChanges(prev => prev.map(c => c.id === changeId ? { ...c, status: 'SYNCED' } : c));
      return res;
    } catch (err: any) {
      setPendingChanges(prev => prev.map(c => c.id === changeId ? { ...c, status: 'FAILED', error: err.message } : c));
      return null as any;
    }
  };

  const handleRetryAllSync = async () => {
    setPendingChanges([]);
  };

  const handleClearSyncHistory = () => {
    setPendingChanges([]);
  };

  const [dialog, setDialog] = useState<{ isOpen: boolean; title: string; message: string; isConfirm: boolean; onConfirm?: () => void }>({ isOpen: false, title: '', message: '', isConfirm: false });
  const showAlert = (title: string, message: string) => setDialog({ isOpen: true, title, message, isConfirm: false });
  const showConfirm = (title: string, message: string, onConfirm: () => void) => setDialog({ isOpen: true, title, message, isConfirm: true, onConfirm });

  useEffect(() => {
    const unsubscribe = initAuth((user, token) => { setGoogleUser(user); setGoogleToken(token); }, () => { setGoogleUser(null); setGoogleToken(null); });
    return () => unsubscribe();
  }, []);

  const triggerSync = async (tokenToUse?: string) => {};
  const handleGoogleLogin = async () => { const res = await googleSignIn(); if (res) { setGoogleUser(res.user); setGoogleToken(res.accessToken); } };
  const handleGoogleLogout = async () => { await logout(); setGoogleUser(null); setGoogleToken(null); };
  const handleToggleAutoSync = (checked: boolean) => setAutoSync(checked);
  const triggerImport = async () => {};

  const [timeStr, setTimeStr] = useState<string>('22:00');
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAddTransaction = async (newTx: any) => {
    const id = Date.now();
    const txObj = { id, ...newTx, updatedAt: Date.now() };
    setTransactions(prev => [txObj, ...prev]);
    await saveTransactionToDb(txObj);
  };

  const handleEditTransaction = async (id: number, fields: any) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...fields, updatedAt: Date.now() } : t));
  };

  const handleDeleteTransaction = async (id: number) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    await deleteTransactionFromDb(id);
  };

  const handleTabNavigate = (tab: string) => {
    if (['add-transaction', 'add-receita', 'add-despesa'].includes(tab)) {
      localStorage.setItem('draft_txType', tab === 'add-receita' ? 'RECEITA' : 'DESPESA');
      setCurrentTab('transactions');
      setShowAddTxForm(true);
    } else {
      setShowAddTxForm(false);
      setCurrentTab(tab);
    }
  };

  const renderCurrentView = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <Dashboard 
            transactions={transactions} bankAccounts={bankAccountsState} creditCards={creditCardsState}
            onNavigate={handleTabNavigate} appointments={appointments} prescriptions={prescriptions}
            compromissos={compromissos} scheduledServices={scheduledServices} onEditTransaction={handleEditTransaction}
            onAddTransaction={handleAddTransaction} onTriggerNotification={() => {}} onTriggerBankIntegration={() => {}}
            showConfirm={showConfirm} showAlert={showAlert} riskZones={riskZones} registeredVehicles={registeredVehicles}
            setRegisteredVehicles={setRegisteredVehicles} categoryBudgets={categoryBudgets} setCategoryBudgets={setCategoryBudgets}
            customCategories={customCategories} ipvaLeadDays={ipvaLeadDays} setIpvaLeadDays={setIpvaLeadDays}
            ipvaClosingDay={ipvaClosingDay} medicalAppointmentLeadDays={medicalAppointmentLeadDays}
            ipvaNotificationColor={ipvaNotificationColor} dailyCheckInTime={dailyCheckInTime} setDailyCheckInTime={setDailyCheckInTime}
            notifyIpva={notifyIpva} defaultVehicleId={defaultVehicleId}
          />
        );
      case 'transactions':
        return (
          <TransactionsTab 
            transactions={transactions} infractions={infractions} onAddTransaction={handleAddTransaction}
            onEditTransaction={handleEditTransaction} onDeleteTransaction={handleDeleteTransaction}
            onImportTransactions={() => {}} onWipeTransactions={() => {}} onReindexTransactions={() => {}}
            showAddForm={showAddTxForm} setShowAddForm={setShowAddTxForm} googleUser={googleUser}
            googleToken={googleToken} isSyncing={isSyncing} isImporting={isImporting} spreadsheetUrl={spreadsheetUrl}
            syncError={syncError} lastSyncedTime={lastSyncedTime} autoSync={autoSync} onGoogleLogin={handleGoogleLogin}
            onGoogleLogout={handleGoogleLogout} onToggleAutoSync={handleToggleAutoSync} onTriggerSync={triggerSync}
            onTriggerImport={triggerImport} showAlert={showAlert} showConfirm={showConfirm} registeredVehicles={registeredVehicles}
            setRegisteredVehicles={setRegisteredVehicles} bankAccounts={bankAccountsState} onUpdateBankAccounts={setBankAccountsState}
            customCategories={customCategories} onTriggerBankIntegration={() => {}}
          />
        );
      case 'analysis': return <AnalysisTab transactions={transactions} onNavigate={handleTabNavigate} showAlert={showAlert} />;
      case 'profile':
        return (
          <ProfileTab 
            bankAccounts={bankAccountsState} setBankAccounts={setBankAccountsState} creditCards={creditCardsState}
            setCreditCards={setCreditCardsState} avatarUrl={avatarUrl} onAvatarChange={setAvatarUrl}
            transactions={transactions} setTransactions={setTransactions} riskZones={riskZones} setRiskZones={setRiskZones}
            infractions={infractions} setInfractions={setInfractions} nonAppealed={nonAppealed} setNonAppealed={setNonAppealed}
            showAlert={showAlert} showConfirm={showConfirm} registeredVehicles={registeredVehicles} setRegisteredVehicles={setRegisteredVehicles}
            compromissos={compromissos} customCategories={customCategories} setCustomCategories={setCustomCategories}
            securityConfig={securityConfig} setSecurityConfig={setSecurityConfig} onTestLock={() => setIsAppLocked(true)}
            categoryBudgets={categoryBudgets} setCategoryBudgets={setCategoryBudgets} googleToken={googleToken}
            googleUser={googleUser} onGoogleLogin={handleGoogleLogin} onGoogleLogout={handleGoogleLogout}
            ipvaLeadDays={ipvaLeadDays} setIpvaLeadDays={setIpvaLeadDays} ipvaClosingDay={ipvaClosingDay}
            setIpvaClosingDay={setIpvaClosingDay} medicalAppointmentLeadDays={medicalAppointmentLeadDays}
            setMedicalAppointmentLeadDays={setMedicalAppointmentLeadDays} ipvaNotificationColor={ipvaNotificationColor}
            setIpvaNotificationColor={setIpvaNotificationColor} notifyIpva={notifyIpva} setNotifyIpva={setNotifyIpva}
            notifyBudget={notifyBudget} setNotifyBudget={setNotifyBudget} notifyAppointments={notifyAppointments}
            setNotifyAppointments={setNotifyAppointments} dailyCheckInTime={dailyCheckInTime} setDailyCheckInTime={setDailyCheckInTime}
            defaultVehicleId={defaultVehicleId} setDefaultVehicleId={setDefaultVehicleId} licensingReminderDay={licensingReminderDay}
            setLicensingReminderDay={setLicensingReminderDay} notifyLicensing={notifyLicensing} setNotifyLicensing={setNotifyLicensing}
          />
        );
      case 'carservices':
        return (
          <CarServicesTab 
            performedServices={performedServices} scheduledServices={scheduledServices} registeredVehicles={registeredVehicles}
            bankAccounts={bankAccountsState} transactions={transactions} onAddPerformedService={() => {}}
            onEditPerformedService={() => {}} onDeletePerformedService={() => {}} onAddScheduledService={() => {}}
            onEditScheduledService={() => {}} onDeleteScheduledService={() => {}} onAddTransaction={handleAddTransaction}
            showAlert={showAlert} showConfirm={showConfirm} onAddFuel={() => {}}
          />
        );
      default: return null;
    }
  };

  return (
    <div className="h-[100dvh] md:min-h-screen bg-slate-950 flex items-center justify-center p-0 md:p-6 text-slate-100 font-sans overflow-hidden">
      <div className="w-full max-w-md h-[100dvh] md:h-[840px] bg-slate-900 md:rounded-[42px] md:border-8 md:border-slate-800 shadow-2xl flex flex-col overflow-hidden relative">
        
        <AnimatePresence>
          {isAppLocked && securityConfig.enabled && (
            <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100]">
              <LockScreen securityConfig={securityConfig} onUnlock={() => setIsAppLocked(false)} avatarUrl={avatarUrl} />
            </motion.div>
          )}
        </AnimatePresence>

        <header className="bg-slate-950/80 backdrop-blur-md px-6 py-2.5 flex justify-between items-center text-xs text-slate-300 z-40 relative">
          <span className="font-semibold font-mono">{timeStr}</span>
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="text-emerald-400 font-bold uppercase">5G</span>
          </div>
        </header>

        <main className="flex-grow overflow-y-auto px-4 pt-3 pb-24 relative bg-slate-950">
          <AnimatePresence mode="wait">
            <motion.div key={currentTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="w-full">
              {renderCurrentView()}
            </motion.div>
          </AnimatePresence>
        </main>

        <nav className="absolute bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/80 px-1 pt-1.5 pb-4 grid grid-cols-5 gap-0.5 z-40">
          <button onClick={() => handleTabNavigate('dashboard')} className={`flex flex-col items-center py-1 ${currentTab === 'dashboard' ? 'text-emerald-400' : 'text-slate-400'}`}>
            <span className="material-symbols-outlined text-[20px]">dashboard</span>
            <span className="text-[9px] font-bold">Painel</span>
          </button>
          <button onClick={() => handleTabNavigate('transactions')} className={`flex flex-col items-center py-1 ${currentTab === 'transactions' ? 'text-emerald-400' : 'text-slate-400'}`}>
            <span className="material-symbols-outlined text-[20px]">receipt_long</span>
            <span className="text-[9px] font-bold">Finanças</span>
          </button>
          <button onClick={() => handleTabNavigate('carservices')} className={`flex flex-col items-center py-1 ${currentTab === 'carservices' ? 'text-emerald-400' : 'text-slate-400'}`}>
            <span className="material-symbols-outlined text-[20px]">build_circle</span>
            <span className="text-[9px] font-bold">Oficina</span>
          </button>
          <button onClick={() => handleTabNavigate('profile')} className={`flex flex-col items-center py-1 ${currentTab === 'profile' ? 'text-emerald-400' : 'text-slate-400'}`}>
            <span className="material-symbols-outlined text-[20px]">person</span>
            <span className="text-[9px] font-bold">Perfil</span>
          </button>
          <button onClick={() => setIsMaisMenuOpen(true)} className="flex flex-col items-center py-1 text-slate-400">
            <span className="material-symbols-outlined text-[20px]">more_horiz</span>
            <span className="text-[9px] font-bold">Mais</span>
          </button>
        </nav>

        <AnimatePresence>
          {isMaisMenuOpen && (
            <div className="absolute inset-0 z-50 flex items-end justify-center">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMaisMenuOpen(false)} className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" />
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-slate-900 border-t border-slate-800 rounded-t-[32px] w-full p-6 pb-8 z-10">
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => { handleTabNavigate('analysis'); setIsMaisMenuOpen(false); }} className="flex flex-col items-center p-4 rounded-2xl bg-slate-950 text-slate-400"><span className="material-symbols-outlined text-[28px]">query_stats</span><span className="text-xs font-bold">Análise</span></button>
                </div>
                <button onClick={() => setIsMaisMenuOpen(false)} className="mt-6 w-full bg-slate-800 text-slate-300 py-3 rounded-xl text-xs font-bold uppercase">Fechar</button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {dialog.isOpen && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[9999]">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/80" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-sm relative z-10 text-center">
              <h3 className="text-sm font-bold uppercase text-slate-100 mb-2">{dialog.title}</h3>
              <p className="text-xs text-slate-400 mb-4">{dialog.message}</p>
              <div className="flex gap-3 w-full">
                {dialog.isConfirm ? (
                  <>
                    <button onClick={() => setDialog(prev => ({ ...prev, isOpen: false }))} className="flex-1 bg-slate-800 text-slate-300 py-2.5 rounded-xl text-xs font-bold">Cancelar</button>
                    <button onClick={() => { setDialog(prev => ({ ...prev, isOpen: false })); dialog.onConfirm?.(); }} className="flex-1 bg-rose-500 text-white py-2.5 rounded-xl text-xs font-bold">Confirmar</button>
                  </>
                ) : (
                  <button onClick={() => setDialog(prev => ({ ...prev, isOpen: false }))} className="w-full bg-emerald-500 text-slate-950 py-2.5 rounded-xl text-xs font-bold">OK</button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
