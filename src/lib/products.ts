export const products = [
    {
        slug: "dial",
        name: "DIAL",
        image: "/images/products/dial.png",
        imageAlt: "金属のボディと差し色の PIN を備えた DIAL",
        price: "¥12,800",
        specs: [
            ["サイズ", "約 Ø60 × H28 mm"],
            ["素材", "アルミニウム、チタン、樹脂"],
            ["機能", "ダイヤル回転、ラチェット機構"],
            ["特長", "金属製ボディ、中央プレート、アクセント PIN"],
        ],
    },
    {
        slug: "key",
        name: "KEY",
        image: "/images/products/key-v1.0.png",
        imageAlt: "KEY v1.0 のロゴ入りキーキャップとハウジング",
        price: "¥6,800",
        specs: [
            ["サイズ", "約 W30 × D30 × H25 mm"],
            ["素材", "アルミニウム、樹脂"],
            ["機能", "ドラッグ押下、リリース復帰（試作）"],
            ["特長", "ロゴ入りキャップと赤い軸が連動。ばね・音は制作予定"],
        ],
    },
] as const;

export type Product = (typeof products)[number];
export type ProductSlug = Product["slug"];
export const prototypeNotice = "表示価格・仕様は仮です。販売はしていません。";
