# Quick Start Guide: Okta Federation with Teams Agent

> **⚡ Get started in 5 minutes** - Choose your federation path and follow the links

---

## 📋 Documentation Map

```
QUICK_START.md (you are here)
    ├── README_ARCHITECTURE_DECISION.md ─── Choose Option 1 or 2
    │   ├── Cost comparison
    │   ├── Feature matrix
    │   └── Decision flowchart
    │
    ├── SETUP_IDENTITY_FEDERATION.md ─── Step-by-step setup
    │   ├── Option 1: Entra Federation (Pages 1-10)
    │   └── Option 2: APIM Gateway (Pages 11-25)
    │
    ├── README_IDENTITY_FEDERATION_FLOW.md ─── Architecture diagrams
    │   ├── Sequence diagrams for both options
    │   ├── Token flow diagrams
    │   └── A2A protocol endpoints
    │
    ├── README_POC_NOTES.md ─── Technical implementation notes
    │   ├── Agent Loop integration
    │   ├── A2A messaging contracts
    │   └── ACL security patterns
    │
    └── a2a-endpoints.http ─── Testing tool
        ├── OAuth 2.0 token acquisition
        ├── All A2A protocol endpoints
        └── Advanced examples
```

---

## 🚀 Quick Start (3 Steps)

### Step 1: Choose Your Architecture (2 minutes)

**Answer these 3 questions:**

1. Do you already use Microsoft 365/Entra ID? **[Yes → Option 1]** / **[No → Option 2]**
2. Do you need centralized API management? **[Yes → Option 2]** / **[No → Option 1]**
3. Is cost optimization critical? **[Yes → Option 1]** / **[No → Either]**

**Still unsure?** → Read [README_ARCHITECTURE_DECISION.md](./README_ARCHITECTURE_DECISION.md)

---

### Step 2: Follow Setup Guide (30-120 minutes)

#### Option 1: Direct Entra Federation
⏱️ **Setup Time:** 30-60 minutes

**Prerequisites:**
- [ ] Okta admin access
- [ ] Entra ID Global Admin role
- [ ] Teams Toolkit installed
- [ ] Logic App deployed

