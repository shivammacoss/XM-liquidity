import CanvasRevealEffect from './ui/CanvasRevealEffect'

export default function CanvasBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        background: '#000',
      }}
    >
      <CanvasRevealEffect
        animationSpeed={3}
        colors={[
          [255, 255, 255],
          [255, 255, 255],
        ]}
        dotSize={6}
        reverse={false}
        showGradient={false}
      />
      {/* Radial vignette so center stays readable */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.2) 100%)',
        }}
      />
      {/* Top fade so header stays readable */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '33%',
          background: 'linear-gradient(to bottom, #000, transparent)',
        }}
      />
    </div>
  )
}
