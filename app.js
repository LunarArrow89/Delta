const editor = document.getElementById("codeEditor");
const output = document.getElementById("output");
const lineNumbers = document.getElementById("lineNumbers");
const runButton = document.getElementById("runButton");
const runStatus = document.getElementById("runStatus");
const cursorInfo = document.getElementById("cursorInfo");
const projectName = document.getElementById("projectName");
const projectSelect = document.getElementById("projectSelect");
const saveStatus = document.getElementById("saveStatus");
let runtimeWindow = null, runtimeCanvas = null, runtimeContext = null, runtimeLog = null;
const PROJECTS_KEY = "delta-projects";
function getProjects() { try { return JSON.parse(localStorage.getItem(PROJECTS_KEY) || "{}"); } catch { return {}; } }
function refreshProjects(selected = "") {
  const projects = getProjects();
  projectSelect.replaceChildren(new Option("Saved projects…", ""));
  Object.keys(projects).sort().forEach(name => projectSelect.add(new Option(name, name)));
  projectSelect.value = selected;
}
function saveCurrentProject() {
  const name = projectName.value.trim() || "Untitled Project";
  projectName.value = name;
  const projects = getProjects();
  projects[name] = editor.value;
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  localStorage.setItem("delta-code", editor.value);
  saveStatus.textContent = "Autosaved";
  refreshProjects(name);
  saveStatus.textContent = "Saved: " + name;
}
refreshProjects();

const starterCode = `// Your first Delta program
screen(640, 400)
background("#10131c")
text:Hello!:`

const previousCode = localStorage.getItem("delta-code") || "";
editor.value = previousCode.includes('print("Welcome to Delta!")') ? starterCode : (previousCode || starterCode);
localStorage.setItem("delta-code", editor.value);

