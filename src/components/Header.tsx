import Link from "next/link";

export function Header() {
    return (
        <header className="absolute left-0 top-0 z-10 w-full">
            <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-6 md:px-10 lg:px-16">
                <Link
                    href="/"
                    className="text-lg font-semibold tracking-[0.3em]"
                >
                    MUDA
                </Link>

                <nav aria-label="メインナビゲーション">
                    <ul className="flex items-center gap-6 text-xs tracking-[0.15em] md:gap-10">
                        <li>
                            <a
                                href="#collection"
                                className="transition-opacity hover:opacity-50"
                            >
                                COLLECTION
                            </a>
                        </li>

                        <li>
                            <button
                                type="button"
                                className="transition-opacity hover:opacity-50"
                            >
                                CART (0)
                            </button>
                        </li>
                    </ul>
                </nav>
            </div>
        </header>
    );
}
