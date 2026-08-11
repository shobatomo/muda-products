"use client";

import { useGLTF } from "@react-three/drei";

export function MudaDial() {
    const { scene } = useGLTF("/models/muda-dial.glb");
    return <primitive object={scene} />;
}

useGLTF.preload("/models/muda-dial.glb");
