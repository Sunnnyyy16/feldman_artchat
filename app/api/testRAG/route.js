import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DATA_PATH = path.join(
  process.cwd(),
  "app/data/rag/embeddings/critiques/dccp_feldman_4step_vectors.json"
);

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] ** 2;
    nb += b[i] ** 2;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function retrieveContext(question) {
  const docs = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  const embRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: question,
  });
  const qvec = embRes.data[0].embedding;
  const top = docs
    .map((d) => ({ ...d, score: cosineSim(qvec, d.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  return top.map((t) => ({
    stage: t.stage,
    text: t.text,
    score: t.score.toFixed(3),
  }));
}

export async function GET() {
  const query = "이 작품의 조명과 색감이 어떤 느낌을 주나요?";
  const result = await retrieveContext(query);
  console.log("✅ [RAG TEST] top 5 context for:", query);
  return NextResponse.json({ query, result });
}
