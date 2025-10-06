# Architecture Decision Guide: Okta Federation Options

> **Quick Decision**: Choose your identity federation approach

## TL;DR - Which Option Should I Choose?

### Choose Option 1 (Direct Entra ID Federation) if:
✅ You're already using Microsoft 365/Entra ID infrastructure  
✅ You want simpler architecture with fewer moving parts  
✅ Native Teams SSO experience is important  
✅ Cost optimization is a priority  
✅ You're building a Microsoft-centric solution  

**→ Go to: [SETUP_IDENTITY_FEDERATION.md - Option 1](./SETUP_IDENTITY_FEDERATION.md#option-1-part-1-configure-okta-federation-with-entra-id)**

### Choose Option 2 (APIM Gateway) if:
✅ You need to support multiple identity providers (Okta, Auth0, etc.)  
✅ Centralized API governance is required  
✅ Advanced rate limiting/throttling is needed  
✅ You're building a multi-cloud architecture  
✅ Backend services don't support Entra ID authentication  

**→ Go to: [SETUP_IDENTITY_FEDERATION.md - Option 2](./SETUP_IDENTITY_FEDERATION.md#option-2-part-1-configure-okta-oauth-application)**

---

## Detailed Comparison

### Architecture Diagrams

#### Option 1: Direct Entra ID Federation
```
┌──────────┐      SAML       ┌──────────┐      Teams SSO   ┌───────────┐
│   Okta   │ ─────────────>  │ Entra ID │ ──────────────>  │   Teams   │
│   IdP    │                 │  (Token  │                  │    App    │
└──────────┘                 │  Issuer) │                  └─────┬─────┘
                             └──────────┘                        │
                                                                 │ Bearer Token
                                                                 │ (with groups)
                                                                 ▼
                             ┌──────────┐                  ┌───────────┐
                             │ Logic    │ <──────────────  │  EasyAuth │
                             │   App    │   Validates JWT  │           │
                             └────┬─────┘                  └───────────┘
                                  │ Managed Identity
                                  ▼
                        ┌──────────────────┐
                        │  Azure AI Search │
                        │  (ACL Filtered)  │
                        └──────────────────┘
```

**Pros:**
- 3 components only (Okta, Entra, Logic App)
- Native Teams integration
- Lower latency (fewer hops)
- Built-in EasyAuth validation
- No additional Azure services

**Cons:**
- Requires Entra ID federation setup
- Microsoft platform lock-in
- Limited to 200 groups in token

---

#### Option 2: APIM Gateway
```
┌──────────┐      OAuth      ┌──────────┐     Okta Token    ┌──────────┐
│   Okta   │ ─────────────> │  Teams   │ ──────────────> │   APIM   │
│  OAuth   │                 │   Bot    │                  │ Gateway  │
│  Server  │                 └──────────┘                  └────┬─────┘
└──────────┘                                                    │
     ▲                                                          │ validate-jwt
     │ Token Validation                                         │ Extract groups
     │ (OpenID Config)                                          │ Transform
     └──────────────────────────────────────────────────────────┘
                                                                 │ MI/API Key
                                                                 ▼
                             ┌──────────┐                  ┌────────────┐
                             │ Logic    │ <──────────────  │ X-User-Id  │
                             │   App    │   Custom Headers │ X-User-Grp │
                             └────┬─────┘                  └────────────┘
                                  │ Managed Identity
                                  ▼
                        ┌──────────────────┐
                        │  Azure AI Search │
                        │  (ACL Filtered)  │
                        └──────────────────┘
```

**Pros:**
- Works with any OAuth provider
- Centralized policy enforcement
- Advanced rate limiting/caching
- API versioning and transformation
- Multi-cloud compatible

**Cons:**
- 4 components (Okta, APIM, Logic App, AI Search)
- Additional APIM cost (~$300-2500/month)
- Higher latency (~10-50ms overhead)
- More complex configuration

---

## Feature Comparison Matrix

| Feature | Option 1: Entra | Option 2: APIM | Winner |
|---------|----------------|----------------|--------|
| **Setup Complexity** | Medium (SAML federation) | High (APIM policies + OAuth) | 🥇 Option 1 |
| **Teams Integration** | Native SSO | Custom OAuth connection | 🥇 Option 1 |
| **Token Management** | Entra ID managed | Bot Framework SDK | 🥇 Option 1 |
| **Multi-Provider Support** | Entra only | Any OAuth 2.0 | 🥇 Option 2 |
| **API Gateway Features** | None | Rate limit, cache, transform | 🥇 Option 2 |
| **Monitoring** | App Insights | APIM Analytics + App Insights | 🥇 Option 2 |
| **Cost (monthly)** | $0 (included) | $300-2500 (APIM tier) | 🥇 Option 1 |
| **Latency** | ~50-100ms | ~60-150ms | 🥇 Option 1 |
| **Security Layers** | 2 (Entra, EasyAuth) | 3 (Okta, APIM, Logic App) | 🥇 Option 2 |
| **Backend Flexibility** | Must support Entra | Any backend | 🥇 Option 2 |
| **Scalability** | High | Very High (APIM handles) | 🥇 Option 2 |
| **Group Claim Limit** | 200 (Entra limit) | Unlimited (custom handling) | 🥇 Option 2 |

---

## Cost Analysis (12 months)

### Option 1: Direct Entra Federation
```
Okta (existing):              $0 (assumed existing)
Entra ID (existing):          $0 (included with M365)
Logic Apps:                   ~$50-200/month
Azure AI Search:              ~$250-500/month (Basic)
Azure OpenAI:                 ~$100-500/month (usage-based)
──────────────────────────────────────────────
Total Monthly:                $400-1,200
Total Annual:                 $4,800-14,400
```

### Option 2: APIM Gateway
```
Okta (existing):              $0 (assumed existing)
Azure APIM:                   $300-2,500/month (Developer-Premium)
Logic Apps:                   ~$50-200/month
Azure AI Search:              ~$250-500/month (Basic)
Azure OpenAI:                 ~$100-500/month (usage-based)
──────────────────────────────────────────────
Total Monthly:                $700-3,700
Total Annual:                 $8,400-44,400
```

**Cost Difference:** Option 2 costs $3,600-30,000 more per year due to APIM

---

## Migration Path

### Starting with Option 1, Migrating to Option 2 Later

**Good news:** You can start with Option 1 and migrate to Option 2 with minimal disruption.

**Migration Steps:**
1. Deploy APIM in same resource group
2. Import Logic App APIs into APIM
3. Configure validate-jwt policy
4. Update Teams bot to use APIM endpoint
5. Test in parallel with existing setup
6. Switch DNS/endpoint once validated
7. (Optional) Remove Entra federation if no longer needed

**Migration Time:** 4-8 hours for experienced team

---

## Decision Framework

Use this flowchart to guide your decision:

```
┌─────────────────────────────────────────────┐
│ Do you already have Entra ID infrastructure? │
└──────────────┬──────────────────────────────┘
               │
      ┌────────┴────────┐
      │                 │
     YES               NO
      │                 │
      ▼                 ▼
┌───────────┐    ┌──────────────┐
│ Do you    │    │ Use Option 2 │
│ need to   │    │ (APIM)       │
│ support   │    └──────────────┘
│ multiple  │
│ IdPs?     │
└─────┬─────┘
      │
  ┌───┴───┐
  │       │
 YES     NO
  │       │
  ▼       ▼
┌──────┐ ┌──────┐
│Opt 2 │ │Opt 1 │
└──────┘ └──────┘

┌─────────────────────────────────────┐
│ Do you need centralized API         │
│ governance (rate limiting, caching, │
│ versioning, analytics)?             │
└───────────────┬─────────────────────┘
                │
         ┌──────┴──────┐
         │             │
        YES           NO
         │             │
         ▼             ▼
    ┌──────┐      ┌──────┐
    │Opt 2 │      │Opt 1 │
    └──────┘      └──────┘

┌─────────────────────────────────────┐
│ Is cost optimization critical?      │
└───────────────┬─────────────────────┘
                │
         ┌──────┴──────┐
         │             │
        YES           NO
         │             │
         ▼             ▼
    ┌──────┐      ┌────────────┐
    │Opt 1 │      │Either works│
    └──────┘      └────────────┘
```

---

## Real-World Scenarios

### Scenario 1: Enterprise with existing M365
**Company:** Fortune 500 with 50,000 employees  
**Requirements:** Teams agent for HR knowledge base, existing M365 E5 licenses  
**Decision:** **Option 1** - Already have Entra ID, teams familiar with Microsoft stack  
**Result:** $800/month total cost, 2-week implementation

---

### Scenario 2: Multi-cloud startup
**Company:** Tech startup with AWS primary, Azure secondary  
**Requirements:** Support Okta, Auth0, and future IdPs  
**Decision:** **Option 2** - Need flexibility, already using APIM for other APIs  
**Result:** $1,200/month (APIM Developer tier), centralized monitoring

---

### Scenario 3: Healthcare with strict compliance
**Company:** Regional hospital with HIPAA requirements  
**Requirements:** Detailed audit logs, rate limiting per department  
**Decision:** **Option 2** - APIM provides required governance and logging  
**Result:** $2,800/month (APIM Standard tier), comprehensive audit trail

---

### Scenario 4: Small business rapid prototype
**Company:** 200-person company, proof of concept for 3 months  
**Requirements:** Quick validation, low cost  
**Decision:** **Option 1** - Faster setup, lower cost for POC  
**Result:** $400/month, 1-week implementation, can migrate later if needed

---

## Common Questions

### Q: Can I use both approaches simultaneously?
**A:** Yes, but not recommended. It adds unnecessary complexity. Choose one based on your requirements.

### Q: What if I'm already using Entra ID but need APIM features?
**A:** Use **Option 1** for authentication, add APIM as a proxy layer in front of Logic App for API management features. Best of both worlds but highest complexity.

### Q: Does Option 2 eliminate the need for Entra ID?
**A:** Not entirely. You may still use Entra for Logic App managed identity and Azure resource access, but Teams authentication goes directly through Okta.

### Q: Can I A/B test both options?
**A:** Yes. Deploy both in parallel with different Teams app registrations. Route 50% of users to each option and measure metrics.

### Q: What about future Microsoft identity changes?
**A:** Option 1 gets Microsoft updates automatically. Option 2 requires manual policy updates when standards change.

---

## Next Steps

### For Option 1:
1. ✅ Read [SETUP_IDENTITY_FEDERATION.md - Option 1](./SETUP_IDENTITY_FEDERATION.md#option-1-part-1-configure-okta-federation-with-entra-id)
2. ✅ Configure Okta SAML federation with Entra ID
3. ✅ Set up Teams app SSO
4. ✅ Enable Logic App EasyAuth
5. ✅ Test end-to-end flow

### For Option 2:
1. ✅ Read [SETUP_IDENTITY_FEDERATION.md - Option 2](./SETUP_IDENTITY_FEDERATION.md#option-2-part-1-configure-okta-oauth-application)
2. ✅ Configure Okta OAuth application
3. ✅ Deploy and configure Azure APIM
4. ✅ Set up Bot Framework OAuth connection
5. ✅ Test end-to-end flow

### Still Unsure?
- Review the [Architecture Comparison](./README_IDENTITY_FEDERATION_FLOW.md#architecture-comparison) in the flow document
- Start with **Option 1** for POC, migrate to **Option 2** if needed
- Contact your Microsoft or Azure architect for enterprise guidance

---

## Additional Resources

- **Setup Guide:** [SETUP_IDENTITY_FEDERATION.md](./SETUP_IDENTITY_FEDERATION.md)
- **Flow Diagrams:** [README_IDENTITY_FEDERATION_FLOW.md](./README_IDENTITY_FEDERATION_FLOW.md)
- **POC Notes:** [README_POC_NOTES.md](./README_POC_NOTES.md)
- **Microsoft APIM + Okta:** [Medium Article](https://medium.com/azurediary/secure-api-in-azure-api-management-using-okta-identity-management-75a0cf74a7f8)

---

**Last Updated:** January 2025  
**Maintained By:** Azure Architecture Team
