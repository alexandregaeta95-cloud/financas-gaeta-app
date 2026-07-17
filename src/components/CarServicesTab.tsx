import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CarServicePerformed, CarServiceScheduled, RegisteredVehicle, BankAccount, Transaction } from '../types';

interface CarServicesTabProps {
  performedServices: CarServicePerformed[];
  scheduledServices: CarServiceScheduled[];
  registeredVehicles: RegisteredVehicle[];
  bankAccounts: BankAccount[];
  transactions: Transaction[];
  onAddPerformedService: (service: Omit<CarServicePerformed, 'id'>) => Promise<void>;
  onEditPerformedService: (id: string, service: Partial<CarServicePerformed>) => Promise<void>;
  onDeletePerformedService: (id: string) => Promise<void>;
  onAddScheduledService: (service: Omit<CarServiceScheduled, 'id'>) => Promise<void>;
  onEditScheduledService: (id: string, service: Partial<CarServiceScheduled>) => Promise<void>;
  onDeleteScheduledService: (id: string) => Promise<void>;
  onAddTransaction: (tx: Omit<Transaction, 'id'>) => Promise<void>;
  showAlert: (title: string, message: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  onAddFuel?: () => void;
}

export default function CarServicesTab({
  performedServices,
  scheduledServices,
  registeredVehicles,
  bankAccounts,
  transactions,
  onAddPerformedService,
  onEditPerformedService,
  onDeletePerformedService,
  onAddScheduledService,
  onEditScheduledService,
  onDeleteScheduledService,
  onAddTransaction,
  showAlert,
  showConfirm,
  onAddFuel
}: CarServicesTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'REALIZADOS' | 'AGENDADOS'>('REALIZADOS');
  const [vehicleFilter, setVehicleFilter] = useState<string>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fuel consumption utility states
  const [selectedFuelVehicle, setSelectedFuelVehicle] = useState<string>('');
  const [manualKmInicial, setManualKmInicial] = useState<string>('');
  const [fuelPricePerLiter, setFuelPricePerLiter] = useState<string>('5.50');

  // State for current KM of vehicles
  const [vehicleKms, setVehicleKms] = useState<{ [vehicleDesc: string]: number }>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_vehicle_kms');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      console.error("Failed to parse vehicle KMs state:", e);
    }
    // Default initial value matching our default vehicle 'FOX ROCK RIO 1.6'
    return { 'FOX ROCK RIO 1.6': 89650 };
  });

  const handleUpdateVehicleKm = (vehicleDesc: string, kmValue: number) => {
    const updated = { ...vehicleKms, [vehicleDesc.toUpperCase()]: kmValue };
    setVehicleKms(updated);
    try {
      localStorage.setItem('wealthflow_vehicle_kms', JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to save vehicle KMs to localStorage:", e);
    }
  };

  // Performed Services Form State
  const [isPerformedModalOpen, setIsPerformedModalOpen] = useState(false);
  const [editingPerformed, setEditingPerformed] = useState<CarServicePerformed | null>(null);
  const [perfVehicle, setPerfVehicle] = useState('');
  const [perfDescription, setPerfDescription] = useState('');
  const [perfDate, setPerfDate] = useState(new Date().toISOString().split('T')[0]);
  const [perfKm, setPerfKm] = useState('');
  const [perfValor, setPerfValor] = useState('');
  const [perfOficina, setPerfOficina] = useState('');
  const [perfObservacoes, setPerfObservacoes] = useState('');
  const [perfLancarFinancas, setPerfLancarFinancas] = useState(false);
  const [perfBankId, setPerfBankId] = useState<number>(0);

  // Scheduled Services Form State
  const [isScheduledModalOpen, setIsScheduledModalOpen] = useState(false);
  const [editingScheduled, setEditingScheduled] = useState<CarServiceScheduled | null>(null);
  const [schedVehicle, setSchedVehicle] = useState('');
  const [schedDescription, setSchedDescription] = useState('');
  const [schedType, setSchedType] = useState<'DATA' | 'KM' | 'DATA_E_KM'>('DATA');
  const [schedDateAlvo, setSchedDateAlvo] = useState('');
  const [schedKmAlvo, setSchedKmAlvo] = useState('');
  const [schedRecorrente, setSchedRecorrente] = useState(false);
  const [schedFreqMeses, setSchedFreqMeses] = useState('');
  const [schedFreqKm, setSchedFreqKm] = useState('');

  // Suggestion list for service types
  const standardServices = [
    "Troca de Óleo e Filtro",
    "Alinhamento e Balanceamento",
    "Troca de Pastilhas de Freio",
    "Substituição de Pneus",
    "Revisão Geral e Preventiva",
    "Troca do Filtro de Combustível",
    "Troca do Filtro de Cabine (Ar Condicionado)",
    "Substituição da Bateria",
    "Troca da Correia Dentada",
    "Substituição de Amortecedores",
    "Limpeza do Sistema de Arrefecimento",
    "Substituição de Velas de Ignição"
  ];

  // Open Performed Service Modal for Add
  const handleOpenAddPerformed = () => {
    setEditingPerformed(null);
    setPerfVehicle(registeredVehicles[0]?.descricao || 'CARRO');
    setPerfDescription('');
    setPerfDate(new Date().toISOString().split('T')[0]);
    setPerfKm('');
    setPerfValor('');
    setPerfOficina('');
    setPerfObservacoes('');
    setPerfLancarFinancas(false);
    setPerfBankId(bankAccounts[0]?.id || 0);
    setIsPerformedModalOpen(true);
  };

  // Open Performed Service Modal for Edit
  const handleOpenEditPerformed = (service: CarServicePerformed) => {
    setEditingPerformed(service);
    setPerfVehicle(service.veiculoDescricao);
    setPerfDescription(service.descricao);
    setPerfDate(service.data);
    setPerfKm(service.km ? String(service.km) : '');
    setPerfValor(service.valor ? service.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
    setPerfOficina(service.oficina || '');
    setPerfObservacoes(service.observacoes || '');
    setPerfLancarFinancas(false); // don't re-create financial transaction on edit unless they want to do it manually
    setPerfBankId(bankAccounts[0]?.id || 0);
    setIsPerformedModalOpen(true);
  };

  // Open Scheduled Service Modal for Add
  const handleOpenAddScheduled = () => {
    setEditingScheduled(null);
    setSchedVehicle(registeredVehicles[0]?.descricao || 'CARRO');
    setSchedDescription('');
    setSchedType('DATA');
    setSchedDateAlvo('');
    setSchedKmAlvo('');
    setSchedRecorrente(false);
    setSchedFreqMeses('');
    setSchedFreqKm('');
    setIsScheduledModalOpen(true);
  };

  // Open Scheduled Service Modal for Edit
  const handleOpenEditScheduled = (service: CarServiceScheduled) => {
    setEditingScheduled(service);
    setSchedVehicle(service.veiculoDescricao);
    setSchedDescription(service.descricao);
    setSchedType(service.tipoAgendamento);
    setSchedDateAlvo(service.dataAlvo || '');
    setSchedKmAlvo(service.kmAlvo ? String(service.kmAlvo) : '');
    setSchedRecorrente(service.recorrente);
    setSchedFreqMeses(service.frequenciaMeses ? String(service.frequenciaMeses) : '');
    setSchedFreqKm(service.frequenciaKm ? String(service.frequenciaKm) : '');
    setIsScheduledModalOpen(true);
  };

  // Mark a Scheduled Service as Done (Realizado)
  // This opens the performed form pre-filled with schedule details
  const handleMarkScheduledAsDone = (service: CarServiceScheduled) => {
    setEditingPerformed(null);
    setPerfVehicle(service.veiculoDescricao);
    setPerfDescription(service.descricao);
    setPerfDate(new Date().toISOString().split('T')[0]);
    
    // Suggest next KM if we can find current vehicle KMs or target KMs
    setPerfKm(service.kmAlvo ? String(service.kmAlvo) : '');
    setPerfValor('');
    setPerfOficina('');
    setPerfObservacoes(`Serviço realizado referente ao agendamento programado.`);
    setPerfLancarFinancas(true);
    setPerfBankId(bankAccounts[0]?.id || 0);
    
    // Store original scheduled item to complete it upon save
    // We pass a parameter or flag, or we can look up editingScheduled inside savePerformed
    setEditingScheduled(service); 
    setIsPerformedModalOpen(true);
  };

  // Save Performed Service
  const handleSavePerformed = async () => {
    if (!perfDescription.trim()) {
      showAlert("Dados Inválidos", "Por favor, digite uma descrição para o serviço.");
      return;
    }

    const cleanValorStr = perfValor.replace(/\./g, "").replace(",", ".");
    const parsedValor = cleanValorStr ? parseFloat(cleanValorStr) : undefined;
    const parsedKm = perfKm ? parseInt(perfKm, 10) : undefined;

    if (perfValor && isNaN(parsedValor || 0)) {
      showAlert("Dados Inválidos", "O valor informado não é um número válido.");
      return;
    }

    if (perfKm && isNaN(parsedKm || 0)) {
      showAlert("Dados Inválidos", "A quilometragem informada não é válida.");
      return;
    }

    try {
      const serviceData = {
        veiculoDescricao: perfVehicle.toUpperCase(),
        descricao: perfDescription.trim(),
        data: perfDate,
        km: parsedKm,
        valor: parsedValor,
        oficina: perfOficina.trim() || undefined,
        observacoes: perfObservacoes.trim() || undefined,
        updatedAt: Date.now()
      };

      if (editingPerformed) {
        await onEditPerformedService(editingPerformed.id, serviceData);
        showAlert("Sucesso", "Serviço editado com sucesso!");
      } else {
        await onAddPerformedService(serviceData);

        // If launching finance transaction is checked
        if (perfLancarFinancas && parsedValor && parsedValor > 0) {
          const selectedBank = bankAccounts.find(b => b.id === perfBankId);
          await onAddTransaction({
            descricao: `MANUT. CARRO: ${perfDescription.trim().toUpperCase()}`,
            valor: parsedValor,
            categoria: 'MANUTENÇÃO',
            tipo: 'DESPESA',
            data: perfDate,
            status: 'PAGO',
            bancoId: perfBankId > 0 ? perfBankId : undefined,
            bancoNome: selectedBank ? selectedBank.nome : undefined,
            veiculo: perfVehicle.toUpperCase() === 'MOTO' ? 'MOTO' : 'CARRO',
            descricaoVeiculo: perfVehicle.toUpperCase() !== 'MOTO' && perfVehicle.toUpperCase() !== 'CARRO' ? perfVehicle.toUpperCase() : undefined
          });
        }

        // Check if we came from completing an active schedule
        if (editingScheduled) {
          // If the completed scheduled item is recurring, update schedule to next trigger
          if (editingScheduled.recorrente) {
            let nextDate = editingScheduled.dataAlvo;
            let nextKm = editingScheduled.kmAlvo;

            if (editingScheduled.frequenciaMeses && editingScheduled.dataAlvo) {
              const d = new Date(perfDate);
              d.setMonth(d.getMonth() + editingScheduled.frequenciaMeses);
              nextDate = d.toISOString().split('T')[0];
            }

            if (editingScheduled.frequenciaKm && parsedKm) {
              nextKm = parsedKm + editingScheduled.frequenciaKm;
            } else if (editingScheduled.frequenciaKm && editingScheduled.kmAlvo) {
              nextKm = editingScheduled.kmAlvo + editingScheduled.frequenciaKm;
            }

            await onEditScheduledService(editingScheduled.id, {
              dataAlvo: nextDate || undefined,
              kmAlvo: nextKm || undefined,
              status: 'PENDENTE',
              updatedAt: Date.now()
            });
            showAlert("Agendamento Atualizado", "Serviço registrado! Por ser recorrente, o próximo agendamento foi programado automaticamente.");
          } else {
            // Otherwise, mark as realizado or delete it
            await onEditScheduledService(editingScheduled.id, {
              status: 'REALIZADO',
              updatedAt: Date.now()
            });
          }
          setEditingScheduled(null);
        }

        showAlert("Sucesso", "Serviço realizado cadastrado com sucesso!");
      }

      setIsPerformedModalOpen(false);
      setEditingPerformed(null);
    } catch (e) {
      console.error(e);
      showAlert("Erro", "Não foi possível salvar o serviço realizado.");
    }
  };

  // Save Scheduled Service
  const handleSaveScheduled = async () => {
    if (!schedDescription.trim()) {
      showAlert("Dados Inválidos", "Por favor, digite uma descrição para o serviço.");
      return;
    }

    if (schedType !== 'KM' && !schedDateAlvo) {
      showAlert("Dados Inválidos", "Por favor, selecione a data programada.");
      return;
    }

    if (schedType !== 'DATA' && !schedKmAlvo) {
      showAlert("Dados Inválidos", "Por favor, informe a quilometragem (KM) programada.");
      return;
    }

    const parsedKmAlvo = schedKmAlvo ? parseInt(schedKmAlvo, 10) : undefined;
    const parsedFreqMeses = schedFreqMeses ? parseInt(schedFreqMeses, 10) : undefined;
    const parsedFreqKm = schedFreqKm ? parseInt(schedFreqKm, 10) : undefined;

    if (schedKmAlvo && isNaN(parsedKmAlvo || 0)) {
      showAlert("Dados Inválidos", "Quilometragem programada inválida.");
      return;
    }

    try {
      const scheduleData = {
        veiculoDescricao: schedVehicle.toUpperCase(),
        descricao: schedDescription.trim(),
        tipoAgendamento: schedType,
        dataAlvo: schedType !== 'KM' ? schedDateAlvo : undefined,
        kmAlvo: schedType !== 'DATA' ? parsedKmAlvo : undefined,
        recorrente: schedRecorrente,
        frequenciaMeses: schedRecorrente ? (parsedFreqMeses || undefined) : undefined,
        frequenciaKm: schedRecorrente ? (parsedFreqKm || undefined) : undefined,
        status: 'PENDENTE' as const,
        updatedAt: Date.now()
      };

      if (editingScheduled) {
        await onEditScheduledService(editingScheduled.id, scheduleData);
        showAlert("Sucesso", "Agendamento editado com sucesso!");
      } else {
        await onAddScheduledService(scheduleData);
        showAlert("Sucesso", "Serviço agendado com sucesso!");
      }

      setIsScheduledModalOpen(false);
      setEditingScheduled(null);
    } catch (e) {
      console.error(e);
      showAlert("Erro", "Não foi possível salvar o agendamento.");
    }
  };

  // Handle Delete Performed
  const handleDeletePerformed = (id: string) => {
    showConfirm(
      "Remover Histórico",
      "Deseja realmente remover este registro de serviço realizado? Essa ação é permanente.",
      async () => {
        await onDeletePerformedService(id);
        showAlert("Sucesso", "Registro removido.");
      }
    );
  };

  // Handle Delete Scheduled
  const handleDeleteScheduled = (id: string) => {
    showConfirm(
      "Cancelar Agendamento",
      "Deseja realmente remover este agendamento?",
      async () => {
        await onDeleteScheduledService(id);
        showAlert("Sucesso", "Agendamento removido.");
      }
    );
  };

  const distinctVehicles = useMemo(() => {
    const list = [...registeredVehicles.map(v => v.descricao.toUpperCase())];
    scheduledServices.forEach(s => {
      if (s.veiculoDescricao && !list.includes(s.veiculoDescricao.toUpperCase())) {
        list.push(s.veiculoDescricao.toUpperCase());
      }
    });
    performedServices.forEach(s => {
      if (s.veiculoDescricao && !list.includes(s.veiculoDescricao.toUpperCase())) {
        list.push(s.veiculoDescricao.toUpperCase());
      }
    });
    // Remove duplicates or generic labels
    const unique = Array.from(new Set(list));
    return unique.filter(v => v !== 'VEÍCULO' && v !== '');
  }, [registeredVehicles, scheduledServices, performedServices]);

  // Sync selectedFuelVehicle and compute fuel consumption metrics
  const activeFuelVehicle = useMemo(() => {
    if (vehicleFilter && vehicleFilter !== 'TODOS') {
      return vehicleFilter.toUpperCase();
    }
    return selectedFuelVehicle.toUpperCase() || (distinctVehicles[0] || 'FOX ROCK RIO 1.6').toUpperCase();
  }, [vehicleFilter, selectedFuelVehicle, distinctVehicles]);

  const fuelTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (t.categoria !== 'ABASTECIMENTO') return false;
      const vehUpper = activeFuelVehicle.toUpperCase();
      const tVeh = t.veiculo?.toUpperCase() || '';
      const tDescVeh = t.descricaoVeiculo?.toUpperCase() || '';
      const tDesc = t.descricao.toUpperCase() || '';
      return (
        tVeh === vehUpper || 
        tDescVeh === vehUpper || 
        tDesc.includes(vehUpper) ||
        (vehUpper === 'FOX ROCK RIO 1.6' && (tDesc.includes('FOX') || tVeh.includes('FOX')))
      );
    });
  }, [transactions, activeFuelVehicle]);

  const totalFuelSpent = useMemo(() => {
    return fuelTransactions.reduce((sum, t) => sum + (t.valor || 0), 0);
  }, [fuelTransactions]);

  const minFuelKm = useMemo(() => {
    const kms = fuelTransactions
      .map(t => t.km)
      .filter((k): k is number => k !== undefined && k > 0);
    return kms.length > 0 ? Math.min(...kms) : null;
  }, [fuelTransactions]);

  const actualKmInicial = useMemo(() => {
    if (manualKmInicial !== '') {
      const parsed = parseInt(manualKmInicial, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return minFuelKm !== null ? minFuelKm : Math.max(0, (vehicleKms[activeFuelVehicle] || 0) - 1500);
  }, [manualKmInicial, minFuelKm, vehicleKms, activeFuelVehicle]);

  const currentVehKm = vehicleKms[activeFuelVehicle] || 0;
  const distanceRun = Math.max(0, currentVehKm - actualKmInicial);

  const totalLitersEst = useMemo(() => {
    let sumLiters = 0;
    const avgPrice = parseFloat(fuelPricePerLiter) || 5.50;
    fuelTransactions.forEach(t => {
      if (t.litros && t.litros > 0) {
        sumLiters += t.litros;
      } else if (t.valor && t.valor > 0) {
        const price = t.precoLitro && t.precoLitro > 0 ? t.precoLitro : avgPrice;
        sumLiters += t.valor / price;
      }
    });
    return sumLiters;
  }, [fuelTransactions, fuelPricePerLiter]);

  const avgConsumption = totalLitersEst > 0 && distanceRun > 0 ? (distanceRun / totalLitersEst) : 0;
  const costPerKm = distanceRun > 0 ? (totalFuelSpent / distanceRun) : 0;

  // Filter lists based on selected filters
  const filteredPerformed = useMemo(() => {
    return performedServices
      .filter(s => {
        const matchesVehicle = vehicleFilter === 'TODOS' || s.veiculoDescricao.toUpperCase() === vehicleFilter.toUpperCase();
        
        // Find vehicle to look up its plate
        const vehicle = registeredVehicles.find(v => v.descricao.toUpperCase() === s.veiculoDescricao.toUpperCase());
        const plate = vehicle?.placa || '';
        
        const q = searchQuery.toLowerCase();
        const matchesSearch = s.descricao.toLowerCase().includes(q) || 
                              s.veiculoDescricao.toLowerCase().includes(q) ||
                              plate.toLowerCase().includes(q) ||
                              (s.oficina && s.oficina.toLowerCase().includes(q)) ||
                              (s.observacoes && s.observacoes.toLowerCase().includes(q));
        return matchesVehicle && matchesSearch;
      })
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [performedServices, vehicleFilter, searchQuery, registeredVehicles]);

  const filteredScheduled = useMemo(() => {
    return scheduledServices
      .filter(s => {
        const matchesVehicle = vehicleFilter === 'TODOS' || s.veiculoDescricao.toUpperCase() === vehicleFilter.toUpperCase();
        
        // Find vehicle to look up its plate
        const vehicle = registeredVehicles.find(v => v.descricao.toUpperCase() === s.veiculoDescricao.toUpperCase());
        const plate = vehicle?.placa || '';
        
        const q = searchQuery.toLowerCase();
        const matchesSearch = s.descricao.toLowerCase().includes(q) ||
                              s.veiculoDescricao.toLowerCase().includes(q) ||
                              plate.toLowerCase().includes(q);
        const isPendingOrOverdue = s.status !== 'REALIZADO';
        return matchesVehicle && matchesSearch && isPendingOrOverdue;
      })
      .sort((a, b) => {
        if (a.dataAlvo && b.dataAlvo) {
          return a.dataAlvo.localeCompare(b.dataAlvo);
        }
        if (a.kmAlvo && b.kmAlvo) {
          return a.kmAlvo - b.kmAlvo;
        }
        return (a.dataAlvo ? -1 : 1);
      });
  }, [scheduledServices, vehicleFilter, searchQuery, registeredVehicles]);

  // Statistics
  const totalSpent = useMemo(() => {
    return performedServices
      .filter(s => vehicleFilter === 'TODOS' || s.veiculoDescricao.toUpperCase() === vehicleFilter.toUpperCase())
      .reduce((sum, s) => sum + (s.valor || 0), 0);
  }, [performedServices, vehicleFilter]);

  const totalCompletedCount = useMemo(() => {
    return performedServices.filter(s => vehicleFilter === 'TODOS' || s.veiculoDescricao.toUpperCase() === vehicleFilter.toUpperCase()).length;
  }, [performedServices, vehicleFilter]);

  const totalPendingSchedulesCount = useMemo(() => {
    return scheduledServices.filter(s => s.status !== 'REALIZADO' && (vehicleFilter === 'TODOS' || s.veiculoDescricao.toUpperCase() === vehicleFilter.toUpperCase())).length;
  }, [scheduledServices, vehicleFilter]);

  // Maintenance stats for the last 12 months per vehicle
  const maintenance12MStats = useMemo(() => {
    const stats: { 
      [vehicle: string]: { 
        totalSpent: number; 
        count: number; 
        monthlyAverage: number; 
      } 
    } = {};

    // Initialize stats for distinct vehicles
    distinctVehicles.forEach(veh => {
      stats[veh.toUpperCase()] = { totalSpent: 0, count: 0, monthlyAverage: 0 };
    });

    const now = new Date();
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(now.getFullYear() - 1);

    performedServices.forEach(s => {
      if (!s.data || !s.veiculoDescricao) return;
      
      const sDate = new Date(s.data);
      if (sDate >= twelveMonthsAgo && sDate <= now) {
        const vName = s.veiculoDescricao.toUpperCase();
        if (!stats[vName]) {
          stats[vName] = { totalSpent: 0, count: 0, monthlyAverage: 0 };
        }
        stats[vName].totalSpent += (s.valor || 0);
        stats[vName].count += 1;
      }
    });

    // Calculate monthly average (total / 12)
    Object.keys(stats).forEach(vName => {
      stats[vName].monthlyAverage = stats[vName].totalSpent / 12;
    });

    return stats;
  }, [performedServices, distinctVehicles]);

  const overall12MTotal = useMemo(() => {
    const list = Object.values(maintenance12MStats) as Array<{ totalSpent: number; count: number; monthlyAverage: number }>;
    return list.reduce((sum, item) => sum + item.totalSpent, 0);
  }, [maintenance12MStats]);

  const overall12MCount = useMemo(() => {
    const list = Object.values(maintenance12MStats) as Array<{ totalSpent: number; count: number; monthlyAverage: number }>;
    return list.reduce((sum, item) => sum + item.count, 0);
  }, [maintenance12MStats]);

  const overall12MMonthlyAverage = useMemo(() => {
    return overall12MTotal / 12;
  }, [overall12MTotal]);

  // Calculate status warning or days diff for schedules
  const getScheduleStatusBadge = (s: CarServiceScheduled) => {
    if (!s.dataAlvo) return { label: 'Aguardando KM', style: 'bg-slate-900 border-slate-800 text-slate-400' };
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const [y, m, d] = s.dataAlvo.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d);
    targetDate.setHours(0,0,0,0);

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { 
        label: `Atrasado há ${Math.abs(diffDays)}d`, 
        style: 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse' 
      };
    } else if (diffDays === 0) {
      return { 
        label: 'Hoje!', 
        style: 'bg-amber-500/20 border-amber-500/40 text-amber-400 font-bold' 
      };
    } else if (diffDays <= 15) {
      return { 
        label: `Próximo (${diffDays} dias)`, 
        style: 'bg-amber-500/10 border-amber-500/20 text-amber-300' 
      };
    } else {
      return { 
        label: `Em ${diffDays} dias`, 
        style: 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400' 
      };
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Visual Header */}
      <div className="flex justify-between items-center bg-slate-950/40 p-4 border border-slate-900/80 rounded-2xl">
        <div className="space-y-0.5">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-widest font-display flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-400 text-lg">build_circle</span>
            Manutenção do Carro
          </h2>
          <p className="text-[10px] text-slate-400 font-mono">Controle de revisões, trocas de óleo e agendamentos</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {onAddFuel && (
            <button
              onClick={onAddFuel}
              className="px-2.5 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/25 font-bold text-[10px] rounded-xl flex items-center gap-1 cursor-pointer transition-all uppercase tracking-wider font-sans active:scale-95"
            >
              <span className="material-symbols-outlined text-xs font-bold">local_gas_station</span>
              Adicionar Abastecimento
            </button>
          )}
          <button
            onClick={activeSubTab === 'REALIZADOS' ? handleOpenAddPerformed : handleOpenAddScheduled}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] rounded-xl flex items-center gap-1 cursor-pointer transition-colors uppercase tracking-wider active:scale-95"
          >
            <span className="material-symbols-outlined text-xs font-bold">add</span>
            {activeSubTab === 'REALIZADOS' ? 'Novo Serviço' : 'Agendar'}
          </button>
        </div>
      </div>

      {/* Sub tabs switches */}
      <div className="flex bg-slate-950 border border-slate-900 rounded-xl p-1 gap-1">
        <button
          onClick={() => setActiveSubTab('REALIZADOS')}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'REALIZADOS' ? 'bg-slate-900 text-emerald-400 border border-slate-800' : 'text-slate-450 hover:text-slate-250'
          }`}
        >
          <span className="material-symbols-outlined text-sm">history</span>
          Serviços Realizados
        </button>
        <button
          onClick={() => setActiveSubTab('AGENDADOS')}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'AGENDADOS' ? 'bg-slate-900 text-amber-400 border border-slate-800' : 'text-slate-450 hover:text-slate-250'
          }`}
        >
          <span className="material-symbols-outlined text-sm">pending_actions</span>
          Cronograma / Agendar ({totalPendingSchedulesCount})
        </button>
      </div>

      {/* Filters Area */}
      <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-900">
        {/* Vehicle Filter */}
        <div className="space-y-1">
          <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Filtrar Veículo</label>
          <div className="relative">
            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-850 rounded-lg pl-3 pr-8 py-1.5 text-xs text-white outline-none focus:border-emerald-500 appearance-none cursor-pointer uppercase font-sans font-medium"
            >
              <option value="TODOS">🚗 TODOS OS VEÍCULOS</option>
              {registeredVehicles.map(veh => (
                <option key={veh.id} value={veh.descricao.toUpperCase()}>{veh.descricao.toUpperCase()}</option>
              ))}
              <option value="CARRO">🚗 CARRO (PADRÃO)</option>
              <option value="MOTO">🏍️ MOTO (PADRÃO)</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-slate-450">
              <span className="material-symbols-outlined text-base">expand_more</span>
            </div>
          </div>
        </div>

        {/* Search Filter */}
        <div className="space-y-1 col-span-2">
          <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Buscar por Placa, Veículo ou Serviço</label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Digite a placa, veículo ou serviço..."
              className="w-full bg-slate-900/60 border border-slate-850 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 outline-none focus:border-emerald-500 font-sans font-medium"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-500">
              <span className="material-symbols-outlined text-xs">search</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quilometragem Atual da Frota */}
      {distinctVehicles.length > 0 && (
        <section className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl space-y-3 animate-fade-in" id="fleet-km-manager">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-amber-400 text-sm">speed</span>
                Quilometragem Atual da Frota
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Defina a quilometragem atual para acionar notificações preventivas de revisão.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {distinctVehicles.map(vehDesc => {
              const currentKm = vehicleKms[vehDesc.toUpperCase()] || 0;
              const vehicleObj = registeredVehicles.find(rv => rv.descricao.toUpperCase() === vehDesc.toUpperCase());
              return (
                <div key={vehDesc} className="flex items-center justify-between gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-xs text-slate-200">{vehDesc}</span>
                    {vehicleObj?.placa && (
                      <span className="block text-[9px] text-slate-400 font-mono">{vehicleObj.placa}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 max-w-[140px]">
                    <input
                      type="number"
                      value={currentKm || ''}
                      onChange={(e) => handleUpdateVehicleKm(vehDesc, parseInt(e.target.value, 10) || 0)}
                      placeholder="KM Atual"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white text-right outline-none focus:border-amber-500 font-mono"
                    />
                    <span className="text-[10px] text-slate-500 font-mono">km</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Calculadora de Consumo Médio de Combustível */}
      <section className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl space-y-4" id="fuel-consumption-calculator">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <span className="material-symbols-outlined text-emerald-400 text-sm">local_gas_station</span>
              Desempenho & Consumo Médio
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Média de consumo baseada no histórico de abastecimentos e quilometragem.</p>
          </div>
          {onAddFuel && (
            <button
              onClick={onAddFuel}
              className="px-2.5 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/25 font-bold text-[10px] rounded-xl flex items-center gap-1 cursor-pointer transition-all uppercase tracking-wider font-sans active:scale-95"
            >
              <span className="material-symbols-outlined text-xs font-bold">add</span>
              Novo Abastecimento
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {/* Local vehicle selector if filter is TODOS */}
          {vehicleFilter === 'TODOS' && distinctVehicles.length > 0 && (
            <div className="space-y-1 sm:col-span-2 md:col-span-3">
              <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Selecionar Veículo para Cálculo</label>
              <select
                value={selectedFuelVehicle || (distinctVehicles[0] || '')}
                onChange={(e) => setSelectedFuelVehicle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-500 font-sans uppercase font-medium cursor-pointer"
              >
                {distinctVehicles.map(veh => (
                  <option key={veh} value={veh}>{veh}</option>
                ))}
              </select>
            </div>
          )}

          {/* KM Inicial Input */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">KM Inicial</label>
              {minFuelKm !== null && (
                <button
                  onClick={() => setManualKmInicial('')}
                  className="text-[8px] font-mono text-emerald-400 hover:underline cursor-pointer bg-transparent border-none p-0 outline-none"
                  title="Restaurar para o primeiro abastecimento registrado"
                >
                  Resetar
                </button>
              )}
            </div>
            <div className="relative flex items-center">
              <input
                type="number"
                value={manualKmInicial === '' ? actualKmInicial : manualKmInicial}
                onChange={(e) => setManualKmInicial(e.target.value)}
                placeholder="Ex: 80000"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-2.5 pr-8 py-1.5 text-xs text-white outline-none focus:border-emerald-500 font-mono"
              />
              <span className="absolute right-2.5 text-[9px] text-slate-500 font-mono pointer-events-none">km</span>
            </div>
          </div>

          {/* Odomêtro / KM Atual */}
          <div className="space-y-1">
            <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">KM Atual</label>
            <div className="relative flex items-center">
              <input
                type="number"
                value={vehicleKms[activeFuelVehicle] || ''}
                onChange={(e) => handleUpdateVehicleKm(activeFuelVehicle, parseInt(e.target.value, 10) || 0)}
                placeholder="Ex: 81500"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-2.5 pr-8 py-1.5 text-xs text-white outline-none focus:border-emerald-500 font-mono font-semibold"
              />
              <span className="absolute right-2.5 text-[9px] text-slate-500 font-mono pointer-events-none">km</span>
            </div>
          </div>

          {/* Custom Fuel Price per Liter */}
          <div className="space-y-1 col-span-1 sm:col-span-2 md:col-span-1">
            <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Preço Estimado do Litro</label>
            <div className="relative flex items-center">
              <span className="absolute left-2.5 text-[9px] text-slate-500 font-mono pointer-events-none">R$</span>
              <input
                type="number"
                step="0.01"
                value={fuelPricePerLiter}
                onChange={(e) => setFuelPricePerLiter(e.target.value)}
                placeholder="Ex: 5.50"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Calculation results layout */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1.5">
          {/* Distância */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 flex flex-col justify-between">
            <div className="flex justify-between items-start text-slate-400">
              <span className="text-[8px] font-mono font-bold uppercase tracking-wider">Distância</span>
              <span className="material-symbols-outlined text-xs text-slate-500">route</span>
            </div>
            <div className="mt-1.5">
              <p className="text-sm font-bold text-white font-mono">{distanceRun.toLocaleString('pt-BR')} <span className="text-[9px] font-normal text-slate-400 font-sans">km</span></p>
              <span className="text-[8px] text-slate-500 font-mono block mt-0.5 truncate" title={`De KM ${actualKmInicial} até ${vehicleKms[activeFuelVehicle] || 0}`}>
                De KM {actualKmInicial} até {vehicleKms[activeFuelVehicle] || 0}
              </span>
            </div>
          </div>

          {/* Abastecimento Gasto */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 flex flex-col justify-between">
            <div className="flex justify-between items-start text-slate-400">
              <span className="text-[8px] font-mono font-bold uppercase tracking-wider">Total Gasto</span>
              <span className="material-symbols-outlined text-xs text-emerald-400">payments</span>
            </div>
            <div className="mt-1.5">
              <p className="text-sm font-bold text-emerald-400 font-mono">R$ {totalFuelSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <span className="text-[8px] text-slate-500 font-mono block mt-0.5 truncate">
                {fuelTransactions.length} abastecimentos
              </span>
            </div>
          </div>

          {/* Litros Estimados */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 flex flex-col justify-between">
            <div className="flex justify-between items-start text-slate-400">
              <span className="text-[8px] font-mono font-bold uppercase tracking-wider">Combustível</span>
              <span className="material-symbols-outlined text-xs text-blue-400">local_gas_station</span>
            </div>
            <div className="mt-1.5">
              <p className="text-sm font-bold text-white font-mono">
                {totalLitersEst.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} <span className="text-[9px] font-normal text-slate-400 font-sans">L</span>
              </p>
              <span className="text-[8px] text-slate-500 font-mono block mt-0.5 truncate">
                Médio: R$ {parseFloat(fuelPricePerLiter || '5.5').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/L
              </span>
            </div>
          </div>

          {/* Consumo Médio Principal */}
          <div className="bg-slate-950 p-3 rounded-xl border border-emerald-500/20 bg-gradient-to-b from-emerald-950/5 to-transparent flex flex-col justify-between col-span-2 sm:col-span-1">
            <div className="flex justify-between items-start text-slate-400">
              <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-emerald-400">Consumo Médio</span>
              <span className="material-symbols-outlined text-xs text-emerald-400 animate-pulse">speed</span>
            </div>
            <div className="mt-1.5">
              <p className="text-base font-extrabold text-emerald-400 font-mono">
                {avgConsumption > 0 ? `${avgConsumption.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '---'}
                <span className="text-[10px] font-normal text-emerald-300 font-sans ml-1">km/L</span>
              </p>
              {costPerKm > 0 && (
                <span className="text-[9px] text-emerald-500/95 font-mono block mt-0.5">
                  Custo: <strong>R$ {costPerKm.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>/km
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Context Warning if missing data */}
        {fuelTransactions.length === 0 && (
          <div className="bg-slate-950/60 border border-slate-850 p-3 rounded-xl flex items-start gap-2.5 text-[10px] text-slate-400 font-sans">
            <span className="material-symbols-outlined text-amber-500 text-sm leading-none mt-0.5 shrink-0">info</span>
            <div>
              <span>Não há abastecimentos registrados para o veículo <strong>{activeFuelVehicle}</strong> na aba Finanças.</span>
              <p className="text-[9px] text-slate-500 mt-1 font-mono leading-tight">Cadastre despesas com a categoria "ABASTECIMENTO" e veículo selecionado na aba Finanças para que os dados sejam sincronizados.</p>
            </div>
          </div>
        )}
      </section>

      {/* Overview stats cards */}
      <div className="grid grid-cols-3 gap-2 bg-slate-950 border border-slate-900 p-3 rounded-2xl shadow-inner shadow-black/40">
        <div className="text-center p-2 rounded-xl bg-slate-900/40 border border-slate-900">
          <span className="block text-[8px] font-mono font-semibold text-slate-500 uppercase">Investido total</span>
          <p className="text-xs font-bold text-emerald-400 font-mono mt-0.5">
            R$ {totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="text-center p-2 rounded-xl bg-slate-900/40 border border-slate-900">
          <span className="block text-[8px] font-mono font-semibold text-slate-500 uppercase">Realizados</span>
          <p className="text-xs font-bold text-slate-200 font-mono mt-0.5">
            {totalCompletedCount} serviços
          </p>
        </div>
        <div className="text-center p-2 rounded-xl bg-slate-900/40 border border-slate-900">
          <span className="block text-[8px] font-mono font-semibold text-slate-500 uppercase">Agendamentos</span>
          <p className="text-xs font-bold text-amber-400 font-mono mt-0.5">
            {totalPendingSchedulesCount} pendentes
          </p>
        </div>
      </div>

      {/* 📊 Resumo de Manutenção e Previsão Financeira (Últimos 12 Meses) */}
      <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 animate-fade-in" id="maintenance-summary-12m">
        <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="material-symbols-outlined text-lg">query_stats</span>
            <h3 className="font-bold text-white font-display text-base">Custos de Oficina & Previsão (Últimos 12 Meses)</h3>
          </div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full">
            Indicador de Previsão
          </span>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Este painel exibe um consolidado dos gastos reais com manutenção por veículo no período dos últimos 12 meses e calcula a <strong>média mensal estimada</strong>. Utilize estes valores como referência de provisão financeira mensal para o planejamento do seu orçamento de frota.
        </p>

        {distinctVehicles.length === 0 ? (
          <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl text-center">
            <p className="text-xs text-slate-500 italic">Nenhum veículo cadastrado na frota para exibir o resumo.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resumo Consolidado Geral */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Total Geral Acumulado (12M)</span>
                <p className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                  R$ {overall12MTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex gap-4">
                <div>
                  <span className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Média Provisão Mensal</span>
                  <p className="text-sm font-bold text-amber-400 font-mono mt-0.5">
                    R$ {overall12MMonthlyAverage.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / mês
                  </p>
                </div>
                <div>
                  <span className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Manutenções</span>
                  <p className="text-sm font-bold text-slate-300 font-mono mt-0.5">
                    {overall12MCount} serviços
                  </p>
                </div>
              </div>
            </div>

            {/* Listagem por Veículo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {distinctVehicles.map(veh => {
                const stats = maintenance12MStats[veh.toUpperCase()] || { totalSpent: 0, count: 0, monthlyAverage: 0 };
                const pctOfTotal = overall12MTotal > 0 ? (stats.totalSpent / overall12MTotal) * 100 : 0;
                
                return (
                  <div key={veh} className="bg-slate-950 p-3.5 rounded-xl border border-slate-850 flex flex-col justify-between space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-200 uppercase font-sans tracking-tight block">
                          🚗 {veh}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono">
                          {stats.count} {stats.count === 1 ? 'manutenção realizada' : 'manutenções realizadas'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-emerald-400 font-mono block">
                          R$ {stats.totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono block">
                          Média: R$ {stats.monthlyAverage.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês
                        </span>
                      </div>
                    </div>

                    {/* Barra Proporcional de Peso de Custos */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                        <span>Peso sobre o custo total</span>
                        <span>{pctOfTotal.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-850">
                        <motion.div
                          className="h-full bg-emerald-500/70 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${pctOfTotal}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Main Content Areas */}
      <div className="space-y-3">
        {activeSubTab === 'REALIZADOS' ? (
          /* =======================================================
             SUBTAB: SERVIÇOS REALIZADOS
             ======================================================= */
          filteredPerformed.length === 0 ? (
            <div className="bg-slate-950/40 border border-slate-900 p-8 rounded-2xl text-center">
              <span className="material-symbols-outlined text-slate-600 text-3xl mb-2">history_toggle_off</span>
              <p className="text-xs text-slate-400 italic">Nenhum serviço realizado cadastrado.</p>
              <button
                onClick={handleOpenAddPerformed}
                className="mt-3 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-bold rounded-xl transition-colors cursor-pointer uppercase tracking-wider"
              >
                Cadastrar Primeiro Serviço
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPerformed.map((serv) => (
                <motion.div
                  key={serv.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-950 border border-slate-900 p-4 rounded-2xl flex flex-col justify-between gap-3 hover:border-emerald-500/20 transition-all shadow-md hover:shadow-emerald-500/[0.02]"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-base font-medium">car_repair</span>
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-slate-100 font-sans leading-tight uppercase">{serv.descricao}</h4>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] font-mono text-slate-400 mt-1 uppercase">
                          <span className="text-emerald-400/90 font-semibold flex items-center gap-0.5 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-850">
                            🚗 {serv.veiculoDescricao}
                          </span>
                          <span>•</span>
                          <span>{serv.data.split('-').reverse().join('/')}</span>
                          {serv.km !== undefined && (
                            <>
                              <span>•</span>
                              <span className="text-slate-300 font-semibold font-mono">{serv.km.toLocaleString('pt-BR')} KM</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-xs font-bold font-mono text-slate-100">
                        {serv.valor ? `R$ ${serv.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Grátis'}
                      </span>
                      {serv.oficina && (
                        <span className="text-[8px] text-slate-500 font-mono uppercase mt-0.5 max-w-[100px] truncate" title={serv.oficina}>
                          🏪 {serv.oficina}
                        </span>
                      )}
                    </div>
                  </div>

                  {serv.observacoes && (
                    <div className="text-[10px] text-slate-400 bg-slate-900/40 p-2 border border-slate-900/55 rounded-xl font-sans leading-relaxed italic">
                      ℹ️ {serv.observacoes}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 border-t border-slate-900 pt-2 text-[9px] font-mono">
                    <button
                      onClick={() => handleOpenEditPerformed(serv)}
                      className="p-1.5 bg-slate-900 border border-slate-850 rounded-lg text-slate-400 hover:text-amber-400 cursor-pointer flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-xs">edit</span>
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeletePerformed(serv.id)}
                      className="p-1.5 bg-slate-900 border border-slate-850 rounded-lg text-slate-400 hover:text-rose-400 cursor-pointer flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-xs">delete</span>
                      Excluir
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        ) : (
          /* =======================================================
             SUBTAB: CRONOGRAMA / AGENDADOS
             ======================================================= */
          filteredScheduled.length === 0 ? (
            <div className="bg-slate-950/40 border border-slate-900 p-8 rounded-2xl text-center">
              <span className="material-symbols-outlined text-slate-600 text-3xl mb-2">calendar_today</span>
              <p className="text-xs text-slate-400 italic">Nenhum agendamento pendente.</p>
              <button
                onClick={handleOpenAddScheduled}
                className="mt-3 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 text-[10px] font-bold rounded-xl transition-colors cursor-pointer uppercase tracking-wider"
              >
                Agendar Novo Serviço
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredScheduled.map((sched) => {
                const statusBadge = getScheduleStatusBadge(sched);
                const currentVehKm = vehicleKms[sched.veiculoDescricao.toUpperCase()] || 0;
                const isKmPreventiveAlert = sched.kmAlvo && sched.status !== 'REALIZADO' && (sched.tipoAgendamento === 'KM' || sched.tipoAgendamento === 'DATA_E_KM')
                  ? (() => {
                      const diff = sched.kmAlvo - currentVehKm;
                      return diff >= 0 && diff <= 500;
                    })()
                  : false;
                const kmDiff = sched.kmAlvo ? (sched.kmAlvo - currentVehKm) : null;

                return (
                  <motion.div
                    key={sched.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-slate-950 p-4 rounded-2xl flex flex-col justify-between gap-3 transition-all shadow-md ${
                      isKmPreventiveAlert 
                        ? 'border border-yellow-500/40 shadow-yellow-500/5 bg-gradient-to-b from-yellow-950/10 to-transparent' 
                        : 'border border-slate-900 hover:border-amber-500/20 hover:shadow-amber-500/[0.01]'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                          isKmPreventiveAlert 
                            ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' 
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/15'
                        }`}>
                          <span className="material-symbols-outlined text-base font-medium">schedule</span>
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-slate-100 font-sans leading-tight uppercase">{sched.descricao}</h4>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] font-mono text-slate-400 mt-1 uppercase">
                            <span className={`${
                              isKmPreventiveAlert 
                                ? 'text-yellow-450 border-yellow-500/20' 
                                : 'text-amber-400/90 border-slate-850'
                            } font-semibold flex items-center gap-0.5 bg-slate-900 px-1.5 py-0.5 rounded border`}>
                              🚗 {sched.veiculoDescricao}
                            </span>
                            <span>•</span>
                            {sched.tipoAgendamento === 'KM' ? (
                              <span className="font-semibold text-slate-300">No KM {sched.kmAlvo?.toLocaleString('pt-BR')}</span>
                            ) : sched.tipoAgendamento === 'DATA' ? (
                              <span>Alvo: {sched.dataAlvo?.split('-').reverse().join('/')}</span>
                            ) : (
                              <span>Alvo: {sched.dataAlvo?.split('-').reverse().join('/')} ou KM {sched.kmAlvo?.toLocaleString('pt-BR')}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded-full border ${
                          isKmPreventiveAlert 
                            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-450 font-bold animate-pulse' 
                            : statusBadge.style
                        }`}>
                          {isKmPreventiveAlert ? 'KM Preventivo' : statusBadge.label}
                        </span>
                      </div>
                    </div>

                    {isKmPreventiveAlert && kmDiff !== null && (
                      <div className="bg-yellow-500/10 border border-yellow-500/25 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 text-[10px] text-yellow-400 font-sans">
                        <span className="material-symbols-outlined text-[13px] text-yellow-500 animate-pulse font-bold">warning</span>
                        <span>Aviso Preventivo: Faltam apenas <strong className="font-extrabold text-white">{kmDiff} km</strong> para o KM alvo deste serviço!</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-mono bg-slate-900/50 p-2 border border-slate-900/50 rounded-xl">
                      <span className="text-slate-500">Recorrência:</span>
                      {sched.recorrente ? (
                        <span className="text-emerald-400 flex items-center gap-0.5 font-bold">
                          <span className="material-symbols-outlined text-[10px]">replay</span>
                          SIM (
                          {sched.frequenciaMeses ? `${sched.frequenciaMeses} m` : ''}
                          {sched.frequenciaMeses && sched.frequenciaKm ? ' ou ' : ''}
                          {sched.frequenciaKm ? `${sched.frequenciaKm.toLocaleString('pt-BR')} KM` : ''}
                          )
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">Não recorrente (único)</span>
                      )}
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-900 pt-2 text-[9px] font-mono">
                      <button
                        onClick={() => handleMarkScheduledAsDone(sched)}
                        className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg cursor-pointer flex items-center gap-1 transition-all active:scale-95"
                      >
                        <span className="material-symbols-outlined text-xs font-bold">check_circle</span>
                        Realizado
                      </button>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenEditScheduled(sched)}
                          className="p-1.5 bg-slate-900 border border-slate-850 rounded-lg text-slate-400 hover:text-amber-400 cursor-pointer flex items-center gap-1 transition-colors"
                        >
                          <span className="material-symbols-outlined text-xs">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteScheduled(sched.id)}
                          className="p-1.5 bg-slate-900 border border-slate-850 rounded-lg text-slate-400 hover:text-rose-400 cursor-pointer flex items-center gap-1 transition-colors"
                        >
                          <span className="material-symbols-outlined text-xs">delete</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* =======================================================
         MODAL 1: CADASTRO/EDIÇÃO DE SERVIÇO REALIZADO
         ======================================================= */}
      <AnimatePresence>
        {isPerformedModalOpen && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 select-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPerformedModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 z-10 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-start">
                <h4 className="text-sm font-bold text-white font-display uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-400">car_repair</span>
                  {editingPerformed ? 'Editar Serviço Realizado' : 'Novo Serviço Realizado'}
                </h4>
                <button
                  onClick={() => setIsPerformedModalOpen(false)}
                  className="p-1 rounded-full bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <div className="space-y-3.5 text-left font-sans">
                {/* Vehicle Selection */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Veículo</label>
                  <div className="relative">
                    <select
                      value={perfVehicle}
                      onChange={(e) => setPerfVehicle(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none focus:border-emerald-500 appearance-none cursor-pointer uppercase"
                    >
                      {registeredVehicles.map(veh => (
                        <option key={veh.id} value={veh.descricao}>{veh.descricao.toUpperCase()}</option>
                      ))}
                      <option value="CARRO">🚗 CARRO (PADRÃO)</option>
                      <option value="MOTO">MOTO (PADRÃO)</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-450">
                      <span className="material-symbols-outlined text-base">expand_more</span>
                    </div>
                  </div>
                </div>

                {/* Service description */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Descrição do Serviço</label>
                  <input
                    type="text"
                    value={perfDescription}
                    onChange={(e) => setPerfDescription(e.target.value)}
                    placeholder="Ex: Troca de Óleo 10w40, Alinhamento..."
                    list="standard-services-list"
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-emerald-500 transition-colors uppercase font-medium"
                  />
                  <datalist id="standard-services-list">
                    {standardServices.map((suggestion, idx) => (
                      <option key={idx} value={suggestion} />
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Date */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Data Realizado</label>
                    <input
                      type="date"
                      value={perfDate}
                      onChange={(e) => setPerfDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                  </div>

                  {/* KM */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">KM Atual (Opcional)</label>
                    <input
                      type="number"
                      value={perfKm}
                      onChange={(e) => setPerfKm(e.target.value)}
                      placeholder="Ex: 85000"
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Cost/Valor */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Valor Total (R$)</label>
                    <input
                      type="text"
                      value={perfValor}
                      onChange={(e) => {
                        let raw = e.target.value.replace(/\D/g, "");
                        if (!raw) {
                          setPerfValor('');
                          return;
                        }
                        let numeric = parseInt(raw, 10) / 100;
                        setPerfValor(numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                      }}
                      placeholder="0,00"
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                  </div>

                  {/* Workshop/Oficina */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Oficina / Estabelecimento</label>
                    <input
                      type="text"
                      value={perfOficina}
                      onChange={(e) => setPerfOficina(e.target.value)}
                      placeholder="Ex: Oficina Mecânica do Zé"
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Notes/Observações */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Notas / Peças Utilizadas</label>
                  <textarea
                    rows={2}
                    value={perfObservacoes}
                    onChange={(e) => setPerfObservacoes(e.target.value)}
                    placeholder="Ex: Filtro de óleo da marca Fram, Óleo Shell Helix 10w40 semissintético."
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2 px-3 text-xs text-slate-100 outline-none focus:border-emerald-500 transition-colors resize-none font-sans"
                  />
                </div>

                {/* Integration: launch as finance transaction */}
                {!editingPerformed && (
                  <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-850/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-200 block">Lançar no Caixa / Finanças?</span>
                        <p className="text-[9px] text-slate-400 leading-snug">Cria uma despesa na categoria Manutenção automaticamente.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPerfLancarFinancas(!perfLancarFinancas)}
                        className={`w-10 h-6 rounded-full transition-all duration-300 relative ${perfLancarFinancas ? 'bg-emerald-500' : 'bg-slate-800'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 transform ${perfLancarFinancas ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {perfLancarFinancas && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-900">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono block">Banco / Conta para Lançamento</label>
                        <div className="relative">
                          <select
                            value={perfBankId}
                            onChange={(e) => setPerfBankId(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-850 rounded-lg py-1.5 px-3 text-xs text-white outline-none focus:border-emerald-500 appearance-none cursor-pointer"
                          >
                            <option value={0}>-- SELECIONE UM BANCO (OPCIONAL) --</option>
                            {bankAccounts.map(b => (
                              <option key={b.id} value={b.id}>{b.nome} (Saldo: R$ {b.saldoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-slate-500">
                            <span className="material-symbols-outlined text-base">expand_more</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleSavePerformed}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer text-center flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm font-bold">save</span>
                  {editingPerformed ? 'Salvar Alterações' : 'Gravar Histórico'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =======================================================
         MODAL 2: CRIAÇÃO/EDIÇÃO DE AGENDAMENTO DE SERVIÇO
         ======================================================= */}
      <AnimatePresence>
        {isScheduledModalOpen && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 select-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsScheduledModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 z-10 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-start">
                <h4 className="text-sm font-bold text-white font-display uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-amber-400">schedule</span>
                  {editingScheduled ? 'Editar Agendamento' : 'Agendar Novo Serviço'}
                </h4>
                <button
                  onClick={() => setIsScheduledModalOpen(false)}
                  className="p-1 rounded-full bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <div className="space-y-3.5 text-left font-sans">
                {/* Vehicle */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Veículo</label>
                  <div className="relative">
                    <select
                      value={schedVehicle}
                      onChange={(e) => setSchedVehicle(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-white outline-none focus:border-amber-500 appearance-none cursor-pointer uppercase"
                    >
                      {registeredVehicles.map(veh => (
                        <option key={veh.id} value={veh.descricao}>{veh.descricao.toUpperCase()}</option>
                      ))}
                      <option value="CARRO">🚗 CARRO (PADRÃO)</option>
                      <option value="MOTO">MOTO (PADRÃO)</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-450">
                      <span className="material-symbols-outlined text-base">expand_more</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Descrição do Serviço</label>
                  <input
                    type="text"
                    value={schedDescription}
                    onChange={(e) => setSchedDescription(e.target.value)}
                    placeholder="Ex: Troca de Óleo, Substituição de Pneus..."
                    list="standard-schedules-list"
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-amber-500 transition-colors uppercase font-medium"
                  />
                  <datalist id="standard-schedules-list">
                    {standardServices.map((suggestion, idx) => (
                      <option key={idx} value={suggestion} />
                    ))}
                  </datalist>
                </div>

                {/* Trigger Type */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Tipo de Agendamento</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['DATA', 'KM', 'DATA_E_KM'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setSchedType(type)}
                        className={`py-2 text-[9px] font-mono font-bold border rounded-xl transition-all ${
                          schedType === type 
                            ? 'bg-amber-500/10 border-amber-500/50 text-amber-400' 
                            : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {type === 'DATA' ? 'POR DATA' : type === 'KM' ? 'POR KM' : 'DATA OU KM'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dynamic Inputs based on type */}
                <div className="grid grid-cols-2 gap-3">
                  {schedType !== 'KM' && (
                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Data Programada</label>
                      <input
                        type="date"
                        value={schedDateAlvo}
                        onChange={(e) => setSchedDateAlvo(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-amber-500 transition-colors font-mono"
                      />
                    </div>
                  )}

                  {schedType !== 'DATA' && (
                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">KM Programado</label>
                      <input
                        type="number"
                        value={schedKmAlvo}
                        onChange={(e) => setSchedKmAlvo(e.target.value)}
                        placeholder="Ex: 95000"
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-amber-500 transition-colors font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* Recurring Options */}
                <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-850/80 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-200 block">Serviço Recorrente? (Repetitivo)</span>
                      <p className="text-[9px] text-slate-400 leading-snug">Se ativado, agenda o próximo serviço automaticamente quando concluído.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSchedRecorrente(!schedRecorrente)}
                      className={`w-10 h-6 rounded-full transition-all duration-300 relative ${schedRecorrente ? 'bg-amber-500' : 'bg-slate-800'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 transform ${schedRecorrente ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {schedRecorrente && (
                    <div className="space-y-3 pt-2.5 border-t border-slate-900 text-left">
                      <p className="text-[9px] font-semibold text-amber-400/90 font-mono uppercase tracking-wide">Definir Intervalo de Repetição:</p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">A cada X Meses (Tempo)</label>
                          <input
                            type="number"
                            value={schedFreqMeses}
                            onChange={(e) => setSchedFreqMeses(e.target.value)}
                            placeholder="Ex: 6"
                            className="w-full bg-slate-900 border border-slate-850 rounded-lg py-1.5 px-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">A cada Y KM (Quilometragem)</label>
                          <input
                            type="number"
                            value={schedFreqKm}
                            onChange={(e) => setSchedFreqKm(e.target.value)}
                            placeholder="Ex: 10000"
                            className="w-full bg-slate-900 border border-slate-850 rounded-lg py-1.5 px-2.5 text-xs text-slate-100 outline-none focus:border-amber-500 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSaveScheduled}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer text-center flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm font-bold">save</span>
                  {editingScheduled ? 'Salvar Agendamento' : 'Confirmar Agendamento'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
