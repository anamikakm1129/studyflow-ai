export default function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--color-primary)" />
      <path
        d="M9 20.5C9 17 11.5 14.5 16 12C20.5 14.5 23 17 23 20.5C23 20.5 19.5 18.5 16 18.5C12.5 18.5 9 20.5 9 20.5Z"
        fill="white"
        opacity="0.95"
      />
      <circle cx="16" cy="9.5" r="2.2" fill="white" />
    </svg>
  )
}
