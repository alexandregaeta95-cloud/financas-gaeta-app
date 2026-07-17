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

// Helper to deduplicate transactions securely (checks IDs)
function cleanDuplicateTransactions(txs: Transaction[]): Transaction[] {
  const seenIds = new Set<number>();
  const uniqueTxs: Transaction[] = [];

  txs.forEach(t => {
    if (!t) return;
    
    let idNum = Number(t.id);
    if (isNaN(idNum) || idNum <= 0) {
      // Assign a temporary safe unique ID so it is not deduplicated against other blank ones
      idNum = Math.floor(Math.random() * 1000000000) + 1000000000;
      t.id = idNum;
    }

    if (seenIds.has(idNum)) {
      return; // Skip duplicate ID
    }
    seenIds.add(idNum);
    uniqueTxs.push(t);
  });

  return uniqueTxs;
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [showAddTxForm, setShowAddTxForm] = useState<boolean>(false);
  const [isMaisMenuOpen, setIsMaisMenuOpen] = useState<boolean>(false);
  const [isDbLoaded, setIsDbLoaded] = useState<boolean>(false);

  // Synchronization locking references to prevent race conditions and loops
  const syncLockRef = React.useRef<boolean>(false);
  const lastSyncedTxRef = React.useRef<string>('');
  const syncPendingRef = React.useRef<boolean>(false);
  const lastWebhookTimeRef = React.useRef<number>(Date.now());
  const pendingSyncParamsRef = React.useRef<{
    tokenToUse?: string;
    isBackground?: boolean;
    overrideTxs?: Transaction[];
    overrideInfracs?: Infraction[];
    overrideZones?: RiskZone[];
    overrideAppts?: MedicalAppointment[];
    overridePrescs?: MedicalPrescription[];
  } | null>(null);

  // Live state synchronized lists (backed by Local Storage as an immediate fallback)
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_transactions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return cleanDuplicateTransactions(parsed);
        }
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
          const filtered = parsed.filter(v => v.descricao.toUpperCase() !== 'FOX PRATA');
          if (filtered.length !== parsed.length) {
            localStorage.setItem('wealthflow_registered_vehicles', JSON.stringify(filtered));
          }
          return filtered;
        }
      }
    } catch (e) {
      console.error("Failed to parse registered vehicles state:", e);
    }
    return [
      { id: '1', descricao: 'FOX ROCK RIO 1.6', motorista: 'ALEXANDRE', placa: 'FVS4I24' }
    ];
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
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(s => s.veiculoDescricao?.toUpperCase() !== 'FOX PRATA');
          if (filtered.length !== parsed.length) {
            localStorage.setItem('wealthflow_car_services_performed', JSON.stringify(filtered));
          }
          return filtered;
        }
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
        observacoes: 'Óleo Shell Helix 10w40 semissintético e filtro de óleo Bosch.',
        updatedAt: Date.now()
      },
      {
        id: 'p2',
        veiculoDescricao: 'FOX ROCK RIO 1.6',
        descricao: 'Alinhamento e Balanceamento',
        data: '2026-05-05',
        km: 83100,
        valor: 120,
        oficina: 'Pneus Express',
        observacoes: 'Feito rodízio de pneus traseiros para dianteiros.',
        updatedAt: Date.now()
      }
    ];
  });

  const [scheduledServices, setScheduledServices] = useState<CarServiceScheduled[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_car_services_scheduled');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(s => s.veiculoDescricao?.toUpperCase() !== 'FOX PRATA');
          if (filtered.length !== parsed.length) {
            localStorage.setItem('wealthflow_car_services_scheduled', JSON.stringify(filtered));
          }
          return filtered;
        }
      }
    } catch (e) {
      console.error("Failed to parse scheduled services state:", e);
    }
    return [
      {
        id: 's1',
        veiculoDescricao: 'FOX ROCK RIO 1.6',
        descricao: 'Revisão Geral e Troca de Pastilhas',
        tipoAgendamento: 'DATA_E_KM',
        dataAlvo: '2026-08-15',
        kmAlvo: 90000,
        recorrente: false,
        status: 'PENDENTE',
        updatedAt: Date.now()
      },
      {
        id: 's2',
        veiculoDescricao: 'FOX ROCK RIO 1.6',
        descricao: 'Troca de Óleo e Filtro',
        tipoAgendamento: 'DATA_E_KM',
        dataAlvo: '2026-10-11',
        kmAlvo: 92350,
        recorrente: true,
        frequenciaMeses: 6,
        frequenciaKm: 10000,
        status: 'PENDENTE',
        updatedAt: Date.now()
      }
    ];
  });

  // Stateful Profile Avatar URL
  const [avatarUrl, setAvatarUrl] = useState<string>(() => {
    const saved = localStorage.getItem('wealthflow_avatarurl');
    return saved || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDclcawui2tKuHgw4p_DWvKBp0R7XYoJIo41kp-qWXzNhTbDso-7IAoirqhYyc-HEWXFiHIGP6YdyvyG4u4xgKT0ecq0uBLAJEXGIxgaymfedUvUw5PmlAfsh600Je_GbTdL8UgPj2BZ18ovSoiV_-08bm1CxxuR-RaAO569na_pVi2ObUv5FfHdqk1JhAf68RSSZF5WqsPDCCmYfWunTzLuQcRHOJn29EvtKwGGBucDh8ZAdyadLyd';
  });

  // Stateful Custom transaction categories
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_custom_categories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Stateful custom category budgets (annual spending targets)
  const [categoryBudgets, setCategoryBudgets] = useState<{ [category: string]: number }>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_category_budgets');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_category_budgets', JSON.stringify(categoryBudgets));
    } catch (e) {
      console.warn("Failed to save category budgets to localStorage:", e);
    }
  }, [categoryBudgets]);

  // Customizable IPVA alert advance warning (in days)
  const [ipvaLeadDays, setIpvaLeadDays] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_ipva_lead_days');
      return saved ? parseInt(saved, 10) : 30;
    } catch {
      return 30;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_ipva_lead_days', String(ipvaLeadDays));
    } catch (e) {
      console.warn("Failed to save ipva lead days to localStorage:", e);
    }
  }, [ipvaLeadDays]);

  // Cleanup FOX PRATA from localStorage
  useEffect(() => {
    try {
      const mileageStr = localStorage.getItem('wealthflow_vehicle_mileage');
      if (mileageStr) {
        const mileage = JSON.parse(mileageStr);
        if (mileage && mileage['FOX PRATA'] !== undefined) {
          delete mileage['FOX PRATA'];
          localStorage.setItem('wealthflow_vehicle_mileage', JSON.stringify(mileage));
        }
      }
    } catch (e) {
      console.warn("Cleanup of FOX PRATA mileage failed:", e);
    }
  }, []);

  // Customizable IPVA fleet closing day (of month)
  const [ipvaClosingDay, setIpvaClosingDay] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_ipva_closing_day');
      return saved ? parseInt(saved, 10) : 15;
    } catch {
      return 15;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_ipva_closing_day', String(ipvaClosingDay));
    } catch (e) {
      console.warn("Failed to save ipva closing day to localStorage:", e);
    }
  }, [ipvaClosingDay]);

  // Customizable IPVA notification color preference (red, orange, yellow)
  const [ipvaNotificationColor, setIpvaNotificationColor] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_ipva_notification_color');
      return saved || 'orange';
    } catch {
      return 'orange';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_ipva_notification_color', ipvaNotificationColor);
    } catch (e) {
      console.warn("Failed to save ipva notification color to localStorage:", e);
    }
  }, [ipvaNotificationColor]);

  // Daily check-in notification state
  const [dailyCheckInTime, setDailyCheckInTime] = useState<string>(() => {
    try {
      return localStorage.getItem('wealthflow_daily_checkin_time') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_daily_checkin_time', dailyCheckInTime);
    } catch (e) {
      console.warn("Failed to save checkin time to localStorage:", e);
    }
  }, [dailyCheckInTime]);

  // Customizable medical appointments lead days (notification period)
  const [medicalAppointmentLeadDays, setMedicalAppointmentLeadDays] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_medical_appointment_lead_days');
      return saved ? parseInt(saved, 10) : 2;
    } catch {
      return 2;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_medical_appointment_lead_days', String(medicalAppointmentLeadDays));
    } catch (e) {
      console.warn("Failed to save medical appointment lead days to localStorage:", e);
    }
  }, [medicalAppointmentLeadDays]);

  // User alert permissions states (IPVA, Orçamento, Compromissos)
  const [notifyIpva, setNotifyIpva] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_notify_ipva');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  // Default vehicle for Dashboard
  const [defaultVehicleId, setDefaultVehicleId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_default_vehicle_id');
      return saved || '';
    } catch {
      return '';
    }
  });

  // Licensing reminder monthly settings
  const [licensingReminderDay, setLicensingReminderDay] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_licensing_reminder_day');
      return saved ? parseInt(saved, 10) : 10;
    } catch {
      return 10;
    }
  });

  const [notifyLicensing, setNotifyLicensing] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_notify_licensing');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  // Sync default vehicle settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_default_vehicle_id', defaultVehicleId);
    } catch (e) {
      console.warn("Failed to save defaultVehicleId:", e);
    }
  }, [defaultVehicleId]);

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_licensing_reminder_day', String(licensingReminderDay));
    } catch (e) {
      console.warn("Failed to save licensingReminderDay:", e);
    }
  }, [licensingReminderDay]);

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_notify_licensing', String(notifyLicensing));
    } catch (e) {
      console.warn("Failed to save notifyLicensing:", e);
    }
  }, [notifyLicensing]);

  const [notifyBudget, setNotifyBudget] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_notify_budget');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const [notifyAppointments, setNotifyAppointments] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_notify_appointments');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_notify_ipva', String(notifyIpva));
    } catch (e) {
      console.warn("Failed to save notifyIpva to localStorage:", e);
    }
  }, [notifyIpva]);

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_notify_budget', String(notifyBudget));
    } catch (e) {
      console.warn("Failed to save notifyBudget to localStorage:", e);
    }
  }, [notifyBudget]);

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_notify_appointments', String(notifyAppointments));
    } catch (e) {
      console.warn("Failed to save notifyAppointments to localStorage:", e);
    }
  }, [notifyAppointments]);

  // Check check-in time every 30 seconds
  useEffect(() => {
    const checkDailyCheckIn = () => {
      if (!dailyCheckInTime) return;
      const now = new Date();
      const currentHM = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      if (currentHM === dailyCheckInTime) {
        const todayStr = now.toDateString(); // e.g. "Wed Jul 15 2026"
        const lastNotified = localStorage.getItem('wealthflow_last_checkin_notified_date');
        
        if (lastNotified !== todayStr) {
          localStorage.setItem('wealthflow_last_checkin_notified_date', todayStr);
          
          // Try to request/trigger system notification
          if ("Notification" in window && Notification.permission === "granted") {
            try {
              const notification = new Notification("WealthFlow • Check-in Diário", {
                body: "Hora do check-in diário! Deseja registrar os gastos de hoje?",
                icon: "/favicon.ico",
                tag: "daily-checkin"
              });
              notification.onclick = () => {
                window.focus();
                setCurrentTab('transactions');
                setShowAddTxForm(true);
              };
            } catch (err) {
              console.warn("Failed to dispatch system notification, falling back:", err);
            }
          }
          
          // Trigger double-layered user attention:
          // 1. Play dual-chime audio tone
          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
            gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.35);
          } catch (e) {}

          // 2. In-App Interactive Confirmation Dialog
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

  // Monthly Licensing Reminder logic
  useEffect(() => {
    if (!notifyLicensing) return;
    
    const checkLicensingReminder = () => {
      const now = new Date();
      const currentDay = now.getDate();
      
      if (currentDay === licensingReminderDay) {
        const currentMonthYearStr = `${now.getMonth()}_${now.getFullYear()}`;
        const lastNotified = localStorage.getItem('wealthflow_last_licensing_notified_month');
        
        if (lastNotified !== currentMonthYearStr) {
          localStorage.setItem('wealthflow_last_licensing_notified_month', currentMonthYearStr);
          
          const msgTitle = "🚗 Lembrete de Licenciamento Anual";
          const msgBody = `Hoje é dia ${licensingReminderDay}! Lembre-se de verificar o status de licenciamento anual da sua frota de veículos.`;

          if ("Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(msgTitle, {
                body: msgBody,
                icon: "/favicon.ico",
                tag: "licensing-reminder"
              });
            } catch (err) {
              console.warn("Failed to dispatch licensing notification:", err);
            }
          }

          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.4);
          } catch {}

          showConfirm(
            msgTitle,
            `${msgBody} Deseja ir para a aba de Perfil para gerenciar as configurações dos veículos agora?`,
            () => {
              setCurrentTab('profile');
            }
          );
        }
      }
    };

    checkLicensingReminder();
    const interval = setInterval(checkLicensingReminder, 10 * 60 * 1000); // Check every 10 mins
    return () => clearInterval(interval);
  }, [notifyLicensing, licensingReminderDay]);

  // Stateful Security Lock Config
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_security_config');
      return saved ? JSON.parse(saved) : {
        enabled: false,
        mode: 'PIN',
        password: 'admin',
        pin: '1234',
        biometricType: 'FACE_ID'
      };
    } catch {
      return {
        enabled: false,
        mode: 'PIN',
        password: 'admin',
        pin: '1234',
        biometricType: 'FACE_ID'
      };
    }
  });

  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_security_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return !!parsed.enabled;
      }
    } catch {}
    return false;
  });

  // Load live data from Firestore on mount
  useEffect(() => {
    async function loadData() {
      try {
        const txList = await getTransactionsFromDb();
        const cleanList = cleanDuplicateTransactions(txList);
        setTransactions(cleanList);
        
        // Save cleaned list to localStorage and clean Firestore if needed
        if (cleanList.length < txList.length) {
          const cleanIds = new Set(cleanList.map(t => t.id));
          const duplicateTxs = txList.filter(t => !cleanIds.has(t.id));
          for (const dup of duplicateTxs) {
            await deleteTransactionFromDb(dup.id);
          }
          localStorage.setItem('wealthflow_transactions', JSON.stringify(cleanList));
        }
        
        const zoneList = await getRiskZonesFromDb();
        setRiskZones(zoneList);

        const dbSyncTimestamp = await getSyncTimestampFromDb();
        if (dbSyncTimestamp > 0) {
          localStorage.setItem('wealthflow_last_synced_timestamp', String(dbSyncTimestamp));
        }

        const infList = await getInfractionsFromDb();
        setInfractions(infList);

        const nonAppList = await getNonAppealedFromDb();
        setNonAppealed(nonAppList);

        const apptList = await getMedicalAppointmentsFromDb();
        setAppointments(apptList);

        const prescriptionList = await getMedicalPrescriptionsFromDb();
        setPrescriptions(prescriptionList);

        const vehicleList = await getRegisteredVehiclesFromDb();
        if (vehicleList && vehicleList.length > 0) {
          setRegisteredVehicles(vehicleList);
        }

        const compList = await getCompromissosFromDb();
        setCompromissos(compList);
        localStorage.setItem('wealthflow_compromissos', JSON.stringify(compList));

        const dbPerfList = await getPerformedServicesFromDb();
        if (dbPerfList && dbPerfList.length > 0) {
          setPerformedServices(dbPerfList);
          localStorage.setItem('wealthflow_car_services_performed', JSON.stringify(dbPerfList));
        }

        const dbSchedList = await getScheduledServicesFromDb();
        if (dbSchedList && dbSchedList.length > 0) {
          setScheduledServices(dbSchedList);
          localStorage.setItem('wealthflow_car_services_scheduled', JSON.stringify(dbSchedList));
        }

        const avatar = await getAvatarUrlFromDb();
        setAvatarUrl(avatar);

        const customCats = await getCustomCategoriesFromDb();
        if (customCats && customCats.length > 0) {
          setCustomCategories(customCats);
          localStorage.setItem('wealthflow_custom_categories', JSON.stringify(customCats));
        }

        const secConfig = await getSecurityConfigFromDb();
        if (secConfig) {
          setSecurityConfig(secConfig);
          localStorage.setItem('wealthflow_security_config', JSON.stringify(secConfig));
          setIsAppLocked(!!secConfig.enabled);
        }

        // Initialize lastSyncedTxRef with the clean lists on mount to avoid triggering sync immediately
        lastSyncedTxRef.current = `${JSON.stringify(cleanList)}_${JSON.stringify(infList)}_${JSON.stringify(zoneList)}_${JSON.stringify(apptList)}_${JSON.stringify(prescriptionList)}_${JSON.stringify(compList)}_${JSON.stringify(vehicleList)}_${JSON.stringify(dbPerfList)}_${JSON.stringify(dbSchedList)}`;
      } catch (e) {
        console.error("Error loading data from Firestore, using offline cache:", e);
      } finally {
        setIsDbLoaded(true);
      }
    }
    loadData();
  }, []);

  // Sync customCategories to localStorage & Firestore when it changes
  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_custom_categories', JSON.stringify(customCategories));
      saveCustomCategoriesToDb(customCategories);
    } catch (e) {
      console.warn("Failed to save custom categories:", e);
    }
  }, [customCategories]);

  // Sync securityConfig to localStorage & Firestore when it changes
  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_security_config', JSON.stringify(securityConfig));
      saveSecurityConfigToDb(securityConfig);
    } catch (e) {
      console.warn("Failed to save security configuration:", e);
    }
  }, [securityConfig]);

  // Save to Local Storage when states change as active offline cache
  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_transactions', JSON.stringify(transactions));
    } catch (e) {
      console.warn("Failed to save transactions to localStorage:", e);
    }
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_riskzones', JSON.stringify(riskZones));
    } catch (e) {
      console.warn("Failed to save riskzones to localStorage:", e);
    }
  }, [riskZones]);

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_infractions', JSON.stringify(infractions));
    } catch (e) {
      console.warn("Failed to save infractions to localStorage:", e);
    }
  }, [infractions]);

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_nonappealed', JSON.stringify(nonAppealed));
    } catch (e) {
      console.warn("Failed to save nonappealed infractions to localStorage:", e);
    }
  }, [nonAppealed]);

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_appointments', JSON.stringify(appointments));
    } catch (e) {
      console.warn("Failed to save appointments to localStorage:", e);
    }
  }, [appointments]);

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_prescriptions', JSON.stringify(prescriptions));
    } catch (e) {
      console.warn("Failed to save prescriptions to localStorage:", e);
    }
  }, [prescriptions]);

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_avatarurl', avatarUrl);
    } catch (e) {
      console.warn("Failed to save avatarurl to localStorage:", e);
    }
  }, [avatarUrl]);

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_registered_vehicles', JSON.stringify(registeredVehicles));
    } catch (e) {
      console.warn("Failed to save registered vehicles to localStorage:", e);
    }
  }, [registeredVehicles]);

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_compromissos', JSON.stringify(compromissos));
    } catch (e) {
      console.warn("Failed to save compromissos to localStorage:", e);
    }
  }, [compromissos]);

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_car_services_performed', JSON.stringify(performedServices));
    } catch (e) {
      console.warn("Failed to save performed services to localStorage:", e);
    }
  }, [performedServices]);

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_car_services_scheduled', JSON.stringify(scheduledServices));
    } catch (e) {
      console.warn("Failed to save scheduled services to localStorage:", e);
    }
  }, [scheduledServices]);

  // Google Sheets state lifted from TransactionsTab to App level for global background syncing
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>(() => {
    return localStorage.getItem('wealthflow_spreadsheet_url') || '';
  });
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>(() => {
    return localStorage.getItem('wealthflow_last_synced_time') || '';
  });
  const [autoSync, setAutoSync] = useState<boolean>(() => {
    return localStorage.getItem('wealthflow_auto_sync') === 'true';
  });

  // Bank accounts & credit cards state for interactive transaction simulation
  const [bankAccountsState, setBankAccountsState] = useState<BankAccount[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_bank_accounts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Failed to parse bank accounts state:", e);
    }
    return bankAccounts;
  });

  const [creditCardsState, setCreditCardsState] = useState<CreditCard[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_credit_cards');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Failed to parse credit cards state:", e);
    }
    return creditCards;
  });

  // Persist bank accounts and credit cards to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_bank_accounts', JSON.stringify(bankAccountsState));
    } catch (e) {
      console.warn("Failed to save bank accounts to localStorage:", e);
    }
  }, [bankAccountsState]);

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_credit_cards', JSON.stringify(creditCardsState));
    } catch (e) {
      console.warn("Failed to save credit cards to localStorage:", e);
    }
  }, [creditCardsState]);

  const hasExpiringTransactions = React.useMemo(() => {
    return transactions.some(t => {
      if (t.tipo === 'CONTAS BANCARIAS' || t.tipo === 'CARTÃO DE CRÉDITO') return false;
      const statusUpper = String(t.status || '').trim().toUpperCase();
      if (statusUpper === 'PAGO' || statusUpper === 'RECEBIDO') return false;
      
      let day = 0, month = 0, year = 0;
      if (t.data.includes('/')) {
        const parts = t.data.split('/');
        if (parts.length === 3) {
          day = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10) - 1;
          year = parseInt(parts[2], 10);
        } else return false;
      } else if (t.data.includes('-')) {
        const parts = t.data.split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            day = parseInt(parts[2], 10);
          } else {
            day = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            year = parseInt(parts[2], 10);
          }
        } else return false;
      } else {
        return false;
      }
      
      const txDate = new Date(year, month, day);
      txDate.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      return txDate.getTime() === today.getTime() || txDate.getTime() === tomorrow.getTime();
    });
  }, [transactions]);

  const hasActiveAppointments = React.useMemo(() => {
    return appointments.some(appt => {
      if (appt.status !== 'Agendada') return false;
      const { active } = isNotificationPeriod(appt.data, medicalAppointmentLeadDays);
      return active;
    });
  }, [appointments, medicalAppointmentLeadDays]);

  const hasActiveCompromissos = React.useMemo(() => {
    return compromissos.some(c => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let year = 0, month = 0, day = 0;
      const cleanStr = (c.data || '').trim();
      if (cleanStr.includes('-')) {
        const parts = cleanStr.split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            day = parseInt(parts[2], 10);
          } else {
            day = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            year = parseInt(parts[2], 10);
          }
        }
      } else if (cleanStr.includes('/')) {
        const parts = cleanStr.split('/');
        if (parts.length === 3) {
          if (parts[2].length === 4) {
            day = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            year = parseInt(parts[2], 10);
          } else if (parts[0].length === 4) {
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            day = parseInt(parts[2], 10);
          }
        }
      }

      if (!year || isNaN(year) || isNaN(month) || isNaN(day)) {
        const d = new Date(cleanStr);
        if (!isNaN(d.getTime())) {
          year = d.getFullYear();
          month = d.getMonth();
          day = d.getDate();
        } else {
          return false;
        }
      }

      const compDate = new Date(year, month, day);
      compDate.setHours(0, 0, 0, 0);
      const diff = Math.ceil((compDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= (c.diasAntecedencia ?? 2);
    });
  }, [compromissos]);

  const hasOverdueServices = React.useMemo(() => {
    return scheduledServices.some(s => {
      if (s.status === 'REALIZADO' || !s.dataAlvo) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [y, m, d] = s.dataAlvo.split('-').map(Number);
      const targetDate = new Date(y, m - 1, d);
      targetDate.setHours(0, 0, 0, 0);
      return targetDate.getTime() < today.getTime();
    });
  }, [scheduledServices]);

  const hasUrgentIpva = React.useMemo(() => {
    const alerts = checkIpvaAlerts(registeredVehicles, new Date(), transactions, ipvaLeadDays);
    return alerts.some(alert => alert.daysRemaining < 10);
  }, [registeredVehicles, transactions, ipvaLeadDays, ipvaClosingDay]);

  // Notifications state
  interface SimulatedNotification {
    id: string;
    banco: string;
    tipo: 'RECEITA' | 'DESPESA' | 'PAGO' | 'ETANOL' | 'GAS. COMUM' | string;
    valor: number;
    descricao: string;
    categoria: string;
    accountId: number;
    isCreditCard: boolean;
    cardId?: number;
  }

  const [activeNotification, setActiveNotification] = useState<SimulatedNotification | null>(null);
  const [bankIntegrationNotification, setBankIntegrationNotification] = useState<{
    id: string;
    bancoNome: string;
    bancoId: number;
    valor: number;
    descricao: string;
    suggestedCategory?: string;
    suggestedJustification?: string;
    isLoadingSuggestion?: boolean;
  } | null>(null);
  const [isSelectingTransferDest, setIsSelectingTransferDest] = useState<boolean>(false);
  const [selectedTransferDestId, setSelectedTransferDestId] = useState<number | null>(null);

  // Sync Queue (Fila de Mudanças Pendentes) states and helpers
  interface PendingChange {
    id: string;
    type: string;
    title: string;
    timestamp: number;
    status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
    error?: string;
  }

  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_pending_changes');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSyncQueueModal, setShowSyncQueueModal] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('wealthflow_pending_changes', JSON.stringify(pendingChanges));
    } catch (e) {}
  }, [pendingChanges]);

  // Run an operation and track its sync status in the queue
  const runTrackedSync = async <T,>(
    type: string,
    title: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    const changeId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 5);
    const newChange: PendingChange = {
      id: changeId,
      type,
      title,
      timestamp: Date.now(),
      status: 'PENDING'
    };
    
    setPendingChanges(prev => [newChange, ...prev].slice(0, 50));

    // If offline, mark as pending with connection error and execute local fallback
    if (!navigator.onLine) {
      setPendingChanges(prev => prev.map(c => c.id === changeId ? { ...c, status: 'PENDING', error: 'Modo offline - Salvo localmente' } : c));
      try {
        const res = await operation();
        return res;
      } catch (err: any) {
        return null as any;
      }
    }

    // If online, transition to SYNCING
    setPendingChanges(prev => prev.map(c => c.id === changeId ? { ...c, status: 'SYNCING' } : c));

    try {
      const result = await operation();
      setPendingChanges(prev => prev.map(c => c.id === changeId ? { ...c, status: 'SYNCED' } : c));
      return result;
    } catch (err: any) {
      const errMsg = err.message || String(err);
      setPendingChanges(prev => prev.map(c => c.id === changeId ? { ...c, status: 'FAILED', error: errMsg } : c));
      throw err;
    }
  };

  const handleRetryAllSync = async () => {
    const changesToRetry = pendingChanges.filter(c => c.status === 'FAILED' || c.status === 'PENDING');
    if (changesToRetry.length === 0) {
      showAlert("Fila Vazia", "Não há alterações pendentes ou com falha para sincronizar.");
      return;
    }

    setPendingChanges(prev => prev.map(c => c.status === 'FAILED' || c.status === 'PENDING' ? { ...c, status: 'SYNCING' } : c));

    try {
      const promises: Promise<any>[] = [];

      if (googleToken) {
        promises.push(triggerSync(googleToken, false, transactions, infractions, riskZones, appointments, prescriptions, true));
      }

      // Re-save critical collections to ensure Firestore is up to date
      transactions.forEach(t => promises.push(saveTransactionToDb(t)));
      compromissos.forEach(c => promises.push(saveCompromissoToDb(c)));
      riskZones.forEach(z => promises.push(saveRiskZoneToDb(z)));

      await Promise.all(promises);

      setPendingChanges(prev => prev.map(c => c.status === 'SYNCING' ? { ...c, status: 'SYNCED', error: undefined } : c));
      showAlert("Sincronização Concluída", "Todas as alterações pendentes foram sincronizadas com sucesso com o banco de dados!");
    } catch (err: any) {
      console.error("Retrying sync failed:", err);
      setPendingChanges(prev => prev.map(c => c.status === 'SYNCING' ? { ...c, status: 'FAILED', error: err.message || 'Falha ao re-tentar' } : c));
      showAlert("Erro na Sincronização", "Ocorreu um erro ao sincronizar. Certifique-se de que está online.");
    }
  };

  const handleClearSyncHistory = () => {
    setPendingChanges(prev => prev.filter(c => c.status !== 'SYNCED'));
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto retry on internet restoration
      handleRetryAllSync();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingChanges]);

  const triggerSimulationNotification = (notif: Omit<SimulatedNotification, 'id'>) => {
    const id = Date.now().toString();
    const fullNotif = { id, ...notif };
    setActiveNotification(fullNotif);

    // Play push notification sound
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      osc.frequency.setValueAtTime(987.77, audioCtx.currentTime + 0.08); // B5
      osc.frequency.setValueAtTime(1318.51, audioCtx.currentTime + 0.16); // E6
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {}
  };

  const triggerBankIntegration = (bancoId: number, valor: number, descricao: string) => {
    const bankObj = bankAccountsState.find(b => b.id === bancoId);
    const bancoNome = bankObj ? bankObj.nome : "BANCO DE TESTE";
    
    setBankIntegrationNotification({
      id: Date.now().toString(),
      bancoNome,
      bancoId,
      valor,
      descricao: descricao || "Nova transação Pix recebida"
    });

    // Play banking notification ring
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.08); // E5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.16); // A5
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {}
  };

  const fetchAiCategorySuggestion = async (webhookId: string, desc: string, val: number, bNome: string) => {
    // Take recent transactions for reference
    const recentTxs = transactions.slice(0, 50).map(t => ({
      descricao: t.descricao,
      categoria: t.categoria,
      tipo: t.tipo,
      valor: t.valor
    }));

    try {
      const response = await fetch("/api/ai/suggest-category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descricao: desc,
          valor: val,
          bancoNome: bNome,
          historico: recentTxs
        })
      });

      if (!response.ok) throw new Error("HTTP error " + response.status);
      const data = await response.json();
      
      setBankIntegrationNotification(prev => {
        if (prev && prev.id === webhookId) {
          return {
            ...prev,
            suggestedCategory: data.categoria || 'OUTROS',
            suggestedJustification: data.justificativa,
            isLoadingSuggestion: false
          };
        }
        return prev;
      });
    } catch (err) {
      console.error("Failed to fetch AI category suggestion:", err);
      setBankIntegrationNotification(prev => {
        if (prev && prev.id === webhookId) {
          return {
            ...prev,
            suggestedCategory: 'OUTROS',
            suggestedJustification: 'Não foi possível obter sugestão da IA.',
            isLoadingSuggestion: false
          };
        }
        return prev;
      });
    }
  };

  const handleImportBankIntegration = async (tipo: 'RECEITA' | 'DESPESA' | 'TRANSFERENCIA', destBancoId?: number) => {
    if (!bankIntegrationNotification) return;
    const { bancoNome, bancoId, valor, descricao, suggestedCategory } = bankIntegrationNotification;
         
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const formattedDate = `${year}-${month}-${day}`; // Formato ISO para o input de data
    
    let txTipo = 'DESPESA';
    if (tipo === 'RECEITA') txTipo = 'RECEITA';
    if (tipo === 'TRANSFERENCIA') txTipo = 'TRANSFERÊNCIA';

    // Salva os dados do Pix no rascunho temporário do rascunho do formulário
    localStorage.setItem('draft_txType', txTipo);
    localStorage.setItem('draft_category', suggestedCategory && suggestedCategory !== "OUTROS" ? suggestedCategory : (tipo === 'RECEITA' ? 'TRABALHO' : 'ABASTECIMENTO'));
    localStorage.setItem('draft_valor', String(valor));
    localStorage.setItem('draft_descricao', `${descricao} (via ${bancoNome})`);
    localStorage.setItem('draft_data', formattedDate);
    localStorage.setItem('draft_bancoId', String(bancoId));
    if (destBancoId) localStorage.setItem('draft_destBancoId', String(destBancoId));

    // Fecha o banner flutuante da notificação
    setBankIntegrationNotification(null);
    setIsSelectingTransferDest(false);
    setSelectedTransferDestId(null);

    // Redireciona para a aba de Finanças e abre o formulário de edição/adição com os campos liberados!
    setCurrentTab('transactions');
    setShowAddTxForm(true);

    showAlert("Editar Pix", "Os dados do Pix foram carregados no formulário. Ajuste a categoria ou descrição e clique em Salvar!");
  };

  const handleRecordSimulatedTransaction = async (notification: SimulatedNotification) => {
    // 1. Format date as "DD/MM/YYYY"
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const formattedDate = `${day}/${month}/${year}`;

    // 2. Add to transactions list
    const id = transactions.length ? Math.max(...transactions.map(t => t.id)) + 1 : 1;
    const txObj: Transaction = {
      id,
      data: formattedDate,
      valor: notification.valor,
      tipo: notification.tipo,
      descricao: notification.descricao,
      categoria: notification.categoria,
      status: "PAGO", // Automatically marked as PAGO
      updatedAt: Date.now()
    };

    setTransactions(prev => [txObj, ...prev]);
    await saveTransactionToDb(txObj);

    // 3. Update balances
    if (notification.isCreditCard) {
      setCreditCardsState(prev => prev.map(card => {
        if (card.id === notification.cardId) {
          return {
            ...card,
            gasto: card.gasto + notification.valor
          };
        }
        return card;
      }));
    } else {
      setBankAccountsState(prev => prev.map(acc => {
        if (acc.id === notification.accountId) {
          const isIncome = notification.tipo === 'RECEITA';
          return {
            ...acc,
            saldoInicial: isIncome ? acc.saldoInicial + notification.valor : acc.saldoInicial - notification.valor
          };
        }
        return acc;
      }));
    }

    // 4. Clear notification
    setActiveNotification(null);

    // 5. Alert user with sound and message
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      osc.frequency.setValueAtTime(1174.66, audioCtx.currentTime + 0.2); // D6
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {}

    showAlert("Sucesso", `Transação de "${notification.descricao}" gravada com sucesso nas suas finanças e o saldo foi atualizado!`);
  };

  // Custom dialog/confirmation state (avoids blocking alert/confirm iframe errors)
  const [modalInputVal, setModalInputVal] = useState<string>('');
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isConfirm: boolean;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    requireInputText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    isConfirm: false,
  });

  const showAlert = (title: string, message: string) => {
    setDialog({
      isOpen: true,
      title,
      message,
      isConfirm: false,
    });
  };

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    requireInputText?: string
  ) => {
    setModalInputVal('');
    setDialog({
      isOpen: true,
      title,
      message,
      isConfirm: true,
      onConfirm,
      requireInputText,
    });
  };

  // Listen to Google authentication lifecycle
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Auto-sync other collections to Google Sheets whenever they change
  useEffect(() => {
    if (googleToken && isDbLoaded && autoSync) {
      triggerSync(googleToken, true);
    }
  }, [
    compromissos,
    registeredVehicles,
    performedServices,
    scheduledServices,
    bankAccountsState,
    creditCardsState,
    googleToken,
    isDbLoaded,
    autoSync
  ]);

  // Automated Periodic Backups to Google Drive
  useEffect(() => {
    if (!googleToken) return;

    const checkAndRunAutomatedBackup = async () => {
      try {
        const scheduleEnabled = localStorage.getItem('wealthflow_backup_schedule_enabled') === 'true';
        if (!scheduleEnabled) return;

        const freq = localStorage.getItem('wealthflow_backup_frequency') || 'semanal';
        let intervalMs = 7 * 24 * 60 * 60 * 1000; // default 7 days
        if (freq === 'diario') {
          intervalMs = 1 * 24 * 60 * 60 * 1000;
        } else if (freq === 'mensal') {
          intervalMs = 30 * 24 * 60 * 60 * 1000;
        }

        const lastBackupStr = localStorage.getItem('wealthflow_last_backup_time');
        const now = Date.now();

        if (lastBackupStr) {
          const lastBackupTime = new Date(lastBackupStr).getTime();
          if (now - lastBackupTime < intervalMs) {
            // Not time yet
            return;
          }
        }

        console.log(`Iniciando backup automático (${freq}) para o Google Drive...`);
        
        // Obter todos os dados do aplicativo
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
          'wealthflow_savings_goals',
          'wealthflow_custom_ipva_dates'
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
        
        localStorage.setItem('wealthflow_last_backup_time', new Date().toISOString());
        localStorage.setItem('wealthflow_last_backup_filename', fileName);
        console.log(`Backup automático (${freq}) '${fileName}' enviado com sucesso para o Google Drive.`);
      } catch (err) {
        console.error("Erro no backup automático:", err);
      }
    };

    // Run on startup (after token loaded)
    const timer = setTimeout(() => {
      checkAndRunAutomatedBackup();
    }, 10000); // Wait 10 seconds after load to not block UI startup

    return () => clearTimeout(timer);
  }, [googleToken]);

  // Browser Notification system for compromissos and due dates
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const checkAndNotifyCompromissos = () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const notified = JSON.parse(localStorage.getItem('wealthflow_notified_compromissos') || '{}');
      let updatedNotified = { ...notified };
      let hasNewNotifications = false;

      compromissos.forEach(c => {
        if (!c.lembreteAtivo) return;

        // Calculate days difference
        let year = 0, month = 0, day = 0;
        const cleanStr = (c.data || '').trim();
        if (cleanStr.includes('-')) {
          const parts = cleanStr.split('-');
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              year = parseInt(parts[0], 10);
              month = parseInt(parts[1], 10) - 1;
              day = parseInt(parts[2], 10);
            } else {
              day = parseInt(parts[0], 10);
              month = parseInt(parts[1], 10) - 1;
              year = parseInt(parts[2], 10);
            }
          }
        } else if (cleanStr.includes('/')) {
          const parts = cleanStr.split('/');
          if (parts.length === 3) {
            if (parts[2].length === 4) {
              day = parseInt(parts[0], 10);
              month = parseInt(parts[1], 10) - 1;
              year = parseInt(parts[2], 10);
            } else if (parts[0].length === 4) {
              year = parseInt(parts[0], 10);
              month = parseInt(parts[1], 10) - 1;
              day = parseInt(parts[2], 10);
            }
          }
        }

        if (!year || isNaN(year) || isNaN(month) || isNaN(day)) {
          const d = new Date(cleanStr);
          if (!isNaN(d.getTime())) {
            year = d.getFullYear();
            month = d.getMonth();
            day = d.getDate();
          } else {
            return;
          }
        }

        const compDate = new Date(year, month, day);
        compDate.setHours(0, 0, 0, 0);
        const diff = Math.ceil((compDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Within warning window
        if (diff >= 0 && diff <= (c.diasAntecedencia ?? 2)) {
          if (!notifyAppointments) return;
          const notificationKey = `${c.id}_${diff}`;

          // If not notified yet for this specific day difference state
          if (!notified[notificationKey]) {
            const title = `Lembrete: ${c.titulo}`;
            let body = '';
            if (diff === 0) {
              body = `É hoje! ${c.hora ? `Às ${c.hora}.` : ''} ${c.descricao || ''}`;
            } else if (diff === 1) {
              body = `Amanhã! ${c.hora ? `Às ${c.hora}.` : ''} ${c.descricao || ''}`;
            } else {
              body = `Faltam ${diff} dias. ${c.hora ? `Às ${c.hora}.` : ''} ${c.descricao || ''}`;
            }

            // Trigger notification
            try {
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => {
                  reg.showNotification(title, {
                    body,
                    icon: '/favicon.ico',
                    tag: `comp-${c.id}-${diff}`,
                  });
                }).catch(() => {
                  new Notification(title, { body, icon: '/favicon.ico' });
                });
              } else {
                new Notification(title, { body, icon: '/favicon.ico' });
              }
            } catch (err) {
              console.error('Error showing web notification:', err);
              new Notification(title, { body, icon: '/favicon.ico' });
            }

            updatedNotified[notificationKey] = Date.now();
            hasNewNotifications = true;
          }
        }
      });

      if (hasNewNotifications) {
        localStorage.setItem('wealthflow_notified_compromissos', JSON.stringify(updatedNotified));
      }
    };

    // Run initially and then every 15 minutes to check
    checkAndNotifyCompromissos();
    const interval = setInterval(checkAndNotifyCompromissos, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, [compromissos, notifyAppointments]);

  // Browser Notification system for category budget limits (90% and 100%)
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (!notifyBudget) return;

    const checkAndNotifyBudgetLimits = () => {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const monthYearKey = `${currentYear}-${currentMonth}`;

      const notified = (() => {
        try {
          const saved = localStorage.getItem('wealthflow_budget_notified_90_100');
          return saved ? JSON.parse(saved) : {};
        } catch {
          return {};
        }
      })();
      let updatedNotified = { ...notified };
      let hasNewNotifications = false;

      // Helper to parse dates in DD/MM/YYYY or YYYY-MM-DD
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

      const budgetsEntries = Object.entries(categoryBudgets || {}).filter(([_, limit]) => Number(limit) > 0);

      budgetsEntries.forEach(([catName, annualLimitVal]) => {
        const annualLimit = Number(annualLimitVal);
        const monthlyLimit = annualLimit / 12;
        const catUpper = catName.toUpperCase();

        const spentInCatThisMonth = transactions
          .filter(t => {
            const pDate = parseDateHelper(t.data);
            if (!pDate) return false;
            const isCurrentMonthAndYear = pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear;
            const isExpense = String(t.tipo || '').trim().toUpperCase() !== 'RECEITA' && String(t.tipo || '').trim().toUpperCase() !== 'RECEBIDO';
            const matchesCategory = String(t.categoria || '').trim().toUpperCase() === catUpper;
            return isCurrentMonthAndYear && isExpense && matchesCategory;
          })
          .reduce((sum, t) => sum + t.valor, 0);

        const pct = monthlyLimit > 0 ? (spentInCatThisMonth / monthlyLimit) * 100 : 0;

        const formatCurrency = (val: number) => {
          return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        };

        if (pct >= 100) {
          const notificationKey = `${catUpper}_100_${monthYearKey}`;
          if (!notified[notificationKey]) {
            const title = `🚨 Limite Excedido: ${catUpper}`;
            const body = `Os gastos em ${catUpper} atingiram ${formatCurrency(spentInCatThisMonth)}, superando o limite de ${formatCurrency(monthlyLimit)} (100% atingido).`;
            
            triggerPushNotification(title, body, `budget-100-${catUpper}`);
            updatedNotified[notificationKey] = Date.now();
            hasNewNotifications = true;
          }
        } else if (pct >= 90) {
          const notificationKey = `${catUpper}_90_${monthYearKey}`;
          if (!notified[notificationKey]) {
            const title = `⚠️ Alerta de Orçamento: ${catUpper}`;
            const body = `Seus gastos em ${catUpper} atingiram ${formatCurrency(spentInCatThisMonth)}, o que representa ${Math.round(pct)}% do seu limite mensal de ${formatCurrency(monthlyLimit)}.`;
            
            triggerPushNotification(title, body, `budget-90-${catUpper}`);
            updatedNotified[notificationKey] = Date.now();
            hasNewNotifications = true;
          }
        }
      });

      if (hasNewNotifications) {
        localStorage.setItem('wealthflow_budget_notified_90_100', JSON.stringify(updatedNotified));
      }
    };

    const triggerPushNotification = (title: string, body: string, tag: string) => {
      try {
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
      } catch (err) {
        console.error('Error showing web notification:', err);
        new Notification(title, { body, icon: '/favicon.ico' });
      }
    };

    checkAndNotifyBudgetLimits();
  }, [transactions, categoryBudgets, notifyBudget]);

  // Real-time banking webhooks listener polling
  useEffect(() => {
    // Request notification permission on mount so we can send native OS notifications
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(err => console.log("Notification request error:", err));
    }

    let active = true;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`https://ais-pre-j6dzlaj35dcjsxeip35qsr-135670082760.us-east1.run.app/api/webhooks/pending?since=${lastWebhookTimeRef.current}`);
        if (!response.ok) return;
        const data = await response.json();
        if (data && Array.isArray(data.webhooks) && data.webhooks.length > 0) {
          data.webhooks.forEach((webhook: any) => {
            if (!active) return;
            if (webhook.timestamp > lastWebhookTimeRef.current) {
              lastWebhookTimeRef.current = webhook.timestamp;
            }

            // Try to match matching bank account by name
            const matchingAcc = bankAccountsState.find(acc => 
              acc.nome.toUpperCase().includes(webhook.bancoNome.toUpperCase()) ||
              webhook.bancoNome.toUpperCase().includes(acc.nome.toUpperCase())
            );
            const targetBankId = matchingAcc ? matchingAcc.id : (bankAccountsState[0]?.id || 1);

            // Pop open the floating interactive bank transaction import modal
            setBankIntegrationNotification({
              id: String(webhook.id),
              bancoNome: webhook.bancoNome,
              bancoId: targetBankId,
              valor: webhook.valor,
              descricao: webhook.descricao,
              isLoadingSuggestion: true
            });
            setIsSelectingTransferDest(false);
            setSelectedTransferDestId(null);

            // Fetch AI suggestion asynchronously
            fetchAiCategorySuggestion(String(webhook.id), webhook.descricao, webhook.valor, webhook.bancoNome);

            // Trigger actual HTML5 system-level desktop notification if permitted!
            if ("Notification" in window && Notification.permission === "granted") {
              try {
                new Notification(`Minhas Finanças • ${webhook.bancoNome}`, {
                  body: `Nova transação de R$ ${webhook.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Como deseja importá-la?`,
                  tag: "bank-transaction-" + webhook.id
                });
              } catch (e) {
                console.warn("Could not dispatch system notification:", e);
              }
            }

            // Play nice dual chime for incoming transaction alert
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc1 = audioCtx.createOscillator();
              const gain1 = audioCtx.createGain();
              osc1.connect(gain1);
              gain1.connect(audioCtx.destination);
              osc1.type = 'sine';
              osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
              gain1.gain.setValueAtTime(0.08, audioCtx.currentTime);
              gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
              osc1.start(audioCtx.currentTime);
              osc1.stop(audioCtx.currentTime + 0.15);
              
              const osc2 = audioCtx.createOscillator();
              const gain2 = audioCtx.createGain();
              osc2.connect(gain2);
              gain2.connect(audioCtx.destination);
              osc2.type = 'sine';
              osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.12); // E5
              gain2.gain.setValueAtTime(0.08, audioCtx.currentTime + 0.12);
              gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
              osc2.start(audioCtx.currentTime + 0.12);
              osc2.stop(audioCtx.currentTime + 0.3);
            } catch (e) {}
          });
        }
      } catch (err) {
        console.warn("Failed to poll live bank webhooks gracefully:", err);
      }
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [bankAccountsState]);

  // Shared Google Sync logic
  const triggerSync = async (
    tokenToUse?: string, 
    isBackground = false,
    overrideTxs?: Transaction[],
    overrideInfracs?: Infraction[],
    overrideZones?: RiskZone[],
    overrideAppts?: MedicalAppointment[],
    overridePrescs?: MedicalPrescription[],
    forceOverwriteSpreadsheet = false,
    overrideCompromissos?: Compromisso[],
    overrideVehicles?: RegisteredVehicle[],
    overridePerfServices?: CarServicePerformed[],
    overrideSchedServices?: CarServiceScheduled[],
    overrideBanks?: BankAccount[],
    overrideCards?: CreditCard[]
  ) => {
    const activeToken = tokenToUse || googleToken;
    if (!activeToken) return;

    if (!isDbLoaded) {
      console.log("Sincronização adiada: banco de dados local ainda não inicializado.");
      return;
    }

    const currentTxs = overrideTxs || transactions;
    const currentInfracs = overrideInfracs || infractions;
    const currentZones = overrideZones || riskZones;
    const currentAppts = overrideAppts || appointments;
    const currentPrescs = overridePrescs || prescriptions;
    const currentCompromissos = overrideCompromissos || compromissos;
    const currentVehicles = overrideVehicles || registeredVehicles;
    const currentPerfServices = overridePerfServices || performedServices;
    const currentSchedServices = overrideSchedServices || scheduledServices;
    const currentBanks = overrideBanks || bankAccountsState;
    const currentCards = overrideCards || creditCardsState;

    const syncStartTime = Date.now();

    // Check state sync key to avoid redundant or duplicate sync cycles on identical states
    const txsJson = JSON.stringify(currentTxs);
    const infsJson = JSON.stringify(currentInfracs);
    const zonesJson = JSON.stringify(currentZones);
    const apptsJson = JSON.stringify(currentAppts);
    const prescsJson = JSON.stringify(currentPrescs);
    const compJson = JSON.stringify(currentCompromissos);
    const vehJson = JSON.stringify(currentVehicles);
    const perfJson = JSON.stringify(currentPerfServices);
    const schedJson = JSON.stringify(currentSchedServices);
    const bankJson = JSON.stringify(currentBanks);
    const cardJson = JSON.stringify(currentCards);
    const syncKey = `${txsJson}_${infsJson}_${zonesJson}_${apptsJson}_${prescsJson}_${compJson}_${vehJson}_${perfJson}_${schedJson}_${bankJson}_${cardJson}`;
    if (lastSyncedTxRef.current === syncKey && !forceOverwriteSpreadsheet) {
      return;
    }

    // Check concurrency lock to avoid simultaneous sync requests (race conditions)
    if (syncLockRef.current) {
      // Queue the sync request for execution as soon as current sync finishes
      pendingSyncParamsRef.current = {
        tokenToUse,
        isBackground,
        overrideTxs: currentTxs,
        overrideInfracs: currentInfracs,
        overrideZones: currentZones,
        overrideAppts: currentAppts,
        overridePrescs: currentPrescs,
        overrideCompromissos: currentCompromissos,
        overrideVehicles: currentVehicles,
        overridePerfServices: currentPerfServices,
        overrideSchedServices: currentSchedServices,
        overrideBanks: currentBanks,
        overrideCards: currentCards
      };
      syncPendingRef.current = true;
      return;
    }
    syncLockRef.current = true;
    setIsSyncing(true);

    if (!isBackground) {
      setSyncError(null);
    }
    try {
      const sheetId = await findOrCreateSpreadsheet(activeToken);
      
      // 1. Fetch current spreadsheet data (unless forceOverwriteSpreadsheet is true)
      let sheetTxs: any[] = [];
      if (!forceOverwriteSpreadsheet) {
        try {
          sheetTxs = await fetchTransactionsFromSpreadsheet(activeToken, sheetId);
        } catch (fetchErr) {
          console.warn("Aviso ao buscar transações da planilha durante sincronização:", fetchErr);
        }
      }

      let cleanMergedTxs = currentTxs;

      if (!forceOverwriteSpreadsheet) {
        // 2. Perform safe Two-way Merge
        // Load list of locally deleted transaction IDs from localStorage to prevent re-importing deleted rows
        let deletedIds: number[] = [];
        try {
          const deletedIdsStr = localStorage.getItem('wealthflow_deleted_tx_ids') || '[]';
          deletedIds = JSON.parse(deletedIdsStr);
        } catch (e) {}

        // Retrieve last synced timestamp to determine whether local changes are newer than spreadsheet
        const lastSyncedTimestampStr = localStorage.getItem('wealthflow_last_synced_timestamp') || '0';
        const lastSyncedTimestamp = parseInt(lastSyncedTimestampStr, 10);

        // Start with current local state transactions
        const txMap = new Map<number, any>();
        currentTxs.forEach(t => txMap.set(t.id, t));

        // Identify spreadsheet transaction IDs for fast lookup
        const sheetTxIds = new Set<number>(sheetTxs.map(st => st.id));

        // Track transactions deleted in Google Sheets
        const deletedInSheetIds: number[] = [];
        if (lastSyncedTimestamp > 0 && sheetTxs.length > 0) {
          currentTxs.forEach(localTx => {
            const existsInSheet = sheetTxIds.has(localTx.id);
            const localUpdatedAt = localTx.updatedAt || 0;
            const isNewlyCreatedLocally = localUpdatedAt > lastSyncedTimestamp;

            // If a transaction was already synced to the spreadsheet before, but is now missing from it,
            // it means the user deleted it in Google Sheets directly.
            if (!existsInSheet && !isNewlyCreatedLocally) {
              txMap.delete(localTx.id);
              deletedInSheetIds.push(localTx.id);
            }
          });
        }

        let hasNewOrUpdatedFromSheet = false;
        const txsToSaveDb: any[] = [];

        sheetTxs.forEach(st => {
          // Skip if this transaction was explicitly deleted in the app
          if (deletedIds.includes(st.id)) return;

          const localTx = txMap.get(st.id);
          if (!localTx) {
            // New transaction entered by the user in the spreadsheet!
            txMap.set(st.id, st);
            txsToSaveDb.push(st);
            hasNewOrUpdatedFromSheet = true;
          } else {
            // Already exists locally. Compare fields to see if user modified it in the spreadsheet.
            const isDifferent = 
              localTx.descricao !== st.descricao ||
              localTx.valor !== st.valor ||
              localTx.categoria !== st.categoria ||
              localTx.data !== st.data ||
              localTx.status !== st.status ||
              localTx.tipo !== st.tipo ||
              localTx.obs !== st.obs ||
              localTx.km !== st.km ||
              localTx.litros !== st.litros ||
              localTx.precoLitro !== st.precoLitro ||
              localTx.veiculo !== st.veiculo;

            if (isDifferent) {
              const localUpdatedAt = localTx.updatedAt || 0;
              const isLocalNewer = localUpdatedAt > lastSyncedTimestamp;

              if (isLocalNewer) {
                // Local is newer! Keep localTx, don't overwrite with st.
                // It will be written back to the spreadsheet automatically in Step 3.
              } else {
                // Spreadsheet is newer! Merge st over localTx
                const updatedTx = { ...localTx, ...st, updatedAt: 0 };
                txMap.set(st.id, updatedTx);
                txsToSaveDb.push(updatedTx);
                hasNewOrUpdatedFromSheet = true;
              }
            }
          }
        });

        // Unified sorted list
        const mergedTxs = Array.from(txMap.values()).sort((a, b) => b.id - a.id);
        cleanMergedTxs = cleanDuplicateTransactions(mergedTxs);

        const hasDuplicatesCleaned = cleanMergedTxs.length < mergedTxs.length;

        // If updates came from the sheet, deletions occurred, or duplicates were cleaned, save them to state & DB
        if (hasNewOrUpdatedFromSheet || hasDuplicatesCleaned || deletedInSheetIds.length > 0) {
          setTransactions(cleanMergedTxs);
          localStorage.setItem('wealthflow_transactions', JSON.stringify(cleanMergedTxs));
          
          // Save new/updated transactions that are still in the clean list
          for (const tx of txsToSaveDb) {
            if (cleanMergedTxs.some(t => t.id === tx.id)) {
              await saveTransactionToDb(tx);
            }
          }

          // Delete any transactions from Firestore that the user deleted directly in Google Sheets
          for (const idToDel of deletedInSheetIds) {
            await deleteTransactionFromDb(idToDel);
          }

          // Permanently delete any removed duplicates from Firestore
          if (hasDuplicatesCleaned) {
            const cleanIds = new Set(cleanMergedTxs.map(t => t.id));
            const duplicateTxs = mergedTxs.filter(t => !cleanIds.has(t.id));
            for (const dup of duplicateTxs) {
              await deleteTransactionFromDb(dup.id);
            }
          }
        }
      }

      // Update stable reference to prevent redundant loop triggers
      const finalTxsJson = JSON.stringify(cleanMergedTxs);
      const finalInfsJson = JSON.stringify(currentInfracs);
      const finalZonesJson = JSON.stringify(currentZones);
      const finalApptsJson = JSON.stringify(currentAppts);
      const finalPrescsJson = JSON.stringify(currentPrescs);
      const finalCompJson = JSON.stringify(currentCompromissos);
      const finalVehJson = JSON.stringify(currentVehicles);
      const finalPerfJson = JSON.stringify(currentPerfServices);
      const finalSchedJson = JSON.stringify(currentSchedServices);
      const finalBankJson = JSON.stringify(currentBanks);
      const finalCardJson = JSON.stringify(currentCards);
      lastSyncedTxRef.current = `${finalTxsJson}_${finalInfsJson}_${finalZonesJson}_${finalApptsJson}_${finalPrescsJson}_${finalCompJson}_${finalVehJson}_${finalPerfJson}_${finalSchedJson}_${finalBankJson}_${finalCardJson}`;

      // 3. Write the fully updated merged list back to the spreadsheet
      const url = await syncDataToSpreadsheet(
        activeToken, 
        sheetId, 
        cleanMergedTxs, 
        currentInfracs,
        currentZones,
        currentAppts,
        currentPrescs,
        currentCompromissos,
        currentVehicles,
        currentPerfServices,
        currentSchedServices,
        currentBanks,
        currentCards
      );
      
      setSpreadsheetUrl(url);
      const nowStr = new Date().toLocaleString('pt-BR');
      setLastSyncedTime(nowStr);
      
      localStorage.setItem('wealthflow_spreadsheet_url', url);
      localStorage.setItem('wealthflow_last_synced_time', nowStr);
      localStorage.setItem('wealthflow_last_synced_timestamp', String(syncStartTime));
      await saveSyncTimestampToDb(syncStartTime);
    } catch (err: any) {
      const errMsg = err.message || "Erro desconhecido durante a sincronização.";
      const isAuthError = errMsg.includes("Sessão expirada") || errMsg.includes("401") || errMsg.includes("unauthorized") || errMsg.includes("expired");
      
      if (isAuthError) {
        console.warn("Google Sync Warn (Auth/Session Expired): ", errMsg);
        setGoogleUser(null);
        setGoogleToken(null);
        setSpreadsheetUrl('');
        setLastSyncedTime('');
        localStorage.removeItem('wealthflow_spreadsheet_url');
        localStorage.removeItem('wealthflow_last_synced_time');
        setSyncError(null);
        logout().catch(() => {});
      } else {
        console.error("Google Sync Error: ", err);
        if (!isBackground) {
          setSyncError(errMsg);
        } else {
          console.warn("Background auto-sync failed: ", errMsg);
        }
      }
    } finally {
      setIsSyncing(false);
      syncLockRef.current = false;

      // If a sync was queued while we were syncing, run it now!
      if (syncPendingRef.current && pendingSyncParamsRef.current) {
        const params = pendingSyncParamsRef.current;
        syncPendingRef.current = false;
        pendingSyncParamsRef.current = null;
        triggerSync(
          params.tokenToUse,
          params.isBackground,
          params.overrideTxs,
          params.overrideInfracs,
          params.overrideZones,
          params.overrideAppts,
          params.overridePrescs,
          false,
          params.overrideCompromissos,
          params.overrideVehicles,
          params.overridePerfServices,
          params.overrideSchedServices,
          params.overrideBanks,
          params.overrideCards
        );
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
        await triggerSync(result.accessToken);
      }
    } catch (err: any) {
      console.error(err);
      alert("Falha ao conectar com o Google: " + err.message);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error(e);
    }
    setGoogleUser(null);
    setGoogleToken(null);
    setSpreadsheetUrl('');
    setLastSyncedTime('');
    localStorage.removeItem('wealthflow_spreadsheet_url');
    localStorage.removeItem('wealthflow_last_synced_time');
  };

  const handleToggleAutoSync = (checked: boolean) => {
    setAutoSync(checked);
    localStorage.setItem('wealthflow_auto_sync', String(checked));
  };

  const triggerImport = async () => {
    const activeToken = googleToken;
    if (!activeToken) {
      alert("Por favor, conecte sua conta do Google primeiro.");
      return;
    }

    setIsImporting(true);
    setSyncError(null);
    try {
      const sheetId = await findOrCreateSpreadsheet(activeToken);
      const importedTxs = await fetchTransactionsFromSpreadsheet(activeToken, sheetId);
      
      if (importedTxs.length === 0) {
        alert("Nenhuma transação encontrada na aba 'Transações' da planilha para importar.");
        return;
      }

      await handleImportTransactions(importedTxs);
      
      alert(`Importação concluída! ${importedTxs.length} transações sincronizadas com sucesso.`);
      
      const nowStr = new Date().toLocaleString('pt-BR');
      setLastSyncedTime(nowStr);
      localStorage.setItem('wealthflow_last_synced_time', nowStr);
      localStorage.setItem('wealthflow_last_synced_timestamp', String(Date.now()));
    } catch (err: any) {
      const errMsg = err.message || "Erro desconhecido durante a importação.";
      const isAuthError = errMsg.includes("Sessão expirada") || errMsg.includes("401") || errMsg.includes("unauthorized") || errMsg.includes("expired");
      
      if (isAuthError) {
        console.warn("Google Import Warn (Auth/Session Expired): ", errMsg);
        setGoogleUser(null);
        setGoogleToken(null);
        setSpreadsheetUrl('');
        setLastSyncedTime('');
        localStorage.removeItem('wealthflow_spreadsheet_url');
        localStorage.removeItem('wealthflow_last_synced_time');
        setSyncError(null);
        alert("Sessão expirada. Por favor, conecte sua conta do Google Drive novamente para renovar o acesso.");
        logout().catch(() => {});
      } else {
        console.error("Google Import Error: ", err);
        setSyncError(errMsg);
        alert("Erro ao atualizar dados no aplicativo:\n" + errMsg);
      }
    } finally {
      setIsImporting(false);
    }
  };

  // Time state for mobile bar
  const [timeStr, setTimeStr] = useState<string>('12:34');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Shared handlers
  const handleAddTransaction = async (newTx: Omit<Transaction, 'id'> | Omit<Transaction, 'id'>[]) => {
    if (Array.isArray(newTx)) {
      let currentTransactions = [...transactions];
      const addedObjects: Transaction[] = [];
      for (const tx of newTx) {
        const id = currentTransactions.length ? Math.max(...currentTransactions.map(t => t.id)) + 1 : 1;
        const txObj = { id, ...tx, updatedAt: Date.now() };
        currentTransactions = [txObj, ...currentTransactions];
        addedObjects.push(txObj);
        await runTrackedSync('Adição de Lançamento', `${txObj.descricao || 'Lançamento'} (R$ ${txObj.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`, () => saveTransactionToDb(txObj));
      }
      setTransactions(currentTransactions);
      if (googleToken) {
        triggerSync(googleToken, true, currentTransactions);
      }
    } else {
      const id = transactions.length ? Math.max(...transactions.map(t => t.id)) + 1 : 1;
      const txObj = { id, ...newTx, updatedAt: Date.now() };
      const updated = [txObj, ...transactions];
      setTransactions(updated);
      await runTrackedSync('Adição de Lançamento', `${txObj.descricao || 'Lançamento'} (R$ ${txObj.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`, () => saveTransactionToDb(txObj));
      if (googleToken) {
        triggerSync(googleToken, true, updated);
      }
    }
  };

  const handleEditTransaction = async (id: number, updatedFields: Partial<Transaction>) => {
    const updated = transactions.map(t => t.id === id ? { ...t, ...updatedFields, updatedAt: Date.now() } : t);
    setTransactions(updated);
    const item = updated.find(t => t.id === id);
    if (item) {
      await runTrackedSync('Edição de Lançamento', `${item.descricao || 'Lançamento'} (R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`, () => saveTransactionToDb(item));
    }
    if (googleToken) {
      triggerSync(googleToken, true, updated);
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    const updated = transactions.filter(t => t.id !== id);
    setTransactions(updated);
    localStorage.setItem('wealthflow_transactions', JSON.stringify(updated));
    
    // Track deleted transaction ID to prevent two-way sync from re-importing it
    try {
      const deletedIdsStr = localStorage.getItem('wealthflow_deleted_tx_ids') || '[]';
      const deletedIds: number[] = JSON.parse(deletedIdsStr);
      if (!deletedIds.includes(id)) {
        deletedIds.push(id);
        localStorage.setItem('wealthflow_deleted_tx_ids', JSON.stringify(deletedIds));
      }
    } catch (e) {}

    const txToDelete = transactions.find(t => t.id === id);
    const txDesc = txToDelete ? `${txToDelete.descricao} (R$ ${txToDelete.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` : `ID #${id}`;
    await runTrackedSync('Remoção de Lançamento', txDesc, () => deleteTransactionFromDb(id));
    if (googleToken) {
      triggerSync(googleToken, true, updated);
    }
  };

  const handleImportTransactions = async (importedTxs: Transaction[]) => {
    const txMap = new Map<number, Transaction>();
    transactions.forEach(t => txMap.set(t.id, t));
    importedTxs.forEach(t => txMap.set(t.id, t));
    
    const merged = Array.from(txMap.values()).sort((a, b) => b.id - a.id);
    setTransactions(merged);
    localStorage.setItem('wealthflow_transactions', JSON.stringify(merged));
    
    for (const t of importedTxs) {
      await runTrackedSync('Importação de Lançamento', `${t.descricao} (R$ ${t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`, () => saveTransactionToDb(t));
    }
  };

  const handleWipeTransactions = async () => {
    showConfirm(
      "⚠️ ATENÇÃO - OPERAÇÃO IRREVERSÍVEL",
      "Isso irá APAGAR COMPLETAMENTE todos os lançamentos financeiros (planilha finanças) do aplicativo e do banco de dados Firestore. Deseja realmente continuar?",
      async () => {
        try {
          const { db } = await import('./lib/firebase');
          const { collection, getDocs, deleteDoc, doc, setDoc } = await import('firebase/firestore');
          
          const querySnapshot = await getDocs(collection(db, 'transactions'));
          const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
          await Promise.all(deletePromises);

          // Also set the seed flag to true so it never auto-seeds again!
          await setDoc(doc(db, 'settings', 'seed'), { transactions: true }, { merge: true });

          setTransactions([]);
          localStorage.removeItem('wealthflow_transactions');
          localStorage.removeItem('wealthflow_deleted_tx_ids');
          localStorage.removeItem('wealthflow_last_synced_timestamp');
          
          showAlert("Sucesso", "Planilha de finanças limpa completamente do banco de dados!");
        } catch (error: any) {
          console.error(error);
          showAlert("Erro", `Erro ao limpar transações: ${error.message || error}`);
        }
      }
    );
  };

  const handleReindexTransactions = async () => {
    if (!transactions.length) {
      showAlert("Sem Lançamentos", "Não há lançamentos para renumerar.");
      return;
    }

    showConfirm(
      "Renumerar Lançamentos",
      "Deseja realmente renumerar e ordenar todos os lançamentos financeiros? Isso organizará os registros de forma cronológica e reatribuirá os IDs sequencialmente a partir de #1 (sem deixar furos de numeração).",
      async () => {
        try {
          setIsSyncing(true);
          
          // Helper to parse date
          const parseTxDateLocal = (dateStr: string): Date => {
            if (!dateStr) return new Date(0);
            const str = String(dateStr).trim();
            if (str.includes('/')) {
              const parts = str.split('/');
              if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                return new Date(year, month, day);
              }
            } else if (str.includes('-')) {
              const parts = str.split('-');
              if (parts.length === 3) {
                if (parts[0].length === 4) {
                  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                } else {
                  return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
                }
              }
            }
            const d = new Date(str);
            return isNaN(d.getTime()) ? new Date(0) : d;
          };

          // Sort chronologically (oldest to newest)
          const sorted = [...transactions].sort((a, b) => {
            const timeA = parseTxDateLocal(a.data).getTime();
            const timeB = parseTxDateLocal(b.data).getTime();
            if (timeA !== timeB) return timeA - timeB;
            return a.id - b.id; // stable tie-breaker
          });

          const { db } = await import('./lib/firebase');
          const { collection, getDocs, deleteDoc } = await import('firebase/firestore');

          // Delete existing transactions in Firestore
          const querySnapshot = await getDocs(collection(db, 'transactions'));
          const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
          await Promise.all(deletePromises);

          // Assign new IDs from 1 to N
          const reindexed = sorted.map((t, index) => {
            const newId = index + 1;
            return {
              ...t,
              id: newId,
              updatedAt: Date.now()
            };
          });

          // Save new IDs to Firestore
          for (const tx of reindexed) {
            await saveTransactionToDb(tx);
          }

          // Update local state and localStorage
          setTransactions(reindexed);
          localStorage.setItem('wealthflow_transactions', JSON.stringify(reindexed));
          localStorage.removeItem('wealthflow_deleted_tx_ids'); // Reset deletions because IDs are recalculated

          setIsSyncing(false);
          showAlert("Sucesso", `Todos os ${reindexed.length} lançamentos foram reordenados e renumerados a partir de #1 com sucesso!`);

          if (googleToken) {
            await triggerSync(googleToken, true, reindexed, undefined, undefined, undefined, undefined, true);
          }
        } catch (error: any) {
          setIsSyncing(false);
          console.error("Erro ao renumerar transações:", error);
          showAlert("Erro", `Não foi possível renumerar as transações: ${error.message || error}`);
        }
      }
    );
  };

  const handleAddRiskZone = async (newZone: Omit<RiskZone, 'id'>) => {
    const id = riskZones.length ? Math.max(...riskZones.map(z => z.id)) + 1 : 1;
    const zoneObj = { id, ...newZone };
    const updated = [zoneObj, ...riskZones];
    setRiskZones(updated);
    await runTrackedSync('Nova Zona de Risco', `${zoneObj.nomeLocal} - Risco: ${zoneObj.nivelRisco}`, () => saveRiskZoneToDb(zoneObj));
    if (googleToken) {
      triggerSync(googleToken, true, undefined, undefined, updated);
    }
  };

  const handleEditRiskZone = async (id: number, updatedFields: Partial<RiskZone>) => {
    const updated = riskZones.map(z => z.id === id ? { ...z, ...updatedFields } : z);
    setRiskZones(updated);
    const item = updated.find(z => z.id === id);
    if (item) {
      await runTrackedSync('Edição de Zona de Risco', `${item.nomeLocal}`, () => saveRiskZoneToDb(item));
    }
    if (googleToken) {
      triggerSync(googleToken, true, undefined, undefined, updated);
    }
  };

  const handleDeleteRiskZone = async (id: number) => {
    const updated = riskZones.filter(z => z.id !== id);
    setRiskZones(updated);
    const zoneToDelete = riskZones.find(z => z.id === id);
    const zoneName = zoneToDelete ? zoneToDelete.nomeLocal : `ID #${id}`;
    await runTrackedSync('Remoção de Zona de Risco', zoneName, () => deleteRiskZoneFromDb(id));
    if (googleToken) {
      triggerSync(googleToken, true, undefined, undefined, updated);
    }
  };

  const handleToggleZoneActive = async (id: number) => {
    const updated = riskZones.map(z => z.id === id ? { ...z, ativo: !z.ativo } : z);
    setRiskZones(updated);
    const item = updated.find(z => z.id === id);
    if (item) {
      await runTrackedSync('Alteração de Status de Zona de Risco', `${item.nomeLocal} (${item.ativo ? 'Ativado' : 'Desativado'})`, () => saveRiskZoneToDb(item));
    }
    if (googleToken) {
      triggerSync(googleToken, true, undefined, undefined, updated);
    }
  };

  const handleAddAppealedInfraction = async (newAppeal: Infraction) => {
    const updatedInfs = [newAppeal, ...infractions];
    setInfractions(updatedInfs);
    await saveInfractionToDb(newAppeal);
    // remove from unappealed queue
    const updatedNonAppealed = nonAppealed.filter(n => n.protocolo !== newAppeal.protocolo);
    setNonAppealed(updatedNonAppealed);
    await deleteNonAppealedFromDb(newAppeal.id);
    if (googleToken) {
      triggerSync(googleToken, true, undefined, updatedInfs);
    }
  };

  const handleDeleteInfraction = async (id: string) => {
    const updated = infractions.filter(i => i.id !== id);
    setInfractions(updated);
    await deleteInfractionFromDb(id);
    if (googleToken) {
      triggerSync(googleToken, true, undefined, updated);
    }
  };

  const handleAvatarChange = async (url: string) => {
    setAvatarUrl(url);
    await saveAvatarUrlToDb(url);
  };

  const handleAddAppointment = async (newAppt: Omit<MedicalAppointment, 'id'>) => {
    const id = Date.now().toString();
    const apptObj = { id, ...newAppt, updatedAt: Date.now() };
    const updated = [...appointments, apptObj].sort((a, b) => {
      const dateTimeA = `${a.data}T${a.hora}`;
      const dateTimeB = `${b.data}T${b.hora}`;
      return dateTimeA.localeCompare(dateTimeB);
    });
    setAppointments(updated);
    try {
      await saveMedicalAppointmentToDb(apptObj);
    } catch (error) {
      console.error("Error saving medical appointment:", error);
      showAlert?.(
        'Aviso de Conexão',
        'Sua consulta foi agendada localmente, mas não pôde ser salva na nuvem. Verifique sua conexão com a internet.'
      );
    }
    if (googleToken) {
      triggerSync(googleToken, true, undefined, undefined, undefined, updated);
    }
  };

  const handleEditAppointment = async (id: string, updatedFields: Partial<MedicalAppointment>) => {
    const updated = appointments.map(appt => appt.id === id ? { ...appt, ...updatedFields, updatedAt: Date.now() } : appt);
    setAppointments(updated);
    const item = updated.find(appt => appt.id === id);
    if (item) {
      try {
        await saveMedicalAppointmentToDb(item);
      } catch (error) {
        console.error("Error updating medical appointment:", error);
        showAlert?.(
          'Aviso de Conexão',
          'Suas alterações foram aplicadas localmente, mas não puderam ser salvas na nuvem. Verifique sua conexão.'
        );
      }
    }
    if (googleToken) {
      triggerSync(googleToken, true, undefined, undefined, undefined, updated);
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    const backup = [...appointments];
    const updated = appointments.filter(appt => appt.id !== id);
    setAppointments(updated);
    try {
      await deleteMedicalAppointmentFromDb(id);
      if (googleToken) {
        triggerSync(googleToken, true, undefined, undefined, undefined, updated);
      }
    } catch (error) {
      console.error("Error deleting medical appointment:", error);
      setAppointments(backup);
      showAlert?.(
        'Erro de Remoção',
        'Não foi possível remover o agendamento na nuvem. Verifique sua conexão e tente novamente.'
      );
    }
  };

  const handleAddCompromisso = async (newComp: Omit<Compromisso, 'id'>) => {
    const id = Date.now().toString();
    const compObj = { id, ...newComp, updatedAt: Date.now() };
    const updated = [...compromissos, compObj].sort((a, b) => {
      const dateTimeA = `${a.data}T${a.hora || '00:00'}`;
      const dateTimeB = `${b.data}T${b.hora || '00:00'}`;
      return dateTimeA.localeCompare(dateTimeB);
    });
    setCompromissos(updated);
    localStorage.setItem('wealthflow_compromissos', JSON.stringify(updated));
    try {
      await runTrackedSync('Novo Compromisso', `${compObj.titulo} (${compObj.data})`, () => saveCompromissoToDb(compObj));
    } catch (error) {
      console.error("Error saving compromisso:", error);
      showAlert(
        'Aviso de Conexão',
        'Seu compromisso foi agendado localmente, mas não pôde ser salvo na nuvem. Verifique sua conexão com a internet.'
      );
    }
  };

  const handleEditCompromisso = async (id: string, updatedFields: Partial<Compromisso>) => {
    const updated = compromissos.map(comp => comp.id === id ? { ...comp, ...updatedFields, updatedAt: Date.now() } : comp);
    setCompromissos(updated);
    localStorage.setItem('wealthflow_compromissos', JSON.stringify(updated));
    const item = updated.find(comp => comp.id === id);
    if (item) {
      try {
        await runTrackedSync('Edição de Compromisso', `${item.titulo} (${item.data})`, () => saveCompromissoToDb(item));
      } catch (error) {
        console.error("Error updating compromisso:", error);
        showAlert(
          'Aviso de Conexão',
          'Suas alterações foram aplicadas localmente, mas não puderam ser salvas na nuvem. Verifique sua conexão.'
        );
      }
    }
  };

  const handleDeleteCompromisso = async (id: string) => {
    const backup = [...compromissos];
    const updated = compromissos.filter(comp => comp.id !== id);
    setCompromissos(updated);
    localStorage.setItem('wealthflow_compromissos', JSON.stringify(updated));
    try {
      const compToDelete = compromissos.find(c => c.id === id);
      const compName = compToDelete ? compToDelete.titulo : `ID #${id}`;
      await runTrackedSync('Remoção de Compromisso', compName, () => deleteCompromissoFromDb(id));
    } catch (error) {
      console.error("Error deleting compromisso:", error);
      setCompromissos(backup);
      localStorage.setItem('wealthflow_compromissos', JSON.stringify(backup));
      showAlert(
        'Erro de Remoção',
        'Não foi possível remover o compromisso na nuvem. Verifique sua conexão e tente novamente.'
      );
    }
  };

  const handleAddPerformedService = async (newService: Omit<CarServicePerformed, 'id'>) => {
    const id = Date.now().toString();
    const serviceObj = { id, ...newService, updatedAt: Date.now() };
    const updated = [serviceObj, ...performedServices];
    setPerformedServices(updated);
    localStorage.setItem('wealthflow_car_services_performed', JSON.stringify(updated));
    try {
      await runTrackedSync('Novo Serviço Realizado', `${serviceObj.descricao} (${serviceObj.data})`, () => savePerformedServiceToDb(serviceObj));
    } catch (error) {
      console.error("Error saving performed service:", error);
      showAlert(
        'Aviso de Conexão',
        'Seu serviço foi registrado localmente, mas não pôde ser salvo na nuvem. Verifique sua conexão.'
      );
    }
  };

  const handleEditPerformedService = async (id: string, updatedFields: Partial<CarServicePerformed>) => {
    const updated = performedServices.map(s => s.id === id ? { ...s, ...updatedFields, updatedAt: Date.now() } : s);
    setPerformedServices(updated);
    localStorage.setItem('wealthflow_car_services_performed', JSON.stringify(updated));
    const item = updated.find(s => s.id === id);
    if (item) {
      try {
        await runTrackedSync('Edição de Serviço Realizado', `${item.descricao}`, () => savePerformedServiceToDb(item));
      } catch (error) {
        console.error("Error updating performed service:", error);
        showAlert(
          'Aviso de Conexão',
          'As alterações foram aplicadas localmente, mas não puderam ser salvas na nuvem.'
        );
      }
    }
  };

  const handleDeletePerformedService = async (id: string) => {
    const backup = [...performedServices];
    const updated = performedServices.filter(s => s.id !== id);
    setPerformedServices(updated);
    localStorage.setItem('wealthflow_car_services_performed', JSON.stringify(updated));
    try {
      const toDelete = backup.find(s => s.id === id);
      const name = toDelete ? toDelete.descricao : `ID #${id}`;
      await runTrackedSync('Remoção de Serviço Realizado', name, () => deletePerformedServiceFromDb(id));
    } catch (error) {
      console.error("Error deleting performed service:", error);
      setPerformedServices(backup);
      localStorage.setItem('wealthflow_car_services_performed', JSON.stringify(backup));
      showAlert(
        'Erro de Remoção',
        'Não foi possível remover o serviço na nuvem. Verifique sua conexão.'
      );
    }
  };

  const handleAddScheduledService = async (newService: Omit<CarServiceScheduled, 'id'>) => {
    const id = Date.now().toString();
    const serviceObj = { id, ...newService, updatedAt: Date.now() };
    const updated = [...scheduledServices, serviceObj];
    setScheduledServices(updated);
    localStorage.setItem('wealthflow_car_services_scheduled', JSON.stringify(updated));
    try {
      await runTrackedSync('Novo Serviço Planejado', `${serviceObj.descricao}`, () => saveScheduledServiceToDb(serviceObj));
    } catch (error) {
      console.error("Error saving scheduled service:", error);
      showAlert(
        'Aviso de Conexão',
        'Seu serviço foi agendado localmente, mas não pôde ser salvo na nuvem. Verifique sua conexão.'
      );
    }
  };

  const handleEditScheduledService = async (id: string, updatedFields: Partial<CarServiceScheduled>) => {
    const updated = scheduledServices.map(s => s.id === id ? { ...s, ...updatedFields, updatedAt: Date.now() } : s);
    setScheduledServices(updated);
    localStorage.setItem('wealthflow_car_services_scheduled', JSON.stringify(updated));
    const item = updated.find(s => s.id === id);
    if (item) {
      try {
        await runTrackedSync('Edição de Serviço Planejado', `${item.descricao}`, () => saveScheduledServiceToDb(item));
      } catch (error) {
        console.error("Error updating scheduled service:", error);
        showAlert(
          'Aviso de Conexão',
          'As alterações foram aplicadas localmente, mas não puderam ser salvas na nuvem.'
        );
      }
    }
  };

  const handleDeleteScheduledService = async (id: string) => {
    const backup = [...scheduledServices];
    const updated = scheduledServices.filter(s => s.id !== id);
    setScheduledServices(updated);
    localStorage.setItem('wealthflow_car_services_scheduled', JSON.stringify(updated));
    try {
      const toDelete = backup.find(s => s.id === id);
      const name = toDelete ? toDelete.descricao : `ID #${id}`;
      await runTrackedSync('Remoção de Serviço Planejado', name, () => deleteScheduledServiceFromDb(id));
    } catch (error) {
      console.error("Error deleting scheduled service:", error);
      setScheduledServices(backup);
      localStorage.setItem('wealthflow_car_services_scheduled', JSON.stringify(backup));
      showAlert(
        'Erro de Remoção',
        'Não foi possível remover o agendamento na nuvem. Verifique sua conexão.'
      );
    }
  };

  const handleAddPrescription = async (newPresc: Omit<MedicalPrescription, 'id'>) => {
    const id = Date.now().toString();
    const prescObj = { id, ...newPresc, updatedAt: Date.now() };
    const updated = [prescObj, ...prescriptions];
    setPrescriptions(updated);
    try {
      await saveMedicalPrescriptionToDb(prescObj);
    } catch (error) {
      console.error("Error saving prescription:", error);
      showAlert?.(
        'Erro ao Salvar Anexo/Receita',
        'A receita foi salva localmente, mas não pôde ser salva na nuvem. Se você anexou um PDF, certifique-se de que o arquivo seja pequeno (recomendado até 450KB).'
      );
    }
    if (googleToken) {
      triggerSync(googleToken, true, undefined, undefined, undefined, undefined, updated);
    }
  };

  const handleEditPrescription = async (id: string, updatedFields: Partial<MedicalPrescription>) => {
    const updated = prescriptions.map(p => p.id === id ? { ...p, ...updatedFields, updatedAt: Date.now() } : p);
    setPrescriptions(updated);
    const item = updated.find(p => p.id === id);
    if (item) {
      try {
        await saveMedicalPrescriptionToDb(item);
      } catch (error) {
        console.error("Error updating prescription:", error);
        showAlert?.(
          'Erro ao Atualizar Anexo/Receita',
          'Suas alterações foram aplicadas localmente, mas falharam ao salvar na nuvem. Se anexou um arquivo grande, tente usar um menor (até 450KB).'
        );
      }
    }
    if (googleToken) {
      triggerSync(googleToken, true, undefined, undefined, undefined, undefined, updated);
    }
  };

  const handleDeletePrescription = async (id: string) => {
    const backup = [...prescriptions];
    const updated = prescriptions.filter(p => p.id !== id);
    setPrescriptions(updated);
    try {
      await deleteMedicalPrescriptionFromDb(id);
      if (googleToken) {
        triggerSync(googleToken, true, undefined, undefined, undefined, undefined, updated);
      }
    } catch (error) {
      console.error("Error deleting prescription:", error);
      setPrescriptions(backup);
      showAlert?.(
        'Erro de Remoção',
        'Não foi possível remover a receita na nuvem. Verifique sua conexão.'
      );
    }
  };

  // Safe router navigation callback
  const handleTabNavigate = (tab: string) => {
    if (tab === 'add-transaction' || tab === 'add-receita' || tab === 'add-despesa') {
      if (tab === 'add-receita') {
        localStorage.setItem('draft_txType', 'RECEITA');
        localStorage.setItem('draft_category', 'OUTROS');
      } else if (tab === 'add-despesa') {
        localStorage.setItem('draft_txType', 'DESPESA');
        localStorage.setItem('draft_category', 'ABASTECIMENTO');
      }
      setCurrentTab('transactions');
      setShowAddTxForm(true);
    } else {
      setShowAddTxForm(false);
      setCurrentTab(tab);
    }
  };

  // Render view template selector
  const renderCurrentView = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <Dashboard 
            transactions={transactions} 
            bankAccounts={bankAccountsState}
            creditCards={creditCardsState}
            onNavigate={handleTabNavigate}
            appointments={appointments}
            prescriptions={prescriptions}
            compromissos={compromissos}
            scheduledServices={scheduledServices}
            onEditTransaction={handleEditTransaction}
            onAddTransaction={handleAddTransaction}
            onTriggerNotification={triggerSimulationNotification}
            onTriggerBankIntegration={triggerBankIntegration}
            showConfirm={showConfirm}
            showAlert={showAlert}
            riskZones={riskZones}
            registeredVehicles={registeredVehicles}
            setRegisteredVehicles={setRegisteredVehicles}
            categoryBudgets={categoryBudgets}
            setCategoryBudgets={setCategoryBudgets}
            customCategories={customCategories}
            ipvaLeadDays={ipvaLeadDays}
            setIpvaLeadDays={setIpvaLeadDays}
            ipvaClosingDay={ipvaClosingDay}
            medicalAppointmentLeadDays={medicalAppointmentLeadDays}
            ipvaNotificationColor={ipvaNotificationColor}
            dailyCheckInTime={dailyCheckInTime}
            setDailyCheckInTime={setDailyCheckInTime}
            notifyIpva={notifyIpva}
            defaultVehicleId={defaultVehicleId}
          />
        );
      case 'analysis':
        return (
          <AnalysisTab 
            transactions={transactions}
            onNavigate={handleTabNavigate}
            showAlert={showAlert}
          />
        );
      case 'transactions':
        return (
          <TransactionsTab 
            transactions={transactions}
            infractions={infractions}
            onAddTransaction={handleAddTransaction}
            onEditTransaction={handleEditTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onImportTransactions={handleImportTransactions}
            onWipeTransactions={handleWipeTransactions}
            onReindexTransactions={handleReindexTransactions}
            showAddForm={showAddTxForm}
            setShowAddForm={setShowAddTxForm}
            googleUser={googleUser}
            googleToken={googleToken}
            isSyncing={isSyncing}
            isImporting={isImporting}
            spreadsheetUrl={spreadsheetUrl}
            syncError={syncError}
            lastSyncedTime={lastSyncedTime}
            autoSync={autoSync}
            onGoogleLogin={handleGoogleLogin}
            onGoogleLogout={handleGoogleLogout}
            onToggleAutoSync={handleToggleAutoSync}
            onTriggerSync={triggerSync}
            onTriggerImport={triggerImport}
            showAlert={showAlert}
            showConfirm={showConfirm}
            registeredVehicles={registeredVehicles}
            setRegisteredVehicles={setRegisteredVehicles}
            bankAccounts={bankAccountsState}
            onUpdateBankAccounts={setBankAccountsState}
            customCategories={customCategories}
            onTriggerBankIntegration={triggerBankIntegration}
          />
        );
      case 'risk':
        return (
          <RiskZonesTab 
            riskZones={riskZones}
            onAddRiskZone={handleAddRiskZone}
            onToggleActive={handleToggleZoneActive}
            onEditRiskZone={handleEditRiskZone}
            onDeleteRiskZone={handleDeleteRiskZone}
            showAlert={showAlert}
            showConfirm={showConfirm}
          />
        );
      case 'medical':
        return (
          <MedicalAppointmentsTab
            appointments={appointments}
            onAddAppointment={handleAddAppointment}
            onEditAppointment={handleEditAppointment}
            onDeleteAppointment={handleDeleteAppointment}
            prescriptions={prescriptions}
            onAddPrescription={handleAddPrescription}
            onEditPrescription={handleEditPrescription}
            onDeletePrescription={handleDeletePrescription}
            showAlert={showAlert}
            showConfirm={showConfirm}
            medicalAppointmentLeadDays={medicalAppointmentLeadDays}
          />
        );
      case 'profile':
        return (
          <ProfileTab 
            bankAccounts={bankAccountsState}
            setBankAccounts={setBankAccountsState}
            creditCards={creditCardsState}
            setCreditCards={setCreditCardsState}
            avatarUrl={avatarUrl}
            onAvatarChange={handleAvatarChange}
            transactions={transactions}
            setTransactions={setTransactions}
            riskZones={riskZones}
            setRiskZones={setRiskZones}
            infractions={infractions}
            setInfractions={setInfractions}
            nonAppealed={nonAppealed}
            setNonAppealed={setNonAppealed}
            showAlert={showAlert}
            showConfirm={showConfirm}
            registeredVehicles={registeredVehicles}
            setRegisteredVehicles={setRegisteredVehicles}
            compromissos={compromissos}
            customCategories={customCategories}
            setCustomCategories={setCustomCategories}
            securityConfig={securityConfig}
            setSecurityConfig={setSecurityConfig}
            onTestLock={() => setIsAppLocked(true)}
            categoryBudgets={categoryBudgets}
            setCategoryBudgets={setCategoryBudgets}
            googleToken={googleToken}
            googleUser={googleUser}
            onGoogleLogin={handleGoogleLogin}
            onGoogleLogout={handleGoogleLogout}
            ipvaLeadDays={ipvaLeadDays}
            setIpvaLeadDays={setIpvaLeadDays}
            ipvaClosingDay={ipvaClosingDay}
            setIpvaClosingDay={setIpvaClosingDay}
            medicalAppointmentLeadDays={medicalAppointmentLeadDays}
            setMedicalAppointmentLeadDays={setMedicalAppointmentLeadDays}
            ipvaNotificationColor={ipvaNotificationColor}
            setIpvaNotificationColor={setIpvaNotificationColor}
            notifyIpva={notifyIpva}
            setNotifyIpva={setNotifyIpva}
            notifyBudget={notifyBudget}
            setNotifyBudget={setNotifyBudget}
            notifyAppointments={notifyAppointments}
            setNotifyAppointments={setNotifyAppointments}
            dailyCheckInTime={dailyCheckInTime}
            setDailyCheckInTime={setDailyCheckInTime}
            defaultVehicleId={defaultVehicleId}
            setDefaultVehicleId={setDefaultVehicleId}
            licensingReminderDay={licensingReminderDay}
            setLicensingReminderDay={setLicensingReminderDay}
            notifyLicensing={notifyLicensing}
            setNotifyLicensing={setNotifyLicensing}
          />
        );
      case 'compromissos':
        return (
          <CompromissosTab 
            compromissos={compromissos}
            onAddCompromisso={handleAddCompromisso}
            onEditCompromisso={handleEditCompromisso}
            onDeleteCompromisso={handleDeleteCompromisso}
            onNavigate={handleTabNavigate}
          />
        );
      case 'carservices':
        return (
          <CarServicesTab
            performedServices={performedServices}
            scheduledServices={scheduledServices}
            registeredVehicles={registeredVehicles}
            bankAccounts={bankAccountsState}
            transactions={transactions}
            onAddPerformedService={handleAddPerformedService}
            onEditPerformedService={handleEditPerformedService}
            onDeletePerformedService={handleDeletePerformedService}
            onAddScheduledService={handleAddScheduledService}
            onEditScheduledService={handleEditScheduledService}
            onDeleteScheduledService={handleDeleteScheduledService}
            onAddTransaction={handleAddTransaction}
            showAlert={showAlert}
            showConfirm={showConfirm}
            onAddFuel={() => {
              try {
                localStorage.setItem('draft_category', 'ABASTECIMENTO');
                localStorage.setItem('draft_txType', 'DESPESA');
                // Ensure km is cleared as draft so user can type it from scratch or we can let it be empty
                localStorage.setItem('draft_km', '');
              } catch (e) {
                console.error("Failed to write to localStorage for draft_category:", e);
              }
              setShowAddTxForm(true);
              handleTabNavigate('transactions');
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-[100dvh] md:min-h-screen bg-slate-950 flex items-center justify-center p-0 md:p-6 text-slate-100 font-sans overflow-hidden md:overflow-visible">
      
      {/* Luxury Smartphone Simulator Shell for desktop, responsive native look on mobile */}
      <div className="w-full max-w-md h-[100dvh] md:h-[840px] md:max-h-[90vh] bg-slate-900 md:rounded-[42px] md:border-8 md:border-slate-800 shadow-2xl flex flex-col overflow-hidden relative md:ring-1 md:ring-slate-700/50">
        
        {/* Lock Screen Security Overlay */}
        <AnimatePresence>
          {isAppLocked && securityConfig.enabled && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="absolute inset-0 z-[100]"
            >
              <LockScreen 
                securityConfig={securityConfig} 
                onUnlock={() => setIsAppLocked(false)} 
                avatarUrl={avatarUrl}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Simulator Notch Camera Speaker */}
        <div className="hidden md:flex absolute top-2 left-1/2 -translate-x-1/2 w-32 h-5 bg-slate-800 rounded-full z-50 items-center justify-center">
          <div className="w-3 h-3 bg-slate-950 rounded-full mr-2" />
          <div className="w-12 h-1 bg-slate-900 rounded-full" />
        </div>

        {/* Dynamic Mobile Status Bar Header */}
        <header className="bg-slate-950/80 backdrop-blur-md px-6 py-2.5 flex justify-between items-center text-xs text-slate-300 select-none z-40 relative md:pt-4">
          <span className="font-semibold font-mono tracking-tight">{timeStr}</span>
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            {/* Sync Connection Queue Button */}
            <button
              onClick={() => setShowSyncQueueModal(true)}
              className="flex items-center gap-1 bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-800/80 rounded-full px-2 py-0.5 active:scale-95 transition-all cursor-pointer mr-1.5 shadow-sm shadow-black/40"
              title="Fila de Mudanças Pendentes"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
              <span className={`material-symbols-outlined text-[13px] leading-none ${
                pendingChanges.some(c => c.status === 'SYNCING') 
                  ? 'animate-spin text-emerald-400' 
                  : !isOnline 
                  ? 'text-rose-400' 
                  : pendingChanges.some(c => c.status === 'FAILED' || c.status === 'PENDING')
                  ? 'text-amber-400'
                  : 'text-emerald-500'
              }`}>
                {pendingChanges.some(c => c.status === 'SYNCING') 
                  ? 'sync' 
                  : !isOnline 
                  ? 'cloud_off' 
                  : pendingChanges.some(c => c.status === 'FAILED' || c.status === 'PENDING')
                  ? 'cloud_sync'
                  : 'cloud_done'}
              </span>
              {pendingChanges.filter(c => c.status === 'PENDING' || c.status === 'SYNCING' || c.status === 'FAILED').length > 0 && (
                <span className="text-[8px] font-bold text-white bg-rose-600 px-1 rounded-full transform scale-90 leading-tight">
                  {pendingChanges.filter(c => c.status === 'PENDING' || c.status === 'SYNCING' || c.status === 'FAILED').length}
                </span>
              )}
            </button>
            <span className="material-symbols-outlined text-xs">signal_cellular_alt</span>
            <span className="text-emerald-400 font-bold uppercase tracking-wider">5G</span>
            <span className="material-symbols-outlined text-xs ml-1">battery_5_bar</span>
            <span>90%</span>
          </div>
        </header>

        {/* Screen Content Wrapper Viewport */}
        <main className="flex-grow overflow-y-auto overflow-x-hidden custom-scrollbar px-4 pt-3 pb-24 relative bg-slate-950">
          <AnimatePresence>
            {showSyncQueueModal && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="absolute inset-0 z-50 bg-slate-950/98 backdrop-blur-md p-4 flex flex-col justify-between"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-850 pb-3 mb-3 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-400 text-lg">cloud_sync</span>
                    <div>
                      <h3 className="font-bold text-white text-xs leading-none">Fila de Mudanças Pendentes</h3>
                      <span className="text-[9px] text-slate-400 font-mono mt-1 block">Log de Sincronização em Tempo Real</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSyncQueueModal(false)}
                    className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800/80 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>

                {/* Connection Status block */}
                <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3 mb-3 flex-shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status da Conexão</span>
                    <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      isOnline 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    {isOnline 
                      ? 'Seu aplicativo está conectado ao banco de dados Firestore. Modificações são salvas e sincronizadas instantaneamente.' 
                      : 'Você está offline. Alterações pendentes serão salvas com segurança no seu navegador e sincronizadas de forma automática assim que a internet voltar.'}
                  </p>
                </div>

                {/* Queue Summary Counter Grid */}
                <div className="grid grid-cols-3 gap-2 mb-3 flex-shrink-0">
                  <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-2.5 text-center">
                    <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Aguardando</p>
                    <p className="text-sm font-extrabold text-amber-400 font-mono mt-1">
                      {pendingChanges.filter(c => c.status === 'PENDING').length}
                    </p>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-2.5 text-center">
                    <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Sincronizados</p>
                    <p className="text-sm font-extrabold text-emerald-400 font-mono mt-1">
                      {pendingChanges.filter(c => c.status === 'SYNCED').length}
                    </p>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-2.5 text-center">
                    <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Erros/Falhas</p>
                    <p className="text-sm font-extrabold text-rose-500 font-mono mt-1">
                      {pendingChanges.filter(c => c.status === 'FAILED').length}
                    </p>
                  </div>
                </div>

                {/* Scrollable Queue List */}
                <div className="flex-grow overflow-y-auto custom-scrollbar space-y-2 mb-3 pr-1">
                  {pendingChanges.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 h-full">
                      <span className="material-symbols-outlined text-4xl text-slate-800 mb-2.5">cloud_queue</span>
                      <p className="text-xs font-semibold text-slate-400">Nenhuma mudança na fila</p>
                      <p className="text-[9px] text-slate-500 mt-1 max-w-[200px] leading-relaxed">
                        Faça alterações de lançamentos ou compromissos para ver a fila de sincronização monitorar as gravações.
                      </p>
                    </div>
                  ) : (
                    pendingChanges.map(change => {
                      let iconName = 'sync';
                      let iconColor = 'text-slate-400';
                      if (change.type.includes('Adição') || change.type.includes('Novo')) {
                        iconName = 'add_circle';
                        iconColor = 'text-emerald-400';
                      } else if (change.type.includes('Edição')) {
                        iconName = 'edit';
                        iconColor = 'text-sky-400';
                      } else if (change.type.includes('Remoção')) {
                        iconName = 'delete_forever';
                        iconColor = 'text-rose-400';
                      } else if (change.type.includes('Alteração')) {
                        iconName = 'toggle_on';
                        iconColor = 'text-amber-400';
                      }

                      return (
                        <div key={change.id} className="bg-slate-900/40 border border-slate-850 rounded-xl p-3 flex items-start gap-2.5 transition-all hover:bg-slate-900/80">
                          <div className={`w-7.5 h-7.5 rounded-lg bg-slate-950 flex items-center justify-center border border-slate-800 flex-shrink-0 ${iconColor}`}>
                            <span className="material-symbols-outlined text-base">{iconName}</span>
                          </div>
                          <div className="flex-grow min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[9px] font-bold text-slate-400 tracking-wide uppercase">{change.type}</span>
                              <span className="text-[8px] text-slate-500 font-mono flex-shrink-0">
                                {new Date(change.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-slate-200 mt-0.5 truncate">{change.title}</p>
                            
                            {change.error && (
                              <p className="text-[9px] text-rose-400 font-medium mt-1 bg-rose-500/5 border border-rose-500/10 rounded px-1.5 py-0.5">
                                {change.error}
                              </p>
                            )}

                            <div className="flex justify-end mt-1.5">
                              <span className={`flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                                change.status === 'SYNCED'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : change.status === 'SYNCING'
                                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 animate-pulse'
                                  : change.status === 'FAILED'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : 'bg-slate-850 text-slate-400 border border-slate-800'
                              }`}>
                                {change.status === 'SYNCING' && <span className="w-1 h-1 rounded-full bg-sky-400 animate-ping mr-0.5" />}
                                {change.status === 'SYNCED' && 'SINCRONIZADO'}
                                {change.status === 'SYNCING' && 'SINCRONIZANDO'}
                                {change.status === 'PENDING' && 'AGUARDANDO'}
                                {change.status === 'FAILED' && 'FALHOU'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer Controls */}
                <div className="flex gap-2 border-t border-slate-850 pt-3 flex-shrink-0">
                  <button
                    onClick={handleClearSyncHistory}
                    disabled={!pendingChanges.some(c => c.status === 'SYNCED')}
                    className="flex-grow py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 disabled:opacity-30 text-slate-300 disabled:cursor-not-allowed text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95"
                  >
                    Limpar Histórico
                  </button>
                  <button
                    onClick={handleRetryAllSync}
                    disabled={!isOnline || !pendingChanges.some(c => c.status === 'PENDING' || c.status === 'FAILED')}
                    className="flex-grow py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 disabled:border disabled:border-slate-800 text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/10 cursor-pointer active:scale-95 flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[13px] font-bold">sync</span>
                    Sincronizar Tudo
                  </button>
                </div>
              </motion.div>
            )}

            {activeNotification && (
              <motion.div
                initial={{ opacity: 0, y: -80, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ type: "spring", damping: 18, stiffness: 150 }}
                className="absolute top-2 left-3 right-3 z-50 bg-slate-900/95 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-3.5 shadow-2xl flex flex-col gap-2.5 shadow-emerald-500/5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-xs tracking-wider">
                      {activeNotification.banco.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{activeNotification.banco}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-600" />
                        <span className="text-[9px] text-slate-500 font-medium">Agora mesmo</span>
                      </div>
                      <p className="text-xs font-bold text-white mt-0.5 leading-snug">
                        {activeNotification.tipo === 'RECEITA' ? '📥 PIX Recebido' : '💸 PIX Enviado / Débito'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveNotification(null)}
                    className="text-slate-500 hover:text-slate-300 p-0.5 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>

                <div className="text-xs text-slate-300 leading-normal pl-1.5 border-l-2 border-emerald-500/30 bg-slate-950/20 py-1 px-2 rounded">
                  <span className="font-semibold text-white">{activeNotification.descricao}</span> no valor de{" "}
                  <span className="font-mono font-bold text-emerald-400">
                    R$ {activeNotification.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex gap-2.5 justify-end">
                  <button
                    onClick={() => setActiveNotification(null)}
                    className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-800 text-slate-450 hover:text-slate-200 text-[10px] font-bold rounded-lg transition-all active:scale-95 cursor-pointer uppercase tracking-wider"
                  >
                    Ignorar
                  </button>
                  <button
                    onClick={() => handleRecordSimulatedTransaction(activeNotification)}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-bold rounded-lg transition-all active:scale-95 shadow-md shadow-emerald-500/10 cursor-pointer uppercase tracking-wider flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[12px] font-bold">save</span>
                    Gravar no Aplicativo
                  </button>
                </div>
              </motion.div>
            )}

            {bankIntegrationNotification && (
              <motion.div
                initial={{ opacity: 0, y: -100, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -40, scale: 0.95 }}
                transition={{ type: "spring", damping: 20, stiffness: 180 }}
                className="absolute top-4 left-4 right-4 z-[9999] bg-[#2E3033] text-white rounded-[28px] p-5 shadow-2xl flex flex-col gap-3.5 border border-white/5"
                id="bank-integration-notification-banner"
              >
                {/* Notification Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Circle White App Icon with Chart Lines */}
                    <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-md shrink-0">
                      <div className="flex items-end gap-0.5 h-4 w-4 justify-center">
                        <div className="w-[3px] h-2.5 bg-[#F9A825] rounded-t-sm" />
                        <div className="w-[3px] h-3.5 bg-[#4CAF50] rounded-t-sm" />
                        <div className="w-[3px] h-4.5 bg-[#1976D2] rounded-t-sm" />
                      </div>
                    </div>
                    
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        <span className="text-[13px] font-sans font-normal text-slate-300">Minhas Finanças</span>
                        <span className="text-[13px] font-sans text-slate-400">•</span>
                        <span className="text-[13px] font-sans font-medium text-slate-200">{bankIntegrationNotification.bancoNome}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-slate-400 text-xs">
                    <span>Há pouco</span>
                    <span className="material-symbols-outlined text-sm font-semibold">expand_less</span>
                  </div>
                </div>

                {/* Notification Body */}
                <div className="px-1 space-y-1">
                  <h4 className="text-[15px] font-medium text-slate-50 font-sans tracking-wide">
                    Nova transação de R$ {bankIntegrationNotification.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </h4>
                  <p className="text-[13px] text-slate-300 font-sans">
                    Como você deseja importa-la?
                  </p>
                </div>

                {/* AI Category Suggestion display */}
                <div className="mx-1 mt-0.5 p-3 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex flex-col gap-1.5 shadow-inner">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-amber-400 text-base font-semibold animate-pulse">psychology</span>
                    <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wider font-sans">Sugestão de Categoria por IA</span>
                  </div>
                  {bankIntegrationNotification.isLoadingSuggestion ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-sans mt-0.5 pl-6">
                      <svg className="animate-spin h-3 w-3 text-amber-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Analisando seu histórico de transações...</span>
                    </div>
                  ) : bankIntegrationNotification.suggestedCategory ? (
                    <div className="space-y-1 pl-6">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                          {bankIntegrationNotification.suggestedCategory}
                        </span>
                        <span className="text-[11px] text-slate-400 font-sans">Recomendado</span>
                      </div>
                      {bankIntegrationNotification.suggestedJustification && (
                        <p className="text-[11px] text-slate-300 italic font-sans leading-relaxed">
                          "{bankIntegrationNotification.suggestedJustification}"
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 font-sans pl-6 mt-0.5">Sem dados anteriores para análise inteligente.</span>
                  )}
                </div>

                {/* Transfer Selection View */}
                {isSelectingTransferDest ? (
                  <div className="mt-1 space-y-3 bg-[#1E2022] p-3.5 rounded-2xl border border-white/5 animate-fade-in">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                        Selecione o Banco de Destino:
                      </label>
                      <select
                        value={selectedTransferDestId || ''}
                        onChange={(e) => setSelectedTransferDestId(Number(e.target.value))}
                        className="w-full bg-[#2E3033] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500 font-sans"
                      >
                        <option value="">-- Escolher Banco --</option>
                        {bankAccountsState
                          .filter(acc => acc.id !== bankIntegrationNotification.bancoId)
                          .map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.nome}</option>
                          ))
                        }
                      </select>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => {
                          setIsSelectingTransferDest(false);
                          setSelectedTransferDestId(null);
                        }}
                        className="px-3.5 py-1.5 bg-[#2E3033] hover:bg-slate-700 text-slate-300 font-semibold rounded-full text-xs transition-all cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          if (!selectedTransferDestId) {
                            showAlert("Selecione o Destino", "Escolha a conta que recebeu o Pix.");
                            return;
                          }
                          handleImportBankIntegration('TRANSFERENCIA', selectedTransferDestId);
                        }}
                        className="px-4 py-1.5 bg-amber-500 hover:bg-amber-450 text-slate-950 font-bold rounded-full text-xs transition-all cursor-pointer active:scale-95"
                      >
                        Confirmar
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Action Buttons Row styled exactly like the Android notification pills */
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleImportBankIntegration('RECEITA')}
                      className="flex-1 py-2 px-3 bg-[#3C3E44] hover:bg-[#4E5158] text-[#E3E3E3] font-medium rounded-full text-xs text-center transition-all cursor-pointer active:scale-95 shadow-sm border border-white/5"
                    >
                      Receita
                    </button>
                    <button
                      onClick={() => handleImportBankIntegration('DESPESA')}
                      className="flex-1 py-2 px-3 bg-[#3C3E44] hover:bg-[#4E5158] text-[#E3E3E3] font-medium rounded-full text-xs text-center transition-all cursor-pointer active:scale-95 shadow-sm border border-white/5"
                    >
                      Despesa
                    </button>
                    <button
                      onClick={() => {
                        const dests = bankAccountsState.filter(acc => acc.id !== bankIntegrationNotification.bancoId);
                        if (dests.length > 0) {
                          setSelectedTransferDestId(dests[0].id);
                        }
                        setIsSelectingTransferDest(true);
                      }}
                      className="flex-1 py-2 px-3 bg-[#3C3E44] hover:bg-[#4E5158] text-[#E3E3E3] font-medium rounded-full text-xs text-center transition-all cursor-pointer active:scale-95 shadow-sm border border-white/5"
                    >
                      Transferência
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="w-full"
            >
              {renderCurrentView()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Premium Bottom Navigation Tab Bar with active ripples */}
        <nav className="absolute bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/80 px-1 pt-1.5 pb-4 md:pb-2.5 grid grid-cols-5 gap-0.5 z-40 select-none">
          
          {/* Dashboard tab */}
          <button 
            onClick={() => {
              setIsMaisMenuOpen(false);
              handleTabNavigate('dashboard');
            }}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition-all cursor-pointer w-full ${
              currentTab === 'dashboard' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <span className={`material-symbols-outlined text-[20px] ${currentTab === 'dashboard' ? 'material-symbols-fill' : ''}`}>
              dashboard
            </span>
            <span className="text-[9px] font-bold tracking-tight text-center truncate w-full px-0.5">Painel</span>
          </button>

          {/* Transactions tab */}
          <button 
            onClick={() => {
              setIsMaisMenuOpen(false);
              handleTabNavigate('transactions');
            }}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition-all cursor-pointer relative w-full ${
              currentTab === 'transactions' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            {hasUrgentIpva && (
              <span className="absolute top-0.5 right-1 flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-600"></span>
              </span>
            )}
            {hasExpiringTransactions && !hasUrgentIpva && (
              <span className="absolute top-0.5 right-1 flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
              </span>
            )}
            <motion.span 
              animate={(hasExpiringTransactions || hasUrgentIpva) ? {
                scale: [1, 1.15, 1],
                filter: hasUrgentIpva 
                  ? ['drop-shadow(0 0 2px rgba(244,63,94,0.2))', 'drop-shadow(0 0 8px rgba(244,63,94,0.6))', 'drop-shadow(0 0 2px rgba(244,63,94,0.2))']
                  : ['drop-shadow(0 0 2px rgba(251,113,133,0.2))', 'drop-shadow(0 0 8px rgba(251,113,133,0.5))', 'drop-shadow(0 0 2px rgba(251,113,133,0.2))'],
              } : {}}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className={`material-symbols-outlined text-[20px] ${
                hasUrgentIpva ? 'text-rose-500 font-bold material-symbols-fill' : 
                (currentTab === 'transactions' ? 'material-symbols-fill' : '')
              } ${hasExpiringTransactions && !hasUrgentIpva ? 'text-rose-400 font-bold' : ''}`}
            >
              {hasUrgentIpva ? 'warning' : 'receipt_long'}
            </motion.span>
            <span className={`text-[9px] font-bold tracking-tight text-center truncate w-full px-0.5 ${
              hasUrgentIpva ? 'text-rose-500' : (hasExpiringTransactions ? 'text-rose-400' : '')
            }`}>Finanças</span>
          </button>

          {/* Car Services Tab */}
          <button 
            onClick={() => {
              setIsMaisMenuOpen(false);
              handleTabNavigate('carservices');
            }}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition-all cursor-pointer relative w-full ${
              currentTab === 'carservices' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            {hasOverdueServices && (
              <span className="absolute top-0.5 right-1 flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
              </span>
            )}
            <motion.span 
              animate={hasOverdueServices ? {
                scale: [1, 1.15, 1],
                filter: ['drop-shadow(0 0 2px rgba(251,191,36,0.2))', 'drop-shadow(0 0 8px rgba(251,191,36,0.6))', 'drop-shadow(0 0 2px rgba(251,191,36,0.2))']
              } : {}}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className={`material-symbols-outlined text-[20px] ${currentTab === 'carservices' ? 'material-symbols-fill text-amber-400 font-bold' : ''} ${hasOverdueServices ? 'text-amber-400 font-bold' : ''}`}
            >
              build_circle
            </motion.span>
            <span className={`text-[9px] font-bold tracking-tight text-center truncate w-full px-0.5 ${hasOverdueServices ? 'text-amber-400' : ''}`}>Oficina</span>
          </button>

          {/* Calendar tab (Agenda) */}
          {(() => {
            const activeComp = compromissos.find(c => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              let year = 0, month = 0, day = 0;
              const cleanStr = (c.data || '').trim();
              if (cleanStr.includes('-')) {
                const parts = cleanStr.split('-');
                if (parts.length === 3) {
                  if (parts[0].length === 4) {
                    year = parseInt(parts[0], 10);
                    month = parseInt(parts[1], 10) - 1;
                    day = parseInt(parts[2], 10);
                  } else {
                    day = parseInt(parts[0], 10);
                    month = parseInt(parts[1], 10) - 1;
                    year = parseInt(parts[2], 10);
                  }
                }
              } else if (cleanStr.includes('/')) {
                const parts = cleanStr.split('/');
                if (parts.length === 3) {
                  if (parts[2].length === 4) {
                    day = parseInt(parts[0], 10);
                    month = parseInt(parts[1], 10) - 1;
                    year = parseInt(parts[2], 10);
                  } else if (parts[0].length === 4) {
                    year = parseInt(parts[0], 10);
                    month = parseInt(parts[1], 10) - 1;
                    day = parseInt(parts[2], 10);
                  }
                }
              }

              if (!year || isNaN(year) || isNaN(month) || isNaN(day)) {
                const d = new Date(cleanStr);
                if (!isNaN(d.getTime())) {
                  year = d.getFullYear();
                  month = d.getMonth();
                  day = d.getDate();
                } else {
                  return false;
                }
              }

              const compDate = new Date(year, month, day);
              compDate.setHours(0, 0, 0, 0);
              const diff = Math.ceil((compDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              return diff >= 0 && diff <= (c.diasAntecedencia ?? 2);
            });
            const compColor = activeComp?.cor || '#22c55e';
            const hasActiveComp = !!activeComp;

            return (
              <button 
                onClick={() => {
                  setIsMaisMenuOpen(false);
                  handleTabNavigate('compromissos');
                }}
                className={`flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition-all cursor-pointer relative w-full ${
                  currentTab === 'compromissos' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {hasActiveComp && (
                  <span className="absolute top-0.5 right-1 flex h-1.5 w-1.5">
                    <span 
                      className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                      style={{ backgroundColor: compColor }}
                    ></span>
                    <span 
                      className="relative inline-flex rounded-full h-1.5 w-1.5"
                      style={{ backgroundColor: compColor }}
                    ></span>
                  </span>
                )}
                <motion.span 
                  animate={hasActiveComp ? {
                    scale: [1, 1.15, 1],
                    opacity: [0.85, 1, 0.85]
                  } : {}}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className={`material-symbols-outlined text-[20px] ${currentTab === 'compromissos' ? 'material-symbols-fill' : ''}`}
                  style={hasActiveComp ? { color: compColor } : {}}
                >
                  calendar_month
                </motion.span>
                <span 
                  className="text-[9px] font-bold tracking-tight text-center truncate w-full px-0.5"
                  style={hasActiveComp ? { color: compColor } : {}}
                >
                  Agenda
                </span>
              </button>
            );
          })()}

          {/* Mais Tab instead of many options */}
          <button 
            onClick={() => setIsMaisMenuOpen(prev => !prev)}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition-all cursor-pointer relative w-full ${
              isMaisMenuOpen || ['analysis', 'risk', 'medical', 'profile'].includes(currentTab) ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            {hasActiveAppointments && (
              <span className="absolute top-0.5 right-1 flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
              </span>
            )}
            <span className={`material-symbols-outlined text-[20px] ${isMaisMenuOpen || ['analysis', 'risk', 'medical', 'profile'].includes(currentTab) ? 'material-symbols-fill text-emerald-400 font-bold' : ''}`}>
              more_horiz
            </span>
            <span className="text-[9px] font-bold tracking-tight text-center truncate w-full px-0.5">Mais</span>
          </button>

        </nav>

        {/* Premium Drawer for "Mais" options */}
        <AnimatePresence>
          {isMaisMenuOpen && (
            <div className="absolute inset-0 z-50 flex items-end justify-center select-none">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMaisMenuOpen(false)}
                className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
              />
              
              {/* Slide-up Menu Panel */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 220 }}
                className="bg-slate-900 border-t border-slate-800 rounded-t-[32px] w-full max-w-md p-6 pb-8 shadow-2xl relative z-10 flex flex-col"
              >
                <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto mb-5 pointer-events-none" />
                
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 font-mono px-1">
                  Outros Módulos
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Analysis tab */}
                  <button
                    onClick={() => {
                      handleTabNavigate('analysis');
                      setIsMaisMenuOpen(false);
                    }}
                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all cursor-pointer ${
                      currentTab === 'analysis' 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-md shadow-emerald-500/5' 
                        : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-100 hover:border-slate-800'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[28px]">query_stats</span>
                    <span className="text-xs font-bold font-sans">Análise</span>
                  </button>

                  {/* Risk Zones tab */}
                  <button
                    onClick={() => {
                      handleTabNavigate('risk');
                      setIsMaisMenuOpen(false);
                    }}
                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all cursor-pointer ${
                      currentTab === 'risk' 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-md shadow-emerald-500/5' 
                        : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-100 hover:border-slate-800'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[28px]">gpp_maybe</span>
                    <span className="text-xs font-bold font-sans">Zonas de Risco</span>
                  </button>

                  {/* Medical Consultations tab */}
                  <button
                    onClick={() => {
                      handleTabNavigate('medical');
                      setIsMaisMenuOpen(false);
                    }}
                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all cursor-pointer relative ${
                      currentTab === 'medical' 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-md shadow-emerald-500/5' 
                        : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-100 hover:border-slate-800'
                    }`}
                  >
                    {hasActiveAppointments && (
                      <span className="absolute top-3 right-3 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                    )}
                    <span className="material-symbols-outlined text-[28px]">medical_services</span>
                    <span className="text-xs font-bold font-sans">Consultas</span>
                  </button>

                  {/* Profile settings tab */}
                  <button
                    onClick={() => {
                      handleTabNavigate('profile');
                      setIsMaisMenuOpen(false);
                    }}
                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all cursor-pointer ${
                      currentTab === 'profile' 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-md shadow-emerald-500/5' 
                        : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-100 hover:border-slate-800'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[28px]">person</span>
                    <span className="text-xs font-bold font-sans">Perfil</span>
                  </button>
                </div>

                <button
                  onClick={() => setIsMaisMenuOpen(false)}
                  className="mt-6 w-full bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-3 rounded-xl transition-all cursor-pointer text-xs uppercase tracking-wider"
                >
                  Fechar
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Home indicator bar simulator */}
        <div className="hidden md:block absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 bg-slate-800 rounded-full pointer-events-none z-50" />

      </div>

      {/* Custom Iframe-safe Modal Overlay */}
      <AnimatePresence>
        {dialog.isOpen && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[9999] select-none">
            {/* Backdrop blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!dialog.isConfirm) {
                  setDialog(prev => ({ ...prev, isOpen: false }));
                }
              }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            
            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="bg-slate-900 border border-slate-800/80 rounded-2xl max-w-sm w-full p-5 shadow-2xl relative z-10 flex flex-col items-center text-center overflow-hidden"
            >
              {/* Top Warning/Info Glow Icon */}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                dialog.title.includes('⚠️') || dialog.title.toUpperCase().includes('ATENÇÃO') || dialog.title.toUpperCase().includes('REMOVER') || dialog.title.toUpperCase().includes('ERRO')
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                <span className="material-symbols-outlined text-2xl font-bold">
                  {dialog.title.includes('⚠️') || dialog.title.toUpperCase().includes('ATENÇÃO') || dialog.title.toUpperCase().includes('REMOVER') || dialog.title.toUpperCase().includes('ERRO')
                    ? 'warning' 
                    : 'info'
                  }
                </span>
              </div>

              {/* Title */}
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-100 mb-2 font-display">
                {dialog.title}
              </h3>

              {/* Message */}
              <p className="text-xs text-slate-400 leading-relaxed mb-4 font-mono">
                {dialog.message}
              </p>

              {/* Required confirmation input */}
              {dialog.requireInputText && (
                <div className="w-full text-left mb-5 space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Confirme digitando <span className="text-amber-400 font-bold select-all">"{dialog.requireInputText}"</span> abaixo:
                  </label>
                  <input
                    type="text"
                    value={modalInputVal}
                    onChange={(e) => setModalInputVal(e.target.value)}
                    placeholder={dialog.requireInputText}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-all"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 w-full">
                {dialog.isConfirm ? (
                  <>
                    <button
                      onClick={() => {
                        setDialog(prev => ({ ...prev, isOpen: false }));
                      }}
                      className="flex-1 bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-750 font-bold text-xs py-2.5 rounded-xl cursor-pointer transition-all active:scale-95"
                    >
                      {dialog.cancelText || 'Cancelar'}
                    </button>
                    <button
                      disabled={dialog.requireInputText ? modalInputVal.trim().toLowerCase() !== dialog.requireInputText.trim().toLowerCase() : false}
                      onClick={() => {
                        setDialog(prev => ({ ...prev, isOpen: false }));
                        dialog.onConfirm?.();
                      }}
                      className={`flex-1 font-bold text-xs py-2.5 rounded-xl cursor-pointer transition-all active:scale-95 shadow-md ${
                        dialog.requireInputText && modalInputVal.trim().toLowerCase() !== dialog.requireInputText.trim().toLowerCase()
                          ? 'bg-slate-800 text-slate-500 border border-slate-850 cursor-not-allowed opacity-50'
                          : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/10'
                      }`}
                    >
                      {dialog.confirmText || 'Confirmar'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setDialog(prev => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs py-2.5 rounded-xl cursor-pointer transition-all active:scale-95 shadow-md"
                  >
                    OK
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
