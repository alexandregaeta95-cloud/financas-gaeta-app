import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = (() => {
  try {
    return sessionStorage.getItem('wealthflow_google_access_token');
  } catch (e) {
    return null;
  }
})();

// Initialize auth state listener.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Since Firebase Auth state listener is called on page refresh, the token isn't cached yet.
        // Try to get cached token first, otherwise let it know.
        const storedToken = (() => {
          try {
            return sessionStorage.getItem('wealthflow_google_access_token');
          } catch (e) {
            return null;
          }
        })();
        if (storedToken) {
          cachedAccessToken = storedToken;
          if (onAuthSuccess) onAuthSuccess(user, storedToken);
        } else {
          cachedAccessToken = null;
          if (onAuthFailure) onAuthFailure();
        }
      }
    } else {
      cachedAccessToken = null;
      try {
        sessionStorage.removeItem('wealthflow_google_access_token');
      } catch (e) {}
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    try {
      sessionStorage.setItem('wealthflow_google_access_token', cachedAccessToken);
    } catch (e) {}
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  try {
    sessionStorage.removeItem('wealthflow_google_access_token');
  } catch (e) {}
};

/**
 * Custom fetch wrapper for Google API requests to handle common network/CORS issues,
 * expired sessions (401), and auto-inject the Authorization header.
 */
