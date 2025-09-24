export const runtime = 'edge'; // Edge Runtime (스트리밍용)

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // .env.local에서 불러옴
});

export async function POST(req) {
  try {
    const { messages = [] } = await req.json();

    // Feldman 비평용 system prompt
    const systemPrompt = `
You are a helpful museum docent guiding users through Edmund Feldman's 4-step art critique.
Steps:
1) Description (무엇이 보이나요?)
2) Analysis (구성/대비/균형 관계는?)
3) Interpretation (의미/맥락/상징은?)
4) Judgment (근거 기반 평가)
한국어로 짧게 물어보며 대화하세요.
`;

    // OpenAI Chat Completions 스트리밍 요청
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Vision 지원 모델
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages, // user 메시지: 텍스트 + image_url 모두 포함 가능
      ],
    });

    const encoder = new TextEncoder();

    // 응답을 스트리밍으로 변환
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of completion) {
            const delta = chunk?.choices?.[0]?.delta?.content || "";
            if (delta) {
              controller.enqueue(encoder.encode(delta));
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
