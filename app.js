const editor = document.getElementById("codeEditor");
const output = document.getElementById("output");
const lineNumbers = document.getElementById("lineNumbers");
const runButton = document.getElementById("runButton");
const runStatus = document.getElementById("runStatus");
const cursorInfo = document.getElementById("cursorInfo");

const starterCode = `// Welcome to Delta!
let name = "world"
print("Hello, " + name + "!")

let score = 8 + 4
print("Your score is:")
print(score)

if score >= 10 {
  print("You reached ten!")
} else {
  print("Keep going!")
}`;

editor.value = localStorage.getItem("delta-code") || starterCode;

function updateEditorInfo() {
  const lines = editor.value.split("\n").length;
  lineNumbers.textContent = Array.from({ length: lines }, (_, i) => i + 1).join("\n");
  const before = editor.value.slice(0, editor.selectionStart);
  cursorInfo.textContent = "Line " + (before.split("\n").length);
}
editor.addEventListener("input", () => {
  updateEditorInfo();
  localStorage.setItem("delta-code", editor.value);
});
editor.addEventListener("click", updateEditorInfo);
editor.addEventListener("keyup", updateEditorInfo);
editor.addEventListener("scroll", () => { lineNumbers.scrollTop = editor.scrollTop; });
editor.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.setRangeText("  ", start, end, "end");
    editor.dispatchEvent(new Event("input"));
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    runCode();
  }
});
updateEditorInfo();

function tokenize(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      i++;
      let value = "";
      let closed = false;
      while (i < source.length) {
        if (source[i] === "\\") {
          i++;
          if (i >= source.length) break;
          const escaped = source[i++];
          value += ({ n: "\n", t: "\t", r: "\r" })[escaped] ?? escaped;
        } else if (source[i] === quote) {
          i++;
          closed = true;
          break;
        } else {
          value += source[i++];
        }
      }
      if (!closed) throw new Error("Unclosed string. Add a matching quote.");
      tokens.push({ type: "string", value });
      continue;
    }
    const number = source.slice(i).match(/^\d+(?:\.\d+)?/);
    if (number) {
      tokens.push({ type: "number", value: Number(number[0]) });
      i += number[0].length;
      continue;
    }
    const word = source.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (word) {
      tokens.push({ type: "word", value: word[0] });
      i += word[0].length;
      continue;
    }
    const operator = ["==", "!=", "<=", ">=", "&&", "||"].find(op => source.startsWith(op, i));
    if (operator) {
      tokens.push({ type: "symbol", value: operator });
      i += operator.length;
      continue;
    }
    if ("+-*/%(){}=<>!;,".includes(c)) {
      tokens.push({ type: "symbol", value: c });
      i++;
      continue;
    }
    throw new Error("I don't understand this character: " + c);
  }
  tokens.push({ type: "eof", value: "" });
  return tokens;
}

