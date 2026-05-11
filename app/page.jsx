'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const PROXY = '/api/ai84';

const EL_MODELS = [
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2' },
  { id: 'eleven_turbo_v2_5',      name: 'Turbo v2.5'      },
  { id: 'eleven_flash_v2_5',      name: 'Flash v2.5'      },
  { id: 'eleven_turbo_v2',        name: 'Turbo v2'        },
  { id: 'eleven_flash_v2',        name: 'Flash v2'        },
  { id: 'eleven_v3',              name: 'v3 ✦ Paid'       },
];

const MM_MODELS = [
  { id: 'speech-2.6-turbo', name: '2.6 Turbo' },
  { id: 'speech-2.6-hd',   name: '2.6 HD'    },
  { id: 'speech-02-hd',    name: '02 HD'      },
  { id: 'speech-02-turbo', name: '02 Turbo'   },
  { id: 'speech-01-hd',    name: '01 HD'      },
  { id: 'speech-01-turbo', name: '01 Turbo'   },
];

const PAUSE_OPTS = [
  { label: '0s', ms: 0    },
  { label: '1s', ms: 1000 },
  { label: '2s', ms: 2000 },
  { label: '3s', ms: 3000 },
  { label: '5s', ms: 5000 },
  { label: '6s', ms: 6000 },
];

// All ElevenLabs use_cases — comma-separated per API docs example
const EL_USE_CASES =
  'conversational,narrative_story,social_media,characters_animation,informative_educational,advertisement,entertainment_tv';

// ── API helpers ───────────────────────────────────────────────
async function apiFetch(path, { method = 'GET', body, apiKey, authToken } = {}) {
  const headers = {};
  if (apiKey)    headers['x-api-key']    = apiKey;
  if (authToken) headers['x-auth-token'] = authToken;
  if (body)      headers['Content-Type'] = 'application/json';
  const res  = await fetch(`${PROXY}/${path}`, {
    method, headers, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || data?.error || data?.details || `HTTP Error ${res.status}`);
  return data;
}

// Build the audio URL through our server-side proxy (avoids CORS + relative CDN paths)
function audioProxyUrl(taskId, apiKey) {
  return `/api/audio/${taskId}?key=${encodeURIComponent(apiKey)}`;
}

// Poll job until done, then return the proxy audio URL
async function pollUntilDone(statusPath, taskId, apiKey, onProgress) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = async () => {
      if (attempts++ > 80) { reject(new Error('Timed out — try again')); return; }
      try {
        const data   = await apiFetch(statusPath, { apiKey });
        // TTS response wraps in data.job; dialogue response is flat
        const job    = (data.job && typeof data.job === 'object') ? data.job : data;
        const status = job.status;

        if (status !== 'done' && status !== 'failed') {
          const p = job.progress;
          if      (typeof p === 'number')         onProgress?.(`${p}%`);
          else if (p?.segments_done != null)      onProgress?.(`${p.segments_done}/${p.segments_total} segments`);
          else                                    onProgress?.('Processing...');
          setTimeout(check, 2500);
          return;
        }

        if (status === 'done') {
          // Use our audio proxy (handles relative CDN paths + CORS server-side)
          resolve({ audioUrl: audioProxyUrl(taskId, apiKey), taskId });
        } else {
          reject(new Error(job.error_message || data.error_message || 'Job failed'));
        }
      } catch (e) { reject(e); }
    };
    check();
  });
}

// ── Icons ─────────────────────────────────────────────────────
const IPlay  = () => <svg width="9" height="10" viewBox="0 0 9 10" fill="currentColor"><polygon points="0,0 9,5 0,10"/></svg>;
const IStop  = () => <svg width="8" height="8"  viewBox="0 0 8 8"  fill="currentColor"><rect width="8" height="8" rx="1.5"/></svg>;
const ICheck = () => <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1,5.5 3.5,8.5 10,2"/></svg>;
const ISpin  = () => (
  <svg className="spin shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>
);

// ── Atoms ─────────────────────────────────────────────────────
const Lbl = ({ children, sub }) => (
  <div className="flex items-baseline gap-2 mb-2">
    <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-500">{children}</span>
    {sub && <span className="text-[10px] text-gray-700">{sub}</span>}
  </div>
);