const googleApiFetch = async (
  url: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<Response> => {
  try {
    const res = await fetch('/api/google-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        method: options.method || 'GET',
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${accessToken}`,
        },
        body: options.body,
      }),
    });

    if (!res.ok) {
      // If the proxy API itself failed with e.g. 500
      return res;
    }

    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await res.text();
      const trimmedText = text.trim();
      if (trimmedText.startsWith('<!doctype') || trimmedText.startsWith('<!DOCTYPE') || trimmedText.startsWith('<html')) {
        throw new Error("Erro de conexão com o servidor: O servidor do aplicativo retornou uma página HTML em vez de uma resposta JSON. Por favor, reinicie o servidor de desenvolvimento para que as rotas do backend (Express) e o proxy do Google Sheets funcionem corretamente.");
      }
      console.warn("Proxy response was not JSON. Returning fallback raw response status.", text);
      return new Response(text, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    }

    const json = await res.json();

    // Construct a mock Response object that matches the standard fetch Response API
    const mockResponse = new Response(json.data, {
      status: json.status,
      statusText: json.statusText,
      headers: new Headers(json.headers),
    });

    if (!mockResponse.ok && mockResponse.status === 401) {
      cachedAccessToken = null;
      try {
        sessionStorage.removeItem('wealthflow_google_access_token');
      } catch (e) {}
      throw new Error("Sessão expirada. Por favor, desconecte e conecte sua conta do Google Drive novamente para renovar o acesso.");
    }

    return mockResponse;
  } catch (err: any) {
    if (err.message && err.message.includes("Sessão expirada")) {
      throw err;
    }
    
    const isNetworkError = !err.status && (
      err.message === 'Failed to fetch' ||
      err.name === 'TypeError' ||
      err.message?.toLowerCase().includes('network') ||
      err.message?.toLowerCase().includes('fetch') ||
      err.message?.toLowerCase().includes('load failed')
    );

    if (isNetworkError) {
      throw new Error("Falha na conexão com as APIs do Google (Failed to fetch). Isso costuma ocorrer quando um bloqueador de anúncios (AdBlock) ou extensão de privacidade está bloqueando o domínio 'googleapis.com' no seu navegador. Tente desativar o AdBlock ou reconectar sua conta nas configurações do aplicativo para renovar o acesso.");
    }
    
    throw err;
  }
};

/**
 * Helper to find or create a folder in Google Drive.
 */
const findOrCreateFolder = async (accessToken: string, folderName: string, parentId?: string): Promise<string> => {
  let query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
  const res = await googleApiFetch(searchUrl, accessToken);
  if (!res.ok) {
    throw new Error(`Erro ao buscar pasta '${folderName}': ${await res.text()}`);
  }
  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Create folder
  const body: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentId) {
    body.parents = [parentId];
  }
  const createRes = await googleApiFetch('https://www.googleapis.com/drive/v3/files', accessToken, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!createRes.ok) {
    throw new Error(`Erro ao criar pasta '${folderName}': ${await createRes.text()}`);
  }
  const createData = await createRes.json();
  return createData.id;
};

/**
 * Encontra ou cria uma planilha com o nome 'WealthFlow Finance Data' no Google Drive do usuário.
 * Agora, a planilha é criada ou movida para a pasta 'appsheet/Data'.
 */
export const findOrCreateSpreadsheet = async (accessToken: string): Promise<string> => {
  // 1. Garantir que a pasta 'appsheet' exista
  const appsheetFolderId = await findOrCreateFolder(accessToken, 'appsheet');
  
  // 2. Garantir que a pasta 'Data' exista dentro de 'appsheet'
  const dataFolderId = await findOrCreateFolder(accessToken, 'Data', appsheetFolderId);

  // 3. Procurar se a planilha já existe dentro de 'appsheet/Data'
  const queryInFolder = `name = 'WealthFlow Finance Data' and mimeType = 'application/vnd.google-apps.spreadsheet' and '${dataFolderId}' in parents and trashed = false`;
  const searchInFolderUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(queryInFolder)}&fields=files(id,name,parents)`;
  
  const searchInFolderRes = await googleApiFetch(searchInFolderUrl, accessToken);
  
  if (!searchInFolderRes.ok) {
    const errorDetails = await searchInFolderRes.text();
    throw new Error(`Erro ao buscar planilha na pasta Data: ${errorDetails}`);
  }
  
  const searchInFolderData = await searchInFolderRes.json();
  if (searchInFolderData.files && searchInFolderData.files.length > 0) {
    return searchInFolderData.files[0].id;
  }

  // 4. Se não estiver em 'appsheet/Data', procurar globalmente para ver se ela existe em outro local
  const queryGlobal = `name = 'WealthFlow Finance Data' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
  const searchGlobalUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(queryGlobal)}&fields=files(id,name,parents)`;
  
  const searchGlobalRes = await googleApiFetch(searchGlobalUrl, accessToken);
  
  if (searchGlobalRes.ok) {
    const searchGlobalData = await searchGlobalRes.json();
    if (searchGlobalData.files && searchGlobalData.files.length > 0) {
      const file = searchGlobalData.files[0];
      const fileId = file.id;
      const currentParents = file.parents || [];
      
      if (currentParents.includes(dataFolderId)) {
        return fileId;
      }
      
      // Move a planilha existente para a pasta 'Data'
      const removeParents = currentParents.join(',');
      const moveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${dataFolderId}${removeParents ? `&removeParents=${removeParents}` : ''}`;
      
      const moveRes = await googleApiFetch(moveUrl, accessToken, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      
      if (moveRes.ok) {
        console.log(`Planilha movida com sucesso para appsheet/Data (ID da pasta: ${dataFolderId})`);
        return fileId;
      } else {
        console.warn(`Falha ao mover planilha existente: ${await moveRes.text()}`);
        return fileId; // Retorna o ID mesmo se não conseguir mover por limitações de permissão
      }
    }
  }

  // 5. Se não existir em nenhum lugar, cria uma nova planilha diretamente dentro da pasta 'Data'
  const createRes = await googleApiFetch('https://www.googleapis.com/drive/v3/files', accessToken, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'WealthFlow Finance Data',
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [dataFolderId]
    })
  });
  
  if (!createRes.ok) {
    const errorDetails = await createRes.text();
    throw new Error(`Erro ao criar planilha na pasta Data: ${errorDetails}`);
  }
  
  const fileData = await createRes.json();
  return fileData.id;
};

/**
 * Envia um backup completo dos dados do aplicativo em formato JSON para a pasta 'appsheet/Backups' no Google Drive.
 */
export const uploadBackupToDrive = async (
  accessToken: string,
  backupData: any
): Promise<string> => {
  // 1. Garantir que a pasta 'appsheet' exista
  const appsheetFolderId = await findOrCreateFolder(accessToken, 'appsheet');
  
  // 2. Garantir que a pasta 'Backups' exista dentro de 'appsheet'
  const backupsFolderId = await findOrCreateFolder(accessToken, 'Backups', appsheetFolderId);

  // 3. Criar nome do arquivo com timestamp
  const now = new Date();
  const timestamp = now.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
  const fileName = `wealthflow_backup_${timestamp}.json`;

  // 4. Criar metadados do arquivo na pasta de backups
  const createRes = await googleApiFetch('https://www.googleapis.com/drive/v3/files', accessToken, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: fileName,
      parents: [backupsFolderId],
      mimeType: 'application/json'
    })
  });

  if (!createRes.ok) {
    const errorDetails = await createRes.text();
    throw new Error(`Erro ao criar metadados do backup no Google Drive: ${errorDetails}`);
  }

  const fileData = await createRes.json();
  const fileId = fileData.id;

  // 5. Enviar o conteúdo do arquivo
  const fileContent = typeof backupData === 'string' ? backupData : JSON.stringify(backupData, null, 2);
  const uploadRes = await googleApiFetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, accessToken, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: fileContent
  });

  if (!uploadRes.ok) {
    const errorDetails = await uploadRes.text();
    throw new Error(`Erro ao enviar o conteúdo do backup para o Google Drive: ${errorDetails}`);
  }

  return fileName;
};

/**
 * Lista todos os arquivos de backup gerados na pasta 'appsheet/Backups' no Google Drive.
 */
export const listBackupsFromDrive = async (accessToken: string): Promise<any[]> => {
  const appsheetFolderId = await findOrCreateFolder(accessToken, 'appsheet');
  const backupsFolderId = await findOrCreateFolder(accessToken, 'Backups', appsheetFolderId);

  const query = `'${backupsFolderId}' in parents and name contains 'wealthflow_backup_' and mimeType = 'application/json' and trashed = false`;
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime,size)&orderBy=createdTime%20desc`;
  const res = await googleApiFetch(listUrl, accessToken);
  if (!res.ok) {
    throw new Error(`Erro ao listar backups do Google Drive: ${await res.text()}`);
  }
  const data = await res.json();
  return data.files || [];
};

/**
 * Baixa o conteúdo JSON de um backup do Google Drive a partir do fileId.
 */
export const downloadBackupFromDrive = async (accessToken: string, fileId: string): Promise<any> => {
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await googleApiFetch(downloadUrl, accessToken);
  if (!res.ok) {
    throw new Error(`Erro ao baixar backup do Google Drive: ${await res.text()}`);
  }
  return await res.json();
};

/**
 * Sincroniza a lista de transações e de infrações/recursos com a planilha do Google Sheets em abas separadas.
 */
export const syncDataToSpreadsheet = async (
  accessToken: string,
  spreadsheetId: string,
  transactions: any[],
  infractions: any[],
  riskZones: any[] = [],
  appointments: any[] = [],
  prescriptions: any[] = [],
  compromissos: any[] = [],
  registeredVehicles: any[] = [],
  performedServices: any[] = [],
  scheduledServices: any[] = [],
  bankAccounts: any[] = [],
  creditCards: any[] = []
): Promise<string> => {
  // 1. Buscar as abas atuais da planilha
  const metaRes = await googleApiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, accessToken);
  
  if (!metaRes.ok) {
    throw new Error(`Erro ao buscar metadados da planilha: ${await metaRes.text()}`);
  }
  
  const metaData = await metaRes.json();
  const existingSheetTitles: string[] = (metaData.sheets || []).map((s: any) => s.properties.title);
  
  // Normalizador de abas
  const normalizeSheetName = (str: string): string => {
    return String(str || '')
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]/g, "");
  };

  const normalizedExisting = existingSheetTitles.map((title: string) => ({
    original: title,
    normalized: normalizeSheetName(title)
  }));

  // Procurar correspondentes
  const matchTx = normalizedExisting.find(item => 
    item.normalized === 'TRANSACOES' || 
    item.normalized === 'TRANSACAOES' || 
    item.normalized === 'TRANSACAO' || 
    item.normalized === 'TRANSACOESFINANCAS'
  );
  
  const matchZone = normalizedExisting.find(item => 
    item.normalized === 'ZONASDERISCO' || 
    item.normalized === 'ZONAS' || 
    item.normalized === 'ZONASRISCO' ||
    item.normalized === 'RISCO'
  );

  const matchAppt = normalizedExisting.find(item => 
    item.normalized === 'CONSULTASMEDICAS' || 
    item.normalized === 'CONSULTAS' || 
    item.normalized === 'CONSULTA'
  );

  const matchPresc = normalizedExisting.find(item => 
    item.normalized === 'RECEITASMEDICAS' || 
    item.normalized === 'RECEITAS' || 
    item.normalized === 'RECEITA'
  );

  const matchInfr = normalizedExisting.find(item => 
    item.normalized === 'INFRACAO' || 
    item.normalized === 'INFRACOES' || 
    item.normalized === 'MULTAS' ||
    item.normalized === 'MULTA'
  );

  const matchComp = normalizedExisting.find(item => 
    item.normalized === 'COMPROMISSO' || 
    item.normalized === 'COMPROMISSOS' || 
    item.normalized === 'AGENDA' ||
    item.normalized === 'CALENDARIO' ||
    item.normalized === 'AGENDAECOMPROMISSOS'
  );

  const matchVeh = normalizedExisting.find(item => 
    item.normalized === 'VEICULO' || 
    item.normalized === 'VEICULOS' || 
    item.normalized === 'FROTA' ||
    item.normalized === 'VEICULOSREGISTRADOS'
  );

  const matchPerfServ = normalizedExisting.find(item => 
    item.normalized === 'SERVICOSREALIZADOS' || 
    item.normalized === 'MANUTENCAOREALIZADA' || 
    item.normalized === 'SERVICOS' ||
    item.normalized === 'MANUTENCOES' ||
    item.normalized === 'MANUTENCOESREALIZADAS'
  );

  const matchSchedServ = normalizedExisting.find(item => 
    item.normalized === 'SERVICOSAGENDADOS' || 
    item.normalized === 'MANUTENCAOAGENDADA' || 
    item.normalized === 'AGENDAMENTOS' ||
    item.normalized === 'MANUTENCOESAGENDADAS'
  );

  const matchBank = normalizedExisting.find(item => 
    item.normalized === 'CONTASBANCARIAS' || 
    item.normalized === 'CONTAS' || 
    item.normalized === 'BANCOS' ||
    item.normalized === 'CONTASBANCARIASSTATE'
  );

  const matchCard = normalizedExisting.find(item => 
    item.normalized === 'CARTOESDECREDITO' || 
    item.normalized === 'CARTOES' || 
    item.normalized === 'CARTAO' ||
    item.normalized === 'CARTOESDECREDITOSTATE'
  );

  let txSheetTitle = matchTx ? matchTx.original : 'Transações';
  let zoneSheetTitle = matchZone ? matchZone.original : 'Zonas de Risco';
  let apptSheetTitle = matchAppt ? matchAppt.original : 'Consultas Médicas';
  let prescSheetTitle = matchPresc ? matchPresc.original : 'Receitas Médicas';
  let infrSheetTitle = matchInfr ? matchInfr.original : 'Infrações';
  let compSheetTitle = matchComp ? matchComp.original : 'Agenda e Compromissos';
  let vehSheetTitle = matchVeh ? matchVeh.original : 'Veículos';
  let perfSheetTitle = matchPerfServ ? matchPerfServ.original : 'Serviços Realizados';
  let schedSheetTitle = matchSchedServ ? matchSchedServ.original : 'Serviços Agendados';
  let bankSheetTitle = matchBank ? matchBank.original : 'Contas Bancárias';
  let cardSheetTitle = matchCard ? matchCard.original : 'Cartões de Crédito';

  const requests: any[] = [];
  if (!matchTx) {
    requests.push({ addSheet: { properties: { title: 'Transações' } } });
    txSheetTitle = 'Transações';
  }
  if (!matchZone) {
    requests.push({ addSheet: { properties: { title: 'Zonas de Risco' } } });
    zoneSheetTitle = 'Zonas de Risco';
  }
  if (!matchAppt) {
    requests.push({ addSheet: { properties: { title: 'Consultas Médicas' } } });
    apptSheetTitle = 'Consultas Médicas';
  }
  if (!matchPresc) {
    requests.push({ addSheet: { properties: { title: 'Receitas Médicas' } } });
    prescSheetTitle = 'Receitas Médicas';
  }
  if (!matchInfr) {
    requests.push({ addSheet: { properties: { title: 'Infrações' } } });
    infrSheetTitle = 'Infrações';
  }
  if (!matchComp) {
    requests.push({ addSheet: { properties: { title: 'Agenda e Compromissos' } } });
    compSheetTitle = 'Agenda e Compromissos';
  }
  if (!matchVeh) {
    requests.push({ addSheet: { properties: { title: 'Veículos' } } });
    vehSheetTitle = 'Veículos';
  }
  if (!matchPerfServ) {
    requests.push({ addSheet: { properties: { title: 'Serviços Realizados' } } });
    perfSheetTitle = 'Serviços Realizados';
  }
  if (!matchSchedServ) {
    requests.push({ addSheet: { properties: { title: 'Serviços Agendados' } } });
    schedSheetTitle = 'Serviços Agendados';
  }
  if (!matchBank) {
    requests.push({ addSheet: { properties: { title: 'Contas Bancárias' } } });
    bankSheetTitle = 'Contas Bancárias';
  }
  if (!matchCard) {
    requests.push({ addSheet: { properties: { title: 'Cartões de Crédito' } } });
    cardSheetTitle = 'Cartões de Crédito';
  }
  
  // Se houver abas faltando, criá-las via batchUpdate
  if (requests.length > 0) {
    const updateRes = await googleApiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, accessToken, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    });
    if (!updateRes.ok) {
      console.warn("Aviso ao criar novas abas na planilha:", await updateRes.text());
    }
  }

  // 2. Preparar dados das Transações
  // Order transactions by date (ascending) to calculate KM differences for fuel efficiency
  const sortedTx = [...transactions].sort((a, b) => {
    const partsA = (a.data || '').split('/');
    const partsB = (b.data || '').split('/');
    const dateA = partsA.length === 3 ? new Date(`${partsA[2]}-${partsA[1]}-${partsA[0]}`).getTime() : 0;
    const dateB = partsB.length === 3 ? new Date(`${partsB[2]}-${partsB[1]}-${partsB[0]}`).getTime() : 0;
    return dateA - dateB;
  });

  const kmMapByVehicle: { [vehicle: string]: number } = {};
  const kmPercorridoByTxId: { [txId: number]: number } = {};
  const mediaMapByTxId: { [txId: number]: number } = {};

  sortedTx.forEach(t => {
    if (t.categoria === 'ABASTECIMENTO' && t.km) {
      const vehicle = (t.veiculo || 'FOX').toUpperCase();
      const prevKm = kmMapByVehicle[vehicle];
      if (prevKm !== undefined && t.km > prevKm) {
        const distance = t.km - prevKm;
        kmPercorridoByTxId[t.id] = distance;
        if (t.litros && t.litros > 0) {
          mediaMapByTxId[t.id] = distance / t.litros;
        }
      }
      kmMapByVehicle[vehicle] = t.km;
    }
  });

  const txHeaders = [
    "ID", "Data", "Descrição", "Categoria", "Valor (R$)", "Tipo", "Status",
    "Valor_PG", "KM", "Litros", "Preço por Litro", "Veículo",
    "Completou o Tanque", "KM Percorrido", "Média (Km/L)",
    "Nome Posto", "Localização do Posto", "Motorista", "OBS", "Descrição do Veículo"
  ];

  const txRows = transactions.map(t => {
    const isAbastecimento = t.categoria === 'ABASTECIMENTO';
    const media = mediaMapByTxId[t.id];
    const kmPerc = kmPercorridoByTxId[t.id];
    const valorPgVal = t.valorPg !== undefined ? t.valorPg : (t.status === 'PAGO' ? t.valor : 0);

    return [
      t.id,
      t.data,
      t.descricao,
      t.categoria,
      t.valor.toFixed(2).replace('.', ','),
      isAbastecimento ? (t.tipo || 'DESPESA') : (t.tipo === 'RECEITA' ? 'Receita' : 'Despesa'),
      t.status,
      valorPgVal.toFixed(2).replace('.', ','),
      isAbastecimento && t.km ? String(t.km) : '',
      isAbastecimento && t.litros ? t.litros.toFixed(2).replace('.', ',') : '',
      isAbastecimento && t.precoLitro ? t.precoLitro.toFixed(3).replace('.', ',') : '',
      isAbastecimento ? (t.veiculo || 'FOX') : '',
      isAbastecimento ? (t.completouTanque ? 'Sim' : 'Não') : '',
      isAbastecimento && kmPerc !== undefined ? String(kmPerc) : '',
      isAbastecimento && media !== undefined ? media.toFixed(2).replace('.', ',') : '',
      isAbastecimento && t.nomePosto ? t.nomePosto : '',
      isAbastecimento && t.localizacaoPosto ? t.localizacaoPosto : '',
      isAbastecimento && t.motorista ? t.motorista : '',
      t.obs || '',
      t.descricaoVeiculo || ''
    ];
  });
  
  // Preparar dados de Zonas de Risco
  const zoneHeaders = [
    "ID", "Nome do Local", "Nível de Risco", "Status Geral", "Ativo", 
    "Mensagem de Alerta", "Tipo de Som", "Tipo de Voz", "Sentido", 
    "Raio (metros)", "Localização (Lat, Long)", "Latitude", "Longitude", "Data Registro", "Data/Hora"
  ];
  const zoneRows = riskZones.map(z => [
    z.id,
    z.nomeLocal || '',
    z.nivelRisco || 'BAIXO',
    z.statusGeral || 'ALERTA',
    z.ativo ? 'Sim' : 'Não',
    z.mensagem || '',
    z.som || '',
    z.voz || '',
    z.sentido || '',
    z.raioMetros || 100,
    z.localizacao || '',
    z.latitude || '',
    z.longitude || '',
    z.dataRegistro || '',
    z.dataHora || ''
  ]);

  // Preparar dados de Consultas Médicas
  const apptHeaders = [
    "ID", "Especialidade", "Médico", "Data", "Hora", "Local", "Lembrete Ativo", "Status", "Observações"
  ];
  const apptRows = appointments.map(a => [
    a.id,
    a.especialidade || '',
    a.medico || '',
    a.data || '',
    a.hora || '',
    a.local || '',
    a.lembreteAtivo ? 'Sim' : 'Não',
    a.status || 'Agendada',
    a.observacoes || ''
  ]);

  // Preparar dados de Receitas Médicas
  const prescHeaders = [
    "ID", "Especialidade", "Médico", "Data Emissão", "Data Vencimento", "Medicamentos", "Instruções", "Observações", "Possui Anexo", "Nome do Arquivo"
  ];
  const prescRows = prescriptions.map(p => {
    const hasAttachment = p.arquivoAnexo ? 'Sim' : 'Não';
    return [
      p.id,
      p.especialidade || '',
      p.medico || '',
      p.data || '',
      p.dataVencimento || '',
      p.medicamentos || '',
      p.instrucoes || '',
      p.observacoes || '',
      hasAttachment,
      p.nomeArquivoAnexo || ''
    ];
  });

  // Preparar dados de Infrações
  const infrHeaders = [
    "ID (Protocolo)", "Título da Infração", "Placa", "Veículo", "Data Ocorrência", "Data Submissão", "Status", "Valor Multa (R$)", "Pontos CNH", "Justificativa/Recurso", "Quantidade de Evidências"
  ];
  const infrRows = infractions.map(inf => [
    inf.id || inf.protocolo || '',
    inf.titulo || '',
    inf.placa || '',
    inf.veiculo || '',
    inf.dataOcorrencia || '',
    inf.dataSubmissao || '',
    inf.status || 'EM_ANALISE',
    inf.valorMulta !== undefined ? inf.valorMulta.toFixed(2).replace('.', ',') : '0,00',
    inf.pontosCnh || 0,
    inf.justificativa || '',
    inf.evidencias ? inf.evidencias.length : 0
  ]);

  // Preparar dados de Agenda e Compromissos
  const compHeaders = [
    "ID", "Título", "Data", "Hora", "Descrição", "Cor de Identificação", "Efeito Alerta (Piscando)", "Lembrete Ativo", "Dias de Antecedência"
  ];
  const compRows = compromissos.map(c => [
    c.id,
    c.titulo || '',
    c.data || '',
    c.hora || '',
    c.descricao || '',
    c.cor || '',
    c.piscando ? 'Sim' : 'Não',
    c.lembreteAtivo ? 'Sim' : 'Não',
    c.diasAntecedencia !== undefined ? c.diasAntecedencia : 2
  ]);

  // Preparar dados de Veículos Registrados
  const vehHeaders = [
    "ID", "Descrição do Veículo", "Motorista Padrão", "Placa", "Mês Final da Placa (IPVA)"
  ];
  const vehRows = registeredVehicles.map(v => [
    v.id,
    v.descricao || '',
    v.motorista || '',
    v.placa || '',
    v.mesFinalPlaca || ''
  ]);

  // Preparar dados de Serviços Realizados
  const perfHeaders = [
    "ID", "Veículo", "Descrição do Serviço", "Data Realização", "Quilometragem (KM)", "Valor Pago (R$)", "Oficina/Estabelecimento", "Observações"
  ];
  const perfRows = performedServices.map(s => [
    s.id,
    s.veiculoDescricao || '',
    s.descricao || '',
    s.data || '',
    s.km !== undefined ? String(s.km) : '',
    s.valor !== undefined ? s.valor.toFixed(2).replace('.', ',') : '0,00',
    s.oficina || '',
    s.observacoes || ''
  ]);

  // Preparar dados de Serviços Agendados
  const schedHeaders = [
    "ID", "Veículo", "Descrição do Serviço Planejado", "Tipo de Agendamento", "Data Alvo", "Quilometragem Alvo (KM)", "Recorrente", "Frequência (Meses)", "Frequência (KM)", "Status"
  ];
  const schedRows = scheduledServices.map(s => [
    s.id,
    s.veiculoDescricao || '',
    s.descricao || '',
    s.tipoAgendamento || 'DATA',
    s.dataAlvo || '',
    s.kmAlvo !== undefined ? String(s.kmAlvo) : '',
    s.recorrente ? 'Sim' : 'Não',
    s.frequenciaMeses !== undefined ? String(s.frequenciaMeses) : '',
    s.frequenciaKm !== undefined ? String(s.frequenciaKm) : '',
    s.status || 'PENDENTE'
  ]);

  // Preparar dados de Contas Bancárias
  const bankHeaders = [
    "ID", "Nome da Conta/Banco", "Tipo", "Agência", "Conta", "Saldo Inicial (R$)", "Limite Especial (R$)"
  ];
  const bankRows = bankAccounts.map(b => [
    b.id,
    b.nome || '',
    b.tipo || 'BANCO',
    b.agencia || '',
    b.conta || '',
    b.saldoInicial !== undefined ? b.saldoInicial.toFixed(2).replace('.', ',') : '0,00',
    b.limite !== undefined ? b.limite.toFixed(2).replace('.', ',') : '0,00'
  ]);

  // Preparar dados de Cartões de Crédito
  const cardHeaders = [
    "ID", "Nome do Cartão", "Tipo", "Limite Total (R$)", "Gasto Atual (R$)", "Limite Disponível (R$)"
  ];
  const cardRows = creditCards.map(c => [
    c.id,
    c.nome || '',
    c.tipo || 'CARTÃO',
    c.limite !== undefined ? c.limite.toFixed(2).replace('.', ',') : '0,00',
    c.gasto !== undefined ? c.gasto.toFixed(2).replace('.', ',') : '0,00',
    c.limite !== undefined && c.gasto !== undefined ? (c.limite - c.gasto).toFixed(2).replace('.', ',') : '0,00'
  ]);

  // 4. Limpar os dados antigos de todas as abas usando os nomes resolvidos exatos
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`;
  const clearRes = await googleApiFetch(clearUrl, accessToken, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ranges: [
        `'${txSheetTitle}'!A1:T2000`, 
        `'${zoneSheetTitle}'!A1:O2000`,
        `'${apptSheetTitle}'!A1:I2000`,
        `'${prescSheetTitle}'!A1:J2000`,
        `'${infrSheetTitle}'!A1:K2000`,
        `'${compSheetTitle}'!A1:I2000`,
        `'${vehSheetTitle}'!A1:E2000`,
        `'${perfSheetTitle}'!A1:H2000`,
        `'${schedSheetTitle}'!A1:J2000`,
        `'${bankSheetTitle}'!A1:G2000`,
        `'${cardSheetTitle}'!A1:F2000`
      ]
    })
  });
  if (!clearRes.ok) {
    console.warn("Aviso ao limpar os dados antigos da planilha:", await clearRes.text());
  }

  // 5. Gravar os dados em lote nas abas correspondentes
  const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
  const writeBody = {
    valueInputOption: 'USER_ENTERED',
    data: [
      {
        range: `'${txSheetTitle}'!A1`,
        majorDimension: 'ROWS',
        values: [txHeaders, ...txRows]
      },
      {
        range: `'${zoneSheetTitle}'!A1`,
        majorDimension: 'ROWS',
        values: [zoneHeaders, ...zoneRows]
      },
      {
        range: `'${apptSheetTitle}'!A1`,
        majorDimension: 'ROWS',
        values: [apptHeaders, ...apptRows]
      },
      {
        range: `'${prescSheetTitle}'!A1`,
        majorDimension: 'ROWS',
        values: [prescHeaders, ...prescRows]
      },
      {
        range: `'${infrSheetTitle}'!A1`,
        majorDimension: 'ROWS',
        values: [infrHeaders, ...infrRows]
      },
      {
        range: `'${compSheetTitle}'!A1`,
        majorDimension: 'ROWS',
        values: [compHeaders, ...compRows]
      },
      {
        range: `'${vehSheetTitle}'!A1`,
        majorDimension: 'ROWS',
        values: [vehHeaders, ...vehRows]
      },
      {
        range: `'${perfSheetTitle}'!A1`,
        majorDimension: 'ROWS',
        values: [perfHeaders, ...perfRows]
      },
      {
        range: `'${schedSheetTitle}'!A1`,
        majorDimension: 'ROWS',
        values: [schedHeaders, ...schedRows]
      },
      {
        range: `'${bankSheetTitle}'!A1`,
        majorDimension: 'ROWS',
        values: [bankHeaders, ...bankRows]
      },
      {
        range: `'${cardSheetTitle}'!A1`,
        majorDimension: 'ROWS',
        values: [cardHeaders, ...cardRows]
      }
    ]
  };

  const writeRes = await googleApiFetch(writeUrl, accessToken, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(writeBody)
  });

  if (!writeRes.ok) {
    const errorDetails = await writeRes.text();
    throw new Error(`Erro ao gravar dados em lote na planilha: ${errorDetails}`);
  }

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
};

/**
 * Sincroniza a lista de transações com a planilha do Google Sheets.
 */
export const syncTransactionsToSpreadsheet = async (
  accessToken: string,
  spreadsheetId: string,
  transactions: any[]
): Promise<string> => {
  // Limpar dados anteriores para evitar que sobrem linhas velhas se a nova lista for menor
  const clearRes = await googleApiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:Z1000:clear`, accessToken, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  if (!clearRes.ok) {
    console.warn("Aviso ao limpar planilha:", await clearRes.text());
  }

  // Order transactions by date (ascending) to calculate KM differences for fuel efficiency
  const sortedTx = [...transactions].sort((a, b) => {
    const partsA = (a.data || '').split('/');
    const partsB = (b.data || '').split('/');
    const dateA = partsA.length === 3 ? new Date(`${partsA[2]}-${partsA[1]}-${partsA[0]}`).getTime() : 0;
    const dateB = partsB.length === 3 ? new Date(`${partsB[2]}-${partsB[1]}-${partsB[0]}`).getTime() : 0;
    return dateA - dateB;
  });

  const kmMapByVehicle: { [vehicle: string]: number } = {};
  const kmPercorridoByTxId: { [txId: number]: number } = {};
  const mediaMapByTxId: { [txId: number]: number } = {};

  sortedTx.forEach(t => {
    if (t.categoria === 'ABASTECIMENTO' && t.km) {
      const vehicle = (t.veiculo || 'FOX').toUpperCase();
      const prevKm = kmMapByVehicle[vehicle];
      if (prevKm !== undefined && t.km > prevKm) {
        const distance = t.km - prevKm;
        kmPercorridoByTxId[t.id] = distance;
        if (t.litros && t.litros > 0) {
          mediaMapByTxId[t.id] = distance / t.litros;
        }
      }
      kmMapByVehicle[vehicle] = t.km;
    }
  });

  const headers = [
    "ID", "Data", "Descrição", "Categoria", "Valor (R$)", "Tipo", "Status",
    "Valor_PG", "KM", "Litros", "Preço por Litro", "Veículo",
    "Completou o Tanque", "KM Percorrido", "Média (Km/L)",
    "Nome Posto", "Localização do Posto", "Motorista", "OBS"
  ];

  const rows = transactions.map(t => {
    const isAbastecimento = t.categoria === 'ABASTECIMENTO';
    const media = mediaMapByTxId[t.id];
    const kmPerc = kmPercorridoByTxId[t.id];
    const valorPgVal = t.valorPg !== undefined ? t.valorPg : (t.status === 'PAGO' ? t.valor : 0);

    return [
      t.id,
      t.data,
      t.descricao,
      t.categoria,
      t.valor.toFixed(2).replace('.', ','),
      isAbastecimento ? (t.tipo || 'DESPESA') : (t.tipo === 'RECEITA' ? 'Receita' : 'Despesa'),
      t.status,
      valorPgVal.toFixed(2).replace('.', ','),
      isAbastecimento && t.km ? String(t.km) : '',
      isAbastecimento && t.litros ? t.litros.toFixed(2).replace('.', ',') : '',
      isAbastecimento && t.precoLitro ? t.precoLitro.toFixed(3).replace('.', ',') : '',
      isAbastecimento ? (t.veiculo || 'FOX') : '',
      isAbastecimento ? (t.completouTanque ? 'Sim' : 'Não') : '',
      isAbastecimento && kmPerc !== undefined ? String(kmPerc) : '',
      isAbastecimento && media !== undefined ? media.toFixed(2).replace('.', ',') : '',
      isAbastecimento && t.nomePosto ? t.nomePosto : '',
      isAbastecimento && t.localizacaoPosto ? t.localizacaoPosto : '',
      isAbastecimento && t.motorista ? t.motorista : '',
      t.obs || ''
    ];
  });

  const body = {
    range: 'A1',
    majorDimension: 'ROWS',
    values: [headers, ...rows]
  };

  const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1?valueInputOption=USER_ENTERED`;
  const writeRes = await googleApiFetch(writeUrl, accessToken, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!writeRes.ok) {
    const errorDetails = await writeRes.text();
    throw new Error(`Erro ao gravar dados na planilha: ${errorDetails}`);
  }

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
};

/**
 * Busca transações da planilha do Google Sheets.
 */
export const fetchTransactionsFromSpreadsheet = async (
  accessToken: string,
  spreadsheetId: string
): Promise<any[]> => {
  // 1. Buscar metadados para saber os nomes das abas reais da planilha
  const metaRes = await googleApiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, accessToken);
  
  let targetSheetName = 'Transações'; // default fallback
  
  if (metaRes.ok) {
    const metaData = await metaRes.json();
    const existingSheetTitles: string[] = (metaData.sheets || []).map((s: any) => s.properties.title);
    
    // Procura por alguma aba que normalizada corresponda a 'TRANSACOES'
    const match = existingSheetTitles.find(title => {
      const normalized = title.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return normalized === 'TRANSACOES' || normalized === 'TRANSACAOES' || normalized === 'TRANSACAO' || normalized === 'TRANSACOESFINANCAS';
    });
    
    if (match) {
      targetSheetName = match;
    } else if (existingSheetTitles.length > 0) {
      // tenta pegar a primeira aba que não seja de Recursos/Infrações se possível
      const firstNonRecurso = existingSheetTitles.find(t => !t.toUpperCase().includes('RECURSO'));
      if (firstNonRecurso) {
        targetSheetName = firstNonRecurso;
      } else {
        targetSheetName = existingSheetTitles[0];
      }
    }
  }

  const range = encodeURIComponent(`'${targetSheetName}'!A1:S2000`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
  
  const response = await googleApiFetch(url, accessToken);

  if (!response.ok) {
    const errorDetails = await response.text();
    throw new Error(`Erro ao buscar dados da aba '${targetSheetName}': ${errorDetails}`);
  }

  const data = await response.json();
  const rows = data.values;
  if (!rows || rows.length === 0) {
    return [];
  }

  // Normalizador para cabeçalhos e termos de busca
  const normalizeHeader = (str: string): string => {
    return String(str || '')
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .replace(/[^A-Z0-9]/g, "");     // remove tudo que não for letra ou número
  };

  // Encontra a linha de cabeçalho dinamicamente procurando por palavras-chave conhecidas
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    // Se o vetor tiver campos de ID, DATA, CATEGORIA ou DESCRICAO
    const hasHeaderKeywords = row.some((cell: any) => {
      const norm = normalizeHeader(String(cell || ''));
      return norm === 'ID' || norm === 'DATA' || norm.includes('DESCRIC') || norm === 'CATEGORIA' || norm === 'VALOR';
    });
    
    if (hasHeaderKeywords) {
      headerRowIndex = i;
      break;
    }
  }

  // Fallback se não encontrar nenhuma linha com palavras-chave claras
  if (headerRowIndex === -1) {
    headerRowIndex = 0;
  }

  const headers = rows[headerRowIndex].map((h: string) => String(h || '').trim());
  const normalizedHeaders = headers.map((h: string) => normalizeHeader(h));
  
  const getColIndex = (names: string[], defaultIdx: number) => {
    const normalizedNames = names.map(n => normalizeHeader(n));
    for (const name of normalizedNames) {
      const idx = normalizedHeaders.indexOf(name);
      if (idx !== -1) return idx;
    }
    return defaultIdx;
  };

  const idxId = getColIndex(["ID", "CODIGO", "CÓDIGO", "IDENTIFICADOR"], 0);
  const idxData = getColIndex(["Data", "DATE", "DATA", "DIAS"], 1);
  const idxDesc = getColIndex(["Descrição", "DESCRICAO", "DESCRIPTION", "DESCRIÇÃO", "DESC", "DESCR", "NOME"], 2);
  const idxCat = getColIndex(["Categoria", "CATEGORIA", "CATEGORY", "CAT", "GRUPO", "CLASSIFICACAO", "CLASSIFICAÇÃO"], 3);
  const idxValor = getColIndex(["Valor", "Valor (R$)", "VALOR", "VALUE", "PRECO", "PREÇO", "MONTANTE"], 4);
  const idxTipo = getColIndex(["Tipo", "TIPO", "TYPE", "COMBUSTIVEL", "COMBUSTÍVEL"], 5);
  const idxStatus = getColIndex(["Status", "STATUS", "SITUACAO", "SITUAÇÃO"], 6);
  const idxValorPg = getColIndex(["Valor_PG", "VALOR_PG", "Valor Pago", "VALOR_PAGO"], 7);
  const idxKm = getColIndex(["KM"], 8);
  const idxLitros = getColIndex(["Litros", "LITROS", "LITERS"], 9);
  const idxPrecoLitro = getColIndex(["Preço por Litro", "Preco por Litro", "PRECO_LITRO", "PREÇO POR LITRO"], 10);
  const idxVeiculo = getColIndex(["Veículo", "Veiculo", "VEHICLE", "VEÍCULO"], 11);
  const idxCompletou = getColIndex(["Completou o Tanque", "Completou", "COMPLETOU_TANQUE", "COMPLETOU O TANQUE"], 12);
  const idxObs = getColIndex(["OBS", "OBSERVAÇÕES", "OBSERVACOES", "NOTE"], 18);
  const idxNomePosto = getColIndex(["Nome Posto", "POSTO", "GAS_STATION", "NOME POSTO"], 15);
  const idxLocalPosto = getColIndex(["Localização do Posto", "LOCALIZACAO_POSTO", "LOCALIZAÇÃO DO POSTO"], 16);
  const idxMotorista = getColIndex(["Motorista", "DRIVER"], 17);
  const idxDescricaoVeiculo = getColIndex(["Descrição do Veículo", "Descricao do Veiculo", "DESCRIÇÃO DO VEÍCULO", "DESCRICAO_VEICULO", "DESCRIÇÃO VEÍCULO", "DESCRICAO VEICULO"], 19);

  // Função auxiliar para analisar números de forma segura (lidando com R$, pontos e vírgulas)
  const parseBrazilianOrRawNumber = (valStr: string): number => {
    let clean = String(valStr || '').trim().toUpperCase().replace(/\s/g, '').replace('R$', '');
    if (clean === '' || clean === '-') return 0;
    
    // Se possuir vírgula, assume o formato brasileiro: e.g. "1.250,50" ou "50,00"
    if (clean.includes(',')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    }
    // Caso contrário, assume o formato decimal direto: e.g. "1250.50" ou "50"
    
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  const transactions: any[] = [];
  const seenIds = new Set<number>();

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    // Se a descrição estiver totalmente em branco, ignora a linha
    const descValue = row[idxDesc];
    if (descValue === undefined || String(descValue).trim() === '') continue;

    const valor = parseBrazilianOrRawNumber(row[idxValor]);
    const valorPgVal = row[idxValorPg] !== undefined ? parseBrazilianOrRawNumber(row[idxValorPg]) : undefined;

    let parsedId = parseInt(row[idxId]);
    if (isNaN(parsedId) || parsedId <= 0) {
      const dataStr = String(row[idxData] || '');
      const descStr = String(row[idxDesc] || '');
      const tipoStr = String(row[idxTipo] || 'DESPESA');
      const hashStr = `${dataStr}_${descStr}_${valor}_${tipoStr}`;
      let hash = 0;
      for (let charIdx = 0; charIdx < hashStr.length; charIdx++) {
        hash = (hash << 5) - hash + hashStr.charCodeAt(charIdx);
        hash = hash & hash;
      }
      parsedId = 100000000 + Math.abs(hash % 900000000);
    }

    let salt = 0;
    while (seenIds.has(parsedId)) {
      salt++;
      const dataStr = String(row[idxData] || '');
      const descStr = String(row[idxDesc] || '');
      const tipoStr = String(row[idxTipo] || 'DESPESA');
      const hashStr = `${dataStr}_${descStr}_${valor}_${tipoStr}_${salt}`;
      let hash = 0;
      for (let charIdx = 0; charIdx < hashStr.length; charIdx++) {
        hash = (hash << 5) - hash + hashStr.charCodeAt(charIdx);
        hash = hash & hash;
      }
      parsedId = 100000000 + Math.abs(hash % 900000000);
    }
    seenIds.add(parsedId);

    const km = row[idxKm] !== undefined && String(row[idxKm]).trim() !== '' 
      ? parseBrazilianOrRawNumber(row[idxKm]) 
      : undefined;
    const litros = row[idxLitros] !== undefined && String(row[idxLitros]).trim() !== '' 
      ? parseBrazilianOrRawNumber(row[idxLitros]) 
      : undefined;
    const precoLitro = row[idxPrecoLitro] !== undefined && String(row[idxPrecoLitro]).trim() !== '' 
      ? parseBrazilianOrRawNumber(row[idxPrecoLitro]) 
      : undefined;
    
    const completouStr = String(row[idxCompletou] || '').toUpperCase();
    const completouTanque = completouStr === 'SIM' || completouStr === 'TRUE' || completouStr === 'S' || completouStr === '1';

    const rawCat = String(row[idxCat] || 'OUTROS').trim().toUpperCase();
    const normalizedCat = rawCat.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");

    const rawTipo = String(row[idxTipo] || 'DESPESA').trim().toUpperCase();
    const rawDesc = String(row[idxDesc] || '').trim().toUpperCase();

    // Categorização inteligente para Abastecimento
    let category = 'OUTROS';
    const isFuelType = ['ETANOL', 'GAS. COMUM', 'GAS. ADITIVADA', 'DIESEL', 'GAS COMUM', 'GAS ADITIVADA', 'GASOLINA', 'ALCOOL', 'ETANOL ADITIVADA'].includes(rawTipo);
    const hasFuelKeywords = rawDesc.includes('POSTO') || rawDesc.includes('ABASTECE') || rawDesc.includes('COMBUS') || rawDesc.includes('IPIRANGA') || rawDesc.includes('SHELL') || rawDesc.includes('BR ') || rawDesc.includes('GASPRIME') || rawDesc.includes('TAURIS');

    if (normalizedCat.includes('ABASTECIMENTO') || normalizedCat.includes('COMBUSTIVEL') || isFuelType || (hasFuelKeywords && (normalizedCat === '' || normalizedCat === 'OUTROS' || normalizedCat === 'DESPESA'))) {
      category = 'ABASTECIMENTO';
    } else if (normalizedCat.includes('CASA')) {
      category = 'CASA';
    } else if (normalizedCat.includes('CONSUMO') || normalizedCat.includes('CUMSUMO')) {
      category = 'CONSUMO';
    } else if (normalizedCat.includes('TRABALHO')) {
      category = 'TRABALHO';
    } else if (normalizedCat.includes('PESSOAL')) {
      category = 'PESSOAL';
    } else if (normalizedCat.includes('SHOPPING')) {
      category = 'SHOPPING';
    } else if (normalizedCat.includes('ALIMENTACAO') || normalizedCat.includes('ALIMENTACA')) {
      category = 'ALIMENTAÇÃO';
    } else if (normalizedCat.includes('SAUDE')) {
      category = 'SAÚDE';
    } else {
      category = rawCat || 'OUTROS';
    }

    const tx = {
      id: parsedId,
      data: row[idxData] || new Date().toLocaleDateString('pt-BR'),
      descricao: String(row[idxDesc] || '').toUpperCase(),
      categoria: category,
      valor,
      tipo: String(row[idxTipo] || 'DESPESA').toUpperCase(),
      status: String(row[idxStatus] || 'PENDENTE').toUpperCase(),
      valorPg: valorPgVal !== undefined && isNaN(valorPgVal) ? undefined : valorPgVal,
      km: km !== undefined && isNaN(km) ? undefined : km,
      litros: litros !== undefined && isNaN(litros) ? undefined : litros,
      precoLitro: precoLitro !== undefined && isNaN(precoLitro) ? undefined : precoLitro,
      veiculo: row[idxVeiculo] ? String(row[idxVeiculo]).toUpperCase() : undefined,
      descricaoVeiculo: row[idxDescricaoVeiculo] ? String(row[idxDescricaoVeiculo]) : undefined,
      completouTanque,
      nomePosto: row[idxNomePosto] ? String(row[idxNomePosto]).toUpperCase() : undefined,
      localizacaoPosto: row[idxLocalPosto] ? String(row[idxLocalPosto]).toUpperCase() : undefined,
      motorista: row[idxMotorista] ? String(row[idxMotorista]).toUpperCase() : undefined,
      obs: row[idxObs] ? String(row[idxObs]) : undefined
    };

    transactions.push(tx);
  }

  return transactions;
};
