/** Format JSON without converting number literals or discarding duplicate keys. */
export function formatJson(text: string): string {
  JSON.parse(text)
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}\[\],:]|[^\s{}\[\],:]+/g)!
  const output: string[] = []
  let depth = 0
  // Bound whitespace growth for deeply nested responses.
  const newline = () => '\n' + '  '.repeat(Math.min(depth, 40))
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    if (token === '{' || token === '[') {
      output.push(token)
      depth++
      if (tokens[index + 1] !== (token === '{' ? '}' : ']')) output.push(newline())
    } else if (token === '}' || token === ']') {
      depth--
      if (tokens[index - 1] !== (token === '}' ? '{' : '[')) output.push(newline())
      output.push(token)
    } else if (token === ',') output.push(',', newline())
    else if (token === ':') output.push(': ')
    else output.push(token)
  }
  return output.join('')
}
