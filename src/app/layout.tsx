import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

const notoSansJP = Noto_Sans_JP({
    subsets: ["latin"],
    weight: ["400", "500", "700"],
    variable: "--font-notoSansJP",
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
