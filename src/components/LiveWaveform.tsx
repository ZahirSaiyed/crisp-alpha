"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface LiveWaveformProps {
  stream: MediaStream | null;
  isRecording: boolean;
  isPaused?: boolean;
}

export default function LiveWaveform({ stream, isRecording, isPaused = false }: LiveWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [usePulse, setUsePulse] = useState(false);
  const [amplitude, setAmplitude] = useState(0);
  const performanceHistoryRef = useRef<number[]>([]);
  const waveformDataRef = useRef<number[]>([]); // Store waveform history
  const maxDataPoints = 200; // Number of data points to show

  // Initialize audio analyser
  useEffect(() => {
    if (!stream || !isRecording) {
      if (analyserRef.current) {
        analyserRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        setUsePulse(true);
        return;
      }

      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
    } catch (error) {
      console.warn("Failed to initialize audio analyser, using pulse fallback:", error);
      setUsePulse(true);
    }
  }, [stream, isRecording]);

  // Reset waveform data when recording stops
  useEffect(() => {
    if (!isRecording) {
      waveformDataRef.current = [];
    }
  }, [isRecording]);

  // Performance monitoring and waveform rendering
  useEffect(() => {
    if (!isRecording || isPaused || usePulse || !analyserRef.current || !canvasRef.current) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analyser = analyserRef.current;

    const draw = () => {
      const frameStart = performance.now();
      
      // Get time domain data for waveform
      const timeData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(timeData);
      
      // Calculate RMS (root mean square) for this sample
      let sumSquares = 0;
      for (let i = 0; i < timeData.length; i++) {
        const normalized = ((timeData[i] ?? 128) - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / timeData.length);
      
      // Add to waveform history
      waveformDataRef.current.push(rms);
      if (waveformDataRef.current.length > maxDataPoints) {
        waveformDataRef.current.shift();
      }
      
      setAmplitude(rms);

      // Clear canvas
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);

      // Draw waveform left to right
      const centerY = rect.height / 2;
      const dataPoints = waveformDataRef.current.length;
      const pointWidth = rect.width / maxDataPoints;

      ctx.strokeStyle = "#E5484D"; // Red color
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      for (let i = 0; i < dataPoints; i++) {
        const amplitude = waveformDataRef.current[i] ?? 0;
        const x = i * pointWidth;
        // Scale to 95% of height for taller, more visible waves
        const waveHeight = amplitude * centerY * 0.95;
        const y = centerY - waveHeight;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      // Mirror the waveform below center line
      for (let i = dataPoints - 1; i >= 0; i--) {
        const amplitude = waveformDataRef.current[i] ?? 0;
        const x = i * pointWidth;
        const waveHeight = amplitude * centerY * 0.95;
        const y = centerY + waveHeight;
        ctx.lineTo(x, y);
      }

      ctx.closePath();
      ctx.fillStyle = "#E5484D";
      ctx.fill();

      const frameTime = performance.now() - frameStart;
      performanceHistoryRef.current.push(frameTime);
      if (performanceHistoryRef.current.length > 5) {
        performanceHistoryRef.current.shift();
      }

      // Check if we should switch to pulse mode
      const avgFrameTime = performanceHistoryRef.current.reduce((a, b) => a + b, 0) / performanceHistoryRef.current.length;
      if (avgFrameTime > 16 && performanceHistoryRef.current.length === 5) {
        setUsePulse(true);
        return;
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isRecording, isPaused, usePulse]);

  // Pulse mode (fallback)
  useEffect(() => {
    if (!isRecording || isPaused || !usePulse) return;

    let animationFrameId: number | null = null;

    const updatePulse = () => {
      if (!analyserRef.current) {
        // Fallback: use amplitude state if available
        setAmplitude(prev => Math.max(0, prev * 0.95));
        animationFrameId = requestAnimationFrame(updatePulse);
        return;
      }

      const analyser = analyserRef.current;
      const timeData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(timeData);
      
      // Calculate RMS
      let sumSquares = 0;
      for (let i = 0; i < timeData.length; i++) {
        const normalized = ((timeData[i] ?? 128) - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / timeData.length);
      setAmplitude(rms);

      // Add to waveform history
      waveformDataRef.current.push(rms);
      if (waveformDataRef.current.length > maxDataPoints) {
        waveformDataRef.current.shift();
      }

      animationFrameId = requestAnimationFrame(updatePulse);
    };

    animationFrameId = requestAnimationFrame(updatePulse);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isRecording, isPaused, usePulse]);

  if (usePulse) {
    // Pulse ring fallback - make it more visible
    const pulseScale = 1 + amplitude * 0.3;
    const pulseOpacity = 0.6 + amplitude * 0.4; // 60-100% opacity

    return (
      <div className="relative flex items-center justify-center">
        <motion.div
          className="rounded-full border-2"
          style={{
            width: 120,
            height: 120,
            borderColor: "#E5484D",
            opacity: pulseOpacity,
            borderWidth: 3,
          }}
          animate={{
            scale: pulseScale,
          }}
          transition={{
            duration: 0.1,
            ease: "easeOut",
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center w-full">
      <canvas
        ref={canvasRef}
        className="w-full max-w-[500px] h-[120px]"
        style={{ display: isRecording && !isPaused ? "block" : "none" }}
      />
    </div>
  );
}

