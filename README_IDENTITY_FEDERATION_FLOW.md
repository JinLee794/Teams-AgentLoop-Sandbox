
## Authentication Flow Overview

The following diagram illustrates the complete authentication and authorization flow across all components:

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Teams)
    participant Teams as Teams Client<br/>(A2A Client)
    participant Entra as Microsoft Entra ID
    participant Okta as Okta IdP
    participant LA as Logic App<br/>(Agent Loop + EasyAuth)
    participant AIMS as Azure AI Search<br/>(ServiceNow Index)
    participant OpenAI as Azure OpenAI

    Note over User,OpenAI: Initial Setup: Okta Federation & A2A Agent Discovery

    rect rgb(240, 248, 255)
        Note over User,Entra: Phase 1: User Authentication & SSO Token Acquisition
        User->>Teams: Open ServiceNow Agent
        Teams->>Teams: Check cached token
        alt No valid token
            Teams->>Entra: getAuthToken() request
            Entra->>Entra: Check user identity source
            alt User from federated domain
                Entra->>Okta: Redirect for SAML authentication
                Okta->>User: Present login page
                User->>Okta: Enter credentials
                Okta->>Okta: Validate credentials
                Okta->>Okta: Retrieve user groups
                Okta->>Entra: SAML assertion with groups
                Entra->>Entra: Validate SAML assertion
            else User from Entra ID
                Entra->>User: Present login page
                User->>Entra: Enter credentials
            end
            Entra->>Entra: Generate access token<br/>(includes user ID + group claims)
            Entra-->>Teams: Access token (JWT)
            Teams->>Teams: Cache token
        end
    end

    rect rgb(255, 250, 240)
        Note over Teams,LA: Phase 2: A2A Discovery (One-time on startup)
        Teams->>LA: GET /.well-known/agent-card.json<br/>X-API-Key or Authorization: Bearer {token}
        LA-->>Teams: Agent card: {name, endpoints, capabilities}
        Teams->>Teams: Cache agent endpoints:<br/>- message/send<br/>- tasks/get<br/>- message/stream
    end

    rect rgb(240, 255, 240)
        Note over User,LA: Phase 3: User Query via A2A Protocol
        User->>Teams: "How do I reset my password?"
        Teams->>Teams: Build A2A message payload:<br/>{messageId, role: "user", parts: [text, json]}
        Teams->>LA: POST {AGENT_URL}/message/send<br/>Authorization: Bearer {SSO-token}<br/>Body: JSON-RPC 2.0 with user context
        
        Note over LA: EasyAuth validates JWT before reaching workflow
        LA->>Entra: Validate JWT signature & claims
        Entra-->>LA: Token valid confirmation
        
        LA->>LA: Extract user claims:<br/>- User ID (sub/oid)<br/>- Groups (from token or JSON payload)
        
        alt Need Graph API Access (Optional)
            LA->>Entra: OBO token exchange request<br/>Original token + Graph scope
            Entra->>Entra: Validate original token
            Entra-->>LA: New token for Graph API
            LA->>Entra: Call Graph API<br/>(get additional user info)
            Entra-->>LA: User details
        end
        
        LA-->>Teams: Return {taskId, status: "running"}
    end

    rect rgb(255, 240, 245)
        Note over LA,OpenAI: Phase 4: Agent Loop Execution with Managed Identity
        LA->>LA: Build ACL filter from groups:<br/>acl_groups/any(g: g eq 'group1' OR g eq 'group2')
        
        LA->>Entra: Request managed identity token<br/>Scope: Azure AI Search
        Entra->>Entra: Validate Logic App managed identity
        Entra-->>LA: Access token for AI Search
        
        LA->>AIMS: Search with filter<br/>Authorization: Bearer {MI-token}<br/>$filter: acl_groups AND is_deleted ne true
        AIMS->>AIMS: Execute security-trimmed search
        AIMS-->>LA: Filtered results (only authorized docs)
        
        LA->>Entra: Request managed identity token<br/>Scope: Azure OpenAI
        Entra->>Entra: Validate Logic App managed identity
        Entra-->>LA: Access token for OpenAI
        
        LA->>OpenAI: Generate response<br/>Authorization: Bearer {MI-token}<br/>Context: filtered search results
        OpenAI-->>LA: Generated answer
    end

    rect rgb(245, 245, 245)
        Note over LA,User: Phase 5: A2A Response Delivery
        alt Polling (tasks/get)
            Teams->>LA: POST {AGENT_URL}/tasks/get<br/>Body: {taskId}
            LA-->>Teams: {status: "succeeded", message: {...}}
        else Streaming (message/stream)
            Teams->>LA: GET {AGENT_URL}/message/stream?taskId=...
            LA-->>Teams: SSE: message events + status
        end
        
        Teams->>Teams: Extract message parts[].text<br/>Parse artifacts for citations
        Teams->>Teams: Format as MessageActivity<br/>Add AI-generated indicator
        Teams-->>User: Display answer with feedback buttons
    end

    rect rgb(255, 245, 238)
        Note over User,AIMS: Security Enforcement Points
        Note right of Entra: ✓ Token issued with group claims
        Note right of LA: ✓ EasyAuth validates JWT (signature + claims)
        Note right of LA: ✓ Groups extracted from token/payload
        Note right of AIMS: ✓ Search filtered by ACL groups
        Note right of LA: ✓ Only authorized results in context
    end
