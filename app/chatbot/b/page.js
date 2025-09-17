'use client';

import { useRef, useState } from 'react';
import styles from '../chatbot.module.css';

export default function Home() {
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
    const userMsg = { role: 'user', content: input.trim() };
    if (!userMsg.content) return;

    setMessages((prev) => [...prev, userMsg, { role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages.filter(m => m.role !== 'assistant' || m.content !== ''), userMsg],
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
          const lastIdx = copy.length - 1;
          copy[lastIdx] = { role: 'assistant', content: acc };
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

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>B: Feldman Critique Chatbot</h1>

      <div ref={listRef} className={styles.chatBox}>
        {messages.map((m, i) => (
          <div
            key={i}
            className={`${styles.messageRow} ${m.role === 'user' ? styles.right : styles.left}`}
          >
            <div className={m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}>
              {m.content}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={send} className={styles.form}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="작품에 보이는 것들을 먼저 ‘설명’해 주세요."
          className={styles.input}
        />
        <button disabled={loading} className={`${styles.button} ${loading ? styles.disabled : ''}`}>
          {loading ? '생성 중…' : '보내기'}
        </button>
      </form>

      <p className={styles.tip}>
        Tip: 1) 설명 → 2) 분석 → 3) 해석 → 4) 판단 순서로 짧게 대답하면 챗봇이 다음 질문을 이어가요.
      </p>
    </main>
  );
}
