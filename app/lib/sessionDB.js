import { openDB } from 'idb';

const DB_NAME = 'feldman_chat_db';
const SESSION_STORE = 'sessions';

export async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

export async function getAllSessions(type) {
  const db = await getDB();
  const all = await db.getAll(SESSION_STORE);
  return all.filter((s) => s.type === type);
}

export async function createSession(type) {
  const db = await getDB();
  const now = new Date().toLocaleString();
  await db.add(SESSION_STORE, { title: `새 대화 (${now})`, type });
}

export async function updateSessionTitle(id, newTitle) {
    const db = await getDB();
    const session = await db.get(SESSION_STORE, id);
    if (session) {
      session.title = newTitle;
      await db.put(SESSION_STORE, session);
    }
  }
  