const Chip = ({ label, active, onClick }) => (
  <button onClick={onClick}
    style={active ? { background: 'var(--accent)', color: '#0a0c10' } : {}}
    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all select-none ${active ? '' : 'bg-[var(--surface3)] text-gray-400 hover:text-white'}`}>
    {label}
  </button>
);

const ProviderToggle = ({ value, onChange }) => (
  <div className="flex gap-2">
    {[['elevenlabs','ElevenLabs'],['minimax','Minimax']].map(([id, lbl]) => (
      <button key={id} onClick={() => onChange(id)}
        style={value === id ? { background: 'var(--accent)', color: '#0a0c10' } : {}}
        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${value === id ? '' : 'bg-[var(--surface3)] text-gray-400 hover:text-white'}`}>
        {lbl}
      </button>
    ))}
  </div>
);

const StabilityPicker = ({ value, onChange }) => (
  <div className="flex gap-2">
    {[0, 0.5, 1].map(v => (
      <button key={v} onClick={() => onChange(v)}
        style={value === v ? { background: 'var(--accent)', color: '#0a0c10' } : {}}
        className={`flex-1 py-2 rounded-xl text-sm font-bold mono transition-all ${value === v ? '' : 'bg-[var(--surface3)] text-gray-400 hover:text-white'}`}>
        {v}
      </button>
    ))}
  </div>
);

const MmSlider = ({ label, k, min, max, step, s, set }) => (
  <div>
    <div className="flex justify-between mb-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-bold mono" style={{ color: 'var(--accent)' }}>{s[k]}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={s[k]}
      onChange={e => set(p => ({ ...p, [k]: k === 'pitch' ? parseInt(e.target.value) : parseFloat(e.target.value) }))} />
  </div>
);

const MmSettings = ({ s, set }) => (
  <div className="space-y-3">
    <MmSlider label="Speed"  k="speed"  min={0.5} max={2}  step={0.1} s={s} set={set} />
    <MmSlider label="Pitch"  k="pitch"  min={-12} max={12} step={1}   s={s} set={set} />
    <MmSlider label="Volume" k="volume" min={0}   max={10} step={0.5} s={s} set={set} />
  </div>
);

