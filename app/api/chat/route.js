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

const ARTWORK_PATH = path.join(
  process.cwd(),
  "app/data/rag/artworks/tanning_eine_kleine_nachtmusik_meta.jsonl"
);

const CRITIQUES_PATH = path.join(
  process.cwd(),
  "app/data/rag/critiques"
);

const EMBEDDINGS_FILE = path.join(
  process.cwd(),
  "app/data/rag/embeddings/critiques/dccp_feldman_4step_vectors.json"
);

// Embeddings 로드 (캐싱)
let cachedEmbeddings = null;

function loadAllEmbeddings() {
  if (cachedEmbeddings) return cachedEmbeddings;
  
  try {
    const rawData = fs.readFileSync(EMBEDDINGS_FILE, "utf-8");
    cachedEmbeddings = JSON.parse(rawData);
    console.log(`Embeddings 로드 완료: ${cachedEmbeddings.length}개`);
    return cachedEmbeddings;
  } catch (e) {
    console.error("Embeddings 로드 실패:", e);
    return null;
  }
}

// 코사인 유사도 계산
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  
  return dotProduct / (magnitudeA * magnitudeB);
}

// Query embedding 생성 (OpenAI API 사용)
async function getQueryEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  } catch (e) {
    console.error("Query embedding 생성 실패:", e);
    return null;
  }
}

// Embeddings 기반 유사도 검색
async function searchRelevantExamples(query, currentStage, topK = 2) {
  try {
    const stageKeyMap = {
      "묘사": "description",
      "분석": "analysis",
      "해석": "interpretation",
      "판단": "judgment"
    };
    
    const stageKey = stageKeyMap[currentStage];
    if (!stageKey) return null;
    
    // 1. Query embedding 생성
    const queryEmbedding = await getQueryEmbedding(query);
    if (!queryEmbedding) {
      console.log("Query embedding 생성 실패 → Fallback to random");
      return loadCritiqueExamplesRandom(currentStage);
    }
    
    // 2. 전체 embeddings 로드
    const allEmbeddings = loadAllEmbeddings();
    if (!allEmbeddings) {
      console.log("Embeddings 로드 실패 → Fallback to random");
      return loadCritiqueExamplesRandom(currentStage);
    }
    
    // 3. 현재 단계에 해당하는 것만 필터링 & 유사도 계산
    const similarities = allEmbeddings
      .map((item, index) => ({
        index,
        text: item[stageKey], // description, analysis, interpretation, judgment
        embedding: item[`${stageKey}_embedding`], // description_embedding 등
        similarity: item[`${stageKey}_embedding`] 
          ? cosineSimilarity(queryEmbedding, item[`${stageKey}_embedding`])
          : 0
      }))
      .filter(item => item.text && item.text.length > 0); // 텍스트 있는 것만
    
    // 4. Top-K 선택
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topExamples = similarities.slice(0, topK).map(item => item.text);
    
    console.log(`유사도 검색 완료: Top ${topK} 선택됨`);
    console.log(`Top 유사도: ${similarities[0]?.similarity.toFixed(3)}, ${similarities[1]?.similarity.toFixed(3)}`);
    
    return topExamples;
    
  } catch (e) {
    console.error("유사도 검색 실패:", e);
    return loadCritiqueExamplesRandom(currentStage);
  }
}

// Fallback: 랜덤 선택
function loadCritiqueExamplesRandom(currentStage) {
  try {
    const filepath = path.join(CRITIQUES_PATH, "dccp_feldman_4step.jsonl");
    const rawData = fs.readFileSync(filepath, "utf-8");
    const lines = rawData.trim().split('\n');
    
    const examples = [];
    const stageKeyMap = {
      "묘사": "description",
      "분석": "analysis",
      "해석": "interpretation",
      "판단": "judgment"
    };
    
    const stageKey = stageKeyMap[currentStage];
    if (!stageKey) return null;
    
    lines.forEach(line => {
      const data = JSON.parse(line);
      if (data[stageKey]) {
        examples.push(data[stageKey]);
      }
    });
    
    const shuffled = examples.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 2);
    
  } catch (e) {
    console.error("랜덤 예시 로드 실패:", e);
    return null;
  }
}

// 질문 여부 판단 (더 정교하게)
function isQuestion(text) {
  const complaints = ["왜 안", "안 돼", "안돼", "작동 안", "이상해"];
  if (complaints.some(c => text.includes(c))) {
    return false;
  }
  
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
    const rawData = fs.readFileSync(ARTWORK_PATH, "utf-8");
    const artworkData = JSON.parse(rawData);
    return artworkData;
  } catch (e) {
    console.error("작품 정보 로드 실패:", e);
    return { 
      title: "알 수 없음", 
      artist_id: "unknown",
      year: "알 수 없음"
    };
  }
}

