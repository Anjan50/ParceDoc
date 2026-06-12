/**
 * Claude API Service for Clinical Data Extraction
 *
 * All requests are routed through the Vite dev-server proxy at
 * `/api/anthropic` which forwards to `https://api.anthropic.com`.
 */

const API_BASE = '/api/anthropic/v1';
const MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_VERSION = '2023-06-01';

const SYSTEM_PROMPT = `You are a clinical data extraction specialist. Analyze the provided clinical document or medical report image and extract ALL structured data into a JSON format.

Rules:
1. Extract EVERY data point visible in the document
2. Standardize field names using these conventions:
   - patient_name, patient_id, mrn (Medical Record Number)
   - date_of_birth, date_of_service, report_date
   - ordering_physician, referring_physician
   - facility_name, facility_address
   - test_name, test_code, result_value, result_unit, reference_range, abnormal_flag
   - diagnosis, icd_code, cpt_code
   - specimen_type, collection_date, accession_number
   - medication_name, dosage, frequency, route
   - notes, comments
3. If the document contains a table of lab results, extract EACH row as a separate object in a "results" array
4. Identify the document type (lab_report, radiology_report, pathology_report, prescription, discharge_summary, clinical_notes, other)
5. Identify the vendor/EHR system if recognizable (Epic, Cerner, Meditech, etc.)
6. For any field you cannot determine, omit it rather than guessing
7. Return ONLY valid JSON, no markdown formatting, no code blocks

Response format:
{
  "document_type": "lab_report",
  "vendor": "Epic" or "Unknown",
  "patient_info": { ... },
  "facility_info": { ... },
  "clinical_data": {
    "results": [ { "test_name": "...", "result_value": "...", ... } ]
  },
  "metadata": { "report_date": "...", "ordering_physician": "..." }
}`;

/**
 * Build standard headers for Anthropic API requests.
 * @param {string} apiKey - Anthropic API key
 * @returns {Record<string,string>}
 */
function buildHeaders(apiKey) {
  return {
    'Content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'anthropic-dangerous-direct-browser-access': 'true',
  };
}

/**
 * Strip markdown code-block wrappers that Claude sometimes adds around JSON.
 * Handles ```json ... ```, ``` ... ```, and stray backtick fences.
 * @param {string} text
 * @returns {string}
 */
function stripCodeBlockWrappers(text) {
  let cleaned = text.trim();
  // Remove opening fence (```json or ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '');
  // Remove closing fence
  cleaned = cleaned.replace(/\n?```\s*$/, '');
  return cleaned.trim();
}

/**
 * Test whether a given API key is valid by making a lightweight call.
 *
 * @param {string} apiKey - Anthropic API key to validate
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function testConnection(apiKey) {
  try {
    const response = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Hello' }],
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message =
        body?.error?.message ??
        `API returned status ${response.status}`;
      return { success: false, error: message };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Network error – could not reach the API',
    };
  }
}

/**
 * Extract structured clinical data from a document / image via Claude Vision.
 *
 * @param {string}  apiKey     - Anthropic API key
 * @param {string}  base64Data - Base64-encoded file content (no data-URI prefix)
 * @param {string}  mimeType   - MIME type of the file (e.g. 'image/png', 'application/pdf')
 * @param {string}  fileName   - Original file name for context
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function extractClinicalData(apiKey, base64Data, mimeType, fileName) {
  try {
    const response = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: base64Data,
                },
              },
              {
                type: 'text',
                text: `Extract all clinical data from this document. File name: ${fileName}`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message =
        body?.error?.message ??
        `API returned status ${response.status}`;
      return { success: false, error: message };
    }

    const result = await response.json();

    // Claude returns content as an array of blocks; grab the first text block.
    const textBlock = result.content?.find((b) => b.type === 'text');
    if (!textBlock?.text) {
      return { success: false, error: 'No text content in API response' };
    }

    const rawText = stripCodeBlockWrappers(textBlock.text);

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return {
        success: false,
        error: 'Failed to parse JSON from API response',
      };
    }

    return { success: true, data: parsed };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Network error during extraction',
    };
  }
}

const ASSISTANT_SYSTEM = `You are ParceDoc Medical Data Assistant — a clinical intelligence AI embedded in a healthcare data extraction platform. You have access to the user's extracted clinical reports provided below.

Your capabilities:
1. **Analyze** — Identify abnormal values, critical flags, patterns across reports
2. **Summarize** — Create concise clinical summaries of reports
3. **Compare** — Compare results across multiple reports/dates
4. **Explain** — Explain what lab values, diagnoses, and medical terms mean in plain language
5. **Alert** — Flag critical or concerning values that may need immediate attention
6. **Recommend** — Suggest which specialists to see or follow-up tests (general guidance only)

Rules:
- Always be accurate and precise with medical data
- Clearly label abnormal values and explain their clinical significance
- Use professional medical terminology but explain in plain language too
- If asked about treatment, remind the user to consult their healthcare provider
- Format responses with markdown: use **bold** for emphasis, bullet lists, and tables when helpful
- Be concise but thorough
- If no reports are loaded, let the user know they need to upload documents first`;

/**
 * Send a message to the Medical Data Assistant with streaming response.
 *
 * @param {string} apiKey
 * @param {Array} messages - conversation history [{role, content}]
 * @param {string} reportsContext - stringified reports data
 * @param {function} onChunk - callback called with each text chunk
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function chatWithAssistant(apiKey, messages, reportsContext, onChunk) {
  try {
    const systemPrompt = `${ASSISTANT_SYSTEM}

=== LOADED CLINICAL REPORTS ===
${reportsContext || 'No reports loaded yet.'}
=== END REPORTS ===`;

    const response = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        stream: true,
        messages,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { success: false, error: body?.error?.message ?? `API returned status ${response.status}` };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              onChunk(parsed.delta.text);
            }
          } catch {
            // skip non-JSON lines
          }
        }
      }
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || 'Network error during chat' };
  }
}
