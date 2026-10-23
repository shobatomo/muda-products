"use client";

import { useGLTF } from "@react-three/drei";

export function MudaKey() {
    // 非圧縮GLB。元の階層・位置・スケール・材質をそのまま使用する。
    const { scene } = useGLTF("/models/muda-key-blockout.glb", false);

    return <primitive object={scene} dispose={null} />;
}
