import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useRef } from "react";

// 操作感に関わる値をまとめ、フレームごとの計算から分離する。
const ROTATION_SENSITIVITY = 0.0028;
const FRICTION = 15;
const ROTATION_DAMPING = 12;
const RATCHET_STEP = Math.PI / 60;
const RATCHET_SHARPNESS = 15;
const DIAL_BASE_POSITION = { x: 0, y: 0.01, z: 0 };
const VIBRATION_DAMPING = 25;
const VIBRATION_SPEED = 90;
const HINT_DELAY = 5000;
const INITIAL_HINT_DELAYS = [1000, 8000];
const HINT_DURATION = 1.2;
const HINT_ROTATION = THREE.MathUtils.degToRad(3);
const MAX_RATCHET_CLICKS_PER_FRAME = 4;
const MAX_PENDING_RATCHET_CLICKS = 8;
const RATCHET_CLICK_SPACING = 0.009;
const MAX_ANIMATION_DELTA = 1 / 30;
const OUTLINE_LAYERS = [
    { scale: 1.02, opacity: 0.25 },
    { scale: 1.029, opacity: 0.18 },
    { scale: 1.036, opacity: 0.1 },
    { scale: 1.045, opacity: 0.06 },
];
const GESTURE_THRESHOLD = 6;

type OutlineLayer = {
    mesh: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    baseOpacity: number;
};

function disposeOutlineLayers(layers: OutlineLayer[]) {
    layers.forEach(({ mesh, material }) => {
        mesh.removeFromParent();
        material.dispose();
    });
}

function playBufferedClick(
    context: AudioContext,
    buffer: AudioBuffer,
    startAt: number,
) {
    const source = context.createBufferSource();
    const gain = context.createGain();

    source.buffer = buffer;
    gain.gain.value = 0.3;
    source.connect(gain);
    gain.connect(context.destination);
    source.addEventListener(
        "ended",
        () => {
            source.disconnect();
            gain.disconnect();
        },
        { once: true },
    );
    source.start(startAt);
}

