export default function Card({ as: Component = 'div', hoverable = false, glass = false, className = '', style, children, ...props }) {
  const classes = ['card', hoverable ? 'card-hoverable' : '', glass ? 'card-glass' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <Component className={classes} style={{ padding: '20px', ...style }} {...props}>
      {children}
    </Component>
  )
}
