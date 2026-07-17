import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  getDoc 
} from 'firebase/firestore';
import { db } from './firebase';
import { Transaction, RiskZone, Infraction, MedicalAppointment, MedicalPrescription, RegisteredVehicle, Compromisso, SecurityConfig, CarServicePerformed, CarServiceScheduled } from '../types';
import { initialTransactions } from '../data/transactions';
import { initialRiskZones } from '../data/riskZones';
import { initialInfractions, nonAppealedInfractions } from '../data/infractions';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  const errStr = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errStr);
  throw new Error(errStr);
}

function isPermissionError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('permission') || msg.includes('insufficient');
  }
  const str = String(error).toLowerCase();
  return str.includes('permission') || str.includes('insufficient');
}

function cleanUndefined(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  const cleaned: any = Array.isArray(obj) ? [] : {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      if (val !== undefined) {
        cleaned[key] = cleanUndefined(val);
      }
    }
  }
  return cleaned;
}

export async function getTransactionsFromDb(): Promise<Transaction[]> {
  try {
    const colRef = collection(db, 'transactions');
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) {
      const seedRef = doc(db, 'settings', 'seed');
      const seedSnap = await getDoc(seedRef);
      if (seedSnap.exists() && seedSnap.data().transactions) {
        return [];
      }

      // If Firestore is empty and not yet seeded, we seed it with initial transactions
      const promises = initialTransactions.map(tx => 
        setDoc(doc(db, 'transactions', String(tx.id)), cleanUndefined(tx))
      );
      await Promise.all(promises);
      await setDoc(seedRef, { transactions: true }, { merge: true });
      return initialTransactions;
    }
    const list: Transaction[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as Transaction);
    });
    // Sort transactions by id descending or data descending (newest first)
    return list.sort((a, b) => b.id - a.id);
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.GET, 'transactions');
    }
    console.error('Error fetching transactions from Firestore:', error);
    // Fallback to local storage
    const saved = localStorage.getItem('wealthflow_transactions');
    return saved ? JSON.parse(saved) : initialTransactions;
  }
}

export async function saveTransactionToDb(tx: Transaction): Promise<void> {
  try {
    await setDoc(doc(db, 'transactions', String(tx.id)), cleanUndefined(tx));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.WRITE, `transactions/${tx.id}`);
    }
    console.error('Error saving transaction to Firestore:', error);
  }
}

export async function deleteTransactionFromDb(id: number): Promise<void> {
  try {
    await deleteDoc(doc(db, 'transactions', String(id)));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
    }
    console.error('Error deleting transaction from Firestore:', error);
  }
}

export async function getSyncTimestampFromDb(): Promise<number> {
  try {
    const docRef = doc(db, 'settings', 'sync');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().lastSyncedTimestamp || 0;
    }
  } catch (error) {
    console.error('Error fetching sync timestamp from Firestore:', error);
  }
  return 0;
}

export async function saveSyncTimestampToDb(timestamp: number): Promise<void> {
  try {
    const docRef = doc(db, 'settings', 'sync');
    await setDoc(docRef, { lastSyncedTimestamp: timestamp }, { merge: true });
  } catch (error) {
    console.error('Error saving sync timestamp to Firestore:', error);
  }
}

export async function getRiskZonesFromDb(): Promise<RiskZone[]> {
  try {
    const colRef = collection(db, 'risk_zones');
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) {
      const seedRef = doc(db, 'settings', 'seed');
      const seedSnap = await getDoc(seedRef);
      if (seedSnap.exists() && seedSnap.data().risk_zones) {
        return [];
      }

      // Seed with initial risk zones
      const promises = initialRiskZones.map(zone => 
        setDoc(doc(db, 'risk_zones', String(zone.id)), cleanUndefined(zone))
      );
      await Promise.all(promises);
      await setDoc(seedRef, { risk_zones: true }, { merge: true });
      return initialRiskZones;
    }
    const list: RiskZone[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as RiskZone);
    });
    return list.sort((a, b) => b.id - a.id);
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.GET, 'risk_zones');
    }
    console.error('Error fetching risk zones from Firestore:', error);
    const saved = localStorage.getItem('wealthflow_riskzones');
    return saved ? JSON.parse(saved) : initialRiskZones;
  }
}

export async function saveRiskZoneToDb(zone: RiskZone): Promise<void> {
  try {
    await setDoc(doc(db, 'risk_zones', String(zone.id)), cleanUndefined(zone));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.WRITE, `risk_zones/${zone.id}`);
    }
    console.error('Error saving risk zone to Firestore:', error);
  }
}

