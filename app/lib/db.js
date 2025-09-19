'use client';
import { openDB } from 'idb';

const DB_NAME = 'feldman_chat_db';
const STORE = 'histories';

export async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

// 새 세션 생성
export async function createSession(type) {
  const db = await getDB();
  const now = new Date().toLocaleString();
  await db.add(STORE, { title: `새 ${type.toUpperCase()} 대화 (${now})`, messages: [], type, createdAt: now });
}

// 채팅 제목 업데이트
export async function updateSessionTitle(id, newTitle) {
  const db = await getDB();
  const history = await db.get(STORE, id);
  if (history) {
    history.title = newTitle;
    await db.put(STORE, history);
  }
}


// 모든 히스토리 불러오기
export async function getAllHistories() {
  const db = await getDB();
  return await db.getAll(STORE);
}

// 🔹 특정 히스토리 불러오기
export async function getHistoryById(id) {
  const db = await getDB();
  return await db.get(STORE, id);
}

// 새 히스토리 저장
export async function saveHistory(title, messages, type) {
  const db = await getDB();
  const now = new Date().toLocaleString();
  await db.add(STORE, { title: title || `대화 (${now})`, messages, type, createdAt: now });
}
