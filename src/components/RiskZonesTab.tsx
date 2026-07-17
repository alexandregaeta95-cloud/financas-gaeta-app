import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as d3 from 'd3';
import { RiskZone } from '../types';
import { 
  Radio, 
  Navigation, 
  MapPin, 
  BellRing, 
  Info, 
  ShieldAlert, 
  CheckCircle2, 
  PlayCircle, 
  Volume2, 
  VolumeX, 
  Zap, 
  ZapOff, 
  Search, 
  Edit, 
  Trash2, 
  Plus, 
  Locate,
  Waypoints,
  Compass,
  Download,
  Upload,
  History,
  Flame
} from 'lucide-react';

// Helper to generate a 30-second silent WAV file URL dynamically
const createSilentWavUrl = (): string => {
  const sampleRate = 8000;
  const durationSeconds = 30;
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = durationSeconds * byteRate;
  const totalSize = 36 + dataSize;
  
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, totalSize, true); // chunk size
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);
  
  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
};

// Helper to generate a pure 0.4-second beep WAV file URL dynamically
const createBeepWavUrl = (frequency = 980, durationSeconds = 0.4): string => {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = durationSeconds * byteRate;
  const totalSize = 36 + dataSize;
  
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, totalSize, true); // chunk size
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);
  
  const numSamples = dataSize / 2;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t);
    const val = Math.max(-32768, Math.min(32767, Math.round(sample * 16000)));
    view.setInt16(44 + i * 2, val, true);
  }
  
  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
};

export interface PassageRecord {
  id: string;
  zoneId: number;
  zoneName: string;
  timestamp: string;
  hour: number;
  dayOfWeek: number;
  nivelRisco: string;
}

const generateDefaultPassages = (): PassageRecord[] => {
  const records: PassageRecord[] = [];
  
  // High density for VILA BRANDINA (id 1)
  const hoursId1 = [8, 9, 10, 18, 19, 20, 9, 18, 19, 8, 22, 23, 14, 15, 8, 9, 19, 20, 8, 9, 18, 19, 9, 18, 20];
  hoursId1.forEach((hr, idx) => {
    records.push({
      id: `hist-1-${idx}`,
      zoneId: 1,
      zoneName: "VILA BRANDINA",
      timestamp: `10/07/2026 ${String(hr).padStart(2, '0')}:${String(Math.floor(Math.random()*60)).padStart(2, '0')}:00`,
      hour: hr,
      dayOfWeek: (idx % 5) + 1,
      nivelRisco: "ALTO"
    });
  });

  // Medium density for MINHA CASA TESTE (id 4)
  const hoursId4 = [22, 23, 0, 1, 2, 22, 23, 0, 7, 8, 12, 13, 23, 0, 1, 22, 23, 2];
  hoursId4.forEach((hr, idx) => {
    records.push({
      id: `hist-4-${idx}`,
      zoneId: 4,
      zoneName: "MINHA CASA TESTE",
      timestamp: `11/07/2026 ${String(hr).padStart(2, '0')}:${String(Math.floor(Math.random()*60)).padStart(2, '0')}:00`,
      hour: hr,
      dayOfWeek: (idx % 7),
      nivelRisco: "ALTO"
    });
  });

  // Low density for ZELO MONITORAMENTO (id 5)
  const hoursId5 = [9, 10, 11, 14, 15, 16, 17, 10];
  hoursId5.forEach((hr, idx) => {
    records.push({
      id: `hist-5-${idx}`,
      zoneId: 5,
      zoneName: "ZELO MONITORAMENTO",
      timestamp: `09/07/2026 ${String(hr).padStart(2, '0')}:${String(Math.floor(Math.random()*60)).padStart(2, '0')}:00`,
      hour: hr,
      dayOfWeek: (idx % 5) + 1,
      nivelRisco: "BAIXO"
    });
  });

  // A couple for TESTE CENTRO (id 2)
  const hoursId2 = [14, 15, 16];
  hoursId2.forEach((hr, idx) => {
    records.push({
      id: `hist-2-${idx}`,
      zoneId: 2,
      zoneName: "TESTE CENTRO",
      timestamp: `08/07/2026 ${String(hr).padStart(2, '0')}:${String(Math.floor(Math.random()*60)).padStart(2, '0')}:00`,
      hour: hr,
      dayOfWeek: (idx % 5) + 1,
      nivelRisco: "BAIXO"
    });
  });

  return records;
};

interface RiskZonesTabProps {
  riskZones: RiskZone[];
  onAddRiskZone: (zone: Omit<RiskZone, 'id'>) => void;
  onToggleActive: (id: number) => void;
  onEditRiskZone: (id: number, updatedFields: Partial<RiskZone>) => void;
  onDeleteRiskZone: (id: number) => void;
  showAlert?: (title: string, message: string) => void;
  showConfirm?: (title: string, message: string, onConfirm: () => void, requireInputText?: string) => void;
}

