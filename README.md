# Certificador de Tecnologías de Microsoft

Chat web de una sola página con Express 5 y un agente de Microsoft Foundry. El navegador habla únicamente con el backend; el `conversation_id` y los mensajes se guardan en `localStorage` para restaurar conversaciones tras actualizar o volver a abrir el navegador.

## Requisitos

- Node.js 24 LTS y npm.
- Un proyecto de Microsoft Foundry con un agente configurado.
- Acceso mediante `DefaultAzureCredential` (por ejemplo, Azure CLI local o identidad administrada en Azure).

## Configuración local

Define estas variables en `.env` o en el entorno del proceso:

```text
FOUNDRY_PROJECT_ENDPOINT=<endpoint-del-proyecto>
FOUNDRY_AGENT_NAME=<nombre-del-agente>
```

Para crear un agente con `npm run create-agent`, también se requieren:

```text
FOUNDRY_MODEL_DEPLOYMENT=<nombre-del-despliegue-del-modelo>
FOUNDRY_AGENT_INSTRUCTIONS=<instrucciones-completas-del-agente>
```

El script no agrega instrucciones base. Configura las instrucciones completas y apropiadas para el agente antes de crearlo. No uses API keys; autentica con Entra ID y `DefaultAzureCredential`.

## Ejecutar

```powershell
npm install
npm run dev
```

Abre <http://localhost:3000>. `npm start` inicia el servidor sin cargar `.env`, tal como corresponde a entornos que inyectan sus variables. El servidor usa `PORT` si está configurado y, en local, 3000 como valor predeterminado.

## API

- `GET /health` devuelve `{"status":"ok"}`.
- `POST /api/chat` acepta `{"message":"...", "conversation_id":"..."}`. El ID es opcional para el primer turno; la respuesta devuelve `{"response":"...", "conversation_id":"..."}`.
- El mensaje debe contener entre 1 y 2000 caracteres. Entrada inválida: HTTP 422. Error de Foundry: HTTP 502 con mensaje genérico.
- El panel **Conversaciones** permite volver a abrir y continuar conversaciones anteriores. El botón **Nueva** inicia otro chat sin borrar los anteriores. Se conservan las 20 conversaciones más recientes en el navegador; borrar los datos del sitio en el navegador elimina esta copia local. Las conversaciones anteriores no se eliminan del servicio Foundry.
- El historial incluye IDs de conversación y mensajes y puede contener información sensible. Se guarda solo en el navegador actual, no se sincroniza entre dispositivos y no se envía al servidor salvo el ID y los mensajes necesarios al usar el chat.

## Comprobaciones

```powershell
npm test
Invoke-RestMethod http://localhost:3000/health
```

Las pruebas automatizadas usan un cliente Foundry simulado; una conversación real necesita credenciales válidas y un agente existente. Antes de exponer el sitio públicamente, configura autenticación o restricciones de acceso en Azure App Service.
