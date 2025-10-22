export const runtime = 'nodejs'; // Node.js 환경 (스트리밍 지원)

import OpenAI from "openai";
import fs from "fs";
import path from "path";

// ---- OpenAI 초기화 ----
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---- Feldman 기본 안내 프롬프트 ----
const systemPrompt = `
You are a helpful museum docent guiding users through Edmund Feldman's 4-step art critique.
Steps:
1) Description (무엇이 보이나요?)
2) Analysis (구성/대비/균형 관계는?)
3) Interpretation (의미/맥락/상징은?)
4) Judgment (근거 기반 평가)
한국어로 짧게 물어보며 대화하세요.
사용자가 각 단계에 성실히 답하면, 다음 단계로 자연스럽게 넘어가세요.
`;

// ---- RAG 데이터 경로 (embedding vectors) ----
const DATA_PATH = path.join(
  process.cwd(),
  "app/data/rag/embeddings/critiques/dccp_feldman_4step_vectors.json"
);

// ---- 코사인 유사도 계산 ----
function cosineSim(a, b) {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ---- 질문 감지 ----
function isQuestion(text) {
  const qTriggers = ["?", "어떻게", "왜", "무엇", "알려줘", "뭐야", "설명"];
  return qTriggers.some((kw) => text.includes(kw));
}

// ---- RAG 문서 로드 ----
let DOCS = null;
function loadDocs() {
  if (!DOCS) {
    DOCS = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  }
  return DOCS;
}

// ---- RAG 검색 함수 ----
async function retrieveContext(question) {
  const docs = loadDocs();

  // 1️⃣ 질문 임베딩 생성
  const embRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: question,
  });
  const qvec = embRes.data[0].embedding;

  // 2️⃣ 코사인 유사도 기반 상위 5개 선택
  const top = docs
    .map((d) => ({
      ...d,
      score: cosineSim(qvec, d.embedding), // ✅ 필드명 맞춤 (d.vector → d.embedding)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // 3️⃣ 참고 문맥 구성
  const context = top
    .map(
      (d, i) =>
        `【${i + 1}】(${d.stage.toUpperCase()}) ${d.text}`
    )
    .join("\n\n");

  return context;
}

// ----- 메인 POST 핸들러 -----
export async function POST(req) {
  try {
    const { messages = [] } = await req.json();

    // ✅ 마지막 유저 메시지 content 처리 (문자열 or 배열 모두 대응)
    let lastUserMessage = "";
    const last = messages[messages.length - 1];
    if (Array.isArray(last?.content)) {
      lastUserMessage = last.content
        .map((c) => (typeof c.text === "string" ? c.text : ""))
        .join(" ")
        .trim();
    } else {
      lastUserMessage = last?.content || "";
    }

    // ---- 프롬프트 초기화 ----
    let systemMessage = systemPrompt;
    let finalMessages = [];

    // 🎯 질문인 경우 → RAG 기반 프롬프트 구성
    if (isQuestion(lastUserMessage)) {
      const context = await retrieveContext(lastUserMessage);
      systemMessage = `
당신은 Feldman 미술 비평 도우미입니다.
다음은 관련 참고자료입니다. 이를 근거로 한국어로 간결하게 답하세요.
가능하면 단계 관련 용어(기술, 분석, 해석, 판단)를 언급하고, 근거를 제시하세요.

질문: ${lastUserMessage}

참고자료:
${context}
      `;
      finalMessages = [{ role: "system", content: systemMessage }];
    } else {
      // ---- 일반 대화 흐름 (단계 안내)
      finalMessages = [{ role: "system", content: systemPrompt }, ...messages];
    }

    // ---- GPT 스트리밍 응답 ----
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      temperature: 0.6,
      messages: finalMessages,
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of completion) {
            const delta = chunk?.choices?.[0]?.delta?.content || "";
            if (delta) controller.enqueue(encoder.encode(delta));
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    // ---- 스트리밍 Response 반환 ----
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("❌ RAG/Chat Error:", e);
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
