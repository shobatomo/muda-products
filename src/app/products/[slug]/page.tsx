import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { products } from "@/lib/products";
import { ProductExperience } from "@/components/catalog/ProductExperience";
import styles from "@/components/catalog/Catalog.module.css";

export function generateStaticParams() { return products.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const product = products.find((item) => item.slug === slug);
    return { title: `${product?.name ?? "商品が見つかりません"} | MUDA PRODUCTS` };
}
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const product = products.find((item) => item.slug === slug);
    if (!product) notFound();
    return <main className={styles.content}>
        <nav className={styles.breadcrumb} aria-label="パンくずリスト">
            <Link href="/products">COLLECTION</Link><span aria-hidden="true">/</span><span aria-current="page">{product.name}</span>
        </nav>
        <div className={styles.detail}>
            <ProductExperience product={product} />
            <div className={styles.information}>
                <h1 className={styles.title}>{product.name}</h1>
                <p className={styles.price}><span>参考価格</span>{product.price}</p>
                <dl className={styles.specs}>{product.specs.map(([label, value]) => <div className={styles.spec} key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
                {product.slug === "key" && <p className={styles.status}>制作中のモデルです。3D では形状を確認できます。押下・音・素材切替は未実装です。</p>}
                <Link className={styles.back} href="/products">← 商品一覧</Link>
            </div>
        </div>
    </main>;
}
