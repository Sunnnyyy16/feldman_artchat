'use client';
import { useEffect, useState, useRef } from 'react';
import { saveHistory } from '../../lib/db';
import styles from '../chatbot.module.css';

export default function ChatbotB() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        '안녕하세요! 펠드만 비평(설명→분석→해석→판단)으로 감상을 도와드릴게요. 작품을 한 문장으로 묘사해 주시겠어요?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMsg, { role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages.filter((m) => m.role !== 'assistant' || m.content !== ''), userMsg],
        }),
      });

      if (!res.body) throw new Error('스트림이 비었습니다.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let acc = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });

        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: acc };
          return copy;
        });

        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `오류가 발생했어요: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ⬇️ "채팅 기록 저장" 버튼 동작
  const handleSave = async () => {
    await saveHistory('B타입 대화', messages, 'b');
    alert('채팅 기록이 저장되었습니다 ✅');
  };

  return (
    <main className={styles.chat} style={{ position: 'relative' }}>
      <h1 className={styles.title}>B타입 챗봇</h1>
  
      {/* ✅ 항상 오른쪽 상단에 보이는 버튼 */}
      <button onClick={handleSave} className={styles.saveBtnFixed}>
        채팅 기록 저장
      </button>
  
      <div ref={listRef} className={styles.chatBox}>
        {messages.map((m, i) => (
          <div
            key={i}
            className={`${styles.messageRow} ${
              m.role === 'user' ? styles.right : styles.left
            }`}
          >
            <div
              className={m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>
  
      <form onSubmit={send} className={styles.form}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="작품에 보이는 것들을 먼저 설명해 주세요."
          className={styles.input}
        />
        <button
          disabled={loading}
          className={`${styles.button} ${loading ? styles.disabled : ''}`}
        >
          {loading ? '생성 중…' : '보내기'}
        </button>
      </form>
    </main>
  );  
}
