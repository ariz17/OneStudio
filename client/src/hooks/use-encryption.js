"use client";

import { useState, useCallback, useRef } from "react";

export function useEncryption() {
    const [state, setState] = useState({
        isReady: false,
        publicKeyJwk: null,
    });

    const keyPairRef = useRef(null);
    const sharedKeyRef = useRef(null);
    const initedRef = useRef(false);

    const initKeys = useCallback(async () => {
        if (initedRef.current) return state.publicKeyJwk;
        initedRef.current = true;

        try {
            const keyPair = await crypto.subtle.generateKey(
                { name: "ECDH", namedCurve: "P-256" },
                true,
                ["deriveKey"]
            );
            keyPairRef.current = keyPair;

            const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
            setState({ isReady: false, publicKeyJwk });
            console.log("[E2E] Key pair generated");
            return publicKeyJwk;
        } catch (err) {
            console.error("[E2E] Key generation failed:", err);
            return null;
        }
    }, [state.publicKeyJwk]);

    const deriveSharedKey = useCallback(async (remotePublicKeyJwk) => {
        if (!keyPairRef.current) {
            console.warn("[E2E] No local key pair yet");
            return;
        }

        try {
            const remotePublicKey = await crypto.subtle.importKey(
                "jwk",
                remotePublicKeyJwk,
                { name: "ECDH", namedCurve: "P-256" },
                false,
                []
            );

            const sharedKey = await crypto.subtle.deriveKey(
                { name: "ECDH", public: remotePublicKey },
                keyPairRef.current.privateKey,
                { name: "AES-GCM", length: 256 },
                false,
                ["encrypt", "decrypt"]
            );

            sharedKeyRef.current = sharedKey;
            setState(prev => ({ ...prev, isReady: true }));
            console.log("[E2E] Shared key derived — encryption active");
        } catch (err) {
            console.error("[E2E] Key derivation failed:", err);
        }
    }, []);

    const encrypt = useCallback(async (text) => {
        if (!sharedKeyRef.current) return null;

        try {
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encoded = new TextEncoder().encode(text);
            const encrypted = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv },
                sharedKeyRef.current,
                encoded
            );

            return {
                iv: btoa(String.fromCharCode(...iv)),
                data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
            };
        } catch (err) {
            console.error("[E2E] Encryption failed:", err);
            return null;
        }
    }, []);

    const decrypt = useCallback(async (ciphertext) => {
        if (!sharedKeyRef.current) return null;

        try {
            const iv = Uint8Array.from(atob(ciphertext.iv), c => c.charCodeAt(0));
            const data = Uint8Array.from(atob(ciphertext.data), c => c.charCodeAt(0));
            const decrypted = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv },
                sharedKeyRef.current,
                data
            );

            return new TextDecoder().decode(decrypted);
        } catch (err) {
            console.error("[E2E] Decryption failed:", err);
            return null;
        }
    }, []);

    return {
        isE2EReady: state.isReady,
        publicKeyJwk: state.publicKeyJwk,
        initKeys,
        deriveSharedKey,
        encrypt,
        decrypt,
    };
}
