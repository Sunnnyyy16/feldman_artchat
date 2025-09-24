'use client';
import { useState, useRef } from 'react';
import { saveHistory } from '../../lib/db';
import styles from '../chatbot.module.css';

export default function ChatbotB() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      type: 'text',
      content:
        '안녕하세요! 펠드만 비평(설명→분석→해석→판단)으로 감상을 도와드릴게요. 작품을 한 문장으로 묘사해 주시겠어요?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null); // base64 저장
  const listRef = useRef(null);

  // ✅ 파일을 base64 Data URL로 변환
  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim() && !image) return;

    // ✅ 텍스트+이미지 하나의 메시지로 합치기
    const contentArr = [];
    if (input.trim()) {
      contentArr.push({ type: 'text', text: input.trim() });
    }
    if (image) {
      contentArr.push({ type: 'image_url', image_url: { url: image } });
    }

    const userMsg = { role: 'user', type: 'mixed', content: contentArr };

    // state에 반영
    setMessages((prev) => [...prev, userMsg, { role: 'assistant', type: 'text', content: '' }]);
    setInput('');
    setImage(null);
    setLoading(true);

    try {
      const payloadMessages = [
        ...messages.filter((m) => m.role !== 'assistant' || m.content !== ''),
        userMsg,
      ];

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payloadMessages }),
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
          copy[copy.length - 1] = { role: 'assistant', type: 'text', content: acc };
          return copy;
        });

        listRef.current?.scrollTo({
          top: listRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', type: 'text', content: `오류가 발생했어요: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const base64 = await toBase64(file);
      setImage(base64);
    }
  };

  const handleSave = async () => {
    await saveHistory('B타입 대화', messages, 'b');
    alert('채팅 기록이 저장되었습니다 ✅');
  };

  return (
    <main className={styles.chat} style={{ position: 'relative' }}>
      <h1 className={styles.title}>B타입 챗봇</h1>
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
            {/* ✅ 혼합 메시지 처리 */}
            {Array.isArray(m.content) ? (
              <div className={m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}>
                {m.content.map((c, j) =>
                  c.type === 'text' ? (
                    <p key={j}>{c.text}</p>
                  ) : (
                    <img
                      key={j}
                      src={c.image_url.url}
                      alt="첨부 이미지"
                      className={styles.chatImage}
                    />
                  )
                )}
              </div>
            ) : m.type === 'image' ? (
              <img src={m.content} alt="첨부 이미지" className={styles.chatImage} />
            ) : (
              <div
                className={m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}
              >
                {m.content}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ✅ 입력 폼: + 버튼으로 파일 첨부 */}
      <form onSubmit={send} className={styles.form}>
        <input
          id="fileInput"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          onClick={() => document.getElementById('fileInput').click()}
          className={styles.attachBtn}
        >
          +
        </button>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="메시지를 입력하세요..."
          className={styles.input}
        />
        <button
          disabled={loading}
          className={`${styles.button} ${loading ? styles.disabled : ''}`}
        >
          {loading ? '생성 중…' : '보내기'}
        </button>
      </form>

      {/* ✅ 이미지 미리보기 */}
      {image && (
        <div className={styles.previewBox}>
          <p>첨부된 이미지:</p>
          <img src={image} alt="미리보기" className={styles.previewImage} />
        </div>
      )}
    </main>
  );
}
