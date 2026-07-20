
// Service Worker to handle background/minimized notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    event.waitUntil(
      self.registration.showNotification(event.data.title, {
        body: event.data.body,
        icon: event.data.icon,
        tag: event.data.tag || 'risk-zone-alert',
        renotify: event.data.renotify !== false,
        requireInteraction: event.data.requireInteraction !== false,
        vibrate: event.data.vibrate || [500, 110, 500, 110, 450, 110, 200, 110, 170, 40],
        silent: false
      })
    );
  }
});

// 1. Ouvir o evento push enviado pelo servidor
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'Pix Recebido! 💸',
        body: event.data.text()
      };
    }
  }

  const title = data.title || 'Pix Recebido! 💸';
  const options = {
    body: data.body || 'Nova transação financeira recebida.',
    icon: data.icon || 'https://cdn-icons-png.flaticon.com/512/10542/10542475.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/10542/10542475.png',
    vibrate: [200, 100, 200, 100, 200, 100, 200],
    tag: data.tag || 'pix-notification',
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || '/?tab=transactions&add=true',
      valor: data.valor,
      descricao: data.descricao,
      banco: data.banco
    },
    // 2. Exibir os botões interativos nativos na notificação
    actions: [
      {
        action: 'receita',
        title: '📈 Receita',
        icon: 'https://cdn-icons-png.flaticon.com/512/189/189246.png'
      },
      {
        action: 'despesa',
        title: '📉 Despesa',
        icon: 'https://cdn-icons-png.flaticon.com/512/189/189247.png'
      }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 3. Ouvir o clique na notificação e nos botões interativos
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data || {};
  
  // Utiliza a origem dinâmica (seja em localhost ou financas-gaeta-app.onrender.com)
  let targetUrl = notificationData.url || '/?tab=transactions&add=true';
  if (!targetUrl.startsWith('http')) {
    targetUrl = self.location.origin + targetUrl;
  }
  
  // 4. Se clicado em Receita ou Despesa, anexa as flags corretas na URL
  if (action === 'receita') {
    targetUrl += `&tipo=RECEITA`;
  } else if (action === 'despesa') {
    targetUrl += `&tipo=DESPESA`;
  }
  
  // Anexa os parâmetros de valor, descrição e banco
  if (notificationData.valor) {
    targetUrl += `&valor=${encodeURIComponent(notificationData.valor)}`;
  }
  if (notificationData.descricao) {
    targetUrl += `&descricao=${encodeURIComponent(notificationData.descricao)}`;
  }
  if (notificationData.banco) {
    targetUrl += `&banco=${encodeURIComponent(notificationData.banco)}`;
  }

  // Abre ou redireciona a janela atual do navegador
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Procura por alguma aba já aberta do app para focar e navegar
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            return client.navigate(targetUrl).then(c => c ? c.focus() : null);
          }
          return client.focus();
        }
      }
      // Se não houver abas abertas, abre uma nova janela
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
