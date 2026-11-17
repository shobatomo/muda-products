import type { Metadata } from "next";
import Link from "next/link";
import { KeyScene } from "@/components/KeyScene";

export const metadata: Metadata = { title: "KEY 赤軸プレビュー | MUDA PRODUCTS" };

export default function KeyPage() {
    return <main className="min-h-screen bg-[#f7f7f5] px-6 py-10 text-[#171717] md:px-10">
        <div className="mx-auto max-w-6xl">
            <Link href="/products/key" className="text-sm underline underline-offset-4">← KEY 商品ページ</Link>
            <h1 className="mt-8 text-3xl font-medium">KEY 赤軸プレビュー</h1>
            <p className="mb-6 mt-3 text-sm leading-7 text-[#5d5b55]">キーキャップを下へドラッグして、離す。周囲をドラッグすると回転できます。<br />v1.1 モデルのキーキャップと軸が一緒に動きます。素材の細かな質感・ばね・音は今後調整予定です。</p>
            <KeyScene />
        </div>
    </main>;
}
