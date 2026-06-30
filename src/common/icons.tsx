// Shared inline icons. SVG (not emoji) so they inherit the button's `color` — e.g.
// the delete buttons' grey→red hover — and render identically across platforms.

interface IconProps {
  // px number or any CSS length; defaults to 1em so it scales with font-size.
  size?: number | string
}

// Standard trash / garbage-bin icon (Feather "trash-2").
export function TrashIcon({ size = '1em' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block' }}
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}