export async function deleteRiskZoneFromDb(id: number): Promise<void> {
  try {
    await deleteDoc(doc(db, 'risk_zones', String(id)));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.DELETE, `risk_zones/${id}`);
    }
    console.error('Error deleting risk zone from Firestore:', error);
  }
}

export async function getInfractionsFromDb(): Promise<Infraction[]> {
  try {
    const colRef = collection(db, 'infractions');
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) {
      const seedRef = doc(db, 'settings', 'seed');
      const seedSnap = await getDoc(seedRef);
      if (seedSnap.exists() && seedSnap.data().infractions) {
        return [];
      }

      // Seed initial infractions
      const promises = initialInfractions.map(inf => 
        setDoc(doc(db, 'infractions', inf.id), cleanUndefined(inf))
      );
      await Promise.all(promises);
      await setDoc(seedRef, { infractions: true }, { merge: true });
      return initialInfractions;
    }
    const list: Infraction[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as Infraction);
    });
    return list.sort((a, b) => Number(b.id) - Number(a.id));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.GET, 'infractions');
    }
    console.error('Error fetching infractions from Firestore:', error);
    const saved = localStorage.getItem('wealthflow_infractions');
    return saved ? JSON.parse(saved) : initialInfractions;
  }
}

export async function saveInfractionToDb(inf: Infraction): Promise<void> {
  try {
    await setDoc(doc(db, 'infractions', inf.id), cleanUndefined(inf));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.WRITE, `infractions/${inf.id}`);
    }
    console.error('Error saving infraction to Firestore:', error);
  }
}

export async function deleteInfractionFromDb(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'infractions', id));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.DELETE, `infractions/${id}`);
    }
    console.error('Error deleting infraction from Firestore:', error);
  }
}

export async function getNonAppealedFromDb(): Promise<any[]> {
  try {
    const colRef = collection(db, 'non_appealed');
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) {
      const seedRef = doc(db, 'settings', 'seed');
      const seedSnap = await getDoc(seedRef);
      if (seedSnap.exists() && seedSnap.data().non_appealed) {
        return [];
      }

      // Seed non-appealed infractions
      const promises = nonAppealedInfractions.map(item => 
        setDoc(doc(db, 'non_appealed', item.id), cleanUndefined(item))
      );
      await Promise.all(promises);
      await setDoc(seedRef, { non_appealed: true }, { merge: true });
      return nonAppealedInfractions;
    }
    const list: any[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data());
    });
    return list.sort((a, b) => a.id.localeCompare(b.id));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.GET, 'non_appealed');
    }
    console.error('Error fetching non-appealed infractions from Firestore:', error);
    const saved = localStorage.getItem('wealthflow_nonappealed');
    return saved ? JSON.parse(saved) : nonAppealedInfractions;
  }
}

export async function saveNonAppealedToDb(item: any): Promise<void> {
  try {
    await setDoc(doc(db, 'non_appealed', item.id), cleanUndefined(item));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.WRITE, `non_appealed/${item.id}`);
    }
    console.error('Error saving non-appealed infraction to Firestore:', error);
  }
}

export async function deleteNonAppealedFromDb(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'non_appealed', id));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.DELETE, `non_appealed/${id}`);
    }
    console.error('Error deleting non-appealed infraction from Firestore:', error);
  }
}

export async function getAvatarUrlFromDb(): Promise<string> {
  const defaultUrl = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDclcawui2tKuHgw4p_DWvKBp0R7XYoJIo41kp-qWXzNhTbDso-7IAoirqhYyc-HEWXFiHIGP6YdyvyG4u4xgKT0ecq0uBLAJEXGIxgaymfedUvUw5PmlAfsh600Je_GbTdL8UgPj2BZ18ovSoiV_-08bm1CxxuR-RaAO569na_pVi2ObUv5FfHdqk1JhAf68RSSZF5WqsPDCCmYfWunTzLuQcRHOJn29EvtKwGGBucDh8ZAdyadLyd';
  try {
    const docRef = doc(db, 'settings', 'profile');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().avatarUrl || defaultUrl;
    }
    return defaultUrl;
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.GET, 'settings/profile');
    }
    console.error('Error fetching avatar URL from Firestore:', error);
    return localStorage.getItem('wealthflow_avatarurl') || defaultUrl;
  }
}

