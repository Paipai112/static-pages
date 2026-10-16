/* Optional price-band input, persistence, validation and handoff formatting. */
(() => {
  'use strict';

  const currencies = [
    ['USD', '美元'], ['EUR', '欧元'], ['CNY', '人民币'], ['GBP', '英镑'],
    ['JPY', '日元'], ['CAD', '加元'], ['AUD', '澳元'], ['MXN', '墨西哥比索'],
    ['BRL', '巴西雷亚尔'], ['SEK', '瑞典克朗'], ['PLN', '波兰兹罗提'],
    ['TRY', '土耳其里拉'], ['INR', '印度卢比'], ['SGD', '新加坡元'],
    ['AED', '阿联酋迪拉姆'], ['SAR', '沙特里亚尔'], ['EGP', '埃及镑'], ['ZAR', '南非兰特']
  ];
  const currencyCodes = new Set(currencies.map(([code]) => code));
  const asText = (value) => typeof value === 'string' ? value :
    typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US', {useGrouping: false, maximumSignificantDigits: 21}) : '';
  const priceValue = (value) => {
    const text = value.trim();
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
    const number = Number(text);
    return Number.isFinite(number) && number >= 0 && number <= Number.MAX_SAFE_INTEGER ? number : null;
  };
  const formatPrice = (value) => value.toLocaleString('zh-CN', {maximumSignificantDigits: 21});
  const rangeText = (tier, currency) => currency + ' ' + formatPrice(tier.startPrice) + ' ≤ 价格 < ' + formatPrice(tier.endPrice);

  function create({root, onChange}) {
    const currency = root.querySelector('#price-band-currency');
    const currencyError = root.querySelector('#price-band-currency-error');
    const list = root.querySelector('#price-band-list');
    const empty = root.querySelector('#price-band-empty');
    const addButton = root.querySelector('#add-price-band');
    const preview = root.querySelector('#price-band-preview');
    const previewList = root.querySelector('#price-band-ranges');
    const previewHint = root.querySelector('#price-band-hint');
    const restoreNote = root.querySelector('#price-band-restore-note');
    const announcement = root.querySelector('#price-band-status');
    let rows = [];
    let nextId = 0;

    currencies.forEach(([code, name]) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = code + ' · ' + name;
      currency.append(option);
    });

    function snapshot({draft = false} = {}) {
      const tiers = rows.map((row) => ({
        startPrice: draft ? row.start.value : priceValue(row.start.value),
        endPrice: draft ? row.end.value : priceValue(row.end.value)
      }));
      if (!draft) tiers.sort((a, b) => a.startPrice - b.startPrice);
      return {currency: rows.length ? currency.value : '', boundary: 'lower-inclusive-upper-exclusive', tiers};
    }

    function issues() {
      const result = [];
      if (rows.length && !currencyCodes.has(currency.value)) {
        result.push({control: currency, message: currencyError, text: '请选择价位段的分级币种。'});
      }
      const ranges = rows.map((row) => ({start: priceValue(row.start.value), end: priceValue(row.end.value)}));
      const validRange = (range) => range.start !== null && range.end !== null && range.end > range.start;
      rows.forEach((row, index) => {
        const range = ranges[index];
        if (range.start === null) {
          result.push({control: row.start, message: row.startError, text: '请填写有效的非负起始价格，使用小数点表示小数。'});
        }
        if (range.end === null) {
          result.push({control: row.end, message: row.endError, text: '请填写有效的非负终止价格，使用小数点表示小数。'});
        } else if (range.start !== null && range.end <= range.start) {
          result.push({control: row.end, message: row.endError, text: '终止价格必须大于起始价格。'});
        }
        if (validRange(range)) {
          const overlap = ranges.findIndex((other, otherIndex) => otherIndex !== index && validRange(other) && range.start < other.end && other.start < range.end);
          if (overlap !== -1) result.push({control: row.start, message: row.startError, text: '与第 ' + (overlap + 1) + ' 个价位段重叠，请调整价格范围。'});
        }
      });
      return result;
    }

    function validate() {
      const controls = [{control: currency, message: currencyError}];
      rows.forEach((row) => controls.push({control: row.start, message: row.startError}, {control: row.end, message: row.endError}));
      controls.forEach(({control, message}) => {
        control.removeAttribute('aria-invalid');
        message.textContent = '';
        message.hidden = true;
      });
      return issues().map(({control, message, text}) => {
        control.setAttribute('aria-invalid', 'true');
        message.textContent = text;
        message.hidden = false;
        return {id: control.id, text};
      });
    }

    function updatePreview() {
      empty.hidden = rows.length > 0;
      preview.hidden = !rows.length || issues().length > 0;
      previewHint.hidden = !rows.length || !preview.hidden;
      previewList.replaceChildren();
      if (preview.hidden) return;
      const strategy = snapshot();
      strategy.tiers.forEach((tier) => {
        const item = document.createElement('li');
        const range = document.createElement('span');
        range.textContent = rangeText(tier, strategy.currency);
        item.append(range);
        previewList.append(item);
      });
    }

    function changed() {
      if (rows.every((row) => row.end.value.trim())) restoreNote.hidden = true;
      updatePreview();
      onChange();
    }

    function renumber() {
      rows.forEach((row, index) => {
        row.legend.textContent = '价位段 ' + (index + 1);
        row.start.setAttribute('aria-label', '第 ' + (index + 1) + ' 段起始价格');
        row.end.setAttribute('aria-label', '第 ' + (index + 1) + ' 段终止价格');
        row.remove.setAttribute('aria-label', '删除第 ' + (index + 1) + ' 个价位段');
      });
    }

    function addRow(tier = {}, focus = false) {
      const id = 'price-band-' + (++nextId);
      const item = document.createElement('li');
      // Only static markup is interpolated; user entries are assigned via .value.
      item.innerHTML = '<fieldset class="price-band-row"><legend class="sr-only"></legend>' +
        '<div><label class="field-label" for="' + id + '-start">起始价格</label>' +
        '<input id="' + id + '-start" type="text" inputmode="decimal" maxlength="24" placeholder="如：0" aria-describedby="price-band-help ' + id + '-start-error">' +
        '<p id="' + id + '-start-error" class="error" hidden></p></div>' +
        '<div><label class="field-label" for="' + id + '-end">终止价格</label>' +
        '<input id="' + id + '-end" type="text" inputmode="decimal" maxlength="24" placeholder="如：100" aria-describedby="price-band-help ' + id + '-end-error">' +
        '<p id="' + id + '-end-error" class="error" hidden></p></div>' +
        '<button class="text-button price-band-remove" type="button">删除</button></fieldset>';
      const row = {
        item, legend: item.querySelector('legend'), start: item.querySelector('#' + id + '-start'),
        end: item.querySelector('#' + id + '-end'), remove: item.querySelector('button'),
        startError: item.querySelector('#' + id + '-start-error'), endError: item.querySelector('#' + id + '-end-error')
      };
      row.start.value = asText(tier?.startPrice);
      row.end.value = asText(tier?.endPrice);
      row.start.addEventListener('input', changed);
      row.end.addEventListener('input', changed);
      row.remove.addEventListener('click', () => {
        const index = rows.indexOf(row);
        rows.splice(index, 1);
        item.remove();
        renumber();
        changed();
        announcement.textContent = '已删除价位段，当前共 ' + rows.length + ' 段。';
        (rows[Math.min(index, rows.length - 1)]?.remove || addButton).focus();
      });
      rows.push(row);
      list.append(item);
      renumber();
      if (focus) {
        changed();
        announcement.textContent = '已添加价位段，当前共 ' + rows.length + ' 段。';
        row.start.focus();
      }
    }

    function restore(strategy) {
      rows = [];
      list.replaceChildren();
      currency.value = currencyCodes.has(strategy?.currency) ? strategy.currency : '';
      if (Array.isArray(strategy?.tiers)) strategy.tiers.forEach((tier) => addRow(tier));
      restoreNote.hidden = !Array.isArray(strategy?.tiers) || !strategy.tiers.some((tier) => tier && !Object.prototype.hasOwnProperty.call(tier, 'endPrice'));
      updatePreview();
    }

    currency.addEventListener('change', changed);
    addButton.addEventListener('click', () => addRow({}, true));
    updatePreview();
    return {snapshot, restore, validate};
  }

  function describe(strategy) {
    if (!strategy.tiers.length) return '价位段分级策略：未指定。';
    const lines = ['价位段分级策略（' + strategy.currency + '，包含起始价格、不包含终止价格）：'];
    strategy.tiers.forEach((tier) => lines.push('- ' + rangeText(tier, strategy.currency)));
    lines.push('上述区间以外的产品保留在调研范围内，标为未分段。');
    return lines.join('\n');
  }

  window.ResearchPriceBands = {create, describe};
})();
