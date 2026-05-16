"use client";
interface Window {
    webkitAudioContext: typeof AudioContext;
    MediaRecorder: typeof MediaRecorder;
}

declare module "*.css";
declare module "*.module.css" {
    const classes: { [key: string]: string };
    export default classes;
}
