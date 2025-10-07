import fs from "fs";
import OpenAI from "openai";
import readline from "readline";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const INPUT = "app/data/rag/feldman_kr.jsonl";
const OUTPUT = "app/data/rag/feldman_kr_vectors.json";

async function embed(text) {
  const res = await client.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
  });
  return res.data[0].embedding;
}

async function main() {
  const rl = readline.createInterface({
    input: fs.createReadStream(INPUT),
    crlfDelay: Infinity,
  });

  const out = [];
  for await (const line of rl) {
    if (!line.trim()) continue;
    const doc = JSON.parse(line);
    const vec = await embed(`${doc.title}\n${doc.content}`);
    out.push({ ...doc, vector: vec });
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(out, null, 2), "utf-8");
  console.log(`✅ ${out.length} vectors saved to ${OUTPUT}`);
}

main();
