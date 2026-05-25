// Optional / future use. Gemini cannot perform the geometric stitching itself,
// but it can power auxiliary text features later (e.g. critiquing seam quality
// or suggesting parameters from a description). Nothing in the app calls this
// yet; it is kept as a ready-to-wire helper mirroring the reference app.

const MODEL = 'gemini-2.5-flash-preview-09-2025';

export async function callGeminiAPI(prompt, systemInstruction, apiKey) {
  if (!apiKey) throw new Error('Gemini APIキーが設定されていません。');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const payload = { contents: [{ parts: [{ text: prompt }] }] };
  if (systemInstruction) {
    payload.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  let delay = 1000;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`API request failed: ${response.status}`);
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (err) {
      if (attempt === 4) throw new Error('処理に失敗しました。時間をおいて再度お試しください。');
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
}
