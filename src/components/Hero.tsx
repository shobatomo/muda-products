import { ProductScene } from "./ProductScene";

export function Hero() {
    return (
        <section className="min-h-screen bg-[#f1f0ec]">
            <div className="mx-auto grid min-h-screen max-w-[1440px] grid-cols-1 items-center gap-12 px-6 pb-12 pt-28 md:px-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:px-16 lg:pb-16 lg:pt-24">
                <div className="flex flex-col items-start">
                    <p className="mb-6 text-xs tracking-[0.28em] text-black/55">
                        MUDA PRODUCTS
                    </p>

                    <h1 className="max-w-xl text-5xl font-medium leading-[1.05] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
                        無駄にいい。
                        <br />
                        無駄がいい。
                    </h1>

                    <p className="mt-8 max-w-md text-sm leading-7 text-black/60 md:text-base">
                        毎日使う道具に、必要以上のこだわりを。
                        <br />
                        効率では測れない、所有する喜びを届けます。
                    </p>

                    <a
                        href="#collection"
                        className="group mt-10 inline-flex items-center gap-4 border-b border-black pb-2 text-xs font-medium tracking-[0.2em]"
                    >
                        EXPLORE COLLECTION
                        <span
                            aria-hidden="true"
                            className="transition-transform duration-300 group-hover:translate-x-1"
                        >
                            →
                        </span>
                    </a>
                </div>

                <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-sm bg-[#e6e4de] lg:min-h-[680px]">
                    <div className="relative h-[420px] overflow-hidden rounded-sm bg-[#e6e4de] lg:h-[680px] w-full">
                        <ProductScene />

                        <div className="pointer-events-none absolute left-6 top-6 z-10 text-[10px] tracking-[0.2em] text-black/40">
                            INTERACTIVE OBJECT
                        </div>

                        <div className="pointer-events-none absolute bottom-6 right-6 z-10 text-[10px] tracking-[0.2em] text-black/40">
                            DRAG TO ROTATE
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
