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
3) 해석(Interpretation) — 작품의 의미나 말하려는 바를 자유롭게 생각하고 해석하기
4) 판단(Judgment) — 작품의 미적 가치, 사회적 의미 등을 주관적, 종합적으로 판단하기

**중요한 규칙:**
- 사용자가 질문("?", "어떻게", "왜", "무엇" 등)을 하면 친절히 설명만 해주세요.
- 사용자가 답변(의견, 생각)을 하면 그 답변을 인정하고, 다음 단계로 자연스럽게 안내하세요.
- 각 단계에서 사용자의 생각을 존중하고 격려하는 톤으로 대화하세요.
`;

const FACTUAL_DATA_PATH = path.join(
  process.cwd(),
  "app/data/rag/artworks/tanning_eine_kleine_nachtmusik_meta.jsonl"
);

// 질문 여부 판단 (더 정교하게)
function isQuestion(text) {
  // 단순 불만이나 피드백은 질문이 아님
  const complaints = ["왜 안", "안 돼", "안돼", "작동 안", "이상해"];
  if (complaints.some(c => text.includes(c))) {
    return false;
  }
  
  // 명확한 질문만 감지
  const questionMarkers = [
    "?",
    "뭐야", "뭔가요", "무엇",
    "어떻게", "어떻게 해",
    "알려줘", "알려주세요", "설명해", "설명",
    "예시", "예를 들면",
    "도와줘", "도와주세요",
    "모르겠어", "모르겠는데", "어려워", "어렵네"
  ];
  
  return questionMarkers.some((kw) => text.toLowerCase().includes(kw.toLowerCase()));
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

// 현재 단계 감지 (영문 이름도 함께 체크)
function detectCurrentStage(messages) {
  // 역순으로 assistant 메시지 탐색
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'assistant') {
      const content = typeof msg.content === 'string' ? msg.content : '';
      
      // 단계 번호 + 이름 조합으로 정확하게 판단
      if (content.includes('4단계') && (content.includes('판단') || content.includes('Judgment'))) return '판단';
      if (content.includes('3단계') && (content.includes('해석') || content.includes('Interpretation'))) return '해석';
      if (content.includes('2단계') && (content.includes('분석') || content.includes('Analysis'))) return '분석';
      if (content.includes('1단계') && (content.includes('묘사') || content.includes('Description'))) return '묘사';
    }
  }
  
  // 기본값
  return '묘사';
}

// 다음 단계 정보 가져오기
function getNextStageInfo(currentStage) {
  const stageInfo = {
    "묘사": {
      number: 2,
      name: "분석",
      nameEng: "Analysis",
      description: "작품의 구성, 색채의 대비, 균형, 시선의 흐름, 형태의 배치 등 형식적 요소를 관찰"
    },
    "분석": {
      number: 3,
      name: "해석",
      nameEng: "Interpretation",
      description: "작품이 전달하는 의미, 감정, 상징, 작가의 의도나 메시지를 생각"
    },
    "해석": {
      number: 4,
      name: "판단",
      nameEng: "Judgment",
      description: "작품의 예술적 가치, 독창성, 완성도, 사회적 의미 등을 종합적으로 평가"
    },
    "판단": null
  };
  
  return stageInfo[currentStage];
}

// 동적으로 다음 단계 안내 메시지 생성
async function generateNextStepPrompt(currentStage, userResponse, artwork) {
  const nextInfo = getNextStageInfo(currentStage);
  
  if (!nextInfo) return null; // 판단 단계 완료
  
  const systemMessage = `
당신은 Feldman 미술 비평 도슨트입니다.

**중요: Feldman 4단계 구조**
1단계: 묘사(Description)
2단계: 분석(Analysis)
3단계: 해석(Interpretation)
4단계: 판단(Judgment)

**현재 상황:**
- 사용자가 ${currentStage} 단계에서 이렇게 답했습니다: "${userResponse}"
- 작품: ${artwork.title} (${artwork.artist}, ${artwork.year})

**당신의 역할:**
1. 사용자의 답변을 구체적으로 인정하고 칭찬하기 (1-2문장)
   - 사용자가 언급한 구체적인 내용을 짚어주세요
   - "좋아요", "멋지네요" 같은 단순 칭찬만 반복하지 말고 다양한 표현 사용
   
