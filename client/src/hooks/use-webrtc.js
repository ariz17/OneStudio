"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { apiRequest } from "@/lib/api";
import { useVirtualBackground } from "./use-virtual-background";

const WS_URL = (import.meta.env?.VITE_API_URL || "http://localhost:5000").replace(/^http/, "ws");

const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
        {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
        {
            urls: "turn:openrelay.metered.ca:443?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
    ],
    iceCandidatePoolSize: 10,
};

export function useWebRTC(roomId) {
    const [callState, setCallState] = useState("idle");
    const [localStream, setLocalStream] = useState(null);
    const [rawVideoTrack, setRawVideoTrack] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [remoteIsScreenSharing, setRemoteIsScreenSharing] = useState(false);
    const [remoteIsAudioMuted, setRemoteIsAudioMuted] = useState(false);
    const [remoteIsVideoOff, setRemoteIsVideoOff] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [remoteRecording, setRemoteRecording] = useState(null);
    const [receivedRecordings, setReceivedRecordings] = useState([]);
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
    const pcRef = useRef(null);
    const localStreamRef = useRef(null);
    const screenTrackRef = useRef(null);
    const cameraTrackRef = useRef(null);
    const cleanedUpRef = useRef(false);
    const effectIdRef = useRef(0);
    const dataChannelRef = useRef(null);
    const incomingChunksRef = useRef({});

    useEffect(() => {
        if (!roomId) return;

        const myEffectId = ++effectIdRef.current;
        const isStale = () => myEffectId !== effectIdRef.current;

        cleanedUpRef.current = false;

        let socket = null;
        let pc = null;
        let stream = null;
        let pendingCandidates = [];

        function setupDataChannelHandlers(dc) {
            dc.binaryType = "arraybuffer";
            let metaInfo = null;

            dc.onmessage = (evt) => {
                if (typeof evt.data === "string") {
                    const msg = JSON.parse(evt.data);
                    if (msg.type === "recording-meta") {
                        metaInfo = { name: msg.name, totalChunks: msg.totalChunks, totalSize: msg.totalSize };
                        incomingChunksRef.current[msg.name] = [];
                    } else if (msg.type === "recording-done") {
                        const chunks = incomingChunksRef.current[msg.name];
                        if (chunks && metaInfo) {
                            const blob = new Blob(chunks, { type: "video/webm" });
                            setReceivedRecordings(prev => [...prev, {
                                name: msg.name,
                                blob,
                                size: blob.size,
                                receivedAt: Date.now(),
                            }]);
                            delete incomingChunksRef.current[msg.name];
                            console.log(`[REC] Received recording from ${msg.name}: ${(blob.size / 1024 / 1024).toFixed(1)} MB`);
                        }
                        metaInfo = null;
                    }
                } else {
                    if (metaInfo) {
                        incomingChunksRef.current[metaInfo.name]?.push(evt.data);
                    }
                }
            };
        }

        function createPC(targetPeerId) {
            if (pc) {
                try { pc.close(); } catch { }
            }

            const newPc = new RTCPeerConnection(ICE_SERVERS);
            pendingCandidates = [];

            newPc.onicecandidate = (e) => {
                if (e.candidate && socket?.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({
                        type: "ice-candidate",
                        payload: e.candidate,
                        targetPeerId,
                    }));
                }
            };

            newPc.ontrack = (e) => {
                if (!cleanedUpRef.current) {
                    setRemoteStream(e.streams[0]);
                }
            };

            newPc.onconnectionstatechange = () => {
                if (cleanedUpRef.current) return;
                const s = newPc.connectionState;
                console.log("[RTC] connectionState:", s);
                if (s === "connected") setCallState("connected");
                if (s === "failed") setCallState("disconnected");
            };

            const dc = newPc.createDataChannel("recording", {
                ordered: true,
                maxRetransmits: 30,
            });
            dc.bufferedAmountLowThreshold = 256 * 1024;
            dc.onopen = () => { console.log("[DC] recording channel opened (offerer)"); };
            setupDataChannelHandlers(dc);
            dataChannelRef.current = dc;

            newPc.ondatachannel = (evt) => {
                console.log("[DC] recording channel opened (answerer)");
                const remoteDc = evt.channel;
                setupDataChannelHandlers(remoteDc);
                dataChannelRef.current = remoteDc;
            };

            if (stream) {
                stream.getTracks().forEach((track) => newPc.addTrack(track, stream));
            }

            pc = newPc;
            pcRef.current = newPc;
            return newPc;
        }

        async function handleMessage(msg) {
            if (cleanedUpRef.current) return;

            try {
                switch (msg.type) {
                    case "role":
                        setCallState("connected");
                        break;

                    case "existing-peers": {
                        const peer = msg.peers?.[0];
                        if (peer) {
                            const newPc = createPC(peer.peerId);
                            const offer = await newPc.createOffer();
                            await newPc.setLocalDescription(offer);
                            socket?.send(JSON.stringify({
                                type: "offer",
                                payload: offer,
                                targetPeerId: peer.peerId,
                            }));
                        }
                        break;
                    }

                    case "peer-joined":
                        if (pc) {
                            pc.close();
                            pc = null;
                            pcRef.current = null;
                        }
                        setRemoteStream(null);
                        break;

                    case "offer": {
                        createPC(msg.fromPeerId);

                        await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));

                        for (const c of pendingCandidates) {
                            await pc.addIceCandidate(c);
                        }
                        pendingCandidates = [];

                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        socket?.send(JSON.stringify({
                            type: "answer",
                            payload: answer,
                            targetPeerId: msg.fromPeerId,
                        }));
                        break;
                    }

                    case "answer":
                        if (pc && pc.signalingState === "have-local-offer") {
                            await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
                            for (const c of pendingCandidates) {
                                await pc.addIceCandidate(c);
                            }
                            pendingCandidates = [];
                        }
                        break;

                    case "ice-candidate":
                        if (pc && pc.remoteDescription) {
                            await pc.addIceCandidate(new RTCIceCandidate(msg.payload));
                        } else {
                            pendingCandidates.push(new RTCIceCandidate(msg.payload));
                        }
                        break;

                    case "peer-left":
                        setRemoteStream(null);
                        setRemoteIsScreenSharing(false);
                        if (pc) {
                            pc.close();
                            pc = null;
                            pcRef.current = null;
                        }
                        break;

                    case "screen-share-started":
                        setRemoteIsScreenSharing(true);
                        break;

                    case "screen-share-stopped":
                        setRemoteIsScreenSharing(false);
                        break;

                    case "mute-state":
                        setRemoteIsAudioMuted(msg.isAudioMuted ?? false);
                        setRemoteIsVideoOff(msg.isVideoOff ?? false);
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

                    case "emoji-reaction":
                        setIncomingReaction({ emoji: msg.emoji, sender: msg.sender });
                        break;

                    case "recording-status":
                        setRemoteRecording(msg.isRecording ? { isRecording: true, recorder: msg.recorder } : null);
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
                        console.error("Signaling error:", msg.message);
                        if (msg.message?.includes("not a participant") || msg.message?.includes("room not found")) {
                            setCallState("error");
                            setErrorMessage(msg.message);
                        }
                        break;
                }
            } catch (err) {
                console.error("handleMessage error:", err);
            }
        }

        async function init() {
            if (isStale()) return;
            setCallState("joining");

            try {
                try {
                    await apiRequest(`/rooms/${roomId}/join`, {});
                } catch (e) {
                    if (!e.message?.includes("Already")) {
                        throw e;
                    }
                }

                if (isStale()) return;

                stream = await navigator.mediaDevices.getUserMedia({
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

                socket.onopen = () => {
                    if (isStale()) { socket?.close(); return; }
                    console.log("[WS-1v1] connected");
                    socket.send(JSON.stringify({ type: "join", roomId }));
                };

                socket.onmessage = (event) => {
                    if (isStale()) return;
                    const msg = JSON.parse(event.data);
                    console.log("[WS-1v1] recv:", msg.type);
                    handleMessage(msg);
                };

                socket.onclose = (event) => {
                    if (isStale()) return;
                    console.log(`[WS-1v1] close: code=${event.code} reason=${event.reason}`);
                    if (!cleanedUpRef.current && event.code !== 1000) {
                        setCallState("disconnected");
                    }
                };

                socket.onerror = () => {
                    if (isStale()) return;
                    console.error("[WS-1v1] error");
                    if (!cleanedUpRef.current) {
                        setCallState("error");
                        setErrorMessage("WebSocket connection failed");
                    }
                };

            } catch (err) {
                if (!cleanedUpRef.current) {
                    console.error("Init failed:", err);
                    setCallState("error");
                    setErrorMessage(
                        err.name === "NotAllowedError"
                            ? "Camera/Mic access was denied. Please allow access and try again."
                            : (err.message || "Failed to join the meeting")
                    );
                }
            }
        }

        init();

        return () => {
            cleanedUpRef.current = true;
            if (socket && socket.readyState <= WebSocket.OPEN) {
                socket.close(1000, "cleanup");
            }
            socketRef.current = null;
            if (pc) {
                pc.close();
                pcRef.current = null;
            }
            if (stream) {
                stream.getTracks().forEach((t) => t.stop());
                localStreamRef.current = null;
            }
        };
    }, [roomId]);

    useEffect(() => {
        if (!processedTrack || !localStreamRef.current) return;

        const stream = localStreamRef.current;
        const currentVideoTrack = stream.getVideoTracks()[0];

        if (currentVideoTrack && currentVideoTrack !== processedTrack) {
            stream.removeTrack(currentVideoTrack);
            stream.addTrack(processedTrack);

            setLocalStream(new MediaStream(stream.getTracks()));

            const sender = pcRef.current?.getSenders().find(s => s.track?.kind === "video");
            if (sender) {
                sender.replaceTrack(processedTrack).catch(e => console.error("replaceTrack error:", e));
            }
        }
    }, [processedTrack]);

    const isAudioMutedRef = useRef(false);
    const isVideoOffRef = useRef(false);

    const toggleAudio = () => {
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            const muted = !track.enabled;
            isAudioMutedRef.current = muted;
            setIsAudioMuted(muted);
            if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({
                    type: "mute-state",
                    isAudioMuted: muted,
                    isVideoOff: isVideoOffRef.current,
                }));
            }
        }
    };

    const toggleVideo = () => {
        const track = localStreamRef.current?.getVideoTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            const off = !track.enabled;
            isVideoOffRef.current = off;
            setIsVideoOff(off);
            if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({
                    type: "mute-state",
                    isAudioMuted: isAudioMutedRef.current,
                    isVideoOff: off,
                }));
            }
        }
    };

    const endCall = () => {
        screenTrackRef.current?.stop();
        socketRef.current?.close();
        pcRef.current?.close();
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        window.location.href = "/";
    };

    const toggleScreenShare = async () => {
        const pc = pcRef.current;

        if (!pc) {
            setErrorMessage("Please wait for another participant to join before sharing your screen.");
            return;
        }

        if (isScreenSharing) {
            screenTrackRef.current?.stop();
            screenTrackRef.current = null;

            const camTrack = cameraTrackRef.current;
            const videoSender = pc?.getSenders().find((s) => s.track?.kind === "video" || s.track === null);

            if (camTrack && camTrack.readyState === "live") {
                if (videoSender) await videoSender.replaceTrack(camTrack).catch(()=>{});
                
                const stream = localStreamRef.current;
                if (stream) {
                    const oldTrack = stream.getVideoTracks()[0];
                    if (oldTrack) stream.removeTrack(oldTrack);
                    stream.addTrack(camTrack);
                    setLocalStream(new MediaStream(stream.getTracks()));
                }
            } else {
                try {
                    const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
                    const newCamTrack = newStream.getVideoTracks()[0];
                    cameraTrackRef.current = newCamTrack;
                    
                    const oldTrack = localStreamRef.current?.getVideoTracks()[0];
                    if (oldTrack) localStreamRef.current?.removeTrack(oldTrack);
                    localStreamRef.current?.addTrack(newCamTrack);
                    setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
                    
                    if (videoSender) await videoSender.replaceTrack(newCamTrack).catch(()=>{});
                } catch {
                    console.warn("Could not restore camera after screen share");
                }
            }
            setIsScreenSharing(false);
            if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({ type: "screen-share-stopped" }));
            }
        } else {
            if (!navigator.mediaDevices?.getDisplayMedia) {
                setErrorMessage("Screen sharing is not supported in this browser or requires a secure (HTTPS/localhost) connection.");
                return;
            }

            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }
                });
                const screenTrack = screenStream.getVideoTracks()[0];
                screenTrackRef.current = screenTrack;

                const videoSender = pc?.getSenders().find((s) => s.track?.kind === "video");
                if (videoSender) await videoSender.replaceTrack(screenTrack).catch(()=>{});
                
                const stream = localStreamRef.current;
                if (stream) {
                    const oldTrack = stream.getVideoTracks()[0];
                    if (oldTrack) stream.removeTrack(oldTrack);
                    stream.addTrack(screenTrack);
                    setLocalStream(new MediaStream(stream.getTracks()));
                }

                setIsScreenSharing(true);
                if (socketRef.current?.readyState === WebSocket.OPEN) {
                    socketRef.current.send(JSON.stringify({ type: "screen-share-started" }));
                }

                screenTrack.onended = async () => {
                    screenTrackRef.current = null;
                    const camTrack = cameraTrackRef.current;
                    const endPc = pcRef.current;
                    const endVideoSender = endPc?.getSenders().find((s) => s.track?.kind === "video");

                    if (camTrack && camTrack.readyState === "live") {
                        if (endVideoSender) await endVideoSender.replaceTrack(camTrack).catch(()=>{});
                        
                        const stream = localStreamRef.current;
                        if (stream) {
                            const oldTrack = stream.getVideoTracks()[0];
                            if (oldTrack) stream.removeTrack(oldTrack);
                            stream.addTrack(camTrack);
                            setLocalStream(new MediaStream(stream.getTracks()));
                        }
                    } else {
                        try {
                            const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
                            const newCamTrack = newStream.getVideoTracks()[0];
                            cameraTrackRef.current = newCamTrack;
                            const oldTrack = localStreamRef.current?.getVideoTracks()[0];
                            if (oldTrack) localStreamRef.current?.removeTrack(oldTrack);
                            localStreamRef.current?.addTrack(newCamTrack);
                            setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
                            
                            if (endVideoSender) await endVideoSender.replaceTrack(newCamTrack).catch(()=>{});
                        } catch {
                            console.warn("Could not restore camera after screen share");
                        }
                    }
                    setIsScreenSharing(false);
                    if (socketRef.current?.readyState === WebSocket.OPEN) {
                        socketRef.current.send(JSON.stringify({ type: "screen-share-stopped" }));
                    }
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
    };

    const sendChatMessage = (text, messageType, imageData) => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
        socketRef.current.send(JSON.stringify({ type: "chat-message", text, messageType: messageType || "text", imageData }));
        setChatMessages(prev => [...prev, {
            id: `${Date.now()}-${Math.random()}`,
            sender: "You",
            text,
            timestamp: Date.now(),
            isLocal: true,
            messageType: messageType || "text",
            imageData,
        }]);
    };

    const sendSignal = (data) => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
        socketRef.current.send(JSON.stringify(data));
    };

    const sendRecordingBlob = async (blob, senderName) => {
        const dc = dataChannelRef.current;
        if (!dc || dc.readyState !== "open") {
            console.warn("[DC] DataChannel not open, cannot send recording");
            return false;
        }

        const CHUNK_SIZE = 128 * 1024;
        const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);

        dc.send(JSON.stringify({
            type: "recording-meta",
            name: senderName,
            totalChunks,
            totalSize: blob.size,
        }));

        const arrayBuffer = await blob.arrayBuffer();
        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, blob.size);
            const chunk = arrayBuffer.slice(start, end);

            while (dc.bufferedAmount > 512 * 1024) {
                await new Promise(r => {
                    dc.onbufferedamountlow = () => { dc.onbufferedamountlow = null; r(); };
                    setTimeout(r, 100);
                });
            }

            dc.send(chunk);
        }

        dc.send(JSON.stringify({
            type: "recording-done",
            name: senderName,
        }));

        console.log(`[DC] Sent recording: ${senderName} (${(blob.size / 1024 / 1024).toFixed(1)} MB, ${totalChunks} chunks)`);
        return true;
    };

    const sendReaction = (emoji) => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
        socketRef.current.send(JSON.stringify({ type: "emoji-reaction", emoji }));
    };

    const sendWhiteboardDraw = (point) => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
        socketRef.current.send(JSON.stringify({ type: "whiteboard-draw", point }));
    };

    const sendWhiteboardClear = () => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
        socketRef.current.send(JSON.stringify({ type: "whiteboard-clear" }));
    };

    const sendE2EPublicKey = (publicKeyJwk) => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
        socketRef.current.send(JSON.stringify({ type: "e2e-public-key", publicKeyJwk }));
    };

    return {
        callState,
        localStream,
        remoteStream,
        remoteIsScreenSharing,
        remoteIsAudioMuted,
        remoteIsVideoOff,
        role: null,
        participants: [],
        isAudioMuted,
        isVideoOff,
        isScreenSharing,
        errorMessage,
        chatMessages,
        remoteRecording,
        receivedRecordings,
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
        sendRecordingBlob,
        endCall,
        bgMode: backgroundMode,
        bgUrl: backgroundImageUrl,
        setVirtualBackground,
    };
}
