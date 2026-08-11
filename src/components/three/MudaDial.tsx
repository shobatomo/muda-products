"use client";

import { useGLTF } from "@react-three/drei";

// Dialを表示するための関数
export function MudaDial() {
    const { scene } = useGLTF("/models/muda-dial-optimized.glb");
    return <primitive object={scene} position={[0, 0, 0]} scale={[1, 1, 1]} />;
}

useGLTF.preload("/models/muda-dial-optimized.glb");
