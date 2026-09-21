import { useEffect, useState, useRef } from 'react';

export function useVirtualBackground(sourceTrack) {
    const [backgroundMode, setBackgroundMode] = useState('none');
    const [backgroundImageUrl, setBackgroundImageUrl] = useState('');
    const [processedTrack, setProcessedTrack] = useState(null);

    const canvasRef = useRef(null);
    const inputCanvasRef = useRef(null);
    const videoRef = useRef(null);
    const bgImageRef = useRef(null);
    const segmentationRef = useRef(null);
    const rafIdRef = useRef(0);
    const bgModeRef = useRef('none');
    const isProcessingRef = useRef(false);

    useEffect(() => {
        bgModeRef.current = backgroundMode;
    }, [backgroundMode]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        canvasRef.current = canvas;

        const inputCanvas = document.createElement('canvas');
        inputCanvas.width = 320;
        inputCanvas.height = 240;
        inputCanvasRef.current = inputCanvas;

        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        videoRef.current = video;

        const bgImage = new Image();
        bgImage.crossOrigin = "anonymous";
        bgImageRef.current = bgImage;

        let isComponentMounted = true;

        import('@mediapipe/selfie_segmentation').then(({ SelfieSegmentation }) => {
            if (!isComponentMounted) return;

            const segmentation = new SelfieSegmentation({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
            });

            segmentation.setOptions({
                modelSelection: 0,
                selfieMode: false,
            });

            segmentation.onResults((results) => {
                isProcessingRef.current = false;
                if (!canvasRef.current || !videoRef.current) return;
                const ctx = canvasRef.current.getContext('2d');
                if (!ctx) return;

                const mode = bgModeRef.current;
                if (mode === 'none') return;

                const cw = canvasRef.current.width;
                const ch = canvasRef.current.height;
                const videoEl = videoRef.current;

                ctx.save();
                ctx.clearRect(0, 0, cw, ch);

                ctx.globalCompositeOperation = 'copy';
                ctx.drawImage(results.segmentationMask, 0, 0, cw, ch);

                ctx.globalCompositeOperation = 'source-in';
                ctx.drawImage(videoEl, 0, 0, cw, ch);

                ctx.globalCompositeOperation = 'destination-over';

                if (mode === 'blur') {
                    ctx.filter = 'blur(8px)';
                    ctx.drawImage(videoEl, 0, 0, cw, ch);
                    ctx.filter = 'none';
                } else if (mode === 'image' && bgImageRef.current?.complete && bgImageRef.current.naturalWidth > 0) {
                    ctx.filter = 'none';
                    const iw = bgImageRef.current.width;
                    const ih = bgImageRef.current.height;
                    const aspectCanvas = cw / ch;
                    const aspectImage = iw / ih;

                    let dw = cw, dh = ch, dx = 0, dy = 0;
                    if (aspectImage > aspectCanvas) {
                        dh = ch;
                        dw = dh * aspectImage;
                        dx = (cw - dw) / 2;
                    } else {
                        dw = cw;
                        dh = dw / aspectImage;
                        dy = (ch - dh) / 2;
                    }
                    ctx.drawImage(bgImageRef.current, dx, dy, dw, dh);
                } else {
                    ctx.filter = 'none';
                    ctx.drawImage(videoEl, 0, 0, cw, ch);
                }

                ctx.restore();
            });

            segmentationRef.current = segmentation;
        });

        return () => {
            isComponentMounted = false;
            if (segmentationRef.current) segmentationRef.current.close();
            if (videoRef.current) {
                try {
                    videoRef.current.pause();
                    videoRef.current.srcObject = null;
                } catch { }
            }
        };
    }, []);

    useEffect(() => {
        if (bgImageRef.current && backgroundImageUrl) {
            bgImageRef.current.src = backgroundImageUrl;
        }
    }, [backgroundImageUrl]);

    useEffect(() => {
        if (!sourceTrack) {
            setProcessedTrack(null);
            return;
        }

        if (backgroundMode === 'none') {
            setProcessedTrack(sourceTrack);
            return;
        }

        if (!videoRef.current) {
            setProcessedTrack(sourceTrack);
            return;
        }

        const video = videoRef.current;
        const stream = new MediaStream([sourceTrack]);
        video.srcObject = stream;
        video.play().catch(() => { });

        let stopped = false;

        const setup = async () => {
            let attempts = 0;
            while (!segmentationRef.current && attempts < 30) {
                await new Promise(r => setTimeout(r, 100));
                attempts++;
            }

            if (!segmentationRef.current || stopped) {
                setProcessedTrack(sourceTrack);
                return;
            }

            const tick = async () => {
                if (stopped) return;
                if (
                    bgModeRef.current !== 'none' &&
                    video.readyState >= 2 &&
                    segmentationRef.current &&
                    !isProcessingRef.current &&
                    inputCanvasRef.current
                ) {
                    try {
                        isProcessingRef.current = true;
                        const inputCtx = inputCanvasRef.current.getContext('2d');
                        if (inputCtx) {
                            inputCtx.drawImage(video, 0, 0, 320, 240);
                            await segmentationRef.current.send({ image: inputCanvasRef.current });
                        } else {
                            isProcessingRef.current = false;
                        }
                    } catch {
                        isProcessingRef.current = false;
                    }
                }
                rafIdRef.current = requestAnimationFrame(tick);
            };
            rafIdRef.current = requestAnimationFrame(tick);

            if (canvasRef.current) {
                const outStream = canvasRef.current.captureStream(30);
                setProcessedTrack(outStream.getVideoTracks()[0]);
            }
        };

        setup();

        return () => {
            stopped = true;
            cancelAnimationFrame(rafIdRef.current);
            if (videoRef.current) {
                try {
                    videoRef.current.pause();
                    videoRef.current.srcObject = null;
                } catch { }
            }
        };
    }, [sourceTrack, backgroundMode]);

    return {
        processedTrack,
        backgroundMode,
        setBackgroundMode,
        backgroundImageUrl,
        setBackgroundImageUrl,
    };
}
