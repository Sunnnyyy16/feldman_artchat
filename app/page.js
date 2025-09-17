'use client';
import Link from "next/link";
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.container}>
      <h1 className={styles.title}>Feldman 미술 비평 도우미</h1>
      <p className={styles.description}>
        Edmund Feldman의 4단계 미술 비평 방법 
        <br /> (설명 → 분석 → 해석 → 판단) 에 기반한
        <br /> 작품 감상 도우미 챗봇
      </p>

      <div className={styles.buttonGroup}>
        <Link href="/chatbot/a" className={styles.button}>Type A</Link>
        <Link href="/chatbot/b" className={styles.button}>Type B</Link>
      </div>
    </main>
  );
}
