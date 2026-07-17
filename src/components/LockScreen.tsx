import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SecurityConfig } from '../types';

interface LockScreenProps {
  securityConfig: SecurityConfig;
  onUnlock: () => void;
  avatarUrl: string;
}

export default function LockScreen({ securityConfig, onUnlock, avatarUrl }: LockScreenProps) {
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  
  // States for PIN
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<boolean>(false);
  const [shakePin, setShakePin] = useState<boolean>(false);

  // States for Password (SENHA)
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string>('');

  // States for Biometrics
  const [biometricStatus, setBiometricStatus] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');

  // Update clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      
      const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
      setDateStr(now.toLocaleDateString('pt-BR', options));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle PIN button press
  const handlePinPress = (num: string) => {
    if (pinInput.length >= 4) return;
    setPinError(false);
    
    const newPin = pinInput + num;
    setPinInput(newPin);

    // If reached 4 digits, validate immediately
    if (newPin.length === 4) {
      setTimeout(() => {
        if (newPin === (securityConfig.pin || '1234')) {
          onUnlock();
        } else {
          setShakePin(true);
          setPinError(true);
          setTimeout(() => setShakePin(false), 500);
          setPinInput('');
        }
      }, 300);
    }
  };

  const handlePinBackspace = () => {
    if (pinInput.length > 0) {
      setPinInput(prev => prev.slice(0, -1));
      setPinError(false);
    }
  };

  // Handle Password submission
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (passwordInput === (securityConfig.password || 'admin')) {
      onUnlock();
    } else {
      setPasswordError('Senha incorreta. Tente novamente.');
      setPasswordInput('');
    }
  };

  // Handle Biometrics Touch/Simulation
  const handleBiometricClick = () => {
    if (biometricStatus === 'scanning' || biometricStatus === 'success') return;
    
    setBiometricStatus('scanning');
    
    // Simulate biometric scanning
    setTimeout(() => {
      // 90% success rate to keep it interactive and realistic
      const success = Math.random() < 0.95;
      if (success) {
        setBiometricStatus('success');
        setTimeout(() => {
          onUnlock();
        }, 600);
      } else {
        setBiometricStatus('failed');
        setTimeout(() => {
          setBiometricStatus('idle');
        }, 1500);
      }
    }, 1500);
  };

  return (
    <div className="absolute inset-0 z-[100] bg-slate-950/98 backdrop-blur-xl flex flex-col justify-between p-6 overflow-hidden select-none">
      
      {/* Top Section - Digital Clock & Logo */}
      <div className="flex flex-col items-center mt-6 space-y-1.5 text-center">
        <div className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-1 rounded-full border border-slate-800/80 mb-2">
          <span className="material-symbols-outlined text-xs text-emerald-400">security</span>
          <span className="text-[9px] font-bold font-mono tracking-wider text-slate-400 uppercase">Acesso Seguro</span>
        </div>
        
        <h1 className="text-4xl font-extrabold text-white tracking-tighter font-mono">
          {timeStr || '20:45'}
        </h1>
        <p className="text-[10px] text-slate-400 font-medium capitalize font-mono">
          {dateStr || 'sábado, 11 de julho'}
        </p>
      </div>

      {/* Middle Section - User Avatar & Greeting */}
      <div className="flex flex-col items-center my-auto py-4 space-y-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-2 border-emerald-500/30 p-1 bg-slate-900/80 flex items-center justify-center shadow-lg shadow-emerald-500/5">
            <img 
              src={avatarUrl} 
              alt="Alexandre S Gaeta Profile" 
              className="w-full h-full rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 text-slate-950 rounded-full flex items-center justify-center border-2 border-slate-950 shadow-md">
            <span className="material-symbols-outlined text-[13px] font-bold">
              {securityConfig.mode === 'BIOMETRIA' ? 'fingerprint' : securityConfig.mode === 'PIN' ? 'dialpad' : 'password'}
            </span>
          </div>
        </div>

        <div className="text-center space-y-1">
          <h2 className="text-sm font-bold text-slate-200">Alexandre S Gaeta</h2>
          <p className="text-[10px] text-slate-400 max-w-[240px] leading-relaxed">
            {securityConfig.mode === 'PIN' 
              ? 'Digite seu PIN de 4 dígitos para acessar' 
              : securityConfig.mode === 'SENHA'
              ? 'Digite sua senha para desbloquear'
              : 'Autentique com biometria facial ou digital para acessar'}
          </p>
        </div>

        {/* Input Interface based on mode */}
        <div className="w-full max-w-[280px]">
          {securityConfig.mode === 'PIN' && (
            <div className="flex flex-col items-center space-y-6">
              {/* PIN Indicator Dots */}
              <div className={`flex gap-4 justify-center py-2 ${shakePin ? 'animate-shake' : ''}`}>
                {[0, 1, 2, 3].map((index) => {
                  const hasValue = pinInput.length > index;
                  return (
                    <div 
                      key={index} 
                      className={`w-3.5 h-3.5 rounded-full border transition-all duration-150 ${
                        hasValue 
                          ? 'bg-emerald-400 border-emerald-400 scale-110 shadow-sm shadow-emerald-400/30' 
                          : pinError 
                          ? 'border-rose-500 bg-rose-500/20' 
                          : 'border-slate-700 bg-slate-900'
                      }`}
                    />
                  );
                })}
              </div>

              {/* PIN Error Message */}
              <div className="h-4 text-center">
                {pinError && (
                  <span className="text-[10px] font-semibold text-rose-400 font-mono">PIN incorreto. Tente novamente!</span>
                )}
              </div>

              {/* Keypad Grid */}
              <div className="grid grid-cols-3 gap-y-3.5 gap-x-5 w-full">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handlePinPress(num)}
                    className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800/80 hover:bg-slate-850 hover:border-slate-700 hover:text-white text-slate-200 text-lg font-bold font-mono transition-all flex items-center justify-center active:scale-90 cursor-pointer shadow-sm shadow-black/10"
                  >
                    {num}
                  </button>
                ))}
                
                {/* Clear / Reset button */}
                <button
                  type="button"
                  onClick={() => {
                    setPinInput('');
                    setPinError(false);
                  }}
                  className="w-14 h-14 rounded-full text-slate-500 hover:text-rose-400 transition-colors flex items-center justify-center active:scale-90 cursor-pointer text-xs uppercase font-bold tracking-wider font-mono"
                  title="Limpar"
                >
                  C
                </button>
                
                {/* Zero Key */}
                <button
                  type="button"
                  onClick={() => handlePinPress('0')}
                  className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800/80 hover:bg-slate-850 hover:border-slate-700 hover:text-white text-slate-200 text-lg font-bold font-mono transition-all flex items-center justify-center active:scale-90 cursor-pointer shadow-sm shadow-black/10"
                >
                  0
                </button>
                
                {/* Backspace Key */}
                <button
                  type="button"
                  onClick={handlePinBackspace}
                  className="w-14 h-14 rounded-full text-slate-500 hover:text-emerald-400 transition-colors flex items-center justify-center active:scale-90 cursor-pointer"
                  title="Apagar"
                >
                  <span className="material-symbols-outlined text-lg">backspace</span>
                </button>
              </div>
            </div>
          )}

          {securityConfig.mode === 'SENHA' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setPasswordError('');
                  }}
                  placeholder="Digite sua senha"
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 pr-10 font-mono tracking-wide"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[17px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              {passwordError && (
                <p className="text-[10px] font-medium text-rose-400 text-center font-mono">
                  {passwordError}
                </p>
              )}

              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-bold py-2.5 rounded-xl text-[11px] uppercase tracking-wider transition-all active:scale-95 cursor-pointer font-mono"
              >
                Desbloquear
              </button>
            </form>
          )}

          {securityConfig.mode === 'BIOMETRIA' && (
            <div className="flex flex-col items-center space-y-5">
              <button
                type="button"
                onClick={handleBiometricClick}
                className={`w-24 h-24 rounded-full bg-slate-900 border-2 transition-all duration-300 flex items-center justify-center shadow-lg active:scale-95 cursor-pointer relative ${
                  biometricStatus === 'scanning'
                    ? 'border-emerald-500 animate-pulse shadow-emerald-500/15'
                    : biometricStatus === 'success'
                    ? 'border-emerald-400 bg-emerald-500/5 shadow-emerald-500/10'
                    : biometricStatus === 'failed'
                    ? 'border-rose-500 bg-rose-500/5 shadow-rose-500/10 animate-shake'
                    : 'border-slate-800 hover:border-slate-700 shadow-black/30'
                }`}
              >
                {/* Background scanning ripples */}
                {biometricStatus === 'scanning' && (
                  <>
                    <span className="absolute inset-0 rounded-full border-2 border-emerald-500 animate-ping opacity-25" />
                    <span className="absolute inset-2 rounded-full border border-emerald-400/50 animate-pulse" />
                  </>
                )}
                
                <span className={`material-symbols-outlined text-4xl transition-colors duration-200 ${
                  biometricStatus === 'scanning'
                    ? 'text-emerald-400'
                    : biometricStatus === 'success'
                    ? 'text-emerald-400'
                    : biometricStatus === 'failed'
                    ? 'text-rose-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}>
                  {securityConfig.biometricType === 'FACE_ID' ? 'faceid' : 'fingerprint'}
                </span>
              </button>

              <div className="text-center h-4">
                {biometricStatus === 'idle' && (
                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider cursor-pointer" onClick={handleBiometricClick}>
                    Toque para Escanear
                  </span>
                )}
                {biometricStatus === 'scanning' && (
                  <span className="text-[10px] text-emerald-400 font-bold font-mono uppercase tracking-wider animate-pulse">
                    Escaneando Biometria...
                  </span>
                )}
                {biometricStatus === 'success' && (
                  <span className="text-[10px] text-emerald-400 font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">check_circle</span>
                    Identidade Confirmada!
                  </span>
                )}
                {biometricStatus === 'failed' && (
                  <span className="text-[10px] text-rose-400 font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">error</span>
                    Falha na Autenticação
                  </span>
                )}
              </div>

              {/* Simulation test triggers */}
              <div className="flex gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setBiometricStatus('failed');
                    setTimeout(() => setBiometricStatus('idle'), 1500);
                  }}
                  className="text-[9px] font-bold text-slate-500 hover:text-rose-400 transition-colors uppercase tracking-wider font-mono cursor-pointer bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-850"
                >
                  Simular Falha
                </button>
                <button
                  type="button"
                  onClick={onUnlock}
                  className="text-[9px] font-bold text-slate-500 hover:text-emerald-400 transition-colors uppercase tracking-wider font-mono cursor-pointer bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-850"
                >
                  Burlar (PIN)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Section - Information */}
      <div className="flex flex-col items-center mt-auto space-y-1">
        <div className="flex items-center gap-1.5 text-slate-600">
          <span className="material-symbols-outlined text-[13px]">lock</span>
          <span className="text-[9px] font-bold tracking-wider font-mono uppercase">Segurança de Ponta-a-Ponta</span>
        </div>
        <p className="text-[8px] text-slate-700 text-center font-mono">
          Os dados financeiros estão protegidos por criptografia local.
        </p>
      </div>

    </div>
  );
}
