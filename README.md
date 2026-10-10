# Delta

Delta is a tiny programming language playground that runs in your browser. It uses its own tokenizer and parser instead of executing JavaScript typed into the editor.

## Try it

Open the GitHub Pages site, type code into the editor, and press **Run** (or Ctrl+Enter).

```delta
let name = "world"
print("Hello, " + name)

let points = 4 + 6 * 2
print(points)

if points >= 10 {
  print("Nice!")
} else {
  print("Keep trying")
}
```

## Current features

- `print(...)` to display output
- `let name = value` to create variables
- Reassign existing variables with `name = value`
- Numbers, strings, `true`, `false`, and `null`
- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Comparisons: `==`, `!=`, `<`, `>`, `<=`, `>=`
- Logic: `and`, `or`, `not`, `&&`, `||`, `!`
- `if` / `else` blocks
- Comments beginning with `//`
- Code is saved in this browser using local storage

This is an early learning version. Loops, functions, arrays, and custom modules are not implemented yet.
