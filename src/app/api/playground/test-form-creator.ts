"use server";
import { ANALYSIS_TOOLS_formCreator } from "@/src/lib/post-message-analysis/agent-request-form-creator";

export async function PLAYGROUND_testFormCreator() {
    const messageWithRequest = `Hi there! I'm your virtual assistant helping with the account setup process. To get started with our premium service integration, I'll need a few details from you.

First, could you share your basic contact details? We'll need your email address and a phone number where we can reach you. 

As part of our verification process, I'll also need to collect some personal information. This includes your full name and current age. Oh, and we'll need your complete mailing address - you know, street address, city, state, and don't forget the zip code!

For our demographic analysis and personalized service offering, would you mind sharing your gender and date of birth? Also, it helps us tailor our services if we know your marital status and education background.

By the way, what's your current occupation? We're trying to better understand our user base, so if you're comfortable, could you also indicate your approximate income level?

Now, for the technical integration with Google services (this is crucial for the premium features), we'll need several authentication details:
- Your Google API key
- The Sheet ID for data synchronization
- Your Secret Key
- The Access Token
- And both the Client ID and Client Secret

I know it's a lot to take in, but this will help us provide you with the best possible service! Let me know if you have any questions about any of these items.`
    
  const formSchema = await ANALYSIS_TOOLS_formCreator(messageWithRequest);
  return formSchema;
}