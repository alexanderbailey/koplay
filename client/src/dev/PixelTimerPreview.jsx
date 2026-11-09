import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PixelCountdown, PixelTimer } from '../shared/components/PixelTimer';
import '../index.css';

const ACCENTS = {
  A: { accent: '#dc2626', shadow: '#580f0f' },
  B: { accent: '#2563eb', shadow: '#0f2c5e' },
  C: { accent: '#f59e0b', shadow: '#623f04' },
  D: { accent: '#0d9488', shadow: '#053b36' },
};

const CHOICES = ['Respiration', 'Photosynthesis', 'Transpiration', 'Fermentation'];
const CHOICE_BG = ['#dc2626', '#2563eb', '#f59e0b', '#0d9488'];

const fieldStyle = {
  marginLeft: 6,
  padding: '4px 8px',
  border: '1px solid #ccc',
  borderRadius: 4,
  background: '#ffffff',
  color: '#111111',
  fontSize: 14,
};

function QuestionPhaseMock({ dialStyle, countdownProps }) {
  return (
    <div
      className="relative flex flex-col bg-cover bg-center"
      style={{
        height: '70vh',
        minHeight: 420,
        padding: 24,
        backgroundImage: 'url(/tv/background.jpg)',
        boxShadow: '0 0 0 2px rgba(255,255,255,0.15)',
      }}
    >
      <div
        className="flex items-center text-white/70 text-lg bg-black/40 rounded-xl"
        style={{ padding: '8px 16px', marginBottom: 16, alignSelf: 'flex-start' }}
      >
        <span>Medium · Q2/5</span>
      </div>

      <div
        className="flex items-center justify-center bg-black/40 rounded-xl"
        style={{ flex: 2, padding: '16px 24px', marginBottom: 16 }}
      >
        <p
          className="font-bold text-white text-center leading-tight"
          style={{ fontSize: 'clamp(28px, 4.5vh, 56px)' }}
        >
          What process do plants use to make food from sunlight?
        </p>
      </div>

      <div
        className="grid grid-cols-2"
        style={{ flex: 1, gap: 16 }}
      >
        {CHOICES.map((choice, i) => (
          <div
            key={choice}
            className="flex flex-col items-center justify-center rounded-2xl text-white font-bold text-center"
            style={{ background: CHOICE_BG[i], padding: 16 }}
          >
            <span style={{ opacity: 0.8, marginBottom: 4 }}>{['A', 'B', 'C', 'D'][i]}</span>
            <span>{choice}</span>
          </div>
        ))}
      </div>

      {/* Overlay: does not shrink the question layout */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 5,
          pointerEvents: 'none',
        }}
      >
        <PixelCountdown {...countdownProps} style={dialStyle} />
      </div>
    </div>
  );
}

