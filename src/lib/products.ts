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
        image: "/images/products/key-blockout.png",
        imageAlt: "KEY の制作中の単色形状確認モデル",
        price: "¥6,800",
        specs: [
            ["サイズ", "約 W30 × D30 × H25 mm"],
            ["素材", "アルミニウム、樹脂"],
            ["機能", "キー押下（制作中）"],
            ["特長", "キーキャップ、軸、ベースの単独キー構成"],
        ],
    },
] as const;

export type Product = (typeof products)[number];
export type ProductSlug = Product["slug"];
export const prototypeNotice = "表示価格・仕様は仮です。販売はしていません。";
