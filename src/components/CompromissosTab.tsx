import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Compromisso } from '../types';

interface CompromissosTabProps {
  compromissos: Compromisso[];
  onAddCompromisso: (comp: Omit<Compromisso, 'id'>) => Promise<void>;
  onEditCompromisso: (id: string, comp: Partial<Compromisso>) => Promise<void>;
  onDeleteCompromisso: (id: string) => Promise<void>;
  onNavigate?: (tab: string) => void;
}

export default function CompromissosTab({
  compromissos,
  onAddCompromisso,
  onEditCompromisso,
  onDeleteCompromisso,
  onNavigate
}: CompromissosTabProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [editingComp, setEditingComp] = useState<Compromisso | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDetailComp, setSelectedDetailComp] = useState<Compromisso | null>(null);

  // Browser Notification state & helpers
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const handleRequestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Seu navegador não suporta notificações do sistema.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        new Notification('Notificações Ativadas! 🎉', {
          body: 'Você receberá avisos automáticos sobre seus compromissos importantes.',
          icon: '/favicon.ico'
        });
      }
    } catch (err) {
      console.error('Erro ao solicitar permissão de notificações:', err);
    }
  };

  const handleTestNotification = () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification('🔔 Teste de Compromisso', {
        body: 'Este é um exemplo de lembrete de compromisso agendado com sucesso!',
        icon: '/favicon.ico'
      });
    } else {
      alert('Por favor, ative as notificações primeiro.');
    }
  };

  // Form states
  const [formTitulo, setFormTitulo] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formTime, setFormTime] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formColor, setFormColor] = useState('#22c55e'); // Green default
  const [formPiscando, setFormPiscando] = useState(true);
  const [formLembreteAtivo, setFormLembreteAtivo] = useState(true);
  const [formDiasAntecedencia, setFormDiasAntecedencia] = useState(2);

  // Preset Colors
  const presetColors = [
    { name: 'Verde', hex: '#22c55e' },
    { name: 'Vermelho', hex: '#ef4444' },
    { name: 'Azul', hex: '#3b82f6' },
    { name: 'Laranja', hex: '#f97316' },
    { name: 'Roxo', hex: '#a855f7' },
    { name: 'Rosa', hex: '#ec4899' },
    { name: 'Amarelo', hex: '#eab308' },
  ];

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday, 1 is Monday...

  const calendarDays = useMemo(() => {
    const days: (Date | null)[] = [];
    // Pad leading empty days
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    // Month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  }, [year, month, daysInMonth, firstDayIndex]);

  // Navigate months
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(today.toISOString().split('T')[0]);
  };

  // Check warnings
  const getDaysDiff = (compDateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = compDateStr.split('-').map(Number);
    const compDate = new Date(y, m - 1, d);
    compDate.setHours(0, 0, 0, 0);
    return Math.ceil((compDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const warningCompromissos = useMemo(() => {
    return compromissos.filter(c => {
      if (!c.lembreteAtivo) return false;
      const diff = getDaysDiff(c.data);
      return diff >= 0 && diff <= c.diasAntecedencia;
    });
  }, [compromissos]);

  // Selected day's commitments
  const selectedDayCompromissos = useMemo(() => {
    return compromissos.filter(c => c.data === selectedDateStr);
  }, [compromissos, selectedDateStr]);

  // Format currency or text formatting helpers
  const formatDateBRL = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return dateStr;
    }
  };

  // Open Form for Adding
  const handleOpenAddForm = (dateStr?: string) => {
    setEditingComp(null);
    setFormTitulo('');
    setFormDate(dateStr || selectedDateStr || new Date().toISOString().split('T')[0]);
    setFormTime('');
    setFormDesc('');
    setFormColor('#22c55e');
    setFormPiscando(true);
    setFormLembreteAtivo(true);
    setFormDiasAntecedencia(2);
    setIsFormOpen(true);
  };

  // Open Form for Editing
  const handleOpenEditForm = (comp: Compromisso) => {
    setEditingComp(comp);
    setFormTitulo(comp.titulo);
    setFormDate(comp.data);
    setFormTime(comp.hora || '');
    setFormDesc(comp.descricao || '');
    setFormColor(comp.cor);
    setFormPiscando(comp.piscando ?? true);
    setFormLembreteAtivo(comp.lembreteAtivo);
    setFormDiasAntecedencia(comp.diasAntecedencia);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitulo.trim() || !formDate) return;

    const payload = {
      titulo: formTitulo.trim(),
      data: formDate,
      hora: formTime.trim() || undefined,
      descricao: formDesc.trim() || undefined,
      cor: formColor,
      piscando: formPiscando,
      lembreteAtivo: formLembreteAtivo,
      diasAntecedencia: Number(formDiasAntecedencia),
      updatedAt: Date.now()
    };

    if (editingComp) {
      await onEditCompromisso(editingComp.id, payload);
    } else {
      await onAddCompromisso(payload);
    }

    setIsFormOpen(false);
    setEditingComp(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente excluir este compromisso?')) {
      await onDeleteCompromisso(id);
      if (editingComp?.id === id) {
        setIsFormOpen(false);
        setEditingComp(null);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="compromissos-tab-panel">
      {/* Header section with clean visual layout */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
            Módulo Calendário
          </span>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-white tracking-tight mt-1">
            Agenda e Compromissos
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Gerencie e agende compromissos importantes com alertas configuráveis por cor.
          </p>
        </div>
        <button
          onClick={() => handleOpenAddForm()}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Novo Compromisso
        </button>
      </div>

      {/* Sistema de Lembretes Agendados via Browser Notification API */}
      <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4" id="browser-reminders-panel">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-lg">notifications_active</span>
          </div>
          <div>
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-indigo-300">
              Lembretes do Sistema (Notificações Push)
            </h3>
            <p className="text-slate-400 text-xs mt-0.5 max-w-xl">
              Ative as notificações do navegador para receber alertas automáticos no seu dispositivo sobre compromissos ou vencimentos agendados, mesmo com o aplicativo em segundo plano.
            </p>
            
            <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] font-mono">
              <span className="text-slate-500">Status da Permissão:</span>
              {notificationPermission === 'granted' ? (
                <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ATIVADO (Autorizado)
                </span>
              ) : notificationPermission === 'denied' ? (
                <span className="flex items-center gap-1 text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  BLOQUEADO (Ajuste nas configurações do navegador)
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  NÃO AUTORIZADO (Clique em Ativar)
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          {notificationPermission !== 'granted' ? (
            <button
              onClick={handleRequestPermission}
              className="w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer active:scale-95 shadow-md shadow-indigo-600/10"
            >
              <span className="material-symbols-outlined text-sm">notifications</span>
              Ativar Notificações
            </button>
          ) : (
            <div className="flex gap-2 w-full md:w-auto">
              <button
                onClick={handleTestNotification}
                className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition-all cursor-pointer active:scale-95 border border-slate-700/50"
              >
                <span className="material-symbols-outlined text-sm text-indigo-400">notifications_active</span>
                Enviar Teste
              </button>
              
              <button
                onClick={handleRequestPermission}
                className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 font-semibold text-xs rounded-xl transition-all cursor-pointer active:scale-95"
                title="Sincronizar ou solicitar novamente"
              >
                <span className="material-symbols-outlined text-sm">sync</span>
                Atualizar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Alerta de Compromissos Ativos (Similar ao aviso de vencimento mas com cores customizadas e piscando) */}
      <AnimatePresence>
        {warningCompromissos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl space-y-3"
            id="compromissos-alerta"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-lg animate-pulse">event_upcoming</span>
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-emerald-300">
                  Lembretes de Compromissos Próximos
                </h3>
              </div>
              <span className="bg-emerald-500/10 text-emerald-400 font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded-md">
                {warningCompromissos.length} ALERTA{warningCompromissos.length === 1 ? '' : 'S'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {warningCompromissos.map(comp => {
                const diff = getDaysDiff(comp.data);
                let countdownText = '';
                if (diff === 0) countdownText = 'HOJE!';
                else if (diff === 1) countdownText = 'AMANHÃ!';
                else countdownText = `EM ${diff} DIAS`;

                const pulseStyle = comp.piscando !== false 
                  ? { animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite' } 
                  : {};

                return (
                  <div
                    key={comp.id}
                    className="flex justify-between items-center p-3 rounded-xl border transition-all hover:bg-slate-950/40 cursor-pointer"
                    style={{
                      backgroundColor: `${comp.cor}0a`, // 4% opacity
                      borderColor: `${comp.cor}33`, // 20% opacity
                      borderLeft: `4px solid ${comp.cor}`
                    }}
                    onClick={() => {
                      setSelectedDateStr(comp.data);
                      setSelectedDetailComp(comp);
                      // Set calendar to this date's month
                      const [y, m] = comp.data.split('-').map(Number);
                      setCurrentDate(new Date(y, m - 1, 1));
                    }}
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      {/* Pulse circle indicator matching custom color */}
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: comp.cor,
                          ...pulseStyle
                        }}
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-xs text-white truncate">{comp.titulo}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {formatDateBRL(comp.data)} {comp.hora ? `às ${comp.hora}` : ''}
                        </p>
                      </div>
                    </div>
                    
                    <span 
                      className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                        backgroundColor: `${comp.cor}22`,
                        color: comp.cor
                      }}
                    >
                      {countdownText}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Calendar Grid (8 cols on large) */}
        <div className="lg:col-span-8 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 sm:p-5 flex flex-col">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={prevMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <h3 className="font-display font-bold text-sm sm:text-base text-white min-w-[120px] text-center uppercase tracking-wider">
                {monthNames[month]} {year}
              </h3>
              <button
                onClick={nextMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={goToToday}
                className="px-2.5 py-1.5 border border-slate-800 hover:bg-slate-800 text-slate-300 font-mono text-[10px] rounded-lg transition-all"
              >
                Hoje
              </button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 text-center border-b border-slate-800/50 pb-2 mb-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dayName, idx) => (
              <span key={idx} className="text-[10px] sm:text-xs font-bold text-slate-500 font-mono uppercase">
                {dayName}
              </span>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 flex-grow">
            {calendarDays.map((date, idx) => {
              if (!date) {
                return (
                  <div key={`empty-${idx}`} className="aspect-square bg-slate-950/10 rounded-xl" />
                );
              }

              const dateStr = date.toISOString().split('T')[0];
              const isSelected = dateStr === selectedDateStr;
              
              const todayStr = new Date().toISOString().split('T')[0];
              const isToday = dateStr === todayStr;

              // Find commitments for this day
              const dayComps = compromissos.filter(c => c.data === dateStr);

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDateStr(dateStr)}
                  className={`aspect-square flex flex-col justify-between p-1.5 sm:p-2.5 rounded-xl border text-left transition-all relative active:scale-95 group ${
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-500/80 text-emerald-400'
                      : isToday
                      ? 'bg-slate-800/80 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-950/40 border-slate-850 hover:bg-slate-900/60 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <span className={`text-[10px] sm:text-xs font-bold font-mono ${isToday ? 'bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-md' : ''}`}>
                    {date.getDate()}
                  </span>

                  {/* Indicators for appointments */}
                  {dayComps.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 sm:gap-1 mt-1 max-h-[16px] overflow-hidden">
                      {dayComps.slice(0, 4).map(c => {
                        const pulseStyle = c.piscando !== false && !c.concluido
                          ? { animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite' } 
                          : {};
                        return (
                          <span
                            key={c.id}
                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-opacity ${c.concluido ? 'opacity-30' : ''}`}
                            style={{
                              backgroundColor: c.concluido ? '#64748b' : c.cor,
                              ...pulseStyle
                            }}
                            title={c.titulo + (c.concluido ? ' (Concluído)' : '')}
                          />
                        );
                      })}
                      {dayComps.length > 4 && (
                        <span className="text-[7px] font-extrabold text-slate-400 leading-none">
                          +{dayComps.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Commitment List & Form Panel (4 cols on large) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Day's appointments */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col min-h-[350px]">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3 mb-3">
              <div>
                <h4 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">
                  Dia Selecionado
                </h4>
                <p className="text-sm font-semibold text-white mt-0.5">
                  {formatDateBRL(selectedDateStr)}
                </p>
              </div>
              <button
                onClick={() => handleOpenAddForm(selectedDateStr)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 flex items-center justify-center transition-all active:scale-95"
                title="Adicionar para este dia"
              >
                <span className="material-symbols-outlined text-lg">add_task</span>
              </button>
            </div>

            {/* List for the day */}
            <div className="flex-grow space-y-3 overflow-y-auto max-h-[300px] pr-1">
              {selectedDayCompromissos.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 py-12 text-slate-500">
                  <span className="material-symbols-outlined text-3xl opacity-30">calendar_today</span>
                  <p className="text-xs mt-2 font-mono">Sem compromissos nesta data.</p>
                  <button
                    onClick={() => handleOpenAddForm(selectedDateStr)}
                    className="text-[10px] text-emerald-400 underline mt-1 hover:text-emerald-300"
                  >
                    Agendar um compromisso
                  </button>
                </div>
              ) : (
                selectedDayCompromissos.map(comp => {
                  const pulseStyle = comp.piscando !== false && !comp.concluido
                    ? { animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite' } 
                    : {};
 
                  return (
                    <div
                      key={comp.id}
                      onClick={() => setSelectedDetailComp(comp)}
                      className={`border p-3.5 rounded-xl space-y-2 relative group transition-all cursor-pointer hover:border-slate-700 hover:bg-slate-950/60 ${
                        comp.concluido 
                          ? 'bg-slate-950/20 border-slate-900/50 opacity-60' 
                          : 'bg-slate-950/40 border-slate-850'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Completion Checkbox */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditCompromisso(comp.id, { concluido: !comp.concluido });
                            }}
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all cursor-pointer shrink-0 active:scale-95 ${
                              comp.concluido 
                                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                                : 'border-slate-700 hover:border-slate-500 hover:bg-slate-900 text-transparent hover:text-slate-500'
                            }`}
                            title={comp.concluido ? "Marcar como pendente" : "Marcar como concluído"}
                          >
                            <span className="material-symbols-outlined text-xs font-black select-none">check</span>
                          </button>

                          <div className="flex items-center gap-1.5 min-w-0">
                            <div 
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor: comp.concluido ? '#64748b' : comp.cor,
                                ...pulseStyle
                              }}
                            />
                            <p className={`font-semibold text-xs sm:text-sm truncate transition-all ${
                              comp.concluido ? 'text-slate-500 line-through' : 'text-white'
                            }`}>
                              {comp.titulo}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-all">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditForm(comp);
                            }}
                            className="text-slate-400 hover:text-emerald-400 p-0.5 cursor-pointer"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined text-xs">edit</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(comp.id);
                            }}
                            className="text-slate-400 hover:text-rose-400 p-0.5 cursor-pointer"
                            title="Excluir"
                          >
                            <span className="material-symbols-outlined text-xs">delete</span>
                          </button>
                        </div>
                      </div>

                      {comp.hora && (
                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-mono pl-7">
                          <span className="material-symbols-outlined text-[12px]">schedule</span>
                          <span className={comp.concluido ? 'line-through text-slate-500' : ''}>{comp.hora}</span>
                        </div>
                      )}

                      {comp.descricao && (
                        <div className="pl-7">
                          <p className={`text-xs leading-relaxed bg-slate-900/30 p-2 rounded-lg border border-slate-900/50 ${
                            comp.concluido ? 'text-slate-500 line-through decoration-slate-600' : 'text-slate-400'
                          }`}>
                            {comp.descricao}
                          </p>
                        </div>
                      )}

                      {/* Reminder status tag */}
                      <div className="flex items-center justify-between pt-1 text-[9px] font-mono pl-7">
                        <span className="text-slate-500">
                          {comp.concluido 
                            ? '✅ CONCLUÍDO' 
                            : `Alerta: ${comp.lembreteAtivo ? `${comp.diasAntecedencia} dias antes` : 'Inativo'}`
                          }
                        </span>
                        {!comp.concluido && (
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: comp.cor }} />
                            <span className="text-slate-400" style={{ color: comp.cor }}>{comp.cor}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Form Modal/Drawer Inline */}
          {isFormOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/60 border border-emerald-500/20 rounded-2xl p-4 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                <h4 className="font-display font-semibold text-xs sm:text-sm text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">edit_calendar</span>
                  {editingComp ? 'Editar Compromisso' : 'Agendar Compromisso'}
                </h4>
                <button
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingComp(null);
                  }}
                  className="text-slate-500 hover:text-slate-300"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Title */}
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Título *</label>
                  <input
                    type="text"
                    required
                    value={formTitulo}
                    onChange={(e) => setFormTitulo(e.target.value)}
                    placeholder="Ex: Reunião do condomínio, Oficina mecânica..."
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Data *</label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Hora</label>
                    <input
                      type="time"
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Observações</label>
                  <textarea
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Detalhes adicionais, local, etc..."
                    rows={2}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 resize-none"
                  />
                </div>

                {/* Color Picker & Presets */}
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Cor do Lembrete</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {presetColors.map(c => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setFormColor(c.hex)}
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          formColor === c.hex ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      >
                        {formColor === c.hex && (
                          <span className="material-symbols-outlined text-[12px] text-white font-bold">check</span>
                        )}
                      </button>
                    ))}
                  </div>
                  {/* Custom Hex input */}
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value)}
                      className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
                    />
                    <input
                      type="text"
                      placeholder="#000000"
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value)}
                      className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1 text-[10px] text-white font-mono w-24"
                    />
                  </div>
                </div>

                {/* Alert Rules */}
                <div className="bg-slate-950/30 border border-slate-850 p-2.5 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono text-slate-400 uppercase">Alertar em quantos dias?</label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={formDiasAntecedencia}
                      onChange={(e) => setFormDiasAntecedencia(Math.max(0, Number(e.target.value)))}
                      className="bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white text-center w-12 font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono text-slate-400 uppercase">Luz de Alerta Piscando?</label>
                    <button
                      type="button"
                      onClick={() => setFormPiscando(!formPiscando)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        formPiscando ? 'bg-emerald-500' : 'bg-slate-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          formPiscando ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono text-slate-400 uppercase">Ativar Alertas?</label>
                    <button
                      type="button"
                      onClick={() => setFormLembreteAtivo(!formLembreteAtivo)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        formLembreteAtivo ? 'bg-emerald-500' : 'bg-slate-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          formLembreteAtivo ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditingComp(null);
                    }}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2 text-xs rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold py-2 text-xs rounded-xl shadow-lg shadow-emerald-500/10"
                  >
                    {editingComp ? 'Salvar' : 'Agendar'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </div>
      </div>

      {/* Modal Centralizado de Detalhes do Compromisso */}
      <AnimatePresence>
        {selectedDetailComp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="compromisso-detail-modal">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDetailComp(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            {/* Dialog Card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-slate-900 border border-slate-800/80 rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl z-10"
            >
              {/* Header Custom Color Bar */}
              <div 
                className="h-1.5 w-full" 
                style={{ backgroundColor: selectedDetailComp.cor || '#22c55e' }}
              />

              <div className="p-5 sm:p-6 space-y-4">
                {/* Header Actions & Title */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                      Detalhes do Agendamento
                    </span>
                    <h3 className="text-sm sm:text-base font-bold font-display text-white tracking-tight mt-1 leading-snug break-words">
                      {selectedDetailComp.titulo}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedDetailComp(null)}
                    className="w-8 h-8 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>

                {/* Details Metadata */}
                <div className="grid grid-cols-2 gap-3 bg-slate-950/30 border border-slate-850 p-3 rounded-xl">
                  <div>
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider block">Data</span>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 mt-0.5">
                      <span className="material-symbols-outlined text-xs text-emerald-400">calendar_today</span>
                      {formatDateBRL(selectedDetailComp.data)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider block">Horário</span>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 mt-0.5">
                      <span className="material-symbols-outlined text-xs text-indigo-400">schedule</span>
                      {selectedDetailComp.hora || 'Sem horário'}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {selectedDetailComp.descricao && (
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider block">Observações</span>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-slate-850/50 max-h-[120px] overflow-y-auto break-words whitespace-pre-wrap">
                      {selectedDetailComp.descricao}
                    </p>
                  </div>
                )}

                {/* Configuration Badges */}
                <div className="space-y-2">
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider block">Configurações de Alerta</span>
                  <div className="flex flex-wrap gap-2">
                    {/* Status Badge */}
                    <button
                      onClick={async () => {
                        const updatedVal = !selectedDetailComp.concluido;
                        await onEditCompromisso(selectedDetailComp.id, { concluido: updatedVal });
                        setSelectedDetailComp({ ...selectedDetailComp, concluido: updatedVal });
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold transition-all active:scale-95 ${
                        selectedDetailComp.concluido
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                      }`}
                    >
                      <span className="material-symbols-outlined text-xs">
                        {selectedDetailComp.concluido ? 'check_circle' : 'pending'}
                      </span>
                      {selectedDetailComp.concluido ? 'Concluído' : 'Pendente (Clique p/ Concluir)'}
                    </button>

                    {/* Alert Days Badge */}
                    <div className="flex items-center gap-1.5 bg-slate-950/40 border border-slate-850 px-2.5 py-1 rounded-lg text-[10px] font-mono text-slate-400">
                      <span className="material-symbols-outlined text-xs text-slate-500">notifications</span>
                      {selectedDetailComp.lembreteAtivo 
                        ? `Alerta: ${selectedDetailComp.diasAntecedencia} dias antes`
                        : 'Alertas: Inativos'
                      }
                    </div>

                    {/* Flashing Light Badge */}
                    {selectedDetailComp.piscando !== false && (
                      <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg text-[10px] font-mono text-rose-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                        Alerta Visual Ativo
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex gap-2.5 pt-3 border-t border-slate-800/60">
                  <button
                    onClick={() => {
                      handleDelete(selectedDetailComp.id);
                      setSelectedDetailComp(null);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-xl transition-all cursor-pointer active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    Excluir
                  </button>
                  <button
                    onClick={() => {
                      setSelectedDetailComp(null);
                      handleOpenEditForm(selectedDetailComp);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50 text-xs font-semibold rounded-xl transition-all cursor-pointer active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm text-emerald-400">edit</span>
                    Editar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
