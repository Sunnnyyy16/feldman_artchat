'use client';
import { useEffect, useState } from 'react';
import { getAllHistories, updateSessionTitle, createSession } from '../lib/db';
import styles from '../chatbot/chatbot.module.css';
import { useRouter } from 'next/navigation';

export default function Sidebar() {
  const [histories, setHistories] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [tempTitle, setTempTitle] = useState('');
  const router = useRouter();

  const loadHistories = async () => {
    const list = await getAllHistories();
    setHistories(list);
  };

  useEffect(() => {
    loadHistories();

    // "채팅 기록 저장" 이벤트 감지
    const handler = () => loadHistories();
    window.addEventListener('history-saved', handler);

    return () => {
      window.removeEventListener('history-saved', handler);
    };
  }, []);

  const handleClick = (h) => {
    // 저장된 히스토리 불러오기만 (읽기 전용)
    router.push(`/chatbot/${h.type}?history=${h.id}`);
  };

  const handleEdit = (h) => {
    setEditingId(h.id);
    setTempTitle(h.title);
  };

  const handleSaveTitle = async (id) => {
    if (tempTitle.trim()) {
      await updateSessionTitle(id, tempTitle.trim());
      await loadHistories();
    }
    setEditingId(null);
  };

  const handleNewSession = async (type) => {
    // 새 채팅 시작 (빈 기록 저장)
    await createSession(type);
    await loadHistories();
  };

  return (
    <div className={styles.sidebarWrapper}>
      <div className={styles.sidebarHeader}>
        <h2 className={styles.sidebarTitle}>Chat history</h2>
        {/* 새 채팅 시작 버튼 */}
        <button onClick={() => handleNewSession('a')} className={styles.newSessionBtn}>
          +
        </button>
      </div>

      <div className={styles.sessionList}>
        {histories.map((h) => (
          <div key={h.id} className={styles.sessionItem}>
            {editingId === h.id ? (
              <input
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={() => handleSaveTitle(h.id)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle(h.id)}
                autoFocus
                className={styles.sessionInput}
              />
            ) : (
              <span onClick={() => handleClick(h)} className={styles.sessionLink}>
                {h.title}
              </span>
            )}
            {editingId !== h.id && (
              <button onClick={() => handleEdit(h)} className={styles.editBtn}>
                ✏️
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
