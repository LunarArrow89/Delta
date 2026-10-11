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
let runtimeScene = [], runtimeBackground = "#000000", runtimeHeldKeys = new Set(), runtimeMovementStarted = false, runtimeLastFrame = 0;
let runtimeSquareSettings = {x:100,y:100,size:40,speed:3.5};
const PROJECTS_KEY = "delta-projects";
function safeStorageGet(key, fallback = null) {
  try { return localStorage.getItem(key) ?? fallback; } catch (_) { return fallback; }
}
function safeStorageSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch (_) { return false; }
}
function getProjects() {
  try { return JSON.parse(safeStorageGet(PROJECTS_KEY, "{}") || "{}"); } catch (_) { return {}; }
}
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
  safeStorageSet(PROJECTS_KEY, JSON.stringify(projects));
  safeStorageSet("delta-code", editor.value);
  saveStatus.textContent = "Autosaved";
  refreshProjects(name);
  saveStatus.textContent = "Saved: " + name;
}
refreshProjects();

const starterCode = `// Your first Delta program
screen(640, 400)
background("#10131c")
text(:Hello!:)`

const previousCode = safeStorageGet("delta-code", "") || "";
editor.value = previousCode.includes('print("Welcome to Delta!")') ? starterCode : (previousCode || starterCode);
safeStorageSet("delta-code", editor.value);

