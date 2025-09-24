'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getHistoryById, saveHistory } from '../../lib/db';
import styles from '../chatbot.module.css';

const fixedFlow = [
  "안녕하세요! 펠드만 비평(설명→분석→해석→판단)으로 감상을 이제부터 시작해볼게요. 가장 먼저 작품을 한 문장으로 묘사해 주세요.",
  "분석 단계입니다. 작품을 분석해 보세요.",
  "이제 해석 단계입니다. 작품을 해석해 보세요.",
  "마지막 단계! 답변을 바탕으로 판단해 보세요.",
  "고생하셨습니다, 이제 챗봇 사용 경험에 대해 연구원의 질문에 따라 알려주시면 됩니다. "
];

export default function ChatbotA() {
  const searchParams = useSearchParams();
  const historyId = searchParams.get('history');

  const [step, setStep] = useState(1);
  const [messages, setMessages] = useState([
    { role: "assistant", content: fixedFlow[0] }  // 🔹 첫 인삿말 자동 출력
  ]);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (!historyId) return;
    (async () => {
      const h = await getHistoryById(Number(historyId));
      if (h) setMessages(h.messages);
    })();
  }, [historyId]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { role: 'user', content: input.trim() };
    setMessages([...messages, userMsg, { role: 'assistant', content: fixedFlow[step] }]);
    setInput('');
    setStep(step + 1);
  };

  const handleSave = async () => {
    await saveHistory("A타입 대화", messages, "a");
    // 🔹 Sidebar에 업데이트 신호 보내기
    window.dispatchEvent(new Event("history-saved"));
    // 🔹 TXT 파일 다운로드 기능
  const textContent = messages.map(m => `[${m.role}] ${m.content}`).join("\n\n");
  const blob = new Blob([textContent], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "chat-history-a.txt";
  a.click();
  URL.revokeObjectURL(url);

  alert("채팅 기록이 저장되고, 파일이 다운로드되었습니다 ✅");
  };

  return (
    <main className={styles.chat} style={{ position: 'relative' }}>
      <h1 className={styles.title}>A타입 챗봇</h1>
  
      {/* ✅ 항상 오른쪽 상단에 보이는 버튼 */}
      <button onClick={handleSave} className={styles.saveBtnFixed}>
        채팅 기록 저장
      </button>
  
      <div className={styles.chatBox}>
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
  
      {/* 기존 form 유지 */}
      {step < fixedFlow.length && (
        <form onSubmit={handleSend} className={styles.form}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="답변을 입력하세요..."
            className={styles.input}
          />
          <button className={styles.button}>보내기</button>
        </form>
      )}
    </main>
  );
}
