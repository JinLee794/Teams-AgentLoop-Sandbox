# Identity Federation Setup Guide

> **Two Federation Options**: Choose the approach that fits your architecture
>
> - **Option 1 (Recommended)**: Direct Okta ↔ Entra ID SAML federation with Teams SSO
> - **Option 2**: Azure API Management as OAuth middleware between Teams and Logic Apps
>
> This guide configures end-to-end identity federation so users authenticate with Okta, Teams acquires tokens, and backend services validate with security trimming.

---

## 🎯 Choose Your Federation Approach

### Option 1: Direct Entra ID Federation (Recommended)
**Best for**: Enterprise deployments with existing Entra ID infrastructure

✅ **Pros:**
- Native Teams SSO integration with `getAuthToken()`
- Group claims automatically included in tokens
- Simplified architecture (fewer hops)
- Built-in EasyAuth for Logic Apps
- No additional Azure services required

❌ **Cons:**
- Requires Entra ID federation setup (one-time)
- Limited to Microsoft identity platform

**Architecture:**
```
User → Okta (SAML) → Entra ID → Teams SSO → Logic App (EasyAuth) → AI Search
```

### Option 2: API Management as OAuth Gateway
**Best for**: Multi-cloud architectures or when Entra federation isn't feasible

✅ **Pros:**
- Works with any OAuth 2.0 provider (Okta, Auth0, etc.)
- Centralized policy enforcement at APIM layer
- Advanced rate limiting, caching, monitoring
- Backend services don't need direct Okta integration
- Supports client credentials and authorization code flows

❌ **Cons:**
- Additional Azure service cost (APIM)
- More complex architecture (additional hop)
- Token translation overhead
- Requires APIM configuration and maintenance

**Architecture:**
```
User → Teams (Okta token) → APIM (validate-jwt) → Logic App (MI) → AI Search
```

---

## Table of Contents