function escapeHighlight(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function highlightDelimitedContent(value) {
  const pattern = /:([^:]*):|\/([A-Za-z_][A-Za-z0-9_]*)\//g;
  let result = "";
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(value)) !== null) {
    result += escapeHighlight(value.slice(lastIndex, match.index));
    result += match[1] !== undefined
      ? '<span class="syntax-text-content">' + escapeHighlight(match[0]) + '</span>'
      : '<span class="syntax-variable">' + escapeHighlight(match[0]) + '</span>';
    lastIndex = match.index + match[0].length;
  }
  return result + escapeHighlight(value.slice(lastIndex));
}
function renderHighlights() {
  const layer = document.getElementById("highlightLayer");
  if (!layer) return;

  // Highlight only the display layer; never modify the user's actual code.
  const html = editor.value.split("\n").map(line => {
    const commentAt = line.indexOf("//");
    const code = commentAt >= 0 ? line.slice(0, commentAt) : line;
    const comment = commentAt >= 0 ? line.slice(commentAt) : "";
    let out = "";
    const pattern = /:([^:]*):|\/([A-Za-z_][A-Za-z0-9_]*)\/|\b(screen|background)\b|\b(square|triangle|rect|circle|text)\b|\b(movement|location|size|color|speed)\b|\b(let)(\s+)([A-Za-z_][A-Za-z0-9_]*)?|"[^"]*"|'[^']*'/g;
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(code)) !== null) {
      out += escapeHighlight(code.slice(lastIndex, match.index));
      if (match[1] !== undefined) {
        out += '<span class="syntax-delimiter">:</span>';
        out += '<span class="syntax-text-content">' + escapeHighlight(match[1]) + '</span>';
        out += '<span class="syntax-delimiter">:</span>';
      } else if (match[2] !== undefined) {
        out += '<span class="syntax-delimiter">/</span>';
        out += '<span class="syntax-variable">' + escapeHighlight(match[2]) + '</span>';
        out += '<span class="syntax-delimiter">/</span>';
      } else if (match[3] !== undefined) {
        out += '<span class="syntax-screen-command">' + escapeHighlight(match[3]) + '</span>';
      } else if (match[4] !== undefined) {
        out += '<span class="syntax-shape-command">' + escapeHighlight(match[4]) + '</span>';
      } else if (match[5] !== undefined) {
        out += '<span class="syntax-attribute-command">' + escapeHighlight(match[5]) + '</span>';
      } else if (match[6] !== undefined) {
        out += '<span class="syntax-keyword">' + escapeHighlight(match[6]) + '</span>';
        out += escapeHighlight(match[7] || "");
        if (match[8]) out += '<span class="syntax-variable-name">' + escapeHighlight(match[8]) + '</span>';
      } else {
        const propertyString = match[0].match(/^(['"])(.*)\1$/);
        if (propertyString && /(?:^|,)\s*(?:color|size|x|y|left|top)\s*:/i.test(propertyString[2])) {
          out += '<span class="syntax-string">' + escapeHighlight(propertyString[1]);
          const parts = propertyString[2].split(/(,\s*)/);
          for (const part of parts) {
            if (/^,\s*$/.test(part)) {
              out += escapeHighlight(part);
              continue;
            }
            const property = part.match(/^(\s*)([A-Za-z_]+)(\s*:\s*)(.*)$/);
            if (!property) {
              out += escapeHighlight(part);
              continue;
            }
            out += escapeHighlight(property[1]);
            out += '<span class="syntax-attribute-command">' + escapeHighlight(property[2]) + '</span>';
            out += escapeHighlight(property[3]);
            const value = property[4];
            const hexColor = value.match(/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/);
            out += hexColor
              ? '<span class="syntax-color-code" style="color:' + hexColor[0] + ' !important; -webkit-text-fill-color:' + hexColor[0] + ' !important">' + escapeHighlight(value) + '</span>'
              : escapeHighlight(value);
          }
          out += '<span class="syntax-string">' + escapeHighlight(propertyString[1]) + '</span>';
        } else {
          const hexColor = match[0].match(/^["'](#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?)["']$/);
          if (hexColor) {
            out += '<span class="syntax-string syntax-color-code" style="color:' + hexColor[1] + ' !important; -webkit-text-fill-color:' + hexColor[1] + ' !important">' + escapeHighlight(match[0]) + '</span>';
          } else {
            out += '<span class="syntax-string">' + escapeHighlight(match[0]) + '</span>';
          }
        }
      }
      lastIndex = match.index + match[0].length;
    }
    out += escapeHighlight(code.slice(lastIndex));
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
  try {
    safeStorageSet("delta-code", editor.value);
    const name = projectName.value.trim() || "Untitled Project";
    const projects = getProjects();
    projects[name] = editor.value;
    safeStorageSet(PROJECTS_KEY, JSON.stringify(projects));
    refreshProjects(name);
    saveStatus.textContent = "Autosaved: " + name;
  } catch (error) {
    saveStatus.textContent = "Could not save: " + error.message;
  }
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
    if (this.current().type === "word" && /^if\d*$/.test(this.current().value)) {
      this.index++;
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
      if (!prompt) { prompt = runtimeWindow.document.createElement("div"); prompt.id = "delta-ask-prompt"; prompt.style.cssText = "position:fixed;left:50%;top:20px;transform:translateX(-50%);max-width:90vw;padding:14px 20px;border-radius:12px;background:#24202e;color:#e8d8ff;border:1px solid #a879d8;font:16px system-ui,sans-serif;text-align:center;z-index:9999"; runtimeWindow.document.body.appendChild(prompt); }
      prompt.textContent = String(args[0] ?? ""); return null;
    }
    if (name === "screen") { if (!runtimeCanvas) throw new Error("The game screen is not available. Press Run again."); runtimeCanvas.width=Math.max(100,Math.min(1600,Number(args[0])||640)); runtimeCanvas.height=Math.max(100,Math.min(1200,Number(args[1])||400)); drawRuntimeScene(); return null; }
    if (name === "background") { runtimeBackground=String(args[0]??"#ffffff"); runtimeScene=[]; drawRuntimeScene(); return null; }
    if (name === "centerText") { runtimeScene.push({type:"centerText",value:String(args[0]??"")}); drawRuntimeScene(); return null; }
    if (name === "setSquareSize") { runtimeSquareSettings.size = Math.max(0, Number(args[0]) || 0); return null; }
    if (name === "setSquareLocation") { runtimeSquareSettings.x = Number(args[0]) || 0; runtimeSquareSettings.y = Number(args[1]) || 0; return null; }
    if (name === "setSquareSpeed") { runtimeSquareSettings.speed = Math.max(0, Number(args[0]) || 0); return null; }
    if (name === "square" || name === "moveSquare") {
      const moving = name === "moveSquare";
      const legacy = typeof args[0] === "number";
      const configured = moving && args.length >= 6 && typeof args[3] === "string";
      const legacySpeed = legacy && typeof args[3] === "number";
      const shape = {
        type:"square",
        x:legacy?(Number(args[0])||0):runtimeSquareSettings.x,
        y:legacy?(Number(args[1])||0):runtimeSquareSettings.y,
        size:legacy?Math.max(0,Number(args[2])||0):runtimeSquareSettings.size,
        color:String(configured?args[3]:args[legacySpeed?5:legacy?3:1]??"#ffffff"),
        moving,
        speed:moving?(configured?Math.max(0,Number(args[4])||3.5):(legacySpeed?Math.max(0,Number(args[3])||3.5):(runtimeSquareSettings.speed??3.5))):0,
        controls:moving?parseMovementControls(configured?args[5]:(legacy?args[4]:args[0])):defaultMovementControls()
      };
      runtimeScene.push(shape);
      if(moving)startRuntimeMovement(); drawRuntimeScene(); return null;
    }
    if (name === "moveRect") {
      const speed = Math.max(0, Number(args[5]) || 3.5);
      runtimeScene.push({type:"rect",x:Number(args[0])||0,y:Number(args[1])||0,width:Math.max(0,Number(args[2])||0),height:Math.max(0,Number(args[3])||0),color:String(args[4]??"#ffffff"),moving:true,speed,controls:parseMovementControls(args[6])});
      startRuntimeMovement(); drawRuntimeScene(); return null;
    }
    if (name === "moveCircle") {
      const radius=Math.max(0,Number(args[2])||0);
      runtimeScene.push({type:"circle",x:Number(args[0])||0,y:Number(args[1])||0,radius,color:String(args[3]??"#ffffff"),moving:true,speed:Math.max(0,Number(args[4])||3.5),controls:parseMovementControls(args[5])});
      startRuntimeMovement(); drawRuntimeScene(); return null;
    }
    if (name === "triangle") { const moving=args[5]!==undefined&&args[5]!==null; runtimeScene.push({type:"triangle",x:Number(args[0])||0,y:Number(args[1])||0,size:Math.max(0,Number(args[2])||0),color:String(args[3]??"#ffffff"),moving,speed:Math.max(0,Number(args[4])||3.5),controls:moving?parseMovementControls(args[5]):defaultMovementControls()}); if(moving)startRuntimeMovement(); drawRuntimeScene(); return null; }
    if (name === "rect") { runtimeScene.push({type:"rect",x:Number(args[0])||0,y:Number(args[1])||0,width:Math.max(0,Number(args[2])||0),height:Math.max(0,Number(args[3])||0),color:String(args[4]??"#ffffff"),moving:false,speed:0,controls:defaultMovementControls()}); drawRuntimeScene(); return null; }
    if (name === "circle") { runtimeScene.push({type:"circle",x:Number(args[0])||0,y:Number(args[1])||0,radius:Math.max(0,Number(args[2])||0),color:String(args[3]??"#ffffff"),moving:false,speed:0,controls:defaultMovementControls()}); drawRuntimeScene(); return null; }
    if (name === "drawText") { runtimeScene.push({type:"text",value:String(args[0]??""),x:Number(args[1])||0,y:Number(args[2])||0,color:String(args[3]??"#ffffff"),size:Math.max(8,Number(args[4])||24)}); drawRuntimeScene(); return null; }

    if (name === "clear") { runtimeScene=[]; drawRuntimeScene(); return null; }
    throw new Error('Unknown function "'+name+'". Use screen, background, square, rect, circle, triangle, text, or clear.');
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
function drawRuntimeScene() {
  if(!runtimeCanvas||!runtimeContext)return;
  runtimeContext.fillStyle=runtimeBackground; runtimeContext.fillRect(0,0,runtimeCanvas.width,runtimeCanvas.height);
  for(const s of runtimeScene){runtimeContext.fillStyle=s.color||"#ffffff";
    if(s.type==="square")runtimeContext.fillRect(s.x,s.y,s.size,s.size);
    else if(s.type==="rect")runtimeContext.fillRect(s.x,s.y,s.width,s.height);
    else if(s.type==="circle"){runtimeContext.beginPath();runtimeContext.arc(s.x,s.y,s.radius,0,Math.PI*2);runtimeContext.fill();}
    else if(s.type==="triangle"){runtimeContext.beginPath();runtimeContext.moveTo(s.x+s.size/2,s.y);runtimeContext.lineTo(s.x+s.size,s.y+s.size);runtimeContext.lineTo(s.x,s.y+s.size);runtimeContext.closePath();runtimeContext.fill();}
    else if(s.type==="text"){runtimeContext.font=s.size+"px system-ui,sans-serif";runtimeContext.textBaseline="top";runtimeContext.fillText(s.value,s.x,s.y);runtimeContext.textBaseline="alphabetic";}
    else if(s.type==="centerText"){runtimeContext.font="28px system-ui,sans-serif";runtimeContext.textAlign="center";runtimeContext.textBaseline="middle";runtimeContext.fillText(s.value,runtimeCanvas.width/2,runtimeCanvas.height/2);runtimeContext.textAlign="start";runtimeContext.textBaseline="alphabetic";}
  }
}
function defaultMovementControls(){
  return {up:["w","arrowup"],down:["s","arrowdown"],left:["a","arrowleft"],right:["d","arrowright"]};
}
function parseMovementControls(value){
  if(value===undefined||value===null||String(value).trim()==="")return defaultMovementControls();
  const groups=String(value).split("|");
  if(groups.length!==4)throw new Error('Movement controls need four groups in this order: up|down|left|right. Example: "w,arrowup|s,arrowdown|a,arrowleft|d,arrowright".');
  const controls=groups.map(group=>group.split(",").map(key=>key.trim().toLowerCase()).filter(Boolean));
  if(controls.some(group=>group.length===0))throw new Error("Each movement direction needs at least one key.");
  return {up:controls[0],down:controls[1],left:controls[2],right:controls[3]};
}
function startRuntimeMovement(){
  if(runtimeMovementStarted||!runtimeWindow||runtimeWindow.closed)return;
  runtimeMovementStarted=true; runtimeHeldKeys=new Set();
  runtimeWindow.addEventListener("keydown",e=>{const k=e.key.toLowerCase();if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(k))e.preventDefault();runtimeHeldKeys.add(k);});
  runtimeWindow.addEventListener("keyup",e=>runtimeHeldKeys.delete(e.key.toLowerCase()));
  runtimeWindow.addEventListener("blur",()=>runtimeHeldKeys.clear());
  const frame=t=>{
    if(!runtimeWindow||runtimeWindow.closed||!runtimeCanvas){runtimeMovementStarted=false;return;}
    const elapsed=runtimeLastFrame?Math.min((t-runtimeLastFrame)/16.67,3):1;runtimeLastFrame=t;
    let changed=false;
    for(const s of runtimeScene)if(s.moving){
      const c=s.controls||defaultMovementControls();
      let dx=0,dy=0;
      if(c.up.some(k=>runtimeHeldKeys.has(k)))dy--;
      if(c.down.some(k=>runtimeHeldKeys.has(k)))dy++;
      if(c.left.some(k=>runtimeHeldKeys.has(k)))dx--;
      if(c.right.some(k=>runtimeHeldKeys.has(k)))dx++;
      if(dx&&dy){dx*=Math.SQRT1_2;dy*=Math.SQRT1_2;}
      if(dx||dy){
        const half=s.type==="circle"?s.radius:0, w=(s.type==="square"||s.type==="triangle")?s.size:s.type==="rect"?s.width:0, h=(s.type==="square"||s.type==="triangle")?s.size:s.type==="rect"?s.height:0;
        const speed=Math.max(0,Number(s.speed)||3.5);
        s.x=Math.max(half,Math.min(runtimeCanvas.width-w-half,s.x+dx*speed*elapsed));
        s.y=Math.max(half,Math.min(runtimeCanvas.height-h-half,s.y+dy*speed*elapsed));
        changed=true;
      }
    }
    if(changed)drawRuntimeScene();
    runtimeWindow.requestAnimationFrame(frame);
  };runtimeWindow.requestAnimationFrame(frame);
}
function openRuntimeWindow(){
  runtimeWindow=window.open("","DeltaProgramWindow","popup,width=900,height=650,resizable=yes,scrollbars=yes");
  if(!runtimeWindow){addOutput("Allow pop-ups for this site so Delta can open your program in a new window.","error");runStatus.textContent="Popup blocked";return false;}
  runtimeScene=[];runtimeBackground="#000000";runtimeMovementStarted=false;runtimeLastFrame=0;runtimeHeldKeys=new Set();runtimeSquareSettings={x:100,y:100,size:40,speed:3.5};
  runtimeWindow.document.open();runtimeWindow.document.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Delta Game</title><style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#000}canvas{display:block;width:100vw;height:100vh;background:#000}</style></head><body><canvas id="screen" width="640" height="400"></canvas></body></html>');runtimeWindow.document.close();
  runtimeCanvas=runtimeWindow.document.getElementById("screen");runtimeContext=runtimeCanvas.getContext("2d");runtimeLog=null;return true;
}
function runCode() {
  output.replaceChildren();
  runStatus.textContent = "Running…";
  openRuntimeWindow();
  const started = performance.now();
  try {
    const source = editor.value
      // Convert Delta's own text(:words: + /variable/) syntax into a print expression.
      .replace(/^([ \\t]*)text\\(\\s*:([^:]*)\\:\\s*(?:\\+\\s*\\/([A-Za-z_][A-Za-z0-9_]*)\\/)?\\s*\\)[ \\t]*$/gm, (_, indent, message, variable) => {
        const textPart = JSON.stringify(message.trimEnd());
        return indent + "print(" + (variable ? textPart + " + String(" + variable + ")" : textPart) + ")";
      })
      // Allow simple one-line indented-style conditions without requiring braces.
      .replace(/^([ \t]*)if(\d*)\s+(.+?)\s*\r?\n([ \t]*)([^\r\n]+)$/gm, (whole, indent, number, condition, nextIndent, nextLine) => {
        if (condition.includes("{") || nextLine.trim().startsWith("else")) return whole;
        return indent + "if" + number + " " + condition.trim() + " {\n" + nextIndent + nextLine + "\n" + indent + "}";
      })
      .replace(/^([ \t]*)(square|rect|circle|triangle)\s*\[([\s\S]*?)\][ \t]*$/gm, (_, indent, type, body) => {
        const settings = {};
        for (const line of body.split(/\r?\n/).map(line => line.trim()).filter(Boolean)) {
          const match = line.match(/^(location|size|width|height|radius|color|speed|movement)\s*\((.*)\)\s*$/);
          if (!match) throw new Error("Unknown " + type + " setting: " + line);
          settings[match[1]] = match[2];
        }
        const loc = settings.location ? settings.location.split(",").map(v=>v.trim()) : ["100","100"];
        const color = settings.color ?? '"#ffffff"';
        const movement = settings.movement;
        if (type === "square") {
          const size = settings.size ?? "40";
          const args = [loc[0]||"100",loc[1]||"100",size,color];
          if (movement !== undefined) return indent + "moveSquare(" + args.join(",") + "," + (settings.speed ?? "3.5") + "," + movement + ")";
          return indent + "square(" + args.join(",") + ")";
        }
        if (type === "rect") {
          const width = settings.width ?? settings.size ?? "60", height = settings.height ?? settings.size ?? "40";
          const args = [loc[0]||"100",loc[1]||"100",width,height,color];
          if (movement !== undefined) return indent + "moveRect(" + args.join(",") + "," + (settings.speed ?? "3.5") + "," + movement + ")";
          return indent + "rect(" + args.join(",") + ")";
        }
        if (type === "circle") {
          const radius = settings.radius ?? settings.size ?? "20";
          const args = [loc[0]||"100",loc[1]||"100",radius,color];
          if (movement !== undefined) return indent + "moveCircle(" + args.join(",") + "," + (settings.speed ?? "3.5") + "," + movement + ")";
          return indent + "circle(" + args.join(",") + ")";
        }
        const size = settings.size ?? "40";
        return indent + "triangle(" + [loc[0]||"100",loc[1]||"100",size,color,(settings.speed??"3.5"),movement===undefined?"null":movement].join(",") + ")";
      })
      .replace(/^([ \t]*)square\s*\*size\*\s*\(([^)]*)\)[ \t]*$/gm, (_, indent, args) => indent + "setSquareSize(" + args + ")")      .replace(/^([ \t]*)square\s*\*location\*\s*\(([^)]*)\)[ \t]*$/gm, (_, indent, args) => indent + "setSquareLocation(" + args + ")")
      .replace(/^([ \t]*)square\s*\*speed\*\s*\(([^)]*)\)[ \t]*$/gm, (_, indent, args) => indent + "setSquareSpeed(" + args + ")")
      .replace(/^([ \t]*)square\s*\*movement\*\s*\(([^)]*)\)[ \t]*$/gm, (_, indent, args) => indent + "moveSquare(" + args + ")")
      .replace(/^([ \t]*)(rect|circle)\s*\*movement\*\s*\(/gm, (_, indent, shape) => indent + (shape === "rect" ? "moveRect(" : "moveCircle("))
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
        const joined = inside.match(/^(.*?)\s*:\s*\+\s*:([A-Za-z_][A-Za-z0-9_]*):\s*$/);
        if (joined) return indent + "ask(" + JSON.stringify(joined[1].trimEnd() + " ") + " + String(" + joined[2] + "))";
        return indent + "ask(" + JSON.stringify(inside) + ")";
      })
      .replace(/^([ \t]*)ask:(.*):[ \t]*$/gm, (_, indent, message) => indent + "ask(" + JSON.stringify(message) + ")")
      .replace(/^([ \t]*)text\(\s*:([^:]*)\:\s*(["'])(.*?)\3\s*\)[ \t]*$/gm, (_, indent, message, quote, properties) => {
        const getProperty = (key, fallback) => {
          const match = properties.match(new RegExp("(?:^|,)\\s*" + key + "\\s*:\\s*([^,]+)", "i"));
          return match ? match[1].trim() : fallback;
        };
        const color = getProperty("color", "#ffffff").replace(/^["']|["']$/g, "");
        const size = Math.max(8, Number(getProperty("size", "24")) || 24);
        const x = Number(getProperty("x", "100")) || 0;
        const y = Number(getProperty("y", "100")) || 0;
        return indent + "drawText(" + JSON.stringify(message) + ", " + x + ", " + y + ", " + JSON.stringify(color) + ", " + size + ")";
      });
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
    safeStorageSet("delta-code", editor.value); updateEditorInfo();
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
  safeStorageSet("delta-code", editor.value);
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

 
// Visual object editor: create positioned text and insert it into Delta code.
(() => {
  const map = document.getElementById("objectMap");
  const textObjectTool = document.getElementById("textObjectTool");
  if (!map || !textObjectTool) return;
  const fields = {
    name: document.getElementById("objectName"),
    text: document.getElementById("objectText"),
    x: document.getElementById("objectX"),
    y: document.getElementById("objectY"),
    size: document.getElementById("objectFontSize"),
    color: document.getElementById("objectColor")
  };
  const inspectorEmpty = document.getElementById("inspectorEmpty");
  const inspectorFields = document.getElementById("inspectorFields");
  const sceneObjectList = document.getElementById("sceneObjectList");
  const status = document.getElementById("objectEditorStatus");
  const sizeLabel = document.getElementById("mapSizeLabel");
  let objects = [];
  let selectedId = null;
  let nextId = 1;
  let drag = null;
  const screenSize = () => {
    const screenLine = editor.value.match(/^\s*screen\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/m);
    return { width: Number(screenLine?.[1]) || 640, height: Number(screenLine?.[2]) || 400 };
  };
  function updateMapSize() {
    const size = screenSize();
    sizeLabel.textContent = size.width + " × " + size.height;
    map.style.aspectRatio = size.width + " / " + size.height;
    map.style.setProperty("--map-width", size.width);
    map.style.setProperty("--map-height", size.height);
    renderObjects();
  }
  function selected() { return objects.find(item => item.id === selectedId); }
  function renderObjects() {
    map.querySelectorAll(".map-text-object").forEach(el => el.remove());
    const size = screenSize();
    for (const item of objects) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "map-text-object" + (item.id === selectedId ? " selected" : "");
      el.textContent = item.text || " ";
      el.title = item.name || "Text";
      el.style.left = (item.x / size.width * 100) + "%";
      el.style.top = (item.y / size.height * 100) + "%";
      el.style.color = item.color;
      el.style.fontSize = "clamp(8px, " + (item.size / size.height * 100) + "cqh, 42px)";
      el.dataset.objectId = item.id;
      el.addEventListener("pointerdown", event => {
        if (event.button !== 0) return;
        event.preventDefault();
        selectedId = item.id;
        const rect = map.getBoundingClientRect();
        drag = { id: item.id, pointerId: event.pointerId, rect, startX: event.clientX, startY: event.clientY, x: item.x, y: item.y };
        try { map.setPointerCapture(event.pointerId); } catch (_) {}
        syncFields();
        renderObjects();
      });
      map.appendChild(el);
    }
    const hint = document.getElementById("mapHint");
    if (hint) hint.style.display = objects.length ? "none" : "block";
    if (sceneObjectList) {
      sceneObjectList.replaceChildren();
      if (!objects.length) {
        const empty = document.createElement("p");
        empty.className = "empty-object-list";
        empty.textContent = "No objects yet";
        sceneObjectList.appendChild(empty);
      } else {
        for (const item of objects) {
          const row = document.createElement("button");
          row.type = "button";
          row.className = "scene-object-item" + (item.id === selectedId ? " active" : "");
          row.textContent = item.name || "Text";
          row.addEventListener("click", () => { selectedId = item.id; syncFields(); renderObjects(); });
          sceneObjectList.appendChild(row);
        }
      }
    }
    const hasSelection = Boolean(selected());
    if (inspectorEmpty) {
      inspectorEmpty.hidden = hasSelection;
      inspectorEmpty.style.display = hasSelection ? "none" : "flex";
    }
    if (inspectorFields) {
      inspectorFields.hidden = !hasSelection;
      inspectorFields.style.display = hasSelection ? "flex" : "none";
    }
    if (hasSelection) syncFields();
    status.textContent = objects.length ? objects.length + " text object" + (objects.length === 1 ? "" : "s") + (hasSelection ? " · selected" : "") : "No text objects yet.";
  }
  function syncFields() {
    const item = selected();
    if (!item) return;
    if (inspectorEmpty) {
      inspectorEmpty.hidden = true;
      inspectorEmpty.style.display = "none";
    }
    if (inspectorFields) {
      inspectorFields.hidden = false;
      inspectorFields.style.display = "flex";
    }
    fields.name.value = item.name || "Text " + item.id;
    fields.text.value = item.text;
    fields.x.value = Math.round(item.x);
    fields.y.value = Math.round(item.y);
    fields.size.value = item.size;
    fields.color.value = item.color;
  }
  function applyFields() {
    const item = selected();
    if (!item) { status.textContent = "Add or select a text object first."; return; }
    const size = screenSize();
    item.name = fields.name.value.trim() || "Text " + item.id;
    item.text = fields.text.value;
    item.x = Math.max(0, Math.min(size.width, Number(fields.x.value) || 0));
    item.y = Math.max(0, Math.min(size.height, Number(fields.y.value) || 0));
    item.size = Math.max(8, Math.min(120, Number(fields.size.value) || 24));
    item.color = fields.color.value || "#ffffff";
    fields.x.value = Math.round(item.x);
    fields.y.value = Math.round(item.y);
    renderObjects();
  }
  function addObject() {
    const size = screenSize();
    const id = nextId++;
    const item = { id, name: (fields.name.value.trim() && fields.name.value.trim() !== "Text 1" ? fields.name.value.trim() : "Text " + id), text: fields.text.value || "New text", x: Math.min(100, size.width), y: Math.min(100, size.height), size: Math.max(8, Number(fields.size.value) || 24), color: fields.color.value || "#ffffff" };
    objects.push(item);
    selectedId = item.id;
    syncFields();
    renderObjects();
  }
  function objectCode(item) {
    const safeText = String(item.text || "").replace(/:/g, "：").replace(/[\r\n]+/g, " ");
    return "// " + (item.name || "Text " + item.id).replace(/[\r\n]+/g, " ") + "\n" + "text(:" + safeText + ': "color: ' + item.color + ", size: " + item.size + ", x: " + Math.round(item.x) + ", y: " + Math.round(item.y) + '")";
  }
  function addAt(clientX, clientY) {
    const rect = map.getBoundingClientRect();
    const size = screenSize();
    const x = Math.max(0, Math.min(size.width, (clientX - rect.left) / rect.width * size.width));
    const y = Math.max(0, Math.min(size.height, (clientY - rect.top) / rect.height * size.height));
    const id = nextId++;
    const item = { id, name: (fields.name.value.trim() && fields.name.value.trim() !== "Text 1" ? fields.name.value.trim() : "Text " + id), text: fields.text.value || "Text", x, y, size: Math.max(8, Number(fields.size.value) || 24), color: fields.color.value || "#ffffff" };
    objects.push(item); selectedId = item.id; syncFields(); renderObjects();
  }
  textObjectTool.addEventListener("click", () => {
    const rect = map.getBoundingClientRect();
    addAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
  textObjectTool.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); textObjectTool.click(); }
  });
  textObjectTool.addEventListener("dragstart", event => {
    event.dataTransfer.setData("application/x-delta-object", "Text");
    event.dataTransfer.setData("text/plain", "Text");
    event.dataTransfer.effectAllowed = "copy";
  });
  map.addEventListener("dragover", event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; map.classList.add("drop-target"); });
  map.addEventListener("dragleave", event => { if (!map.contains(event.relatedTarget)) map.classList.remove("drop-target"); });
  map.addEventListener("drop", event => {
    event.preventDefault(); map.classList.remove("drop-target");
    if (event.dataTransfer.getData("application/x-delta-object") === "Text" || event.dataTransfer.getData("text/plain") === "Text") addAt(event.clientX, event.clientY);
  });
  document.getElementById("applyObject").addEventListener("click", applyFields);
  document.getElementById("removeObject").addEventListener("click", () => {
    objects = objects.filter(item => item.id !== selectedId);
    selectedId = objects.length ? objects[objects.length - 1].id : null;
    if (selected()) syncFields();
    renderObjects();
  });
  document.getElementById("insertObjectCode").addEventListener("click", () => {
    const item = selected();
    if (!item) { status.textContent = "Add or select a text object first."; return; }
    const code = objectCode(item);
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const before = editor.value.slice(0, start);
    const needsNewline = before.length > 0 && !before.endsWith("\n");
    editor.setRangeText((needsNewline ? "\n" : "") + code + "\n", start, end, "end");
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    editor.focus();
    status.textContent = "Inserted: " + code;
  });
  map.addEventListener("pointermove", event => {
    if (!drag || (drag.pointerId != null && event.pointerId !== drag.pointerId)) return;
    const item = objects.find(entry => entry.id === drag.id);
    if (!item) return;
    const size = screenSize();
    item.x = Math.max(0, Math.min(size.width, drag.x + (event.clientX - drag.startX) / drag.rect.width * size.width));
    item.y = Math.max(0, Math.min(size.height, drag.y + (event.clientY - drag.startY) / drag.rect.height * size.height));
    fields.x.value = Math.round(item.x);
    fields.y.value = Math.round(item.y);
    renderObjects();
  });
  map.addEventListener("pointerup", event => {
    if (!drag || (drag.pointerId != null && event.pointerId !== drag.pointerId)) return;
    drag = null;
    try { if (map.hasPointerCapture(event.pointerId)) map.releasePointerCapture(event.pointerId); } catch (_) {}
  });
  map.addEventListener("pointercancel", () => { drag = null; });
  for (const field of Object.values(fields)) {
    field.addEventListener("input", () => {
      if (field === fields.text || field === fields.color || field === fields.size || field === fields.name) applyFields();
    });
    field.addEventListener("keydown", event => { if (event.key === "Enter") applyFields(); });
  }
  editor.addEventListener("input", updateMapSize);
  updateMapSize();
})();
