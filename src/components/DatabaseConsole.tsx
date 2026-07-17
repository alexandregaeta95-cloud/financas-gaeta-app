import React, { useState } from 'react';
import { doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction, RiskZone, Infraction } from '../types';
import { initialTransactions } from '../data/transactions';
import { initialRiskZones } from '../data/riskZones';
import { initialInfractions, nonAppealedInfractions } from '../data/infractions';
import { PRELOADED_CSV } from '../data/preloadedCsv';

interface DatabaseConsoleProps {
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  riskZones: RiskZone[];
  setRiskZones: React.Dispatch<React.SetStateAction<RiskZone[]>>;
  infractions: Infraction[];
  setInfractions: React.Dispatch<React.SetStateAction<Infraction[]>>;
  nonAppealed: any[];
  setNonAppealed: React.Dispatch<React.SetStateAction<any[]>>;
  avatarUrl: string;
  onAvatarChange: (url: string) => void;
}

type CollectionKey = 'transactions' | 'risk_zones' | 'infractions' | 'non_appealed' | 'settings';

export default function DatabaseConsole({
  transactions,
  setTransactions,
  riskZones,
  setRiskZones,
  infractions,
  setInfractions,
  nonAppealed,
  setNonAppealed,
  avatarUrl,
  onAvatarChange
}: DatabaseConsoleProps) {
  const [activeTab, setActiveTab] = useState<CollectionKey>('transactions');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [isInserting, setIsInserting] = useState<boolean>(false);
  const [newDocJson, setNewDocJson] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Advanced CSV Import States
  const [isCsvModalOpen, setIsCsvModalOpen] = useState<boolean>(false);
  const [csvTextInput, setCsvTextInput] = useState<string>('');
  const [csvIsWipingAndImporting, setCsvIsWipingAndImporting] = useState<boolean>(false);
  const [csvImportProgress, setCsvImportProgress] = useState<string>('');

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseMoneyValue = (valStr: string): number => {
    if (!valStr) return 0;
    const cleaned = valStr.replace(/\s/g, '').replace(/"/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleWipeAndImportCSV = async () => {
    if (!csvTextInput.trim()) {
      alert("Por favor, cole os dados do CSV ou carregue a planilha do chat.");
      return;
    }

    const confirmWipe = confirm(
      "⚠️ ATENÇÃO - OPERAÇÃO IRREVERSÍVEL:\n\n" +
      "Isso irá APAGAR COMPLETAMENTE todas as transações atuais no Firestore (banco de dados) e reescrevê-las a partir do CSV fornecido.\n\n" +
      "Deseja realmente prosseguir?"
    );

    if (!confirmWipe) return;

    setCsvIsWipingAndImporting(true);
    setCsvImportProgress("Analisando dados do CSV...");

    try {
      // 1. Parse CSV
      const lines = csvTextInput.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        throw new Error("O arquivo CSV fornecido é inválido ou vazio.");
      }

      const headers = parseCSVLine(lines[0]);
      const idxId = headers.findIndex(h => h.toLowerCase().includes('id_transacao'));
      const idxData = headers.findIndex(h => h.toLowerCase() === 'data');
      const idxValor = headers.findIndex(h => h.toLowerCase() === 'valor');
      const idxDataPagamento = headers.findIndex(h => h.toLowerCase() === 'data_pagamento');
      const idxValorPg = headers.findIndex(h => h.toLowerCase() === 'valor_pg');
      const idxTipo = headers.findIndex(h => h.toLowerCase() === 'tipo');
      const idxDescricao = headers.findIndex(h => h.toLowerCase() === 'descricao');
      const idxCategoria = headers.findIndex(h => h.toLowerCase() === 'categoria');
      const idxStatus = headers.findIndex(h => h.toLowerCase() === 'status');
      const idxOrigemAbastecimento = headers.findIndex(h => h.toLowerCase().includes('origem_abastecimento'));

      const parsedTransactions: Transaction[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length < 3) continue;

        const rawId = idxId !== -1 ? cols[idxId] : '';
        const id = parseInt(rawId);
        if (isNaN(id)) continue;

        const data = idxData !== -1 ? cols[idxData] : '';
        const valor = idxValor !== -1 ? parseMoneyValue(cols[idxValor]) : 0;
        const tipo = idxTipo !== -1 ? cols[idxTipo] : '';
        const descricao = idxDescricao !== -1 ? cols[idxDescricao] : '';
        const categoria = idxCategoria !== -1 ? cols[idxCategoria] : '';
        
        let status = idxStatus !== -1 ? cols[idxStatus] : '';
        if (!status) {
          status = ['ETANOL', 'GAS. COMUM', 'DESPESA'].includes(tipo) ? 'PENDENTE' : 'PAGO';
        }

        const tx: Transaction = {
          id,
          data,
          valor,
          tipo,
          descricao,
          categoria,
          status: status as any
        };

        if (idxDataPagamento !== -1 && cols[idxDataPagamento]) {
          tx.dataPagamento = cols[idxDataPagamento];
        }
        if (idxValorPg !== -1 && cols[idxValorPg]) {
          tx.valorPg = parseMoneyValue(cols[idxValorPg]);
        }
        if (idxOrigemAbastecimento !== -1 && cols[idxOrigemAbastecimento]) {
          const origId = parseInt(cols[idxOrigemAbastecimento]);
          if (!isNaN(origId)) {
            tx.origemAbastecimentoId = origId;
          }
        }

        parsedTransactions.push(tx);
      }

      setCsvImportProgress(`Wiping Firestore: Buscando documentos antigos...`);
      
      // 2. Clear old transactions from Firestore
      const querySnapshot = await getDocs(collection(db, 'transactions'));
      setCsvImportProgress(`Wiping Firestore: Deletando ${querySnapshot.size} documentos antigos...`);
      
      const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);

      // 3. Save new parsed transactions to Firestore
      setCsvImportProgress(`Gravando: Salvando ${parsedTransactions.length} novos registros no Firestore...`);
      
      // We can run setDoc in parallel chunks of 30 to make sure it's smooth and reliable
      const chunkSize = 30;
      for (let i = 0; i < parsedTransactions.length; i += chunkSize) {
        const chunk = parsedTransactions.slice(i, i + chunkSize);
        setCsvImportProgress(`Gravando: Salvando registros ${i + 1} a ${Math.min(i + chunkSize, parsedTransactions.length)} de ${parsedTransactions.length}...`);
        
        const savePromises = chunk.map(tx => {
          // clean undefined values
          const cleanTx = JSON.parse(JSON.stringify(tx));
          return setDoc(doc(db, 'transactions', String(tx.id)), cleanTx);
        });
        await Promise.all(savePromises);
      }

      // 4. Clear local deleted tracking & update state
      localStorage.removeItem('wealthflow_deleted_tx_ids');
      setTransactions(parsedTransactions);
      
      setCsvImportProgress(`Sucesso! ${parsedTransactions.length} transações importadas com êxito.`);
      showStatus(`Sucesso! Banco limpo e ${parsedTransactions.length} registros importados.`);
      
      setTimeout(() => {
        setIsCsvModalOpen(false);
        setCsvIsWipingAndImporting(false);
        setCsvImportProgress('');
      }, 2000);

    } catch (err: any) {
      console.error(err);
      setCsvImportProgress(`Erro: ${err.message || err}`);
      alert(`Erro durante a migração: ${err.message || err}`);
      setCsvIsWipingAndImporting(false);
    }
  };

  const showStatus = (text: string, isError = false) => {
    setStatusMsg({ text, isError });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  // Delete a document from a collection
  const handleDelete = async (id: string | number) => {
    try {
      const docIdStr = String(id);
      let firestoreCollection = activeTab;
      
      // Map tab keys to Firestore path
      const docRef = doc(db, firestoreCollection, docIdStr);
      await deleteDoc(docRef);

      // Update local state
      if (activeTab === 'transactions') {
        setTransactions(prev => prev.filter(t => String(t.id) !== docIdStr));
      } else if (activeTab === 'risk_zones') {
        setRiskZones(prev => prev.filter(z => String(z.id) !== docIdStr));
      } else if (activeTab === 'infractions') {
        setInfractions(prev => prev.filter(i => String(i.id) !== docIdStr));
      } else if (activeTab === 'non_appealed') {
        setNonAppealed(prev => prev.filter(n => String(n.id) !== docIdStr));
      }

      showStatus(`Registro "${id}" deletado com sucesso do Firestore!`);
      if (selectedDocId === docIdStr) setSelectedDocId(null);
    } catch (error: any) {
      console.error(error);
      showStatus(`Falha ao deletar: ${error.message || error}`, true);
    }
  };

  // Seed or Reset collections to original files
  const handleSeedCollection = async () => {
    try {
      if (activeTab === 'transactions') {
        const promises = initialTransactions.map(tx => 
          setDoc(doc(db, 'transactions', String(tx.id)), tx)
        );
        await Promise.all(promises);
        setTransactions(initialTransactions);
        showStatus('Coleção "transactions" semeada com sucesso!');
      } else if (activeTab === 'risk_zones') {
        const promises = initialRiskZones.map(zone => 
          setDoc(doc(db, 'risk_zones', String(zone.id)), zone)
        );
        await Promise.all(promises);
        setRiskZones(initialRiskZones);
        showStatus('Coleção "risk_zones" semeada com sucesso!');
      } else if (activeTab === 'infractions') {
        const promises = initialInfractions.map(inf => 
          setDoc(doc(db, 'infractions', inf.id), inf)
        );
        await Promise.all(promises);
        setInfractions(initialInfractions);
        showStatus('Coleção "infractions" semeada com sucesso!');
      } else if (activeTab === 'non_appealed') {
        const promises = nonAppealedInfractions.map(item => 
          setDoc(doc(db, 'non_appealed', item.id), item)
        );
        await Promise.all(promises);
        setNonAppealed(nonAppealedInfractions);
        showStatus('Coleção "non_appealed" semeada com sucesso!');
      } else if (activeTab === 'settings') {
        await setDoc(doc(db, 'settings', 'profile'), { avatarUrl });
        showStatus('Coleção "settings" redefinida para o avatar atual!');
      }
    } catch (error: any) {
      console.error(error);
      showStatus(`Erro ao semear: ${error.message || error}`, true);
    }
  };

  const handleWipeCollection = async () => {
    const confirmWipe = confirm(
      `⚠️ ATENÇÃO - OPERAÇÃO IRREVERSÍVEL:\n\n` +
      `Isso irá APAGAR COMPLETAMENTE todos os registros da coleção "${activeTab}" no Firestore.\n\n` +
      `Deseja realmente continuar?`
    );
    if (!confirmWipe) return;

    try {
      showStatus(`Limpando coleção "${activeTab}"...`);
      const querySnapshot = await getDocs(collection(db, activeTab));
      const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);

      // Also set the seed flag to true so it never auto-seeds again!
      if (['transactions', 'risk_zones', 'infractions', 'non_appealed'].includes(activeTab)) {
        await setDoc(doc(db, 'settings', 'seed'), { [activeTab]: true }, { merge: true });
      }

      // Update local state
      if (activeTab === 'transactions') {
        setTransactions([]);
        localStorage.removeItem('wealthflow_deleted_tx_ids');
      } else if (activeTab === 'risk_zones') {
        setRiskZones([]);
      } else if (activeTab === 'infractions') {
        setInfractions([]);
      } else if (activeTab === 'non_appealed') {
        setNonAppealed([]);
      }

      showStatus(`Coleção "${activeTab}" foi totalmente limpa!`);
    } catch (error: any) {
      console.error(error);
      showStatus(`Falha ao limpar: ${error.message || error}`, true);
    }
  };

  // Open insert form with dynamic template
  const handleOpenInsert = () => {
    let template: any = {};
    if (activeTab === 'transactions') {
      template = {
        id: transactions.length ? Math.max(...transactions.map(t => t.id)) + 1 : 1,
        data: new Date().toISOString().split('T')[0],
        valor: 150.00,
        tipo: 'DESPESA',
        descricao: 'POSTO BR NOVO',
        categoria: 'ABASTECIMENTO',
        status: 'PAGO'
      };
    } else if (activeTab === 'risk_zones') {
      template = {
        id: riskZones.length ? Math.max(...riskZones.map(z => z.id)) + 1 : 1,
        localizacao: "-23.5505, -46.6333",
        latitude: -23.5505,
        longitude: -46.6333,
        dataRegistro: new Date().toISOString().split('T')[0],
        dataHora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        status: '✅ Seguro',
        nomeLocal: 'RUA DO COMÉRCIO CENTRAL',
        raioMetros: 500,
        nivelRisco: 'BAIXO',
        statusGeral: 'VAZIO',
        ativo: true
      };
    } else if (activeTab === 'infractions') {
      template = {
        id: String(Date.now()),
        protocolo: `PRT-${Math.floor(100000 + Math.random() * 900000)}`,
        titulo: 'Excesso de Velocidade (Art. 218, I)',
        placa: 'BRA2E19',
        veiculo: 'SCANIA R450 SLATE',
        dataSubmissao: new Date().toLocaleDateString('pt-BR'),
        dataOcorrencia: new Date().toLocaleDateString('pt-BR'),
        localizacao: 'BR-116, KM 324',
        status: 'EM_ANALISE',
        valorMulta: 130.16,
        pontosCnh: 4,
        justificativa: 'ESTRADA SINALIZADA INCORRETAMENTE'
      };
    } else if (activeTab === 'non_appealed') {
      template = {
        id: `na-${Date.now()}`,
        protocolo: `PRT-${Math.floor(100000 + Math.random() * 900000)}`,
        placa: 'BRA2E19',
        valor: 195.23,
        pontos: 5,
        dataOcorrencia: new Date().toLocaleDateString('pt-BR'),
        descricao: 'Avançar o sinal vermelho do semáforo'
      };
    } else if (activeTab === 'settings') {
      template = {
        avatarUrl: avatarUrl
      };
    }
    setNewDocJson(JSON.stringify(template, null, 2));
    setIsInserting(true);
    setEditingDoc(null);
  };

  // Edit record
  const handleOpenEdit = (docData: any) => {
    setEditingDoc(docData);
    setNewDocJson(JSON.stringify(docData, null, 2));
    setIsInserting(true);
  };

  // Save new or modified record to database
  const handleSaveDoc = async () => {
    try {
      const parsed = JSON.parse(newDocJson);
      
      // Determine ID
      let finalId = parsed.id;
      if (activeTab === 'settings') {
        finalId = 'profile';
      }

      if (finalId === undefined || finalId === null) {
        throw new Error('O documento precisa ter um atributo "id" válido.');
      }

      const docIdStr = String(finalId);
      await setDoc(doc(db, activeTab, docIdStr), parsed);

      // Sync local state
      if (activeTab === 'transactions') {
        setTransactions(prev => {
          const exists = prev.some(t => String(t.id) === docIdStr);
          if (exists) {
            return prev.map(t => String(t.id) === docIdStr ? parsed : t);
          } else {
            return [parsed, ...prev];
          }
        });
      } else if (activeTab === 'risk_zones') {
        setRiskZones(prev => {
          const exists = prev.some(z => String(z.id) === docIdStr);
          if (exists) {
            return prev.map(z => String(z.id) === docIdStr ? parsed : z);
          } else {
            return [parsed, ...prev];
          }
        });
      } else if (activeTab === 'infractions') {
        setInfractions(prev => {
          const exists = prev.some(i => String(i.id) === docIdStr);
          if (exists) {
            return prev.map(i => String(i.id) === docIdStr ? parsed : i);
          } else {
            return [parsed, ...prev];
          }
        });
      } else if (activeTab === 'non_appealed') {
        setNonAppealed(prev => {
          const exists = prev.some(n => String(n.id) === docIdStr);
          if (exists) {
            return prev.map(n => String(n.id) === docIdStr ? parsed : n);
          } else {
            return [parsed, ...prev];
          }
        });
      } else if (activeTab === 'settings') {
        if (parsed.avatarUrl) {
          onAvatarChange(parsed.avatarUrl);
        }
      }

      showStatus(`Registro "${finalId}" salvo com sucesso no Firestore!`);
      setIsInserting(false);
      setEditingDoc(null);
    } catch (e: any) {
      alert(`Erro ao validar JSON ou salvar no Firestore: ${e.message}`);
    }
  };

  // Get current dataset based on tab
  const getActiveList = () => {
    switch (activeTab) {
      case 'transactions': return transactions;
      case 'risk_zones': return riskZones;
      case 'infractions': return infractions;
      case 'non_appealed': return nonAppealed;
      case 'settings': return [{ id: 'profile', avatarUrl }];
      default: return [];
    }
  };

  const filteredList = getActiveList().filter((item: any) => {
    if (!searchQuery) return true;
    const itemStr = JSON.stringify(item).toLowerCase();
    return itemStr.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl" id="database-console-panel">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-400">database</span>
          <div>
            <h3 className="font-bold text-white text-sm uppercase tracking-wider font-display">Console do Banco de Dados</h3>
            <p className="text-[10px] text-slate-400">Acesso direto ao Firestore live</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCsvModalOpen(!isCsvModalOpen)}
            className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
            title="Limpar e Importar Planilha de Transações CSV"
          >
            <span className="material-symbols-outlined text-xs">upload_file</span>
            Limpar e Importar CSV
          </button>

          <button
            onClick={handleWipeCollection}
            className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/60 text-rose-400 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
            title="Apagar todos os registros da coleção atual do Firestore"
          >
            <span className="material-symbols-outlined text-xs">delete_sweep</span>
            Limpar Coleção
          </button>
          
          <button
            onClick={handleSeedCollection}
            className="bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500 text-slate-300 hover:text-emerald-400 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
            title="Redefinir dados desta coleção para o padrão inicial"
          >
            <span className="material-symbols-outlined text-xs">restart_alt</span>
            Semear Coleção
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {statusMsg && (
        <div className={`p-2.5 rounded-xl text-xs font-semibold ${statusMsg.isError ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'} animate-pulse`}>
          {statusMsg.text}
        </div>
      )}

      {/* Collapsible CSV Panel */}
      {isCsvModalOpen && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4.5 space-y-4 animate-fadeIn">
          <div className="flex justify-between items-center pb-2 border-b border-slate-900">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <span className="material-symbols-outlined text-emerald-400 text-sm">csv</span>
              Limpeza Total e Importação do CSV
            </h4>
            <button 
              onClick={() => setIsCsvModalOpen(false)}
              className="text-slate-400 hover:text-slate-200 transition-colors p-1"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 leading-relaxed font-sans">
            Insira o conteúdo do CSV de transações abaixo. Se preferir usar o CSV enviado no Chat (218 registros), clique no botão rápido para carregar o conteúdo automaticamente.
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setCsvTextInput(PRELOADED_CSV);
                showStatus("CSV do Chat carregado na área de texto!");
              }}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-98"
            >
              <span className="material-symbols-outlined text-xs font-bold">chat</span>
              Carregar CSV do Chat (218 registros)
            </button>

            <button
              onClick={() => setCsvTextInput('')}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-98"
            >
              <span className="material-symbols-outlined text-xs">clear_all</span>
              Limpar Texto
            </button>
          </div>

          <textarea
            value={csvTextInput}
            onChange={(e) => setCsvTextInput(e.target.value)}
            placeholder="Cole o CSV com colunas ID_Transacao, Data, Valor, Data_pagamento, Valor_PG, Tipo, Descricao, Categoria, Status, Origem_Abastecimento_ID..."
            rows={8}
            className="w-full bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 text-[10px] font-mono text-emerald-400 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 custom-scrollbar uppercase"
            disabled={csvIsWipingAndImporting}
          />

          {csvImportProgress && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-[10px] font-mono text-slate-300 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span>{csvImportProgress}</span>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-900">
            <button
              onClick={() => setIsCsvModalOpen(false)}
              className="bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer"
              disabled={csvIsWipingAndImporting}
            >
              Cancelar
            </button>

            <button
              onClick={handleWipeAndImportCSV}
              className={`bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${csvIsWipingAndImporting ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={csvIsWipingAndImporting}
            >
              <span className="material-symbols-outlined text-xs font-bold">delete_forever</span>
              Limpar Banco & Importar
            </button>
          </div>
        </div>
      )}

      {/* Collection Tab bar */}
      <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800/60">
        {[
          { key: 'transactions', label: 'Transações', count: transactions.length },
          { key: 'risk_zones', label: 'Zonas', count: riskZones.length },
          { key: 'infractions', label: 'Recursos', count: infractions.length },
          { key: 'non_appealed', label: 'Fila Multas', count: nonAppealed.length },
          { key: 'settings', label: 'Perfil', count: 1 }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key as CollectionKey);
              setSelectedDocId(null);
              setIsInserting(false);
              setEditingDoc(null);
            }}
            className={`flex-1 text-center py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
              activeTab === tab.key 
                ? 'bg-emerald-500 text-slate-950' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <div>{tab.label}</div>
            <div className={`text-[8px] mt-0.5 ${activeTab === tab.key ? 'text-slate-900 font-extrabold' : 'text-slate-500'}`}>
              ({tab.count})
            </div>
          </button>
        ))}
      </div>

      {/* Search & Insert Header */}
      {!isInserting && (
        <div className="flex gap-2">
          <div className="flex-grow bg-slate-950 border border-slate-850 px-3 py-2 rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined text-xs text-slate-500">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Filtrar ${activeTab}...`}
              className="w-full bg-transparent text-xs text-white outline-none placeholder-slate-600 font-mono"
            />
          </div>
          
          <button
            onClick={handleOpenInsert}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3 py-2 rounded-xl flex items-center justify-center gap-1 cursor-pointer font-bold text-xs uppercase tracking-wider"
          >
            <span className="material-symbols-outlined text-sm font-bold">add</span>
            Inserir
          </button>
        </div>
      )}

      {/* INSERT/EDIT FORM VIEW */}
      {isInserting ? (
        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3 animate-fade-in">
          <div className="flex justify-between items-center pb-2 border-b border-slate-900">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest font-mono">
              {editingDoc ? '📝 EDITAR DOCUMENTO' : '✨ NOVO REGISTRO'}
            </span>
            <button 
              onClick={() => {
                setIsInserting(false);
                setEditingDoc(null);
              }}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          <div className="space-y-1">
            <span className="block text-[9px] font-bold text-slate-400 font-mono">ESTRUTURA JSON (FIRESTORE)</span>
            <textarea
              rows={12}
              value={newDocJson}
              onChange={(e) => setNewDocJson(e.target.value)}
              className="w-full bg-slate-900/40 border border-slate-800 rounded-lg p-3 text-xs text-emerald-400 font-mono focus:border-emerald-500 outline-none transition-all resize-none uppercase"
              placeholder="{ ... }"
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={() => {
                setIsInserting(false);
                setEditingDoc(null);
              }}
              className="border border-slate-800 text-slate-400 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-slate-900 cursor-pointer transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveDoc}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all active:scale-95"
            >
              Salvar Documento
            </button>
          </div>
        </div>
      ) : (
        /* DATABASE COLLECTION DOCUMENTS LIST */
        <div className="space-y-2 max-h-[350px] overflow-y-auto custom-scrollbar pr-0.5">
          {filteredList.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500 font-mono">
              Nenhum documento encontrado na coleção "{activeTab}".
            </div>
          ) : (
            filteredList.map((docItem: any) => {
              const docId = activeTab === 'settings' ? 'profile' : (docItem.id !== undefined ? String(docItem.id) : docItem.protocolo);
              const isSelected = selectedDocId === docId;
              
              // Dynamic title/subtexts based on structure
              let docTitle = docId;
              let docSub = '';
              
              if (activeTab === 'transactions') {
                docTitle = `${docItem.descricao} (${docItem.categoria})`;
                docSub = `${docItem.tipo} • R$ ${Number(docItem.valor).toFixed(2)} • ${docItem.data}`;
              } else if (activeTab === 'risk_zones') {
                docTitle = docItem.nomeLocal || docItem.localizacao;
                docSub = `Risco ${docItem.nivelRisco} • ${docItem.ativo ? 'Ativo' : 'Inativo'} • Raio: ${docItem.raioMetros}m`;
              } else if (activeTab === 'infractions') {
                docTitle = `${docItem.titulo} [${docItem.protocolo}]`;
                docSub = `${docItem.veiculo} • R$ ${Number(docItem.valorMulta).toFixed(2)} • ${docItem.status}`;
              } else if (activeTab === 'non_appealed') {
                docTitle = `${docItem.descricao} [${docItem.protocolo}]`;
                docSub = `Multa: R$ ${Number(docItem.valor).toFixed(2)} • Pontos: ${docItem.pontos}`;
              } else if (activeTab === 'settings') {
                docTitle = 'Configurações de Perfil';
                docSub = `URL da Foto: ${docItem.avatarUrl?.substring(0, 35)}...`;
              }

              return (
                <div 
                  key={docId}
                  className={`bg-slate-950 border rounded-xl overflow-hidden transition-all duration-200 ${
                    isSelected ? 'border-emerald-500 bg-slate-950' : 'border-slate-850 hover:border-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-center p-3">
                    <div 
                      className="flex-grow cursor-pointer"
                      onClick={() => setSelectedDocId(isSelected ? null : docId)}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono font-bold uppercase">
                          ID: {docId}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-200 mt-1 font-sans">{docTitle}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{docSub}</p>
                    </div>

                    <div className="flex gap-1 items-center">
                      <button
                        onClick={() => handleOpenEdit(docItem)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 cursor-pointer"
                        title="Editar documento JSON"
                      >
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>
                      
                      {activeTab !== 'settings' && (
                        <button
                          onClick={() => handleDelete(docId)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                          title="Excluir documento"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Selected JSON Expand View */}
                  {isSelected && (
                    <div className="bg-slate-900/40 border-t border-slate-900 p-3 space-y-2 font-mono">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Documento Firestore (JSON Completo)</span>
                      <pre className="text-[10px] bg-slate-950 p-2.5 rounded-lg text-emerald-400 overflow-x-auto border border-slate-900 max-h-[200px] uppercase">
                        {JSON.stringify(docItem, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
