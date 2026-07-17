import React, { useState, useEffect } from 'react';
import { MedicalAppointment, MedicalPrescription } from '../types';
import { DateComboInput } from './DateComboInput';

interface MedicalAppointmentsTabProps {
  appointments: MedicalAppointment[];
  onAddAppointment: (newAppt: Omit<MedicalAppointment, 'id'>) => void;
  onEditAppointment: (id: string, updatedFields: Partial<MedicalAppointment>) => void;
  onDeleteAppointment: (id: string) => void;
  prescriptions?: MedicalPrescription[];
  onAddPrescription?: (newPresc: Omit<MedicalPrescription, 'id'>) => void;
  onEditPrescription?: (id: string, updatedFields: Partial<MedicalPrescription>) => void;
  onDeletePrescription?: (id: string) => void;
  showAlert?: (title: string, message: string) => void;
  showConfirm?: (title: string, message: string, onConfirm: () => void) => void;
  medicalAppointmentLeadDays?: number;
}

export function isNotificationPeriod(appointmentDateStr: string, customLeadDays?: number): { active: boolean; daysRemaining: number } {
  if (!appointmentDateStr) return { active: false, daysRemaining: -1 };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let year = 0, month = 0, day = 0;
  const cleanStr = appointmentDateStr.trim();
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
      return { active: false, daysRemaining: -1 };
    }
  }

  const apptDate = new Date(year, month, day);
  apptDate.setHours(0, 0, 0, 0);

  const diffTime = apptDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let leadDays = 2;
  if (customLeadDays !== undefined) {
    leadDays = customLeadDays;
  } else {
    try {
      const saved = localStorage.getItem('wealthflow_medical_appointment_lead_days');
      if (saved) {
        leadDays = parseInt(saved, 10);
      }
    } catch {
      // ignore
    }
  }

  // custom days before, 1 day before, day of
  return {
    active: diffDays >= 0 && diffDays <= leadDays,
    daysRemaining: diffDays
  };
}

