// The one LLM call the pipeline makes: idea -> story + shot plan.
// Any chat model works; swap the fetch if you use OpenAI or a local model.
import { need } from './env.mjs';

export async function chatJSON({ system, user, maxTokens = 8000, model = 'claude-sonnet-5-5' }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': need('CLAUDE_API_KEY'),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  if (data.stop_reason === 'max_tokens')
    throw new Error(`LLM ran out of room (max_tokens=${maxTokens}); raise it or ask for fewer shots.`);
  const text = data.content.map((c) => c.text ?? '').join('');
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(json);
}

/** Same call, with images attached — used for vision QC of a painted frame. */
export async function visionJSON({ system, user, images, maxTokens = 2000, model = 'claude-sonnet-5-5' }) {
  const content = [
    ...images.map((b64) => ({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: b64 },
    })),
    { type: 'text', text: user },
  ];
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': need('CLAUDE_API_KEY'),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content }] }),
  });
  if (!res.ok) throw new Error(`vision ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data.content.map((c) => c.text ?? '').join('');
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}
