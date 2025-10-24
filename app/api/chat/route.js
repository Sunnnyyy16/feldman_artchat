export const runtime = 'nodejs';

import OpenAI from "openai";
import fs from "fs";
import path from "path";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const steps = ["묘사", "분석", "해석", "판단"];

const systemPrompt = `
당신은 Feldman 미술 비평의 4단계를 안내하는 도슨트입니다.
각 단계는 다음과 같습니다:
1) 묘사(Description) — 보이는 것을 객관적으로 말하기
2) 분석(Analysis) — 구성, 대비, 균형 등의 관계를 설명하기
3) 해석(Interpretation) — 의미나 감정, 상징을 추론하기
4) 판단(Judgment) — 작품의 가치와 완성도를 평가하기

**중요한 규칙:**
- 사용자가 질문("?", "어떻게", "왜", "무엇" 등)을 하면 친절히 설명만 해주세요.
- 사용자가 답변(의견, 생각)을 하면 그 답변을 인정하고, 다음 단계로 자연스럽게 안내하세요.
- 각 단계에서 사용자의 생각을 존중하고 격려하는 톤으로 대화하세요.
`;

const FACTUAL_DATA_PATH = path.join(
  process.cwd(),
  "app/data/rag/artworks/tanning_eine_kleine_nachtmusik_meta.jsonl"
);

// 질문 여부 판단
function isQuestion(text) {
  const triggers = ["?", "어떻게", "왜", "무엇", "알려줘", "뭐야", "설명", "예시", "도와줘", "모르겠어", "어려워"];
  return triggers.some((kw) => text.toLowerCase().includes(kw.toLowerCase()));
}

// 작품 정보 로드
function loadArtworkInfo() {
  try {
    const artworkData = JSON.parse(fs.readFileSync(FACTUAL_DATA_PATH, "utf-8"));
    return artworkData;
  } catch (e) {
    return { title: "알 수 없음", artist: "알 수 없음", year: "알 수 없음" };
  }
}

// 현재 단계 감지 (대화 히스토리에서 추출)
function detectCurrentStage(messages) {
  // 마지막 assistant 메시지에서 "N단계" 또는 단계 키워드를 명확하게 찾기
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'assistant') {
      const content = typeof msg.content === 'string' ? msg.content : '';
      
      // "4단계" 또는 "판단 단계"를 명확히 찾기
      if (content.includes('4단계') || content.includes('판단 단계') || content.includes('**4단계:')) return '판단';
      if (content.includes('3단계') || content.includes('해석 단계') || content.includes('**3단계:')) return '해석';
      if (content.includes('2단계') || content.includes('분석 단계') || content.includes('**2단계:')) return '분석';
      if (content.includes('1단계') || content.includes('묘사 단계') || content.includes('**1단계:') || content.includes('가장 먼저 1단계')) return '묘사';
    }
  }
  return '묘사'; // 기본값
}

// 다음 단계 가져오기
function getNextStage(currentStage) {
  const currentIndex = steps.findIndex((s) => s === currentStage);
  return steps[currentIndex + 1] || null;
}

// 단계별 안내 메시지 (현재 단계를 완료한 후 다음 단계로 안내)
function getNextStepPrompt(currentStage) {
  const nextSteps = {
    "묘사": "좋아요! 이제 **2단계: 분석(Analysis)**으로 넘어가볼까요?\n작품의 구성, 색채의 대비, 균형, 시선의 흐름 등을 생각해서 알려주세요.",
    "분석": "멋지네요! 이제 **3단계: 해석(Interpretation)**입니다.\n이 작품이 어떤 의미나 감정, 상징을 전달한다고 생각하시나요?",
    "해석": "훌륭해요! 마지막 **4단계: 판단(Judgment)**입니다.\n작품의 예술적 가치, 완성도, 또는 개인적인 평가를 자유롭게 말씀해 주세요.",
    "판단": null  // 마지막 단계는 다음이 없음
  };
  return nextSteps[currentStage];
}

// 메시지 내용 추출 (텍스트만)
function extractTextFromMessage(msg) {
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join(' ');
  }
  return '';
}

export async function POST(req) {
  try {
    const { messages = [] } = await req.json();
    
    if (messages.length === 0) {
      return new Response("메시지가 비어있습니다.", { status: 400 });
    }

    const lastUserMessage = extractTextFromMessage(messages[messages.length - 1]);
    const artwork = loadArtworkInfo();
    const currentStage = detectCurrentStage(messages);
    
    // 디버깅용 로그
    console.log("=== DEBUG ===");
    console.log("전체 메시지 수:", messages.length);
    console.log("마지막 사용자 메시지:", lastUserMessage);
    console.log("감지된 현재 단계:", currentStage);
    console.log("질문 여부:", isQuestion(lastUserMessage));

    // 🔍 질문인 경우 → GPT로 설명 (단계 유지)
    if (isQuestion(lastUserMessage)) {
      const contextMessage = `
        ${systemPrompt}
        
        **현재 단계: ${currentStage}**
        
        작품 정보:
        - 제목: ${artwork.title}
        - 작가: ${artwork.artist}
        - 연도: ${artwork.year}
        
        사용자가 ${currentStage} 단계에 대해 질문했습니다.
        친절하고 구체적으로 설명해주되, 답을 대신 말해주지 말고 힌트를 주세요.
      `;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        stream: true,
        messages: [
          { role: "system", content: contextMessage },
          ...messages.slice(-5).map(m => ({
            role: m.role,
            content: extractTextFromMessage(m)
          }))
        ],
      });

      // 스트리밍 응답 반환
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of completion) {
              const text = chunk.choices[0]?.delta?.content || '';
              if (text) {
                controller.enqueue(encoder.encode(text));
              }
            }
            controller.close();
          } catch (e) {
            controller.error(e);
          }
        }
      });

      return new Response(stream, {
        headers: { 
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked'
        }
      });
    }

    // 💬 답변인 경우 → 다음 단계로 안내
    
    // 현재 단계 완료 후 다음 단계 프롬프트 가져오기
    const nextPrompt = getNextStepPrompt(currentStage);
    
    console.log("다음 단계 프롬프트:", nextPrompt);
    
    // 다음 단계가 없으면 (판단 단계 완료) 종료 메시지
    if (nextPrompt === null) {
      console.log("완료 처리됨!");
      const completionMsg = "🎉 정말 멋져요! Feldman 4단계를 모두 완료하셨습니다.\n작품에 대해 깊이 있게 사고하고 표현하셨네요. 수고하셨어요!";
      
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(completionMsg));
          controller.close();
        }
      });

      return new Response(stream, {
        headers: { 
          'Content-Type': 'text/plain; charset=utf-8'
        }
      });
    }
    
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(nextPrompt));
        controller.close();
      }
    });

    return new Response(stream, {
      headers: { 
        'Content-Type': 'text/plain; charset=utf-8'
      }
    });

  } catch (e) {
    console.error('API Error:', e);
    return new Response(`오류가 발생했습니다: ${e.message}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}