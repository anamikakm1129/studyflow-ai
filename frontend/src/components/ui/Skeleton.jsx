export default function Skeleton({ width = '100%', height = '16px', radius, style }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  )
}
