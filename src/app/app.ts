import { App } from "@microsoft/teams.apps";
import { LocalStorage } from "@microsoft/teams.common";
import { MessageActivity, TokenCredentials } from '@microsoft/teams.api';
import { ManagedIdentityCredential } from '@azure/identity';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import config from "../config";

// Create storage for conversation history
const storage = new LocalStorage();

// Load instructions from file on initialization
function loadInstructions(): string {
  const instructionsFilePath = path.join(__dirname, "instructions.txt");
  return fs.readFileSync(instructionsFilePath, 'utf-8').trim();
}

// Load instructions once at startup
const instructions = loadInstructions();

const createTokenFactory = () => {
  return async (scope: string | string[], tenantId?: string): Promise<string> => {
    const managedIdentityCredential = new ManagedIdentityCredential({
        clientId: process.env.CLIENT_ID
      });
    const scopes = Array.isArray(scope) ? scope : [scope];
    const tokenResponse = await managedIdentityCredential.getToken(scopes, {
      tenantId: tenantId
    });
   
    return tokenResponse.token;
  };
};

// Configure authentication using TokenCredentials
const tokenCredentials: TokenCredentials = {
  clientId: process.env.CLIENT_ID || '',
  token: createTokenFactory()
};

const credentialOptions = config.MicrosoftAppType === "UserAssignedMsi" ? { ...tokenCredentials } : undefined;

// Create the app with storage
const app = new App({
  ...credentialOptions,
  storage
});

// Function to get Teams SSO token for the user
async function getTeamsAccessToken(activity: any): Promise<string> {
  // In production, Teams SSO tokens would be obtained through the Teams SDK
  // For this implementation, we'll extract from activity context or use managed identity
  try {
    // Check if token is available in activity (Teams SSO scenario)
    if (activity.channelData?.source?.bot?.authorization?.token) {
      return activity.channelData.source.bot.authorization.token;
    }
    
    // Fallback to managed identity for Logic App access
    const managedIdentityCredential = new ManagedIdentityCredential({
      clientId: config.logicAppClientId || process.env.CLIENT_ID
    });
    
    // Request token for the Logic App endpoint
    const tokenResponse = await managedIdentityCredential.getToken([
      `${config.logicAppEndpoint}/.default`
    ]);
    
    return tokenResponse.token;
  } catch (error) {
    console.error('Error getting access token:', error);
    // Try fallback with Graph scope
    try {
      const managedIdentityCredential = new ManagedIdentityCredential({
        clientId: process.env.CLIENT_ID
      });
      const tokenResponse = await managedIdentityCredential.getToken([
        'https://graph.microsoft.com/.default'
      ]);
      return tokenResponse.token;
    } catch (fallbackError) {
      console.error('Fallback token acquisition failed:', fallbackError);
      throw error;
    }
  }
}

// Function to call Logic App agent loop
async function callLogicAppAgentLoop(query: string, accessToken: string): Promise<string> {
  if (!config.logicAppEndpoint) {
    throw new Error('LOGIC_APP_ENDPOINT not configured');
  }

  try {
    const response = await axios.post(
      config.logicAppEndpoint,
      {
        query: query,
        user_context: {
          timestamp: new Date().toISOString()
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    return response.data.response || response.data.answer || 'No response from agent loop';
  } catch (error) {
    console.error('Error calling Logic App agent loop:', error);
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 403) {
        return 'Access denied. You may not have permission to access this information.';
      } else if (error.response?.status === 401) {
        return 'Authentication failed. Please try again.';
      }
    }
    throw error;
  }
}

// Handle incoming messages
app.on('message', async ({ send, stream, activity }) => {
  //Get conversation history
  const conversationKey = `${activity.conversation.id}/${activity.from.id}`;
  const messages = storage.get(conversationKey) || [];

  try {
    // Get Teams access token for the user
    const accessToken = await getTeamsAccessToken(activity);
    
    // Call Logic App agent loop with user query and token
    const response = await callLogicAppAgentLoop(activity.text, accessToken);
    
    // Add the conversation to history
    messages.push(
      { role: 'user', content: activity.text },
      { role: 'assistant', content: response }
    );
    
    if (activity.conversation.isGroup) {
      // If the conversation is a group chat, send the final response
      const responseActivity = new MessageActivity(response).addAiGenerated().addFeedback();
      await send(responseActivity);
    } else {
      // For one-on-one chat, send the response with streaming indicator
      await send(new MessageActivity(response).addAiGenerated().addFeedback());
    }
    
    storage.set(conversationKey, messages);
  } catch (error) {
    console.error('Error in message handling:', error);
    await send("I encountered an error while processing your request. Please try again.");
  }
});

app.on('message.submit.feedback', async ({ activity }) => {
  //add custom feedback process logic here
  console.log("Your feedback is " + JSON.stringify(activity.value));
})

export default app;