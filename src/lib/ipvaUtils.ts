import { RegisteredVehicle } from '../types';

export interface IpvaMonthInfo {
  month: number; // 1-12
  name: string;
}

const MONTH_MAP: { [key: number]: IpvaMonthInfo } = {
  1: { month: 1, name: 'Janeiro' },
  2: { month: 2, name: 'Fevereiro' },
  3: { month: 3, name: 'Março' },
  4: { month: 4, name: 'Abril' },
  5: { month: 5, name: 'Maio' },
  6: { month: 6, name: 'Junho' },
  7: { month: 7, name: 'Julho' },
  8: { month: 8, name: 'Agosto' },
  9: { month: 9, name: 'Setembro' },
  0: { month: 10, name: 'Outubro' }
};

export function getIpvaClosingDay(): number {
  try {
    const saved = localStorage.getItem('wealthflow_ipva_closing_day');
    if (saved) {
      const day = parseInt(saved, 10);
      if (day >= 1 && day <= 31) {
        return day;
      }
    }
  } catch {
    // fallback
  }
  return 15; // default 15
}

function getSafeDay(year: number, monthZeroBased: number, targetDay: number): number {
  const maxDays = new Date(year, monthZeroBased + 1, 0).getDate();
  return Math.min(targetDay, maxDays);
}

export function getPlacaFinalDigit(placa: string | undefined): number | null {
  if (!placa) return null;
  const digits = placa.replace(/\D/g, '');
  if (digits.length === 0) return null;
  return parseInt(digits[digits.length - 1], 10);
}

export function getIpvaDueMonth(finalDigit: number): IpvaMonthInfo | null {
  return MONTH_MAP[finalDigit] || null;
}

export function getNextIpvaDueDate(placa: string | undefined, today: Date = new Date()): Date | null {
  if (!placa) return null;
  const digit = getPlacaFinalDigit(placa);
  if (digit === null) return null;
  
  const monthInfo = getIpvaDueMonth(digit);
  if (!monthInfo) return null;
  
  // Set default due day using custom closing day
  const closingDay = getIpvaClosingDay();
  const currentYear = today.getFullYear();
  const dueDayThisYear = getSafeDay(currentYear, monthInfo.month - 1, closingDay);
  const dueDateThisYear = new Date(currentYear, monthInfo.month - 1, dueDayThisYear, 23, 59, 59);
  
  if (dueDateThisYear.getTime() >= today.getTime()) {
    return dueDateThisYear;
  } else {
    // Already passed this year, next due date is next year
    const dueDayNextYear = getSafeDay(currentYear + 1, monthInfo.month - 1, closingDay);
    return new Date(currentYear + 1, monthInfo.month - 1, dueDayNextYear, 23, 59, 59);
  }
}

export function getDaysUntilIpva(placa: string | undefined, today: Date = new Date()): number | null {
  const nextDueDate = getNextIpvaDueDate(placa, today);
  if (!nextDueDate) return null;
  
  const diffTime = nextDueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Vehicle specific calculation functions
export function getVehicleIpvaMonth(v: RegisteredVehicle): IpvaMonthInfo | null {
  // Check custom recurrent day first, but compute it without calling getVehicleNextIpvaDueDate to avoid recursion
  try {
    const savedRecurrent = localStorage.getItem('wealthflow_vehicle_ipva_recurrent_days');
    if (savedRecurrent) {
      const parsed = JSON.parse(savedRecurrent);
      const customDay = parsed[v.id];
      if (customDay !== undefined && customDay !== null) {
        const dayNum = parseInt(customDay, 10);
        if (dayNum >= 1 && dayNum <= 31) {
          const today = new Date();
          const currentYear = today.getFullYear();
          const currentMonth = today.getMonth(); // 0-indexed
          
          const maxDays = new Date(currentYear, currentMonth + 1, 0).getDate();
          const safeDayThisMonth = Math.min(dayNum, maxDays);
          const dueDateThisMonth = new Date(currentYear, currentMonth, safeDayThisMonth, 23, 59, 59);
          
          let monthIndex = currentMonth;
          if (dueDateThisMonth.getTime() < today.getTime()) {
            monthIndex = (currentMonth + 1) % 12;
          }
          
          const monthNames = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
          ];
          return {
            month: monthIndex + 1,
            name: monthNames[monthIndex]
          };
        }
      }
    }
  } catch (err) {
    console.error("Error calculating vehicle IPVA month for custom recurrent day:", err);
  }

  // Check custom date first
  try {
    const savedCustom = localStorage.getItem('wealthflow_custom_ipva_dates');
    if (savedCustom && v.placa) {
      const parsed = JSON.parse(savedCustom);
      const customDateStr = parsed[v.placa.toUpperCase().trim()];
      if (customDateStr) {
        const customDate = new Date(customDateStr);
        if (!isNaN(customDate.getTime())) {
          const monthIndex = customDate.getMonth(); // 0-11
          const monthNames = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
          ];
          return {
            month: monthIndex + 1,
            name: monthNames[monthIndex]
          };
        }
      }
    }
  } catch (err) {
    console.error("Error reading custom IPVA month:", err);
  }

  if (v.mesFinalPlaca !== undefined && v.mesFinalPlaca !== null && v.mesFinalPlaca >= 1 && v.mesFinalPlaca <= 12) {
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return {
      month: v.mesFinalPlaca,
      name: monthNames[v.mesFinalPlaca - 1]
    };
  }
  
  if (!v.placa) return null;
  const digit = getPlacaFinalDigit(v.placa);
  if (digit === null) return null;
  return getIpvaDueMonth(digit);
}

