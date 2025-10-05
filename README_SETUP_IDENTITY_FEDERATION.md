# Identity Federation Setup Guide

> **Quick Setup**: Okta ↔ Entra ID Federation + Teams SSO + Logic App Managed Identity
>
> This guide configures end-to-end identity federation so users authenticate with Okta, Teams acquires SSO tokens with group claims, and Logic Apps use managed identities to query Azure resources with security trimming.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Part 1: Configure Okta Federation with Entra ID](#part-1-configure-okta-federation-with-entra-id)
3. [Part 2: Configure Teams App for SSO](#part-2-configure-teams-app-for-sso)
4. [Part 3: Configure Logic App Managed Identity](#part-3-configure-logic-app-managed-identity)
5. [Part 4: Test & Validate](#part-4-test--validate)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Okta**: Admin access, domain configured, users/groups set up
- **Entra ID**: Global Admin or External IdP Admin role, tenant ID
- **Azure**: Logic App deployed, AI Search + OpenAI instances ready
- **Dev Tools**: Node.js 20/22, Teams Toolkit for VS Code, Teams account

---

## Part 1: Configure Okta Federation with Entra ID

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

## Part 2: Configure Teams App for SSO

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

## Part 3: Configure Logic App Managed Identity

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

## Part 4: Test & Validate

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

## Troubleshooting

### Common Issues & Quick Fixes

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

---

## Key Resources

### Microsoft Docs
- **Federation**: [SAML/WS-Fed IdP Federation](https://learn.microsoft.com/en-us/entra/external-id/direct-federation)
- **Teams SSO**: [Overview](https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/authentication/tab-sso-overview) | [Register App](https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/authentication/tab-sso-register-aad) | [Manifest](https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/authentication/tab-sso-manifest)
- **Logic Apps**: [Managed Identity](https://learn.microsoft.com/en-us/azure/logic-apps/authenticate-with-managed-identity) | [Security](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-securing-a-logic-app)
- **Security**: [AI Search Security Trimming](https://learn.microsoft.com/en-us/azure/search/search-security-trimming-for-azure-search) | [OBO Flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-on-behalf-of-flow)

### Okta Docs
- [SAML App Integration](https://help.okta.com/en-us/content/topics/apps/apps_app_integration_wizard_saml.htm)
- [SCIM Provisioning](https://help.okta.com/en-us/content/topics/apps/apps_app_integration_wizard_scim.htm)

---

## Summary

✅ **Okta ↔ Entra Federation** - SAML-based identity with group claims  
✅ **Teams SSO** - App registration + manifest configured for token acquisition  
✅ **Logic App Managed Identity** - Role-based access to AI Search + OpenAI  
✅ **Security-Trimmed Search** - ACL filtering based on Okta group membership  

Your Teams agent now provides secure, Okta-federated access to ServiceNow knowledge! 🎉
