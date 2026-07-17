export default function Button({
  variant = 'primary',
  size = 'md',
  icon = false,
  as: Component = 'button',
  className = '',
  children,
  ...props
}) {
  const classes = [
    'btn',
    `btn-${variant}`,
    size === 'sm' ? 'btn-sm' : '',
    icon ? 'btn-icon' : '',
    className
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  )
}