const StatusBar = ({ msg, error }) => {
  if (!msg && !error) return null;
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${error
      ? 'bg-red-950/50 border border-red-800/40 text-red-300'
      : 'border border-[var(--border)] text-gray-400'}`}
      style={!error ? { background: 'var(--surface3)' } : {}}>
      {!error && <ISpin />}
      {error ? `⚠ ${error}` : msg}
    </div>
  );
};

const AudioResult = ({ audioUrl }) => {
  if (!audioUrl) return null;
  return (
    <div className="rounded-2xl border border-[var(--border)] overflow-hidden mt-2">
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-[var(--border)]"
        style={{ background: 'var(--surface3)' }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
          <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Generated Audio</span>
        </div>
        <a href={audioUrl} download className="text-xs font-bold px-3 py-1.5 rounded-lg"
          style={{ background: 'var(--accent)', color: '#0a0c10' }}>
          ↓ Download
        </a>
      </div>
      <div className="p-4" style={{ background: 'var(--surface2)' }}>
        <audio controls src={audioUrl} className="w-full" />
      </div>
    </div>
  );
};

// ── Voice Selector ────────────────────────────────────────────
function VoiceSelector({ provider, apiKey, value, onChange }) {
  const [voices,    setVoices]    = useState([]);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(false);
  const [loadErr,   setLoadErr]   = useState('');
  const [page,      setPage]      = useState(0);
  const [hasMore,   setHasMore]   = useState(false);
  const [manual,    setManual]    = useState(false);
  const [manualVal, setManualVal] = useState('');
  const [previewId, setPreviewId] = useState(null);
  const debRef = useRef(null);
  const audRef = useRef(null);

  const stopPreview = () => {
    audRef.current?.pause();
    audRef.current = null;
    setPreviewId(null);
  };

  const togglePreview = (e, vid, url) => {
    e.stopPropagation();
    if (!url) return;
    if (previewId === vid) { stopPreview(); return; }
    stopPreview();
    const a = new Audio(url);
    a.play().catch(() => {});
    a.onended = () => setPreviewId(null);
    audRef.current = a;
    setPreviewId(vid);
  };

  useEffect(() => () => stopPreview(), []);

  const load = useCallback(async (p, q) => {
    if (!apiKey) return;
    setLoading(true);
    setLoadErr('');
    try {
      if (provider === 'elevenlabs') {
        // API docs example: use_cases as comma-separated single param (URL-encoded)
        const url = `v1/shared-voices?page=${p}&page_size=100&sort=trending`
          + `&search=${encodeURIComponent(q)}`
          + `&use_cases=${encodeURIComponent(EL_USE_CASES)}`;
        const data = await apiFetch(url, { apiKey });
        const list = data.voices || [];
        setVoices(v => p === 0 ? list : [...v, ...list]);
        setHasMore(!!data.has_more);
      } else {
        // Minimax: page is 1-based per API docs
        const url = `v1/minimax/voices?page=${p + 1}&page_size=100`
          + `&search=${encodeURIComponent(q)}`;
        const data = await apiFetch(url, { apiKey });
        const list = data.data || [];
        setVoices(v => p === 0 ? list : [...v, ...list]);
        setHasMore(list.length === 100);
      }
    } catch (e) {
      setLoadErr(e.message);
      console.error('[Voice load]', e);
    } finally {
      setLoading(false);
    }
  }, [provider, apiKey]);

  useEffect(() => {
    setPage(0); setVoices([]); setSearch('');
    setManual(false); setManualVal('');
    stopPreview(); setLoadErr('');
    if (apiKey) load(0, '');
  }, [provider, apiKey]);

  const doSearch = q => {
    setSearch(q); setPage(0); setVoices([]);
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => load(0, q), 400);
  };

  const vid   = v => v.voice_id || v.canonical_voice_id;
  const vname = v => v.name || vid(v);
  const vprev = v => v.preview_url || v.preview_audio_url || null;
  const selected = voices.find(v => vid(v) === value);

  if (manual) return (
    <div className="flex gap-2">
      <input value={manualVal}
        onChange={e => { setManualVal(e.target.value); onChange(e.target.value); }}
        placeholder="Paste Voice ID..."
        className="flex-1 mono text-sm bg-[var(--surface3)] border border-[var(--border)] rounded-xl px-3 py-2 focus:outline-none focus:border-[var(--accent2)] placeholder-gray-700" />
      <button onClick={() => setManual(false)}
        className="px-3 text-xs text-gray-500 hover:text-white bg-[var(--surface3)] border border-[var(--border)] rounded-xl">
        Browse
      </button>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={search} onChange={e => doSearch(e.target.value)}
          placeholder={`Search ${provider === 'elevenlabs' ? 'ElevenLabs' : 'Minimax'} voices...`}
          className="flex-1 text-sm bg-[var(--surface3)] border border-[var(--border)] rounded-xl px-3 py-2 focus:outline-none focus:border-[var(--accent2)] placeholder-gray-700" />
        <button onClick={() => setManual(true)}
          className="px-3 text-xs text-gray-500 hover:text-white bg-[var(--surface3)] border border-[var(--border)] rounded-xl whitespace-nowrap">
          + ID
        </button>
      </div>

      {!apiKey && <p className="text-xs text-gray-600 text-center py-4">Set API key to browse voices</p>}
      {loadErr  && <p className="text-xs text-red-400 px-1">⚠ {loadErr}</p>}

      {apiKey && (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden" style={{ background: 'var(--surface2)' }}>
          {loading && voices.length === 0 && (
            <div className="py-8 flex items-center justify-center gap-2 text-xs text-gray-600">
              <ISpin /> Loading voices...
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 max-h-64 overflow-y-auto">
            {voices.map(v => {
              const id      = vid(v);
              const isActive = value === id;
              const isPlay   = previewId === id;
              const prev     = vprev(v);

              return (
                <button key={id} onClick={() => onChange(id)}
                  style={isActive ? { background: 'var(--accent)', color: '#0a0c10' } : {}}
                  className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors border-b border-r border-[var(--border)] ${isActive ? '' : 'hover:bg-[var(--surface3)]'}`}>

                  {/* Preview button */}
                  <button
                    onClick={e => togglePreview(e, id, prev)}
                    disabled={!prev}
                    title={prev ? 'Preview voice' : 'No preview'}
                    style={isPlay
                      ? { background: '#000', color: 'var(--accent)', border: '1px solid var(--accent)' }
                      : isActive
                        ? { background: 'rgba(0,0,0,0.18)', color: '#0a0c10', border: '1px solid rgba(0,0,0,0.1)' }
                        : { background: 'var(--surface3)', color: '#666', border: '1px solid var(--border)' }}
                    className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${prev ? 'hover:opacity-80' : 'opacity-30 cursor-not-allowed'}`}>
                    {isPlay ? <IStop /> : <IPlay />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">{vname(v)}</div>
                    {(v.gender || v.language) && (
                      <div className={`text-[10px] mt-0.5 truncate ${isActive ? 'text-black/50' : 'text-gray-600'}`}>
                        {[v.gender, v.language].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>

                  {isActive && <span className="shrink-0"><ICheck /></span>}
                </button>
              );
            })}
          </div>

          {voices.length === 0 && !loading && (
            <p className="text-xs text-gray-600 text-center py-4">No voices found</p>
          )}

          {hasMore && (
            <button onClick={() => { const np = page + 1; setPage(np); load(np, search); }}
              className="w-full py-2.5 text-xs text-gray-500 hover:text-gray-300 border-t border-[var(--border)] transition-colors">
              {loading ? <span className="flex items-center justify-center gap-2"><ISpin />Loading...</span> : '↓ Load more'}
            </button>
          )}
        </div>
      )}

      {value && (
        <div className="flex items-center gap-2 px-1">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
          <span className="text-[10px] mono text-gray-500 truncate">{selected?.name || value}</span>
        </div>
      )}
    </div>
  );
}

// ── Settings Modal ────────────────────────────────────────────
function SettingsModal({ isOpen, onClose, apiKey, setApiKey }) {
  const [draft,   setDraft]   = useState(apiKey);
  const [email,   setEmail]   = useState('');
  const [pw,      setPw]      = useState('');
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState('');
  const [testMsg, setTestMsg] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => { if (isOpen) { setDraft(apiKey); setTestMsg(''); } }, [isOpen, apiKey]);

  const testConnection = async () => {
    if (!draft) { setTestMsg('⚠ Enter API key first'); return; }
    setTesting(true); setTestMsg('Testing...');
    try {
      const data = await apiFetch('v1/models?tts_only=true', { apiKey: draft });
      const count = data.data?.length || 0;
      setTestMsg(`✅ Connected! ${count} models available`);
    } catch (e) {
      setTestMsg(`❌ Failed: ${e.message}`);
    } finally { setTesting(false); }
  };

  const save = () => { setApiKey(draft); localStorage.setItem('ai84_key', draft); onClose(); };

  const login = async () => {
    setBusy(true); setErr('');
    try {
      const auth = await apiFetch('v1/auth/login', { method: 'POST', body: { email, password: pw } });
      if (!auth.token) throw new Error('Login failed');
      const keys = await apiFetch('v1/auth/api-key', { authToken: auth.token });
      const key  = keys.data?.[0]?.apiKey;
      if (!key) throw new Error('No API key found');
      setDraft(key); setApiKey(key); localStorage.setItem('ai84_key', key); onClose();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)]" style={{ background: 'var(--surface2)' }}>
        <div className="px-5 py-4 border-b border-[var(--border)] flex justify-between items-center">
          <span className="font-bold text-sm">API Settings</span>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-[var(--surface3)] text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <Lbl>API Key</Lbl>
            <div className="flex gap-2">
              <input value={draft} onChange={e => setDraft(e.target.value)} type="password"
                placeholder="sk-user-xxxxxxxx"
                className="flex-1 mono text-sm bg-[var(--surface3)] border border-[var(--border)] rounded-xl px-3 py-2.5 focus:outline-none focus:border-[var(--accent2)] placeholder-gray-700" />
              <button onClick={save}
                className="px-4 rounded-xl text-sm font-bold"
                style={{ background: 'var(--accent)', color: '#0a0c10' }}>Save</button>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={testConnection} disabled={testing || !draft}
                className="flex-1 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] text-gray-400 hover:text-white disabled:opacity-40 transition-colors"
                style={{ background: 'var(--surface3)' }}>
                {testing ? '⏳ Testing...' : '🔌 Test Connection'}
              </button>
            </div>
            {testMsg && (
              <p className={`text-xs mt-1 px-1 ${testMsg.startsWith('✅') ? 'text-green-400' : testMsg.startsWith('❌') ? 'text-red-400' : 'text-gray-400'}`}>
                {testMsg}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="text-[10px] text-gray-600">or login to get key</span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>
          <div className="space-y-2">
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
              className="w-full text-sm bg-[var(--surface3)] border border-[var(--border)] rounded-xl px-3 py-2.5 focus:outline-none focus:border-[var(--accent2)] placeholder-gray-700" />
            <input value={pw} onChange={e => setPw(e.target.value)} placeholder="Password" type="password"
              className="w-full text-sm bg-[var(--surface3)] border border-[var(--border)] rounded-xl px-3 py-2.5 focus:outline-none focus:border-[var(--accent2)] placeholder-gray-700" />
            {err && <p className="text-red-400 text-xs">{err}</p>}
            <button onClick={login} disabled={busy || !email || !pw}
              className="w-full py-2.5 rounded-xl text-sm font-semibold border border-[var(--border)] text-gray-300 hover:text-white disabled:opacity-40 transition-colors"
              style={{ background: 'var(--surface3)' }}>
              {busy ? 'Authenticating...' : 'Login & Fetch API Key'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TTS Tab ───────────────────────────────────────────────────
function TTSTab({ apiKey }) {
  const [provider,  setProvider]  = useState('elevenlabs');
  const [model,     setModel]     = useState('eleven_multilingual_v2');
  const [voiceId,   setVoiceId]   = useState('');
  const [stability, setStability] = useState(0.5);
  const [mm,        setMm]        = useState({ speed: 1, pitch: 0, volume: 1 });
  const [format,    setFormat]    = useState('mp3');
  const [pauseMs,   setPauseMs]   = useState(1000);
  const [text,      setText]      = useState('');
  const [busy,      setBusy]      = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error,     setError]     = useState('');
  const [result,    setResult]    = useState(null);

  const models = provider === 'elevenlabs' ? EL_MODELS : MM_MODELS;

  useEffect(() => {
    setModel(provider === 'elevenlabs' ? 'eleven_multilingual_v2' : 'speech-2.6-turbo');
    setVoiceId(''); setResult(null);
  }, [provider]);

  const outFmt = () => provider === 'elevenlabs'
    ? (format === 'mp3' ? 'mp3_44100_128' : 'pcm_44100') : format;

  const generate = async () => {
    if (!apiKey)      { setError('Set API key in Settings ⚙'); return; }
    if (!voiceId)     { setError('Select a voice'); return; }
    if (!text.trim()) { setError('Enter some text'); return; }
    setError(''); setResult(null); setBusy(true);
    const lines = text.split('\n').filter(l => l.trim());
    try {
      let taskId, statusPath;

      if (lines.length === 1) {
        // Single line → standard TTS endpoint
        if (provider === 'elevenlabs') {
          setStatusMsg('Submitting TTS job...');
          const r = await apiFetch('v2/text-to-speech/async', {
            method: 'POST', apiKey,
            body: {
              text: lines[0], voice_id: voiceId, model_id: model,
              output_format: outFmt(), voice_settings: { stability },
            },
          });
          taskId = r.job_id;
          statusPath = `v2/text-to-speech/async/${taskId}`;
        } else {
          setStatusMsg('Submitting Minimax TTS job...');
          const r = await apiFetch('v1/minimax/text-to-speech/async', {
            method: 'POST', apiKey,
            body: {
              canonical_voice_id: voiceId, text: lines[0],
              model: model, ...mm, format,
            },
          });
          taskId = r.job_id;
          statusPath = `v1/minimax/text-to-speech/async/${taskId}`;
        }
      } else {
        // Multi-line → dialogue API with single speaker (handles pause between lines)
        setStatusMsg('Submitting multi-line job...');
        const r = await apiFetch('v2/text-to-dialogue/async', {
          method: 'POST', apiKey,
          body: {
            provider,
            speakers: [{
              id: 1, voice_id: voiceId, model_id: model,
              voice_settings: provider === 'elevenlabs' ? { stability } : mm,
            }],
            inputs: lines.map(l => ({ speaker_id: 1, text: l.trim() })),
            pause_between_turns_ms: pauseMs,
            output_format: outFmt(),
          },
        });
        taskId = r.task_id;
        statusPath = `v2/text-to-dialogue/async/${taskId}`;
      }

      setStatusMsg('Processing...');
      const { audioUrl } = await pollUntilDone(statusPath, taskId, apiKey,
        p => setStatusMsg(`Processing ${p}`)
      );
      setResult({ audioUrl }); setStatusMsg('');
    } catch (e) { setError(e.message); setStatusMsg(''); }
    finally { setBusy(false); }
  };

  const lineCount = text.split('\n').filter(l => l.trim()).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: settings */}
        <div className="space-y-4">
          <div>
            <Lbl>Provider</Lbl>
            <ProviderToggle value={provider} onChange={setProvider} />
          </div>
          <div>
            <Lbl>Model</Lbl>
            <select value={model} onChange={e => setModel(e.target.value)}
              className="w-full text-sm bg-[var(--surface3)] border border-[var(--border)] rounded-xl px-3 py-2.5 pr-8 focus:outline-none focus:border-[var(--accent2)] text-gray-200">
              {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <Lbl>{provider === 'elevenlabs' ? 'Stability' : 'Voice Settings'}</Lbl>
            {provider === 'elevenlabs'
              ? <StabilityPicker value={stability} onChange={setStability} />
              : <MmSettings s={mm} set={setMm} />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Lbl>Format</Lbl>
              <div className="flex gap-2">
                <Chip label="MP3" active={format === 'mp3'} onClick={() => setFormat('mp3')} />
                <Chip label="WAV" active={format === 'wav'} onClick={() => setFormat('wav')} />
              </div>
            </div>
            <div>
              <Lbl>Pause / line</Lbl>
              <div className="flex flex-wrap gap-1">
                {PAUSE_OPTS.map(p => (
                  <Chip key={p.ms} label={p.label} active={pauseMs === p.ms} onClick={() => setPauseMs(p.ms)} />
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Right: voice selector */}
        <div>
          <Lbl>Voice</Lbl>
          <VoiceSelector provider={provider} apiKey={apiKey} value={voiceId} onChange={setVoiceId} />
        </div>
      </div>

      <div>
        <Lbl sub={lineCount > 1 ? `${lineCount} lines · ${pauseMs / 1000}s pause between` : 'single line'}>Text</Lbl>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={6}
          placeholder={"Hello, welcome to TTS Studio.\nEach new line gets a pause.\nPerfect for narration scripts."}
          className="w-full mono text-sm bg-[var(--surface3)] border border-[var(--border)] rounded-2xl px-4 py-3 focus:outline-none focus:border-[var(--accent2)] resize-none placeholder-gray-700 leading-relaxed" />
        <div className="text-right text-[10px] mono text-gray-700 mt-1">{text.length.toLocaleString()} chars</div>
      </div>

      <StatusBar msg={statusMsg} error={error} />

      <button onClick={generate} disabled={busy}
        className="w-full py-4 rounded-2xl font-bold tracking-widest text-sm transition-all hover:opacity-90 disabled:opacity-40"
        style={{
          background: busy ? 'var(--surface3)' : 'var(--accent)',
          color: busy ? 'var(--accent)' : '#0a0c10',
          border: busy ? '1px solid var(--border)' : 'none',
        }}>
        {busy
          ? <span className="flex items-center justify-center gap-2"><ISpin />{statusMsg || 'Generating...'}</span>
          : '▶  GENERATE AUDIO'}
      </button>

      {result && <AudioResult audioUrl={result.audioUrl} />}
    </div>
  );
}

// ── Speaker Card ──────────────────────────────────────────────
function SpeakerCard({ num, color, provider, apiKey, voice, setVoice, model, setModel, stab, setStab, mm, setMm, muted, toggleMute }) {
  const models = provider === 'elevenlabs' ? EL_MODELS : MM_MODELS;
  return (
    <div className={`rounded-2xl border p-4 space-y-4 transition-all ${muted ? 'opacity-40' : ''}`}
      style={{ borderColor: muted ? 'var(--border)' : color + '40', background: 'var(--surface2)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: muted ? '#444' : color }} />
          <span className="text-sm font-bold" style={{ color: muted ? '#555' : color }}>Speaker {num}</span>
        </div>
        <button onClick={toggleMute}
          className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-all ${muted
            ? 'border-gray-700 text-gray-600' : 'border-[var(--border)] text-gray-400 hover:text-white'}`}>
          {muted ? '🔇 Muted' : '🔊 Mute'}
        </button>
      </div>
      <div>
        <Lbl>Voice</Lbl>
        <VoiceSelector provider={provider} apiKey={apiKey} value={voice} onChange={setVoice} />
      </div>
      <div>
        <Lbl>Model</Lbl>
        <select value={model} onChange={e => setModel(e.target.value)}
          className="w-full text-sm bg-[var(--surface3)] border border-[var(--border)] rounded-xl px-3 py-2 pr-8 focus:outline-none focus:border-[var(--accent2)] text-gray-200">
          {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div>
        <Lbl>{provider === 'elevenlabs' ? 'Stability' : 'Voice Settings'}</Lbl>
        {provider === 'elevenlabs'
          ? <StabilityPicker value={stab} onChange={setStab} />
          : <MmSettings s={mm} set={setMm} />}
      </div>
    </div>
  );
}