**Steps:**
1. [Configure Okta SAML → Entra ID](./SETUP_IDENTITY_FEDERATION.md#step-11-configure-okta-saml-application)
2. [Register Teams app in Entra](./SETUP_IDENTITY_FEDERATION.md#step-21-register--configure-app-in-entra-id)
3. [Enable Logic App Managed Identity](./SETUP_IDENTITY_FEDERATION.md#step-31-enable-managed-identity)
4. [Test end-to-end](./SETUP_IDENTITY_FEDERATION.md#option-1-part-4-test--validate)

**Cost:** ~$400-1,200/month

---

#### Option 2: APIM Gateway
⏱️ **Setup Time:** 90-120 minutes

**Prerequisites:**
- [ ] Okta admin access
- [ ] Azure subscription (APIM available)
- [ ] Teams Toolkit installed
- [ ] Logic App deployed

**Steps:**
1. [Configure Okta OAuth application](./SETUP_IDENTITY_FEDERATION.md#step-11-create-okta-oauth-application)
2. [Deploy and configure APIM](./SETUP_IDENTITY_FEDERATION.md#step-21-create-or-use-existing-apim-instance)
3. [Set up Teams Bot OAuth](./SETUP_IDENTITY_FEDERATION.md#step-31-register-oauth-connection-in-bot-service)
4. [Test end-to-end](./SETUP_IDENTITY_FEDERATION.md#option-2-part-4-test--validate)

**Cost:** ~$700-3,700/month

---

### Step 3: Test Your Implementation (15 minutes)

Use the provided HTTP REST Client file to test all endpoints:

1. **Open:** [`a2a-endpoints.http`](./a2a-endpoints.http) in VS Code
2. **Install:** [REST Client extension](https://marketplace.visualstudio.com/items?itemName=humao.rest-client)
3. **Configure:** Update variables (Logic App URL, client ID, tenant ID)
4. **Test:** Run each request to validate the complete flow

**Key Tests:**
- ✅ Token acquisition (OAuth flow)
- ✅ Agent discovery (`GET /.well-known/agent-card.json`)
- ✅ Send message (`POST /message/send`)
- ✅ Check ACL filtering in results

---

## 🎯 Common Scenarios

### Scenario 1: Enterprise with M365
**You have:** Microsoft 365 E5 licenses, 10,000 employees, existing Entra ID  
**Recommendation:** **Option 1** (Direct Entra Federation)  
**Why:** Lower cost, native Teams SSO, already familiar with Microsoft stack  
**Time:** 1 week POC → 2 weeks production

---

### Scenario 2: Multi-Cloud Startup
**You have:** AWS primary, Azure secondary, need flexibility  
**Recommendation:** **Option 2** (APIM Gateway)  
**Why:** Works with any OAuth provider, centralized API governance  
**Time:** 2 weeks POC → 4 weeks production

---

### Scenario 3: Healthcare with Compliance
**You have:** HIPAA requirements, need detailed audit logs  
**Recommendation:** **Option 2** (APIM Gateway)  
**Why:** APIM provides required governance, rate limiting, comprehensive audit trail  
**Time:** 3 weeks POC → 6 weeks production (compliance review)

---

### Scenario 4: Small Business POC
**You have:** 200 employees, need quick validation  
**Recommendation:** **Option 1** (Direct Entra Federation)  
**Why:** Faster setup, lower cost, can migrate to Option 2 later if needed  
**Time:** 3 days POC → 1 week production

---

## 🔧 Development Workflow

### Local Development Setup

```bash
# 1. Clone repo
git clone <your-repo-url>
cd okta-agent-loop

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.template .env.local
# Edit .env.local with your values

# 4. Start local development
npm run dev:teamsfx

# 5. Test in Teams
# Teams Toolkit → Debug → Start Debugging
```

---

## 📊 Architecture at a Glance

### Option 1: Direct Entra Federation
```
User → Okta (SAML) → Entra ID → Teams → Logic App → AI Search
                        ↑                     ↓
                        └──── EasyAuth ───────┘
```
**Token:** Entra JWT with groups claim  
**Validation:** EasyAuth at Logic App  
**Components:** 3 (Okta, Entra, Logic App)

---

### Option 2: APIM Gateway
```
User → Okta (OAuth) → Teams → APIM → Logic App → AI Search
         ↑                      ↓         ↓
         └─── validate-jwt ─────┘         └─ MI Auth
```
**Token:** Okta JWT with groups claim  
**Validation:** APIM validate-jwt policy  
**Components:** 4 (Okta, APIM, Logic App, AI Search)

---

## 🛠️ Troubleshooting Quick Fixes

### Common Issues

| Issue | Quick Fix |
|-------|-----------|
| **"Unauthorized" from Teams** | Check Teams app manifest `webApplicationInfo` |
| **Groups not in token** | Verify Okta attribute mappings + Entra optional claims |
| **401 from Logic App** | Enable EasyAuth OR check APIM policy |
| **No search results** | Validate ACL filter syntax in Logic App |
| **APIM JWT validation fails** | Check `openid-config` URL reachable from APIM |
| **Bot OAuth fails** | Verify redirect URI matches Okta app registration |

**Detailed troubleshooting:** [SETUP_IDENTITY_FEDERATION.md - Troubleshooting](./SETUP_IDENTITY_FEDERATION.md#troubleshooting)

---

## 📚 Key Resources

### Microsoft Documentation
- [Teams SSO Overview](https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/authentication/tab-sso-overview)
- [Entra Federation](https://learn.microsoft.com/en-us/entra/external-id/direct-federation)
- [APIM JWT Validation](https://learn.microsoft.com/en-us/azure/api-management/validate-jwt-policy)
- [Logic Apps Managed Identity](https://learn.microsoft.com/en-us/azure/logic-apps/authenticate-with-managed-identity)

### Protocol Specifications
- [A2A Protocol v1](https://a2a-protocol.org/latest/specification/)
- [OAuth 2.0 Authorization Code Flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
- [OpenID Connect](https://openid.net/specs/openid-connect-core-1_0.html)

### Okta Documentation
- [SAML App Integration](https://help.okta.com/en-us/content/topics/apps/apps_app_integration_wizard_saml.htm)
- [OAuth 2.0 & OIDC](https://developer.okta.com/docs/concepts/oauth-openid/)
- [Custom Authorization Server](https://developer.okta.com/docs/guides/customize-authz-server/)

---

## 🎓 Learning Path

### Beginner (Day 1)
1. ✅ Read [README_ARCHITECTURE_DECISION.md](./README_ARCHITECTURE_DECISION.md) (15 min)
2. ✅ Review [README_IDENTITY_FEDERATION_FLOW.md](./README_IDENTITY_FEDERATION_FLOW.md) diagrams (20 min)
3. ✅ Choose your option based on requirements (10 min)

### Intermediate (Day 2-3)
1. ✅ Follow [SETUP_IDENTITY_FEDERATION.md](./SETUP_IDENTITY_FEDERATION.md) for your option (2-4 hours)
2. ✅ Test with [`a2a-endpoints.http`](./a2a-endpoints.http) (30 min)
3. ✅ Validate end-to-end flow (1 hour)

### Advanced (Week 2)
1. ✅ Implement ACL security trimming (1 day)
2. ✅ Add monitoring and alerting (1 day)
3. ✅ Performance optimization (2 days)
4. ✅ Production hardening (1 week)

---

## 💡 Pro Tips

1. **Start with Option 1** for POC, migrate to Option 2 if you need API management features later
2. **Use managed identities** everywhere possible (Logic App → AI Search, APIM → Logic App)
3. **Enable Application Insights** on all components from day 1
4. **Test ACL filtering** with multiple test users in different Okta groups
5. **Document your group mappings** (Okta group → Entra Object ID) in a spreadsheet
6. **Use the HTTP REST client** for automated testing in CI/CD pipelines

---

## ✅ Success Criteria

Your implementation is ready for production when:

- [ ] Users authenticate successfully with Okta credentials
- [ ] Teams SSO or Bot OAuth flow works end-to-end
- [ ] Logic App receives valid tokens with group claims
- [ ] Azure AI Search queries include ACL filters
- [ ] Search results are properly security-trimmed per user
- [ ] All endpoints return expected responses in `a2a-endpoints.http`
- [ ] Monitoring dashboards show healthy metrics
- [ ] Documentation is updated with your organization's specifics

---

## 🚦 Next Steps

**Ready to start?**

1. **Choose your option** → [Architecture Decision Guide](./README_ARCHITECTURE_DECISION.md)
2. **Follow the setup** → [Setup Guide](./SETUP_IDENTITY_FEDERATION.md)
3. **Understand the flow** → [Flow Diagrams](./README_IDENTITY_FEDERATION_FLOW.md)
4. **Test your work** → [HTTP REST Client](./a2a-endpoints.http)

**Need help?**
- Review [troubleshooting section](./SETUP_IDENTITY_FEDERATION.md#troubleshooting)
- Check [POC notes](./README_POC_NOTES.md) for implementation details
- Consult your Microsoft or Azure architect

---

**Happy Building! 🎉**
