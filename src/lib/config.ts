export const config = {
    mqttUrl: process.env.NEXT_PUBLIC_MQTT_URL ?? "ws://localhost:9001",
    inverterSerial: process.env.NEXT_PUBLIC_INVERTER_SERIAL ?? "",
} as const;
