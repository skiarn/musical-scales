"use client";

import styles from "./page.module.css";
import DataView from "./components/DataView";

export default function Home() {
  return (
    <div className={styles.page}>
       
      <main className={styles.main}>
        <DataView></DataView>
      </main>
      <footer className={styles.footer}>
        Sounds Good
      </footer>
    </div>
  );
}
