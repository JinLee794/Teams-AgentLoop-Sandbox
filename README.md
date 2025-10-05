# Overview of the Okta Federated Logic App Agent Template

This app template is built on top of [Teams AI library V2](https://aka.ms/teams-ai-library-v2).
It showcases a secure agent app that integrates with Azure Logic Apps to query ServiceNow knowledge articles through Okta/Entra ID federation. The agent provides security-trimmed responses based on user identity and group claims.

## Architecture Overview

This template implements the architecture described in `TeamsServiceNowFederation.md`:

- **Teams App/Bot**: Front-end for user queries with Teams SSO token issuance
- **Azure Logic App**: Orchestrates retrieval, handles token validation and OBO exchange, calls Azure AI Search
- **Azure AI Search**: Stores indexed ServiceNow data with ACL metadata
- **Okta/Entra ID Federation**: Provides user identity and group-based access control

## Get started with the template

> **Prerequisites**
>
> To run the template in your local dev machine, you will need:
>
> - [Node.js](https://nodejs.org/), supported versions: 20, 22.
> - [Microsoft 365 Agents Toolkit Visual Studio Code Extension](https://aka.ms/teams-toolkit) latest version or [Microsoft 365 Agents Toolkit CLI](https://aka.ms/teamsfx-toolkit-cli).
> - An Azure Logic App deployed with the agent loop workflow
> - Azure AI Search with ServiceNow indexed data
> - Okta/Entra ID federation configured

> For local debugging using Microsoft 365 Agents Toolkit CLI, you need to do some extra steps described in [Set up your Microsoft 365 Agents Toolkit CLI for local debugging](https://aka.ms/teamsfx-cli-debugging).

### Configuration Steps

1. First, select the Microsoft 365 Agents Toolkit icon on the left in the VS Code toolbar.
2. Copy `.env.example` to your environment files and configure:
   - `LOGIC_APP_ENDPOINT`: Your Azure Logic App HTTP trigger endpoint
   - `LOGIC_APP_CLIENT_ID`: Client ID for Logic App authentication
   - `CLIENT_ID`, `CLIENT_SECRET`, `TENANT_ID`: Teams bot credentials
3. Ensure your Logic App is deployed and accessible
4. Configure Okta/Entra ID federation as described in `TeamsServiceNowFederation.md`
5. Press F5 to start debugging which launches your app in Microsoft 365 Agents Playground using a web browser. Select `Debug in Microsoft 365 Agents Playground`.
6. You can send queries to get security-trimmed responses from ServiceNow knowledge articles.

**Congratulations**! You are running a secure federated agent application.

![Basic AI Chatbot](https://github.com/user-attachments/assets/984af126-222b-4c98-9578-0744790b103a)

## What's included in the template

| Folder       | Contents                                            |
| - | - |
| `.vscode`    | VSCode files for debugging                          |
| `appPackage` | Templates for the application manifest        |
| `env`        | Environment files                                   |
| `infra`      | Templates for provisioning Azure resources          |
| `src`        | The source code for the application                 |

The following files can be customized and demonstrate an example implementation to get you started.

| File                                 | Contents                                           |
| - | - |
|`src/index.ts`| Application entry point. |
|`src/config.ts`| Defines the environment variables including Logic App endpoint.|
|`src/app/instructions.txt`| Defines the agent instructions for federated search.|
|`src/app/app.ts`| Handles business logic for calling the Logic App agent loop.|

## Logic App Integration

The application now calls an Azure Logic App instead of OpenAI directly. The Logic App:

1. **Validates Teams SSO tokens** and extracts user identity/group claims
2. **Performs OBO token exchange** if needed for Microsoft Graph APIs
3. **Queries Azure AI Search** with security filters based on user groups
4. **Returns security-trimmed results** from ServiceNow knowledge articles

### Key Features

- **Security-first approach**: Users only see data they're authorized to access
- **Okta/Entra federation**: Leverages existing identity infrastructure
- **Scalable architecture**: Logic Apps handle orchestration and security
- **Audit trail**: All access attempts are logged and traceable

The following are Microsoft 365 Agents Toolkit specific project files. You can [visit a complete guide on Github](https://github.com/OfficeDev/TeamsFx/wiki/Teams-Toolkit-Visual-Studio-Code-v5-Guide#overview) to understand how Microsoft 365 Agents Toolkit works.

| File                                 | Contents                                           |
| - | - |
|`m365agents.yml`|This is the main Microsoft 365 Agents Toolkit project file. The project file defines two primary things:  Properties and configuration Stage definitions. |
|`m365agents.local.yml`|This overrides `m365agents.yml` with actions that enable local execution and debugging.|
|`m365agents.playground.yml`| This overrides `m365agents.yml` with actions that enable local execution and debugging in Microsoft 365 Agents Playground.|

## Extend the template

To extend the Okta Federated Logic App Agent template:

1. **Enhance the Logic App workflow** with additional data sources or AI capabilities
2. **Add more security policies** in the Logic App for fine-grained access control
3. **Integrate additional identity providers** through Entra ID federation
4. **Implement caching strategies** for frequently accessed ServiceNow articles
5. **Add rich card responses** for better user experience in Teams

For more AI capabilities, explore [Teams AI library V2 documentation](https://aka.ms/m365-agents-toolkit/teams-agent-extend-ai).

## Additional information and references

- [Microsoft 365 Agents Toolkit Documentations](https://docs.microsoft.com/microsoftteams/platform/toolkit/teams-toolkit-fundamentals)
- [Microsoft 365 Agents Toolkit CLI](https://aka.ms/teamsfx-toolkit-cli)
- [Microsoft 365 Agents Toolkit Samples](https://github.com/OfficeDev/TeamsFx-Samples)