export default function MedicalAppointmentsTab({
  appointments,
  onAddAppointment,
  onEditAppointment,
  onDeleteAppointment,
  prescriptions = [],
  onAddPrescription = () => {},
  onEditPrescription = () => {},
  onDeletePrescription = () => {},
  showAlert,
  showConfirm,
  medicalAppointmentLeadDays = 2
}: MedicalAppointmentsTabProps) {
  // Top Sub-Tab selector
  const [activeSubTab, setActiveSubTab] = useState<'consultas' | 'receitas'>('consultas');

  // Common UI states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'Todas' | 'Agendada' | 'Realizada' | 'Cancelada'>('Todas');
  const [appointmentSearch, setAppointmentSearch] = useState('');

  // Appointment Form states
  const [especialidade, setEspecialidade] = useState(() => localStorage.getItem('draft_appt_especialidade') || '');
  const [medico, setMedico] = useState(() => localStorage.getItem('draft_appt_medico') || '');
  const [data, setData] = useState(() => localStorage.getItem('draft_appt_data') || '');
  const [hora, setHora] = useState(() => localStorage.getItem('draft_appt_hora') || '');
  const [local, setLocal] = useState(() => localStorage.getItem('draft_appt_local') || '');
  const [observacoes, setObservacoes] = useState(() => localStorage.getItem('draft_appt_observacoes') || '');
  const [lembreteAtivo, setLembreteAtivo] = useState(() => {
    const val = localStorage.getItem('draft_appt_lembreteAtivo');
    return val !== null ? val === 'true' : true;
  });

  // Address Autocomplete states
  const [addressSuggestions, setAddressSuggestions] = useState<{ name: string; display: string }[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [suggestionTimeout, setSuggestionTimeout] = useState<any>(null);

  // Prescription UI states
  const [showPrescAddForm, setShowPrescAddForm] = useState(false);
  const [prescEditingId, setPrescEditingId] = useState<string | null>(null);
  const [prescSearch, setPrescSearch] = useState('');
  const [prescFilter, setPrescFilter] = useState<'Todas' | 'Ativas' | 'Baixadas'>('Todas');

  // Prescription Form states
  const [prescMedico, setPrescMedico] = useState(() => localStorage.getItem('draft_presc_medico') || '');
  const [prescEspecialidade, setPrescEspecialidade] = useState(() => localStorage.getItem('draft_presc_especialidade') || '');
  const [prescData, setPrescData] = useState(() => localStorage.getItem('draft_presc_data') || '');
  const [prescMedicamentos, setPrescMedicamentos] = useState(() => localStorage.getItem('draft_presc_medicamentos') || '');
  const [prescInstrucoes, setPrescInstrucoes] = useState(() => localStorage.getItem('draft_presc_instrucoes') || '');
  const [prescObservacoes, setPrescObservacoes] = useState(() => localStorage.getItem('draft_presc_observacoes') || '');
  const [prescDataVencimento, setPrescDataVencimento] = useState(() => localStorage.getItem('draft_presc_dataVencimento') || '');
  const [prescArquivoAnexo, setPrescArquivoAnexo] = useState<string | undefined>(undefined);
  const [prescNomeArquivoAnexo, setPrescNomeArquivoAnexo] = useState<string | undefined>(undefined);
  const [prescTipoArquivoAnexo, setPrescTipoArquivoAnexo] = useState<string | undefined>(undefined);

  // Attachment preview state
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string; type: string } | null>(null);

  // Auto-save appointment draft in real-time
  useEffect(() => {
    if (!editingId && showAddForm) {
      localStorage.setItem('draft_appt_especialidade', especialidade);
      localStorage.setItem('draft_appt_medico', medico);
      localStorage.setItem('draft_appt_data', data);
      localStorage.setItem('draft_appt_hora', hora);
      localStorage.setItem('draft_appt_local', local);
      localStorage.setItem('draft_appt_observacoes', observacoes);
      localStorage.setItem('draft_appt_lembreteAtivo', String(lembreteAtivo));
    }
  }, [editingId, showAddForm, especialidade, medico, data, hora, local, observacoes, lembreteAtivo]);

  // Auto-save prescription draft in real-time
  useEffect(() => {
    if (!prescEditingId && showPrescAddForm) {
      localStorage.setItem('draft_presc_medico', prescMedico);
      localStorage.setItem('draft_presc_especialidade', prescEspecialidade);
      localStorage.setItem('draft_presc_data', prescData);
      localStorage.setItem('draft_presc_medicamentos', prescMedicamentos);
      localStorage.setItem('draft_presc_instrucoes', prescInstrucoes);
      localStorage.setItem('draft_presc_observacoes', prescObservacoes);
      localStorage.setItem('draft_presc_dataVencimento', prescDataVencimento);
    }
  }, [prescEditingId, showPrescAddForm, prescMedico, prescEspecialidade, prescData, prescMedicamentos, prescInstrucoes, prescObservacoes, prescDataVencimento]);

  const loadApptDraft = () => {
    setEspecialidade(localStorage.getItem('draft_appt_especialidade') || '');
    setMedico(localStorage.getItem('draft_appt_medico') || '');
    setData(localStorage.getItem('draft_appt_data') || '');
    setHora(localStorage.getItem('draft_appt_hora') || '');
    setLocal(localStorage.getItem('draft_appt_local') || '');
    setObservacoes(localStorage.getItem('draft_appt_observacoes') || '');
    setLembreteAtivo(localStorage.getItem('draft_appt_lembreteAtivo') !== 'false');
  };

  const loadPrescDraft = () => {
    setPrescMedico(localStorage.getItem('draft_presc_medico') || '');
    setPrescEspecialidade(localStorage.getItem('draft_presc_especialidade') || '');
    setPrescData(localStorage.getItem('draft_presc_data') || '');
    setPrescMedicamentos(localStorage.getItem('draft_presc_medicamentos') || '');
    setPrescInstrucoes(localStorage.getItem('draft_presc_instrucoes') || '');
    setPrescObservacoes(localStorage.getItem('draft_presc_observacoes') || '');
    setPrescDataVencimento(localStorage.getItem('draft_presc_dataVencimento') || '');
  };

  // Suggestions for specialties
  const especialidadesSugeridas = [
    'Clínica Geral',
    'Cardiologia',
    'Dermatologia',
    'Ortopedia',
    'Pediatria',
    'Ginecologia',
    'Oftalmologia',
    'Otorrinolaringologia',
    'Psiquiatria',
    'Neurologia',
    'Endocrinologia',
    'Odontologia',
    'Fisioterapia',
    'Nutrição'
  ];

  // Address search autocompletion
  const fetchAddressSuggestions = async (val: string) => {
    if (!val || val.length < 3) {
      setAddressSuggestions([]);
      return;
    }
    setIsSearchingAddress(true);
    try {
      const apiKey = process.env.GOOGLE_MAPS_PLATFORM_KEY;
      if (apiKey && typeof window !== 'undefined' && (window as any).google?.maps?.places) {
        const autocompleteService = new (window as any).google.maps.places.AutocompleteService();
        autocompleteService.getPlacePredictions({ input: val }, (predictions: any[], status: any) => {
          if (status === 'OK' && predictions) {
            const list = predictions.map(p => ({
              name: p.structured_formatting?.main_text || p.description,
              display: p.description
            }));
            setAddressSuggestions(list);
            setIsSearchingAddress(false);
          } else {
            fetchOsmSuggestions(val);
          }
        });
      } else {
        await fetchOsmSuggestions(val);
      }
    } catch (err) {
      console.error('Error fetching address suggestions:', err);
      setIsSearchingAddress(false);
    }
  };

  const fetchOsmSuggestions = async (val: string) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&addressdetails=1&limit=5&countrycodes=br`, {
        headers: {
          'Accept-Language': 'pt-BR,pt;q=0.9'
        }
      });
      if (response.ok) {
        const data = await response.json();
        const list = data.map((item: any) => {
          const mainName = item.name || item.display_name.split(',')[0];
          return {
            name: mainName,
            display: item.display_name
          };
        });
        setAddressSuggestions(list);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const handleLocalChange = (val: string) => {
    setLocal(val);
    if (suggestionTimeout) {
      clearTimeout(suggestionTimeout);
    }
    const timeout = setTimeout(() => {
      fetchAddressSuggestions(val);
    }, 400);
    setSuggestionTimeout(timeout);
  };

  // Appointment Actions
  const clearForm = () => {
    setEspecialidade('');
    setMedico('');
    setData('');
    setHora('');
    setLocal('');
    setObservacoes('');
    setLembreteAtivo(true);
    setEditingId(null);
    setAddressSuggestions([]);

    localStorage.removeItem('draft_appt_especialidade');
    localStorage.removeItem('draft_appt_medico');
    localStorage.removeItem('draft_appt_data');
    localStorage.removeItem('draft_appt_hora');
    localStorage.removeItem('draft_appt_local');
    localStorage.removeItem('draft_appt_observacoes');
    localStorage.removeItem('draft_appt_lembreteAtivo');
  };

  const handleStartEdit = (appt: MedicalAppointment) => {
    setEditingId(appt.id);
    setEspecialidade(appt.especialidade);
    setMedico(appt.medico);
    setData(appt.data);
    setHora(appt.hora);
    setLocal(appt.local);
    setObservacoes(appt.observacoes || '');
    setLembreteAtivo(appt.lembreteAtivo);
    setShowAddForm(true);
    
    const element = document.getElementById('medical-appointments-tab-panel');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!especialidade || !medico || !data || !hora || !local) {
      if (showAlert) {
        showAlert('Aviso', 'Por favor, preencha todos os campos obrigatórios.');
      } else {
        alert('Por favor, preencha todos os campos obrigatórios.');
      }
      return;
    }

    if (editingId) {
      onEditAppointment(editingId, {
        especialidade,
        medico,
        data,
        hora,
        local,
        observacoes,
        lembreteAtivo
      });
      if (showAlert) {
        showAlert('Sucesso', 'Consulta médica atualizada com sucesso!');
      }
    } else {
      onAddAppointment({
        especialidade,
        medico,
        data,
        hora,
        local,
        observacoes,
        status: 'Agendada',
        lembreteAtivo
      });
      if (showAlert) {
        showAlert('Sucesso', 'Consulta médica agendada com sucesso!');
      }
    }

    clearForm();
    setShowAddForm(false);
  };

  const handleMarkAsRealized = (id: string) => {
    onEditAppointment(id, { status: 'Realizada' });
    if (showAlert) {
      showAlert('Sucesso', 'Consulta marcada como realizada!');
    }
  };

  const handleCancelAppointment = (id: string) => {
    if (showConfirm) {
      showConfirm(
        'Cancelar Consulta',
        'Tem certeza que deseja cancelar esta consulta?',
        () => {
          onEditAppointment(id, { status: 'Cancelada' });
          if (showAlert) {
            showAlert('Cancelada', 'Consulta cancelada com sucesso.');
          }
        }
      );
    } else if (confirm('Tem certeza que deseja cancelar esta consulta?')) {
      onEditAppointment(id, { status: 'Cancelada' });
    }
  };

  const handleDelete = (id: string) => {
    if (showConfirm) {
      showConfirm(
        'Excluir Agendamento',
        'Deseja excluir permanentemente este agendamento?',
        () => {
          onDeleteAppointment(id);
          if (showAlert) {
            showAlert('Sucesso', 'Agendamento excluído com sucesso.');
          }
        }
      );
    } else if (confirm('Deseja excluir este agendamento?')) {
      onDeleteAppointment(id);
    }
  };

  // Prescription File Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      // Compress image
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Max dimensions (e.g., 1024 width/height)
          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Convert to JPEG with quality 0.6 to significantly reduce size
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
                  // Calculate size in bytes
            // base64 has about 33% overhead, so: length * 3/4
            const sizeInBytes = Math.round((compressedBase64.length * 3) / 4);
            
            // Allow up to 450KB (460,800 bytes) to stay safely within Firestore 1MB and localStorage limits
            if (sizeInBytes > 450 * 1024) {
              if (showAlert) {
                showAlert('Arquivo muito grande', 'A imagem comprimida excede o limite de segurança de 450KB. Por favor, tire uma nova foto ou anexe uma imagem menor.');
              } else {
                alert('A imagem comprimida excede o limite de segurança de 450KB. Por favor, tire uma nova foto ou anexe uma imagem menor.');
              }
              return;
            }

            setPrescArquivoAnexo(compressedBase64);
            // Clean up name extension to be .jpg since we compressed it to image/jpeg
            const originalNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            setPrescNomeArquivoAnexo(`${originalNameWithoutExt}.jpg`);
            setPrescTipoArquivoAnexo('image/jpeg');
          } else {
            // Fallback to original
            const base64Data = event.target?.result as string;
            setPrescArquivoAnexo(base64Data);
            setPrescNomeArquivoAnexo(file.name);
            setPrescTipoArquivoAnexo(file.type);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } else {
      // For non-images (like PDFs), we check size directly (Allow up to 450KB to stay safely within Firestore 1MB)
      if (file.size > 450 * 1024) {
        if (showAlert) {
          showAlert('Arquivo muito grande', 'O arquivo PDF excede o limite de segurança de 450KB para anexo direto. Por favor, utilize um arquivo menor ou comprimido.');
        } else {
          alert('O arquivo PDF excede o limite de segurança de 450KB para anexo direto. Por favor, utilize um arquivo menor ou comprimido.');
        }
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target?.result as string;
        setPrescArquivoAnexo(base64Data);
        setPrescNomeArquivoAnexo(file.name);
        setPrescTipoArquivoAnexo(file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearFile = () => {
    setPrescArquivoAnexo(undefined);
    setPrescNomeArquivoAnexo(undefined);
    setPrescTipoArquivoAnexo(undefined);
  };

  // Prescription Actions
  const clearPrescForm = () => {
    setPrescMedico('');
    setPrescEspecialidade('');
    setPrescData('');
    setPrescMedicamentos('');
    setPrescInstrucoes('');
    setPrescObservacoes('');
    setPrescDataVencimento('');
    setPrescArquivoAnexo(undefined);
    setPrescNomeArquivoAnexo(undefined);
    setPrescTipoArquivoAnexo(undefined);
    setPrescEditingId(null);

    localStorage.removeItem('draft_presc_medico');
    localStorage.removeItem('draft_presc_especialidade');
    localStorage.removeItem('draft_presc_data');
    localStorage.removeItem('draft_presc_medicamentos');
    localStorage.removeItem('draft_presc_instrucoes');
    localStorage.removeItem('draft_presc_observacoes');
    localStorage.removeItem('draft_presc_dataVencimento');
  };

  const handleStartPrescEdit = (presc: MedicalPrescription) => {
    setPrescEditingId(presc.id);
    setPrescMedico(presc.medico);
    setPrescEspecialidade(presc.especialidade);
    setPrescData(presc.data);
    setPrescMedicamentos(presc.medicamentos);
    setPrescInstrucoes(presc.instrucoes || '');
    setPrescObservacoes(presc.observacoes || '');
    setPrescDataVencimento(presc.dataVencimento || '');
    setPrescArquivoAnexo(presc.arquivoAnexo);
    setPrescNomeArquivoAnexo(presc.nomeArquivoAnexo);
    setPrescTipoArquivoAnexo(presc.tipoArquivoAnexo);
    setShowPrescAddForm(true);
    
    const element = document.getElementById('medical-appointments-tab-panel');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handlePrescSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prescMedico || !prescEspecialidade || !prescData || !prescMedicamentos) {
      if (showAlert) {
        showAlert('Aviso', 'Por favor, preencha todos os campos obrigatórios.');
      } else {
        alert('Por favor, preencha todos os campos obrigatórios.');
      }
      return;
    }

    if (prescEditingId) {
      const currentPresc = prescriptions.find(p => p.id === prescEditingId);
      onEditPrescription(prescEditingId, {
        medico: prescMedico,
        especialidade: prescEspecialidade,
        data: prescData,
        medicamentos: prescMedicamentos,
        instrucoes: prescInstrucoes,
        observacoes: prescObservacoes,
        dataVencimento: prescDataVencimento || undefined,
        arquivoAnexo: prescArquivoAnexo || undefined,
        nomeArquivoAnexo: prescNomeArquivoAnexo || undefined,
        tipoArquivoAnexo: prescTipoArquivoAnexo || undefined,
        status: currentPresc?.status || 'Ativa'
      });
      if (showAlert) {
        showAlert('Sucesso', 'Receita médica atualizada com sucesso!');
      }
    } else {
      onAddPrescription({
        medico: prescMedico,
        especialidade: prescEspecialidade,
        data: prescData,
        medicamentos: prescMedicamentos,
        instrucoes: prescInstrucoes,
        observacoes: prescObservacoes,
        dataVencimento: prescDataVencimento || undefined,
        arquivoAnexo: prescArquivoAnexo || undefined,
        nomeArquivoAnexo: prescNomeArquivoAnexo || undefined,
        tipoArquivoAnexo: prescTipoArquivoAnexo || undefined,
        status: 'Ativa'
      });
      if (showAlert) {
        showAlert('Sucesso', 'Receita médica cadastrada com sucesso!');
      }
    }

    clearPrescForm();
    setShowPrescAddForm(false);
  };

  const handleMarkPrescAsBaixada = (id: string) => {
    onEditPrescription(id, { status: 'Baixada' });
    if (showAlert) {
      showAlert('Sucesso', 'Receita médica marcada como baixada!');
    }
  };

  const handleMarkPrescAsAtiva = (id: string) => {
    onEditPrescription(id, { status: 'Ativa' });
    if (showAlert) {
      showAlert('Sucesso', 'Receita médica reativada com sucesso!');
    }
  };

  const handlePrescDelete = (id: string) => {
    if (showConfirm) {
      showConfirm(
        'Confirmar Exclusão',
        'Deseja realmente excluir esta receita médica de forma permanente?',
        () => {
          onDeletePrescription(id);
          if (showAlert) showAlert('Sucesso', 'Receita médica excluída com sucesso.');
        }
      );
    } else if (confirm('Deseja realmente excluir esta receita?')) {
      onDeletePrescription(id);
    }
  };

  // Filtering lists
  const filteredAppointments = appointments.filter((appt) => {
    if (filter !== 'Todas' && appt.status !== filter) return false;
    if (!appointmentSearch) return true;
    const s = appointmentSearch.toLowerCase();
    return (
      appt.medico.toLowerCase().includes(s) ||
      appt.especialidade.toLowerCase().includes(s)
    );
  });

  const filteredPrescriptions = prescriptions.filter((presc) => {
    const status = presc.status || 'Ativa';
    if (prescFilter === 'Ativas' && status !== 'Ativa') return false;
    if (prescFilter === 'Baixadas' && status !== 'Baixada') return false;

    if (!prescSearch) return true;
    const s = prescSearch.toLowerCase();
    return (
      presc.medico.toLowerCase().includes(s) ||
      presc.especialidade.toLowerCase().includes(s) ||
      presc.medicamentos.toLowerCase().includes(s) ||
      (presc.instrucoes && presc.instrucoes.toLowerCase().includes(s))
    );
  });

  const getStatusBadgeStyles = (status: string) => {
    switch (status) {
      case 'Agendada':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'Realizada':
        return 'bg-slate-800 text-slate-400 border border-slate-700/50';
      case 'Cancelada':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      default:
        return 'bg-slate-800 text-slate-400';
    }
  };

  const getPrescStatusBadgeStyles = (status: string) => {
    switch (status) {
      case 'Ativa':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'Baixada':
        return 'bg-slate-800 text-slate-400 border border-slate-700/50';
      default:
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    }
  };

  const getSpecialtyIcon = (spec: string) => {
    const s = spec.toLowerCase();
    if (s.includes('cardio')) return 'cardiology';
    if (s.includes('derm')) return 'medical_services';
    if (s.includes('orto') || s.includes('osso')) return 'orthopedics';
    if (s.includes('pedi') || s.includes('cria')) return 'child_care';
    if (s.includes('gineco') || s.includes('mulher')) return 'female';
    if (s.includes('oftal') || s.includes('olho')) return 'visibility';
    if (s.includes('otor') || s.includes('ouvido')) return 'hearing';
    if (s.includes('neuro')) return 'neurology';
    if (s.includes('endo')) return 'gland';
    if (s.includes('odont') || s.includes('dente')) return 'dentistry';
    if (s.includes('psiq') || s.includes('mente')) return 'psychology';
    if (s.includes('nutri')) return 'nutrition';
    return 'medical_services';
  };

  return (
    <div className="space-y-6 animate-fade-in" id="medical-appointments-tab-panel">
      
      {/* Header section */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-emerald-400 font-mono">SAÚDE E BEM-ESTAR</p>
          <h2 className="text-2xl font-bold tracking-tight text-white font-display">
            {activeSubTab === 'consultas' ? 'Consultas Médicas' : 'Receitas Médicas'}
          </h2>
        </div>

        {activeSubTab === 'consultas' ? (
          <button
            onClick={() => {
              if (showAddForm) {
                clearForm();
                setShowAddForm(false);
              } else {
                loadApptDraft();
                setShowAddForm(true);
              }
            }}
            className={`flex items-center gap-1.5 font-semibold px-4 py-2 rounded-xl text-xs transition-all active:scale-95 cursor-pointer ${
              showAddForm
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/10'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {showAddForm ? 'close' : 'add_circle'}
            </span>
            {showAddForm ? (editingId ? 'Cancelar Edição' : 'Fechar') : 'Agendar Consulta'}
          </button>
        ) : (
          <button
            onClick={() => {
              if (showPrescAddForm) {
                clearPrescForm();
                setShowPrescAddForm(false);
              } else {
                loadPrescDraft();
                setShowPrescAddForm(true);
              }
            }}
            className={`flex items-center gap-1.5 font-semibold px-4 py-2 rounded-xl text-xs transition-all active:scale-95 cursor-pointer ${
              showPrescAddForm
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/10'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {showPrescAddForm ? 'close' : 'add_circle'}
            </span>
            {showPrescAddForm ? (prescEditingId ? 'Cancelar Edição' : 'Fechar') : 'Cadastrar Receita'}
          </button>
        )}
      </div>

      {/* Top Tab Selector */}
      <div className="flex bg-slate-900/60 p-1 rounded-xl border border-slate-800/80">
        <button
          onClick={() => {
            setActiveSubTab('consultas');
            setShowAddForm(false);
            setShowPrescAddForm(false);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'consultas'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">medical_services</span>
          Consultas
        </button>
        <button
          onClick={() => {
            setActiveSubTab('receitas');
            setShowAddForm(false);
            setShowPrescAddForm(false);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'receitas'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">prescriptions</span>
          Receitas
        </button>
      </div>

      {/* RENDER CONSULTAS SUB-TAB */}
      {activeSubTab === 'consultas' && (
        <>
          {/* Info banner about alerts */}
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-400 text-lg mt-0.5 animate-pulse">notifications_active</span>
            <div className="text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-white">Sistema Inteligente de Alertas</p>
              <p>
                Agende suas consultas e receba alertas destacados no seu painel principal <span className="text-amber-400 font-bold">{medicalAppointmentLeadDays} {medicalAppointmentLeadDays === 1 ? 'dia' : 'dias'} antes</span> até o dia da consulta.
              </p>
            </div>
          </div>

          {/* Appointment form */}
          {showAddForm && (
            <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 animate-slide-up">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400">
                  {editingId ? 'edit_calendar' : 'calendar_add_on'}
                </span>
                {editingId ? 'Editar Consulta' : 'Novo Agendamento'}
              </h3>

              <div className="grid grid-cols-1 gap-4">
                {/* Especialidade */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 block">Especialidade *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={especialidade}
                      onChange={(e) => setEspecialidade(e.target.value)}
                      placeholder="Ex: Cardiologia, Clínica Geral"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                      required
                      list="specialties-list"
                    />
                    <datalist id="specialties-list">
                      {especialidadesSugeridas.map((spec) => (
                        <option key={spec} value={spec} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Médico */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 block">Médico / Profissional *</label>
                  <input
                    type="text"
                    value={medico}
                    onChange={(e) => setMedico(e.target.value)}
                    placeholder="Ex: Dr. Carlos Silva"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                    required
                  />
                </div>

                {/* Data e Hora */}
                <div className="grid grid-cols-[1.6fr_1fr] gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 block">Data *</label>
                    <DateComboInput
                      value={data}
                      onChange={(val) => setData(val)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-1 h-[38px] text-xs text-white focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 block">Hora *</label>
                    <input
                      type="time"
                      value={hora}
                      onChange={(e) => setHora(e.target.value)}
                      style={{ colorScheme: 'dark' }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 h-[38px] text-xs text-white focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
                      required
                    />
                  </div>
                </div>

                {/* Local (COM AUTOCOMPLETE DE ENDEREÇO) */}
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-semibold text-slate-400 block">Local / Clínica / Endereço *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={local}
                      onChange={(e) => handleLocalChange(e.target.value)}
                      placeholder="Busque por Clínica, Hospital ou Endereço..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-4 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                      required
                    />
                    {isSearchingAddress && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                        <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-emerald-500"></span>
                      </div>
                    )}
                  </div>
                  
                  {/* Floating dropdown suggestions */}
                  {addressSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                      {addressSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setLocal(suggestion.display);
                            setAddressSuggestions([]);
                          }}
                          className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-800 border-b border-slate-800/50 last:border-0 text-slate-200 transition-colors flex items-start gap-2 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px] text-emerald-400 mt-0.5">location_on</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white truncate text-[11px]">{suggestion.name}</p>
                            <p className="text-[9px] text-slate-400 truncate">{suggestion.display}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Observações */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 block">Observações (Opcional)</label>
                  <textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Ex: Levar exames de sangue anteriores, jejum de 8h..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all min-h-[60px]"
                  />
                </div>

                {/* Lembrete Toggle */}
                <div className="flex items-center justify-between py-2 bg-slate-950/40 px-3.5 rounded-xl border border-slate-800">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-white block">Ativar Alertas Inteligentes</span>
                    <span className="text-[10px] text-slate-400 block max-w-[260px]">Me avisar {medicalAppointmentLeadDays} {medicalAppointmentLeadDays === 1 ? 'dia' : 'dias'} antes e no dia da consulta</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLembreteAtivo(!lembreteAtivo)}
                    className={`w-11 h-6 rounded-full p-1 transition-colors relative cursor-pointer ${
                      lembreteAtivo ? 'bg-emerald-500' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-slate-950 transition-all absolute top-1 ${
                        lembreteAtivo ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                {!editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('draft_appt_especialidade');
                      localStorage.removeItem('draft_appt_medico');
                      localStorage.removeItem('draft_appt_data');
                      localStorage.removeItem('draft_appt_hora');
                      localStorage.removeItem('draft_appt_local');
                      localStorage.removeItem('draft_appt_observacoes');
                      localStorage.removeItem('draft_appt_lembreteAtivo');
                      clearForm();
                      setShowAddForm(false);
                    }}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-rose-500/20 hover:bg-rose-500/10 text-rose-400 text-xs font-bold cursor-pointer transition-all"
                  >
                    Limpar Rascunho
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-950 text-slate-300 text-xs font-bold cursor-pointer transition-all"
                >
                  Manter Rascunho
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition-all active:scale-98 shadow-lg shadow-emerald-500/10 cursor-pointer"
                >
                  {editingId ? 'Salvar Alterações' : 'Salvar Agendamento'}
                </button>
              </div>
            </form>
          )}

          {/* Search and Filters container */}
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search input */}
            <div className="relative flex items-center flex-1">
              <span className="material-symbols-outlined absolute left-3.5 text-slate-500 text-base">search</span>
              <input
                type="text"
                value={appointmentSearch}
                onChange={(e) => setAppointmentSearch(e.target.value)}
                placeholder="Buscar por médico ou especialidade..."
                className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl py-2 pl-10 pr-9 text-xs text-slate-100 outline-none focus:border-emerald-500/80 font-sans placeholder-slate-500 transition-colors"
              />
              {appointmentSearch && (
                <button
                  type="button"
                  onClick={() => setAppointmentSearch('')}
                  className="absolute right-3 text-slate-500 hover:text-slate-300 cursor-pointer flex items-center justify-center p-0.5"
                  title="Limpar pesquisa"
                >
                  <span className="material-symbols-outlined text-sm font-bold">close</span>
                </button>
              )}
            </div>

            {/* Appointment filter buttons */}
            <div className="flex gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80 shrink-0 md:w-80">
              {(['Todas', 'Agendada', 'Realizada', 'Cancelada'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all cursor-pointer ${
                    filter === tab
                      ? 'bg-slate-800 text-emerald-400 border border-slate-700/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Appointment list */}
          <div className="space-y-3">
            {filteredAppointments.length === 0 ? (
              <div className="bg-slate-900/20 border border-slate-800/80 rounded-2xl py-8 px-4 text-center">
                <span className="material-symbols-outlined text-slate-600 text-3xl mb-2 block">event_busy</span>
                <p className="text-xs font-semibold text-slate-400">Nenhum agendamento encontrado</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Agende suas consultas médicas para começar.</p>
              </div>
            ) : (
              filteredAppointments.map((appt) => {
                const notif = isNotificationPeriod(appt.data, medicalAppointmentLeadDays);
                const isAlertActive = appt.status === 'Agendada' && appt.lembreteAtivo && notif.active;
                
                let dateFormatted = appt.data;
                try {
                  const [y, m, d] = appt.data.split('-');
                  dateFormatted = `${d}/${m}/${y}`;
                } catch (e) {}

                return (
                  <div
                    key={appt.id}
                    className={`bg-slate-900/40 border p-4 rounded-xl relative transition-all ${
                      isAlertActive
                        ? 'border-amber-500/40 bg-gradient-to-r from-slate-900/40 to-amber-950/10 shadow-lg shadow-amber-500/5'
                        : 'border-slate-800/80 hover:border-slate-700/80'
                    }`}
                  >
                    {isAlertActive && (
                      <div className="absolute -top-2 right-4 bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider flex items-center gap-1 shadow animate-pulse">
                        <span className="material-symbols-outlined text-[10px]">notifications_active</span>
                        {notif.daysRemaining === 0
                          ? 'Hoje!'
                          : notif.daysRemaining === 1
                          ? 'Amanhã!'
                          : 'Faltam 2 Dias!'}
                      </div>
                    )}

                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 flex items-center justify-center rounded-xl text-xl border shrink-0 ${
                          isAlertActive
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-slate-800/80 text-emerald-400 border-slate-700/50'
                        }`}>
                          <span className="material-symbols-outlined">
                            {getSpecialtyIcon(appt.especialidade)}
                          </span>
                        </div>

                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-white uppercase tracking-tight truncate max-w-[120px]">
                              {appt.especialidade}
                            </h4>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${getStatusBadgeStyles(appt.status)}`}>
                              {appt.status}
                            </span>
                          </div>

                          <p className="text-xs text-slate-300 truncate">
                            Médico: <span className="font-semibold text-white">{appt.medico}</span>
                          </p>

                          <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono pt-1">
                            <span className="flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[12px]">calendar_month</span>
                              {dateFormatted}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[12px]">schedule</span>
                              {appt.hora}
                            </span>
                          </div>

                          <p className="text-[10px] text-slate-400 flex items-start gap-0.5 pt-1">
                            <span className="material-symbols-outlined text-[12px] text-emerald-500/70 shrink-0 mt-0.5">location_on</span>
                            <span className="truncate">{appt.local}</span>
                          </p>

                          {appt.observacoes && (
                            <p className="text-[10px] text-slate-400 mt-1.5 p-2 bg-slate-950/40 rounded-lg border border-slate-800 border-dashed">
                              <span className="font-semibold text-slate-300">Obs:</span> {appt.observacoes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions column */}
                      <div className="flex flex-col gap-1.5 ml-3 shrink-0">
                        <button
                          onClick={() => handleStartEdit(appt)}
                          className="p-1.5 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-slate-950 rounded-lg transition-all cursor-pointer border border-blue-500/20"
                          title="Editar consulta"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>

                        {appt.status === 'Agendada' && (
                          <>
                            <button
                              onClick={() => handleMarkAsRealized(appt.id)}
                              className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 rounded-lg transition-all cursor-pointer border border-emerald-500/20"
                              title="Marcar como realizada"
                            >
                              <span className="material-symbols-outlined text-sm">check</span>
                            </button>
                            <button
                              onClick={() => handleCancelAppointment(appt.id)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-slate-950 rounded-lg transition-all cursor-pointer border border-rose-500/20"
                              title="Cancelar consulta"
                            >
                              <span className="material-symbols-outlined text-sm">block</span>
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => handleDelete(appt.id)}
                          className="p-1.5 bg-slate-800/60 hover:bg-rose-500 text-slate-400 hover:text-slate-950 rounded-lg transition-all cursor-pointer border border-slate-700/50"
                          title="Excluir agendamento"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* RENDER RECEITAS SUB-TAB */}
      {activeSubTab === 'receitas' && (
        <>
          {/* Add/Edit Prescription Form */}
          {showPrescAddForm && (
            <form onSubmit={handlePrescSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 animate-slide-up">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400">
                  {prescEditingId ? 'edit_note' : 'post_add'}
                </span>
                {prescEditingId ? 'Editar Receita Médica' : 'Cadastrar Receita'}
              </h3>

              <div className="grid grid-cols-1 gap-4">
                {/* Médico */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 block">Médico / Dr(a) *</label>
                  <input
                    type="text"
                    value={prescMedico}
                    onChange={(e) => setPrescMedico(e.target.value)}
                    placeholder="Ex: Dra. Ana Paula Costa"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                    required
                  />
                </div>

                {/* Especialidade */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 block">Especialidade *</label>
                  <input
                    type="text"
                    value={prescEspecialidade}
                    onChange={(e) => setPrescEspecialidade(e.target.value)}
                    placeholder="Ex: Pediatra, Cardiologista"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                    required
                    list="presc-specialties-list"
                  />
                  <datalist id="presc-specialties-list">
                    {especialidadesSugeridas.map((spec) => (
                      <option key={spec} value={spec} />
                    ))}
                  </datalist>
                </div>

                {/* Data da Receita e Data de Vencimento */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 block">Data da Prescrição *</label>
                    <DateComboInput
                      value={prescData}
                      onChange={(val) => setPrescData(val)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-1 h-[38px] text-xs text-white focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 block">Data de Vencimento</label>
                    <DateComboInput
                      value={prescDataVencimento}
                      onChange={(val) => setPrescDataVencimento(val)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-1 h-[38px] text-xs text-white focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
                    />
                  </div>
                </div>

                {/* Escanear / Anexar Cópia em PDF ou Imagem */}
                <div className="space-y-2 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/60">
                  <span className="text-xs font-semibold text-slate-300 block flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-emerald-400">document_scanner</span>
                    Cópia da Receita (PDF ou Imagem)
                  </span>
                  
                  {prescArquivoAnexo ? (
                    <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800/80">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-emerald-400">
                          {prescTipoArquivoAnexo?.includes('pdf') ? 'picture_as_pdf' : 'image'}
                        </span>
                        <div className="text-[11px] truncate pr-2">
                          <p className="text-white font-semibold truncate max-w-[200px]">{prescNomeArquivoAnexo}</p>
                          <p className="text-slate-500 text-[9px] uppercase font-mono">{prescTipoArquivoAnexo?.split('/')[1] || 'Arquivo'}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearFile}
                        className="p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Remover anexo"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Standard Upload / Browser */}
                      <label className="flex flex-col items-center justify-center p-3 border border-dashed border-slate-800 hover:border-emerald-500/50 bg-slate-950/60 hover:bg-slate-950 rounded-xl cursor-pointer transition-all group text-center h-[72px]">
                        <span className="material-symbols-outlined text-lg text-slate-500 group-hover:text-emerald-400">upload_file</span>
                        <span className="text-[10px] font-semibold text-slate-400 group-hover:text-slate-200 mt-1">Anexar PDF/Foto</span>
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>

                      {/* Mobile Camera Scanner */}
                      <label className="flex flex-col items-center justify-center p-3 border border-dashed border-slate-800 hover:border-emerald-500/50 bg-slate-950/60 hover:bg-slate-950 rounded-xl cursor-pointer transition-all group text-center h-[72px]">
                        <span className="material-symbols-outlined text-lg text-slate-500 group-hover:text-emerald-400">photo_camera</span>
                        <span className="text-[10px] font-semibold text-slate-400 group-hover:text-slate-200 mt-1">Escanear Câmera</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* Medicamentos */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 block">Medicamentos Receitados *</label>
                  <textarea
                    value={prescMedicamentos}
                    onChange={(e) => setPrescMedicamentos(e.target.value)}
                    placeholder="Ex:&#10;1. Amoxicilina 500mg - Tomar de 8h em 8h por 7 dias&#10;2. Dipirona 1g - Caso tenha dor ou febre"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all min-h-[100px] font-sans"
                    required
                  />
                </div>

                {/* Instruções de Uso */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 block">Instruções adicionais / Como tomar (Opcional)</label>
                  <textarea
                    value={prescInstrucoes}
                    onChange={(e) => setPrescInstrucoes(e.target.value)}
                    placeholder="Ex: Tomar o antibiótico sempre com as refeições. Beber bastante água."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all min-h-[70px]"
                  />
                </div>

                {/* Observações */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 block">Observações / Próximo Retorno</label>
                  <input
                    type="text"
                    value={prescObservacoes}
                    onChange={(e) => setPrescObservacoes(e.target.value)}
                    placeholder="Ex: Retorno em 3 meses com exames novos"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                {!prescEditingId && (
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('draft_presc_medico');
                      localStorage.removeItem('draft_presc_especialidade');
                      localStorage.removeItem('draft_presc_data');
                      localStorage.removeItem('draft_presc_medicamentos');
                      localStorage.removeItem('draft_presc_instrucoes');
                      localStorage.removeItem('draft_presc_observacoes');
                      localStorage.removeItem('draft_presc_dataVencimento');
                      clearPrescForm();
                      setShowPrescAddForm(false);
                    }}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-rose-500/20 hover:bg-rose-500/10 text-rose-400 text-xs font-bold cursor-pointer transition-all"
                  >
                    Limpar Rascunho
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPrescAddForm(false)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-950 text-slate-300 text-xs font-bold cursor-pointer transition-all"
                >
                  Manter Rascunho
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition-all active:scale-98 shadow-lg shadow-emerald-500/10 cursor-pointer"
                >
                  {prescEditingId ? 'Salvar Alterações' : 'Salvar Receita'}
                </button>
              </div>
            </form>
          )}

          {/* Search Bar for prescriptions */}
          <div className="relative">
            <input
              type="text"
              value={prescSearch}
              onChange={(e) => setPrescSearch(e.target.value)}
              placeholder="Buscar receita por remédio, médico ou especialidade..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
            />
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">
              search
            </span>
            {prescSearch && (
              <button
                onClick={() => setPrescSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 cursor-pointer text-xs"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Prescription filter buttons */}
          <div className="flex gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80">
            {(['Todas', 'Ativas', 'Baixadas'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setPrescFilter(tab)}
                className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-all cursor-pointer ${
                  prescFilter === tab
                    ? 'bg-slate-800 text-emerald-400 border border-slate-700/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Prescription List */}
          <div className="space-y-3">
            {filteredPrescriptions.length === 0 ? (
              <div className="bg-slate-900/20 border border-slate-800/80 rounded-2xl py-8 px-4 text-center">
                <span className="material-symbols-outlined text-slate-600 text-3xl mb-2 block">prescriptions</span>
                <p className="text-xs font-semibold text-slate-400">Nenhuma receita encontrada</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Guarde suas receitas digitadas para nunca esquecer as dosagens.</p>
              </div>
            ) : (
              filteredPrescriptions.map((presc) => {
                let prescDateFormatted = presc.data;
                try {
                  const [y, m, d] = presc.data.split('-');
                  prescDateFormatted = `${d}/${m}/${y}`;
                } catch (e) {}

                // Expiration math & styling
                let daysRemaining: number | null = null;
                let isExpired = false;
                let isExpiringSoon = false; // <= 30 days
                let vencDateFormatted = '';

                if (presc.dataVencimento) {
                  try {
                    const [y, m, d] = presc.dataVencimento.split('-');
                    vencDateFormatted = `${d}/${m}/${y}`;
                    
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const vencDate = new Date(Number(y), Number(m) - 1, Number(d));
                    vencDate.setHours(0, 0, 0, 0);
                    
                    const diffTime = vencDate.getTime() - today.getTime();
                    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    isExpired = daysRemaining < 0;
                    isExpiringSoon = daysRemaining >= 0 && daysRemaining <= 30;
                  } catch (e) {}
                }

                return (
                  <div
                    key={presc.id}
                    className={`bg-slate-900/40 border p-4 rounded-xl transition-all ${
                      isExpired
                        ? 'border-rose-500/30 bg-gradient-to-r from-slate-900/40 to-rose-950/5'
                        : isExpiringSoon
                        ? 'border-amber-500/30 bg-gradient-to-r from-slate-900/40 to-amber-950/5'
                        : 'border-slate-800/80 hover:border-slate-700/80'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 flex items-center justify-center rounded-xl text-xl border shrink-0 ${
                          isExpired
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : isExpiringSoon
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-slate-800/80 text-emerald-400 border-slate-700/50'
                        }`}>
                          <span className="material-symbols-outlined">
                            prescriptions
                          </span>
                        </div>

                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs font-bold text-white uppercase tracking-tight truncate max-w-[120px]">
                              {presc.especialidade}
                            </h4>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${getPrescStatusBadgeStyles(presc.status || 'Ativa')}`}>
                              {presc.status || 'Ativa'}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono">
                              Emitida: {prescDateFormatted}
                            </span>

                            {vencDateFormatted && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                                isExpired
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/10'
                                  : isExpiringSoon
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/10'
                                  : 'bg-slate-850 text-slate-300'
                              }`}>
                                <span className="material-symbols-outlined text-[10px]">event</span>
                                Vence: {vencDateFormatted}
                                {isExpired && ' (Expirada!)'}
                                {isExpiringSoon && ` (Em ${daysRemaining} dias)`}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-300">
                            Dr(a): <span className="font-semibold text-white">{presc.medico}</span>
                          </p>

                          {/* Medicamentos rendering with formatted linebreaks */}
                          <div className="mt-2.5 p-3 bg-slate-950/55 rounded-xl border border-slate-850">
                            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">medication</span>
                              Medicamentos:
                            </p>
                            <p className="text-xs text-white whitespace-pre-line leading-relaxed font-sans">
                              {presc.medicamentos}
                            </p>
                          </div>

                          {/* Instructions */}
                          {presc.instrucoes && (
                            <div className="mt-1.5 p-2 bg-slate-900/50 rounded-lg border border-slate-800/60 text-[11px] text-slate-300">
                              <span className="font-semibold text-emerald-400 block text-[10px] uppercase tracking-wider mb-0.5">Instruções de Uso:</span>
                              <p className="leading-relaxed">{presc.instrucoes}</p>
                            </div>
                          )}

                          {/* Observations */}
                          {presc.observacoes && (
                            <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1 italic">
                              <span className="material-symbols-outlined text-[12px] text-slate-500">info</span>
                              Obs: {presc.observacoes}
                            </p>
                          )}

                          {/* Attached document (Scanned Copy) */}
                          {presc.arquivoAnexo && (
                            <div className="mt-3 p-2.5 bg-emerald-500/5 rounded-xl border border-emerald-500/10 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="material-symbols-outlined text-emerald-400 text-lg">
                                  {presc.tipoArquivoAnexo?.includes('pdf') ? 'picture_as_pdf' : 'image'}
                                </span>
                                <div className="text-[10px] truncate">
                                  <p className="text-slate-300 font-semibold truncate max-w-[180px]">{presc.nomeArquivoAnexo || 'Cópia Receita'}</p>
                                  <p className="text-slate-500 font-mono text-[8px] uppercase">{presc.tipoArquivoAnexo?.split('/')[1] || 'Documento'}</p>
                                </div>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setPreviewFile({
                                    name: presc.nomeArquivoAnexo || 'Cópia da Receita',
                                    url: presc.arquivoAnexo!,
                                    type: presc.tipoArquivoAnexo || 'image/jpeg'
                                  })}
                                  className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-bold rounded-lg text-[9px] transition-all flex items-center gap-0.5 cursor-pointer border border-emerald-500/10"
                                >
                                  <span className="material-symbols-outlined text-xs">visibility</span>
                                  Ver
                                </button>
                                <a
                                  href={presc.arquivoAnexo}
                                  download={presc.nomeArquivoAnexo || 'receita.jpg'}
                                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold rounded-lg text-[9px] transition-all flex items-center gap-0.5 cursor-pointer border border-slate-700/50"
                                >
                                  <span className="material-symbols-outlined text-xs">download</span>
                                  Baixar
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1.5 ml-3 shrink-0">
                        <button
                          onClick={() => handleStartPrescEdit(presc)}
                          className="p-1.5 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-slate-950 rounded-lg transition-all cursor-pointer border border-blue-500/20"
                          title="Editar receita"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>

                        {(presc.status || 'Ativa') === 'Ativa' ? (
                          <button
                            onClick={() => handleMarkPrescAsBaixada(presc.id)}
                            className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 rounded-lg transition-all cursor-pointer border border-emerald-500/20"
                            title="Dar baixa (Marcar como Comprada)"
                          >
                            <span className="material-symbols-outlined text-sm">check</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleMarkPrescAsAtiva(presc.id)}
                            className="p-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 rounded-lg transition-all cursor-pointer border border-amber-500/20"
                            title="Reativar receita"
                          >
                            <span className="material-symbols-outlined text-sm">undo</span>
                          </button>
                        )}

                        <button
                          onClick={() => handlePrescDelete(presc.id)}
                          className="p-1.5 bg-slate-800/60 hover:bg-rose-500 text-slate-400 hover:text-slate-950 rounded-lg transition-all cursor-pointer border border-slate-700/50"
                          title="Excluir receita"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* File Preview Modal Overlay */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 animate-fade-in backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-emerald-400">
                  {previewFile.type.includes('pdf') ? 'picture_as_pdf' : 'image'}
                </span>
                <span className="text-xs font-bold text-white truncate max-w-[250px]">{previewFile.name}</span>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Modal Body / Preview Viewport */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/40 min-h-[250px]">
              {previewFile.type.includes('pdf') ? (
                <div className="w-full h-full min-h-[350px] flex flex-col items-center justify-center text-center space-y-4">
                  <span className="material-symbols-outlined text-slate-600 text-6xl">picture_as_pdf</span>
                  <div className="max-w-xs space-y-1">
                    <p className="text-xs font-bold text-white">Visualização de PDF</p>
                    <p className="text-[10px] text-slate-500">Para visualizar esta receita em PDF com melhor resolução ou navegar em suas páginas, faça o download.</p>
                  </div>
                  <a
                    href={previewFile.url}
                    download={previewFile.name}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-lg shadow-emerald-500/10"
                  >
                    <span className="material-symbols-outlined text-base">download</span>
                    Baixar Receita Completa
                  </a>
                  
                  {/* Fallback iframe for supporting browsers */}
                  <iframe 
                    src={previewFile.url} 
                    className="w-full h-[220px] rounded-lg border border-slate-800 mt-2 bg-white"
                    title={previewFile.name}
                  />
                </div>
              ) : (
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="max-w-full max-h-[55vh] object-contain rounded-lg border border-slate-800 shadow"
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800 flex justify-end gap-2">
              <a
                href={previewFile.url}
                download={previewFile.name}
                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-700/50"
              >
                <span className="material-symbols-outlined text-xs">download</span>
                Baixar
              </a>
              <button
                onClick={() => setPreviewFile(null)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
