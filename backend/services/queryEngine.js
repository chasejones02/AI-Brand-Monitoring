import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Builds the prompt sent to AI platforms.
 * Asks for business recommendations without naming the business,
 * so we can detect organic mentions.
 */
function buildPrompt(queryText) {
  return `${queryText}\n\nPlease recommend specific businesses or services. List them by name with a brief description of why each is recommended.`;
}

/**
 * Parses an AI response to detect if the business is mentioned,
 * its rank position, sentiment, and any competitor names.
 */
function parseResponse(rawResponse, businessName) {
  const lines = rawResponse.split('\n').filter(Boolean);
  const nameLower = businessName.toLowerCase();

  let mentioned = false;
  let position = null;
  let sentiment = 'neutral';
  let competitors = [];
  let rank = 0;

  for (const line of lines) {
    const lineLower = line.toLowerCase();

    // Count ranking position by numbered list items
    if (/^\d+[\.\)]/.test(line.trim())) {
      rank++;
    }

    if (lineLower.includes(nameLower)) {
      mentioned = true;
      position = rank || 1;

      // Simple sentiment detection
      if (/excellent|best|top|highly recommend|outstanding|great/i.test(line)) {
        sentiment = 'positive';
      } else if (/avoid|poor|bad|not recommend|worst/i.test(line)) {
        sentiment = 'negative';
      }
    } else if (rank > 0 && /^\d+[\.\)]/.test(line.trim())) {
      // Extract competitor name (first few words of the line after the number)
      const match = line.replace(/^\d+[\.\)]\s*/, '').split(/[:\-–]/)[0].trim();
      if (match && match.length < 60) {
        competitors.push(match);
      }
    }
  }

  return { mentioned, position, sentiment, competitors_mentioned: competitors.slice(0, 5) };
}

/**
 * Queries ChatGPT for a single query and returns parsed results.
 */
export async function queryOpenAI(queryText, businessName) {
  const prompt = buildPrompt(queryText);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 600,
    temperature: 0.3,
  });

  const rawResponse = response.choices[0].message.content;
  const parsed = parseResponse(rawResponse, businessName);

  return { platform: 'chatgpt', rawResponse, ...parsed };
}

// Placeholder for additional platforms — wire in when API keys are ready
export async function queryAnthropic(_queryText, _businessName) {
  throw new Error('Anthropic integration not yet configured');
}

export async function queryPerplexity(_queryText, _businessName) {
  throw new Error('Perplexity integration not yet configured');
}

export async function queryGemini(_queryText, _businessName) {
  throw new Error('Gemini integration not yet configured');
}
