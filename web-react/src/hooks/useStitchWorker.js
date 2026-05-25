import { useCallback, useEffect, useRef, useState } from 'react';

// Owns the stitching Web Worker and surfaces its lifecycle as React state:
// `ready` flips true once opencv.js has initialized inside the worker.
export function useStitchWorker() {
  const workerRef = useRef(null);
  const pendingRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState('');
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const worker = new Worker(new URL('../worker/stitch.worker.js', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const m = e.data;
      switch (m.type) {
        case 'ready':
          setReady(true);
          break;
        case 'progress':
          setProgress(m.message);
          break;
        case 'log':
          setLogs((prev) => [...prev, m.line]);
          break;
        case 'done':
          setRunning(false);
          setProgress('');
          pendingRef.current?.resolve(m.result);
          pendingRef.current = null;
          break;
        case 'error':
          setRunning(false);
          setProgress('');
          setError(m.message);
          pendingRef.current?.reject(new Error(m.message));
          pendingRef.current = null;
          break;
        default:
          break;
      }
    };

    return () => worker.terminate();
  }, []);

  const run = useCallback((payload) => {
    setError('');
    setLogs([]);
    setRunning(true);
    setProgress('準備中...');
    return new Promise((resolve, reject) => {
      pendingRef.current = { resolve, reject };
      workerRef.current.postMessage({ type: 'stitch', payload });
    });
  }, []);

  return { ready, progress, logs, running, error, run, setError };
}
