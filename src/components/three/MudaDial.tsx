"use client";

import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useRef } from "react";

// ダイヤルの回転設定
const ROTATION_SENSITIVITY = 0.0028;
const FRICTION = 5.5;
const ROTATION_DAMPING = 12;
const RATCHET_STEP = Math.PI / 60;
const RATCHET_SHARPNESS = 15;

/** 現在角を最も近いラチェットの歯へ引き寄せる */
function applyRatchet(angle: number) {
    // 現在どの歯と歯の間にいるか
    const stepIndex = Math.floor(angle / RATCHET_STEP);
    // その区間の開始角度
    const stepStart = stepIndex * RATCHET_STEP;

    // 0~1の範囲で、歯と歯の間のどこにいるか
    const t = (angle - stepStart) / RATCHET_STEP;

    // 歯の近くではゆっくり
    // 中間を超えると次の歯へ一気に進む
    const eased =
        t < 0.5
            ? 0.5 * Math.pow(t * 2, RATCHET_SHARPNESS)
            : 1 - 0.5 * Math.pow((1 - t) * 2, RATCHET_SHARPNESS);

    return stepStart + eased * RATCHET_STEP;
}

// Dialを表示するための関数
export function MudaDial() {
    const { scene } = useGLTF("/models/muda-dial-optimized.glb");
    const canvas = useThree((state) => state.gl.domElement);

    // 3Dオブジェクト
    const dialGroupRef = useRef<THREE.Group>(null);
    const dialRef = useRef<THREE.Object3D | null>(null);

    // ポインター操作
    const activePointerIdRef = useRef<number | null>(null);
    const previousPointerXRef = useRef(0);
    const lastMoveTimeRef = useRef(0);
    const isDraggingRef = useRef(false);

    // 回転状態
    const targetRotationRef = useRef(0);
    const velocityRef = useRef(0);
    const lastRatchetIndexRef = useRef(0);

    // ポインターが押されたときにドラッグを開始する
    const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
        if (event.button !== 0 || activePointerIdRef.current !== null) {
            return;
        }

        event.stopPropagation();
        activePointerIdRef.current = event.pointerId;
        previousPointerXRef.current = event.clientX;
        lastMoveTimeRef.current = performance.now();
        isDraggingRef.current = true;

        // Canvas外へドラッグしてもポインターイベントを受け取る
        canvas.setPointerCapture(event.pointerId);
        console.log("Pointer Down", isDraggingRef.current);
    };

    // モデル内の操作対象とマテリアルを初期化する
    useEffect(() => {
        const dial = scene.getObjectByName("CTRL_Upper") ?? null;
        dialRef.current = dial;

        if (dial) {
            targetRotationRef.current = dial.rotation.y;
        } else {
            console.warn(
                "CTRL_Upperが見つかりません。ダイヤルを回転できません。",
            );
        }

        scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                // 中心のチタンの質感を個別に設定
                if (child.material.name === "MAT_CenterPlate_Titanium") {
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

        return function clearDialReference() {
            dialRef.current = null;
        };
    }, [scene]);

    // Canvas外で発生するドラッグイベントを監視する
    useEffect(() => {
        const finishDragging = (pointerId: number) => {
            if (activePointerIdRef.current !== pointerId) {
                return false;
            }

            activePointerIdRef.current = null;
            isDraggingRef.current = false;

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
            const rotationDelta = deltaX * ROTATION_SENSITIVITY;
            const now = performance.now();
            const deltaTime = (now - lastMoveTimeRef.current) / 1000;

            targetRotationRef.current += rotationDelta;

            previousPointerXRef.current = event.clientX;

            if (deltaTime > 0) {
                velocityRef.current = rotationDelta / deltaTime;
            }

            lastMoveTimeRef.current = now;
        };

        const handlePointerUp = (event: PointerEvent) => {
            if (finishDragging(event.pointerId)) {
                console.log("Pointer Up", isDraggingRef.current);
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
            isDraggingRef.current = false;
        };
    }, [canvas]);

    // 現在の回転角を毎フレーム目標角へ滑らかに近づける
    useFrame((_, delta) => {
        if (!dialRef.current) return;

        if (!isDraggingRef.current) {
            targetRotationRef.current += velocityRef.current * delta;

            velocityRef.current = THREE.MathUtils.damp(
                velocityRef.current,
                0,
                FRICTION,
                delta,
            );
        }

        const ratchetTarget = applyRatchet(targetRotationRef.current);

        // 現在地点の歯
        const ratchetIndex = Math.round(
            targetRotationRef.current / RATCHET_STEP,
        );

        // 直前の歯と違う歯を現時点で跨いでいるなら
        if (ratchetIndex !== lastRatchetIndexRef.current) {
            lastRatchetIndexRef.current = ratchetIndex;

            console.log("Click!");
        }

        dialRef.current.rotation.y = THREE.MathUtils.damp(
            dialRef.current.rotation.y,
            ratchetTarget,
            ROTATION_DAMPING,
            delta,
        );
    });

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