```

### Token & ACL Flow

```mermaid
graph TD
    User["👤 User<br/>(Okta Groups: IT-Support, Employees)"] -->|SAML Auth| Okta
    Okta -->|"SAML Assertion<br/>+ Groups: [group-id-1, group-id-2]"| Entra[Entra ID]
    Entra -->|"JWT with groups claim<br/>{groups: [gid1, gid2]}"| Teams[Teams Client]
    
    Teams -->|"A2A: POST /message/send<br/>Bearer: JWT"| LA[Logic App]
    LA -->|"Extract groups from JWT<br/>[gid1, gid2]"| Filter[Build ACL Filter]
    Filter -->|"OData: acl_groups/any(g:<br/>g eq 'gid1' OR g eq 'gid2')"| Search[Azure AI Search]
    
    Search -->|"Security-Trimmed Results<br/>(only docs with matching ACLs)"| LA
    LA -->|MI Token| OpenAI[Azure OpenAI]
    OpenAI -->|Generated Response| LA
    LA -->|A2A Response| Teams
    Teams -->|Display| User

    style User fill:#e1f5ff
    style Okta fill:#fff4e1
    style Entra fill:#e1ffe1
    style Filter fill:#ffe1e1
    style Search fill:#e1fff4
```

### A2A Protocol Endpoints

**📚 [A2A Protocol v1 Specification](https://a2a-protocol.org/latest/specification/) | [Method Mapping Reference (Section 3.5.6)](https://a2a-protocol.org/latest/specification/#356-method-mapping-reference-table) | [Teams A2A Library](https://learn.microsoft.com/en-us/microsoftteams/platform/teams-ai-library/typescript/in-depth-guides/ai/a2a/overview)**

Your Logic App exposes these standard A2A v1 (JSON-RPC 2.0) endpoints:

| JSON-RPC Method | gRPC Method | REST Endpoint | Purpose | Request Example |
|-----------------|-------------|---------------|---------|-----------------|
| N/A | N/A | `GET /.well-known/agent-card.json` | Agent discovery - returns metadata about capabilities, auth, skills | N/A (GET request) |
| `message/send` | `SendMessage` | `POST /v1/message:send` | Send message to create/continue task (synchronous/polling) | `{"jsonrpc":"2.0","id":1,"method":"message/send","params":{"message":{"role":"user","parts":[{"kind":"text","text":"hello"}]}}}` |
| `message/stream` | `SendStreamingMessage` | `POST /v1/message:stream` | Send message with real-time SSE streaming updates | `{"jsonrpc":"2.0","id":2,"method":"message/stream","params":{"message":{"role":"user","parts":[{"kind":"text","text":"hello"}]}}}` |
| `tasks/get` | `GetTask` | `GET /v1/tasks/{id}` | Retrieve task status and results (for polling) | `{"jsonrpc":"2.0","id":3,"method":"tasks/get","params":{"id":"task-123"}}` |
| `tasks/cancel` | `CancelTask` | `POST /v1/tasks/{id}:cancel` | Cancel an ongoing task | `{"jsonrpc":"2.0","id":4,"method":"tasks/cancel","params":{"id":"task-123"}}` |

**Example Agent Card** (returned from `/.well-known/agent-card.json`):

```json
{
  "protocolVersion": "0.3.0",
  "name": "ServiceNow Knowledge Agent",
  "description": "Security-trimmed access to ServiceNow articles via Okta/Entra federation",
  "url": "https://<your-logic-app>.azurewebsites.net/api/a2a",
  "preferredTransport": "JSONRPC",
  "capabilities": {
    "streaming": true,
    "pushNotifications": false
  },
  "securitySchemes": {
    "entraIdJwt": {
      "type": "http",
      "scheme": "bearer",
      "bearerFormat": "JWT"
    }
  },
  "security": [{"entraIdJwt": []}],
  "defaultInputModes": ["text/plain"],
  "defaultOutputModes": ["text/plain"],
  "skills": [
    {
      "id": "search-knowledge",
      "name": "Search Knowledge Articles",
      "description": "Searches ServiceNow knowledge base with security trimming",
      "tags": ["search", "knowledge", "servicenow"]
    }
  ]
}
```

**Example Request** (`POST /message/send`):
```json
{
  "jsonrpc": "2.0",
  "method": "message/send",
  "params": {
    "messageId": "msg-123",
    "role": "user",
    "parts": [{
      "type": "text",
      "text": "How do I reset my password?"
    }]
  }
}
```

### ACL Mapping Flow (Okta → Azure AI Search)

**🎯 This is the critical security enforcement mechanism:**

```mermaid
graph TD
    subgraph "1. Okta Groups"
        OG["Okta User Groups<br/>• IT-Support<br/>• Employees<br/>• Finance-Team"]
    end
    
    subgraph "2. Entra ID Federation"
        EG["SAML Group Mapping<br/>Okta Group ID → Entra Object ID<br/>• 00u1234... → abc-def-123...<br/>• 00u5678... → xyz-uvw-456..."]
    end
    
    subgraph "3. Teams SSO Token"
        JWT["JWT Claims<br/>{<br/>  sub: 'user@example.com',<br/>  groups: ['abc-def-123', 'xyz-uvw-456']<br/>}"]
    end
    
    subgraph "4. Azure AI Search Index"
        IDX["ServiceNow Documents<br/>Document 1:<br/>  title: 'Password Reset'<br/>  content: '...'<br/>  acl_groups: ['abc-def-123', 'ghi-jkl-789']<br/><br/>Document 2:<br/>  title: 'Payroll Guide'<br/>  content: '...'<br/>  acl_groups: ['xyz-uvw-456']"]
    end
    
    subgraph "5. OData Filter"
        FLT["acl_groups/any(g:<br/>  g eq 'abc-def-123' OR<br/>  g eq 'xyz-uvw-456'<br/>)"]
    end
    
    OG -->|"SAML Federation"| EG
    EG -->|"Token Issuance"| JWT
    JWT -->|"Extract groups claim"| FLT
    FLT -->|"Filter query"| IDX
    IDX -->|"✅ Doc 1 & 2 match<br/>❌ Other docs excluded"| Results["Security-Trimmed Results"]
    
    style OG fill:#fff4e1
    style EG fill:#e1ffe1
    style JWT fill:#e1f5ff
    style IDX fill:#e1fff4
    style FLT fill:#ffe1e1
    style Results fill:#d4edda