2. 자연스럽게 다음 단계로 연결하기
   - 반드시 "**${nextInfo.number}단계: ${nextInfo.name}(${nextInfo.nameEng})**" 형식 사용
   - 이전 단계와 다음 단계의 연결고리를 만들어주세요
   
3. 다음 단계에서 생각해볼 점 안내하기
   - ${nextInfo.description}
   - 구체적인 질문이나 예시를 제시하세요

**주의사항:**
- 2-4문장으로 간결하게
- 친근하고 격려하는 톤
- 사용자의 답변 내용을 반드시 구체적으로 언급
- 단계 번호를 정확히 표기 (${nextInfo.number}단계)

**좋은 예시:**
"해바라기와 소녀들의 대비에 주목하셨군요! 이런 요소들을 발견하셨다면, 이제 **2단계: 분석(Analysis)**으로 넘어가볼까요? 이 요소들이 화면에서 어떻게 배치되어 있고, 색채 대비는 어떤지 살펴보세요."

**나쁜 예시:**
"좋아요! 이제 분석 단계로 넘어가볼까요?" (단계 번호 누락, 사용자 답변 언급 없음)
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: "다음 단계로 자연스럽게 안내해주세요." }
      ],
    });

    return completion.choices[0].message.content;
  } catch (e) {
    console.error("다음 단계 안내 생성 실패:", e);
    // Fallback 메시지
    return `잘하셨어요! 이제 **${nextInfo.number}단계: ${nextInfo.name}(${nextInfo.nameEng})**로 넘어가볼까요? ${nextInfo.description}을 생각해보세요.`;
  }
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
    console.log("최근 assistant 메시지들:");
    messages.filter(m => m.role === 'assistant').slice(-3).forEach((m, i) => {
      console.log(`  [${i}]:`, typeof m.content === 'string' ? m.content.substring(0, 100) : 'non-string');
    });
    console.log("감지된 현재 단계:", currentStage);
    console.log("질문 여부:", isQuestion(lastUserMessage));

    // 🔍 질문인 경우 → GPT로 설명 (단계 유지, 다음 단계 안내 X)
    if (isQuestion(lastUserMessage)) {
      const contextMessage = `
당신은 Feldman 미술 비평 도슨트입니다.

**현재 단계: ${currentStage} (${steps.indexOf(currentStage) + 1}단계)**

작품 정보:
- 제목: ${artwork.title}
- 작가: ${artwork.artist}
- 연도: ${artwork.year}

**사용자의 질문:** "${lastUserMessage}"

**당신의 역할:**
- 사용자가 ${currentStage} 단계에 대해 질문했습니다
- 친절하고 구체적으로 설명해주세요
- 답을 직접 말해주지 말고 힌트나 예시를 주세요
- **중요: 다음 단계로 넘어가라고 안내하지 마세요**
- **중요: "이제 N단계로..." 같은 표현 사용 금지**
- 현재 단계에 집중하도록 도와주세요

**단계별 안내 포인트:**
- 묘사: 색상, 형태, 사물 등 보이는 것을 객관적으로 관찰
- 분석: 배치, 구도, 대비, 균형 등 형식적 요소의 관계
- 해석: 의미, 감정, 상징 등 작품이 전달하는 것
- 판단: 예술적 가치, 완성도, 개인적 평가

**예시:**
질문: "묘사가 뭐예요?"
답변: "묘사는 작품에서 실제로 보이는 것을 객관적으로 말하는 거예요. 예를 들어 '파란색 배경' 같은 색상이나 '큰 나무' 같은 형태를 설명하는 거죠."
(X) "묘사는... 이제 분석 단계로 넘어가볼까요?" ← 이런 식으로 다음 단계 언급 금지!
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        stream: true,
        messages: [
          { role: "system", content: contextMessage },
          { role: "user", content: lastUserMessage }
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

    // 💬 답변인 경우 → GPT가 동적으로 다음 단계 안내 생성
    const nextPrompt = await generateNextStepPrompt(currentStage, lastUserMessage, artwork);
    
    console.log("생성된 다음 단계 프롬프트:", nextPrompt ? nextPrompt.substring(0, 100) : 'null');
    
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
    
    // 다음 단계 안내 메시지 반환
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