function Preview() {
  const [duration, setDuration] = useState(15);
  const [running, setRunning] = useState(true);
  const [tick, setTick] = useState(true);
  const [lowAt, setLowAt] = useState(5);
  const [letter, setLetter] = useState('D');
  const [size, setSize] = useState('10vh');
  const [manualProgress, setManualProgress] = useState(0.35);
  const [manualLow, setManualLow] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [view, setView] = useState('placement'); // placement | lab

  const colours = ACCENTS[letter];
  const dialStyle = {
    '--pt-size': size,
    '--pt-accent': colours.accent,
    '--pt-shadow': colours.shadow,
  };

  const countdownProps = {
    key: runKey,
    duration,
    running,
    tick,
    lowAt,
    onComplete: () => setDoneCount((n) => n + 1),
  };

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: '#12141f',
        padding: 24,
      }}
    >
      <div
        style={{
          padding: '14px 16px',
          marginBottom: 20,
          background: '#1e2338',
          border: '1px solid #3a415c',
          borderRadius: 8,
        }}
      >
        <p className="font-bold" style={{ marginBottom: 12, color: '#fff' }}>Pixel timer preview</p>
        <div className="flex flex-wrap items-center" style={{ rowGap: 10, color: '#e8eaf2' }}>
          <label style={{ marginRight: 14 }}>
            View
            <select
              value={view}
              onChange={(e) => setView(e.target.value)}
              style={fieldStyle}
            >
              <option value="placement">Question placement</option>
              <option value="lab">Component lab</option>
            </select>
          </label>
          <label style={{ marginRight: 14 }}>
            Accent colour
            <select
              value={letter}
              onChange={(e) => setLetter(e.target.value)}
              style={fieldStyle}
              title="Static dial colour for testing (A-D match trivia choice colours)"
            >
              {Object.keys(ACCENTS).map((k) => (
                <option key={k} value={k}>{k} ({ACCENTS[k].accent})</option>
              ))}
            </select>
          </label>
          <label style={{ marginRight: 14 }}>
            Duration
            <input
              type="number"
              min={3}
              max={120}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 15)}
              style={{ ...fieldStyle, width: 64 }}
            />
          </label>
          <label style={{ marginRight: 14 }}>
            lowAt
            <input
              type="number"
              min={1}
              max={30}
              value={lowAt}
              onChange={(e) => setLowAt(Number(e.target.value) || 5)}
              style={{ ...fieldStyle, width: 56 }}
            />
          </label>
          <label style={{ marginRight: 14 }}>
            Size
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              style={fieldStyle}
            >
              <option value="8vh">8vh</option>
              <option value="10vh">10vh</option>
              <option value="14vh">14vh (small corner)</option>
              <option value="18vh">18vh (default corner)</option>
              <option value="22vh">22vh (large corner)</option>
              <option value="160px">160px</option>
              <option value="240px">240px</option>
              <option value="320px">320px</option>
              <option value="400px">400px (design size)</option>
            </select>
          </label>
          <label className="flex items-center" style={{ marginRight: 14 }}>
            <input
              type="checkbox"
              checked={tick}
              onChange={(e) => setTick(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            tick (1s jumps)
          </label>
          <label className="flex items-center" style={{ marginRight: 14 }}>
            <input
              type="checkbox"
              checked={running}
              onChange={(e) => setRunning(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            running
          </label>
          <button
            type="button"
            style={{
              padding: '6px 12px',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              marginRight: 10,
              background: '#e94560',
              color: '#fff',
              fontWeight: 600,
            }}
            onClick={() => {
              setRunning(true);
              setRunKey((k) => k + 1);
            }}
          >
            Restart countdown
          </button>
          <span style={{ color: '#aab0c4' }}>completed ×{doneCount}</span>
        </div>
      </div>

      {view === 'placement' ? (
        <div>
          <p style={{ marginBottom: 12, color: '#c5cadb' }}>
            Mock trivia question screen - timer in the top-right free corner. Resize the browser to check scaling.
          </p>
          <QuestionPhaseMock dialStyle={dialStyle} countdownProps={countdownProps} />
        </div>
      ) : (
        <div className="flex flex-wrap" style={{ gap: 48 }}>
          <div>
            <p className="font-semibold" style={{ marginBottom: 12 }}>Self-timing (PixelCountdown)</p>
            <div
              style={{ padding: 24, minWidth: 280, minHeight: 280, background: 'rgba(0,0,0,0.35)' }}
            >
              <PixelCountdown {...countdownProps} style={dialStyle} />
            </div>
          </div>

          <div>
            <p className="font-semibold" style={{ marginBottom: 12 }}>
              Driven (PixelTimer) - progress {Math.round(manualProgress * 100)}%
            </p>
            <label className="flex items-center" style={{ marginBottom: 12, color: '#e8eaf2' }}>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(manualProgress * 100)}
                onChange={(e) => setManualProgress(Number(e.target.value) / 100)}
                style={{ width: 200, marginRight: 12 }}
              />
              <input
                type="checkbox"
                checked={manualLow}
                onChange={(e) => setManualLow(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              force low (red blink)
            </label>
            <PixelTimer
              progress={manualProgress}
              low={manualLow}
              style={dialStyle}
            />
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Preview />);
