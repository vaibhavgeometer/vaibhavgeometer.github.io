/**
 * IIT JAM Style Virtual Scientific Calculator
 * Symmetrical 9x6 Layout, Math Token Parser & Safe Expression Evaluator
 */
(function() {
  let calcState = {
    display: '0',
    memory: 0,
    isRad: true,
    history: '',
    shouldResetDisplay: false
  };

  function initCalculator() {
    const modalHtml = `
      <div id="calc-modal" class="calc-modal-backdrop hidden" onclick="if(event.target===this) window.toggleCalculator(false)">
        <div class="calc-container" id="calc-box">
          <div class="calc-header" id="calc-drag-handle">
            <div class="calc-title">
              <span class="calc-icon">🖩</span> IIT JAM Scientific Calculator
            </div>
            <div class="calc-header-controls">
              <button class="calc-close-btn" onclick="window.toggleCalculator(false)" title="Close Calculator">✕</button>
            </div>
          </div>
          
          <div class="calc-screen-wrap">
            <div class="calc-history" id="calc-history"></div>
            <div class="calc-display" id="calc-display">0</div>
          </div>

          <div class="calc-mode-bar">
            <label class="calc-mode-toggle">
              <input type="radio" name="calc-angle" value="rad" checked onchange="window.setCalcAngle('rad')">
              <span>Rad</span>
            </label>
            <label class="calc-mode-toggle">
              <input type="radio" name="calc-angle" value="deg" onchange="window.setCalcAngle('deg')">
              <span>Deg</span>
            </label>
            <span class="calc-mem-indicator" id="calc-mem-flag"></span>
          </div>

          <div class="calc-keypad">
            <!-- Row 1: Memory & Clear (9 buttons) -->
            <button class="calc-btn btn-mem" onclick="window.calcAction('MC')">MC</button>
            <button class="calc-btn btn-mem" onclick="window.calcAction('MR')">MR</button>
            <button class="calc-btn btn-mem" onclick="window.calcAction('MS')">MS</button>
            <button class="calc-btn btn-mem" onclick="window.calcAction('M+')">M+</button>
            <button class="calc-btn btn-mem" onclick="window.calcAction('M-')">M-</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('+/-')">±</button>
            <button class="calc-btn btn-danger" onclick="window.calcAction('C')">C</button>
            <button class="calc-btn btn-danger" onclick="window.calcAction('CE')">CE</button>
            <button class="calc-btn btn-action" onclick="window.calcAction('BACK')">⌫</button>

            <!-- Row 2: Trig & Powers (9 buttons) -->
            <button class="calc-btn btn-fn" onclick="window.calcAction('sin')">sin</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('cos')">cos</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('tan')">tan</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('ln')">ln</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('log')">log</button>
            <button class="calc-btn btn-num" onclick="window.calcAction('(')">(</button>
            <button class="calc-btn btn-num" onclick="window.calcAction(')')">)</button>
            <button class="calc-btn btn-op" onclick="window.calcAction('%')">%</button>
            <button class="calc-btn btn-op" onclick="window.calcAction('/')">÷</button>

            <!-- Row 3: Inverse Trig & Exponents (9 buttons) -->
            <button class="calc-btn btn-fn" onclick="window.calcAction('asin')">asin</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('acos')">acos</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('atan')">atan</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('e^x')">eˣ</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('10^x')">10ˣ</button>
            <button class="calc-btn btn-num" onclick="window.calcAction('7')">7</button>
            <button class="calc-btn btn-num" onclick="window.calcAction('8')">8</button>
            <button class="calc-btn btn-num" onclick="window.calcAction('9')">9</button>
            <button class="calc-btn btn-op" onclick="window.calcAction('*')">×</button>

            <!-- Row 4: Hyperbolic & Roots (9 buttons) -->
            <button class="calc-btn btn-fn" onclick="window.calcAction('sinh')">sinh</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('cosh')">cosh</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('tanh')">tanh</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('sqrt')">√x</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('x^y')">xʸ</button>
            <button class="calc-btn btn-num" onclick="window.calcAction('4')">4</button>
            <button class="calc-btn btn-num" onclick="window.calcAction('5')">5</button>
            <button class="calc-btn btn-num" onclick="window.calcAction('6')">6</button>
            <button class="calc-btn btn-op" onclick="window.calcAction('-')">−</button>

            <!-- Row 5: Factorial & Numbers (9 buttons) -->
            <button class="calc-btn btn-fn" onclick="window.calcAction('fact')">n!</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('1/x')">1/x</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('pi')">π</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('e')">e</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('abs')">|x|</button>
            <button class="calc-btn btn-num" onclick="window.calcAction('1')">1</button>
            <button class="calc-btn btn-num" onclick="window.calcAction('2')">2</button>
            <button class="calc-btn btn-num" onclick="window.calcAction('3')">3</button>
            <button class="calc-btn btn-op" onclick="window.calcAction('+')">+</button>

            <!-- Row 6: Powers, Zero & Equals (6 buttons + 3-span Equals = 9 columns) -->
            <button class="calc-btn btn-fn" onclick="window.calcAction('x^2')">x²</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('x^3')">x³</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('cbrt')">∛x</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('mod')">mod</button>
            <button class="calc-btn btn-num" onclick="window.calcAction('0')">0</button>
            <button class="calc-btn btn-num" onclick="window.calcAction('.')">.</button>
            <button class="calc-btn btn-equals" onclick="window.calcAction('=')">=</button>
          </div>
        </div>
      </div>
    `;

    if (!document.getElementById('calc-modal')) {
      const div = document.createElement('div');
      div.innerHTML = modalHtml;
      document.body.appendChild(div.firstElementChild);
    }
  }

  window.toggleCalculator = function(force) {
    initCalculator();
    const modal = document.getElementById('calc-modal');
    if (modal) {
      if (force !== undefined) {
        modal.classList.toggle('hidden', !force);
      } else {
        modal.classList.toggle('hidden');
      }
    }
  };

  window.setCalcAngle = function(mode) {
    calcState.isRad = (mode === 'rad');
  };

  function updateCalcScreen() {
    const disp = document.getElementById('calc-display');
    const hist = document.getElementById('calc-history');
    const mem = document.getElementById('calc-mem-flag');
    if (disp) disp.innerText = calcState.display || '0';
    if (hist) hist.innerText = calcState.history || '';
    if (mem) mem.innerText = calcState.memory !== 0 ? 'M' : '';
  }

  function factorial(n) {
    if (n < 0 || Math.floor(n) !== n) return NaN;
    if (n === 0 || n === 1) return 1;
    if (n > 170) return Infinity; // JS limit
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
  }

  function formatNumber(num) {
    if (!Number.isFinite(num)) return 'Error';
    if (Math.abs(num) < 1e-10 && num !== 0) return num.toExponential(4);
    // Limit precision to 10 decimals cleanly
    const fixed = parseFloat(num.toFixed(10));
    return fixed.toString();
  }

  // Safe Tokenizer and Shunting-Yard / Expression Evaluator
  function evaluateMathExpression(exprStr) {
    if (!exprStr || exprStr.trim() === '') return 0;
    
    // Normalize string
    let clean = exprStr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/mod/g, '%')
      .replace(/\s+/g, '');

    // Tokenize
    const tokens = [];
    let i = 0;
    while (i < clean.length) {
      const c = clean[i];
      if ('+-*/%^()'.includes(c)) {
        // Unary minus check
        if (c === '-' && (tokens.length === 0 || '(*+-/%^'.includes(tokens[tokens.length - 1]))) {
          // Read negative number
          let numStr = '-';
          i++;
          while (i < clean.length && (/\d|\./).test(clean[i])) {
            numStr += clean[i];
            i++;
          }
          if (numStr === '-') {
            tokens.push(-1);
            tokens.push('*');
          } else {
            tokens.push(parseFloat(numStr));
          }
          continue;
        }
        tokens.push(c);
        i++;
      } else if (/\d|\./.test(c)) {
        let numStr = '';
        while (i < clean.length && (/\d|\./).test(clean[i])) {
          numStr += clean[i];
          i++;
        }
        tokens.push(parseFloat(numStr));
      } else {
        i++;
      }
    }

    // Shunting-Yard to Postfix (RPN)
    const outputQueue = [];
    const opStack = [];
    const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 };
    const rightAssociative = { '^': true };

    for (const token of tokens) {
      if (typeof token === 'number') {
        outputQueue.push(token);
      } else if (token in precedence) {
        while (
          opStack.length > 0 &&
          opStack[opStack.length - 1] !== '(' &&
          (
            (precedence[opStack[opStack.length - 1]] > precedence[token]) ||
            (precedence[opStack[opStack.length - 1]] === precedence[token] && !rightAssociative[token])
          )
        ) {
          outputQueue.push(opStack.pop());
        }
        opStack.push(token);
      } else if (token === '(') {
        opStack.push(token);
      } else if (token === ')') {
        while (opStack.length > 0 && opStack[opStack.length - 1] !== '(') {
          outputQueue.push(opStack.pop());
        }
        if (opStack.length > 0 && opStack[opStack.length - 1] === '(') {
          opStack.pop();
        }
      }
    }

    while (opStack.length > 0) {
      const op = opStack.pop();
      if (op !== '(' && op !== ')') {
        outputQueue.push(op);
      }
    }

    // Evaluate RPN
    const evalStack = [];
    for (const token of outputQueue) {
      if (typeof token === 'number') {
        evalStack.push(token);
      } else {
        const b = evalStack.pop();
        const a = evalStack.pop();
        if (a === undefined || b === undefined) return NaN;

        switch (token) {
          case '+': evalStack.push(a + b); break;
          case '-': evalStack.push(a - b); break;
          case '*': evalStack.push(a * b); break;
          case '/': 
            if (b === 0) return NaN;
            evalStack.push(a / b); 
            break;
          case '%': 
            if (b === 0) return NaN;
            evalStack.push(a % b); 
            break;
          case '^': evalStack.push(Math.pow(a, b)); break;
          default: return NaN;
        }
      }
    }

    return evalStack.length === 1 ? evalStack[0] : NaN;
  }

  // Get current active numeric operand from display
  function getCurrentOperand() {
    let cur = calcState.display;
    if (cur === 'Error' || !cur) return 0;
    // Extract trailing number
    const match = cur.match(/([+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*$/i);
    return match ? parseFloat(match[1]) : (parseFloat(cur) || 0);
  }

  // Apply single-argument function to current operand
  function applyUnaryFunction(fnName, computeFn) {
    let val = getCurrentOperand();
    if (isNaN(val)) {
      calcState.display = 'Error';
      updateCalcScreen();
      return;
    }
    const res = computeFn(val);
    if (!Number.isFinite(res) || isNaN(res)) {
      calcState.display = 'Error';
    } else {
      const formatted = formatNumber(res);
      calcState.history = `${fnName}(${val})`;
      calcState.display = formatted;
      calcState.shouldResetDisplay = true;
    }
    updateCalcScreen();
  }

  window.calcAction = function(action) {
    let cur = calcState.display;

    // Reset if previous action completed calculation and user types a digit
    if (calcState.shouldResetDisplay && ('0123456789.'.includes(action) || action === 'pi' || action === 'e')) {
      cur = '0';
      calcState.display = '0';
      calcState.shouldResetDisplay = false;
    } else if (calcState.shouldResetDisplay && ('+-*/%^'.includes(action) || action === 'mod' || action === 'x^y')) {
      calcState.shouldResetDisplay = false;
    }

    switch(action) {
      case '0': case '1': case '2': case '3': case '4':
      case '5': case '6': case '7': case '8': case '9':
        if (cur === '0' || cur === 'Error') {
          calcState.display = action;
        } else {
          calcState.display += action;
        }
        break;

      case '.':
        if (cur === 'Error') {
          calcState.display = '0.';
        } else {
          // Check if current active number part already has a dot
          const parts = cur.split(/[\s+\-*/%^()]+/);
          const lastPart = parts[parts.length - 1];
          if (!lastPart.includes('.')) {
            calcState.display += '.';
          }
        }
        break;

      case 'C':
        calcState.display = '0';
        calcState.history = '';
        calcState.shouldResetDisplay = false;
        break;

      case 'CE':
        calcState.display = '0';
        calcState.shouldResetDisplay = false;
        break;

      case 'BACK':
        if (cur.length > 1 && cur !== 'Error') {
          calcState.display = cur.trimEnd().slice(0, -1).trimEnd();
          if (calcState.display === '') calcState.display = '0';
        } else {
          calcState.display = '0';
        }
        break;

      case '+/-':
        if (cur !== '0' && cur !== 'Error') {
          let val = getCurrentOperand();
          let flipped = -val;
          let formatted = formatNumber(flipped);
          // If display is a single number, replace directly
          if (!/[\s+\-*/%^]/.test(cur)) {
            calcState.display = formatted;
          } else {
            calcState.display = cur.replace(/([+-]?\d+(?:\.\d+)?)\s*$/, formatted);
          }
        }
        break;

      case '+': case '-': case '*': case '/': case '%':
        if (cur === 'Error') cur = '0';
        calcState.display = cur.trimEnd() + ' ' + action + ' ';
        break;

      case 'x^y':
        if (cur === 'Error') cur = '0';
        calcState.display = cur.trimEnd() + ' ^ ';
        break;

      case 'mod':
        if (cur === 'Error') cur = '0';
        calcState.display = cur.trimEnd() + ' % ';
        break;

      case '(':
        if (cur === '0' || cur === 'Error') {
          calcState.display = '(';
        } else {
          calcState.display += ' ( ';
        }
        break;

      case ')':
        calcState.display += ' )';
        break;

      case 'pi':
        calcState.display = Math.PI.toString();
        calcState.shouldResetDisplay = true;
        break;

      case 'e':
        calcState.display = Math.E.toString();
        calcState.shouldResetDisplay = true;
        break;

      case 'abs':
        applyUnaryFunction('abs', v => Math.abs(v));
        return;

      case 'sin':
        applyUnaryFunction('sin', v => {
          const rad = calcState.isRad ? v : (v * Math.PI / 180);
          return Math.sin(rad);
        });
        return;

      case 'cos':
        applyUnaryFunction('cos', v => {
          const rad = calcState.isRad ? v : (v * Math.PI / 180);
          return Math.cos(rad);
        });
        return;

      case 'tan':
        applyUnaryFunction('tan', v => {
          const rad = calcState.isRad ? v : (v * Math.PI / 180);
          return Math.tan(rad);
        });
        return;

      case 'asin':
        applyUnaryFunction('asin', v => {
          const res = Math.asin(v);
          return calcState.isRad ? res : (res * 180 / Math.PI);
        });
        return;

      case 'acos':
        applyUnaryFunction('acos', v => {
          const res = Math.acos(v);
          return calcState.isRad ? res : (res * 180 / Math.PI);
        });
        return;

      case 'atan':
        applyUnaryFunction('atan', v => {
          const res = Math.atan(v);
          return calcState.isRad ? res : (res * 180 / Math.PI);
        });
        return;

      case 'sinh':
        applyUnaryFunction('sinh', v => Math.sinh(v));
        return;

      case 'cosh':
        applyUnaryFunction('cosh', v => Math.cosh(v));
        return;

      case 'tanh':
        applyUnaryFunction('tanh', v => Math.tanh(v));
        return;

      case 'ln':
        applyUnaryFunction('ln', v => (v > 0 ? Math.log(v) : NaN));
        return;

      case 'log':
        applyUnaryFunction('log10', v => (v > 0 ? Math.log10(v) : NaN));
        return;

      case 'e^x':
        applyUnaryFunction('e^', v => Math.exp(v));
        return;

      case '10^x':
        applyUnaryFunction('10^', v => Math.pow(10, v));
        return;

      case 'sqrt':
        applyUnaryFunction('√', v => (v >= 0 ? Math.sqrt(v) : NaN));
        return;

      case 'cbrt':
        applyUnaryFunction('∛', v => Math.cbrt(v));
        return;

      case 'x^2':
        applyUnaryFunction('sqr', v => Math.pow(v, 2));
        return;

      case 'x^3':
        applyUnaryFunction('cube', v => Math.pow(v, 3));
        return;

      case '1/x':
        applyUnaryFunction('recip', v => (v !== 0 ? 1 / v : NaN));
        return;

      case 'fact':
        applyUnaryFunction('fact', v => factorial(v));
        return;

      case 'MC':
        calcState.memory = 0;
        break;

      case 'MR':
        calcState.display = formatNumber(calcState.memory);
        calcState.shouldResetDisplay = true;
        break;

      case 'MS':
        calcState.memory = getCurrentOperand();
        break;

      case 'M+':
        calcState.memory += getCurrentOperand();
        break;

      case 'M-':
        calcState.memory -= getCurrentOperand();
        break;

      case '=':
        try {
          const exprToEval = calcState.display;
          const result = evaluateMathExpression(exprToEval);
          if (isNaN(result) || !Number.isFinite(result)) {
            calcState.display = 'Error';
          } else {
            calcState.history = exprToEval + ' =';
            calcState.display = formatNumber(result);
            calcState.shouldResetDisplay = true;
          }
        } catch (e) {
          calcState.display = 'Error';
        }
        break;
    }

    updateCalcScreen();
  };

  document.addEventListener('DOMContentLoaded', initCalculator);
})();
