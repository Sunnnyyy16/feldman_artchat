'use client';
import { usePathname } from 'next/navigation';
import Sidebar from '../components/Sidebar';
import styles from './chatbot.module.css';

export default function ChatbotLayout({ children }) {
  const pathname = usePathname();
  const type = pathname.includes('/chatbot/a') ? 'a' : 'b';

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <Sidebar type={type} />
      </aside>
      <main className={styles.chat}>{children}</main>
    </div>
  );
}
