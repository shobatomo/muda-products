import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
    subsets: ["latin"],
    weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
    title: "MUDA PRODUCTS",
    description:
        "無駄にいい。無駄がいい。　毎日使う道具に、必要以上のこだわりを。効率では測れない、所有する喜びを届けます。",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ja">
            <body className={notoSansJP.className}>{children}</body>
        </html>
    );
}
