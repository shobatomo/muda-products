import Link from "next/link";
import { prototypeNotice } from "@/lib/products";
import styles from "@/components/catalog/Catalog.module.css";

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
    return <div className={styles.shell}>
        <header className={styles.header}>
            <Link className={styles.brand} href="/" prefetch={false}>MUDA PRODUCTS</Link>
            <nav className={styles.nav} aria-label="メインナビゲーション">
                <Link href="/" prefetch={false}>TOP</Link>
                <Link href="/products">COLLECTION</Link>
            </nav>
        </header>
        {children}
        <footer className={styles.footer}>{prototypeNotice}</footer>
    </div>;
}
