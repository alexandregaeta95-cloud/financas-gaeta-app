import fs from "fs";
import path from "path";
import webpush from "web-push";

// Caminhos dos arquivos JSON para salvar as chaves e as inscrições localmente
const KEYS_FILE = path.resolve(process.cwd(), ".vapid-keys.json");
const SUBS_FILE = path.resolve(process.cwd(), ".push-subscriptions.json");

let vapidKeys: { publicKey: string; privateKey: string };

// Gera ou recupera as chaves VAPID necessárias para o Web Push
if (fs.existsSync(KEYS_FILE)) {
  try {
    vapidKeys = JSON.parse(fs.readFileSync(KEYS_FILE, "utf-8"));
  } catch (e) {
    vapidKeys = webpush.generateVAPIDKeys();
    fs.writeFileSync(KEYS_FILE, JSON.stringify(vapidKeys), "utf-8");
  }
} else {
  vapidKeys = webpush.generateVAPIDKeys();
  fs.writeFileSync(KEYS_FILE, JSON.stringify(vapidKeys), "utf-8");
}

// Configura os detalhes VAPID para a biblioteca web-push
webpush.setVapidDetails(
  'mailto:alexandregaeta95@gmail.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

/**
 * Retorna a chave pública VAPID para registro no frontend
 */
export function getPublicKey() {
  return vapidKeys.publicKey;
}

// Armazenamento em memória das inscrições lidas do arquivo
let subscriptions: webpush.PushSubscription[] = [];

if (fs.existsSync(SUBS_FILE)) {
  try {
    subscriptions = JSON.parse(fs.readFileSync(SUBS_FILE, "utf-8"));
  } catch (e) {
    subscriptions = [];
  }
}

/**
 * Salva uma nova inscrição de dispositivo evitando duplicidade
 */
export function addSubscription(sub: webpush.PushSubscription) {
  const exists = subscriptions.some(s => s.endpoint === sub.endpoint);
  if (!exists) {
    subscriptions.push(sub);
    try {
      fs.writeFileSync(SUBS_FILE, JSON.stringify(subscriptions), "utf-8");
    } catch (e) {
      console.error("Falha ao salvar as inscrições de push em arquivo:", e);
    }
  }
}

/**
 * Dispara uma notificação push para todos os dispositivos inscritos ativos
 */
export async function sendPushNotification(payload: any) {
  const payloadStr = JSON.stringify(payload);
  const unsuccessful: webpush.PushSubscription[] = [];

  const promises = subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(sub, payloadStr);
    } catch (error: any) {
      console.error("Erro ao enviar push notification para o dispositivo:", error);
      // Se a inscrição expirou ou é inválida (status 410 ou 404), remove do registro
      if (error.statusCode === 410 || error.statusCode === 404) {
        unsuccessful.push(sub);
      }
    }
  });

  await Promise.all(promises);

  // Limpeza automática de inscrições inválidas ou expiradas
  if (unsuccessful.length > 0) {
    subscriptions = subscriptions.filter(s => !unsuccessful.includes(s));
    try {
      fs.writeFileSync(SUBS_FILE, JSON.stringify(subscriptions), "utf-8");
    } catch (e) {
      console.error("Falha ao atualizar o arquivo de inscrições pós-limpeza:", e);
    }
  }
}