```

**Key Implementation Details:**

1. **Index Schema** - Your Azure AI Search index MUST have:
   ```json
   {
     "name": "acl_groups",
     "type": "Collection(Edm.String)",
     "filterable": true,
     "retrievable": false
   }
   ```

2. **Document Ingestion** - Each ServiceNow document indexed with Okta/Entra group IDs:
   ```json
   {
     "id": "KB0001",
     "title": "Password Reset Procedure",
     "content": "To reset your password...",
     "acl_groups": ["abc-def-123", "ghi-jkl-789"]
   }
   ```

3. **Logic App Workflow** - Extract groups from JWT and build OData filter:
   ```javascript
   // Extract from JWT claims
   const userGroups = context.request.headers.authorization.claims.groups;
   
   // Build OData filter
   const filter = `acl_groups/any(g: ${userGroups.map(g => `g eq '${g}'`).join(' or ')})`;
   // Result: "acl_groups/any(g: g eq 'abc-def-123' or g eq 'xyz-uvw-456')"
   
   // Query AI Search with filter
   const searchResults = await aiSearch.search(query, { filter });
   ```

4. **Query Execution** - Azure AI Search applies filter:
   ```http
   POST https://<search-service>.search.windows.net/indexes/servicenow/docs/search
   {
     "search": "password reset",
     "filter": "acl_groups/any(g: g eq 'abc-def-123' or g eq 'xyz-uvw-456')",
     "top": 10
   }
   ```

**📚 References:**
- [Azure AI Search Security Trimming](https://learn.microsoft.com/en-us/azure/search/search-security-trimming-for-azure-search)
- [OData Filter Syntax](https://learn.microsoft.com/en-us/azure/search/query-odata-filter-orderby-syntax)
- [Document-Level Access Control](https://learn.microsoft.com/en-us/azure/search/search-document-level-access-overview)

---
