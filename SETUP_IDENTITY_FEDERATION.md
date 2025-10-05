# Identity Federation Setup Guide
## Okta + Entra ID + Teams SSO + Logic App Managed Identity

This guide provides step-by-step instructions for configuring identity federation between Okta and Microsoft Entra ID (formerly Azure AD), enabling Teams SSO for the agent, and configuring Logic App managed identities for secure resource access.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Part 1: Configure Okta Federation with Entra ID](#part-1-configure-okta-federation-with-entra-id)
3. [Part 2: Configure Teams App for SSO](#part-2-configure-teams-app-for-sso)
4. [Part 3: Configure Logic App Managed Identity](#part-3-configure-logic-app-managed-identity)
5. [Part 4: Test and Validate](#part-4-test-and-validate)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- **Okta Organization**
  - Administrative access to Okta
  - Okta domain (e.g., `yourcompany.okta.com`)
  - Users and groups configured in Okta

- **Microsoft Entra ID (Azure AD)**
  - Global Administrator or External Identity Provider Administrator role
  - Azure subscription with active tenant
  - Tenant ID and domain name

- **Azure Resources**
  - Logic App (Standard or Consumption) deployed
  - Azure AI Search instance (for ServiceNow index)
  - Azure OpenAI or other AI service

- **Development Environment**
  - Node.js (version 20 or 22)
  - Microsoft 365 Agents Toolkit for VS Code
  - Teams account for testing

---

## Part 1: Configure Okta Federation with Entra ID

This section establishes SAML/OIDC federation between Okta and Microsoft Entra ID so that Okta group memberships surface in Teams SSO tokens.

### Step 1.1: Prepare Okta Configuration

**Official Documentation**: [Configure Okta as SAML Identity Provider](https://learn.microsoft.com/en-us/entra/external-id/direct-federation)

1. **Log in to Okta Admin Console**
   - Navigate to `https://yourcompany-admin.okta.com`
   - Go to **Applications** → **Applications**

2. **Create New SAML Application**
   - Click **Create App Integration**
   - Select **SAML 2.0**
   - Click **Next**

3. **Configure General Settings**
   ```
   App name: Microsoft Entra ID Federation
   App logo: (Optional)
   ```

4. **Configure SAML Settings**
   
   Fill in the following values:
   
   | Setting | Value |
   |---------|-------|
   | **Single sign on URL** | `https://login.microsoftonline.com/login.srf` |
   | **Audience URI (SP Entity ID)** | `https://login.microsoftonline.com/<YOUR-TENANT-ID>/` |
   | **Name ID format** | `EmailAddress` or `Persistent` |
   | **Application username** | `Email` |

   > **Important**: Replace `<YOUR-TENANT-ID>` with your actual Entra ID tenant ID (GUID format)
   
   > **Reference**: See [Table 1 in Microsoft Docs](https://learn.microsoft.com/en-us/entra/external-id/direct-federation#to-configure-a-saml-20-identity-provider) for required SAML attributes

5. **Configure Attribute Statements**
   
   Add the following attribute mappings:
   
   | Name | Name format | Value |
   |------|-------------|-------|
   | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` | URI Reference | `user.email` |
   | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname` | URI Reference | `user.firstName` |
   | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname` | URI Reference | `user.lastName` |

6. **Configure Group Attribute Statements**
   
   To surface Okta groups in tokens:
   
   | Name | Name format | Filter | Value |
   |------|-------------|--------|-------|
   | `groups` | Basic | Matches regex: `.*` | `appuser.groups` |

7. **Save the Configuration**
   - Click **Next**
   - Select **I'm an Okta customer adding an internal app**
   - Click **Finish**

8. **Download SAML Metadata**
   - On the **Sign On** tab, locate **Metadata URL**
   - Copy the URL (e.g., `https://yourcompany.okta.com/app/abc123/sso/saml/metadata`)
   - Download the metadata XML file
   - Note the **Issuer** URL (IdP Entity ID)
   - Note the **Single Sign-On URL** (SSO URL)

### Step 1.2: Configure DNS Records (If Required)

**Official Documentation**: [Step 1 - DNS Configuration](https://learn.microsoft.com/en-us/entra/external-id/direct-federation#step-1-determine-if-the-partner-needs-to-update-their-dns-text-records)

Check if your Okta SSO URL domain matches your organization's domain:

- **If your domain is** `example.com` **and Okta SSO URL is** `https://example.okta.com/app/...`:
  
  The domain **DOES NOT** match, so you need to add a DNS TXT record:

  1. Log in to your DNS provider (e.g., GoDaddy, Cloudflare, Azure DNS)
  2. Add a TXT record:
     ```
     Host: example.com
     Type: TXT
     Value: DirectFedAuthUrl=https://example.okta.com/app/abc123/sso/saml
     TTL: 3600
     ```
  3. Wait for DNS propagation (can take up to 48 hours, typically 15 minutes)
  4. Verify using:
     ```bash
     nslookup -type=TXT example.com
     ```

### Step 1.3: Configure Federation in Microsoft Entra ID

**Official Documentation**: [Add federation with SAML IdP](https://learn.microsoft.com/en-us/entra/external-id/direct-federation#how-to-configure-saml-ws-fed-idp-federation)

1. **Sign in to Microsoft Entra Admin Center**
   - Navigate to [https://entra.microsoft.com](https://entra.microsoft.com)
   - Sign in with Global Administrator or External Identity Provider Administrator credentials

2. **Navigate to External Identities**
   - Browse to **Entra ID** → **External Identities** → **All identity providers**
   - Select the **Custom** tab

3. **Add New SAML/WS-Fed Identity Provider**
   - Click **Add new** → **SAML/WS-Fed**

4. **Configure Identity Provider**
   
   Fill in the following fields:
   
   | Field | Value |
   |-------|-------|
   | **Display name** | `Okta Federation` |
   | **Identity provider protocol** | `SAML` |
   | **Domain name of federating IdP** | Your organization's domain (e.g., `example.com`) |

5. **Configure Metadata**
   
   **Option A: Parse Metadata File** (Recommended)
   - Click **Parse metadata file**
   - Upload the XML file downloaded from Okta
   - Verify all fields are populated correctly
   
   **Option B: Manual Configuration**
   - **Issuer URI**: `https://www.okta.com/<okta-issuer-id>` (from Okta metadata)
   - **Passive authentication endpoint**: Okta SSO URL (e.g., `https://example.okta.com/app/abc123/sso/saml`)
   - **Certificate**: Copy the X509 certificate from Okta metadata (without BEGIN/END markers)
   - **Metadata URL**: Okta metadata URL (for automatic certificate renewal)

6. **Save Configuration**
   - Click **Save**
   - Wait 5-10 minutes for the federation policy to take effect

7. **Add Additional Domains (Optional)**
   - In the **Domains** column, click the link
   - Add additional domains if users authenticate from multiple domains
   - Click **Add** for each domain
   - Click **Done**

### Step 1.4: Configure SCIM Provisioning (Recommended)

**Purpose**: Automatically sync users and groups from Okta to Entra ID

**Official Documentation**: [Okta SCIM Integration](https://help.okta.com/en-us/Content/Topics/Apps/Apps_App_Integration_Wizard_SCIM.htm)

1. **In Microsoft Entra Admin Center**
   - Go to **Entra ID** → **External Identities** → **User settings**
   - Enable **Guest user access restrictions** as needed
   - Note your tenant's SCIM endpoint (if using External ID)

2. **In Okta Admin Console**
   - Go to your application → **Provisioning** tab
   - Click **Configure API Integration**
   - Enable **Enable API integration**
   - Enter API credentials from Entra ID
   - Test connection
   - Save configuration

3. **Configure Provisioning Settings**
   - Enable **Create Users**
   - Enable **Update User Attributes**
   - Enable **Deactivate Users**
   - Map attributes:
     - `userName` → `userPrincipalName`
     - `givenName` → `givenName`
     - `familyName` → `surname`
     - `email` → `mail`
     - `groups` → `memberOf`

4. **Assign Users and Groups**
   - Go to **Assignments** tab
   - Assign Okta users or groups that should have access
   - Initial sync will run automatically

---

## Part 2: Configure Teams App for SSO

This section configures the Teams app to acquire SSO tokens that include Okta-federated user identity and group claims.

### Step 2.1: Register Application in Microsoft Entra ID

**Official Documentation**: [Register Teams app in Entra ID](https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/authentication/tab-sso-register-aad)

1. **Navigate to App Registrations**
   - Sign in to [https://entra.microsoft.com](https://entra.microsoft.com)
   - Go to **Entra ID** → **App registrations**
   - Click **New registration**

2. **Register the Application**
   ```
   Name: Teams ServiceNow Agent
   Supported account types: Accounts in this organizational directory only (Single tenant)
   Redirect URI: 
     Platform: Web
     URI: https://token.botframework.com/.auth/web/redirect
   ```
   - Click **Register**

3. **Note Application Details**
   - Copy the **Application (client) ID**
   - Copy the **Directory (tenant) ID**
   - You'll need these values later

### Step 2.2: Configure API Permissions

**Official Documentation**: [Configure scope for access token](https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/authentication/tab-sso-register-aad#configure-scope-for-access-token)

1. **Add API Permissions**
   - Go to **API permissions** → **Add a permission**
   - Select **Microsoft Graph**
   - Select **Delegated permissions**
   - Add the following permissions:
     ```
     User.Read
     profile
     openid
     email
     offline_access
     GroupMember.Read.All (if reading groups)
     ```
   - Click **Add permissions**

2. **Grant Admin Consent**
   - Click **Grant admin consent for [Your Organization]**
   - Click **Yes** to confirm
   - Verify all permissions show "Granted"

### Step 2.3: Expose an API

**Official Documentation**: [Configure Application ID URI](https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/authentication/tab-sso-register-aad#to-configure-application-id-uri)

1. **Set Application ID URI**
   - Go to **Expose an API**
   - Next to **Application ID URI**, click **Set**
   - Accept the default: `api://<application-id>` or customize:
     ```
     api://<your-domain>.com/<application-id>
     ```
   - Click **Save**

2. **Add a Scope**
   - Click **Add a scope**
   - Fill in the details:
     ```
     Scope name: access_as_user
     Who can consent?: Admins and users
     Admin consent display name: Access Teams ServiceNow Agent
     Admin consent description: Allows Teams to call the app's web APIs as the current user
     User consent display name: Access Teams ServiceNow Agent
     User consent description: Allow Teams to access the app on your behalf
     State: Enabled
     ```
   - Click **Add scope**

3. **Authorize Client Applications**
   - Click **Add a client application**
   - Add Microsoft Teams client IDs:
     ```
     Desktop: 1fec8e78-bce4-4aaf-ab1b-5451cc387264
     Mobile: 5e3ce6c0-2b1f-4285-8d4b-75ee78787346
     Web: 4345a7b9-9a63-4910-a426-35363201d503
     ```
   - Select the `access_as_user` scope for each
   - Click **Add application** for each client ID

### Step 2.4: Create Client Secret

**Official Documentation**: [Create client secret](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/authentication/bot-sso-register-aad#create-client-secret)

1. **Add a Client Secret**
   - Go to **Certificates & secrets**
   - Click **New client secret**
   - Description: `Teams Agent Secret`
   - Expires: `24 months` (recommended)
   - Click **Add**

2. **Copy Secret Value**
   - **IMPORTANT**: Copy the secret **Value** immediately
   - Store securely (you won't be able to see it again)
   - Save to environment variables or Azure Key Vault

### Step 2.5: Configure Token Version

**Official Documentation**: [Configure access token version](https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/authentication/tab-sso-register-aad#to-define-access-token-version)

1. **Edit App Manifest**
   - Go to **Manifest**
   - Find `"accessTokenAcceptedVersion"`
   - Set value to `2`:
     ```json
     "accessTokenAcceptedVersion": 2,
     ```
   - Click **Save**

### Step 2.6: Configure Optional Claims for Groups

**Official Documentation**: [Optional claims](https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims)

1. **Add Group Claims**
   - Go to **Token configuration**
   - Click **Add groups claim**
   - Select:
     ```
     ☑ Security groups
     ☑ Groups assigned to the application (if using app roles)
     ```
   - For ID, Access, and SAML token types, select:
     ```
     Group ID
     ```
   - Click **Add**

2. **Configure Group Claim Format**
   - In **Manifest**, find `"optionalClaims"`
   - Ensure groups are included:
     ```json
     "optionalClaims": {
       "idToken": [
         {
           "name": "groups",
           "source": null,
           "essential": false,
           "additionalProperties": []
         }
       ],
       "accessToken": [
         {
           "name": "groups",
           "source": null,
           "essential": false,
           "additionalProperties": []
         }
       ],
       "saml2Token": []
     }
     ```

### Step 2.7: Update Teams App Manifest

**Official Documentation**: [Update app manifest for SSO](https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/authentication/tab-sso-manifest)

1. **Open App Manifest File**
   - Navigate to `appPackage/manifest.json` in your project

2. **Add webApplicationInfo**
   
   Add or update the `webApplicationInfo` section:
   
   ```json
   {
     "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
     "manifestVersion": "1.16",
     "id": "<YOUR-APP-ID>",
     "version": "1.0.0",
     "developer": {
       "name": "Your Company",
       "websiteUrl": "https://yourcompany.com",
       "privacyUrl": "https://yourcompany.com/privacy",
       "termsOfUseUrl": "https://yourcompany.com/terms"
     },
     "name": {
       "short": "ServiceNow Agent",
       "full": "ServiceNow Knowledge Agent with Okta Security"
     },
     "description": {
       "short": "Secure access to ServiceNow knowledge articles",
       "full": "AI-powered agent that provides secure, role-based access to ServiceNow knowledge articles through Okta/Entra federation"
     },
     "icons": {
       "outline": "outline.png",
       "color": "color.png"
     },
     "accentColor": "#FFFFFF",
     "bots": [
       {
         "botId": "<YOUR-BOT-APP-ID>",
         "scopes": ["personal", "team", "groupchat"],
         "supportsFiles": false,
         "isNotificationOnly": false
       }
     ],
     "permissions": [
       "identity",
       "messageTeamMembers"
     ],
     "validDomains": [
       "token.botframework.com",
       "*.botframework.com",
       "<your-logic-app-domain>.azurewebsites.net"
     ],
     "webApplicationInfo": {
       "id": "<YOUR-APPLICATION-CLIENT-ID>",
       "resource": "api://<YOUR-APPLICATION-CLIENT-ID>"
     }
   }
   ```

3. **Update Environment Variables**
   
   Create or update `.env.local`:
   
   ```bash
   # Teams Bot Configuration
   CLIENT_ID=<YOUR-APPLICATION-CLIENT-ID>
   CLIENT_SECRET=<YOUR-CLIENT-SECRET>
   TENANT_ID=<YOUR-TENANT-ID>
   BOT_TYPE=MultiTenant
   
   # Azure OpenAI (if using)
   AZURE_OPENAI_API_KEY=<your-key>
   AZURE_OPENAI_ENDPOINT=https://<your-instance>.openai.azure.com/
   AZURE_OPENAI_DEPLOYMENT_NAME=<deployment-name>
   
   # Logic App Configuration
   LOGIC_APP_ENDPOINT=https://<your-logic-app>.azurewebsites.net/api/agent-loop
   LOGIC_APP_CLIENT_ID=<logic-app-managed-identity-client-id>
   
   # Bot Endpoint (from dev tunnel)
   BOT_ENDPOINT=https://<tunnel-url>
   BOT_DOMAIN=<tunnel-domain>
   ```

4. **Build and Package**
   ```bash
   npm run build
   ```

---

## Part 3: Configure Logic App Managed Identity

This section configures the Logic App with managed identities to authenticate access to Azure resources (Azure AI Search, Azure OpenAI, etc.).

### Step 3.1: Enable System-Assigned Managed Identity

**Official Documentation**: [Enable system-assigned identity in Azure portal](https://learn.microsoft.com/en-us/azure/logic-apps/authenticate-with-managed-identity#enable-system-assigned-identity-in-the-azure-portal)

1. **Navigate to Logic App**
   - Sign in to [https://portal.azure.com](https://portal.azure.com)
   - Navigate to your Logic App resource

2. **Enable System-Assigned Identity**
   - Go to **Settings** → **Identity**
   - Under **System assigned** tab:
     ```
     Status: On
     ```
   - Click **Save**
   - Click **Yes** to confirm

3. **Note Identity Details**
   - Copy the **Object (principal) ID**
   - This is the managed identity that will access Azure resources

### Step 3.2: Create User-Assigned Managed Identity (Optional)

**Official Documentation**: [Create user-assigned identity](https://learn.microsoft.com/en-us/azure/logic-apps/authenticate-with-managed-identity#create-user-assigned-identity-in-the-azure-portal)

**When to use**: 
- You want to share the same identity across multiple Logic Apps
- You need to rotate identities without recreating connections

1. **Create User-Assigned Identity**
   - In Azure portal, search for **Managed Identities**
   - Click **Create**
   - Fill in details:
     ```
     Subscription: <your-subscription>
     Resource group: <your-resource-group>
     Region: <same-as-logic-app>
     Name: ServiceNowAgentIdentity
     ```
   - Click **Review + Create** → **Create**

2. **Assign to Logic App**
   - Go to Logic App → **Settings** → **Identity**
   - Select **User assigned** tab
   - Click **Add**
   - Select the identity you created
   - Click **Add**

3. **Note Identity Client ID**
   - Go to the Managed Identity resource
   - Copy the **Client ID**
   - Update `LOGIC_APP_CLIENT_ID` in your environment variables

### Step 3.3: Grant Access to Azure AI Search

**Official Documentation**: [Assign role-based access with Azure portal](https://learn.microsoft.com/en-us/azure/logic-apps/authenticate-with-managed-identity#assign-role-based-access-to-a-managed-identity-using-the-azure-portal)

1. **Navigate to Azure AI Search**
   - Go to your Azure AI Search resource
   - Select **Access control (IAM)**

2. **Add Role Assignment**
   - Click **Add** → **Add role assignment**
   - On **Role** tab:
     ```
     Role: Search Index Data Reader
     ```
   - Click **Next**

3. **Assign Identity**
   - Under **Assign access to**: Select **Managed identity**
   - Click **Select members**
   - Filter by **Logic App** (for system-assigned) or **User-assigned managed identity**
   - Select your Logic App or identity
   - Click **Select**

4. **Complete Assignment**
   - Click **Review + assign**
   - Click **Review + assign** again

5. **Verify Assignment**
   - Go to **Role assignments** tab
   - Verify your identity appears with "Search Index Data Reader" role

### Step 3.4: Grant Access to Azure OpenAI

**Official Documentation**: [Azure OpenAI authentication with managed identities](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/managed-identity)

1. **Navigate to Azure OpenAI Resource**
   - Go to your Azure OpenAI resource
   - Select **Access control (IAM)**

2. **Add Role Assignment**
   - Click **Add** → **Add role assignment**
   - On **Role** tab, select:
     ```
     Role: Cognitive Services OpenAI User
     ```
   - Click **Next**

3. **Assign Logic App Identity**
   - Select **Managed identity**
   - Select your Logic App identity
   - Click **Select** → **Review + assign**

### Step 3.5: Configure Logic App EasyAuth (Optional)

**Official Documentation**: [Authentication and authorization in Azure App Service](https://learn.microsoft.com/en-us/azure/app-service/overview-authentication-authorization)

**Purpose**: Validate incoming Teams SSO tokens at the Logic App HTTP trigger

1. **Enable Authentication**
   - In Logic App, go to **Settings** → **Authentication**
   - Click **Add identity provider**
   - Select **Microsoft**

2. **Configure Settings**
   ```
   App registration type: Provide the details of an existing app registration
   Application (client) ID: <TEAMS-APP-CLIENT-ID>
   Client secret: <Create-in-Entra-ID>
   Issuer URL: https://login.microsoftonline.com/<TENANT-ID>/v2.0
   Allowed token audiences: api://<TEAMS-APP-CLIENT-ID>
   ```

3. **Configure Restrictions**
   ```
   Restrict access: Require authentication
   Unauthenticated requests: HTTP 401 Unauthorized
   Token store: Enabled
   ```

4. **Save Configuration**
   - Click **Add**

**Result**: The Logic App will now validate incoming bearer tokens and reject unauthorized requests with 401.

### Step 3.6: Configure Logic App Connection to Use Managed Identity

**Official Documentation**: [Authenticate access with managed identity](https://learn.microsoft.com/en-us/azure/logic-apps/authenticate-with-managed-identity#authenticate-access-with-managed-identity)

When creating connections in your Logic App workflow:

1. **For Azure AI Search Connector**:
   - Add Azure AI Search action
   - On **Create Connection** pane:
     ```
     Connection Name: AzureAISearch-ManagedIdentity
     Authentication: Managed Identity
     Managed Identity: System-assigned managed identity (or select user-assigned)
     ```
   - Click **Create**

2. **For Azure OpenAI / HTTP Connector**:
   - Add HTTP action
   - Configure:
     ```
     Method: POST
     URI: https://<your-openai>.openai.azure.com/openai/deployments/<model>/chat/completions?api-version=2024-02-15-preview
     Headers:
       Content-Type: application/json
     Body: <your-request-body>
     Authentication: Managed Identity
     Managed Identity: System-assigned managed identity
     Audience: https://cognitiveservices.azure.com
     ```

3. **Save and Test**
   - Save the Logic App
   - Run a test to verify connections work

---

## Part 4: Test and Validate

### Step 4.1: Test Okta Federation

1. **Invite Test User**
   - In Entra admin center, go to **Users** → **External users**
   - Click **Invite user**
   - Enter Okta user email
   - Send invitation

2. **Redeem Invitation**
   - User opens invitation email
   - Clicks link to redeem
   - Should be redirected to Okta for authentication
   - After Okta login, redirected back to Microsoft

3. **Verify Group Claims**
   - After user signs in, go to **Enterprise applications**
   - Find your app → **Activity** → **Sign-in logs**
   - View token details and verify `groups` claim is present

### Step 4.2: Test Teams SSO

1. **Start the Agent**
   ```bash
   npm install
   npm run dev:teamsfx
   ```

2. **Sideload to Teams**
   - In VS Code, press F5
   - Or manually upload app package to Teams
   - Install the app in a team or personal chat

3. **Send Test Message**
   - Open the Teams app
   - Send a message: "Hello"
   - Verify the app responds

4. **Verify SSO Token**
   - Check application logs
   - Look for token acquisition success
   - Verify group claims in token

### Step 4.3: Test Logic App Integration

1. **Invoke Logic App Manually**
   
   Using Postman or curl:
   
   ```bash
   curl -X POST https://<your-logic-app>.azurewebsites.net/api/agent-loop \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <TEAMS-SSO-TOKEN>" \
     -d '{
       "query": "How do I reset my password?",
       "user_context": {
         "userId": "test-user",
         "groups": ["Okta-IT-Support", "Okta-Employees"],
         "timestamp": "2025-01-03T10:00:00Z"
       }
     }'
   ```

2. **Verify Response**
   - Should receive 200 OK
   - Response should contain filtered results
   - Check Logic App run history for execution details

3. **Test Unauthorized Access**
   
   Send request without bearer token:
   
   ```bash
   curl -X POST https://<your-logic-app>.azurewebsites.net/api/agent-loop \
     -H "Content-Type: application/json" \
     -d '{"query": "test"}'
   ```
   
   - Should receive 401 Unauthorized (if EasyAuth enabled)

4. **Test with Different User Groups**
   - Send requests with different group claims
   - Verify only authorized content is returned
   - Confirm 403 responses for unauthorized groups

### Step 4.4: End-to-End Test

1. **Full User Journey**
   - User opens Teams
   - Opens ServiceNow Agent app
   - Sends query: "How do I submit a support ticket?"
   - App acquires SSO token (with Okta groups)
   - Calls Logic App with bearer token
   - Logic App validates token
   - Extracts user groups from token
   - Queries Azure AI Search with ACL filter
   - Returns security-trimmed results
   - User sees only authorized content

2. **Monitor and Validate**
   - Check Application Insights
   - Review Logic App execution history
   - Verify Azure AI Search query filters
   - Confirm group-based filtering works

---

## Troubleshooting

### Okta Federation Issues

**Problem**: Users not redirected to Okta
- **Solution**: Check DNS TXT record is configured and propagated
- **Verify**: `nslookup -type=TXT yourdomain.com`

**Problem**: SAML assertion errors
- **Solution**: Verify Audience URI matches exactly: `https://login.microsoftonline.com/<tenant-id>/`
- **Check**: Okta application settings match Entra ID requirements

**Problem**: Groups not appearing in token
- **Solution**: 
  - Verify group attribute statement is configured in Okta
  - Check optional claims in Entra ID app registration
  - Ensure user is assigned to groups in Okta

### Teams SSO Issues

**Problem**: "Consent required" error
- **Solution**: Grant admin consent for API permissions
- **Verify**: All permissions show "Granted" in App registrations

**Problem**: Token validation fails
- **Solution**: 
  - Verify `webApplicationInfo` in Teams manifest matches Entra app registration
  - Check `accessTokenAcceptedVersion` is set to 2
  - Ensure redirect URIs are configured

**Problem**: Bot not responding
- **Solution**:
  - Check bot endpoint is accessible
  - Verify `CLIENT_ID`, `CLIENT_SECRET`, `TENANT_ID` are correct
  - Check application logs for errors

### Logic App Issues

**Problem**: 401/403 errors when calling Azure AI Search
- **Solution**: 
  - Verify managed identity has "Search Index Data Reader" role
  - Check role assignment in Azure AI Search IAM
  - Wait 5-10 minutes for role propagation

**Problem**: Managed identity authentication fails
- **Solution**:
  - Verify system-assigned identity is enabled
  - Check connection configuration uses managed identity
  - Ensure `Audience` property is set correctly

**Problem**: EasyAuth rejecting valid tokens
- **Solution**:
  - Verify issuer URL: `https://login.microsoftonline.com/<tenant-id>/v2.0`
  - Check allowed token audiences include Teams app ID
  - Review authentication logs in Logic App

### Group Claim Issues

**Problem**: Groups not in token
- **Solution**:
  - Too many groups? Azure has a 200 group limit in tokens
  - Use group filtering in Okta to send only relevant groups
  - Consider using `hasgroups` claim with Graph API lookup

**Problem**: Group IDs instead of names
- **Solution**: This is expected; map group IDs to names in your application logic

---

## Additional Resources

### Official Microsoft Documentation

1. **Okta/Entra Federation**
   - [Add federation with SAML/WS-Fed IdPs](https://learn.microsoft.com/en-us/entra/external-id/direct-federation)
   - [Configure SAML federation with AD FS](https://learn.microsoft.com/en-us/entra/external-id/direct-federation-adfs)

2. **Teams SSO**
   - [Teams SSO Overview](https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/authentication/tab-sso-overview)
   - [Update app manifest for SSO](https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/authentication/tab-sso-manifest)
   - [Register app in Entra ID](https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/authentication/tab-sso-register-aad)

3. **Logic Apps Managed Identity**
   - [Authenticate with managed identity](https://learn.microsoft.com/en-us/azure/logic-apps/authenticate-with-managed-identity)
   - [Secure access in Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-securing-a-logic-app)

4. **On-Behalf-Of (OBO) Flow**
   - [OAuth 2.0 On-Behalf-Of flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-on-behalf-of-flow)

5. **Azure AI Search Security**
   - [Security trimming patterns](https://learn.microsoft.com/en-us/azure/search/search-security-trimming-for-azure-search)
   - [OData filter functions](https://learn.microsoft.com/en-us/azure/search/search-query-odata-search-in-function)

### Okta Documentation

1. [Create SAML app integrations](https://help.okta.com/en-us/content/topics/apps/apps_app_integration_wizard_saml.htm)
2. [SCIM provisioning](https://help.okta.com/en-us/content/topics/apps/apps_app_integration_wizard_scim.htm)
3. [Okta Workflows Microsoft Teams connector](https://help.okta.com/wf/en-us/Content/Topics/Workflows/connector-reference/microsoft-teams/microsoft-teams.htm)

---

## Summary

You have successfully configured:

✅ **Okta Federation with Entra ID**
- SAML-based identity federation
- Group claim surfacing in tokens
- Optional SCIM provisioning

✅ **Teams App SSO**
- App registration in Entra ID
- Teams manifest configuration
- Group claims in SSO tokens

✅ **Logic App Managed Identity**
- System-assigned or user-assigned identity
- Role-based access to Azure resources
- Optional EasyAuth token validation

✅ **Security Architecture**
- Token-based authentication
- Group-based authorization
- Security-trimmed search results

Your Teams agent now securely queries ServiceNow knowledge with Okta/Entra-based access control! 🎉