class DeltaParser {
  constructor(tokens, print) {
    this.tokens = tokens;
    this.index = 0;
    this.variables = Object.create(null);
    this.print = print;
    this.steps = 0;
  }
  current() { return this.tokens[this.index]; }
  check(value) { return this.current().value === value; }
  match(...values) {
    if (values.includes(this.current().value)) { this.index++; return true; }
    return false;
  }
  expect(value) {
    if (!this.match(value)) throw new Error('Expected "' + value + '" but found "' + (this.current().value || "end of code") + '".');
  }
  identifier() {
    const token = this.current();
    if (token.type !== "word") throw new Error("Expected a variable name.");
    this.index++;
    return token.value;
  }
  run() {
    this.statements(false);
  }
  statements(inBlock) {
    while (this.current().type !== "eof" && !this.check("}")) {
      const before = this.index;
      this.statement();
      if (this.index === before) throw new Error("The code got stuck. Check this line.");
      this.match(";");
      this.steps++;
      if (this.steps > 10000) throw new Error("Too many statements. Check for a loop or very large program.");
    }
    if (inBlock) this.expect("}");
  }
  statement() {
    if (this.match("let", "var")) {
      const name = this.identifier();
      this.expect("=");
      this.variables[name] = this.expression();
      return;
    }
    if (this.match("print")) {
      let value;
      if (this.match("(")) {
        value = this.expression();
        this.expect(")");
      } else {
        value = this.expression();
      }
      this.print(value);
      return;
    }
    if (this.match("if")) {
      const condition = this.expression();
      this.expect("{");
      const start = this.index;
      const end = this.findBlockEnd(start);
      const trueTokens = this.tokens.slice(start, end).concat([{ type: "eof", value: "" }]);
      this.index = end + 1;
      let elseStart = -1;
      if (this.match("else")) {
        this.expect("{");
        elseStart = this.index;
        const elseEnd = this.findBlockEnd(elseStart);
        if (this.truthy(condition)) this.index = elseEnd + 1;
        else {
          this.executeSubBlock(this.tokens.slice(elseStart, elseEnd));
          this.index = elseEnd + 1;
        }
      } else if (this.truthy(condition)) {
        this.executeSubBlock(trueTokens.slice(0, -1));
      }
      if (this.truthy(condition) && elseStart >= 0) {
        // The true branch was saved before parsing the optional else branch.
        this.executeSubBlock(trueTokens.slice(0, -1));
      }
      return;
    }
    if (this.current().type === "word" && this.tokens[this.index + 1]?.value === "=") {
      const name = this.identifier();
      this.expect("=");
      if (!(name in this.variables)) throw new Error('"' + name + '" has not been created yet. Use let ' + name + ' = ... first.');
      this.variables[name] = this.expression();
      return;
    }
    throw new Error('Unknown statement "' + this.current().value + '". Try print(...), let name = ..., or if ... { ... }.');
  }
  findBlockEnd(start) {
    let depth = 1;
    for (let i = start; i < this.tokens.length; i++) {
      if (this.tokens[i].value === "{") depth++;
      if (this.tokens[i].value === "}") depth--;
      if (depth === 0) return i;
    }
    throw new Error('Missing closing "}".');
  }
  executeSubBlock(tokens) {
    const nested = new DeltaParser(tokens.concat([{ type: "eof", value: "" }]), this.print);
    nested.variables = this.variables;
    nested.run();
    this.variables = nested.variables;
  }
  expression() { return this.or(); }
  or() {
    let value = this.and();
    while (this.match("||", "or")) { const right = this.and(); value = this.truthy(value) || this.truthy(right); }
    return value;
  }
  and() {
    let value = this.equality();
    while (this.match("&&", "and")) { const right = this.equality(); value = this.truthy(value) && this.truthy(right); }
    return value;
  }
  equality() {
    let value = this.comparison();
    while (this.match("==", "!=")) {
      const op = this.tokens[this.index - 1].value;
      const right = this.comparison();
      value = op === "==" ? value === right : value !== right;
    }
    return value;
  }
  comparison() {
    let value = this.term();
    while (this.match("<", ">", "<=", ">=")) {
      const op = this.tokens[this.index - 1].value;
      const right = this.term();
      if (op === "<") value = value < right;
      if (op === ">") value = value > right;
      if (op === "<=") value = value <= right;
      if (op === ">=") value = value >= right;
    }
    return value;
  }
  term() {
    let value = this.factor();
    while (this.match("+", "-")) {
      const op = this.tokens[this.index - 1].value;
      const right = this.factor();
      if (op === "+") value = typeof value === "string" || typeof right === "string" ? String(value) + String(right) : Number(value) + Number(right);
      else value = Number(value) - Number(right);
    }
    return value;
  }
  factor() {
    let value = this.unary();
    while (this.match("*", "/", "%")) {
      const op = this.tokens[this.index - 1].value;
      const right = this.unary();
      if (op === "*") value = Number(value) * Number(right);
      if (op === "/") {
        if (Number(right) === 0) throw new Error("You can't divide by zero.");
        value = Number(value) / Number(right);
      }
      if (op === "%") value = Number(value) % Number(right);
    }
    return value;
  }
  unary() {
    if (this.match("!", "not")) return !this.truthy(this.unary());
    if (this.match("-")) return -Number(this.unary());
    return this.primary();
  }
  primary() {
    const token = this.current();
    if (this.match("(")) {
      const value = this.expression();
      this.expect(")");
      return value;
    }
    if (token.type === "number" || token.type === "string") {
      this.index++;
      return token.value;
    }
    if (token.type === "word") {
      this.index++;
      if (token.value === "true") return true;
      if (token.value === "false") return false;
      if (token.value === "null") return null;
      if (!(token.value in this.variables)) throw new Error('"' + token.value + '" is not defined. Create it with let ' + token.value + ' = ...');
      return this.variables[token.value];
    }
    throw new Error('Expected a value, but found "' + (token.value || "end of code") + '".');
  }
  truthy(value) { return Boolean(value); }
}

function formatValue(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && Number.isFinite(value)) return String(Number(value.toFixed(8)));
  return String(value);
}

function addOutput(text, type = "") {
  const line = document.createElement("p");
  line.className = "output-line" + (type ? " " + type : "");
  line.textContent = text;
  output.appendChild(line);
}

function runCode() {
  output.replaceChildren();
  runStatus.textContent = "Running…";
  const started = performance.now();
  try {
    const tokens = tokenize(editor.value);
    const parser = new DeltaParser(tokens, value => addOutput(formatValue(value)));
    parser.run();
    addOutput("✓ Finished in " + Math.round(performance.now() - started) + " ms", "success");
    runStatus.textContent = "Finished";
  } catch (error) {
    addOutput("Error: " + error.message, "error");
    runStatus.textContent = "Error";
  }
  if (!output.children.length) output.innerHTML = '<p class="placeholder">Program finished without printing anything.</p>';
}

runButton.addEventListener("click", runCode);
document.getElementById("clearButton").addEventListener("click", () => {
  output.replaceChildren();
  output.innerHTML = '<p class="placeholder">Output cleared.</p>';
  runStatus.textContent = "Ready";
});
document.getElementById("resetButton").addEventListener("click", () => {
  editor.value = starterCode;
  localStorage.removeItem("delta-code");
  updateEditorInfo();
  output.replaceChildren();
  output.innerHTML = '<p class="placeholder">Starter code restored. Press Run when you're ready.</p>';
  runStatus.textContent = "Ready";
  editor.focus();
});