// 작가 정보 로드
function loadArtistInfo() {
  try {
    const rawData = fs.readFileSync(ARTIST_PATH, "utf-8");
    const lines = rawData.trim().split('\n');
    const artistData = {
      main: null,
      details: {}
    };
    
    lines.forEach(line => {
      const data = JSON.parse(line);
      if (data.category) {
        artistData.details[data.category] = data.content;
      } else {
        artistData.main = data;
      }
    });
    
    return artistData;
  } catch (e) {
    console.error("작가 정보 로드 실패:", e);
    return null;
  }
}

// RAG: 질문에 맞는 정보 검색
function searchRelevantInfo(query, artwork, artist) {
  const keywords = query.toLowerCase();
  const context = [];
  
  // 1. 작가 관련 질문
  if (keywords.match(/작가|화가|누구|who|artist|tanning|태닝/i)) {
    if (artist?.main?.name) {
      context.push(`**작가 정보:**`);
      context.push(`${artist.main.name} (${artist.main.birth_year}–${artist.main.death_year})`);
      context.push(`국적: ${artist.main.nationality}`);
      context.push(`사조: ${artist.main.art_movement}`);
      
      if (artist.main.content) {
        context.push(artist.main.content);
      }
      
      // 세부 정보
      if (keywords.match(/생애|삶|인생|출생|태어|life|birth/i) && artist.details.early_life) {
        context.push(`\n초기 생애: ${artist.details.early_life}`);
      }
      if (keywords.match(/경력|활동|career|work/i) && artist.details.career_start) {
        context.push(`\n경력: ${artist.details.career_start}`);
      }
      if (keywords.match(/결혼|에른스트|ernst|marriage/i) && artist.details.marriage_and_collaboration) {
        context.push(`\n${artist.details.marriage_and_collaboration}`);
      }
    }
  }
  
  // 2. 작품 기본 정보
  if (keywords.match(/제목|이름|title|name/i)) {
    context.push(`**작품명:** ${artwork.title}`);
  }
  
  if (keywords.match(/언제|연도|시기|when|year/i)) {
    context.push(`**제작 연도:** ${artwork.year}`);
  }
  
  if (keywords.match(/크기|사이즈|size|dimensions/i) && artwork.dimensions) {
    context.push(`**크기:** ${artwork.dimensions}`);
  }
  
  if (keywords.match(/재료|기법|매체|medium|material/i) && artwork.medium) {
    context.push(`**재료:** ${artwork.medium}`);
  }
  
  if (keywords.match(/어디|소장|museum|location|where/i) && artwork.museum) {
    context.push(`**소장처:** ${artwork.museum}`);
  }
  
  // 3. 작품 설명 (일반적 질문)
  if (keywords.match(/뭐야|설명|어떤|about|what|describe|그림/i)) {
    if (artwork.description) {
      context.push(`**작품 설명:**`);
      context.push(artwork.description);
    }
  }
  
  // 4. 테마/주제
  if (keywords.match(/주제|테마|의미|theme|meaning/i)) {
    if (artwork.themes && artwork.themes.length > 0) {
      context.push(`**주요 테마:** ${artwork.themes.join(', ')}`);
    }
  }
  
  // 5. 초현실주의/스타일
  if (keywords.match(/초현실|surreal|스타일|style|사조|movement/i)) {
    if (artwork.movement) {
      context.push(`**미술 사조:** ${artwork.movement}`);
    }
  }
  
  // 6. 작가의 말 (해석/의도 질문 시)
  if (keywords.match(/작가.*말|작가.*의도|작가.*생각|artist.*statement|왜.*그렸|의도/i)) {
    if (artwork.artist_statement && artwork.artist_statement.length > 0) {
      context.push(`**작가의 말 (힌트):**`);
      context.push(`"${artwork.artist_statement[0].substring(0, 200)}..."`);
    }
  }
  
  // 7. 특정 요소 질문 (해바라기, 소녀, 복도 등)
  if (keywords.match(/해바라기|sunflower/i) || 
      keywords.match(/소녀|girl/i) || 
      keywords.match(/복도|corridor|hallway/i) ||
      keywords.match(/문|door/i) ||
      keywords.match(/카펫|carpet|바닥/i)) {
    if (artwork.museum_note && artwork.museum_note.length > 0) {
      context.push(`**작품 요소 설명:**`);
      artwork.museum_note.forEach(note => {
        if (keywords.split(/\s+/).some(kw => note.toLowerCase().includes(kw))) {
          context.push(`- ${note}`);
        }
      });
    }
  }
  
  // 8. 제목 의미 (모차르트 관련)
  if (keywords.match(/제목|모차르트|mozart|night music|kleine/i)) {
    if (artwork.museum_note) {
      const titleNote = artwork.museum_note.find(note => 
        note.includes('제목') || note.includes('모차르트') || note.includes('Mozart')
      );
      if (titleNote) {
        context.push(`**제목에 대해:** ${titleNote}`);
      }
    }
  }
  
  return context.length > 0 ? context.join('\n') : null;
}

