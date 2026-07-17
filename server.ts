import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import bankWebhookRouter from "./src/lib/server";

let aiClient: any = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for body parsing
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API Route for Google proxy
  app.post("/api/google-proxy", async (req, res) => {
    try {
      const { url, method, headers, body } = req.body;

      if (!url) {
        return res.status(400).json({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          error: "URL is required"
        });
      }

      // Safe headers copy
      const fetchHeaders: Record<string, string> = {};
      if (headers) {
        Object.entries(headers).forEach(([key, val]) => {
          fetchHeaders[key] = String(val);
        });
      }

      const fetchOptions: RequestInit = {
        method: method || "GET",
        headers: fetchHeaders,
      };

      if (body) {
        // body could be string or object. If object, stringify it
        fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
      }

      const googleResponse = await fetch(url, fetchOptions);
      const responseText = await googleResponse.text();

      // Forward response headers that are safe and interesting
      const responseHeaders: Record<string, string> = {};
      googleResponse.headers.forEach((val, key) => {
        if (["content-type"].includes(key.toLowerCase())) {
          responseHeaders[key] = val;
        }
      });

      res.status(googleResponse.status).json({
        ok: googleResponse.ok,
        status: googleResponse.status,
        statusText: googleResponse.statusText,
        headers: responseHeaders,
        data: responseText,
      });
    } catch (err: any) {
      console.error("Error in google-proxy:", err);
      res.status(500).json({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        error: err.message || String(err),
      });
    }
  });

  // Register public unauthenticated banking webhook router
  app.use(bankWebhookRouter);

  // AI API to suggest category based on past transaction history
  app.post("/api/ai/suggest-category", async (req, res) => {
    try {
      const { descricao, valor, bancoNome, historico } = req.body;
      
      if (!descricao) {
        return res.status(400).json({ error: "Descrição da transação é obrigatória." });
      }

      if (!process.env.GEMINI_API_KEY) {
        console.warn("GEMINI_API_KEY is not defined, returning fallback category suggestion.");
        return res.json({
          categoria: "OUTROS",
          justificativa: "Inteligência Artificial indisponível (chave de API ausente).",
          fallback: true
        });
      }

      const ai = getGeminiClient();
      
      const prompt = `Sugira a categoria mais precisa para esta nova transação financeira baseando-se no histórico fornecido.

Nova Transação:
Descrição: "${descricao}"
Valor: R$ ${valor || 0}
Banco: "${bancoNome || 'Banco'}"

Histórico de transações passadas do usuário (formato JSON):
${JSON.stringify(historico || [])}
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "Você é um assistente especialista em finanças pessoais e classificador de transações. Analise as descrições, estabelecimentos, bancos e valores no histórico do usuário para sugerir a categoria ideal com máxima precisão. Prefira reutilizar as categorias que o usuário já possui no seu histórico (como TRABALHO, CONSUMO, ABASTECIMENTO, CASA, OUTROS, SAÚDE, VIAGEM, SUPERMERCADO, etc.) em letras maiúsculas. Retorne obrigatoriamente no formato JSON fornecido pelo schema.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              categoria: {
                type: Type.STRING,
                description: "A categoria sugerida baseada no histórico ou semântica da transação, em letras MAIÚSCULAS."
              },
              justificativa: {
                type: Type.STRING,
                description: "Breve explicação em português sobre a recomendação baseada no histórico."
              }
            },
            required: ["categoria", "justificativa"]
          }
        }
      });

      const responseText = response.text || "{}";
      const parsed = JSON.parse(responseText.trim());
      res.json({
        categoria: String(parsed.categoria || "OUTROS").toUpperCase(),
        justificativa: parsed.justificativa || "Sugerido com base na descrição.",
        fallback: false
      });
    } catch (err: any) {
      console.error("Error in suggest-category API:", err);
      res.json({
        categoria: "OUTROS",
        justificativa: "Erro no processamento da sugestão da IA: " + (err.message || String(err)),
        fallback: true
      });
    }
  });

  // Serve manifest.json explicitly from the root directory
  app.get("/manifest.json", (req, res) => {
    res.sendFile(path.resolve(process.cwd(), "manifest.json"));
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Serve index.html for non-API routes in dev mode
    app.get("*", async (req, res, next) => {
      if (req.path.startsWith("/api/")) {
        return next();
      }
      try {
        const fs = await import("fs");
        let html = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        html = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
