/**
 * [v1.0.0] 全局总览（卡片视图）
 * 改动记录：
 * - 新增：低库存预警（安全库存以下卡片红色高亮+置顶排序）
 * - 新增：负责人筛选下拉框
 */
const { useState, useMemo } = window.PreactHooks;
export function AggregateView({ reagents, inventory, fields }) {
  const [search, setSearch] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('');
  const customFields = fields.filter(f => !f.builtin);

  // 识别特殊自定义字段
  const operatorField = customFields.find(f => f.label === '负责人');
  const unitField = customFields.find(f => f.label === '单位');

  // 收集所有不重复的负责人
  const operators = useMemo(() => {
    if (!operatorField) return [];
    const set = new Set();
    reagents.forEach(r => {
      const val = r.custom?.[operatorField.id];
      if (val) set.add(val);
    });
    return Array.from(set).sort();
  }, [reagents, operatorField]);

  const data = useMemo(() => {
    return reagents.map(r => {
      const total = inventory.filter(inv => inv.reagent_id === r.id).reduce((sum, inv) => sum + inv.current_quantity, 0);
      const isLow = r.safety_stock > 0 && total <= r.safety_stock;
      return { ...r, total, isLow };
    }).filter(r => {
      const s = search.toLowerCase();
      const basicMatch = r.name.toLowerCase().includes(s) || r.code.toLowerCase().includes(s) || r.brand.toLowerCase().includes(s);
      const customMatch = Object.values(r.custom || {}).some(v => String(v).toLowerCase().includes(s));
      const operatorMatch = !operatorFilter || r.custom?.[operatorField?.id] === operatorFilter;
      return (basicMatch || customMatch) && operatorMatch;
    }).sort((a, b) => {
      // 低库存排前面
      if (a.isLow && !b.isLow) return -1;
      if (!a.isLow && b.isLow) return 1;
      return a.code.localeCompare(b.code);
    });
  }, [reagents, inventory, search, operatorFilter, operatorField]);

  // 数量颜色计算
  const getQuantityColor = (total) => {
    if (total > 10) return 'text-green-600';
    if (total < 2) return 'text-red-500';
    // 2-10 之间使用 HSL 渐变：红色 hue=0 到 绿色 hue=120
    const ratio = (total - 2) / 8; // 0~1
    const hue = Math.round(ratio * 120);
    return `text-[hsl(${hue},70%,45%)]`;
  };

  const getQuantityStyle = (total) => {
    if (total > 10) return { color: '#16a34a' };
    if (total < 2) return { color: '#ef4444' };
    const ratio = (total - 2) / 8;
    const hue = Math.round(ratio * 120);
    return { color: `hsl(${hue}, 70%, 45%)` };
  };

  return window.html`
    <div class="fade-in">
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <div class="flex-1 relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔍</span>
          <input type="text" placeholder="搜索试剂名称、简写、品牌或自定义字段..." value=${search}
            onInput=${e => setSearch(e.target.value)}
            class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm" />
        </div>
        ${operators.length > 0 && window.html`
          <div class="flex items-center gap-2">
            <select value=${operatorFilter}
              onChange=${e => setOperatorFilter(e.target.value)}
              class="px-3 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-primary text-sm text-gray-700 cursor-pointer">
              <option value="">全部负责人</option>
              ${operators.map(op => window.html`<option key=${op} value=${op}>👤 ${op}</option>`)}
            </select>
            ${operatorFilter && window.html`
              <button onClick=${() => setOperatorFilter('')}
                class="px-3 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium transition-colors">
                全部
              </button>
            `}
          </div>
        `}
        <button onClick=${() => alert('扫码功能预留：后续接入摄像头扫描试剂条码/二维码')}
          class="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-primary hover:text-primary transition-all text-sm font-medium text-gray-600">
          <span class="text-lg">📷</span><span class="hidden sm:inline">扫码</span>
        </button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        ${data.map(item => window.html`
          <div key=${item.id} class="rounded-xl p-5 border card-hover ${item.isLow ? 'bg-red-50/50 border-red-200' : 'bg-white border-gray-100'}">
            <div class="flex items-start justify-between mb-2">
              <span class="inline-block px-2.5 py-0.5 ${item.isLow ? 'bg-red-100 text-red-700' : 'bg-primary/10 text-primary'} text-xs font-bold rounded-md tracking-wide">${item.code}</span>
              <span class="text-xs ${item.isLow ? 'text-red-400 font-medium' : 'text-gray-400'}">${item.brand}</span>
            </div>
            <h3 class="font-semibold text-lg mb-1 ${item.isLow ? 'text-red-800' : 'text-gray-800'}">${item.name}</h3>
            ${item.isLow && window.html`
              <div class="mb-2">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-md border border-red-200">
                  ⚠ 库存不足（安全线 ${item.safety_stock}）
                </span>
              </div>
            `}
            ${operatorField && item.custom?.[operatorField.id] && window.html`
              <div class="mb-2">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-md border border-amber-100">
                  👤 负责人：${item.custom[operatorField.id]}
                </span>
              </div>
            `}
            ${customFields.length > 0 && window.html`
              <div class="flex flex-wrap gap-1.5 mt-1">
                ${customFields.filter(cf => cf.id !== operatorField?.id).map(cf => {
                  const val = item.custom?.[cf.id];
                  if (!val) return null;
                  return window.html`<span key=${cf.id} class="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">${cf.label}:${val}</span>`;
                })}
              </div>
            `}
            <div class="mt-4 flex items-end justify-between">
              <span class="text-xs ${item.isLow ? 'text-red-400' : 'text-gray-400'}">总库存量</span>
              <div class="flex items-baseline gap-1">
                <span class="text-2xl font-bold ${item.isLow ? 'text-red-600' : ''}" style=${item.isLow ? '' : getQuantityStyle(item.total)}>${item.total}</span>
                ${unitField && item.custom?.[unitField.id] && window.html`
                  <span class="text-sm text-gray-400 font-normal">${item.custom[unitField.id]}</span>
                `}
              </div>
            </div>
          </div>
        `)}
      </div>
      ${data.length === 0 && window.html`
        <div class="text-center py-20 text-gray-400">
          <div class="text-5xl mb-3 opacity-50">📦</div>
          <p>未找到匹配的试剂</p>
        </div>
      `}
    </div>
  `;
}

// ==================== 分仓明细（含移库） ====================