export async function saveAvatarUrlToDb(url: string): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'profile'), { avatarUrl: url }, { merge: true });
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/profile');
    }
    console.error('Error saving avatar URL to Firestore:', error);
  }
}

export async function getCustomCategoriesFromDb(): Promise<string[]> {
  try {
    const docRef = doc(db, 'settings', 'categories');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().categories || [];
    }
    return [];
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.GET, 'settings/categories');
    }
    console.error('Error fetching custom categories from Firestore:', error);
    const saved = localStorage.getItem('wealthflow_custom_categories');
    return saved ? JSON.parse(saved) : [];
  }
}

export async function saveCustomCategoriesToDb(categories: string[]): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'categories'), { categories }, { merge: true });
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/categories');
    }
    console.error('Error saving custom categories to Firestore:', error);
  }
}

export async function getSecurityConfigFromDb(): Promise<SecurityConfig | null> {
  try {
    const docRef = doc(db, 'settings', 'security');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as SecurityConfig;
    }
    return null;
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.GET, 'settings/security');
    }
    console.error('Error fetching security config from Firestore:', error);
    return null;
  }
}

export async function saveSecurityConfigToDb(config: SecurityConfig): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'security'), config, { merge: true });
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/security');
    }
    console.error('Error saving security config to Firestore:', error);
  }
}

export async function getMedicalAppointmentsFromDb(): Promise<MedicalAppointment[]> {
  try {
    const colRef = collection(db, 'medical_appointments');
    const snapshot = await getDocs(colRef);
    const list: MedicalAppointment[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as MedicalAppointment);
    });
    // Sort by date and time chronological
    return list.sort((a, b) => {
      const dateTimeA = `${a.data}T${a.hora}`;
      const dateTimeB = `${b.data}T${b.hora}`;
      return dateTimeA.localeCompare(dateTimeB);
    });
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.GET, 'medical_appointments');
    }
    console.error('Error fetching medical appointments from Firestore:', error);
    const saved = localStorage.getItem('wealthflow_appointments');
    return saved ? JSON.parse(saved) : [];
  }
}

export async function saveMedicalAppointmentToDb(appointment: MedicalAppointment): Promise<void> {
  try {
    await setDoc(doc(db, 'medical_appointments', appointment.id), cleanUndefined(appointment));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.WRITE, `medical_appointments/${appointment.id}`);
    }
    console.error('Error saving medical appointment to Firestore:', error);
    throw error;
  }
}

export async function deleteMedicalAppointmentFromDb(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'medical_appointments', id));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.DELETE, `medical_appointments/${id}`);
    }
    console.error('Error deleting medical appointment from Firestore:', error);
  }
}

export async function getMedicalPrescriptionsFromDb(): Promise<MedicalPrescription[]> {
  try {
    const colRef = collection(db, 'medical_prescriptions');
    const snapshot = await getDocs(colRef);
    const list: MedicalPrescription[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as MedicalPrescription);
    });
    // Sort by date descending (most recent first)
    return list.sort((a, b) => b.data.localeCompare(a.data));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.GET, 'medical_prescriptions');
    }
    console.error('Error fetching medical prescriptions from Firestore:', error);
    const saved = localStorage.getItem('wealthflow_prescriptions');
    return saved ? JSON.parse(saved) : [];
  }
}

export async function saveMedicalPrescriptionToDb(prescription: MedicalPrescription): Promise<void> {
  try {
    await setDoc(doc(db, 'medical_prescriptions', prescription.id), cleanUndefined(prescription));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.WRITE, `medical_prescriptions/${prescription.id}`);
    }
    console.error('Error saving medical prescription to Firestore:', error);
    throw error;
  }
}

export async function deleteMedicalPrescriptionFromDb(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'medical_prescriptions', id));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.DELETE, `medical_prescriptions/${id}`);
    }
    console.error('Error deleting medical prescription to Firestore:', error);
  }
}

// REGISTERED VEHICLES DB STORAGE (Cadastro de Carros e Motoristas)
export async function getRegisteredVehiclesFromDb(): Promise<RegisteredVehicle[]> {
  try {
    const colRef = collection(db, 'registered_vehicles');
    const snapshot = await getDocs(colRef);
    const list: RegisteredVehicle[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as RegisteredVehicle);
    });
    return list.sort((a, b) => a.descricao.localeCompare(b.descricao));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.GET, 'registered_vehicles');
    }
    console.error('Error fetching registered vehicles from Firestore:', error);
    const saved = localStorage.getItem('wealthflow_registered_vehicles');
    return saved ? JSON.parse(saved) : [];
  }
}

