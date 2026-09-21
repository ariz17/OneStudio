"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { apiRequest } from "@/lib/api";
import * as mediasoupClient from "mediasoup-client";
import { useVirtualBackground } from "./use-virtual-background";

const WS_URL = (import.meta.env?.VITE_API_URL || "http://localhost:5000").replace(/^http/, "ws");

export function useGroupWebRTC(roomId) {
    const [callState, setCallState] = useState("idle");
    const [localStream, setLocalStream] = useState(null);
    const [rawVideoTrack, setRawVideoTrack] = useState(null);
    const [remotePeers, setRemotePeers] = useState([]);
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [remoteRecording, setRemoteRecording] = useState(null);
    const [participantCount, setParticipantCount] = useState(1);
    const [localUsername, setLocalUsername] = useState("You");
    const [incomingReaction, setIncomingReaction] = useState(null);
    const [incomingDrawPoint, setIncomingDrawPoint] = useState(null);
    const [incomingClear, setIncomingClear] = useState(false);
    const [incomingE2EKey, setIncomingE2EKey] = useState(null);

    const {
        processedTrack,
        backgroundMode,
        setBackgroundMode,
        backgroundImageUrl,
        setBackgroundImageUrl,
    } = useVirtualBackground(rawVideoTrack);

    const setVirtualBackground = useCallback((mode, url) => {
        setBackgroundMode(mode);
        if (url) setBackgroundImageUrl(url);
    }, [setBackgroundMode, setBackgroundImageUrl]);

    const socketRef = useRef(null);
    const deviceRef = useRef(null);
    const sendTransportRef = useRef(null);
    const recvTransportRef = useRef(null);
    const localStreamRef = useRef(null);
    const cameraTrackRef = useRef(null);
    const videoProducerRef = useRef(null);
    const audioProducerRef = useRef(null);
    const screenProducerRef = useRef(null);
    const cleanedUpRef = useRef(false);
    const localPeerIdRef = useRef(null);
    const effectIdRef = useRef(0);

    const send = useCallback((data) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify(data));
        }
    }, []);

    const consumersRef = useRef(new Map());
    const toggleScreenShareRef = useRef(null);
    const peerMapRef = useRef(new Map());
    const rtpCapsRef = useRef(null);
    const pendingProducersRef = useRef([]);
    const remoteMuteStatesRef = useRef(new Map());

    const rebuildRemotePeers = useCallback(() => {
        if (cleanedUpRef.current) return;

        const cameraStreams = new Map();
        const screenStreams = new Map();

        for (const { peerId, userId, consumer, isScreen } of consumersRef.current.values()) {
            if (isScreen) {
                const key = `${peerId}:screen`;
                if (!screenStreams.has(key)) {
                    screenStreams.set(key, { userId, stream: new MediaStream() });
                }
                screenStreams.get(key).stream.addTrack(consumer.track);
            } else {
                if (!cameraStreams.has(peerId)) {
                    cameraStreams.set(peerId, { userId, stream: new MediaStream() });
                }
                cameraStreams.get(peerId).stream.addTrack(consumer.track);
            }
        }

        const peers = [];
        for (const [peerId, { userId, stream }] of cameraStreams.entries()) {
            const muteState = remoteMuteStatesRef.current.get(peerId);
            peers.push({
                peerId, userId, stream, isScreen: false,
                isAudioMuted: muteState?.isAudioMuted ?? false,
                isVideoOff: muteState?.isVideoOff ?? false,
            });
        }
        for (const [key, { userId, stream }] of screenStreams.entries()) {
            peers.push({ peerId: key, userId, stream, isScreen: true });
        }

        setRemotePeers(peers);
        setParticipantCount(cameraStreams.size + 1);
    }, []);

    const consumeQueueRef = useRef(Promise.resolve());

    const consumeProducer = useCallback(async (producerId, peerId, displayName) => {
        if (!rtpCapsRef.current || !recvTransportRef.current) {
            console.log(`[GROUP] consumeProducer QUEUED (device not ready): ${producerId.slice(0, 8)} for ${displayName}`);
            pendingProducersRef.current.push({ producerId, peerId, userId: displayName });
            return;
        }

        consumeQueueRef.current = consumeQueueRef.current.then(async () => {
            try {
                console.log(`[GROUP] consumeProducer START: ${producerId.slice(0, 8)} for ${displayName}`);
                send({ type: "consume", producerId, rtpCapabilities: rtpCapsRef.current });

                const res = await new Promise((resolve) => {
                    const onMsg = (event) => {
                        const msg = JSON.parse(event.data);
                        if (msg.type === "consumed" || msg.type === "error") {
                            socketRef.current?.removeEventListener("message", onMsg);
                            resolve(msg);
                        }
                    };
                    socketRef.current?.addEventListener("message", onMsg);
                });

                if (res.type === "error") {
                    console.warn("[GROUP] consume FAILED:", producerId.slice(0, 8), res.message);
                    return;
                }

                console.log(`[GROUP] consume OK: kind=${res.kind} producerId=${res.producerId?.slice(0, 8)}`);

                const consumer = await recvTransportRef.current.consume({
                    id: res.id,
                    producerId: res.producerId,
                    kind: res.kind,
                    rtpParameters: res.rtpParameters,
                    appData: res.appData,
                });

                console.log(`[GROUP] consumer created: id=${consumer.id.slice(0, 8)} kind=${consumer.kind} track=${consumer.track?.readyState}`);

                consumersRef.current.set(consumer.id, {
                    peerId,
                    userId: displayName,
                    consumer,
                    isScreen: res.appData?.screen
                });
                peerMapRef.current.set(peerId, { userId: displayName, username: displayName });

                try { consumer.resume(); } catch { }

                rebuildRemotePeers();
            } catch (err) {
                console.warn("[GROUP] consumeProducer error for", producerId.slice(0, 8), err);
            }
        });
    }, [rebuildRemotePeers, send]);

    useEffect(() => {
        if (!roomId) return;

        const myEffectId = ++effectIdRef.current;
        const isStale = () => myEffectId !== effectIdRef.current;

        cleanedUpRef.current = false;

        let socket = null;

        function waitFor(type, match) {
            return new Promise((resolve) => {
                function onMsg(event) {
                    const msg = JSON.parse(event.data);
                    if (msg.type === type && (!match || match(msg))) {
                        socket?.removeEventListener("message", onMsg);
                        resolve(msg);
                    }
                }
                socket?.addEventListener("message", onMsg);
            });
        }

        async function setupDevice(rtpCapabilities) {
            const device = new mediasoupClient.Device();
            await device.load({ routerRtpCapabilities: rtpCapabilities });
            deviceRef.current = device;
            rtpCapsRef.current = device.rtpCapabilities;

            send({ type: "createTransport", direction: "send" });
            const sendRes = await waitFor("transportCreated", (m) => m.direction === "send");

            const sendTransport = device.createSendTransport({
                id: sendRes.params.id,
                iceParameters: sendRes.params.iceParameters,
                iceCandidates: sendRes.params.iceCandidates,
                dtlsParameters: sendRes.params.dtlsParameters,
            });

            sendTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
                send({ type: "connectTransport", transportId: sendTransport.id, dtlsParameters });
                waitFor("transportConnected", (m) => m.transportId === sendTransport.id)
                    .then(() => callback())
                    .catch(errback);
            });

            sendTransport.on("produce", ({ kind, rtpParameters, appData }, callback, errback) => {
                send({ type: "produce", transportId: sendTransport.id, kind, rtpParameters, appData });
                waitFor("produced")
                    .then((msg) => callback({ id: msg.producerId }))
                    .catch(errback);
            });

            sendTransportRef.current = sendTransport;

            send({ type: "createTransport", direction: "recv" });
            const recvRes = await waitFor("transportCreated", (m) => m.direction === "recv");

            const recvTransport = device.createRecvTransport({
                id: recvRes.params.id,
                iceParameters: recvRes.params.iceParameters,
                iceCandidates: recvRes.params.iceCandidates,
                dtlsParameters: recvRes.params.dtlsParameters,
            });

            recvTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
                send({ type: "connectTransport", transportId: recvTransport.id, dtlsParameters });
                waitFor("transportConnected", (m) => m.transportId === recvTransport.id)
                    .then(() => callback())
                    .catch(errback);
            });

            recvTransportRef.current = recvTransport;

            if (localStreamRef.current) {
                const audio = localStreamRef.current.getAudioTracks()[0];
                const video = localStreamRef.current.getVideoTracks()[0];
                if (audio) {
                    audioProducerRef.current = await sendTransport.produce({ track: audio, stopTracks: false });
                }
                if (video) {
                    videoProducerRef.current = await sendTransport.produce({ track: video, stopTracks: false });
                }
            }

            const pending = [...pendingProducersRef.current];
            pendingProducersRef.current = [];
            for (const p of pending) {
                await consumeProducer(p.producerId, p.peerId, p.userId);
            }
        }

        async function init() {
            if (isStale()) return;
            setCallState("joining");

            try {
                try {
                    await apiRequest(`/rooms/${roomId}/join`, {});
                } catch (e) {
                    if (!e.message?.includes("Already")) throw e;
                }

                if (isStale()) return;

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280, max: 1920 },
                        height: { ideal: 720, max: 1080 },
                        frameRate: { ideal: 30, max: 30 },
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        sampleRate: 48000,
                        channelCount: 1,
                    },
                });

                if (isStale()) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                localStreamRef.current = stream;
                const vidTrack = stream.getVideoTracks()[0] || null;
                cameraTrackRef.current = vidTrack;
                setRawVideoTrack(vidTrack);
                setLocalStream(stream);

                const { token } = await apiRequest("/auth/ws-token", undefined, "GET");

                if (isStale()) return;

                const wsUrl = token ? `${WS_URL}?token=${encodeURIComponent(token)}` : WS_URL;
                socket = new WebSocket(wsUrl);
                socketRef.current = socket;

                socket.addEventListener("open", () => {
                    if (isStale()) { socket?.close(); return; }
                    send({ type: "join", roomId });
                });

                socket.addEventListener("message", (event) => {
                    if (isStale()) return;
                    const msg = JSON.parse(event.data);

                    switch (msg.type) {
                        case "role":
                            setCallState("connected");
                            if (msg.username) setLocalUsername(msg.username);
                            if (msg.peerId) localPeerIdRef.current = msg.peerId;
                            send({ type: "getRouterCapabilities" });
                            break;

                        case "routerCapabilities":
                            void setupDevice(msg.rtpCapabilities).catch((err) => {
                                console.error("setupDevice failed:", err);
                                if (!cleanedUpRef.current) {
                                    setCallState("error");
                                    setErrorMessage("Failed to initialize media device");
                                }
                            });
                            break;

                        case "peer-joined":
                            peerMapRef.current.set(msg.peerId, { userId: msg.userId, username: msg.username || msg.userId.slice(0, 8) });
                            break;

                        case "existingProducers":
                            console.log(`[GROUP] existingProducers: ${msg.producers?.length} producers, localPeerId=${localPeerIdRef.current?.slice(0, 8)}`);
                            for (const prod of msg.producers) {
                                if (prod.peerId === localPeerIdRef.current) {
                                    console.log(`[GROUP] SKIPPING own producer: ${prod.producerId?.slice(0, 8)}`);
                                    continue;
                                }
                                console.log(`[GROUP] consuming existing: ${prod.producerId?.slice(0, 8)} kind=${prod.kind} from ${prod.username}`);
                                void consumeProducer(prod.producerId, prod.peerId, prod.username || prod.userId.slice(0, 8));
                            }
                            break;

                        case "newProducer":
                            if (msg.peerId === localPeerIdRef.current) {
                                console.log(`[GROUP] SKIPPING own newProducer: ${msg.producerId?.slice(0, 8)}`);
                                break;
                            }
                            console.log(`[GROUP] newProducer: ${msg.producerId?.slice(0, 8)} kind=${msg.kind} from ${msg.username}`);
                            void consumeProducer(msg.producerId, msg.peerId, msg.username || msg.userId.slice(0, 8));
                            break;

                        case "producerClosed":
                            for (const [id, data] of consumersRef.current.entries()) {
                                if (data.consumer.producerId === msg.producerId) {
                                    data.consumer.close();
                                    consumersRef.current.delete(id);
                                }
                            }
                            rebuildRemotePeers();
                            break;

                        case "peer-left":
                            for (const [id, data] of consumersRef.current.entries()) {
                                if (data.peerId === msg.peerId) {
                                    data.consumer.close();
                                    consumersRef.current.delete(id);
                                }
                            }
                            peerMapRef.current.delete(msg.peerId);
                            remoteMuteStatesRef.current.delete(msg.peerId);
                            rebuildRemotePeers();
                            break;

                        case "mute-state":
                            remoteMuteStatesRef.current.set(msg.peerId, {
                                isAudioMuted: msg.isAudioMuted ?? false,
                                isVideoOff: msg.isVideoOff ?? false,
                            });
                            rebuildRemotePeers();
                            break;

                        case "chat-message":
                            setChatMessages(prev => [...prev, {
                                id: `${Date.now()}-${Math.random()}`,
                                sender: msg.sender,
                                text: msg.text,
                                timestamp: msg.timestamp,
                                isLocal: false,
                                messageType: msg.messageType || "text",
                                imageData: msg.imageData,
                            }]);
                            break;

                        case "recording-status":
                            setRemoteRecording(msg.isRecording ? { isRecording: true, recorder: msg.recorder } : null);
                            break;

                        case "emoji-reaction":
                            setIncomingReaction({ emoji: msg.emoji, sender: msg.sender });
                            break;

                        case "whiteboard-draw":
                            setIncomingDrawPoint(msg.point);
                            break;

                        case "whiteboard-clear":
                            setIncomingClear(true);
                            setTimeout(() => setIncomingClear(false), 100);
                            break;

                        case "e2e-public-key":
                            setIncomingE2EKey(msg.publicKeyJwk);
                            break;

                        case "error":
                            console.warn("Signaling warning:", msg.message);
                            break;
                    }
                });

                socket.addEventListener("close", (event) => {
                    if (isStale()) return;
                    console.log(`[WS] close: code=${event.code} reason=${event.reason} clean=${event.wasClean}`);
                    if (!cleanedUpRef.current && event.code !== 1000) setCallState("disconnected");
                });

                socket.addEventListener("error", (e) => {
                    if (isStale()) return;
                    console.error("[WS] error:", e);
                    if (!cleanedUpRef.current) {
                        setCallState("error");
                        setErrorMessage("WebSocket connection failed");
                    }
                });

            } catch (err) {
                if (!cleanedUpRef.current) {
                    setCallState("error");
                    setErrorMessage(
                        err.name === "NotAllowedError"
                            ? "Camera/Mic access denied"
                            : (err.message || "Failed to join")
                    );
                }
            }
        }

        init();

        const handleBeforeUnload = () => {
            if (cameraTrackRef.current) {
                try { cameraTrackRef.current.stop(); } catch { }
            }
            localStreamRef.current?.getTracks().forEach((t) => {
                try { t.stop(); } catch { }
            });
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        window.addEventListener("pagehide", handleBeforeUnload);

        return () => {
            cleanedUpRef.current = true;
            window.removeEventListener("beforeunload", handleBeforeUnload);
            window.removeEventListener("pagehide", handleBeforeUnload);
            for (const { consumer } of consumersRef.current.values()) consumer.close();
            consumersRef.current.clear();
            screenProducerRef.current?.close();
            videoProducerRef.current?.close();
            audioProducerRef.current?.close();
            videoProducerRef.current = null;
            audioProducerRef.current = null;
            sendTransportRef.current?.close();
            recvTransportRef.current?.close();
            if (socket && socket.readyState <= WebSocket.OPEN) socket.close(1000, "cleanup");
            socketRef.current = null;
            if (cameraTrackRef.current) {
                try { cameraTrackRef.current.stop(); } catch { }
                cameraTrackRef.current = null;
            }
            localStreamRef.current?.getTracks().forEach((t) => {
                try { t.stop(); } catch { }
            });
            localStreamRef.current = null;
        };
    }, [roomId, send]);

    useEffect(() => {
        if (!processedTrack || !localStreamRef.current) return;

        const stream = localStreamRef.current;
        const currentVideoTrack = stream.getVideoTracks()[0];

        if (currentVideoTrack && currentVideoTrack !== processedTrack) {
            stream.removeTrack(currentVideoTrack);
            stream.addTrack(processedTrack);

            setLocalStream(new MediaStream(stream.getTracks()));

            if (videoProducerRef.current && !videoProducerRef.current.closed) {
                videoProducerRef.current
                    .replaceTrack({ track: processedTrack })
                    .catch((e) => console.error("[GROUP] videoProducer replaceTrack error:", e));
            }
        }
    }, [processedTrack]);

    const isAudioMutedRef = useRef(false);
    const isVideoOffRef = useRef(false);

    const toggleAudio = useCallback(() => {
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            const muted = !track.enabled;
            isAudioMutedRef.current = muted;
            setIsAudioMuted(muted);
            send({ type: "mute-state", isAudioMuted: muted, isVideoOff: isVideoOffRef.current });
        }
    }, [send]);

    const toggleVideo = useCallback(() => {
        const newOffState = !isVideoOffRef.current;
        isVideoOffRef.current = newOffState;
        setIsVideoOff(newOffState);

        const tracks = localStreamRef.current?.getVideoTracks() || [];
        for (const t of tracks) {
            t.enabled = !newOffState;
        }
        if (rawVideoTrack) {
            rawVideoTrack.enabled = !newOffState;
        }

        send({ type: "mute-state", isAudioMuted: isAudioMutedRef.current, isVideoOff: newOffState });
    }, [rawVideoTrack, send]);

    const endCall = useCallback(() => {
        if (cameraTrackRef.current) {
            try { cameraTrackRef.current.stop(); } catch { }
            cameraTrackRef.current = null;
        }
        if (rawVideoTrack) {
            try { rawVideoTrack.stop(); } catch { }
        }
        if (processedTrack) {
            try { processedTrack.stop(); } catch { }
        }
        localStreamRef.current?.getTracks().forEach((t) => {
            try { t.stop(); } catch { }
        });
        localStreamRef.current = null;
        screenProducerRef.current?.close();
        videoProducerRef.current?.close();
        audioProducerRef.current?.close();
        sendTransportRef.current?.close();
        recvTransportRef.current?.close();
        socketRef.current?.close();
        window.location.href = "/";
    }, [rawVideoTrack, processedTrack]);

    const toggleScreenShare = useCallback(async () => {
        const sendTransport = sendTransportRef.current;
        if (!sendTransport) return;

        if (isScreenSharing) {
            if (screenProducerRef.current) {
                const producerId = screenProducerRef.current.id;
                screenProducerRef.current.close();
                screenProducerRef.current = null;
                send({ type: "closeProducer", producerId });
            }
            setIsScreenSharing(false);
        } else {
            if (!navigator.mediaDevices?.getDisplayMedia) {
                setErrorMessage("Screen sharing is not supported in this browser or requires a secure (HTTPS/localhost) connection.");
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }
                });
                const track = stream.getVideoTracks()[0];

                const producer = await sendTransport.produce({ track, appData: { screen: true } });
                screenProducerRef.current = producer;
                setIsScreenSharing(true);

                track.onended = () => {
                    void toggleScreenShareRef.current();
                };
            } catch (err) {
                console.error("Screen share failed:", err);
                if (err.name === "NotAllowedError") {
                    setErrorMessage("Screen share permission denied. Please allow screen access in your browser.");
                } else {
                    setErrorMessage("Failed to start screen share: " + (err.message || "Unknown error"));
                }
            }
        }
    }, [isScreenSharing, send]);

    useEffect(() => {
        toggleScreenShareRef.current = toggleScreenShare;
    }, [toggleScreenShare]);

    const sendChatMessage = useCallback((text, messageType, imageData) => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
        send({ type: "chat-message", text, messageType: messageType || "text", imageData });
        setChatMessages(prev => [...prev, {
            id: `${Date.now()}-${Math.random()}`,
            sender: localUsername || "You",
            text,
            timestamp: Date.now(),
            isLocal: true,
            messageType: messageType || "text",
            imageData,
        }]);
    }, [send, localUsername]);

    const sendSignal = useCallback((data) => {
        send(data);
    }, [send]);

    const sendReaction = useCallback((emoji) => {
        send({ type: "emoji-reaction", emoji });
    }, [send]);

    const sendWhiteboardDraw = useCallback((point) => {
        send({ type: "whiteboard-draw", point });
    }, [send]);

    const sendWhiteboardClear = useCallback(() => {
        send({ type: "whiteboard-clear" });
    }, [send]);

    const sendE2EPublicKey = useCallback((publicKeyJwk) => {
        send({ type: "e2e-public-key", publicKeyJwk });
    }, [send]);

    return {
        callState,
        localStream,
        remotePeers,
        participantCount,
        localUsername,
        isAudioMuted,
        isVideoOff,
        isScreenSharing,
        errorMessage,
        chatMessages,
        remoteRecording,
        incomingReaction,
        incomingDrawPoint,
        incomingClear,
        incomingE2EKey,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
        sendChatMessage,
        sendReaction,
        sendWhiteboardDraw,
        sendWhiteboardClear,
        sendE2EPublicKey,
        sendSignal,
        endCall,
        bgMode: backgroundMode,
        bgUrl: backgroundImageUrl,
        setVirtualBackground,
    };
}
