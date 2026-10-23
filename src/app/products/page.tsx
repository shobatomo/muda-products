import type { Metadata } from "next";
import { ProductCollection } from "@/components/catalog/ProductCollection";

export const metadata: Metadata = { title: "COLLECTION | MUDA PRODUCTS" };
export default function ProductsPage() {
    return <main><ProductCollection /></main>;
}
