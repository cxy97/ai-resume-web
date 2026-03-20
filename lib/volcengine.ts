export async function callArkModel(prompt: string) {
  const apiKey = process.env.ARK_API_KEY;
  const model = process.env.ARK_MODEL;
  const baseUrl = process.env.ARK_BASE_URL;

  if (!apiKey || !model || !baseUrl) {
    throw new Error("Missing ARK environment variables");
  }

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "你是一个严格按要求返回 JSON 的助手。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`Ark API error: ${response.status} ${rawText}`);
  }

  const data = JSON.parse(rawText);
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content returned from Ark model");
  }

  return content;
}