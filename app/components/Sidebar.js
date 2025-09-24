'use client';
import { useEffect, useState } from 'react';
import { getAllHistories, updateSessionTitle, createSession } from '../lib/db';
import styles from '../chatbot/chatbot.module.css';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Sidebar() {
  const [histories, setHistories] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [tempTitle, setTempTitle] = useState('');
  const [open, setOpen] = useState(false); // ✅ 항상 토글로 관리
  const router = useRouter();

  const loadHistories = async () => {
    const list = await getAllHistories();
    setHistories(list);
  };

  useEffect(() => {
    loadHistories();
    const handler = () => loadHistories();
    window.addEventListener('history-saved', handler);
    return () => window.removeEventListener('history-saved', handler);
  }, []);

  const handleClick = (h) => {
    router.push(`/chatbot/${h.type}?history=${h.id}`);
    setOpen(false); // ✅ 히스토리 클릭하면 자동 닫기
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
    await createSession(type);
    await loadHistories();
  };

  return (
    <>
      {/* 토글 버튼 */}
      <button
        className={styles.sidebarToggle}
        onClick={() => setOpen(!open)}
      >
        ☰
      </button>

      {/* Sidebar */}
      <div className={`${styles.sidebarWrapper} ${open ? styles.open : ''}`}>
        <div className={styles.sidebarHeader}>
          <Link href="/" className={styles.homeBtn}>
            Feldman ArtChat
          </Link>
          <button
            onClick={() => handleNewSession('a')}
            className={styles.newSessionBtn}
          >
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
                <span
                  onClick={() => handleClick(h)}
                  className={styles.sessionLink}
                >
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
    </>
  );
}
