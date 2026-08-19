/**
 * IIT JAM Style Virtual Scientific Calculator
 */
(function() {
  let calcState = {
    display: '0',
    memory: 0,
    isRad: true,
    history: ''
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
            <!-- Row 1: Memory & Clear -->
            <button class="calc-btn btn-mem" onclick="window.calcAction('MC')">MC</button>
            <button class="calc-btn btn-mem" onclick="window.calcAction('MR')">MR</button>
            <button class="calc-btn btn-mem" onclick="window.calcAction('MS')">MS</button>
            <button class="calc-btn btn-mem" onclick="window.calcAction('M+')">M+</button>
            <button class="calc-btn btn-mem" onclick="window.calcAction('M-')">M-</button>
            <button class="calc-btn btn-danger" onclick="window.calcAction('C')">C</button>
            <button class="calc-btn btn-danger" onclick="window.calcAction('CE')">CE</button>
            <button class="calc-btn btn-action" onclick="window.calcAction('BACK')">⌫</button>

            <!-- Row 2: Trig & Powers -->
            <button class="calc-btn btn-fn" onclick="window.calcAction('sin')">sin</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('cos')">cos</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('tan')">tan</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('ln')">ln</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('log')">log</button>
            <button class="calc-btn btn-num" onclick="window.calcAction('(')">(</button>
            <button class="calc-btn btn-num" onclick="window.calcAction(')')">)</button>
            <button class="calc-btn btn-op" onclick="window.calcAction('/')">÷</button>

            <!-- Row 3: Inverse Trig & Exponents -->
            <button class="calc-btn btn-fn" onclick="window.calcAction('asin')">asin</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('acos')">acos</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('atan')">atan</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('e^x')">eˣ</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('10^x')">10ˣ</button>
            <button class="calc-btn btn-num" onclick="window.calcAction('7')">7</button>
            <button class="calc-btn btn-num" onclick="window.calcAction('8')">8</button>
            <button class="calc-btn btn-num" onclick="window.calcAction('9')">9</button>
            <button class="calc-btn btn-op" onclick="window.calcAction('*')">×</button>

            <!-- Row 4: Hyperbolic & Roots -->
            <button class="calc-btn btn-fn" onclick="window.calcAction('sinh')">sinh</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('cosh')">cosh</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('tanh')">tanh</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('sqrt')">√x</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('x^y')">xʸ</button>
            <button class="calc-btn btn-num" onclick="window.calcAction('4')">4</button>
            <button class="calc-btn btn-num" onclick="window.calcAction('5')">5</button>
            <button class="calc-btn btn-num" onclick="window.calcAction('6')">6</button>
            <button class="calc-btn btn-op" onclick="window.calcAction('-')">−</button>

            <!-- Row 5: Factorial & Numbers -->
            <button class="calc-btn btn-fn" onclick="window.calcAction('fact')">n!</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('1/x')">1/x</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('pi')">π</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('e')">e</button>
            <button class="calc-btn btn-fn" onclick="window.calcAction('+/-')">±</button>
            <button class="calc-btn btn-num" onclick="window.calcAction('1')">1</button>
            <button class="calc-btn btn-num" onclick="window.calcAction('2')">2</button>
            <button class="calc-btn btn-num" onclick="window.calcAction('3')">3</button>
            <button class="calc-btn btn-op" onclick="window.calcAction('+')">+</button>

            <!-- Row 6: Zero & Equals -->
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

    // Append to body if not already present
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
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
  }

  window.calcAction = function(action) {
    let cur = calcState.display;
    let val = parseFloat(cur) || 0;

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
        if (!cur.includes('.')) calcState.display += '.';
        break;
      case 'C':
        calcState.display = '0';
        calcState.history = '';
        break;
      case 'CE':
        calcState.display = '0';
        break;
      case 'BACK':
        if (cur.length > 1 && cur !== 'Error') {
          calcState.display = cur.slice(0, -1);
        } else {
          calcState.display = '0';
        }
        break;
      case '+/-':
        if (cur !== '0' && cur !== 'Error') {
          if (cur.startsWith('-')) calcState.display = cur.slice(1);
          else calcState.display = '-' + cur;
        }
        break;
      case '+': case '-': case '*': case '/': case '(': case ')':
        if (cur === 'Error') cur = '0';
        calcState.display += ' ' + action + ' ';
        break;
      case 'x^y':
        calcState.display += ' ^ ';
        break;
      case 'mod':
        calcState.display += ' % ';
        break;
      case 'pi':
        calcState.display = Math.PI.toString();
        break;
      case 'e':
        calcState.display = Math.E.toString();
        break;
      case 'sin':
        let angleSin = calcState.isRad ? val : (val * Math.PI / 180);
        calcState.display = Math.sin(angleSin).toFixed(8).replace(/\.?0+$/, '');
        calcState.history = `sin(${val})`;
        break;
      case 'cos':
        let angleCos = calcState.isRad ? val : (val * Math.PI / 180);
        calcState.display = Math.cos(angleCos).toFixed(8).replace(/\.?0+$/, '');
        calcState.history = `cos(${val})`;
        break;
      case 'tan':
        let angleTan = calcState.isRad ? val : (val * Math.PI / 180);
        calcState.display = Math.tan(angleTan).toFixed(8).replace(/\.?0+$/, '');
        calcState.history = `tan(${val})`;
        break;
      case 'asin':
        let resAsin = Math.asin(val);
        calcState.display = (calcState.isRad ? resAsin : resAsin * 180 / Math.PI).toFixed(8).replace(/\.?0+$/, '');
        calcState.history = `asin(${val})`;
        break;
      case 'acos':
        let resAcos = Math.acos(val);
        calcState.display = (calcState.isRad ? resAcos : resAcos * 180 / Math.PI).toFixed(8).replace(/\.?0+$/, '');
        calcState.history = `acos(${val})`;
        break;
      case 'atan':
        let resAtan = Math.atan(val);
        calcState.display = (calcState.isRad ? resAtan : resAtan * 180 / Math.PI).toFixed(8).replace(/\.?0+$/, '');
        calcState.history = `atan(${val})`;
        break;
      case 'ln':
        calcState.display = Math.log(val).toFixed(8).replace(/\.?0+$/, '');
        calcState.history = `ln(${val})`;
        break;
      case 'log':
        calcState.display = Math.log10(val).toFixed(8).replace(/\.?0+$/, '');
        calcState.history = `log10(${val})`;
        break;
      case 'e^x':
        calcState.display = Math.exp(val).toFixed(8).replace(/\.?0+$/, '');
        calcState.history = `e^(${val})`;
        break;
      case '10^x':
        calcState.display = Math.pow(10, val).toFixed(8).replace(/\.?0+$/, '');
        calcState.history = `10^(${val})`;
        break;
      case 'sqrt':
        calcState.display = Math.sqrt(val).toFixed(8).replace(/\.?0+$/, '');
        calcState.history = `√(${val})`;
        break;
      case 'cbrt':
        calcState.display = Math.cbrt(val).toFixed(8).replace(/\.?0+$/, '');
        calcState.history = `∛(${val})`;
        break;
      case 'x^2':
        calcState.display = Math.pow(val, 2).toString();
        calcState.history = `(${val})²`;
        break;
      case 'x^3':
        calcState.display = Math.pow(val, 3).toString();
        calcState.history = `(${val})³`;
        break;
      case '1/x':
        calcState.display = (val !== 0 ? (1 / val) : 'Error').toString();
        calcState.history = `1/(${val})`;
        break;
      case 'fact':
        calcState.display = factorial(val).toString();
        calcState.history = `${val}!`;
        break;
      case 'MC':
        calcState.memory = 0;
        break;
      case 'MR':
        calcState.display = calcState.memory.toString();
        break;
      case 'MS':
        calcState.memory = val;
        break;
      case 'M+':
        calcState.memory += val;
        break;
      case 'M-':
        calcState.memory -= val;
        break;
      case '=':
        try {
          calcState.history = calcState.display + ' =';
          let expr = calcState.display.replace(/\^/g, '**');
          // safe eval of math expressions
          let evalResult = Function('"use strict"; return (' + expr + ')')();
          calcState.display = Number.isFinite(evalResult) ? parseFloat(evalResult.toFixed(10)).toString() : 'Error';
        } catch (e) {
          calcState.display = 'Error';
        }
        break;
    }

    updateCalcScreen();
  };

  // Setup on DOM load
  document.addEventListener('DOMContentLoaded', initCalculator);
})();
