'use client';
import Link from "next/link";
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.container}>
      <h1 className={styles.title}>Feldman ArtChat</h1>
      <p className={styles.description}>
        Edmund Feldman의 4단계 미술 비평 방법 
        <br /> &quot;묘사(Description) → 분석(Analysis) → 해석(Interpretation) → 판단(Judgement)&quot; 에 기반한
        <br /> 작품 감상 도우미 챗봇
      </p>

      {/* Feldman 미술 비평 compact 설명 (제목 제거 버전) */}
      <section style={{ margin: "2rem 0", textAlign: "center" }}>
        <p style={{ lineHeight: "1.6" }}>
          이제부터 Feldman 비평을 통해 작품을 감상해볼거에요. <br />
          작품을 감상할 때는 <strong>4 가지 단계</strong>를 거칩니다.<br />
          <strong>① 묘사(Description)</strong> – 작품에 보이는 것을 객관적으로 묘사<br />
          <strong>② 분석(Analysis)</strong> – 색채·형태·구도의 관계 살펴보기<br />
          <strong>③ 해석(Interpretation)</strong> – 작가의 의도와 의미 추론<br />
          <strong>④ 판단(Judgement)</strong> – 작품의 가치와 의미 평가

          연구원에 안내에 따라 아래 2가지 Type 중 1개를 선택해주세요. 
        </p>
      </section>

      <div className={styles.buttonGroup}>
        <Link href="/chatbot/a" className={styles.button}>Type A</Link>
        <Link href="/chatbot/b" className={styles.button}>Type B</Link>
      </div>
    </main>
  );
}
