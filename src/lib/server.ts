import { Router } from "express";
import { getPublicKey, addSubscription, sendPushNotification } from "./pushService";

const router = Router();

// Storage em memória para exibição imediata na tela via polling do cliente
export const pendingWebhooks: any[] = [];

// Habilita CORS flexível para garantir que posts de webhooks bancários externos funcionem sem bloqueio
router.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Endpoint do Webhook principal de entrada de Pix
router.post("/api/webhooks/bank", (req, res) => {
  try {
    const { banco, valor, descricao, text, tipo } = req.body;

    // Validação mínima do corpo da requisição
    if (!text && !descricao && !valor) {
      console.warn("[Webhook Bank] Requisição de webhook vazia rejeitada");
      return res.status(400).json({
        success: false,
        error: "Dados da transação ausentes. Envie 'text', 'descricao' ou 'valor'."
      });
    }

    let finalBanco = banco || "Banco";
    let finalValor = parseFloat(valor) || 0;
    let finalDescricao = descricao || text || "Transação em Tempo Real";

    // RegExp avançada para extrair valores em reais em formatos como "R$ 150,00"
    if (text) {
      const match = text.match(/R\$\s*([0-9]+(?:\.[0-9]+)*(?:,[0-9]{2})?)/i);
      if (match) {
        let valStr = match[1];
        // Remove pontos de milhar e substitui vírgula decimal por ponto flutuante
        valStr = valStr.replace(/\./g, "").replace(",", ".");
        const parsedVal = parseFloat(valStr);
        if (!isNaN(parsedVal)) {
          finalValor = parsedVal;
        }
      }

      // Detecção inteligente de banco baseada no texto descritivo
      const lowerText = text.toLowerCase();
      if (lowerText.includes("itau") || lowerText.includes("itaú")) finalBanco = "Itaú";
      else if (lowerText.includes("nubank")) finalBanco = "Nubank";
      else if (lowerText.includes("bradesco")) finalBanco = "Bradesco";
      else if (lowerText.includes("banco do brasil") || lowerText.includes("bb")) finalBanco = "Banco do Brasil";
      else if (lowerText.includes("inter")) finalBanco = "Inter";
      else if (lowerText.includes("c6")) finalBanco = "C6 Bank";
      else if (lowerText.includes("santander")) finalBanco = "Santander";
    }

    const newWebhook = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      bancoNome: finalBanco,
      valor: finalValor,
      descricao: finalDescricao,
      tipo: (tipo && ["RECEITA", "DESPESA", "TRANSFERENCIA"].includes(tipo.toUpperCase())) 
        ? tipo.toUpperCase() 
        : "DETERMINAR",   
      timestamp: Date.now()
    };

    pendingWebhooks.push(newWebhook);

    // Mantém a fila em memória limpa e leve
    if (pendingWebhooks.length > 50) {
      pendingWebhooks.shift();
    }

    // Dispara a Notificação Rich Web Push para o navegador do celular inscrito
    const pushPayload = {
      title: `Pix Recebido - R$ ${finalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      body: `Nova transação no ${finalBanco}: "${finalDescricao}". Toque para classificar.`,
      valor: finalValor,
      descricao: finalDescricao,
      banco: finalBanco,
      tipo: tipo || "DETERMINAR",
      url: "/?tab=transactions&add=true"
    };

    sendPushNotification(pushPayload).catch(err => {
      console.error("[Push Notification] Falha ao enviar Web Push:", err);
    });

    console.log("[Webhook Bank] Webhook de Pix processado e enviado via push com sucesso:", newWebhook);
    
    return res.status(200).json({ 
      success: true, 
      message: "Webhook processado e evento de push disparado com sucesso", 
      received: newWebhook 
    });
  } catch (error: any) {
    console.error("[Webhook Bank] Erro ao processar o webhook:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Falha ao processar webhook" 
    });
  }
});

// Endpoint secundário para sincronização em tempo real (polling do dashboard)
router.get("/api/webhooks/pending", (req, res) => {
  try {
    const since = parseInt(req.query.since as string) || 0;
    const fresh = pendingWebhooks.filter(w => w.timestamp > since);
    return res.status(200).json({ webhooks: fresh });
  } catch (error: any) {
    console.error("[Webhook Bank] Erro ao obter webhooks pendentes:", error);
    return res.status(500).json({ error: "Falha ao obter webhooks pendentes" });
  }
});

// Endpoint para entregar a Chave Pública VAPID ao navegador
router.get("/api/webhooks/push-public-key", (req, res) => {
  try {
    return res.status(200).json({ publicKey: getPublicKey() });
  } catch (error: any) {
    console.error("[Push Service] Erro ao obter chave pública VAPID:", error);
    return res.status(500).json({ error: "Falha ao obter chave pública" });
  }
});

// Endpoint para assinar o dispositivo/navegador do usuário
router.post("/api/webhooks/push-subscribe", (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: "Objeto de inscrição inválido ou ausente" });
    }
    addSubscription(subscription);
    return res.status(200).json({ success: true, message: "Dispositivo registrado com sucesso para Web Push" });
  } catch (error: any) {
    console.error("[Push Service] Erro ao salvar inscrição de push:", error);
    return res.status(500).json({ error: "Falha ao registrar inscrição no servidor" });
  }
});

export default router;