// 현재 단계 감지
function detectCurrentStage(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'assistant') {
      const content = typeof msg.content === 'string' ? msg.content : '';
      
      if (content.includes('4단계') && (content.includes('판단') || content.includes('Judgment'))) return '판단';
      if (content.includes('3단계') && (content.includes('해석') || content.includes('Interpretation'))) return '해석';
      if (content.includes('2단계') && (content.includes('분석') || content.includes('Analysis'))) return '분석';
      if (content.includes('1단계') && (content.includes('묘사') || content.includes('Description'))) return '묘사';
    }
  }
  return '묘사';
}

// 다음 단계 정보
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

// 동적 다음 단계 안내
async function generateNextStepPrompt(currentStage, userResponse, artwork, artist) {
  const nextInfo = getNextStageInfo(currentStage);
  
  if (!nextInfo) return null;
  
  const systemMessage = `
당신은 Feldman 미술 비평 도슨트입니다.

**Feldman 4단계:** 1) 묘사 → 2) 분석 → 3) 해석 → 4) 판단

**현재 상황:**
- 사용자가 ${currentStage} 단계에서 이렇게 답했습니다: "${userResponse}"
- 작품: ${artwork.title} (${artist?.main?.name || artwork.artist_id}, ${artwork.year})

**당신의 역할:**
1. 사용자의 답변을 구체적으로 인정하고 칭찬 (1-2문장, 다양한 표현)
2. 반드시 "**${nextInfo.number}단계: ${nextInfo.name}(${nextInfo.nameEng})**" 형식으로 다음 단계 안내
3. ${nextInfo.description} - 구체적 질문이나 예시 제시

**주의:** 2-4문장, 사용자 답변 내용 구체적으로 언급, 단계 번호 정확히 표기
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
    return `잘하셨어요! 이제 **${nextInfo.number}단계: ${nextInfo.name}(${nextInfo.nameEng})**로 넘어가볼까요? ${nextInfo.description}을 생각해보세요.`;
  }
}

// 메시지 텍스트 추출
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
    const artist = loadArtistInfo();
    const currentStage = detectCurrentStage(messages);
    
    console.log("=== DEBUG ===");
    console.log("마지막 사용자 메시지:", lastUserMessage);
    console.log("감지된 현재 단계:", currentStage);
    console.log("질문 여부:", isQuestion(lastUserMessage));

    // 🔍 질문인 경우 → RAG + GPT로 설명
    if (isQuestion(lastUserMessage)) {
      const ragInfo = searchRelevantInfo(lastUserMessage, artwork, artist);
      
      // Embeddings 기반 유사도 검색으로 관련 예시 찾기
      const critiqueExamples = await searchRelevantExamples(lastUserMessage, currentStage, 2);
      
      console.log("RAG 검색 결과:", ragInfo ? "발견됨" : "없음");
      console.log("Critique 예시 (유사도 기반):", critiqueExamples ? `${critiqueExamples.length}개` : "없음");
      
      const contextMessage = `
당신은 Feldman 미술 비평 도슨트입니다.

**현재 단계: ${currentStage} (${steps.indexOf(currentStage) + 1}단계)**

**작품 기본 정보:**
- 제목: ${artwork.title}
- 작가: ${artist?.main?.name || artwork.artist_id}
- 연도: ${artwork.year}
- 소장: ${artwork.museum || '알 수 없음'}

${ragInfo ? `**검색된 관련 정보:**\n${ragInfo}\n` : ''}

${critiqueExamples && critiqueExamples.length > 0 ? `**다른 작품의 ${currentStage} 예시 (참고용):**
이런 방식으로 생각해볼 수 있어요:
${critiqueExamples.map((ex, i) => `${i + 1}. "${ex}"`).join('\n')}

※ 이건 다른 작품 예시예요. 이 작품에 대해서는 직접 관찰하고 생각해보세요!\n` : ''}

**사용자의 질문:** "${lastUserMessage}"

**당신의 역할:**
- 위의 정보를 활용하여 친절하고 구체적으로 설명
- ${currentStage} 단계에 맞는 관점으로 답변
- 예시가 있다면 "이런 방식으로 생각해보세요"로 안내
- **중요: 직접 답을 주지 말 것** - 사용자가 스스로 발견하게 유도
- **중요: 다음 단계 안내 금지** ("이제 N단계로..." 사용 금지)

**단계별 포인트:**
- 묘사: 보이는 것을 객관적으로 관찰하도록 유도
- 분석: 형식적 요소의 관계를 생각하게 유도
- 해석: 의미와 감정을 스스로 생각하게 질문으로 유도
- 판단: 개인적 평가를 자유롭게 표현하도록 격려
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

    // 💬 답변인 경우 → 다음 단계 안내
    const nextPrompt = await generateNextStepPrompt(currentStage, lastUserMessage, artwork, artist);
    
    if (nextPrompt === null) {
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