### Common to Both Options
1. [Prerequisites](#prerequisites)

### Option 1: Direct Entra ID Federation
2. [Option 1 Part 1: Configure Okta Federation with Entra ID](#option-1-part-1-configure-okta-federation-with-entra-id)
3. [Option 1 Part 2: Configure Teams App for SSO](#option-1-part-2-configure-teams-app-for-sso)
4. [Option 1 Part 3: Configure Logic App Managed Identity](#option-1-part-3-configure-logic-app-managed-identity)
5. [Option 1 Part 4: Test & Validate](#option-1-part-4-test--validate)

### Option 2: API Management Gateway
6. [Option 2 Part 1: Configure Okta OAuth Application](#option-2-part-1-configure-okta-oauth-application)
7. [Option 2 Part 2: Configure Azure API Management](#option-2-part-2-configure-azure-api-management)
8. [Option 2 Part 3: Configure Teams Bot with Okta](#option-2-part-3-configure-teams-bot-with-okta)
9. [Option 2 Part 4: Test & Validate](#option-2-part-4-test--validate)

### Common
10. [Troubleshooting](#troubleshooting)
11. [Architecture Comparison](#architecture-comparison)

---

## Prerequisites

### Common Prerequisites
- **Okta**: Admin access, domain configured, users/groups set up
- **Azure**: Subscription with contributor access
- **Dev Tools**: Node.js 20/22, Teams Toolkit for VS Code, Teams account

### Option 1 Specific
- **Entra ID**: Global Admin or External IdP Admin role, tenant ID
- **Azure**: Logic App deployed, AI Search + OpenAI instances ready

### Option 2 Specific
- **Azure API Management**: Standard or Premium tier (for JWT validation)
- **Azure**: Logic App deployed, AI Search + OpenAI instances ready

---

# Option 1: Direct Entra ID Federation

## Option 1 Part 1: Configure Okta Federation with Entra ID

This section establishes SAML/OIDC federation between Okta and Microsoft Entra ID so that Okta group memberships surface in Teams SSO tokens.

### Step 1.1: Configure Okta SAML Application

**📚 [Official Docs](https://learn.microsoft.com/en-us/entra/external-id/direct-federation)**

1. **Create SAML App**: Okta Admin → **Applications** → **Create App Integration** → **SAML 2.0**

2. **Configure SAML**:
   - **Single sign on URL**: `https://login.microsoftonline.com/login.srf`
   - **Audience URI**: `https://login.microsoftonline.com/<YOUR-TENANT-ID>/`
   - **Name ID format**: `EmailAddress`

3. **Add Attribute Mappings**:
   | Name | Format | Value |
   |------|--------|-------|
   | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` | URI | `user.email` |
   | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname` | URI | `user.firstName` |
   | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname` | URI | `user.lastName` |
   | `groups` | Basic | `appuser.groups` (filter: `.*`) |

4. **Save & Download**:
   - Copy **Metadata URL** (e.g., `https://yourcompany.okta.com/app/abc123/sso/saml/metadata`)
   - Note **Issuer URL** and **SSO URL**

### Step 1.2: Configure DNS (If Needed)

**📚 [DNS Requirements](https://learn.microsoft.com/en-us/entra/external-id/direct-federation#step-1-determine-if-the-partner-needs-to-update-their-dns-text-records)**

**Only required if** your Okta SSO domain differs from your org domain (e.g., `example.okta.com` vs `example.com`):

1. Add TXT record to your DNS:
   ```dns
   Host: example.com
   Type: TXT
   Value: DirectFedAuthUrl=https://example.okta.com/app/abc123/sso/saml
   ```

2. Verify: `nslookup -type=TXT example.com`

### Step 1.3: Add Identity Provider in Entra ID

**📚 [Configure SAML Federation](https://learn.microsoft.com/en-us/entra/external-id/direct-federation#how-to-configure-saml-ws-fed-idp-federation)**

1. **[Entra Admin Center](https://entra.microsoft.com)** → **External Identities** → **All identity providers** → **Custom**

2. **Add SAML/WS-Fed IdP**:
   - **Display name**: `Okta Federation`
   - **Protocol**: `SAML`
   - **Domain**: Your org domain (e.g., `example.com`)

3. **Configure Metadata** (choose one):
   - **Option A**: Upload XML file from Okta ✅ Recommended
   - **Option B**: Manual entry (Issuer URI, SSO endpoint, certificate)

4. **Save** → Wait 5-10 minutes for propagation

### Step 1.4: Enable SCIM Provisioning (Optional)

**📚 [Okta SCIM Integration](https://help.okta.com/en-us/Content/Topics/Apps/Apps_App_Integration_Wizard_SCIM.htm)**

Automates user/group sync from Okta → Entra ID:

1. Entra: Enable guest access, note SCIM endpoint
2. Okta: **Provisioning** tab → **Enable API integration** → Add Entra credentials
3. Enable: Create Users, Update Attributes, Deactivate Users
4. Map attributes: `userName`, `givenName`, `familyName`, `email`, `groups`
5. Assign users/groups in Okta

---

## Option 1 Part 2: Configure Teams App for SSO

### Step 2.1: Register & Configure App in Entra ID

**📚 [Teams SSO Registration](https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/authentication/tab-sso-register-aad)**

1. **[Entra Admin](https://entra.microsoft.com)** → **App registrations** → **New registration**:
   - Name: `Teams ServiceNow Agent`
   - Account types: `Single tenant`
   - Redirect URI: `Web` → `https://token.botframework.com/.auth/web/redirect`
   - Copy **Application (client) ID** and **Directory (tenant) ID**

2. **API Permissions** → **Add permission** → **Microsoft Graph** → **Delegated**:
   - Add: `User.Read`, `profile`, `openid`, `email`, `offline_access`, `GroupMember.Read.All`
   - Click **Grant admin consent**

3. **Expose an API**:
   - **Application ID URI**: `api://<client-id>` (or custom domain)
   - **Add scope**: `access_as_user` (admin & user consent, enabled)
   - **Authorize Teams clients** (add all 3):
     - Desktop: `1fec8e78-bce4-4aaf-ab1b-5451cc387264`
     - Mobile: `5e3ce6c0-2b1f-4285-8d4b-75ee78787346`
     - Web: `4345a7b9-9a63-4910-a426-35363201d503`

4. **Certificates & secrets**:
   - **New client secret** → Copy value immediately → Store securely

5. **Token Configuration**:
   - **Add groups claim** → Select `Security groups` + `Groups assigned to application`
   - **Manifest**: Set `"accessTokenAcceptedVersion": 2`

### Step 2.2: Update Teams App Manifest

**📚 [Teams SSO Manifest](https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/authentication/tab-sso-manifest)**

Edit `appPackage/manifest.json`:

```json
{
  "webApplicationInfo": {
    "id": "<YOUR-APPLICATION-CLIENT-ID>",
    "resource": "api://<YOUR-APPLICATION-CLIENT-ID>"
  },
  "permissions": ["identity", "messageTeamMembers"],
  "validDomains": [
    "token.botframework.com",
    "<your-logic-app>.azurewebsites.net"
  ]
}
```

### Step 2.3: Configure Environment Variables

Create `.env.local`:

```bash
CLIENT_ID=<YOUR-APP-CLIENT-ID>
CLIENT_SECRET=<YOUR-CLIENT-SECRET>
TENANT_ID=<YOUR-TENANT-ID>
LOGIC_APP_ENDPOINT=https://<logic-app>.azurewebsites.net/api/agent-loop
LOGIC_APP_CLIENT_ID=<managed-identity-client-id>  # From Part 3
```

---

## Option 1 Part 3: Configure Logic App Managed Identity

### Step 3.1: Enable Managed Identity

**📚 [Logic Apps Managed Identity](https://learn.microsoft.com/en-us/azure/logic-apps/authenticate-with-managed-identity)**

**Option A: System-Assigned** (auto-created with Logic App)
- Logic App → **Identity** → **System assigned** → **Status: On** → **Save**
- Copy **Object (principal) ID**

**Option B: User-Assigned** (reusable across resources)
- Create: **Managed Identities** → **Create** → Name: `ServiceNowAgentIdentity`
- Assign: Logic App → **Identity** → **User assigned** → **Add** → Select identity
- Copy **Client ID** for `LOGIC_APP_CLIENT_ID` env var

### Step 3.2: Grant Resource Access

**Azure AI Search:**
- AI Search → **Access control (IAM)** → **Add role assignment**
- Role: `Search Index Data Reader`
- Assign to: **Managed identity** → Select your Logic App

**Azure OpenAI:**
- OpenAI → **Access control (IAM)** → **Add role assignment**
- Role: `Cognitive Services OpenAI User`
- Assign to: **Managed identity** → Select your Logic App

### Step 3.3: Implement ACL Filter Logic in Logic App

**🎯 CRITICAL: This is where Okta groups become Azure AI Search security filters**

Your Logic App workflow must:

1. **Extract groups from JWT**:
   - EasyAuth populates `@request.headers['X-MS-TOKEN-AAD-ID-TOKEN']` with decoded JWT
   - Parse `groups` claim: `['abc-def-123', 'xyz-uvw-456']`

2. **Build OData filter expression**:
   ```javascript
   // Example in Logic App expression language
   @{concat('acl_groups/any(g: ', 
            join(
              body('Parse_JWT')?['claims']?['groups'], 
              ' or g eq '
            ), 
            ')'
          )}
   // Result: "acl_groups/any(g: g eq 'abc-def-123' or g eq 'xyz-uvw-456')"
   ```

3. **Pass filter to Azure AI Search**:
   - HTTP action → Azure AI Search
   - Add `$filter` parameter with generated expression
   - Only documents with matching `acl_groups` values will be returned

**📚 See [ACL Mapping Flow diagram](#acl-mapping-flow-okta--azure-ai-search) above for visual reference**

### Step 3.4: Enable EasyAuth (Optional)

**📚 [App Service Authentication](https://learn.microsoft.com/en-us/azure/app-service/overview-authentication-authorization)**

Validates Teams SSO tokens at HTTP trigger:

- Logic App → **Authentication** → **Add identity provider** → **Microsoft**
- **App registration**: `Provide details of existing` → Enter Teams app client ID
- **Issuer URL**: `https://login.microsoftonline.com/<TENANT-ID>/v2.0`
- **Allowed token audiences**: `api://<TEAMS-APP-CLIENT-ID>`
- **Restrict access**: `Require authentication` → Unauthenticated: `HTTP 401`

---

## Option 1 Part 4: Test & Validate

### Quick Test Checklist

**1. Okta Federation:**
- Invite Okta user → User receives email → Redirects to Okta for auth → Success
- Verify: Entra **Sign-in logs** show user with `groups` claim

**2. Teams SSO:**
```bash
npm install && npm run dev:teamsfx
```
- Install app in Teams → Send message → App responds
- Check logs for token acquisition + group claims

**3. Logic App:**
```bash
curl -X POST https://<logic-app>.azurewebsites.net/api/agent-loop \
  -H "Authorization: Bearer <TEAMS-SSO-TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "user_context": {"groups": ["IT-Support"]}}'
```
- ✅ 200 OK with filtered results
- ❌ 401 without token (if EasyAuth enabled)
- Check: Logic App run history + AI Search query filters

**4. End-to-End:**
- User asks question → Teams acquires SSO token → Calls Logic App → Validates token → Queries AI Search (ACL filtered) → Returns security-trimmed results
- Monitor: Application Insights, Logic App history, group-based filtering working

---

# Option 2: API Management as OAuth Gateway

## Option 2 Part 1: Configure Okta OAuth Application

**📚 [Reference Article](https://medium.com/azurediary/secure-api-in-azure-api-management-using-okta-identity-management-75a0cf74a7f8) | [Okta OAuth Docs](https://developer.okta.com/docs/guides/implement-oauth-for-okta/main/)**

This section configures Okta as an OAuth 2.0 authorization server that issues JWT tokens for API access.

### Step 1.1: Create Okta OAuth Application

1. **Okta Admin Console** → **Applications** → **Create App Integration** → **OIDC - OpenID Connect**

2. **Application type**: 
   - Choose **Native Application** (for authorization code + PKCE flow)
   - Or **Web Application** (if using client secret)

3. **App Settings**:
   - **App integration name**: `Teams ServiceNow Agent API`
   - **Grant type**: Enable both:
     - ☑️ **Authorization Code** (for user authentication)
     - ☑️ **Client Credentials** (optional, for service-to-service)
   - **Sign-in redirect URIs**: `https://oauth.pstmn.io/v1/callback` (for testing with Postman)
   - **Sign-out redirect URIs**: (optional)
   - **Controlled access**: Assign to your test users/groups

4. **Save** → Copy:
   - **Client ID**
   - **Client Secret** (if web app)
   - **Okta Domain** (e.g., `dev-123456.okta.com`)

### Step 1.2: Configure Authorization Server

1. **Okta Admin** → **Security** → **API** → Select **default** authorization server (or create custom)

2. **Access Policies**:
   - **Add Rule**: 
     - Name: `Teams Agent Access`
     - IF: Grant type is `Authorization Code`, `Client Credentials`
     - AND: Scopes requested: `api.servicenow.read` (custom scope)
     - THEN: Access token lifetime: `1 hour`

3. **Scopes**:
   - **Add Scope**: 
     - Name: `api.servicenow.read`
     - Description: `Read access to ServiceNow knowledge base`
     - Require consent: `Implicit` (for internal apps)

4. **Claims** (add group information to tokens):
   - **Add Claim**:
     - Name: `groups`
     - Include in: `Access Token` (Always)
     - Value type: `Groups`
     - Filter: `Matches regex` → `.*` (all groups)
     - Include in: Any scope

5. **Note endpoints** (from Settings tab):
   - **Metadata URI**: `https://{yourOktaDomain}/oauth2/default/.well-known/oauth-authorization-server`
   - **Issuer**: `https://{yourOktaDomain}/oauth2/default`
   - **Token endpoint**: `https://{yourOktaDomain}/oauth2/default/v1/token`
   - **Authorization endpoint**: `https://{yourOktaDomain}/oauth2/default/v1/authorize`

### Step 1.3: Test Token Acquisition

```bash
# Step 1: Get authorization code (open in browser)
https://{yourOktaDomain}/oauth2/default/v1/authorize?client_id={clientId}&response_type=code&scope=openid%20profile%20api.servicenow.read&redirect_uri=https://oauth.pstmn.io/v1/callback&state=test

# Step 2: Exchange code for token
curl -X POST https://{yourOktaDomain}/oauth2/default/v1/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "client_id={clientId}" \
  -d "client_secret={clientSecret}" \
  -d "code={authorizationCode}" \
  -d "redirect_uri=https://oauth.pstmn.io/v1/callback"

# Response includes access_token with groups claim
```

---

## Option 2 Part 2: Configure Azure API Management

**📚 [APIM JWT Validation](https://learn.microsoft.com/en-us/azure/api-management/api-management-howto-protect-backend-with-aad) | [validate-jwt Policy](https://learn.microsoft.com/en-us/azure/api-management/validate-jwt-policy)**

### Step 2.1: Create or Use Existing APIM Instance

1. **Azure Portal** → **API Management services** → **Create** (if needed)
   - **Tier**: Developer, Standard, or Premium (Basic doesn't support JWT validation)
   - **Name**: `servicenow-agent-apim`
   - **Location**: Same as Logic App for lower latency
   - ⏰ Deployment takes 30-45 minutes

2. **Note APIM Gateway URL**: `https://servicenow-agent-apim.azure-api.net`

### Step 2.2: Import Logic App API

1. **APIM** → **APIs** → **Add API** → **HTTP** (manual definition)

2. **Configure**:
   - **Display name**: `ServiceNow Agent API`
   - **Name**: `servicenow-agent`
   - **Web service URL**: `https://<your-logic-app>.azurewebsites.net`
   - **URL scheme**: `HTTPS`

3. **Add Operations**:
   - **POST** `/message/send` - Send A2A message
   - **POST** `/tasks/get` - Get task status
   - **GET** `/message/stream` - Stream messages
   - **GET** `/.well-known/agent-card.json` - Agent discovery

### Step 2.3: Configure JWT Validation Policy

1. **API** → **All operations** → **Inbound processing** → **Add policy** → **Code editor**

2. **Add validate-jwt policy**:

```xml
<policies>
    <inbound>
        <base />
        <!-- Validate Okta JWT Token -->
        <validate-jwt 
            header-name="Authorization" 
            failed-validation-httpcode="401" 
            failed-validation-error-message="Unauthorized. Access token is missing or invalid."
            require-expiration-time="true"
            require-signed-tokens="true">
            
            <!-- Okta OpenID Configuration Endpoint -->
            <openid-config url="https://{yourOktaDomain}/oauth2/default/.well-known/oauth-authorization-server" />
            
            <!-- Validate Audience (your API identifier) -->
            <audiences>
                <audience>api://servicenow-agent</audience>
            </audiences>
            
            <!-- Validate Issuer -->
            <issuers>
                <issuer>https://{yourOktaDomain}/oauth2/default</issuer>
            </issuers>
            
            <!-- Validate Required Claims -->
            <required-claims>
                <claim name="scp" match="any">
                    <value>api.servicenow.read</value>
                </claim>
            </required-claims>
        </validate-jwt>
        
        <!-- Extract user context from JWT and pass to backend -->
        <set-variable name="userId" value="@(context.Request.Headers.GetValueOrDefault("Authorization","").Split(' ')[1].AsJwt()?.Subject)" />
        <set-variable name="userGroups" value="@(context.Request.Headers.GetValueOrDefault("Authorization","").Split(' ')[1].AsJwt()?.Claims.GetValueOrDefault("groups", ""))" />
        
        <!-- Add custom headers for Logic App -->
        <set-header name="X-User-Id" exists-action="override">
            <value>@((string)context.Variables["userId"])</value>
        </set-header>
        <set-header name="X-User-Groups" exists-action="override">
            <value>@((string)context.Variables["userGroups"])</value>
        </set-header>
        
        <!-- Remove original Authorization header, replace with Logic App API key or managed identity -->
        <authentication-managed-identity resource="https://management.azure.com/" />
        <!-- OR use API key: -->
        <!-- <set-header name="X-API-Key" exists-action="override">
            <value>{{logic-app-api-key}}</value>
        </set-header> -->
    </inbound>
    <backend>
        <base />
    </backend>
    <outbound>
        <base />
    </outbound>
    <on-error>
        <base />
    </on-error>
</policies>
```

### Step 2.4: Configure Named Values (Optional)

Store sensitive values securely:

1. **APIM** → **Named values** → **Add**
   - Name: `okta-domain`
   - Value: `dev-123456.okta.com`
   - Secret: No

2. **Add** `logic-app-api-key` (if not using managed identity)
   - Name: `logic-app-api-key`
   - Value: `<your-logic-app-key>`
   - Secret: Yes

3. **Update policy** to use named values: `{{okta-domain}}`

### Step 2.5: Enable CORS (if needed)

1. **API** → **All operations** → **Inbound processing** → **Add policy** → **CORS**
2. **Allowed origins**: `https://teams.microsoft.com`, `https://*.teams.microsoft.com`
3. **Allowed methods**: `GET, POST, OPTIONS`
4. **Allowed headers**: `Authorization, Content-Type`

---

## Option 2 Part 3: Configure Teams Bot with Okta

**📚 [Bot Framework OAuth](https://learn.microsoft.com/en-us/azure/bot-service/bot-builder-authentication) | [Teams Bot Authentication](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/authentication/auth-flow-bot)**

### Step 3.1: Register OAuth Connection in Bot Service

1. **Azure Portal** → **Bot Services** → Your bot → **Configuration** → **OAuth Connection Settings** → **Add**

2. **Settings**:
   - **Name**: `OktaConnection`
   - **Service Provider**: `Generic Oauth 2`
   - **Client ID**: From Step 1.1
   - **Client Secret**: From Step 1.1
   - **Authorization URL**: `https://{yourOktaDomain}/oauth2/default/v1/authorize`
   - **Token URL**: `https://{yourOktaDomain}/oauth2/default/v1/token`
   - **Refresh URL**: `https://{yourOktaDomain}/oauth2/default/v1/token`
   - **Scopes**: `openid profile api.servicenow.read`

3. **Save** → Copy **Redirect URL** → Add to Okta app's redirect URIs

### Step 3.2: Update Teams Bot Code

Update `src/app/app.ts` to use Okta OAuth:

```typescript
import { TeamsActivityHandler, TurnContext, CardFactory } from 'botbuilder';
import { TokenResponse } from 'botframework-connector';

export class ServiceNowBot extends TeamsActivityHandler {
    private readonly connectionName = 'OktaConnection';
    private readonly apimEndpoint = process.env.APIM_ENDPOINT; // https://servicenow-agent-apim.azure-api.net

    constructor() {
        super();

        this.onMessage(async (context, next) => {
            const userText = context.activity.text;

            // Attempt to get token
            const tokenResponse = await this.getUserToken(context);
            
            if (!tokenResponse) {
                // Send OAuth card to prompt sign-in
                await this.sendOAuthCard(context);
                await next();
                return;
            }

            // Call APIM with Okta token
            const response = await this.callAgentAPI(tokenResponse.token, userText);
            await context.sendActivity(response);
            await next();
        });

        this.onMembersAdded(async (context, next) => {
            // Welcome message
            await context.sendActivity('Welcome! I can help you with ServiceNow queries.');
            await next();
        });
    }

    private async getUserToken(context: TurnContext): Promise<TokenResponse | null> {
        try {
            // BotFrameworkAdapter handles token retrieval
            const adapter = context.adapter as any;
            return await adapter.getUserToken(context, this.connectionName);
        } catch (error) {
            console.error('Token retrieval failed:', error);
            return null;
        }
    }

    private async sendOAuthCard(context: TurnContext): Promise<void> {
        const adapter = context.adapter as any;
        const signInResource = await adapter.getSignInResource(context, this.connectionName);
        
        const card = CardFactory.oauthCard(
            this.connectionName,
            'Sign In',
            'Please sign in to continue',
            signInResource.signInLink
        );
        
        await context.sendActivity({ attachments: [card] });
    }

    private async callAgentAPI(token: string, query: string): Promise<string> {
        const response = await fetch(`${this.apimEndpoint}/message/send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'message/send',
                params: {
                    message: {
                        role: 'user',
                        parts: [{ kind: 'text', text: query }]
                    }
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API call failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.result?.message?.parts[0]?.text || 'No response';
    }
}
```

### Step 3.3: Update Environment Variables

```bash
# .env.local
APIM_ENDPOINT=https://servicenow-agent-apim.azure-api.net
BOT_OAUTH_CONNECTION=OktaConnection
LOGIC_APP_ENDPOINT=https://<logic-app>.azurewebsites.net  # Used by APIM backend
```

### Step 3.4: Update Logic App to Accept APIM Headers

Your Logic App should extract user context from custom headers instead of JWT:

```json
{
  "definition": {
    "triggers": {
      "manual": {
        "inputs": {
          "schema": {
            "properties": {
              "query": { "type": "string" }
            }
          }
        }
      }
    },
    "actions": {
      "Parse_User_Context": {
        "type": "Compose",
        "inputs": {
          "userId": "@triggerOutputs()['headers']['X-User-Id']",
          "groups": "@split(triggerOutputs()['headers']['X-User-Groups'], ',')"
        }
      },
      "Build_ACL_Filter": {
        "type": "Compose",
        "inputs": "acl_groups/any(g: @{join(outputs('Parse_User_Context')['groups'], ' or g eq ')})"
      }
    }
  }
}
```

---

## Option 2 Part 4: Test & Validate

### Quick Test Checklist

**1. Okta Token Acquisition:**
```bash
# Test authorization code flow
curl -X POST https://{yourOktaDomain}/oauth2/default/v1/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id={clientId}" \
  -d "client_secret={clientSecret}" \
  -d "scope=api.servicenow.read"

# Decode JWT at jwt.io - verify groups claim exists
```

**2. APIM Policy Validation:**
```bash
# Should return 401 without token
curl https://servicenow-agent-apim.azure-api.net/message/send

# Should return 200 with valid token
curl -X POST https://servicenow-agent-apim.azure-api.net/message/send \
  -H "Authorization: Bearer {oktaToken}" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"message/send","params":{"message":{"role":"user","parts":[{"kind":"text","text":"test"}]}}}'
```

**3. Teams Bot:**
```bash
npm install && npm run dev:teamsfx
```
- Install app in Teams → Bot prompts for sign-in
- Complete Okta OAuth flow → Bot receives token
- Send message → Bot calls APIM → Logic App processes with ACL filtering
- Check: APIM analytics, Logic App run history

**4. End-to-End:**
- User sends message → Teams bot requests OAuth → User signs in to Okta → Bot receives token with groups
- Bot calls APIM with token → APIM validates JWT → Extracts groups → Passes to Logic App
- Logic App builds ACL filter → Queries AI Search → Returns security-trimmed results

---

## Troubleshooting

### Common Issues & Quick Fixes

#### Option 1 (Entra Federation) Issues

| Problem | Solution |
|---------|----------|
| **Users not redirected to Okta** | Check DNS TXT record propagation: `nslookup -type=TXT yourdomain.com` |
| **SAML assertion errors** | Verify Audience URI: `https://login.microsoftonline.com/<tenant-id>/` |
| **Groups not in token** | Check Okta group attribute + Entra optional claims config. **Note**: 200 group limit |
| **Consent required error** | Grant admin consent in App registrations → API permissions |
| **Token validation fails** | Verify `webApplicationInfo` in manifest + `accessTokenAcceptedVersion: 2` |
| **401/403 from AI Search** | Check managed identity has `Search Index Data Reader` role (wait 5-10min) |
| **Managed identity auth fails** | Verify system-assigned enabled + connection uses managed identity + correct audience |
| **EasyAuth rejecting tokens** | Check issuer URL format + allowed token audiences match Teams app ID |
| **Group IDs instead of names** | Expected behavior; map IDs to names in application logic |

#### Option 2 (APIM Gateway) Issues

| Problem | Solution |
|---------|----------|
| **APIM JWT validation fails** | Verify `openid-config` URL is accessible, check issuer/audience match Okta config |
| **Groups not extracted** | Check JWT claims at jwt.io, verify groups claim exists in Okta authorization server |
| **401 from APIM** | Test token independently with Postman, check APIM trace for detailed error |
| **APIM trace not available** | Enable tracing: APIM → APIs → Test → Enable tracing (max 1 hour) |
| **Bot OAuth fails** | Verify redirect URI in Bot Service matches Okta app, check scopes include openid |
| **Token refresh issues** | Ensure refresh token granted (add offline_access scope in Okta) |
| **APIM to Logic App fails** | Check APIM managed identity or API key configured, verify backend URL correct |
| **CORS errors** | Add CORS policy to APIM inbound section with Teams origins |
| **Custom headers not received** | Check Logic App trigger schema includes X-User-Id, X-User-Groups headers |

---

---

## Architecture Comparison

### Side-by-Side Feature Comparison

| Feature | Option 1: Entra Federation | Option 2: APIM Gateway |
|---------|---------------------------|------------------------|
| **Token Issuer** | Entra ID (after Okta SAML) | Okta (direct OAuth) |
| **Teams Integration** | Native SSO (`getAuthToken()`) | Custom OAuth connection |
| **Group Claims** | Automatic in JWT | Custom claim in Okta AS |
| **Backend Auth** | EasyAuth + Managed Identity | APIM validates + passes headers |
| **Additional Services** | None (built-in) | Azure APIM (additional cost) |
| **Token Validation** | EasyAuth (Logic App/Functions) | APIM policy layer |
| **Multi-Cloud** | Microsoft-centric | Works with any OAuth provider |
| **Complexity** | Medium (federation setup) | High (APIM policies + bot OAuth) |
| **Latency** | Lower (fewer hops) | Higher (APIM adds ~10-50ms) |
| **Rate Limiting** | App-level | APIM-level (centralized) |
| **Monitoring** | App Insights | APIM Analytics + App Insights |
| **Cost** | Lower (no APIM) | Higher (APIM + egress) |

### When to Choose Each Option

**Choose Option 1 (Entra Federation) if:**
- ✅ You're already using Microsoft 365/Entra ID
- ✅ You want simpler architecture with fewer components
- ✅ Native Teams SSO experience is important
- ✅ Cost optimization is a priority
- ✅ Your backend services support Entra ID authentication

**Choose Option 2 (APIM Gateway) if:**
- ✅ You need to support multiple identity providers
- ✅ You want centralized API governance and monitoring
- ✅ Advanced rate limiting/throttling is required
- ✅ You're building a multi-cloud architecture
- ✅ Backend services don't support Entra ID natively
- ✅ You need transformation or caching at the gateway layer

---

## Key Resources

### Common Resources
- **Security**: [AI Search Security Trimming](https://learn.microsoft.com/en-us/azure/search/search-security-trimming-for-azure-search) | [OAuth 2.0 Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)

### Option 1 Resources
- **Microsoft Docs**:
  - [SAML/WS-Fed IdP Federation](https://learn.microsoft.com/en-us/entra/external-id/direct-federation)
  - [Teams SSO Overview](https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/authentication/tab-sso-overview) | [Register App](https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/authentication/tab-sso-register-aad) | [Manifest](https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/authentication/tab-sso-manifest)
  - [Logic Apps Managed Identity](https://learn.microsoft.com/en-us/azure/logic-apps/authenticate-with-managed-identity) | [Security](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-securing-a-logic-app)
  - [OBO Flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-on-behalf-of-flow)
- **Okta Docs**:
  - [SAML App Integration](https://help.okta.com/en-us/content/topics/apps/apps_app_integration_wizard_saml.htm)
  - [SCIM Provisioning](https://help.okta.com/en-us/content/topics/apps/apps_app_integration_wizard_scim.htm)

### Option 2 Resources
- **Microsoft Docs**:
  - [APIM JWT Validation](https://learn.microsoft.com/en-us/azure/api-management/api-management-howto-protect-backend-with-aad)
  - [validate-jwt Policy](https://learn.microsoft.com/en-us/azure/api-management/validate-jwt-policy)
  - [APIM Managed Identity](https://learn.microsoft.com/en-us/azure/api-management/api-management-howto-use-managed-service-identity)
  - [Bot Framework OAuth](https://learn.microsoft.com/en-us/azure/bot-service/bot-builder-authentication)
  - [Teams Bot Authentication](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/authentication/auth-flow-bot)
- **Okta Docs**:
  - [OAuth 2.0 and OIDC](https://developer.okta.com/docs/concepts/oauth-openid/)
  - [Custom Authorization Server](https://developer.okta.com/docs/guides/customize-authz-server/)
  - [OAuth Scopes and Claims](https://developer.okta.com/docs/guides/customize-tokens-returned-from-okta/)
- **Community**:
  - [Secure API in APIM using Okta](https://medium.com/azurediary/secure-api-in-azure-api-management-using-okta-identity-management-75a0cf74a7f8) (reference article)

---

## Summary

### Option 1: Direct Entra ID Federation
✅ **Okta ↔ Entra Federation** - SAML-based identity with group claims  
✅ **Teams SSO** - Native `getAuthToken()` integration  
✅ **Logic App Managed Identity** - Role-based access to AI Search + OpenAI  
✅ **Security-Trimmed Search** - ACL filtering based on Okta group membership  
✅ **Simpler Architecture** - Fewer components, lower cost

### Option 2: API Management Gateway
✅ **Okta OAuth** - Direct OAuth 2.0 integration with custom scopes  
✅ **APIM Middleware** - Centralized JWT validation and policy enforcement  
✅ **Bot Framework OAuth** - Custom OAuth connection for Teams bot  
✅ **Security-Trimmed Search** - ACL filtering via APIM-extracted groups  
✅ **Enterprise-Grade** - Advanced monitoring, rate limiting, multi-cloud support

Your Teams agent now has two proven paths for secure, Okta-federated access to ServiceNow knowledge! 🎉
