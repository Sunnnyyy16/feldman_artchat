'use client';
import { useEffect, useState } from 'react';
import styles from '../chatbot/chatbot.module.css';
import Link from 'next/link';
import { getAllSessions, createSession, updateSessionTitle } from '../lib/sessionDB';

export default function Sidebar({ type }) {
  const [sessions, setSessions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [tempTitle, setTempTitle] = useState('');

  useEffect(() => {
    loadSessions();
  }, [type]);

  const loadSessions = async () => {
    setSessions(await getAllSessions(type));
  };

  const handleNewSession = async () => {
    await createSession(type);
    loadSessions();
  };

  const handleEdit = (session) => {
    setEditingId(session.id);
    setTempTitle(session.title);
  };

  const handleSave = async (id) => {
    if (tempTitle.trim()) {
      await updateSessionTitle(id, tempTitle.trim());
      await loadSessions();
    }
    setEditingId(null);
  };

  return (
    <div className={styles.sidebarWrapper}>
      <div className={styles.sidebarHeader}>
        <h2 className={styles.sidebarTitle}>Chat history</h2>
        <button onClick={handleNewSession} className={styles.newSessionBtn}>
          +
        </button>
      </div>

      <div className={styles.sessionList}>
        {sessions.map((s) => (
          <div key={s.id} className={styles.sessionItem}>
            {editingId === s.id ? (
              <input
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={() => handleSave(s.id)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave(s.id)}
                autoFocus
                className={styles.sessionInput}
              />
            ) : (
              <Link href={`/chatbot/${type}?session=${s.id}`} className={styles.sessionLink}>
                {s.title}
              </Link>
            )}
            {editingId !== s.id && (
              <button onClick={() => handleEdit(s)} className={styles.editBtn}>
                ✏️
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
