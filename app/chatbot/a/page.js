'use client';
import { useState } from "react";
import styles from '../chatbot.module.css';

const fixedFlow = [
  "안녕하세요! 펠드만 비평(설명→분석→해석→판단)으로 감상을 도와드릴게요. 작품을 한 문장으로 묘사해 주시겠어요?",
  "분석 과정 해볼게요. 작품을 분석해보세요",
  "작품을 해석해보세요",
  "이제 이전까지 했던 답변들을 바탕으로 작품에 대해 판단을 해보세요"
];

export default function ChatbotA() {
  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState([
    { role: "assistant", content: fixedFlow[0] }
  ]);
  const [input, setInput] = useState("");

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // 사용자 메시지 추가
    const userMsg = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");

    // 다음 단계 메시지 추가
    if (step + 1 < fixedFlow.length) {
      const nextBotMsg = { role: "assistant", content: fixedFlow[step + 1] };
      setMessages([...newMessages, nextBotMsg]);
      setStep(step + 1);
    }
  };

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>A: Feldman Critique Chatbot</h1>
      <div className={styles.chatBox}>
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
      {step < fixedFlow.length ? (
        <form onSubmit={handleSend} className={styles.form}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="답변을 입력하세요..."
            className={styles.input}
          />
          <button className={styles.button}>보내기</button>
        </form>
      ) : (
        <p className={styles.tip}>모든 단계가 완료되었습니다 🎉</p>
      )}
    </main>
  );
}
