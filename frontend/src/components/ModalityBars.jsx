/** Live modality breakdown — banger neon bars */
const COLS = [
  { key: 'voice', label: 'Voice (TRIBE·proxy)', color: '#ffffff' },
  { key: 'words', label: 'Words (NLP)', color: '#dddddd' },
  { key: 'face', label: 'Facial mesh', color: '#bfbfbf' },
  { key: 'possibility', label: 'Possibility P', color: '#9f9f9f' },
]

export default function ModalityBars({ values, formula }) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(18,18,18,0.95) 0%, rgba(8,8,8,0.98) 100%)',
        borderRadius: 3,
        padding: '1rem 1.1rem',
        border: '1px solid var(--border)',
        boxShadow: 'inset 0 0 40px rgba(255,255,255,0.03)',
      }}
    >
      {formula && (
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'ui-monospace, monospace' }}>
          {formula}
        </p>
      )}
      {COLS.map(({ key, label, color }) => {
        const v = Math.max(0, Math.min(1, values?.[key] ?? 0))
        return (
          <div key={key} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 4 }}>
              <span style={{ color: 'var(--dim)' }}>{label}</span>
              <span style={{ color }}>{(v * 100).toFixed(0)}%</span>
            </div>
            <div
              style={{
                height: 10,
                borderRadius: 2,
                background: 'rgba(255,255,255,0.08)',
                overflow: 'hidden',
                boxShadow: 'inset 0 0 12px rgba(0,0,0,0.4)',
              }}
            >
              <div
                style={{
                  width: `${v * 100}%`,
                  height: '100%',
                  borderRadius: 2,
                  background: `linear-gradient(90deg, ${color}88, ${color})`,
                  boxShadow: `0 0 16px ${color}66`,
                  transition: 'width 0.12s ease-out',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