export async function saveRegisteredVehicleToDb(vehicle: RegisteredVehicle): Promise<void> {
  try {
    await setDoc(doc(db, 'registered_vehicles', vehicle.id), cleanUndefined(vehicle));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.WRITE, `registered_vehicles/${vehicle.id}`);
    }
    console.error('Error saving registered vehicle to Firestore:', error);
    throw error;
  }
}

export async function deleteRegisteredVehicleFromDb(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'registered_vehicles', id));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.DELETE, `registered_vehicles/${id}`);
    }
    console.error('Error deleting registered vehicle from Firestore:', error);
  }
}

// COMPROMISSOS DB STORAGE (Calendário de Compromissos)
export async function getCompromissosFromDb(): Promise<Compromisso[]> {
  try {
    const colRef = collection(db, 'compromissos');
    const snapshot = await getDocs(colRef);
    const list: Compromisso[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as Compromisso);
    });
    return list.sort((a, b) => a.data.localeCompare(b.data) || (a.hora || '').localeCompare(b.hora || ''));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.GET, 'compromissos');
    }
    console.error('Error fetching compromissos from Firestore:', error);
    const saved = localStorage.getItem('wealthflow_compromissos');
    return saved ? JSON.parse(saved) : [];
  }
}

export async function saveCompromissoToDb(compromisso: Compromisso): Promise<void> {
  try {
    await setDoc(doc(db, 'compromissos', compromisso.id), cleanUndefined(compromisso));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.WRITE, `compromissos/${compromisso.id}`);
    }
    console.error('Error saving compromisso to Firestore:', error);
    throw error;
  }
}

export async function deleteCompromissoFromDb(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'compromissos', id));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.DELETE, `compromissos/${id}`);
    }
    console.error('Error deleting compromisso from Firestore:', error);
  }
}

// CAR SERVICES PERFORMED STORAGE
export async function getPerformedServicesFromDb(): Promise<CarServicePerformed[]> {
  try {
    const colRef = collection(db, 'car_services_performed');
    const snapshot = await getDocs(colRef);
    const list: CarServicePerformed[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as CarServicePerformed);
    });
    return list.sort((a, b) => b.data.localeCompare(a.data));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.GET, 'car_services_performed');
    }
    console.error('Error fetching performed services from Firestore:', error);
    const saved = localStorage.getItem('wealthflow_car_services_performed');
    return saved ? JSON.parse(saved) : [];
  }
}

export async function savePerformedServiceToDb(service: CarServicePerformed): Promise<void> {
  try {
    await setDoc(doc(db, 'car_services_performed', service.id), cleanUndefined(service));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.WRITE, `car_services_performed/${service.id}`);
    }
    console.error('Error saving performed service to Firestore:', error);
    throw error;
  }
}

export async function deletePerformedServiceFromDb(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'car_services_performed', id));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.DELETE, `car_services_performed/${id}`);
    }
    console.error('Error deleting performed service from Firestore:', error);
  }
}

// CAR SERVICES SCHEDULED STORAGE
export async function getScheduledServicesFromDb(): Promise<CarServiceScheduled[]> {
  try {
    const colRef = collection(db, 'car_services_scheduled');
    const snapshot = await getDocs(colRef);
    const list: CarServiceScheduled[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as CarServiceScheduled);
    });
    return list.sort((a, b) => (a.dataAlvo || '').localeCompare(b.dataAlvo || ''));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.GET, 'car_services_scheduled');
    }
    console.error('Error fetching scheduled services from Firestore:', error);
    const saved = localStorage.getItem('wealthflow_car_services_scheduled');
    return saved ? JSON.parse(saved) : [];
  }
}

export async function saveScheduledServiceToDb(service: CarServiceScheduled): Promise<void> {
  try {
    await setDoc(doc(db, 'car_services_scheduled', service.id), cleanUndefined(service));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.WRITE, `car_services_scheduled/${service.id}`);
    }
    console.error('Error saving scheduled service to Firestore:', error);
    throw error;
  }
}

export async function deleteScheduledServiceFromDb(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'car_services_scheduled', id));
  } catch (error) {
    if (isPermissionError(error)) {
      handleFirestoreError(error, OperationType.DELETE, `car_services_scheduled/${id}`);
    }
    console.error('Error deleting scheduled service from Firestore:', error);
  }
}




