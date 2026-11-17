"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/products";
import { prepareDialAudio, type DialAudio } from "@/lib/dial-audio";
import { TouchModal } from "./TouchModal";
import styles from "./Catalog.module.css";

const DialViewer = dynamic(() => import("./DialViewer"), { ssr: false, loading: () => <p role="status">3D を読み込み中…</p> });
const KeyViewer = dynamic(() => import("./KeyViewer"), { ssr: false, loading: () => <p role="status">3D を読み込み中…</p> });

export function ProductExperience({ product }: { product: Product }) {
    const [session, setSession] = useState<{ audio: DialAudio | null } | null>(null);
    const audioRef = useRef<DialAudio | null>(null);
    useEffect(() => () => audioRef.current?.dispose(), []);

    function show() {
        if (session) return;
        const audio = product.slug === "dial" ? prepareDialAudio() : null;
        audioRef.current = audio;
        setSession({ audio });
    }
    function close() {
        audioRef.current?.dispose();
        audioRef.current = null;
        setSession(null);
    }

    return <div className={styles.media}>
        <Image src={product.slug === "key" ? "/images/products/key-v1.0-front.png" : product.image} alt={product.imageAlt} width={1000} height={1000} className={styles.image} sizes="(max-width: 760px) 100vw, 55vw" preload />
        <button className={styles.touch} onClick={show} aria-haspopup="dialog">触ってみる <span aria-hidden="true">↗</span></button>
        {session && <TouchModal name={product.name} onClose={close} audio={session.audio}>
            {product.slug === "dial" ? <DialViewer audio={session.audio} /> : <KeyViewer />}
        </TouchModal>}
    </div>;
}
