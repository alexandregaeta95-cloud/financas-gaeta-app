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
    if (seenIds.has(idNum)) return;
    seenIds.add(idNum);
    uniqueTxs.push(t);
  });
  return uniqueTxs;
}

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

  const syncLockRef = React.useRef<boolean>(false);
  const lastSyncedTxRef = React.useRef<string>('');

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_transactions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return cleanDuplicateTransactions(parsed);
      }
    } catch (e) {}
    return cleanDuplicateTransactions(initialTransactions);
  });
  
  const [riskZones, setRiskZones] = useState<RiskZone[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_riskzones');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return initialRiskZones;
  });

  const [infractions, setInfractions] = useState<Infraction[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_infractions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return initialInfractions;
  });

  const [nonAppealed, setNonAppealed] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_nonappealed');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return nonAppealedInfractions;
  });

  const [appointments, setAppointments] = useState<MedicalAppointment[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_appointments');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [prescriptions, setPrescriptions] = useState<MedicalPrescription[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_prescriptions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [registeredVehicles, setRegisteredVehicles] = useState<RegisteredVehicle[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_registered_vehicles');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter(v => v.descricao.toUpperCase() !== 'FOX PRATA');
      }
    } catch (e) {}
    return [{ id: '1', descricao: 'FOX ROCK RIO 1.6', motorista: 'ALEXANDRE', placa: 'FVS4I24' }];
  });

  const [compromissos, setCompromissos] = useState<Compromisso[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_compromissos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [performedServices, setPerformedServices] = useState<CarServicePerformed[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_car_services_performed');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter(s => s.veiculoDescricao?.toUpperCase() !== 'FOX PRATA');
      }
    } catch (e) {}
    return [{ id: 'p1', veiculoDescricao: 'FOX ROCK RIO 1.6', descricao: 'Troca de Óleo', data: '2026-04-11', km: 82350, valor: 250, oficina: 'Auto Center Gaeta', updatedAt: Date.now() }];
  });

  const [scheduledServices, setScheduledServices] = useState<CarServiceScheduled[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_car_services_scheduled');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter(s => s.veiculoDescricao?.toUpperCase() !== 'FOX PRATA');
      }
    } catch (e) {}
    return [{ id: 's1', veiculoDescricao: 'FOX ROCK RIO 1.6', descricao: 'Revisão Geral', tipoAgendamento: 'DATA_E_KM', dataAlvo: '2026-08-15', kmAlvo: 90000, recorrente: false, status: 'PENDENTE', updatedAt: Date.now() }];
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

  const [bankAccountsState, setBankAccountsState] = useState<BankAccount[]>(() => bankAccounts);
  const [creditCardsState, setCreditCardsState] = useState<CreditCard[]>(() => creditCards);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [timeStr, setTimeStr] = useState<string>('00:00');
  const [dialog, setDialog] = useState<{ isOpen: boolean; title: string; message: string; isConfirm: boolean; onConfirm?: () => void }>({ isOpen: false, title: '', message: '', isConfirm: false });

  // ESTADO DA INTEGRAÇÃO DO BANCO INTERATIVO
  const [bankIntegrationNotification, setBankIntegrationNotification] = useState<{
    id: string;
    bancoNome: string;
    bancoId: number;
    valor: number;
    descricao: string;
    isLoadingSuggestion?: boolean;
  } | null>(null);

  const handleImportBankIntegration = async (tipo: 'RECEITA' | 'DESPESA' | 'TRANSFERENCIA', destBancoId?: number) => {
    if (!bankIntegrationNotification) return;
    const { bancoNome, bancoId, valor, descricao } = bankIntegrationNotification;
         
    const today = new Date();
    const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    localStorage.setItem('draft_txType', tipo === 'TRANSFERENCIA' ? 'TRANSFERÊNCIA' : tipo);
    localStorage.setItem('draft_category', tipo === 'RECEITA' ? 'TRABALHO' : 'ABASTECIMENTO');
    localStorage.setItem('draft_valor', String(valor));
    localStorage.setItem('draft_descricao', `${descricao} (via ${bancoNome})`);
    localStorage.setItem('draft_data', formattedDate);
    localStorage.setItem('draft_bancoId', String(bancoId));
    if (destBancoId) localStorage.setItem('draft_destBancoId', String(destBancoId));

    setBankIntegrationNotification(null);
    setCurrentTab('transactions');
    setShowAddTxForm(true);
    showAlert("Editar Pix", "Os dados do Pix foram carregados no formulário. Ajuste e salve!");
  };

  useEffect(() => {
    localStorage.setItem('wealthflow_category_budgets', JSON.stringify(categoryBudgets));
    localStorage.setItem('wealthflow_ipva_lead_days', String(ipvaLeadDays));
    localStorage.setItem('wealthflow_ipva_closing_day', String(ipvaClosingDay));
    localStorage.setItem('wealthflow_ipva_notification_color', ipvaNotificationColor);
    localStorage.setItem('wealthflow_daily_checkin_time', dailyCheckInTime);
    localStorage.setItem('wealthflow_medical_appointment_lead_days', String(medicalAppointmentLeadDays));
    localStorage.setItem('wealthflow_default_vehicle_id', defaultVehicleId);
    localStorage.setItem('wealthflow_licensing_reminder_day', String(licensingReminderDay));
    localStorage.setItem('wealthflow_notify_licensing', String(notifyLicensing));
    localStorage.setItem('wealthflow_notify_ipva', String(notifyIpva));
    localStorage.setItem('wealthflow_notify_budget', String(notifyBudget));
    localStorage.setItem('wealthflow_notify_appointments', String(notifyAppointments));
    localStorage.setItem('wealthflow_transactions', JSON.stringify(transactions));
    localStorage.setItem('wealthflow_riskzones', JSON.stringify(riskZones));
    localStorage.setItem('wealthflow_infractions', JSON.stringify(infractions));
    localStorage.setItem('wealthflow_appointments', JSON.stringify(appointments));
    localStorage.setItem('wealthflow_prescriptions', JSON.stringify(prescriptions));
    localStorage.setItem('wealthflow_registered_vehicles', JSON.stringify(registeredVehicles));
    localStorage.setItem('wealthflow_car_services_performed', JSON.stringify(performedServices));
    localStorage.setItem('wealthflow_car_services_scheduled', JSON.stringify(scheduledServices));
  }, [categoryBudgets, ipvaLeadDays, ipvaClosingDay, ipvaNotificationColor, dailyCheckInTime, medicalAppointmentLeadDays, defaultVehicleId, licensingReminderDay, notifyLicensing, notifyIpva, notifyBudget, notifyAppointments, transactions, riskZones, infractions, appointments, prescriptions, registeredVehicles, performedServices, scheduledServices]);

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
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    async function registerPushSystem() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        const keyResponse = await fetch('https://financas-gaeta-app.onrender.com/api/webhooks/push-public-key');
        if (!keyResponse.ok) return;
        const { publicKey } = await keyResponse.json();
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
        await fetch('https://financas-gaeta-app.onrender.com/api/webhooks/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription })
        });
      } catch (err) {}
    }
    if (isDbLoaded) registerPushSystem();
  }, [isDbLoaded]);

  useEffect(() => {
    async function loadData() {
      try {
        setTransactions(cleanDuplicateTransactions(await getTransactionsFromDb()));
        setRiskZones(await getRiskZonesFromDb());
        setInfractions(await getInfractionsFromDb());
        setNonAppealed(await getNonAppealedFromDb());
        setAppointments(await getMedicalAppointmentsFromDb());
        setPrescriptions(await getMedicalPrescriptionsFromDb());
        const vehicleList = await getRegisteredVehiclesFromDb();
        if (vehicleList?.length > 0) setRegisteredVehicles(vehicleList);
        const secConfig = await getSecurityConfigFromDb();
        if (secConfig) { setSecurityConfig(secConfig); setIsAppLocked(!!secConfig.enabled); }
      } catch (e) {
      } finally { setIsDbLoaded(true); }
    }
    loadData();
  }, []);

  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>('');
  const [autoSync, setAutoSync] = useState<boolean>(false);

  const showAlert = (title: string, message: string) => setDialog({ isOpen: true, title, message, isConfirm: false });
  const showConfirm = (title: string, message: string, onConfirm: () => void) => setDialog({ isOpen: true, title, message, isConfirm: true, onConfirm });

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAddTransaction = async (newTx: any) => {
    const txObj = { id: Date.now(), ...newTx, updatedAt: Date.now() };
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
            onAddTransaction={handleAddTransaction} onTriggerNotification={(notif) => setBankIntegrationNotification({ id: Date.now().toString(), bancoNome: notif.banco, bancoId: notif.accountId, valor: notif.valor, descricao: notif.descricao })} onTriggerBankIntegration={(bancoId, valor, descricao) => { const bankObj = bankAccountsState.find(b => b.id === bancoId); setBankIntegrationNotification({ id: Date.now().toString(), bancoNome: bankObj ? bankObj.nome : "BANCO", bancoId, valor, descricao: descricao || "Nova transação Pix" }); }}
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
            googleToken={googleToken} isSyncing={false} isImporting={false} spreadsheetUrl={spreadsheetUrl}
            syncError={null} lastSyncedTime="" autoSync={autoSync} onGoogleLogin={googleSignIn}
            onGoogleLogout={logout} onToggleAutoSync={setAutoSync} onTriggerSync={() => {}}
            onTriggerImport={() => {}} showAlert={showAlert} showConfirm={showConfirm} registeredVehicles={registeredVehicles}
            setRegisteredVehicles={setRegisteredVehicles} bankAccounts={bankAccountsState} onUpdateBankAccounts={setBankAccountsState}
            customCategories={customCategories} onTriggerBankIntegration={(bancoId, valor, descricao) => { const bankObj = bankAccountsState.find(b => b.id === bancoId); setBankIntegrationNotification({ id: Date.now().toString(), bancoNome: bankObj ? bankObj.nome : "BANCO", bancoId, valor, descricao: descricao || "Nova transação Pix" }); }}
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
            googleUser={googleUser} onGoogleLogin={googleSignIn} onGoogleLogout={logout}
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
      default: return null;
    }
  };

  return (
    <div className="h-[100dvh] md:min-h-screen bg-slate-950 flex items-center justify-center p-0 md:p-6 text-slate-100 font-sans overflow-hidden">
      <div className="w-full max-w-md h-[100dvh] md:h-[840px] bg-slate-900 md:rounded-[42px] md:border-8 md:border-slate-800 shadow-2xl flex flex-col overflow-hidden relative">
        
        <AnimatePresence>
          {isAppLocked && securityConfig.enabled && (
            <motion.div key="app-lock-screen-wrapper" initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100]">
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

        {/* ANIMAÇÃO DO BANNER INTERATIVO COM CHAVE DE RENDERIZAÇÃO SECURA */}
        <div className="absolute top-12 left-0 right-0 z-[99999] px-4 pointer-events-none">
          <AnimatePresence mode="popLayout">
            {bankIntegrationNotification && (
              <motion.div 
                key="bank-push-banner-interactive"
                initial={{ opacity: 0, y: -40, scale: 0.9 }} 
                animate={{ opacity: 1, y: 0, scale: 1 }} 
                exit={{ opacity: 0, y: -30, scale: 0.95 }} 
                className="w-full bg-[#2E3033] text-white rounded-[28px] p-5 shadow-2xl flex flex-col gap-3.5 border border-white/5 pointer-events-auto"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-slate-200">{bankIntegrationNotification.bancoNome}</span>
                  <button onClick={() => setBankIntegrationNotification(null)} className="material-symbols-outlined text-base text-slate-400 cursor-pointer">close</button>
                </div>
                <h4 className="text-[15px] font-medium text-slate-100">Nova transação de R$ {bankIntegrationNotification.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
                <p className="text-[11px] text-slate-400 italic font-mono">{bankIntegrationNotification.descricao}</p>
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => handleImportBankIntegration('RECEITA')} className="flex-1 py-2 bg-[#3C3E44] hover:bg-[#4E5158] text-[#E3E3E3] font-bold rounded-full text-xs cursor-pointer transition-colors">Receita</button>
                  <button onClick={() => handleImportBankIntegration('DESPESA')} className="flex-1 py-2 bg-[#3C3E44] hover:bg-[#4E5158] text-[#E3E3E3] font-bold rounded-full text-xs cursor-pointer transition-colors">Despesa</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <main className="flex-grow overflow-y-auto px-4 pt-3 pb-24 relative bg-slate-950">
          <AnimatePresence mode="wait">
            <motion.div key={currentTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="w-full">
              {renderCurrentView()}
            </motion.div>
          </AnimatePresence>
        </main>

        <nav className="absolute bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/80 px-1 pt-1.5 pb-4 grid grid-cols-5 gap-0.5 z-40">
          <button onClick={() => handleTabNavigate('dashboard')} className={`flex flex-col items-center py-1 ${currentTab === 'dashboard' ? 'text-emerald-400' : 'text-slate-400'}`}><span className="material-symbols-outlined text-[20px]">dashboard</span><span className="text-[9px] font-bold">Painel</span></button>
          <button onClick={() => handleTabNavigate('transactions')} className={`flex flex-col items-center py-1 ${currentTab === 'transactions' ? 'text-emerald-400' : 'text-slate-400'}`}><span className="material-symbols-outlined text-[20px]">receipt_long</span><span className="text-[9px] font-bold">Finanças</span></button>
          <button onClick={() => handleTabNavigate('carservices')} className={`flex flex-col items-center py-1 ${currentTab === 'carservices' ? 'text-emerald-400' : 'text-slate-400'}`}><span className="material-symbols-outlined text-[20px]">build_circle</span><span className="text-[9px] font-bold">Oficina</span></button>
          <button onClick={() => handleTabNavigate('profile')} className={`flex flex-col items-center py-1 ${currentTab === 'profile' ? 'text-emerald-400' : 'text-slate-400'}`}><span className="material-symbols-outlined text-[20px]">person</span><span className="text-[9px] font-bold">Perfil</span></button>
          <button onClick={() => setIsMaisMenuOpen(true)} className="flex flex-col items-center py-1 text-slate-400"><span className="material-symbols-outlined text-[20px]">more_horiz</span><span className="text-[9px] font-bold">Mais</span></button>
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
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[999999]">
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
