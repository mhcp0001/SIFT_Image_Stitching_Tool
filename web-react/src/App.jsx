import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Upload,
  ImageIcon,
  Images,
  Download,
  Loader2,
  SlidersHorizontal,
  Play,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useStitchWorker } from './hooks/useStitchWorker.js';
import { downloadBlob } from './lib/imageUtils.js';

const DEFAULT_PARAMS = {
  detector: 'ORB',
  canvasScale: 2,
  strength: 31,
  minMatches: 12,
  nfeatures: 5000,
  downsampleScale: 0.5,
  ratioTest: 0.75,
};

function Slider({ label, value, min, max, step, suffix, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        <span className="text-gray-400 font-normal"> — {value}{suffix}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-600"
      />
    </div>
  );
}

export default function App() {
  const { ready, progress, logs, running, error, run, setError } = useStitchWorker();

  const [overview, setOverview] = useState(null);
  const [overviewUrl, setOverviewUrl] = useState('');
  const [closeups, setCloseups] = useState([]);
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [advanced, setAdvanced] = useState(false);

  const [resultUrl, setResultUrl] = useState('');
  const [stats, setStats] = useState(null);
  const resultBlobRef = useRef(null);

  const closeupUrls = useMemo(
    () => closeups.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })),
    [closeups]
  );

  useEffect(() => {
    return () => {
      if (overviewUrl) URL.revokeObjectURL(overviewUrl);
      closeupUrls.forEach((c) => URL.revokeObjectURL(c.url));
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overviewUrl, closeupUrls, resultUrl]);

  const setParam = (key) => (val) => setParams((p) => ({ ...p, [key]: val }));

  const handleOverview = (file) => {
    if (!file) return;
    if (overviewUrl) URL.revokeObjectURL(overviewUrl);
    setOverview(file);
    setOverviewUrl(URL.createObjectURL(file));
  };

  const handleCloseups = (files) => {
    if (!files || files.length === 0) return;
    setCloseups(Array.from(files));
  };

  const canStart = ready && !running && overview && closeups.length > 0;

  const handleStart = async () => {
    if (!canStart) return;
    setResultUrl('');
    setStats(null);
    try {
      const payload = {
        overview,
        closeups: closeups.map((f) => ({ name: f.name, blob: f })),
        params,
      };
      const result = await run(payload);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      const url = URL.createObjectURL(result.blob);
      resultBlobRef.current = result.blob;
      setResultUrl(url);
      setStats({ success: result.success, skip: result.skip, total: result.total });
    } catch (err) {
      // error already surfaced via hook state
    }
  };

  const handleDownload = () => {
    if (resultBlobRef.current) downloadBlob(resultBlobRef.current, 'stitched.png');
  };

  const busy = running;

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Sparkles className="text-blue-600" size={32} />
            SIFT/ORB Image Stitching Tool
          </h1>
          <p className="text-slate-500 mt-2">
            高解像度クローズアップ画像を広角画像に合成するツール（ブラウザ完結 / OpenCV.js）
          </p>
          <div className="mt-2 text-sm">
            {ready ? (
              <span className="text-green-600">エンジン準備完了（検出器: {params.detector}）</span>
            ) : (
              <span className="text-amber-600 inline-flex items-center gap-1">
                <Loader2 size={14} className="animate-spin" /> OpenCV.js エンジンをロード中...
              </span>
            )}
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded shadow-sm flex items-start justify-between gap-4">
            <span className="whitespace-pre-wrap">{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">×</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: inputs & params */}
          <div className="space-y-6">
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <ImageIcon size={20} className="text-blue-600" /> 1. 広角画像（Overview）
              </h2>
              <label className="block border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors">
                <Upload className="mx-auto text-gray-400 mb-2" size={28} />
                <span className="text-sm text-gray-600">クリックして広角画像を選択</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => handleOverview(e.target.files?.[0])}
                />
              </label>
              {overviewUrl && (
                <div className="mt-4 text-center">
                  <img src={overviewUrl} alt="overview" className="mx-auto max-h-40 rounded border" />
                  <p className="text-xs text-slate-500 mt-1">{overview?.name}</p>
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Images size={20} className="text-blue-600" /> 2. クローズアップ画像群
              </h2>
              <label className="block border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors">
                <Upload className="mx-auto text-gray-400 mb-2" size={28} />
                <span className="text-sm text-gray-600">複数の画像を選択できます</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  multiple
                  className="hidden"
                  onChange={(e) => handleCloseups(e.target.files)}
                />
              </label>
              {closeupUrls.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-slate-500 mb-2">{closeupUrls.length} 枚選択中</p>
                  <div className="grid grid-cols-4 gap-2">
                    {closeupUrls.map((c) => (
                      <img key={c.url} src={c.url} alt={c.name} className="w-full h-16 object-cover rounded border" />
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <SlidersHorizontal size={20} className="text-blue-600" /> 3. パラメータ調整
              </h2>
              <div className="space-y-4">
                <Slider label="Canvas Scale (出力倍率)" value={params.canvasScale} min={1} max={5} step={1} suffix="x" onChange={setParam('canvasScale')} />
                <Slider label="Blend Strength (ブレンド強度・奇数)" value={params.strength} min={11} max={71} step={2} onChange={setParam('strength')} />
                <Slider label="Min Matches (最小マッチ数)" value={params.minMatches} min={8} max={30} step={1} onChange={setParam('minMatches')} />

                <div className="border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setAdvanced((v) => !v)}
                    className="text-sm font-medium text-slate-700 hover:text-blue-600"
                  >
                    {advanced ? '▼' : '▶'} 詳細設定
                  </button>
                  {advanced && (
                    <div className="mt-4 space-y-4 pl-2 border-l-2 border-blue-100">
                      <Slider label="特徴点数 (nfeatures)" value={params.nfeatures} min={1000} max={10000} step={500} onChange={setParam('nfeatures')} />
                      <Slider label="ダウンサンプリング倍率" value={params.downsampleScale} min={0.3} max={1.0} step={0.1} onChange={setParam('downsampleScale')} />
                      <Slider label="Ratio Test (Lowe)" value={params.ratioTest} min={0.6} max={0.9} step={0.05} onChange={setParam('ratioTest')} />
                    </div>
                  )}
                </div>
              </div>
            </section>

            <button
              onClick={handleStart}
              disabled={!canStart}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white py-3 rounded-xl font-medium transition-colors"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
              <span>{busy ? '処理中...' : '合成を開始'}</span>
            </button>
          </div>

          {/* Right: progress & result */}
          <div className="space-y-6">
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 min-h-[200px] relative">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">合成結果</h2>

              {stats && (
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{stats.success}</p>
                    <p className="text-xs text-slate-500">成功</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-600">{stats.skip}</p>
                    <p className="text-xs text-slate-500">スキップ</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
                    <p className="text-xs text-slate-500">合計</p>
                  </div>
                </div>
              )}

              {resultUrl ? (
                <>
                  <div className="border rounded-lg overflow-hidden mb-4">
                    <img src={resultUrl} alt="stitched result" className="w-full" />
                  </div>
                  <button
                    onClick={handleDownload}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-medium transition-colors"
                  >
                    <Download size={18} /> PNGをダウンロード
                  </button>
                </>
              ) : (
                !busy && <p className="text-sm text-slate-400">ここに合成結果が表示されます。</p>
              )}

              {busy && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex flex-col items-center justify-center text-blue-600 rounded-2xl">
                  <Loader2 size={40} className="animate-spin mb-3" />
                  <span className="font-bold mb-1">処理中</span>
                  <span className="text-sm text-slate-600 text-center px-6">{progress}</span>
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">処理ログ</h3>
              <div className="bg-slate-900 text-green-400 text-xs font-mono p-3 rounded-lg h-56 overflow-y-auto">
                {logs.length === 0 ? (
                  <span className="text-slate-500">ログはまだありません。</span>
                ) : (
                  logs.map((line, i) => {
                    const isSkip = line.includes('[skip]');
                    const isBlend = line.includes('[blend]');
                    return (
                      <div key={i} className={isSkip ? 'text-amber-400' : isBlend ? 'text-green-400' : 'text-slate-300'}>
                        {isSkip && <XCircle size={11} className="inline mr-1" />}
                        {isBlend && <CheckCircle2 size={11} className="inline mr-1" />}
                        {line}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