// 音声データの準備前でも、初回操作を無音にしないための短い機械音。
function playFallbackClick(context: AudioContext, startAt: number) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const endsAt = startAt + 0.022;

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(1400, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(520, endsAt);
    gain.gain.setValueAtTime(0.045, startAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.addEventListener(
        "ended",
        () => {
            oscillator.disconnect();
            gain.disconnect();
        },
        { once: true },
    );
    oscillator.start(startAt);
    oscillator.stop(endsAt);
}

/** 歯の中央付近を速く、両端を遅くしてラチェットの引っ掛かりを再現する。 */
function applyRatchet(angle: number) {
    const stepIndex = Math.floor(angle / RATCHET_STEP);
    const stepStart = stepIndex * RATCHET_STEP;
    const progress = (angle - stepStart) / RATCHET_STEP;
    const eased =
        progress < 0.5
            ? 0.5 * (progress * 2) ** RATCHET_SHARPNESS
            : 1 - 0.5 * ((1 - progress) * 2) ** RATCHET_SHARPNESS;

    return stepStart + eased * RATCHET_STEP;
}

export function MudaDial() {
    const { scene } = useGLTF("/models/muda-dial-optimized.glb");
    const canvas = useThree((state) => state.gl.domElement);

    // 3Dオブジェクト
    const dialGroupRef = useRef<THREE.Group>(null);
    const dialRef = useRef<THREE.Object3D | null>(null);
    const outlineLayersRef = useRef<OutlineLayer[]>([]);

    // ポインター操作
    const activePointerIdRef = useRef<number | null>(null);
    const previousPointerXRef = useRef(0);
    const lastMoveTimeRef = useRef(0);
    const isDraggingRef = useRef(false);
    const gestureAxisRef = useRef<"horizontal" | "vertical" | null>(null);
    const pointerDownXRef = useRef(0);
    const pointerDownYRef = useRef(0);

    // 回転状態
    const targetRotationRef = useRef(0);
    const velocityRef = useRef(0);
    const lastRatchetIndexRef = useRef(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    const clickSoundDataRef = useRef<ArrayBuffer | null>(null);
    const clickSoundBufferRef = useRef<AudioBuffer | null>(null);
    const clickSoundDecodeRef = useRef<Promise<AudioBuffer> | null>(null);
    const pendingClickCountRef = useRef(0);
    const vibrationRef = useRef(0);
    const displayRotationRef = useRef(0);
    const hasInteractedRef = useRef(false);
    const idleHintPlayedRef = useRef(false);
    const initialHintIndexRef = useRef(0);
    const initialHintStartedAtRef = useRef<number | null>(null);

    // 操作がないときに、短い自動回転でドラッグ可能なことを伝える。
    const lastInteractionRef = useRef(0);
    const hintActiveRef = useRef(false);
    const hintTimeRef = useRef(0);

    // 読み込み済みの効果音を、同時発音できる短いAudioBufferSourceとして再生する。
    const playClickSound = useCallback((clickCount = 1) => {
        const context = audioContextRef.current;

        if (!context || context.state !== "running") {
            pendingClickCountRef.current = Math.min(
                pendingClickCountRef.current + clickCount,
                MAX_PENDING_RATCHET_CLICKS,
            );
            return;
        }

        const bufferedClickCount = Math.min(
            pendingClickCountRef.current + clickCount,
            MAX_PENDING_RATCHET_CLICKS,
        );

        if (bufferedClickCount <= 0) {
            return;
        }

        pendingClickCountRef.current = 0;

        const buffer = clickSoundBufferRef.current;
        const startsAt = context.currentTime;

        for (let index = 0; index < bufferedClickCount; index += 1) {
            const clickStartsAt = startsAt + index * RATCHET_CLICK_SPACING;

            if (buffer) {
                playBufferedClick(context, buffer, clickStartsAt);
            } else {
                playFallbackClick(context, clickStartsAt);
            }
        }
    }, []);

    const prepareClickSound = useCallback((context: AudioContext) => {
        if (clickSoundBufferRef.current) {
            return Promise.resolve(clickSoundBufferRef.current);
        }

        if (clickSoundDecodeRef.current) {
            return clickSoundDecodeRef.current;
        }

        const soundData = clickSoundDataRef.current;

        if (!soundData) {
            return null;
        }

        const decodePromise = context
            .decodeAudioData(soundData.slice(0))
            .then((buffer) => {
                if (audioContextRef.current === context) {
                    clickSoundBufferRef.current = buffer;
                }

                return buffer;
            })
            .finally(() => {
                if (audioContextRef.current === context) {
                    clickSoundDecodeRef.current = null;
                }
            });

        clickSoundDecodeRef.current = decodePromise;

        return decodePromise;
    }, []);

    // スマホの自動再生制限を解除するため、pointerイベント内で直接開始する。
    const unlockClickSound = useCallback(() => {
        let context = audioContextRef.current;

        if (!context || context.state === "closed") {
            context = new AudioContext();
            audioContextRef.current = context;
            clickSoundBufferRef.current = null;
            clickSoundDecodeRef.current = null;
        }

        const preparation = prepareClickSound(context);
        const playPendingSound = () => {
            if (pendingClickCountRef.current > 0) {
                playClickSound(0);
            }
        };

        if (context.state !== "running") {
            void context
                .resume()
                .then(playPendingSound)
                .catch((error: unknown) => {
                    console.warn("ラチェット音を有効にできませんでした。", error);
                });
        } else {
            playPendingSound();
        }

        if (preparation) {
            void preparation
                .then(playPendingSound)
                .catch((error: unknown) => {
                    console.warn("ラチェット音を読み込めませんでした。", error);
                });
        }
    }, [playClickSound, prepareClickSound]);

    // ポインターが押されたときにドラッグを開始する
    const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
        if (event.button !== 0 || activePointerIdRef.current !== null) {
            return;
        }

        const now = performance.now();

        event.stopPropagation();
        unlockClickSound();
        activePointerIdRef.current = event.pointerId;
        previousPointerXRef.current = event.clientX;
        lastMoveTimeRef.current = now;
        isDraggingRef.current = true;
        lastInteractionRef.current = now;
        hasInteractedRef.current = true;
        idleHintPlayedRef.current = false;
        initialHintIndexRef.current = INITIAL_HINT_DELAYS.length;
        hintActiveRef.current = false;
        hintTimeRef.current = 0;
        outlineLayersRef.current.forEach(({ material }) => {
            material.opacity = 0;
        });
        gestureAxisRef.current = null;
        pointerDownXRef.current = event.clientX;
        pointerDownYRef.current = event.clientY;

        // Canvas外へドラッグしてもポインターイベントを受け取る
        canvas.setPointerCapture(event.pointerId);
    };

    // 音声データだけ先読みし、AudioContext自体は最初のユーザー操作内で生成する。
    useEffect(() => {
        const controller = new AbortController();

        void fetch("/sounds/ratchet_sound.WAV", {
            signal: controller.signal,
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`効果音の取得に失敗しました: ${response.status}`);
                }

                return response.arrayBuffer();
            })
            .then((soundData) => {
                clickSoundDataRef.current = soundData;

                const context = audioContextRef.current;

                if (!context || context.state === "closed") {
                    return;
                }

                const preparation = prepareClickSound(context);

                if (preparation) {
                    void preparation
                        .then(() => {
                            if (pendingClickCountRef.current > 0) {
                                playClickSound(0);
                            }
                        })
                        .catch((error: unknown) => {
                            console.warn(
                                "ラチェット音を読み込めませんでした。",
                                error,
                            );
                        });
                }
            })
            .catch((error: unknown) => {
                if (error instanceof DOMException && error.name === "AbortError") {
                    return;
                }

                console.warn("ラチェット音を取得できませんでした。", error);
            });

        return () => {
            controller.abort();

            const context = audioContextRef.current;

            if (context && context.state !== "closed") {
                void context.close();
            }

            audioContextRef.current = null;
            clickSoundDataRef.current = null;
            clickSoundBufferRef.current = null;
            clickSoundDecodeRef.current = null;
            pendingClickCountRef.current = 0;
        };
    }, [playClickSound, prepareClickSound]);

    // モデル内の操作対象とマテリアルを初期化する
    useEffect(() => {
        const initializedAt = performance.now();

        lastInteractionRef.current = initializedAt;
        initialHintStartedAtRef.current = initializedAt;
        const dial = scene.getObjectByName("CTRL_Upper") ?? null;
        const outerMesh = scene.getObjectByName("BodyShell");
        const createdOutlineLayers: OutlineLayer[] = [];

        // Fast RefreshなどでEffectが再実行された場合も、前回の生成物を残さない。
        disposeOutlineLayers(outlineLayersRef.current);
        outlineLayersRef.current = [];

        if (!(outerMesh instanceof THREE.Mesh)) {
            console.warn("ダイヤル外周のMeshが見つかりませんでした");
        }

        if (outerMesh instanceof THREE.Mesh) {
            OUTLINE_LAYERS.forEach(({ scale, opacity: baseOpacity }) => {
                const material = new THREE.MeshBasicMaterial({
                    color: 0xaaff00,
                    side: THREE.BackSide,
                    transparent: true,
                    opacity: 0,
                    depthWrite: false,
                    toneMapped: false,
                });

                const outline = new THREE.Mesh(outerMesh.geometry, material);

                outline.position.copy(outerMesh.position);
                outline.rotation.copy(outerMesh.rotation);
                outline.scale.copy(outerMesh.scale);

                outline.scale.multiplyScalar(scale);

                outerMesh.parent?.add(outline);

                createdOutlineLayers.push({
                    mesh: outline,
                    material,
                    baseOpacity,
                });
            });
        }

        outlineLayersRef.current = createdOutlineLayers;

        // dial?.traverse((child) => {
        //     if (child instanceof THREE.Mesh) {
        //         const materials = Array.isArray(child.material)
        //             ? child.material
        //             : [child.material];

        //         console.log({
        //             mesh: child.name,
        //             materials: materials.map((material) => material.name),
        //         });
        //     }
        // });

        dialRef.current = dial;

        if (dial) {
            targetRotationRef.current = dial.rotation.y;
            displayRotationRef.current = dial.rotation.y;
        } else {
            console.warn(
                "CTRL_Upperが見つかりません。ダイヤルを回転できません。",
            );
        }

        scene.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) {
                return;
            }

            const materials = Array.isArray(child.material)
                ? child.material
                : [child.material];
            const centerPlateMaterial = materials.find(
                (material) =>
                    material.name === "MAT_CenterPlate_Titanium" &&
                    material instanceof THREE.MeshStandardMaterial,
            );

            if (!centerPlateMaterial) {
                return;
            }

            // 中央プレートだけ金属の異方性を強め、加工されたチタンの質感にする。
            centerPlateMaterial.metalness = 1;
            centerPlateMaterial.roughness = 0.3;
            centerPlateMaterial.anisotropy = 1;
            centerPlateMaterial.anisotropyRotation = 0;
        });

        return function clearDialReference() {
            disposeOutlineLayers(createdOutlineLayers);

            if (outlineLayersRef.current === createdOutlineLayers) {
                outlineLayersRef.current = [];
            }

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
            const gestureDeltaX = event.clientX - pointerDownXRef.current;
            const gestureDeltaY = event.clientY - pointerDownYRef.current;

            if (gestureAxisRef.current === null) {
                const absX = Math.abs(gestureDeltaX);
                const absY = Math.abs(gestureDeltaY);

                if (
                    Math.hypot(gestureDeltaX, gestureDeltaY) < GESTURE_THRESHOLD
                ) {
                    return;
                }

                if (absX > absY) {
                    gestureAxisRef.current = "horizontal";
                    console.log("horizontal");
                } else {
                    gestureAxisRef.current = "vertical";
                    console.log("vertical");
                }
            }

            if (gestureAxisRef.current === "vertical") {
                velocityRef.current = 0;
                return;
            }

            const deltaX = event.clientX - previousPointerXRef.current;
            const rotationDelta = deltaX * ROTATION_SENSITIVITY;
            const now = performance.now();
            const deltaTime = (now - lastMoveTimeRef.current) / 1000;

            lastInteractionRef.current = now;

            targetRotationRef.current += rotationDelta;

            previousPointerXRef.current = event.clientX;

            if (deltaTime > 0) {
                velocityRef.current = rotationDelta / deltaTime;
            }

            lastMoveTimeRef.current = now;
        };

        const handlePointerUp = (event: PointerEvent) => {
            if (finishDragging(event.pointerId)) {
                // iOS Safariなど、touchのpointerupをユーザー操作と判定する環境でも再開する。
                unlockClickSound();

                lastInteractionRef.current = performance.now();
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

            velocityRef.current = 0;
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                handleWindowBlur();
            }
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", handlePointerCancel);
        window.addEventListener("blur", handleWindowBlur);
        window.addEventListener("pagehide", handleWindowBlur);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", handlePointerCancel);
            window.removeEventListener("blur", handleWindowBlur);
            window.removeEventListener("pagehide", handleWindowBlur);
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange,
            );

            const pointerId = activePointerIdRef.current;

            if (pointerId !== null && canvas.hasPointerCapture(pointerId)) {
                canvas.releasePointerCapture(pointerId);
            }

            activePointerIdRef.current = null;
            isDraggingRef.current = false;
        };
    }, [canvas, unlockClickSound]);

    // 慣性、ラチェット、操作ヒント、振動を毎フレーム合成して表示へ反映する。
    useFrame(({ clock }, delta) => {
        const dial = dialRef.current;

        if (!dial) {
            return;
        }

        // バックグラウンド復帰直後の巨大なdeltaによる回転・音の暴発を防ぐ。
        const animationDelta = Math.min(delta, MAX_ANIMATION_DELTA);

        // ドラッグ終了後は速度を減衰させながら慣性回転させる。
        if (!isDraggingRef.current) {
            targetRotationRef.current += velocityRef.current * animationDelta;

            velocityRef.current = THREE.MathUtils.damp(
                velocityRef.current,
                0,
                FRICTION,
                animationDelta,
            );
        }

        const ratchetTarget = applyRatchet(targetRotationRef.current);

        const ratchetIndex = Math.round(
            targetRotationRef.current / RATCHET_STEP,
        );

        // 歯をまたいだ瞬間だけクリック音と小さな振動を発生させる。
        if (ratchetIndex !== lastRatchetIndexRef.current) {
            const crossedStepCount = Math.min(
                Math.abs(ratchetIndex - lastRatchetIndexRef.current),
                MAX_RATCHET_CLICKS_PER_FRAME,
            );

            lastRatchetIndexRef.current = ratchetIndex;
            playClickSound(crossedStepCount);
            vibrationRef.current = 0.00015;
        }

        const now = performance.now();
        const initialHintStartedAt = initialHintStartedAtRef.current;
        const isInitialHintDue =
            !hasInteractedRef.current &&
            !hintActiveRef.current &&
            initialHintStartedAt !== null &&
            initialHintIndexRef.current < INITIAL_HINT_DELAYS.length &&
            now - initialHintStartedAt >=
                INITIAL_HINT_DELAYS[initialHintIndexRef.current];
        const isIdleHintDue =
            !isDraggingRef.current &&
            !hintActiveRef.current &&
            hasInteractedRef.current &&
            now - lastInteractionRef.current > HINT_DELAY &&
            !idleHintPlayedRef.current;

        if (isInitialHintDue || isIdleHintDue) {
            hintActiveRef.current = true;
            hintTimeRef.current = 0;

            if (isIdleHintDue) {
                idleHintPlayedRef.current = true;
            } else {
                initialHintIndexRef.current += 1;
            }
        }

        let hintRotation = 0;

        if (hintActiveRef.current) {
            hintTimeRef.current += animationDelta;

            const progress = Math.min(hintTimeRef.current / HINT_DURATION, 1);
            const wave = Math.sin(progress * Math.PI * 2);
            const envelope = Math.sin(progress * Math.PI);

            hintRotation = wave * envelope * HINT_ROTATION;

            // アウトライン発光処理
            outlineLayersRef.current.forEach(({ material, baseOpacity }) => {
                material.opacity = baseOpacity * envelope;
            });

            if (progress >= 1) {
                hintActiveRef.current = false;
                hintTimeRef.current = 0;
                hintRotation = 0;

                outlineLayersRef.current.forEach(({ material }) => {
                    material.opacity = 0;
                });
            }
        }

        displayRotationRef.current = THREE.MathUtils.damp(
            displayRotationRef.current,
            ratchetTarget,
            ROTATION_DAMPING,
            animationDelta,
        );

        dial.rotation.y = displayRotationRef.current + hintRotation;

        const dialGroup = dialGroupRef.current;
        const vibration = vibrationRef.current;

        if (dialGroup) {
            const phase = clock.elapsedTime * VIBRATION_SPEED;

            dialGroup.position.set(
                DIAL_BASE_POSITION.x + Math.sin(phase) * vibration,
                DIAL_BASE_POSITION.y + Math.cos(phase * 1.17) * vibration,
                DIAL_BASE_POSITION.z + Math.sin(phase * 0.83) * vibration * 0.5,
            );
        }

        vibrationRef.current = THREE.MathUtils.damp(
            vibration,
            0,
            VIBRATION_DAMPING,
            animationDelta,
        );
    });

    return (
        <group
            ref={dialGroupRef}
            position={[
                DIAL_BASE_POSITION.x,
                DIAL_BASE_POSITION.y,
                DIAL_BASE_POSITION.z,
            ]}
            onPointerDown={handlePointerDown}
        >
            <primitive object={scene} />
        </group>
    );
}

useGLTF.preload("/models/muda-dial-optimized.glb");