// ── Dialogue Tab ──────────────────────────────────────────────
function DialogueTab({ apiKey }) {
  const [provider,  setProvider]  = useState('elevenlabs');
  const [format,    setFormat]    = useState('mp3');
  const [pauseMs,   setPauseMs]   = useState(500);
  const [script,    setScript]    = useState('');
  const [muted,     setMuted]     = useState(null);
  const [busy,      setBusy]      = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error,     setError]     = useState('');
  const [result,    setResult]    = useState(null);

  const [s1Voice, setS1Voice] = useState('');
  const [s1Model, setS1Model] = useState('eleven_multilingual_v2');
  const [s1Stab,  setS1Stab]  = useState(0.5);
  const [s1Mm,    setS1Mm]    = useState({ speed: 1, pitch: 0, volume: 1 });

  const [s2Voice, setS2Voice] = useState('');
  const [s2Model, setS2Model] = useState('eleven_multilingual_v2');
  const [s2Stab,  setS2Stab]  = useState(0.5);
  const [s2Mm,    setS2Mm]    = useState({ speed: 1, pitch: 0, volume: 1 });

  useEffect(() => {
    const def = provider === 'elevenlabs' ? 'eleven_multilingual_v2' : 'speech-2.6-turbo';
    setS1Model(def); setS2Model(def);
    setS1Voice(''); setS2Voice(''); setResult(null);
  }, [provider]);

  const parseTurns = () => script.split('\n')
    .filter(l => /^#[12]\s/.test(l.trim()))
    .map(l => { const m = l.trim().match(/^#([12])\s+(.*)/); return m ? { speaker_id: parseInt(m[1]), text: m[2].trim() } : null; })
    .filter(Boolean);

  const outFmt = () => provider === 'elevenlabs'
    ? (format === 'mp3' ? 'mp3_44100_128' : 'pcm_44100') : format;

  const generate = async () => {
    if (!apiKey) { setError('Set API key in Settings ⚙'); return; }
    const turns  = parseTurns();
    if (!turns.length) { setError('No dialogue found. Use #1 and #2 to mark speakers.'); return; }
    const active = muted ? turns.filter(t => t.speaker_id !== muted) : turns;
    if (!active.length) { setError('All turns are muted.'); return; }
    const ids = [...new Set(active.map(t => t.speaker_id))];
    if (ids.includes(1) && !s1Voice) { setError('Select a voice for Speaker 1'); return; }
    if (ids.includes(2) && !s2Voice) { setError('Select a voice for Speaker 2'); return; }
    setError(''); setResult(null); setBusy(true); setStatusMsg('Submitting dialogue...');
    try {
      const mkSpk = id => ({
        id, voice_id: id === 1 ? s1Voice : s2Voice,
        model_id: id === 1 ? s1Model : s2Model,
        voice_settings: provider === 'elevenlabs'
          ? { stability: id === 1 ? s1Stab : s2Stab }
          : (id === 1 ? s1Mm : s2Mm),
      });
      const r = await apiFetch('v2/text-to-dialogue/async', {
        method: 'POST', apiKey,
        body: {
          provider, speakers: ids.map(mkSpk), inputs: active,
          pause_between_turns_ms: pauseMs, output_format: outFmt(),
        },
      });
      setStatusMsg('Processing...');
      const { audioUrl } = await pollUntilDone(
        `v2/text-to-dialogue/async/${r.task_id}`, r.task_id, apiKey,
        p => setStatusMsg(`Processing ${p}`)
      );
      setResult({ audioUrl }); setStatusMsg('');
    } catch (e) { setError(e.message); setStatusMsg(''); }
    finally { setBusy(false); }
  };

  const turns = parseTurns();

  return (
    <div className="space-y-5">
      <div>
        <Lbl>Provider</Lbl>
        <ProviderToggle value={provider} onChange={setProvider} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SpeakerCard num={1} color="#e8ff47" provider={provider} apiKey={apiKey}
          voice={s1Voice} setVoice={setS1Voice} model={s1Model} setModel={setS1Model}
          stab={s1Stab} setStab={setS1Stab} mm={s1Mm} setMm={setS1Mm}
          muted={muted === 1} toggleMute={() => setMuted(muted === 1 ? null : 1)} />
        <SpeakerCard num={2} color="#00e5ff" provider={provider} apiKey={apiKey}
          voice={s2Voice} setVoice={setS2Voice} model={s2Model} setModel={setS2Model}
          stab={s2Stab} setStab={setS2Stab} mm={s2Mm} setMm={setS2Mm}
          muted={muted === 2} toggleMute={() => setMuted(muted === 2 ? null : 2)} />
      </div>

      {muted && (
        <div className="text-xs px-4 py-3 rounded-xl border"
          style={{ borderColor: '#f59e0b44', background: '#f59e0b08', color: '#fbbf24' }}>
          🎧 Speaker {muted} muted — only Speaker {muted === 1 ? 2 : 1} plays.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Lbl>Format</Lbl>
          <div className="flex gap-2">
            <Chip label="MP3" active={format === 'mp3'} onClick={() => setFormat('mp3')} />
            <Chip label="WAV" active={format === 'wav'} onClick={() => setFormat('wav')} />
          </div>
        </div>
        <div>
          <Lbl>Pause between turns</Lbl>
          <div className="flex flex-wrap gap-1">
            {PAUSE_OPTS.map(p => (
              <Chip key={p.ms} label={p.label} active={pauseMs === p.ms} onClick={() => setPauseMs(p.ms)} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <Lbl sub="use #1 and #2">Script</Lbl>
          <textarea value={script} onChange={e => setScript(e.target.value)} rows={10}
            placeholder={"#1 Hello! How are you today?\n#2 I'm great, thanks!\n#1 Shall we get started?\n#2 Yes, let's begin!"}
            className="w-full mono text-sm bg-[var(--surface3)] border border-[var(--border)] rounded-2xl px-4 py-3 focus:outline-none focus:border-[var(--accent2)] resize-none placeholder-gray-700 leading-loose" />
        </div>
        {turns.length > 0 && (
          <div>
            <Lbl sub={`${turns.length} turns`}>Preview</Lbl>
            <div className="rounded-2xl border border-[var(--border)] max-h-64 overflow-y-auto p-3 space-y-2"
              style={{ background: 'var(--surface2)' }}>
              {turns.map((t, i) => (
                <div key={i} className={`flex gap-2 items-start text-xs ${muted === t.speaker_id ? 'opacity-20 line-through' : ''}`}>
                  <span className="font-bold mono shrink-0" style={{ color: t.speaker_id === 1 ? '#e8ff47' : '#00e5ff' }}>#{t.speaker_id}</span>
                  <span className="text-gray-400 leading-relaxed">{t.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <StatusBar msg={statusMsg} error={error} />

      <button onClick={generate} disabled={busy}
        className="w-full py-4 rounded-2xl font-bold tracking-widest text-sm transition-all hover:opacity-90 disabled:opacity-40"
        style={{
          background: busy ? 'var(--surface3)' : 'var(--accent2)',
          color: busy ? 'var(--accent2)' : '#0a0c10',
          border: busy ? '1px solid var(--border)' : 'none',
        }}>
        {busy
          ? <span className="flex items-center justify-center gap-2"><ISpin />{statusMsg || 'Generating...'}</span>
          : '▶  GENERATE DIALOGUE'}
      </button>

      {result && <AudioResult audioUrl={result.audioUrl} />}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────
export default function Home() {
  const [tab,     setTab]     = useState('tts');
  const [apiKey,  setApiKey]  = useState('');
  const [showStt, setShowStt] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('ai84_key');
    if (saved) setApiKey(saved); else setShowStt(true);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface)' }}>
      <SettingsModal isOpen={showStt} onClose={() => setShowStt(false)} apiKey={apiKey} setApiKey={setApiKey} />

      <header className="sticky top-0 z-40 border-b border-[var(--border)]"
        style={{ background: 'rgba(13,14,17,0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-[10px]"
              style={{ background: 'var(--accent)', color: '#0a0c10' }}>TTS</div>
            <div>
              <div className="text-sm font-bold">TTS Studio</div>
              <div className="text-[10px] text-gray-600">AI84pro</div>
            </div>
          </div>

          <div className="hidden sm:flex border border-[var(--border)] rounded-xl overflow-hidden" style={{ background: 'var(--surface3)' }}>
            {[['tts','🎤 Text to Speech'],['dialogue','💬 Dialogue']].map(([id, lbl]) => (
              <button key={id} onClick={() => setTab(id)}
                style={tab === id ? { background: 'var(--accent)', color: '#0a0c10' } : {}}
                className={`px-5 py-2 text-xs font-bold tracking-wide transition-all ${tab === id ? '' : 'text-gray-400 hover:text-white'}`}>
                {lbl}
              </button>
            ))}
          </div>

          <button onClick={() => setShowStt(true)}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl border border-[var(--border)] hover:border-gray-600 transition-colors"
            style={{ background: 'var(--surface3)' }}>
            <span>⚙</span>
            <span className="mono hidden sm:inline" style={{ color: apiKey ? 'var(--accent)' : '#555' }}>
              {apiKey ? `···${apiKey.slice(-6)}` : 'Set Key'}
            </span>
          </button>
        </div>

        <div className="sm:hidden flex border-t border-[var(--border)]">
          {[['tts','🎤 TTS'],['dialogue','💬 Dialogue']].map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all ${tab === id ? 'text-white' : 'text-gray-500 border-transparent'}`}
              style={{ borderBottomColor: tab === id ? 'var(--accent)' : 'transparent' }}>
              {lbl}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 pb-16">
        {!apiKey && (
          <button onClick={() => setShowStt(true)}
            className="w-full mb-5 text-left px-4 py-3 rounded-xl border text-sm"
            style={{ borderColor: '#f59e0b44', background: '#f59e0b08', color: '#fbbf24' }}>
            ⚠ No API key — tap to configure
          </button>
        )}
        {tab === 'tts'      && <TTSTab      apiKey={apiKey} />}
        {tab === 'dialogue' && <DialogueTab apiKey={apiKey} />}
      </main>
    </div>
  );
}