export function getVehicleNextIpvaDueDate(v: RegisteredVehicle, today: Date = new Date()): Date | null {
  // Check custom recurrent day first
  try {
    const savedRecurrent = localStorage.getItem('wealthflow_vehicle_ipva_recurrent_days');
    if (savedRecurrent) {
      const parsed = JSON.parse(savedRecurrent);
      const customDay = parsed[v.id];
      if (customDay !== undefined && customDay !== null) {
        const dayNum = parseInt(customDay, 10);
        if (dayNum >= 1 && dayNum <= 31) {
          const currentYear = today.getFullYear();
          const currentMonth = today.getMonth(); // 0-indexed
          
          // Get safe day for current month
          const safeDayThisMonth = getSafeDay(currentYear, currentMonth, dayNum);
          const dueDateThisMonth = new Date(currentYear, currentMonth, safeDayThisMonth, 23, 59, 59);
          
          if (dueDateThisMonth.getTime() >= today.getTime()) {
            return dueDateThisMonth;
          } else {
            // Next month
            const nextMonth = (currentMonth + 1) % 12;
            const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
            const safeDayNextMonth = getSafeDay(nextMonthYear, nextMonth, dayNum);
            return new Date(nextMonthYear, nextMonth, safeDayNextMonth, 23, 59, 59);
          }
        }
      }
    }
  } catch (err) {
    console.error("Error parsing custom recurrent IPVA day:", err);
  }

  // Check if there is a custom IPVA due date in localStorage
  try {
    const savedCustom = localStorage.getItem('wealthflow_custom_ipva_dates');
    if (savedCustom && v.placa) {
      const parsed = JSON.parse(savedCustom);
      const customDateStr = parsed[v.placa.toUpperCase().trim()];
      if (customDateStr) {
        const customDate = new Date(customDateStr);
        if (!isNaN(customDate.getTime())) {
          return customDate;
        }
      }
    }
  } catch (err) {
    console.error("Error parsing custom IPVA date from localStorage:", err);
  }

  const monthInfo = getVehicleIpvaMonth(v);
  if (!monthInfo) return null;
  
  // Set default due day using custom closing day
  const closingDay = getIpvaClosingDay();
  const currentYear = today.getFullYear();
  const dueDayThisYear = getSafeDay(currentYear, monthInfo.month - 1, closingDay);
  const dueDateThisYear = new Date(currentYear, monthInfo.month - 1, dueDayThisYear, 23, 59, 59);
  
  if (dueDateThisYear.getTime() >= today.getTime()) {
    return dueDateThisYear;
  } else {
    const dueDayNextYear = getSafeDay(currentYear + 1, monthInfo.month - 1, closingDay);
    return new Date(currentYear + 1, monthInfo.month - 1, dueDayNextYear, 23, 59, 59);
  }
}

export function getVehicleDaysUntilIpva(v: RegisteredVehicle, today: Date = new Date()): number | null {
  const nextDueDate = getVehicleNextIpvaDueDate(v, today);
  if (!nextDueDate) return null;
  
  const diffTime = nextDueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export interface IpvaAlert {
  vehicleId: string;
  vehicleDesc: string;
  motorista: string;
  placa: string;
  finalDigit: number | null;
  dueMonthName: string;
  dueDateStr: string;
  daysRemaining: number;
  status: 'PENDENTE' | 'URGENTE' | 'VENCENDO_HOJE' | 'OK';
}

export function checkIpvaAlerts(vehicles: RegisteredVehicle[], today: Date = new Date(), transactions: any[] = [], leadDays?: number): IpvaAlert[] {
  let finalLeadDays = 30;
  if (leadDays !== undefined) {
    finalLeadDays = leadDays;
  } else {
    try {
      const saved = localStorage.getItem('wealthflow_ipva_lead_days');
      if (saved) {
        finalLeadDays = parseInt(saved, 10);
      }
    } catch {
      // fallback
    }
  }

  const alerts: IpvaAlert[] = [];
  const currentYear = today.getFullYear();
  
  vehicles.forEach(v => {
    const monthInfo = getVehicleIpvaMonth(v);
    if (!monthInfo) return;
    
    // Check if there is already a paid transaction for IPVA of this vehicle in the current year
    const isPaidThisYear = transactions.some(t => {
      const descUpper = (t.descricao || '').toUpperCase();
      const isIpva = descUpper.includes('IPVA');
      const matchesVehicle = descUpper.includes(v.placa?.toUpperCase() || '___') || descUpper.includes(v.descricao.toUpperCase());
      const isPaid = (t.status || '').toUpperCase() === 'PAGO';
      
      let matchesYear = false;
      if (t.data) {
        // Handle YYYY-MM-DD or DD/MM/YYYY formats
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

    if (isPaidThisYear) return;
    
    const daysRemaining = getVehicleDaysUntilIpva(v, today);
    if (daysRemaining === null) return;
    
    // We notify finalLeadDays before the due date.
    if (daysRemaining >= 0 && daysRemaining <= finalLeadDays) {
      const nextDueDate = getVehicleNextIpvaDueDate(v, today);
      if (!nextDueDate) return;
      
      const formattedDate = nextDueDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      
      let status: 'PENDENTE' | 'URGENTE' | 'VENCENDO_HOJE' | 'OK' = 'PENDENTE';
      if (daysRemaining === 0) {
        status = 'VENCENDO_HOJE';
      } else if (daysRemaining <= 5) {
        status = 'URGENTE';
      }
      
      alerts.push({
        vehicleId: v.id,
        vehicleDesc: v.descricao,
        motorista: v.motorista,
        placa: v.placa || '',
        finalDigit: v.placa ? getPlacaFinalDigit(v.placa) : null,
        dueMonthName: monthInfo.name,
        dueDateStr: formattedDate,
        daysRemaining,
        status
      });
    }
  });
  
  return alerts;
}