export default function RiskZonesTab({ 
  riskZones, 
  onAddRiskZone, 
  onToggleActive,
  onEditRiskZone,
  onDeleteRiskZone,
  showAlert,
  showConfirm
}: RiskZonesTabProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterLevel, setFilterLevel] = useState<string>('todos'); // 'todos' | 'ALTO' | 'BAIXO'
  const [hideInactive, setHideInactive] = useState<boolean>(false);

  const [passageHistory, setPassageHistory] = useState<PassageRecord[]>(() => {
    try {
      const saved = localStorage.getItem('wealthflow_risk_zone_passages_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Failed to parse passage history:", e);
    }
    return generateDefaultPassages();
  });

  useEffect(() => {
    localStorage.setItem('wealthflow_risk_zone_passages_v2', JSON.stringify(passageHistory));
  }, [passageHistory]);

  const [selectedSimZoneId, setSelectedSimZoneId] = useState<number>(1);
  const [selectedSimHour, setSelectedSimHour] = useState<number>(12);

  // Form states to add new risk zone
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [name, setName] = useState<string>(() => localStorage.getItem('draft_zone_name') || '');
  const [lat, setLat] = useState<number>(() => {
    const val = localStorage.getItem('draft_zone_lat');
    return val !== null ? parseFloat(val) : -22.89676;
  });
  const [lng, setLng] = useState<number>(() => {
    const val = localStorage.getItem('draft_zone_lng');
    return val !== null ? parseFloat(val) : -47.02577;
  });
  const [radius, setRadius] = useState<number>(() => {
    const val = localStorage.getItem('draft_zone_radius');
    return val !== null ? parseInt(val, 10) : 300;
  });
  const [level, setLevel] = useState<'ALTO' | 'MEDIO' | 'BAIXO'>(() => {
    const val = localStorage.getItem('draft_zone_level') as any;
    return (val === 'ALTO' || val === 'MEDIO' || val === 'BAIXO') ? val : 'ALTO';
  });

  // Form states to edit existing risk zone
  const [isFetchingFormLocation, setIsFetchingFormLocation] = useState<boolean>(false);
  const [editingZone, setEditingZone] = useState<RiskZone | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editLat, setEditLat] = useState<number>(-22.90);
  const [editLng, setEditLng] = useState<number>(-47.05);
  const [editRadius, setEditRadius] = useState<number>(300);
  const [editLevel, setEditLevel] = useState<'ALTO' | 'MEDIO' | 'BAIXO'>('ALTO');

  // Auto-save Risk Zone draft
  useEffect(() => {
    if (showAddForm) {
      localStorage.setItem('draft_zone_name', name);
      localStorage.setItem('draft_zone_lat', String(lat));
      localStorage.setItem('draft_zone_lng', String(lng));
      localStorage.setItem('draft_zone_radius', String(radius));
      localStorage.setItem('draft_zone_level', level);
    }
  }, [showAddForm, name, lat, lng, radius, level]);

  const clearZoneDraftFromStorage = () => {
    localStorage.removeItem('draft_zone_name');
    localStorage.removeItem('draft_zone_lat');
    localStorage.removeItem('draft_zone_lng');
    localStorage.removeItem('draft_zone_radius');
    localStorage.removeItem('draft_zone_level');
  };

  const handleExportJSON = () => {
    try {
      const dataStr = JSON.stringify(riskZones, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', url);
      linkElement.setAttribute('download', 'wealthflow-zonas-de-risco.json');
      linkElement.click();
      
      URL.revokeObjectURL(url);
      if (showAlert) {
        showAlert("Exportação Concluída", "Sua lista de Zonas de Risco foi exportada com sucesso.");
      }
    } catch (err) {
      if (showAlert) {
        showAlert("Erro na Exportação", "Não foi possível exportar as zonas de risco.");
      }
    }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = e.target.files?.[0];
    if (!file) return;

    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!Array.isArray(parsed)) {
          if (showAlert) {
            showAlert("Formato Inválido", "O arquivo JSON deve conter uma lista (array) de áreas de risco.");
          }
          return;
        }

        let importCount = 0;
        let skipCount = 0;

        parsed.forEach((item: any) => {
          const nomeLocal = item.nomeLocal || item.nome || item.name;
          const latitude = parseFloat(item.latitude ?? item.lat);
          const longitude = parseFloat(item.longitude ?? item.lng);
          
          if (!nomeLocal || isNaN(latitude) || isNaN(longitude)) {
            skipCount++;
            return;
          }

          // Check duplicate
          const exists = riskZones.some(z => 
            z.nomeLocal.toUpperCase() === nomeLocal.toUpperCase() || 
            (Math.abs(z.latitude - latitude) < 0.0001 && Math.abs(z.longitude - longitude) < 0.0001)
          );

          if (exists) {
            skipCount++;
            return;
          }

          const rawRadius = item.raioMetros ?? item.radius ?? item.raio ?? '300';
          const radiusVal = parseInt(rawRadius, 10);
          const rawLevel = (item.nivelRisco || item.level || item.nivel || 'ALTO').toUpperCase();
          const levelVal = (rawLevel === 'ALTO' || rawLevel === 'MEDIO' || rawLevel === 'BAIXO') ? rawLevel : 'ALTO';

          onAddRiskZone({
            localizacao: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
            latitude,
            longitude,
            dataRegistro: item.dataRegistro || new Date().toLocaleDateString('pt-BR'),
            dataHora: item.dataHora || `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
            status: levelVal === 'ALTO' ? '⚠️ EM ÁREA DE RISCO!' : '✅ Seguro',
            nomeLocal: nomeLocal.toUpperCase(),
            raioMetros: isNaN(radiusVal) ? 300 : radiusVal,
            nivelRisco: levelVal as any,
            statusGeral: levelVal === 'ALTO' ? 'DISPARAR' : 'VAZIO',
            ativo: item.ativo !== undefined ? !!item.ativo : (item.active !== undefined ? !!item.active : true),
            mensagem: item.mensagem,
            som: item.som,
            voz: item.voz,
            sentido: item.sentido
          });

          importCount++;
        });

        if (showAlert) {
          if (importCount > 0) {
            showAlert(
              "Importação Concluída", 
              `Sucesso! ${importCount} novas áreas de risco foram adicionadas.${skipCount > 0 ? ` (${skipCount} ignoradas por duplicidade ou formato incorreto).` : ''}`
            );
          } else {
            showAlert(
              "Importação", 
              `Nenhuma nova área de risco foi importada. Todas as ${skipCount} áreas já existem ou possuem formato inválido.`
            );
          }
        }
        
        e.target.value = '';
      } catch (err) {
        if (showAlert) {
          showAlert("Erro na Importação", "Não foi possível processar o arquivo. Verifique se é um arquivo JSON válido.");
        }
      }
    };

    fileReader.readAsText(file);
  };

  const loadZoneDraft = () => {
    setName(localStorage.getItem('draft_zone_name') || '');
    setLat(parseFloat(localStorage.getItem('draft_zone_lat') || String(vehicleLat)));
    setLng(parseFloat(localStorage.getItem('draft_zone_lng') || String(vehicleLng)));
    setRadius(parseInt(localStorage.getItem('draft_zone_radius') || '300', 10));
    const val = localStorage.getItem('draft_zone_level') as any;
    setLevel((val === 'ALTO' || val === 'MEDIO' || val === 'BAIXO') ? val : 'ALTO');
  };

  // Radar Modes: 'REAL' (GPS tracker + manual overrides) vs 'SIMULATOR' (smooth automatic route traversing)
  const [radarMode, setRadarMode] = useState<'REAL' | 'SIMULATOR'>('REAL');
  const [vehicleLat, setVehicleLat] = useState<number>(-22.89676); // Starts at Vila Brandina
  const [vehicleLng, setVehicleLng] = useState<number>(-47.02577);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isWatchingGps, setIsWatchingGps] = useState<boolean>(false);
  const [simulationStatus, setSimulationStatus] = useState<string>('📡 Obtendo coordenadas GPS...');
  const [currentAlertZone, setCurrentAlertZone] = useState<string | null>(null);

  // Background monitoring states & preferences
  const [notificationPermission, setNotificationPermission] = useState<string>('default');
  const [enableVoiceAlert, setEnableVoiceAlert] = useState<boolean>(true);
  const [lastNotifiedZoneId, setLastNotifiedZoneId] = useState<number | null>(null);
  const [highPriorityBackground, setHighPriorityBackground] = useState<boolean>(false);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const wakeLockRef = useRef<any>(null);
  const audioKeepAliveRef = useRef<HTMLAudioElement | null>(null);
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize silent keep-alive and background alarm beep URLs on mount
  useEffect(() => {
    let silentUrl = '';
    let alarmUrl = '';
    
    if (audioKeepAliveRef.current) {
      silentUrl = createSilentWavUrl();
      audioKeepAliveRef.current.src = silentUrl;
    }
    
    if (alarmAudioRef.current) {
      alarmUrl = createBeepWavUrl(980, 0.4); // 980Hz high-frequency warning beep, 0.4s long
      alarmAudioRef.current.src = alarmUrl;
    }
    
    return () => {
      if (silentUrl) URL.revokeObjectURL(silentUrl);
      if (alarmUrl) URL.revokeObjectURL(alarmUrl);
    };
  }, []);

  // Simulation step states
  const [simIndex, setSimIndex] = useState<number>(0);
  const [simRatio, setSimRatio] = useState<number>(0);

  // Sync current notification permission state and register Service Worker for robust background alerts
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
    
    // Register background Service Worker for mobile browsers background push/notifications support
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('Service Worker registrado com sucesso:', reg);
        })
        .catch((err) => {
          console.warn('Falha ao registrar Service Worker:', err);
        });
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        if (permission === 'granted') {
          // Attempt to show notification via service worker if available, otherwise fallback
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((reg) => {
              reg.showNotification("📡 Alertas Ativos", {
                body: "Você receberá notificações em tempo real ao se aproximar de perímetros de risco, mesmo com o aplicativo minimizado ou em segundo plano!",
                vibrate: [200, 100, 200]
              } as any);
            }).catch(() => {
              new Notification("📡 Alertas Ativos", {
                body: "Você receberá notificações em tempo real ao se aproximar de perímetros de risco, mesmo se o aplicativo estiver em segundo plano!",
              });
            });
          } else {
            new Notification("📡 Alertas Ativos", {
              body: "Você receberá notificações em tempo real ao se aproximar de perímetros de risco, mesmo se o aplicativo estiver em segundo plano!",
            });
          }
        }
      } catch (err) {
        console.error("Erro ao solicitar permissão de notificação:", err);
      }
    } else {
      alert("Este navegador não suporta notificações de sistema.");
    }
  };

  // Predefined route points for simulation around Campinas
  const simulatedPath = [
    { lat: -22.8800, lng: -47.0400, name: 'CD Central' },
    { lat: -22.8900, lng: -47.0355, name: 'Rodovia D. Pedro I' },
    { lat: -22.89676, lng: -47.02577, name: 'Vila Brandina' }, // ALTO RISCO
    { lat: -22.9100, lng: -47.0450, name: 'Centro de Monitoramento' },
    { lat: -22.9300, lng: -47.0200, name: 'Avenida Norte-Sul' },
    { lat: -22.94225, lng: -46.99587, name: 'Minha Casa Teste' }, // ALTO RISCO
    { lat: -22.9600, lng: -47.0100, name: 'Anel Viário' },
    { lat: -22.90453, lng: -47.05495, name: 'Zelo Monitoramento' },
  ];

  // Use ref for playing alarms safely
  const audioContextRef = useRef<AudioContext | null>(null);

  // Play a beautiful premium alarm beep sound using Web Audio API & HTML5 backup
  const triggerAlarmBeep = () => {
    // 1. Web Audio API beep (For high-quality synthesizer sweep in foreground)
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 frequency
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15); // descending sweep
      
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.log('Audio Context restricted until user interacts', e);
    }

    // 2. HTML5 Warning Beep (Highly durable, unthrottled warning buzzer for background)
    if (alarmAudioRef.current) {
      try {
        const audio = alarmAudioRef.current;
        const previousLoop = audio.loop;
        audio.loop = false; // single beep for test button
        audio.volume = 0.8;
        audio.currentTime = 0;
        audio.play().then(() => {
          // Restore loop setting and volume when it ends, or after 1.5 seconds
          setTimeout(() => {
            if (alarmAudioRef.current) {
              alarmAudioRef.current.loop = previousLoop;
              if (!currentAlertZone) {
                alarmAudioRef.current.volume = 0;
                alarmAudioRef.current.pause();
              } else {
                alarmAudioRef.current.volume = 0.8;
                alarmAudioRef.current.loop = true;
                alarmAudioRef.current.play().catch(o => console.warn(o));
              }
            }
          }, 1500);
        }).catch(e => console.warn("HTML5 background beep failed:", e));
      } catch (e) {
        console.warn("HTML5 background play error:", e);
      }
    }
  };

  // 1b. Dedicated Radar Alarm Sound Manager (Controls looping alarm beeps smoothly and silences completely when safe)
  useEffect(() => {
    const alarmAudio = alarmAudioRef.current;
    if (!alarmAudio) return;

    if (currentAlertZone) {
      console.log(`🚨 Alarm active for zone: ${currentAlertZone}`);
      try {
        alarmAudio.loop = true; // Loop the alarm beep smoothly when inside a risk zone
        alarmAudio.volume = 0.8; // Set high audible volume
        alarmAudio.currentTime = 0; // Start from beginning
        alarmAudio.play().catch(e => {
          console.warn("Could not play alarm audio (interaction required):", e);
        });
      } catch (err) {
        console.error("Alarm audio playback error:", err);
      }
    } else {
      console.log("✅ Alarm inactive (clear of risk zones)");
      try {
        if (highPriorityBackground) {
          // Keep it playing at volume 0 (completely silent) in the background so browser session is preserved
          alarmAudio.volume = 0;
          alarmAudio.loop = true;
        } else {
          // Pause completely when in the foreground and safe
          alarmAudio.pause();
          alarmAudio.currentTime = 0;
          alarmAudio.volume = 0;
        }
      } catch (err) {
        console.warn("Alarm audio cleanup error:", err);
      }
    }
  }, [currentAlertZone, highPriorityBackground]);

  // 1. Geolocation Watcher for Real GPS mode
  useEffect(() => {
    if (radarMode !== 'REAL') {
      setGpsError(null);
      return;
    }
    
    if (!navigator.geolocation) {
      setGpsError("Geolocalização não é suportada por este dispositivo.");
      return;
    }
    
    setIsWatchingGps(true);
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setVehicleLat(position.coords.latitude);
        setVehicleLng(position.coords.longitude);
        setGpsError(null);
      },
      (error) => {
        console.warn("GPS watch position error:", error);
        let errorMsg = "Localização real GPS indisponível.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = "Permissão de GPS negada. Ative nas configurações ou utilize os controles virtuais abaixo.";
        }
        setGpsError(errorMsg);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0, // Force fresh coordinates instantly without cache
        timeout: 15000 // Balanced timeout for mobile GPS sensors
      }
    );
    
    return () => {
      navigator.geolocation.clearWatch(watchId);
      setIsWatchingGps(false);
    };
  }, [radarMode]);

  // 1b. Geolocation watchdog backup for High-Priority Background Mode
  useEffect(() => {
    if (!highPriorityBackground || radarMode !== 'REAL') return;

    const intervalId = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log("Watchdog GPS background update:", position.coords.latitude, position.coords.longitude);
            setVehicleLat(position.coords.latitude);
            setVehicleLng(position.coords.longitude);
            setGpsError(null);
          },
          (error) => {
            console.warn("Watchdog GPS background error:", error);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000
          }
        );
      }
    }, 10000); // every 10 seconds

    return () => clearInterval(intervalId);
  }, [highPriorityBackground, radarMode]);

  // 1c. Re-acquire Wake Lock & restore audio keep-alive when page visibility changes
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (highPriorityBackground) {
        if (document.visibilityState === 'visible') {
          // Re-acquire Wake Lock
          if ('wakeLock' in navigator) {
            try {
              wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
              setWakeLockActive(true);
              console.log("Wake Lock re-acquired successfully!");
            } catch (err) {
              console.warn("Re-acquiring Wake Lock failed:", err);
            }
          }
        }
        
        // Always attempt to restore or keep silent audio running
        if (audioKeepAliveRef.current && audioKeepAliveRef.current.paused) {
          try {
            audioKeepAliveRef.current.volume = 0.05;
            await audioKeepAliveRef.current.play();
            console.log("Silent audio keep-alive restarted on visibility change!");
          } catch (e) {
            console.warn("Silent audio keep-alive restart failed:", e);
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [highPriorityBackground]);

  // 1d. Auto-cleanup Wake Lock on unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch((e: any) => console.log("WakeLock release error:", e));
      }
    };
  }, []);

  // 1d-2. Automatic retry hook to guarantee background loop is never stopped by OS
  useEffect(() => {
    const audio = audioKeepAliveRef.current;
    const alarmAudio = alarmAudioRef.current;

    const handleAutoRestart = () => {
      if (highPriorityBackground) {
        if (audio && audio.paused) {
          audio.play().catch(e => console.warn("Auto-play background keepalive failed:", e));
        }
        if (alarmAudio && alarmAudio.paused) {
          alarmAudio.play().catch(e => console.warn("Auto-play background alarm failed:", e));
        }
      }
    };

    if (audio) {
      audio.addEventListener('pause', handleAutoRestart);
      audio.addEventListener('ended', handleAutoRestart);
    }
    if (alarmAudio) {
      alarmAudio.addEventListener('pause', handleAutoRestart);
      alarmAudio.addEventListener('ended', handleAutoRestart);
    }
    
    return () => {
      if (audio) {
        audio.removeEventListener('pause', handleAutoRestart);
        audio.removeEventListener('ended', handleAutoRestart);
      }
      if (alarmAudio) {
        alarmAudio.removeEventListener('pause', handleAutoRestart);
        alarmAudio.removeEventListener('ended', handleAutoRestart);
      }
    };
  }, [highPriorityBackground]);

  // 1e. Toggle High-Priority Background Mode (Silent Audio + Wake Lock)
  const toggleHighPriorityBackground = async () => {
    const nextState = !highPriorityBackground;
    setHighPriorityBackground(nextState);
    
    if (nextState) {
      // Resume or warm up the Audio Context
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(e => console.log("Warm up failed:", e));
      }

      // Try playing audio keep-alive
      if (audioKeepAliveRef.current) {
        try {
          audioKeepAliveRef.current.volume = 0.05; // active volume
          await audioKeepAliveRef.current.play();
          console.log("Silent audio keep-alive playing successfully!");
        } catch (e) {
          console.warn("Silent audio keep-alive play failed (needs interaction first):", e);
        }
      }

      // Try playing alarm audio silently in the background so it's ready
      if (alarmAudioRef.current) {
        try {
          alarmAudioRef.current.volume = 0.001; // extremely low, inaudible volume
          await alarmAudioRef.current.play();
          console.log("Alarm background audio playing silently successfully!");
        } catch (e) {
          console.warn("Alarm background audio play failed:", e);
        }
      }
      
      // Request Wake Lock
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          setWakeLockActive(true);
          console.log("Wake Lock acquired successfully!");
        } catch (err) {
          console.warn("Erro ao adquirir Wake Lock:", err);
        }
      }
    } else {
      // Pause audio
      if (audioKeepAliveRef.current) {
        try {
          audioKeepAliveRef.current.pause();
        } catch (e) {
          console.warn(e);
        }
      }
      if (alarmAudioRef.current) {
        try {
          alarmAudioRef.current.pause();
          alarmAudioRef.current.volume = 0;
        } catch (e) {
          console.warn(e);
        }
      }
      
      // Release Wake Lock
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
          setWakeLockActive(false);
          console.log("Wake Lock released successfully!");
        } catch (err) {
          console.warn(err);
        }
      }
    }
  };

  // 2. Automatic Route Simulator loop
  useEffect(() => {
    if (radarMode !== 'SIMULATOR') return;

    const interval = setInterval(() => {
      setSimRatio((prev) => {
        const next = prev + 0.04;
        if (next >= 1) {
          setSimIndex((idx) => (idx + 1) % simulatedPath.length);
          return 0;
        }
        return next;
      });
    }, 450);

    return () => clearInterval(interval);
  }, [radarMode]);

  // Smooth route interpolation
  useEffect(() => {
    if (radarMode !== 'SIMULATOR') return;
    const start = simulatedPath[simIndex];
    const end = simulatedPath[(simIndex + 1) % simulatedPath.length];
    
    const nextLat = start.lat + (end.lat - start.lat) * simRatio;
    const nextLng = start.lng + (end.lng - start.lng) * simRatio;
    
    setVehicleLat(nextLat);
    setVehicleLng(nextLng);
  }, [simIndex, simRatio, radarMode]);

  // 3. Distance calculation (Haversine Formula)
  const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000; // Earth radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // inside meters
  };

  // 4. Proximity alarms & alerting trigger
  useEffect(() => {
    let alertingZone: RiskZone | null = null;
    let shortestDist = Infinity;
    const activeZones = riskZones.filter(z => z.ativo);

    activeZones.forEach((zone) => {
      const dist = getDistanceInMeters(vehicleLat, vehicleLng, zone.latitude, zone.longitude);
      const threshold = zone.raioMetros > 0 ? zone.raioMetros : 350;

      if (dist <= threshold) {
        if (zone.nivelRisco === 'ALTO') {
          alertingZone = zone;
        }
      }
      if (dist < shortestDist) {
        shortestDist = dist;
      }
    });

    if (alertingZone) {
      const zoneName = alertingZone.nomeLocal;
      const zoneId = alertingZone.id;
      setSimulationStatus(`🚨 ALERTA RADAR: VEÍCULO EM ${zoneName}!`);
      setCurrentAlertZone(zoneName);

      // Trigger Web Notification & Speech Synthesis if it is a new zone entry
      if (lastNotifiedZoneId !== zoneId) {
        setLastNotifiedZoneId(zoneId);

        // Register passage in history
        const now = new Date();
        const newRecord: PassageRecord = {
          id: `hist-${zoneId}-${now.getTime()}`,
          zoneId: zoneId,
          zoneName: zoneName,
          timestamp: now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR'),
          hour: now.getHours(),
          dayOfWeek: now.getDay(),
          nivelRisco: alertingZone ? alertingZone.nivelRisco : 'ALTO'
        };
        setPassageHistory(prev => [newRecord, ...prev]);

        // In-app visual alert modal
        if (showAlert) {
          showAlert(
            "🚨 ALERTA DE RISCO CRÍTICO!",
            `Atenção! Você entrou na zona de risco alto: "${zoneName}". Redobre o cuidado e evite paradas.`
          );
        }

        // Standard System Notification (pops up even if minimized / in background)
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then((reg) => {
                reg.showNotification(`🚨 ALERTA DE RISCO CRÍTICO!`, {
                  body: `Atenção! Você está se aproximando do perímetro de risco: ${zoneName}. Redobre o cuidado.`,
                  tag: `risk-zone-${zoneId}`,
                  renotify: true,
                  requireInteraction: true,
                  vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40]
                } as any);
              }).catch(() => {
                new Notification(`🚨 ALERTA DE RISCO CRÍTICO!`, {
                  body: `Atenção! Você está se aproximando do perímetro de risco: ${zoneName}. Redobre o cuidado.`,
                  requireInteraction: true
                });
              });
            } else {
              new Notification(`🚨 ALERTA DE RISCO CRÍTICO!`, {
                body: `Atenção! Você está se aproximando do perímetro de risco: ${zoneName}. Redobre o cuidado.`,
                requireInteraction: true
              });
            }
          } catch (err) {
            console.warn("Could not fire standard notification:", err);
          }
        }

        // Speech Alert (voice synthesis speaks even in background or pocket)
        if (enableVoiceAlert && typeof window !== 'undefined' && 'speechSynthesis' in window) {
          try {
            window.speechSynthesis.cancel(); // cancel current speech queue to keep it immediate
            const msg = new SpeechSynthesisUtterance(`Atenção! Você está entrando no perímetro de risco: ${zoneName.toLowerCase()}.`);
            msg.lang = 'pt-BR';
            msg.volume = 1.0;
            msg.rate = 1.0;
            window.speechSynthesis.speak(msg);
          } catch (err) {
            console.error("Speech Synthesis failed:", err);
          }
        }
      }
    } else {
      setCurrentAlertZone(null);
      setLastNotifiedZoneId(null); // Reset alert lock when clear of all risk zones
      if (shortestDist < Infinity && shortestDist > 0) {
        const distKm = (shortestDist / 1000).toFixed(2);
        setSimulationStatus(`✅ Radar Seguro (Mais próximo a ${distKm} km)`);
      } else {
        setSimulationStatus('✅ Em trânsito seguro');
      }
    }
  }, [vehicleLat, vehicleLng, riskZones, lastNotifiedZoneId, enableVoiceAlert]);

  // Auto-fill custom risk zone coordinates on form open only if there is no draft
  useEffect(() => {
    if (showAddForm) {
      const hasDraftLat = localStorage.getItem('draft_zone_lat');
      const hasDraftLng = localStorage.getItem('draft_zone_lng');
      if (hasDraftLat === null) {
        setLat(vehicleLat);
      }
      if (hasDraftLng === null) {
        setLng(vehicleLng);
      }
    }
  }, [showAddForm, vehicleLat]);

  // Fetch coordinates and address for the add form
  const handleFetchCurrentLocationForForm = () => {
    if (!navigator.geolocation) {
      if (showAlert) {
        showAlert('Não suportado', 'A geolocalização não é suportada pelo seu navegador.');
      } else {
        alert('A geolocalização não é suportada pelo seu navegador.');
      }
      return;
    }

    setIsFetchingFormLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLat(latitude);
        setLng(longitude);
        
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
            {
              headers: {
                'Accept-Language': 'pt-BR,pt;q=0.9',
                'User-Agent': 'FluxoDeRiqueza/1.0'
              }
            }
          );
          if (response.ok) {
            const data = await response.json();
            if (data && data.address) {
              const addr = data.address;
              const street = addr.road || addr.pedestrian || addr.suburb || '';
              const number = addr.house_number || '';
              const city = addr.city || addr.town || addr.village || '';
              const state = addr.state ? addr.state.substring(0, 2).toUpperCase() : '';
              
              let formattedAddress = '';
              if (street) {
                formattedAddress += street;
                if (number) formattedAddress += `, ${number}`;
              }
              if (city) {
                if (formattedAddress) formattedAddress += ' - ';
                formattedAddress += city;
                if (state) formattedAddress += `/${state}`;
              }

              if (!formattedAddress && data.display_name) {
                formattedAddress = data.display_name.split(',').slice(0, 3).join(',').trim();
              }

              if (formattedAddress) {
                setName(formattedAddress.toUpperCase());
              }
            } else if (data && data.display_name) {
              const shortName = data.display_name.split(',').slice(0, 3).join(',').trim();
              setName(shortName.toUpperCase());
            }
          }
        } catch (error) {
          console.error("Erro ao obter endereço descritivo:", error);
        } finally {
          setIsFetchingFormLocation(false);
        }
      },
      (error) => {
        console.error("Erro ao buscar coordenadas:", error);
        let errorMsg = 'Erro ao obter localização.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Permissão negada pelo usuário.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Sinal de GPS indisponível.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Tempo esgotado ao buscar localização.';
        }
        if (showAlert) {
          showAlert('Erro de Localização', errorMsg);
        } else {
          alert(errorMsg);
        }
        setIsFetchingFormLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Submit new risk zone
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Por favor, digite o nome do local de risco.");
      return;
    }

    onAddRiskZone({
      localizacao: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      latitude: lat,
      longitude: lng,
      dataRegistro: new Date().toLocaleDateString('pt-BR'),
      dataHora: `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
      status: level === 'ALTO' ? '⚠️ EM ÁREA DE RISCO!' : '✅ Seguro',
      nomeLocal: name.toUpperCase(),
      raioMetros: radius,
      nivelRisco: level,
      statusGeral: level === 'ALTO' ? 'DISPARAR' : 'VAZIO',
      ativo: true
    });

    setName('');
    clearZoneDraftFromStorage();
    setShowAddForm(false);
  };

  // Edit existing risk zone
  const handleStartEdit = (zone: RiskZone) => {
    setEditingZone(zone);
    setEditName(zone.nomeLocal);
    setEditLat(zone.latitude);
    setEditLng(zone.longitude);
    setEditRadius(zone.raioMetros);
    setEditLevel(zone.nivelRisco);
    setShowAddForm(false); // Close add form if open
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingZone) return;
    if (!editName.trim()) {
      if (showAlert) {
        showAlert("Campo Obrigatório", "Por favor, digite o nome do local de risco.");
      } else {
        alert("Por favor, digite o nome do local de risco.");
      }
      return;
    }

    onEditRiskZone(editingZone.id, {
      localizacao: `${editLat.toFixed(5)}, ${editLng.toFixed(5)}`,
      latitude: editLat,
      longitude: editLng,
      status: editLevel === 'ALTO' ? '⚠️ EM ÁREA DE RISCO!' : '✅ Seguro',
      nomeLocal: editName.toUpperCase(),
      raioMetros: editRadius,
      nivelRisco: editLevel,
      statusGeral: editLevel === 'ALTO' ? 'DISPARAR' : 'VAZIO'
    });

    setEditingZone(null);
    if (showAlert) {
      showAlert("Sucesso", "Perímetro de risco atualizado com sucesso!");
    }
  };

  const handleDeleteClick = (id: number, nameLocal: string) => {
    const performDelete = () => {
      onDeleteRiskZone(id);
      if (editingZone?.id === id) {
        setEditingZone(null);
      }
    };

    if (showConfirm) {
      showConfirm(
        "Excluir Perímetro de Risco",
        `Tem certeza que deseja excluir permanentemente o perímetro "${nameLocal}"? Esta ação é irreversível.`,
        performDelete,
        nameLocal
      );
    } else {
      const typed = window.prompt(`Tem certeza que deseja excluir permanentemente o perímetro "${nameLocal}"?\n\nPara confirmar, digite exatamente o nome do perímetro:`);
      if (typed !== null && typed.trim().toLowerCase() === nameLocal.trim().toLowerCase()) {
        performDelete();
      } else if (typed !== null) {
        if (showAlert) showAlert("Erro", "Nome informado não confere. Exclusão cancelada.");
      }
    }
  };

  // Searching and Filtering
  const filteredZones = riskZones.filter(z => {
    const query = searchTerm.toLowerCase();
    const matchesSearch = z.nomeLocal.toLowerCase().includes(query) || z.localizacao.includes(query);
    const matchesLevel = filterLevel === 'todos' || z.nivelRisco === filterLevel;
    const matchesActive = !hideInactive || z.ativo;
    return matchesSearch && matchesLevel && matchesActive;
  });

  // Dynamic Bounding Box Projection System for the radar map representation
  const defaultMinLat = -22.98;
  const defaultMaxLat = -22.88;
  const defaultMinLng = -47.22;
  const defaultMaxLng = -46.98;

  const activeZonesOnMap = riskZones.filter(z => z.ativo);
  let minLat = defaultMinLat;
  let maxLat = defaultMaxLat;
  let minLng = defaultMinLng;
  let maxLng = defaultMaxLng;

  const pointsToFit = activeZonesOnMap.map(z => ({ lat: z.latitude, lng: z.longitude }));
  pointsToFit.push({ lat: vehicleLat, lng: vehicleLng });

  if (pointsToFit.length > 0) {
    const lats = pointsToFit.map(p => p.lat);
    const lngs = pointsToFit.map(p => p.lng);
    
    const calMinLat = Math.min(...lats);
    const calMaxLat = Math.max(...lats);
    const calMinLng = Math.min(...lngs);
    const calMaxLng = Math.max(...lngs);

    const latDiff = Math.max(calMaxLat - calMinLat, 0.015);
    const lngDiff = Math.max(calMaxLng - calMinLng, 0.025);
    
    minLat = calMinLat - latDiff * 0.25;
    maxLat = calMaxLat + latDiff * 0.25;
    minLng = calMinLng - lngDiff * 0.25;
    maxLng = calMaxLng + lngDiff * 0.25;
  }

  const getXYPercentage = (latitude: number, longitude: number) => {
    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    
    const x = lngDiff === 0 ? 50 : ((longitude - minLng) / lngDiff) * 80 + 10;
    const y = latDiff === 0 ? 50 : (1 - (latitude - minLat) / latDiff) * 80 + 10;
    
    return { x, y };
  };

  const heatmapSvgRef = useRef<SVGSVGElement | null>(null);

  // Time blocks definition (2-hour blocks)
  const TIME_BLOCKS = [
    "00-02", "02-04", "04-06", "06-08", "08-10", "10-12",
    "12-14", "14-16", "16-18", "18-20", "20-22", "22-00"
  ];

  const getBlockIndex = (hour: number) => {
    return Math.floor(hour / 2) % 12;
  };

  useEffect(() => {
    if (!heatmapSvgRef.current) return;

    // Filter zones to show on heatmap (only high risk zones or historically visited ones)
    const zonesToShow = Array.from(new Set([
      ...riskZones.filter(z => z.nivelRisco === 'ALTO').map(z => z.nomeLocal.toUpperCase()),
      ...passageHistory.map(h => h.zoneName.toUpperCase())
    ])).slice(0, 10); // show top 10 for absolute clarity

    if (zonesToShow.length === 0) {
      zonesToShow.push("SEM ZONAS");
    }

    // Build grid data
    const gridData: Array<{ zone: string; block: string; blockIdx: number; count: number }> = [];
    zonesToShow.forEach(zone => {
      TIME_BLOCKS.forEach((block, blockIdx) => {
        const count = passageHistory.filter(h => {
          return h.zoneName.toUpperCase() === zone && getBlockIndex(h.hour) === blockIdx;
        }).length;
        gridData.push({ zone, block, blockIdx, count });
      });
    });

    // Clear previous elements
    const svgEl = d3.select(heatmapSvgRef.current);
    svgEl.selectAll("*").remove();

    // Setup margins & sizing
    const margin = { top: 35, right: 15, bottom: 35, left: 145 };
    const width = 640 - margin.left - margin.right;
    const height = (zonesToShow.length * 36) + 15;
    
    const totalWidth = width + margin.left + margin.right;
    const totalHeight = height + margin.top + margin.bottom;

    // Apply viewBox to make it fluid & responsive
    svgEl
      .attr("viewBox", `0 0 ${totalWidth} ${totalHeight}`)
      .attr("width", "100%")
      .attr("height", "100%");

    const g = svgEl.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // X scale (band)
    const xScale = d3.scaleBand()
      .domain(TIME_BLOCKS)
      .range([0, width])
      .padding(0.06);

    // Y scale (band)
    const yScale = d3.scaleBand()
      .domain(zonesToShow)
      .range([0, height])
      .padding(0.06);

    const maxCount = d3.max(gridData, d => d.count) || 1;

    // Color interpolation scale
    // Start with a dark slate background, going up to orange/crimson for high frequencies
    const colorScale = d3.scaleLinear<string>()
      .domain([0, 1, maxCount * 0.4, maxCount])
      .range(["#1e293b", "#3b82f640", "#f59e0b", "#ef4444"]);

    // Draw X-axis
    g.append("g")
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(xScale).tickSize(0))
      .select(".domain").remove();

    g.selectAll(".tick text")
      .attr("class", "text-[10px] font-mono fill-slate-400 font-bold")
      .attr("dy", "12px");

    // Draw Y-axis
    g.append("g")
      .call(d3.axisLeft(yScale).tickSize(0))
      .select(".domain").remove();

    g.selectAll("g.tick text")
      .attr("class", "text-[10px] font-mono fill-slate-300 font-bold")
      .attr("dx", "-8px")
      .each(function() {
        const textElement = d3.select(this);
        const originalText = textElement.text();
        if (originalText.length > 20) {
          textElement.text(originalText.slice(0, 18) + "...");
        }
      });

    // Draw heatmap rects
    const cells = g.selectAll(".cell")
      .data(gridData)
      .enter()
      .append("g")
      .attr("class", "cell");

    cells.append("rect")
      .attr("x", d => xScale(d.block) || 0)
      .attr("y", d => yScale(d.zone) || 0)
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("width", xScale.bandwidth())
      .attr("height", yScale.bandwidth())
      .style("fill", d => d.count === 0 ? "#0f172a" : colorScale(d.count))
      .style("stroke", d => d.count === 0 ? "#1e293b" : "#f59e0b40")
      .style("stroke-width", "1px")
      .style("cursor", "pointer")
      .style("transition", "all 0.15s ease")
      .on("mouseover", function() {
        d3.select(this)
          .style("stroke", "#ffffff")
          .style("stroke-width", "2px")
          .style("filter", "brightness(1.25)");
      })
      .on("mouseout", function(event, d) {
        d3.select(this)
          .style("stroke", d.count === 0 ? "#1e293b" : "#f59e0b40")
          .style("stroke-width", "1px")
          .style("filter", "none");
      });

    // Add tooltips
    cells.append("title")
      .text(d => `${d.zone}\nHorário: ${d.block}h\nRegistros: ${d.count}`);

    // Add count overlay text
    cells.append("text")
      .attr("x", d => (xScale(d.block) || 0) + xScale.bandwidth() / 2)
      .attr("y", d => (yScale(d.zone) || 0) + yScale.bandwidth() / 2)
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .attr("class", "text-[10px] font-mono font-bold select-none pointer-events-none")
      .style("fill", d => d.count === 0 ? "#334155" : "#ffffff")
      .text(d => d.count > 0 ? d.count : "-");

    // Add X-axis title
    svgEl.append("text")
      .attr("x", margin.left + width / 2)
      .attr("y", totalHeight - 5)
      .attr("text-anchor", "middle")
      .attr("class", "text-[9px] font-mono fill-slate-500 uppercase tracking-wider font-semibold")
      .text("Faixas Horárias de Registro (Formato 24h)");

  }, [passageHistory, riskZones]);

  return (
    <div className="space-y-6 animate-fade-in" id="risk-zones-panel">
      {/* Alerta Visual de Risco Alto */}
      <AnimatePresence>
        {currentAlertZone && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-lg overflow-hidden animate-pulse relative"
            id="active-risk-zone-alert-banner"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/25 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                <ShieldAlert className="w-5 h-5 text-red-400" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-extrabold text-red-400 font-display uppercase tracking-wider">
                  ⚠️ ALERTA DE PERIGO IMINENTE!
                </h3>
                <p className="text-xs text-slate-200 mt-0.5 font-medium leading-relaxed">
                  Você entrou no perímetro de risco crítico: <strong className="text-white font-mono bg-red-950/60 px-2 py-0.5 rounded border border-red-500/20">{currentAlertZone}</strong>. Evite paradas e mantenha os vidros fechados.
                </p>
              </div>
            </div>
            <div className="hidden sm:block text-[9px] font-mono text-red-300 bg-red-500/20 border border-red-500/30 px-2.5 py-1 rounded-xl">
              RISCO CRÍTICO
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Banner and simulator toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white font-display uppercase tracking-wider flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-400" />
            Radar de Risco
          </h2>
          <p className="text-[10px] text-slate-400">Monitoramento de perímetros de segurança via GPS em tempo real.</p>
        </div>
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 self-start sm:self-auto shadow">
          <button
            onClick={() => setRadarMode('REAL')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer flex items-center gap-1 transition-all ${
              radarMode === 'REAL'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Locate className="w-3 h-3" />
            Radar Real
          </button>
          <button
            onClick={() => setRadarMode('SIMULATOR')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer flex items-center gap-1 transition-all ${
              radarMode === 'SIMULATOR'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Waypoints className="w-3 h-3" />
            Rota Simulada
          </button>
        </div>
      </div>

      {/* Background Alerts Control Panel */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 shadow-lg text-left overflow-hidden">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
            <BellRing className="w-5 h-5 text-amber-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display flex items-center gap-1.5">
              Alertas em Segundo Plano & Voz Ativa
            </h3>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Receba avisos imediatos por **notificação de sistema** e **voz ativa por sintetizador** quando estiver se aproximando de áreas críticas de risco, mesmo se o dispositivo estiver em segundo plano ou com a tela apagada.
            </p>
            <p className="text-[9px] text-emerald-400 font-mono flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              Dica: Clique no ícone de "Abrir em nova aba" no topo direito do AI Studio para garantir que o GPS e as notificações funcionem fora do iframe de visualização.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full xl:w-auto shrink-0">
          {notificationPermission !== 'granted' ? (
            <button
              type="button"
              onClick={requestNotificationPermission}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold uppercase tracking-wide rounded-xl transition-all flex items-center gap-1.5 shadow cursor-pointer active:scale-95"
            >
              <ShieldAlert className="w-4 h-4" />
              Ativar Notificações
            </button>
          ) : (
            <div className="px-3.5 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-pulse" />
              Notificações Ativas
            </div>
          )}

          <button
            type="button"
            onClick={() => setEnableVoiceAlert(!enableVoiceAlert)}
            className={`px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide border transition-all flex items-center gap-1.5 cursor-pointer ${
              enableVoiceAlert
                ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                : 'bg-slate-950 text-slate-500 border-slate-900 hover:text-slate-400'
            }`}
          >
            {enableVoiceAlert ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            {enableVoiceAlert ? 'Voz: Ativada' : 'Voz: Silenciada'}
          </button>

          <button
            type="button"
            onClick={() => {
              triggerAlarmBeep();
              if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                try {
                  window.speechSynthesis.cancel();
                  const testMsg = new SpeechSynthesisUtterance("Alerta de teste! O sistema de monitoramento em segundo plano está ativo.");
                  testMsg.lang = 'pt-BR';
                  window.speechSynthesis.speak(testMsg);
                } catch (err) {
                  console.error(err);
                }
              }
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                try {
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then((reg) => {
                      reg.showNotification("📡 Teste de Monitoramento", {
                        body: "Alerta de sistema configurado com sucesso para rodar em segundo plano!",
                        requireInteraction: false,
                        vibrate: [200, 100, 200]
                      } as any);
                    }).catch(() => {
                      new Notification("📡 Teste de Monitoramento", {
                        body: "Alerta de sistema configurado com sucesso para rodar em segundo plano!",
                        requireInteraction: false
                      });
                    });
                  } else {
                    new Notification("📡 Teste de Monitoramento", {
                      body: "Alerta de sistema configurado com sucesso para rodar em segundo plano!",
                      requireInteraction: false
                    });
                  }
                } catch (err) {
                  console.warn(err);
                }
              }
            }}
            className="px-3.5 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-[10px] font-bold uppercase tracking-wide rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <PlayCircle className="w-4 h-4" />
            Testar Alerta
          </button>
        </div>
      </div>

      {/* Elemento de Áudio Oculto para Keep-Alive */}
      <audio
        ref={audioKeepAliveRef}
        loop
        playsInline
        style={{ display: 'none' }}
      />

      {/* Elemento de Áudio Oculto para Alarme em Segundo Plano */}
      <audio
        ref={alarmAudioRef}
        loop
        playsInline
        style={{ display: 'none' }}
      />

      {/* High-Priority Background Mode (Anti-Sleep Guard) */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 shadow-lg text-left overflow-hidden">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl transition-all ${highPriorityBackground ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
            <Zap className={`w-5 h-5 ${highPriorityBackground ? 'animate-pulse text-emerald-400 font-bold' : 'text-slate-500'}`} />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display flex items-center gap-1.5 font-sans">
              Modo Trânsito Sem Paradas (Alta Prioridade)
              {highPriorityBackground && (
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-mono normal-case tracking-normal">
                  Ativo em 2º Plano
                </span>
              )}
            </h3>
            <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
              Evita que o smartphone durma ou congele o monitoramento de GPS. Mantém a <strong>tela ligada</strong> (Wake Lock) e simula <strong>reprodução de mídia silenciosa</strong> para forçar o navegador (Safari/Chrome) a rodar em segundo plano e disparar avisos de voz mesmo no seu bolso.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
              <span className="text-[9px] font-mono flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${wakeLockActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                Tela Sempre Ativa: <strong className={wakeLockActive ? 'text-emerald-400' : 'text-slate-400'}>{wakeLockActive ? 'ATIVADO' : 'DESATIVADO'}</strong>
              </span>
              <span className="text-[9px] font-mono flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${highPriorityBackground ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                Loop de Keep-Alive: <strong className={highPriorityBackground ? 'text-emerald-400' : 'text-slate-400'}>{highPriorityBackground ? 'ATIVADO' : 'DESATIVADO'}</strong>
              </span>
              <span className="text-[9px] font-mono flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${(highPriorityBackground && radarMode === 'REAL') ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                Watchdog de GPS: <strong className={(highPriorityBackground && radarMode === 'REAL') ? 'text-emerald-400' : 'text-slate-400'}>{(highPriorityBackground && radarMode === 'REAL') ? 'ATIVADO (10s)' : 'DESATIVADO'}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="w-full xl:w-auto shrink-0">
          <button
            type="button"
            onClick={toggleHighPriorityBackground}
            className={`w-full xl:w-auto px-4 py-2 text-[10px] font-bold uppercase tracking-wide rounded-xl transition-all flex items-center justify-center gap-1.5 shadow cursor-pointer active:scale-95 ${
              highPriorityBackground
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25 hover:bg-rose-500/20 hover:text-rose-300'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 hover:shadow-lg hover:shadow-emerald-500/10'
            }`}
          >
            {highPriorityBackground ? <ZapOff className="w-4 h-4 text-rose-400" /> : <Zap className="w-4 h-4 text-slate-950" />}
            {highPriorityBackground ? 'Desativar Alta Prioridade' : 'Ativar Alta Prioridade'}
          </button>
        </div>
      </div>

      {/* Simulator HUD overlay & Vector Radar Map */}
      <section className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
        {/* HUD Info bar */}
        <div className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-3 flex justify-between items-center z-10 relative">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${radarMode === 'REAL' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
            <span className="text-[10px] font-mono font-bold text-slate-300">
              {radarMode === 'REAL' ? 'GPS DISPOSITIVO' : 'ROTA AUTOMÁTICA'}
            </span>
          </div>
          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-tight transition-all ${
            currentAlertZone ? 'bg-red-500/20 text-red-400 animate-pulse border border-red-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}>
            {simulationStatus}
          </span>
        </div>

        {/* Vector SVG Stylized Metropolitan Radar Map Grid */}
        <div className="relative w-full h-80 bg-slate-950 flex items-center justify-center overflow-hidden">
          {/* Circular radar coordinates guides */}
          <div className="absolute w-[600px] h-[600px] border border-slate-900/30 rounded-full pointer-events-none" />
          <div className="absolute w-[400px] h-[400px] border border-slate-900/40 rounded-full pointer-events-none" />
          <div className="absolute w-[200px] h-[200px] border border-slate-900/60 rounded-full pointer-events-none" />
          
          {/* Axis cross lines */}
          <div className="absolute left-0 right-0 h-px bg-slate-900/30 pointer-events-none" />
          <div className="absolute top-0 bottom-0 w-px bg-slate-900/30 pointer-events-none" />

          {/* Grid lines SVG overlay */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.06]">
            <defs>
              <pattern id="radarGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#10b981" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#radarGrid)" />
          </svg>

          {/* Rotating radar sweep */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
            <div className="absolute inset-0 origin-center bg-gradient-to-tr from-emerald-500/0 via-emerald-500/0 to-emerald-500/5 animate-[spin_6s_linear_infinite]" style={{ transformOrigin: '50% 50%' }} />
          </div>

          {/* Dynamic Plotting of all active Risk Zones */}
          {activeZonesOnMap.map((zone) => {
            const { x, y } = getXYPercentage(zone.latitude, zone.longitude);
            const isAlerting = currentAlertZone === zone.nomeLocal;
            
            return (
              <div 
                key={zone.id}
                style={{ left: `${x}%`, top: `${y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-10"
              >
                {zone.nivelRisco === 'ALTO' ? (
                  <>
                    <div className={`absolute w-16 h-16 bg-red-500/10 rounded-full ${isAlerting ? 'animate-ping' : 'animate-pulse'} border border-red-500/10`} />
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full border border-white shadow-md shadow-red-500/40" />
                  </>
                ) : (
                  <>
                    <div className="absolute w-10 h-10 bg-amber-500/10 rounded-full border border-amber-500/20" />
                    <span className="w-2.5 h-2.5 bg-amber-500 rounded-full border border-white shadow-sm" />
                  </>
                )}
                <span className="mt-1.5 text-[8px] font-bold font-mono text-slate-300 bg-slate-950/95 px-1.5 py-0.5 rounded border border-slate-800 whitespace-nowrap shadow-md">
                  {zone.nomeLocal} {zone.nivelRisco === 'ALTO' ? '⚠️' : ''}
                </span>
              </div>
            );
          })}

          {/* Simulated or Real Fleet vehicle pointer marker */}
          {(() => {
            const { x, y } = getXYPercentage(vehicleLat, vehicleLng);
            return (
              <div 
                style={{ left: `${x}%`, top: `${y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 transition-all duration-300"
              >
                <div className="relative">
                  <span className="absolute -inset-2 bg-emerald-400/25 rounded-full animate-ping" />
                  <div className="w-5 h-5 rounded-full bg-emerald-400 border-2 border-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/50">
                    <Navigation className="w-2.5 h-2.5 text-slate-950 fill-slate-950" />
                  </div>
                </div>
                <div className="mt-1 bg-emerald-500 border border-emerald-400/50 text-slate-950 text-[8px] font-bold px-1.5 py-0.5 rounded font-mono shadow-md whitespace-nowrap">
                  {radarMode === 'REAL' ? 'MEU GPS' : 'SIMULADOR'}
                </div>
              </div>
            );
          })()}

          {/* Warning Indicator Overlay */}
          {currentAlertZone && (
            <div className="absolute inset-0 bg-red-950/15 pointer-events-none border border-red-500/40 animate-pulse z-10" />
          )}
        </div>
      </section>

      {/* GPS Virtual Controller when Radar Real mode is active */}
      {radarMode === 'REAL' && (
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl space-y-3 shadow-lg">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Locate className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-display">Ajuste de GPS Virtual (Testes)</h4>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              {gpsError 
                ? <span className="text-rose-400 font-bold">{gpsError}</span>
                : <span>Obtendo coordenadas do dispositivo. Você também pode clicar nos atalhos para se teletransportar no radar e testar os alertas.</span>
              }
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setVehicleLat(-22.89676);
                setVehicleLng(-47.02577);
                setGpsError(null);
              }}
              className="py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              📍 Vila Brandina (Risco)
            </button>
            <button
              type="button"
              onClick={() => {
                setVehicleLat(-22.94225);
                setVehicleLng(-46.99587);
                setGpsError(null);
              }}
              className="py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              📍 Minha Casa (Risco)
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setVehicleLat(-22.90453);
                setVehicleLng(-47.05495);
                setGpsError(null);
              }}
              className="py-2.5 bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer"
            >
              🟢 Área Segura (Centro)
            </button>
            <button
              type="button"
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setVehicleLat(pos.coords.latitude);
                      setVehicleLng(pos.coords.longitude);
                      setGpsError(null);
                    },
                    () => {
                      setGpsError("Permissão de GPS negada.");
                    }
                  );
                }
              }}
              className="py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5" />
              Obter GPS Atual
            </button>
          </div>

          {/* Precision Sliders for coordinates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-slate-800/50">
            <div className="space-y-1 text-left">
              <div className="flex justify-between text-[9px] font-mono text-slate-400">
                <span>Latitude Manual:</span>
                <span className="text-white font-bold font-mono">{vehicleLat.toFixed(5)}</span>
              </div>
              <input 
                type="range"
                min="-23.05"
                max="-22.82"
                step="0.0001"
                value={vehicleLat}
                onChange={(e) => {
                  setVehicleLat(parseFloat(e.target.value));
                  setGpsError(null);
                }}
                className="w-full accent-emerald-500 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="space-y-1 text-left">
              <div className="flex justify-between text-[9px] font-mono text-slate-400">
                <span>Longitude Manual:</span>
                <span className="text-white font-bold font-mono">{vehicleLng.toFixed(5)}</span>
              </div>
              <input 
                type="range"
                min="-47.25"
                max="-46.92"
                step="0.0001"
                value={vehicleLng}
                onChange={(e) => {
                  setVehicleLng(parseFloat(e.target.value));
                  setGpsError(null);
                }}
                className="w-full accent-emerald-500 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Seção do Mapa de Calor D3 */}
      <section className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4 text-left" id="risk-zone-heatmap-section">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-amber-500">
              <Flame className="w-5 h-5 text-amber-500 animate-pulse" />
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-display">
                Mapa de Calor: Frequência de Passagem
              </h3>
            </div>
            <p className="text-[11px] text-slate-400">
              Análise em tempo real de contatos com áreas de risco alto e médio por zona e período do dia (D3.js).
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (showConfirm) {
                  showConfirm(
                    "Limpar Histórico",
                    "Deseja realmente apagar todos os registros de passagem do mapa de calor?",
                    () => setPassageHistory([])
                  );
                } else {
                  if (confirm("Apagar todos os registros de passagem?")) {
                    setPassageHistory([]);
                  }
                }
              }}
              className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-lg text-[9px] font-mono text-slate-400 hover:text-red-400 font-bold uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center gap-1"
              title="Limpar Histórico de Passagens"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpar Dados
            </button>
          </div>
        </div>

        {/* Dynamic Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-950/75 border border-slate-900/80 p-3 rounded-xl flex items-center justify-between">
            <div className="space-y-0.5 text-left">
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono">Total de Alertas</span>
              <p className="text-base font-extrabold text-white font-mono">{passageHistory.length}</p>
            </div>
            <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 text-slate-400">
              <History className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-950/75 border border-slate-900/80 p-3 rounded-xl flex items-center justify-between">
            <div className="space-y-0.5 text-left">
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono">Zona Mais Frequente</span>
              <p className="text-xs font-bold text-emerald-400 truncate max-w-[150px] font-mono">
                {(() => {
                  if (passageHistory.length === 0) return "NENHUMA";
                  const counts: Record<string, number> = {};
                  passageHistory.forEach(h => {
                    const name = h.zoneName.toUpperCase();
                    counts[name] = (counts[name] || 0) + 1;
                  });
                  return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
                })()}
              </p>
            </div>
            <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 text-amber-500">
              <Flame className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-950/75 border border-slate-900/80 p-3 rounded-xl flex items-center justify-between">
            <div className="space-y-0.5 text-left">
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono font-bold">Faixa de Pico</span>
              <p className="text-base font-extrabold text-red-400 font-mono">
                {(() => {
                  if (passageHistory.length === 0) return "--:--";
                  const counts = Array(12).fill(0);
                  passageHistory.forEach(h => {
                    counts[getBlockIndex(h.hour)]++;
                  });
                  const maxIndex = counts.indexOf(Math.max(...counts));
                  return TIME_BLOCKS[maxIndex] + "h";
                })()}
              </p>
            </div>
            <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 text-red-500">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Heatmap Chart Canvas Container */}
        <div className="bg-slate-950/80 border border-slate-900 p-3 rounded-xl">
          {passageHistory.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-900/80 flex items-center justify-center text-slate-600 border border-slate-800">
                <History className="w-5 h-5 text-slate-500" />
              </div>
              <p className="text-xs text-slate-400 font-medium">Nenhum registro de passagem cadastrado.</p>
              <p className="text-[10px] text-slate-500">Utilize o simulador de rotas ou o painel manual abaixo para gerar contatos e pintar o mapa de calor.</p>
            </div>
          ) : (
            <div className="w-full h-auto overflow-x-auto">
              <div className="min-w-[580px]">
                <svg ref={heatmapSvgRef} className="w-full h-auto transition-all" />
              </div>
            </div>
          )}
        </div>

        {/* Manual passage injection block for testing and demo purposes */}
        <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-xl space-y-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest font-mono">Injetor Manual de Passagens (Homologação)</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="space-y-1.5 text-left">
              <label className="text-[9px] font-mono text-slate-500 uppercase font-bold">Selecione o Local:</label>
              <select
                value={selectedSimZoneId}
                onChange={(e) => setSelectedSimZoneId(Number(e.target.value))}
                className="w-full bg-slate-900 text-xs text-white border border-slate-800 rounded-lg p-2 focus:outline-none focus:border-emerald-500 font-mono"
              >
                {riskZones.map(z => (
                  <option key={z.id} value={z.id}>
                    {z.nomeLocal.toUpperCase()} ({z.nivelRisco})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-[9px] font-mono text-slate-500 uppercase font-bold">Faixa Horária:</label>
              <select
                value={selectedSimHour}
                onChange={(e) => setSelectedSimHour(Number(e.target.value))}
                className="w-full bg-slate-900 text-xs text-white border border-slate-800 rounded-lg p-2 focus:outline-none focus:border-emerald-500 font-mono"
              >
                {Array.from({ length: 24 }).map((_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00h - {TIME_BLOCKS[getBlockIndex(h)]}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                const zone = riskZones.find(z => z.id === selectedSimZoneId);
                if (!zone) return;
                
                const now = new Date();
                const randomMin = String(Math.floor(Math.random() * 60)).padStart(2, '0');
                const newRec: PassageRecord = {
                  id: `manual-${zone.id}-${Date.now()}`,
                  zoneId: zone.id,
                  zoneName: zone.nomeLocal,
                  timestamp: `${now.toLocaleDateString('pt-BR')} ${String(selectedSimHour).padStart(2, '0')}:${randomMin}:00`,
                  hour: selectedSimHour,
                  dayOfWeek: now.getDay(),
                  nivelRisco: zone.nivelRisco
                };
                
                setPassageHistory(prev => [newRec, ...prev]);
                if (showAlert) {
                  showAlert("Passagem Simulada", `Registro adicionado com sucesso em ${zone.nomeLocal} às ${String(selectedSimHour).padStart(2, '0')}:${randomMin}h.`);
                }
              }}
              className="py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg text-[10px] uppercase tracking-wider font-mono transition-all duration-150 cursor-pointer text-center active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Injetar Registro
            </button>
          </div>
        </div>
      </section>

      {/* Control filters bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between w-full">
        {/* Search input */}
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por local ou coordenadas..."
            className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl py-2.5 pl-9 pr-4 text-xs text-white focus:outline-none placeholder:text-slate-500"
          />
        </div>
        
        {/* Buttons and actions */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between md:justify-end shrink-0">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-900 flex-1 sm:flex-initial">
            <button
              onClick={() => setFilterLevel('todos')}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                filterLevel === 'todos' ? 'bg-slate-900 text-emerald-400 font-bold border border-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterLevel('ALTO')}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                filterLevel === 'ALTO' ? 'bg-red-500/10 text-red-400 font-bold border border-red-500/20' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Alto Risco
            </button>
            <button
              onClick={() => setFilterLevel('BAIXO')}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                filterLevel === 'BAIXO' ? 'bg-slate-800 text-slate-200 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Baixo Risco
            </button>
          </div>

          {/* Toggle filter for inactive zones */}
          <div className="flex items-center justify-between sm:justify-start gap-2.5 bg-slate-950 border border-slate-900 rounded-xl px-3 py-1.5 flex-1 sm:flex-initial shadow-inner">
            <span className="text-xs font-semibold text-slate-400 font-sans whitespace-nowrap">Ocultar Inativos</span>
            <button
              type="button"
              id="toggle-hide-inactive"
              onClick={() => setHideInactive(!hideInactive)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                hideInactive ? 'bg-emerald-500' : 'bg-slate-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                  hideInactive ? 'translate-x-4 bg-white' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          
          <button
            onClick={() => {
              if (!showAddForm) {
                loadZoneDraft();
              }
              setShowAddForm(!showAddForm);
            }}
            className="bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 w-full sm:w-auto shrink-0 shadow-lg shadow-emerald-500/10"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
            <span>Cadastrar Área de Risco</span>
          </button>
        </div>
      </div>

      {/* Backup and Migration options */}
      <div className="bg-slate-900/35 border border-slate-850 p-3.5 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 text-left relative overflow-hidden shadow-md">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/3 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px]">settings_backup_restore</span>
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide font-display">Backup & Migração de Zonas</h4>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
              Exporte suas zonas em arquivo JSON para backup externo ou importe arquivos de outras instâncias para sincronizar seus locais.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={handleExportJSON}
            className="flex-1 md:flex-none bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-750 text-slate-300 font-semibold px-4 py-2 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow"
            title="Exportar Zonas de Risco para arquivo JSON"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Exportar JSON</span>
          </button>
          
          <label className="flex-1 md:flex-none bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-750 text-slate-300 font-semibold px-4 py-2 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap shadow">
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>Importar JSON</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJSON}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Adding Risk Zone Drawer / Overlay */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 animate-fade-in text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-850">
            <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider">Cadastrar Perímetro de Risco</h3>
            <button
              type="button"
              onClick={handleFetchCurrentLocationForForm}
              disabled={isFetchingFormLocation}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Compass className={`w-3.5 h-3.5 ${isFetchingFormLocation ? 'animate-spin' : ''}`} />
              {isFetchingFormLocation ? 'Obtendo Endereço...' : 'Preencher Localização Atual'}
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Nome da Zona / Local</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                placeholder="Ex: CD VALINHOS, RUA DA SAÚDE..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Nível de Risco</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-emerald-500 cursor-pointer outline-none"
              >
                <option value="ALTO">Alto Risco (Gera Alertas de Disparo)</option>
                <option value="MEDIO">Médio Risco</option>
                <option value="BAIXO">Baixo Risco (Monitoramento de Segurança)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Latitude</label>
              <input
                type="number"
                step="0.00001"
                required
                value={lat}
                onChange={(e) => setLat(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2.5 text-xs text-white focus:border-emerald-500 outline-none"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Longitude</label>
              <input
                type="number"
                step="0.00001"
                required
                value={lng}
                onChange={(e) => setLng(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2.5 text-xs text-white focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Raio (metros)</label>
              <input
                type="number"
                required
                value={radius}
                onChange={(e) => setRadius(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2.5 text-xs text-white focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                clearZoneDraftFromStorage();
                setName('');
                setShowAddForm(false);
              }}
              className="px-3.5 py-2 rounded-xl border border-rose-500/20 hover:bg-rose-500/10 text-rose-400 text-xs font-bold cursor-pointer"
              title="Apagar rascunho de perímetro de risco"
            >
              Limpar Rascunho
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3.5 py-2 rounded-xl border border-slate-800 hover:bg-slate-950 text-slate-300 text-xs font-bold cursor-pointer"
              title="Salvar rascunho e fechar formulário"
            >
              Manter Rascunho
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Confirmar
            </button>
          </div>
        </form>
      )}

      {/* Editing Risk Zone Form */}
      {editingZone && (
        <form id="edit-risk-zone-form" onSubmit={handleEditSubmit} className="bg-slate-900 border border-slate-700 p-5 rounded-2xl space-y-4 animate-fade-in text-left ring-2 ring-emerald-500/20">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <h3 className="font-bold text-white font-display text-sm uppercase tracking-wider flex items-center gap-2">
              <Edit className="w-5 h-5 text-emerald-400" />
              Editar Perímetro de Risco
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">ID: #{editingZone.id}</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Nome da Zona / Local</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value.toUpperCase())}
                placeholder="Ex: CD VALINHOS, RUA DA SAÚDE..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Nível de Risco</label>
              <select
                value={editLevel}
                onChange={(e) => setEditLevel(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-emerald-500 cursor-pointer outline-none"
              >
                <option value="ALTO">Alto Risco (Gera Alertas de Disparo)</option>
                <option value="MEDIO">Médio Risco</option>
                <option value="BAIXO">Baixo Risco (Monitoramento de Segurança)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Latitude</label>
              <input
                type="number"
                step="0.00001"
                required
                value={editLat}
                onChange={(e) => setEditLat(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2.5 text-xs text-white focus:border-emerald-500 outline-none"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Longitude</label>
              <input
                type="number"
                step="0.00001"
                required
                value={editLng}
                onChange={(e) => setEditLng(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2.5 text-xs text-white focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Raio (metros)</label>
              <input
                type="number"
                required
                value={editRadius}
                onChange={(e) => setEditRadius(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2.5 text-xs text-white focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingZone(null)}
              className="px-3.5 py-2 rounded-xl border border-slate-800 hover:bg-slate-950 text-slate-300 text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      )}

      {/* Risk Zone details ledger layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
        <AnimatePresence mode="popLayout">
          {filteredZones.map((zone) => {
            const distance = getDistanceInMeters(vehicleLat, vehicleLng, zone.latitude, zone.longitude);
            const distanceStr = distance > 1000 
              ? `${(distance / 1000).toFixed(2)} km` 
              : `${Math.round(distance)} metros`;
            
            return (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                transition={{ duration: 0.3 }}
                key={zone.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between text-left ${
                  zone.nivelRisco === 'ALTO'
                    ? 'bg-red-950/10 border-red-500/20 hover:border-red-500/40'
                    : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${zone.nivelRisco === 'ALTO' ? 'bg-red-500 animate-pulse' : 'bg-emerald-400'}`} />
                      <span className={`text-[10px] font-bold tracking-widest font-mono uppercase ${
                        zone.nivelRisco === 'ALTO' ? 'text-red-400' : 'text-slate-400'
                      }`}>
                        {zone.nivelRisco} RISCO
                      </span>
                    </div>
                    
                    {/* Active monitoring toggle button */}
                    <button
                      onClick={() => onToggleActive(zone.id)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer uppercase transition-all ${
                        zone.ativo
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-slate-950 border-slate-800 text-slate-500'
                      }`}
                    >
                      {zone.ativo ? 'ATIVO' : 'MUTADO'}
                    </button>
                  </div>

                  <h4 className="text-xs font-bold text-white uppercase tracking-tight">{zone.nomeLocal}</h4>
                  
                  <div className="flex flex-col gap-1 mt-2">
                    <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {zone.localizacao}
                    </p>
                    <p className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                      <Locate className="w-3.5 h-3.5 text-emerald-500" />
                      Distância: {distanceStr}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/40 flex justify-between items-center">
                  <div className="text-[10px] font-mono text-slate-400 flex flex-col gap-0.5">
                    <span>Raio: {zone.raioMetros}m</span>
                    <span>Registro: {zone.dataRegistro}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(zone)}
                      className="p-1.5 bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-emerald-400 rounded-lg border border-slate-800 transition-colors flex items-center justify-center cursor-pointer active:scale-95"
                      title="Editar Perímetro"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(zone.id, zone.nomeLocal)}
                      className="p-1.5 bg-slate-950 hover:bg-slate-850 text-slate-500 hover:text-red-400 rounded-lg border border-slate-800 transition-colors flex items-center justify-center cursor-pointer active:scale-95"
                      title="Excluir Perímetro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
