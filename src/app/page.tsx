import { PageIntro } from "@/components/PageIntro";
import { ProductCollection } from "@/components/catalog/ProductCollection";

export default function Home() {
    return (
        <main>
            <PageIntro />
            <ProductCollection embedded />
        </main>
    );
}
