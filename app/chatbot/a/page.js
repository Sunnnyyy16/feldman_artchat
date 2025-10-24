'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getHistoryById, saveHistory } from '../../lib/db';
import styles from '../chatbot.module.css';

const fixedFlow = [
  "안녕하세요! 펠드만 비평(설명→분석→해석→판단)으로 작품 감상을 시작해볼게요. 가장 먼저 1단계, 묘사(Description)입니다. 연구원에게 안내받은 작품에서 무엇이 보이나요? 객관적으로 보이는 시각적 특징을 알려주세요.",
  "2단계, 분석(Analysis) 단계입니다. 작가는 어떤 색이나 구성으로 시선이 집중되게 만든 것 같나요? 색채의 사용은 어떤가요?",
  "3단계, 해석(Interpretation) 단계입니다. 이 작품은 무엇을 의미한다고 생각하나요? 작가는 무엇을 전달하려고 했을까요?",
  "마지막! 4단계, 판단(Judgement) 단계입니다. 지금까지의 답변을 바탕으로 작품의 전반적인 강점이나 가치가 어떤지 알려주세요.",
  "고생하셨습니다, 이제 챗봇 사용 경험에 대해 연구원이 몇가지 질문드릴 건데 답해주시면 됩니다. "
];

function ChatbotAInner() {
  const searchParams = useSearchParams();
  const historyId = searchParams.get('history');

  const [step, setStep] = useState(1);
  const [messages, setMessages] = useState([
    { role: "assistant", content: fixedFlow[0] } // 첫 인삿말 자동 출력
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
    window.dispatchEvent(new Event("history-saved"));

    // TXT 파일 다운로드 기능
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
      <h1 className={styles.title}>Type A Chatbot</h1>

      <button onClick={handleSave} className={styles.saveBtnFixed}>
        채팅 기록 저장
      </button>

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

export default function ChatbotA() {
  // ✅ Suspense로 감싸 useSearchParams 안전하게 처리
  return (
    <Suspense fallback={<div>로딩 중...</div>}>
      <ChatbotAInner />
    </Suspense>
  );
}
