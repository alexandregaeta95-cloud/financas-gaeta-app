import { Router } from "express";

const router = Router();

// Global in-memory storage for pending webhooks
export const pendingWebhooks: any[] = [];

// Enable CORS for this router specifically to ensure public MacroDroid posts work seamlessly from any network
router.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// API to receive real webhook notifications from banking apps or mobile automation (MacroDroid)
router.post("/api/webhooks/bank", (req, res) => {
  try {
    const { banco, valor, descricao, text, tipo } = req.body;

    // Validation: Require at least some identifier or description text
    if (!text && !descricao && !valor) {
      console.warn("[Webhook Bank] Rejected empty request payload");
      return res.status(400).json({
        success: false,
        error: "Missing transaction data. Please provide 'text', 'descricao', or 'valor'."
      });
    }

    let finalBanco = banco || "Banco";
    let finalValor = parseFloat(valor) || 0;
    let finalDescricao = descricao || text || "Transação em Tempo Real";

    // Regex to parse Brazilian Currency from notification text (e.g. R$ 150,00)
    if (text) {
      const match = text.match(/R\$\s*([0-9]+(?:\.[0-9]+)*(?:,[0-9]{2})?)/i);
      if (match) {
        let valStr = match[1];
        // Clean up thousands dot and replace decimals comma with dot
        valStr = valStr.replace(/\./g, "").replace(",", ".");
        const parsedVal = parseFloat(valStr);
        if (!isNaN(parsedVal)) {
          finalValor = parsedVal;
        }
      }

      // Bank detection from text
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

    // Keep array small
    if (pendingWebhooks.length > 50) {
      pendingWebhooks.shift();
    }

    console.log("[Webhook Bank] Real-time MacroDroid Webhook successfully validated and dispatched:", newWebhook);
    
    return res.status(200).json({ 
      success: true, 
      message: "Webhook processed and integration event dispatched successfully", 
      received: newWebhook 
    });
  } catch (error: any) {
    console.error("[Webhook Bank] Error processing MacroDroid webhook:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to process webhook" 
    });
  }
});

// Client polling API to fetch new banking notifications
router.get("/api/webhooks/pending", (req, res) => {
  try {
    const since = parseInt(req.query.since as string) || 0;
    const fresh = pendingWebhooks.filter(w => w.timestamp > since);
    return res.status(200).json({ webhooks: fresh });
  } catch (error: any) {
    console.error("[Webhook Bank] Error serving pending webhooks:", error);
    return res.status(500).json({ error: "Failed to fetch pending webhooks" });
  }
});

export default router;
