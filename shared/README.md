# ZoomPanel Shared Domain & Type Contracts (`shared/`)

This directory is the **single source of truth** for TypeScript type definitions, domain models, and API payload contracts shared between the **backend daemon** and the **frontend user interface**.

---

## 📦 What's Inside

- [`types.ts`](./types.ts): All TypeScript definitions, including:
  - **Site Architecture**: `Site`, `SiteType`, `SiteStatus`, `SiteEnvVar`, `CreateSitePayload`
  - **SSL Certificates**: `SiteSSL` (self-signed, Let's Encrypt, custom)
  - **Database Management**: `SiteDatabase`, `DatabaseTableColumn`, `DatabaseTableIndex`, `DatabaseTableInfo`, `DatabaseQueryResult`
  - **Security & Firewall**: `FirewallRule`, `PortUsage`, `SftpStatus`
  - **Authentication & Users**: `SafeUser`, `PanelSettings`, `SetupPayload`, `LoginPayload`
  - **Server Telemetry**: `SystemStats` (CPU load, memory, disk, uptime, processes)
  - **File Operations**: `FileItem`, `FileContentResponse`

---

## 🛠️ Usage in Backend and Frontend

Both `backend/tsconfig.json` and `frontend/tsconfig.json` include `../shared/**/*` in their compilation scopes.

### Importing Types:
```typescript
import type { Site, SiteSSL, SystemStats } from '../../../shared/types.js';
```

*(Note: The `.js` extension in the import path complies with Node.js ECMAScript Module / `NodeNext` resolution rules when importing TypeScript source files).*

---

## 💡 Best Practices

1. **Always define shared API contracts here first**: When adding a new API endpoint or data model, declare its TypeScript types in `shared/types.ts` before writing the backend route or frontend UI component.
2. **JSON Serializability**: Because these models are transmitted across HTTP endpoints and WebSockets, types in this directory should represent serializable JSON data structures (avoid Node.js-only stream instances or browser-only DOM elements).

