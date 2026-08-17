"use client";

import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useRef } from "react";

const ROTATION_SENSITIVITY = 0.01;

// Dialを表示するための関数
export function MudaDial() {
    const { scene } = useGLTF("/models/muda-dial-optimized.glb");
    const canvas = useThree((state) => state.gl.domElement);

    // Dial全体を操作するためのRefを作成
    const dialGroupRef = useRef<THREE.Group>(null);
    // 操作中のポインターIDを保持するRefを作成
    const activePointerIdRef = useRef<number | null>(null);
    // 前回のポインターのX座標を保持するRefを作成
    const previousPointerXRef = useRef(0);

    useEffect(() => {
        scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                // 中心のチタンの質感を個別に設定
                if (
                    child instanceof THREE.Mesh &&
                    child.material.name === "MAT_CenterPlate_Titanium"
                ) {
                    child.material.metalness = 1;
                    child.material.roughness = 0.3;
                    child.material.anisotropy = 1;
                    child.material.anisotropyRotation = 0;
                }

                // 内容物の情報をコンソールに出力：確認用
                // const materials = Array.isArray(child.material)
                //     ? child.material
                //     : [child.material];

                // materials.forEach((material) => {
                //     console.log({
                //         mesh: child.name,
                //         material: material.name,
                //         type: material.type,
                //         roughness: material.roughness,
                //         metalness: material.metalness,
                //         roughnessMap: material.roughnessMap,
                //         normalMap: material.normalMap,
                //         anisotropy: material.anisotropy,
                //         anisotropyMap: material.anisotropyMap,
                //         anisotropyRotation: material.anisotropyRotation,
                //     });
                // });
            }
        });
    }, [scene]);

    useEffect(() => {
        const finishDragging = (pointerId: number) => {
            if (activePointerIdRef.current !== pointerId) {
                return false;
            }

            activePointerIdRef.current = null;

            if (canvas.hasPointerCapture(pointerId)) {
                canvas.releasePointerCapture(pointerId);
            }

            return true;
        };

        const handlePointerMove = (event: PointerEvent) => {
            if (activePointerIdRef.current !== event.pointerId) {
                return;
            }

            // pointerupを取りこぼした場合でも、ボタンが離れていれば終了する
            if (event.pointerType === "mouse" && (event.buttons & 1) === 0) {
                finishDragging(event.pointerId);
                return;
            }

            const deltaX = event.clientX - previousPointerXRef.current;

            if (dialGroupRef.current) {
                dialGroupRef.current.rotation.y +=
                    deltaX * ROTATION_SENSITIVITY;
            }

            previousPointerXRef.current = event.clientX;
        };

        const handlePointerUp = (event: PointerEvent) => {
            if (finishDragging(event.pointerId)) {
                console.log("Pointer Up");
            }
        };

        const handlePointerCancel = (event: PointerEvent) => {
            finishDragging(event.pointerId);
        };

        const handleWindowBlur = () => {
            const pointerId = activePointerIdRef.current;

            if (pointerId !== null) {
                finishDragging(pointerId);
            }
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", handlePointerCancel);
        window.addEventListener("blur", handleWindowBlur);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", handlePointerCancel);
            window.removeEventListener("blur", handleWindowBlur);

            const pointerId = activePointerIdRef.current;

            if (pointerId !== null && canvas.hasPointerCapture(pointerId)) {
                canvas.releasePointerCapture(pointerId);
            }

            activePointerIdRef.current = null;
        };
    }, [canvas]);

    // ポインターが押されたときのイベントハンドラーを定義
    const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
        if (event.button !== 0 || activePointerIdRef.current !== null) {
            return;
        }

        // ドラッグ中のイベントが伝播しないようにする
        event.stopPropagation();
        // 操作中のポインターIDを保持
        activePointerIdRef.current = event.pointerId;
        // ポインターのX座標を更新
        previousPointerXRef.current = event.clientX;
        // Canvas外へドラッグしてもポインターイベントを受け取る
        canvas.setPointerCapture(event.pointerId);

        console.log("Pointer Down");
    };

    return (
        <group
            ref={dialGroupRef}
            position={[0, 0.01, 0]}
            onPointerDown={handlePointerDown}
        >
            <primitive object={scene} scale={[1, 1, 1]} />
        </group>
    );
}

useGLTF.preload("/models/muda-dial-optimized.glb");
