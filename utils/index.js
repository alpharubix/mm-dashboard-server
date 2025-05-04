export const toCamelCase = (str) => {
  const [first, ...rest] = str.trim().split(/\s+/)
  return (
    first.toLowerCase() +
    rest.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('')
  )
}
