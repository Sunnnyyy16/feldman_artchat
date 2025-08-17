'use client';
import { openDB } from 'idb';

const DB_NAME = 'feldman_chat_db';
const STORE = 'messages';

export async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        // keyPath = auto id, 인덱스: userId로 조회
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('userId', 'userId', { unique: false });
      }
    },
  });
}

// 사용자 전체 메시지 기록 가져오기 (오래된 순)
export async function getAllMessagesByUser(userId) {
  const db = await getDB();
  const tx = db.transaction(STORE, 'readonly');
  const index = tx.store.index('userId');
  const rows = await index.getAll(userId);
  await tx.done;
  // rows는 { id, userId, role, content, createdAt } 형태의 리스트
  // 시간순 정렬
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function addMessage(userId, role, content) {
  const db = await getDB();
  const now = Date.now();
  await db.add(STORE, { userId, role, content, createdAt: now });
}

export async function clearUserMessages(userId) {
  const db = await getDB();
  const tx = db.transaction(STORE, 'readwrite');
  const index = tx.store.index('userId');
  let cursor = await index.openCursor(userId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}
