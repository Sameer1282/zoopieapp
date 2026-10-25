import { ImageResponse } from 'next/og';

export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        fontSize: 20,
        background: '#0f172a',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        borderRadius: '8px',
        border: '1px solid #1e293b',
        fontWeight: 800,
      }}
    >
      <span style={{ color: '#818cf8' }}>Z</span>
      <span style={{ color: '#2dd4bf' }}>•</span>
    </div>,
    {
      ...size,
    }
  );
}
