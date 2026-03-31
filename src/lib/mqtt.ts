"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mqtt, { type MqttClient } from "mqtt";
import { config } from "./config";

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

let sharedClient: MqttClient | null = null;
let refCount = 0;

function getClient(): MqttClient {
    if (!sharedClient || !sharedClient.connected) {
        sharedClient = mqtt.connect(config.mqttUrl, {
            clientId: `battery_client_${Math.random().toString(16).slice(2, 8)}`,
            clean: true,
            reconnectPeriod: 5000,
            connectTimeout: 10000,
        });
    }
    refCount++;
    return sharedClient;
}

function releaseClient() {
    refCount--;
    if (refCount <= 0 && sharedClient) {
        sharedClient.end();
        sharedClient = null;
        refCount = 0;
    }
}

export function useMqtt() {
    const clientRef = useRef<MqttClient | null>(null);
    const [status, setStatus] = useState<ConnectionStatus>("connecting");

    useEffect(() => {
        const client = getClient();
        clientRef.current = client;

        const onConnect = () => setStatus("connected");
        const onClose = () => setStatus("disconnected");
        const onError = () => setStatus("error");
        const onReconnect = () => setStatus("connecting");

        client.on("connect", onConnect);
        client.on("close", onClose);
        client.on("error", onError);
        client.on("reconnect", onReconnect);

        if (client.connected) setStatus("connected");

        return () => {
            client.off("connect", onConnect);
            client.off("close", onClose);
            client.off("error", onError);
            client.off("reconnect", onReconnect);
            releaseClient();
        };
    }, []);

    const subscribe = useCallback(
        (topic: string | string[], callback: (topic: string, message: string) => void) => {
            const client = clientRef.current;
            if (!client) return () => { };

            client.subscribe(topic);

            const handler = (t: string, payload: Buffer) => {
                callback(t, payload.toString());
            };
            client.on("message", handler);

            return () => {
                client.off("message", handler);
                client.unsubscribe(topic);
            };
        },
        [],
    );

    const publish = useCallback((topic: string, message: string) => {
        clientRef.current?.publish(topic, message);
    }, []);

    return { status, subscribe, publish };
}