function escapeHighlight(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function renderHighlights() {
  const layer = document.getElementById("highlightLayer");
  if (!layer) return;
  const reserved = new Set(["let", "var", "if", "then", "else", "true", "false", "null", "and", "or", "not"]);
  const controlKeywords = new Set(["if", "then", "else"]);
  const builtins = new Set(["screen", "background", "square", "rect", "circle", "clear"]);
  const html = editor.value.split("\n").map(line => {
    const commentAt = line.indexOf("//");
    let code = commentAt >= 0 ? line.slice(0, commentAt) : line;
    const comment = commentAt >= 0 ? line.slice(commentAt) : "";
    let out = "";
    while (code.length) {
      const askParen = code.match(/^(\s*ask\s*\()(.*)(\)\s*;?\s*)$/);
      if (askParen) {
        const declared = new Set(Array.from(editor.value.matchAll(/\b(?:let|var)\s+([A-Za-z_][A-Za-z0-9_]*)/g), match => match[1]));
        const inner = askParen[2];
        let askContent = "";
        let remaining = inner;
        while (remaining.length) {
          const quote = remaining.match(/^("|')(?:\\\\.|(?!\\1)[^\\\\])*?\\1/);
          if (quote) {
            askContent += '<span class="syntax-text-content">' + escapeHighlight(quote[0]) + '</span>';
            remaining = remaining.slice(quote[0].length);
            continue;
          }
          const word = remaining.match(/^[A-Za-z_][A-Za-z0-9_]*/);
          if (word) {
            const name = word[0];
            askContent += declared.has(name)
              ? '<span class="syntax-variable">' + escapeHighlight(name) + '</span>'
              : '<span class="syntax-text-content">' + escapeHighlight(name) + '</span>';
            remaining = remaining.slice(name.length);
            continue;
          }
          askContent += '<span class="syntax-text-content">' + escapeHighlight(remaining[0]) + '</span>';
          remaining = remaining.slice(1);
        }
        out += '<span class="syntax-purple">ask</span><span class="syntax-text-content">' + escapeHighlight(askParen[1].slice(3)) + '</span>';
        out += askContent;
        out += '<span class="syntax-text-content">' + escapeHighlight(askParen[3]) + '</span>';
        code = "";
        continue;
      }
      const askTextParen = code.match(/^(\\s*)ask:\\((.*)\\)$/);
      if (askTextParen) {
        const inner = askTextParen[2];
        const joined = inner.match(/^(.*?):\\+:([A-Za-z_][A-Za-z0-9_]*):$/);
        const declared = new Set(Array.from(editor.value.matchAll(/\\b(?:let|var)\\s+([A-Za-z_][A-Za-z0-9_]*)/g), match => match[1]));
        out += escapeHighlight(askTextParen[1]) + '<span class="syntax-purple">ask</span><span class="syntax-text-content">:( ';
        if (joined) {
          out += escapeHighlight(joined[1]) + '<span class="syntax-text-content">:+:</span>';
          out += declared.has(joined[2]) ? '<span class="syntax-variable">' + escapeHighlight(joined[2]) + '</span>' : '<span class="syntax-text-content">' + escapeHighlight(joined[2]) + '</span>';
          out += '<span class="syntax-text-content">:</span>';
        } else {
          out += escapeHighlight(inner);
        }
        out += '<span class="syntax-text-content">)</span>';
        code = "";
        continue;
      }
      const askColonParen = code.match(/^(\\s*)ask\\(:([\\s\\S]*?):\\)$/);
      if (askColonParen) {
        const inner = askColonParen[2];
        const joined = inner.match(/^(.*?):\\+:([A-Za-z_][A-Za-z0-9_]*):$/);
        const declared = new Set(Array.from(editor.value.matchAll(/\\b(?:let|var)\\s+([A-Za-z_][A-Za-z0-9_]*)/g), match => match[1]));
        out += escapeHighlight(askColonParen[1]) + '<span class="syntax-purple">ask</span><span class="syntax-text-content">(:';
        if (joined) {
          out += escapeHighlight(joined[1]) + '<span class="syntax-text-content">:+:</span>';
          out += declared.has(joined[2]) ? '<span class="syntax-variable">' + escapeHighlight(joined[2]) + '</span>' : '<span class="syntax-text-content">' + escapeHighlight(joined[2]) + '</span>';
          out += '<span class="syntax-text-content">:</span>';
        } else {
          out += escapeHighlight(inner);
        }
        out += '<span class="syntax-text-content">:)</span>';
        code = "";
        continue;
      }
      const askShortcut = code.match(/^(\\s*)ask:(.*):$/);
      if (askShortcut) {
        const declared = new Set(Array.from(editor.value.matchAll(/\\b(?:let|var)\\s+([A-Za-z_][A-Za-z0-9_]*)/g), match => match[1]));
        const inner = askShortcut[2];
        const joined = inner.match(/^(.*?):\\+:([A-Za-z_][A-Za-z0-9_]*):$/);
        out += escapeHighlight(askShortcut[1]) + '<span class="syntax-purple">ask</span><span class="syntax-text-content">:';
        if (joined) {
          out += escapeHighlight(joined[1]) + '<span class="syntax-text-content">:+:</span>';
          out += declared.has(joined[2]) ? '<span class="syntax-variable">' + escapeHighlight(joined[2]) + '</span>' : '<span class="syntax-text-content">' + escapeHighlight(joined[2]) + '</span>';
          out += '<span class="syntax-text-content">:</span>';
        } else {
          out += escapeHighlight(inner);
        }
        out += ':</span>';
        code = "";
        continue;
      }
      const textParen = code.match(/^text:\((.*)\)$/);
      if (textParen) {
        const joined = textParen[1].match(/^(.*?)(\s*:\s*\+\s*:\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)$/);
        out += '<span class="syntax-text-content">text:</span><span class="syntax-parenthesis">(</span>';
        if (joined) {
          out += '<span class="syntax-text-content">' + escapeHighlight(joined[1]) + '</span>';
          out += '<span class="syntax-text-content">' + escapeHighlight(joined[2]) + '</span>';
          out += '<span class="syntax-variable">' + escapeHighlight(joined[3]) + '</span>';
          out += '<span class="syntax-text-content">' + escapeHighlight(joined[4]) + '</span>';
        } else {
          out += '<span class="syntax-text-content">' + escapeHighlight(textParen[1]) + '</span>';
        }
        out += '<span class="syntax-parenthesis">)</span>';
        code = "";
        continue;
      }
      const textShortcut = code.match(/^text:(.*):$/);
      if (textShortcut) {
        const inner = textShortcut[1];
        const joined = inner.match(/^(.*?):\+:([A-Za-z_][A-Za-z0-9_]*):$/);
        out += '<span class="syntax-text-content">text:' + escapeHighlight(joined ? joined[1] : inner);
        if (joined) out += '<span class="syntax-text-content">:+:</span><span class="syntax-variable">' + escapeHighlight(joined[2]) + '</span><span class="syntax-text-content">:</span>';
        out += ':</span>';
        code = "";
        continue;
      }
      const quote = code.match(/^("|')(?:\\.|(?!\1)[^\\])*?\1/);
      if (quote) {
        out += '<span class="syntax-string">' + escapeHighlight(quote[0]) + '</span>';
        code = code.slice(quote[0].length);
        continue;
      }
      const word = code.match(/^[A-Za-z_][A-Za-z0-9_]*/);
      if (word) {
        const name = word[0];
        const rest = code.slice(name.length);
        if (name === "ask" || name === "gather") {
          out += '<span class="syntax-purple">' + escapeHighlight(name) + '</span>';
        } else if (name === "text" && /^\s*\(/.test(rest)) {
          out += '<span class="syntax-text-command">' + name + '</span>';
        } else if (controlKeywords.has(name)) {
          out += '<span class="syntax-keyword">' + escapeHighlight(name) + '</span>';
        } else if (reserved.has(name) || builtins.has(name)) {
          out += escapeHighlight(name);
        } else {
          out += '<span class="syntax-variable">' + escapeHighlight(name) + '</span>';
        }
        code = rest;
        continue;
      }
      out += escapeHighlight(code[0]);
      code = code.slice(1);
    }
    if (comment) out += '<span class="syntax-comment">' + escapeHighlight(comment) + '</span>';
    return out || " ";
  }).join("\n");
  layer.innerHTML = html + "\n";
  layer.scrollTop = editor.scrollTop;
  layer.scrollLeft = editor.scrollLeft;
}
function updateEditorInfo() {
  const lines = editor.value.split("\n").length;
  lineNumbers.textContent = Array.from({ length: lines }, (_, i) => i + 1).join("\n");
  const before = editor.value.slice(0, editor.selectionStart);
  cursorInfo.textContent = "Line " + (before.split("\n").length);
  renderHighlights();
}
editor.addEventListener("input", () => {
  updateEditorInfo();
  localStorage.setItem("delta-code", editor.value);
  saveStatus.textContent = "Autosaved in this browser";
});
editor.addEventListener("click", updateEditorInfo);
editor.addEventListener("keyup", updateEditorInfo);
editor.addEventListener("scroll", () => { lineNumbers.scrollTop = editor.scrollTop; const layer = document.getElementById("highlightLayer"); if (layer) { layer.scrollTop = editor.scrollTop; layer.scrollLeft = editor.scrollLeft; } });
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
    if ("+-*/%(){}=<>!;,:".includes(c)) {
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
    if (this.match("gather")) {
      this.expect("(");
      const keyName = this.identifier();
      this.expect(")");
      const parser = this;
      if (!runtimeWindow || runtimeWindow.closed) throw new Error("Open the game window before gathering a key.");
      throw { deltaWaitingForKey: true, resume() {
        const handler = event => {
          event.preventDefault();
          parser.variables[keyName] = event.key.toLowerCase();
          runtimeWindow.removeEventListener("keydown", handler);
          const prompt = runtimeWindow.document.getElementById("delta-ask-prompt");
          if (prompt) prompt.remove();
          try { parser.statements(false); runStatus.textContent = "Finished"; addOutput("✓ Finished", "success"); } catch (error) { if (error?.deltaWaitingForKey) error.resume(); else { addOutput("Error: " + error.message, "error"); runStatus.textContent = "Error"; } }
        };
        runtimeWindow.addEventListener("keydown", handler);
        runStatus.textContent = "Waiting for a key…";
      } };
    }
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
    if (this.current().type === "word" && this.tokens[this.index + 1]?.value === "(") {
      this.expression();
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
      if (this.check("(")) {
        this.index++;
        const args = [];
        if (!this.check(")")) { do { args.push(this.expression()); } while (this.match(",")); }
        this.expect(")");
        return this.callBuiltin(token.value, args);
      }
      if (!(token.value in this.variables)) throw new Error('"' + token.value + '" is not defined. Create it with let ' + token.value + ' = ...');
      return this.variables[token.value];
    }
    throw new Error('Expected a value, but found "' + (token.value || "end of code") + '".');
  }
  callBuiltin(name, args) {
    if (name === "String") return String(args[0] ?? "");
    if (name === "ask") {
      if (!runtimeWindow || runtimeWindow.closed) throw new Error("Open the game window before asking for a key.");
      let prompt = runtimeWindow.document.getElementById("delta-ask-prompt");
      if (!prompt) { prompt = runtimeWindow.document.createElement("div"); prompt.id = "delta-ask-prompt"; prompt.style.cssText = "position:fixed;left:50%;top:20px;transform:translateX(-50%);max-width:90vw;padding:14px 20px;border-radius:12px;background:#24202e;color:#e8d8ff;border:1px solid #a879d8;font:16px system-ui,sans-serif;text-align:center;z-index:9999;box-shadow:0 6px 24px #0008"; runtimeWindow.document.body.appendChild(prompt); }
      prompt.textContent = String(args[0] ?? "");
      return null;
    }
    if (name === "screen") {
      if (!runtimeCanvas || !runtimeContext) throw new Error("The game screen is not available. Press Run again.");
      runtimeCanvas.width = Math.max(100, Math.min(1600, Number(args[0]) || 640));
      runtimeCanvas.height = Math.max(100, Math.min(1200, Number(args[1]) || 400)); return null;
    }
    if (name === "centerText") {
      if (!runtimeContext || !runtimeCanvas) throw new Error("The game screen is not available. Press Run again.");
      runtimeContext.fillStyle = "#ffffff";
      runtimeContext.font = "28px system-ui, sans-serif";
      runtimeContext.textAlign = "center";
      runtimeContext.textBaseline = "middle";
      runtimeContext.fillText(String(args[0] ?? ""), runtimeCanvas.width / 2, runtimeCanvas.height / 2);
      runtimeContext.textAlign = "start";
      runtimeContext.textBaseline = "alphabetic";
      return null;
    }
    if (name === "background") { if (!runtimeContext) throw new Error("The program window is not available. Allow pop-ups and press Run again."); runtimeContext.fillStyle = String(args[0] ?? "#ffffff"); runtimeContext.fillRect(0, 0, runtimeCanvas.width, runtimeCanvas.height); return null; }
    if (name === "square") { if (!runtimeContext) throw new Error("The program window is not available. Allow pop-ups and press Run again."); runtimeContext.fillStyle = String(args[3] ?? "#8b7cff"); runtimeContext.fillRect(Number(args[0]) || 0, Number(args[1]) || 0, Math.max(0, Number(args[2]) || 0), Math.max(0, Number(args[2]) || 0)); return null; }
    if (name === "rect") { if (!runtimeContext) throw new Error("The program window is not available. Allow pop-ups and press Run again."); runtimeContext.fillStyle = String(args[4] ?? "#8b7cff"); runtimeContext.fillRect(Number(args[0]) || 0, Number(args[1]) || 0, Math.max(0, Number(args[2]) || 0), Math.max(0, Number(args[3]) || 0)); return null; }
    if (name === "circle") { if (!runtimeContext) throw new Error("The program window is not available. Allow pop-ups and press Run again."); runtimeContext.beginPath(); runtimeContext.fillStyle = String(args[3] ?? "#72e0b1"); runtimeContext.arc(Number(args[0]) || 0, Number(args[1]) || 0, Math.max(0, Number(args[2]) || 0), 0, Math.PI * 2); runtimeContext.fill(); return null; }
    if (name === "text") { if (!runtimeContext) throw new Error("The program window is not available. Allow pop-ups and press Run again."); runtimeContext.fillStyle = String(args[3] ?? "#ffffff"); runtimeContext.font = Math.max(8, Number(args[4]) || 24) + "px system-ui, sans-serif"; runtimeContext.fillText(String(args[0] ?? ""), Number(args[1]) || 0, Number(args[2]) || 0); return null; }
    if (name === "clear") { if (!runtimeContext) throw new Error("The program window is not available. Allow pop-ups and press Run again."); runtimeContext.clearRect(0, 0, runtimeCanvas.width, runtimeCanvas.height); return null; }
    throw new Error('Unknown function "' + name + '". Use screen, background, square, rect, circle, text, or clear.');
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
  if (runtimeLog && runtimeWindow && !runtimeWindow.closed) {
    const row = runtimeWindow.document.createElement("div");
    row.textContent = text;
    row.style.cssText = "font:13px/1.6 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;margin:4px 0;color:" + (type === "error" ? "#ff929d" : type === "success" ? "#72e0b1" : "#e8eaf2");
    runtimeLog.appendChild(row);
  }
}
function openRuntimeWindow() {
  runtimeWindow = window.open("", "DeltaProgramWindow", "popup,width=900,height=650,resizable=yes,scrollbars=yes");
  if (!runtimeWindow) { addOutput("Allow pop-ups for this site so Delta can open your program in a new window.", "error"); runStatus.textContent = "Popup blocked"; return false; }
  runtimeWindow.document.open();
  runtimeWindow.document.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Delta Game</title><style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#000}canvas{display:block;width:100vw;height:100vh;background:#000}</style></head><body><canvas id="screen" width="640" height="400"></canvas></body></html>');
  runtimeWindow.document.close();
  runtimeCanvas = runtimeWindow.document.getElementById("screen");
  runtimeContext = runtimeCanvas.getContext("2d");
  runtimeLog = runtimeWindow.document.getElementById("log");
  return true;
}
function runCode() {
  output.replaceChildren();
  runStatus.textContent = "Running…";
  openRuntimeWindow();
  const started = performance.now();
  try {
    const source = editor.value
      .replace(/^([ \t]*)ask\(:([\s\S]*?):\)[ \t]*$/gm, (_, indent, inside) => {
        const parts = inside.split(/\/([A-Za-z_][A-Za-z0-9_]*)\//g);
        let expression = "";
        parts.forEach((part, index) => {
          if (index % 2 === 0) {
            if (part) expression += (expression ? " + " : "") + JSON.stringify(part);
          } else {
            expression += (expression ? " + " : "") + "String(" + part + ")";
          }
        });
        return indent + "ask(" + (expression || '""') + ")";
      })
      .replace(/^([ \t]*)ask:\((.*?)\)[ \t]*$/gm, (_, indent, inside) => {
        const joined = inside.match(/^(.*?)\\s*:\\s*\\+\\s*:([A-Za-z_][A-Za-z0-9_]*):\\s*$/);
        if (joined) return indent + "ask(" + JSON.stringify(joined[1].trimEnd() + " ") + " + String(" + joined[2] + "))";
        return indent + "ask(" + JSON.stringify(inside) + ")";
      })
      .replace(/^([ \\t]*)ask:(.*):[ \\t]*$/gm, (_, indent, message) => indent + "ask(" + JSON.stringify(message) + ")")
      .replace(/^([ \t]*)text\(:([\s\S]*?):\)[ \t]*$/gm, (_, indent, inside) => {
        const parts = inside.split(/\/([A-Za-z_][A-Za-z0-9_]*)\//g);
        let expression = "";
        parts.forEach((part, index) => {
          if (index % 2 === 0) {
            if (part) expression += (expression ? " + " : "") + JSON.stringify(part);
          } else {
            expression += (expression ? " + " : "") + "String(" + part + ")";
          }
        });
        return indent + "centerText(" + (expression || '""') + ")";
      })
      .replace(/^([ \t]*)text:\((.*?)\)[ \t]*$/gm, (_, indent, inside) => {
        const parts = inside.split(/\/([A-Za-z_][A-Za-z0-9_]*)\//g);
        let expression = "";
        parts.forEach((part, index) => {
          if (index % 2 === 0) {
            if (part) expression += (expression ? " + " : "") + JSON.stringify(part);
          } else {
            expression += (expression ? " + " : "") + "String(" + part + ")";
          }
        });
        return indent + "centerText(" + (expression || '""') + ")";
      })
      .replace(/^([ \t]*)text:(.*):[ \t]*$/gm, (_, indent, value) => indent + "centerText(" + JSON.stringify(value) + ")");
    const parser = new DeltaParser(tokenize(source), value => addOutput(formatValue(value)));
    parser.run();
    addOutput("✓ Finished in " + Math.round(performance.now() - started) + " ms", "success");
    runStatus.textContent = "Finished";
  } catch (error) {
    if (error?.deltaWaitingForKey) { error.resume(); return; }
    addOutput("Error: " + error.message, "error");
    runStatus.textContent = "Error";
  }
}
runButton.addEventListener("click", runCode);
document.getElementById("saveProjectButton").addEventListener("click", saveCurrentProject);
projectSelect.addEventListener("change", () => {
  const name = projectSelect.value, projects = getProjects();
  if (name && Object.prototype.hasOwnProperty.call(projects, name)) {
    projectName.value = name; editor.value = projects[name];
    localStorage.setItem("delta-code", editor.value); updateEditorInfo();
    saveStatus.textContent = "Loaded: " + name;
  }
});
document.getElementById("clearButton").addEventListener("click", () => {
  output.replaceChildren();
  output.innerHTML = '<p class="placeholder">Output cleared.</p>';
  runStatus.textContent = "Ready";
});
document.getElementById("resetButton").addEventListener("click", () => {
  editor.value = starterCode;
  localStorage.setItem("delta-code", editor.value);
  updateEditorInfo();
  output.replaceChildren();
  output.innerHTML = "<p class=\"placeholder\">Starter code restored. Press Run when you're ready.</p>";
  runStatus.textContent = "Ready";
  editor.focus();
});



// File sidebar actions
const fileList = document.getElementById("fileList");
const addFileButton = document.getElementById("addFileButton");
let fileOptionsMenu = null;
let fileOptionsTarget = null;

function closeFileOptions() {
  fileOptionsMenu?.remove();
  fileOptionsMenu = null;
  fileOptionsTarget = null;
}
function showFileOptions(item, x, y) {
  closeFileOptions();
  const row = item.closest(".file-row");
  if (!row) return;
  fileOptionsTarget = item;
  fileOptionsMenu = document.createElement("div");
  fileOptionsMenu.className = "file-options-menu";
  fileOptionsMenu.setAttribute("role", "menu");
  const actions = [
    { label: "Rename", action: "rename", disabled: item.dataset.file === "main.delta" },
    { label: "Move up", action: "up", disabled: !row.previousElementSibling },
    { label: "Move down", action: "down", disabled: !row.nextElementSibling },
    { label: "Delete", action: "delete", danger: true, disabled: item.dataset.file === "main.delta" }
  ];
  actions.forEach(option => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option.label;
    button.dataset.action = option.action;
    button.setAttribute("role", "menuitem");
    if (option.danger) button.classList.add("danger");
    button.disabled = !!option.disabled;
    fileOptionsMenu.appendChild(button);
  });
  document.body.appendChild(fileOptionsMenu);
  const menuRect = fileOptionsMenu.getBoundingClientRect();
  fileOptionsMenu.style.left = Math.max(8, Math.min(x, window.innerWidth - menuRect.width - 8)) + "px";
  fileOptionsMenu.style.top = Math.max(8, Math.min(y, window.innerHeight - menuRect.height - 8)) + "px";
}
fileList.addEventListener("click", event => {
  const deleteButton = event.target.closest(".delete-file-button");
  if (deleteButton) {
    const row = deleteButton.closest(".file-row");
    const item = row?.querySelector(".file-item");
    if (!item || item.dataset.file === "main.delta") return;
    const name = item.dataset.file;
    row.remove();
    saveStatus.textContent = "Deleted " + name;
    return;
  }
  const item = event.target.closest(".file-item");
  if (!item) return;
  fileList.querySelectorAll(".file-item").forEach(file => file.classList.toggle("active", file === item));
  saveStatus.textContent = item.dataset.file === "main.delta" ? "Editing main.delta" : item.dataset.file + " — file connection coming soon";
});
fileList.addEventListener("dblclick", event => {
  const item = event.target.closest(".file-item");
  if (!item) return;
  event.preventDefault();
  showFileOptions(item, event.clientX, event.clientY);
});
fileList.addEventListener("contextmenu", event => {
  const item = event.target.closest(".file-item");
  if (!item) return;
  event.preventDefault();
  showFileOptions(item, event.clientX, event.clientY);
});
document.addEventListener("click", event => {
  if (fileOptionsMenu && !fileOptionsMenu.contains(event.target)) closeFileOptions();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeFileOptions();
});
document.addEventListener("click", event => {
  const button = event.target.closest(".file-options-menu button");
  if (!button || button.disabled || !fileOptionsTarget) return;
  const item = fileOptionsTarget;
  const row = item.closest(".file-row");
  if (!row) { closeFileOptions(); return; }
  const name = item.dataset.file;
  const action = button.dataset.action;
  if (action === "delete" && name !== "main.delta") {
    row.remove();
    saveStatus.textContent = "Deleted " + name;
  } else if (action === "rename" && name !== "main.delta") {
    const requested = window.prompt("Rename Delta file:", name);
    if (requested !== null) {
      let nextName = requested.trim();
      if (nextName && !nextName.toLowerCase().endsWith(".delta")) nextName += ".delta";
      const exists = Array.from(fileList.querySelectorAll(".file-item")).some(other => other !== item && other.dataset.file.toLowerCase() === nextName.toLowerCase());
      if (!/^[A-Za-z0-9_-]+\.delta$/i.test(nextName) || exists) {
        saveStatus.textContent = "Choose a unique valid .delta filename";
      } else {
        item.dataset.file = nextName;
        item.lastChild.textContent = " " + nextName;
        saveStatus.textContent = "Renamed to " + nextName;
      }
    }
  } else if (action === "up" && row.previousElementSibling) {
    fileList.insertBefore(row, row.previousElementSibling);
    saveStatus.textContent = "Moved " + name + " up";
  } else if (action === "down" && row.nextElementSibling) {
    fileList.insertBefore(row.nextElementSibling, row);
    saveStatus.textContent = "Moved " + name + " down";
  }
  closeFileOptions();
});
addFileButton.addEventListener("click", () => {
  const requestedName = window.prompt("New Delta file name (.delta):", "new-file.delta");
  if (requestedName === null) return;
  const name = requestedName.trim();
  if (!name) return;
  if (!/^[A-Za-z0-9_-]+\.delta$/i.test(name)) {
    saveStatus.textContent = "Delta files must end in .delta";
    return;
  }
  const existing = Array.from(fileList.querySelectorAll(".file-item")).some(item => item.dataset.file.toLowerCase() === name.toLowerCase());
  if (existing) {
    saveStatus.textContent = "That file already exists in the list";
    return;
  }
  const row = document.createElement("div");
  row.className = "file-row";
  const item = document.createElement("button");
  item.type = "button";
  item.className = "file-item";
  item.dataset.file = name;
  const icon = document.createElement("span");
  icon.className = "file-icon delta-icon";
  icon.textContent = "◆";
  item.append(icon, document.createTextNode(" " + name));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "delete-file-button";
  remove.setAttribute("aria-label", "Delete " + name);
  remove.title = "Delete " + name;
  remove.textContent = "×";
  row.append(item, remove);
  fileList.appendChild(row);
  fileList.querySelectorAll(".file-item").forEach(file => file.classList.toggle("active", file === item));
  saveStatus.textContent = name + " added to the file list";
});
