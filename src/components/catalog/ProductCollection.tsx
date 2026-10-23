import Image from "next/image";
import Link from "next/link";
import { products } from "@/lib/products";
import styles from "./Catalog.module.css";

export function ProductCollection({ embedded = false }: { embedded?: boolean }) {
    const SectionHeading = embedded ? "h2" : "h1";
    const ProductHeading = embedded ? "h3" : "h2";
    // The existing HERO uses a native hash link. A document navigation keeps Back
    // reliable from that history entry without changing the protected HERO/router.
    const ProductLink = embedded ? "a" : Link;
    return (
        <section id="collection" className={styles.shell} aria-labelledby="collection-title">
            <div className={styles.content}>
                <SectionHeading id="collection-title" className={styles.heading}>COLLECTION</SectionHeading>
                <ul className={styles.grid}>
                    {products.map((product) => (
                        <li key={product.slug}>
                            <ProductLink className={styles.card} href={`/products/${product.slug}`}>
                                <Image className={styles.image} src={product.image} alt={product.imageAlt} width={1000} height={1000} sizes="(max-width: 760px) 45vw, 44vw" />
                                <ProductHeading className={styles.cardName}>{product.name}</ProductHeading>
                            </ProductLink>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
