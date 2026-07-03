/**
 * [v1.0.0] 试剂基础管理
 * 改动记录：
 * - 新增：安全库存 inline 编辑（表格内点击直接修改）
 * - 新增：页面搜索框（覆盖名称/简写/品牌/自定义字段）
 * - 新增：统一库存变更入口（onInventoryItemChange），数量修改自动记日志
 * - 新增：CSV 导入批量记日志
 * - 新增：清除全部数据功能
 * - 修复：中文名称自动编码（拼音首字母+序号）
 * - 修复：位置独立（导入位置只给903，908保持待分配）
 * - 优化：导入模板/导出支持 903位置+908位置 双列
 */
const { useState, useRef } = window.PreactHooks;

const BUILTIN_FIELDS = [
  { id: 'name', label: '试剂名称', type: 'text', builtin: true, required: true },
  { id: 'code', label: '简写代码', type: 'text', builtin: true, required: true },
  { id: 'brand', label: '品牌', type: 'text', builtin: true, required: false },
];

const normalizeFieldLabel = (value) => String(value || '').trim().replace(/\s+/g, '');
const isCategoryField = (field) => normalizeFieldLabel(field?.label) === '分类';
const normalizeItemCategory = (value) => {
  const text = String(value || '').trim().toLowerCase();
  if (text.includes('耗材') || text.includes('consumable')) return '耗材';
  return '试剂';
};

export function ReagentManager({ reagents, inventory, fields, logs, onReagentsChange, onInventoryChange, onInventoryItemChange, onFieldsChange, onLogsChange }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showFieldConfig, setShowFieldConfig] = useState(false);
  const [editingReagent, setEditingReagent] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', brand: '', custom: {} });
  const [qty903, setQty903] = useState('');
  const [qty908, setQty908] = useState('');
  const [safetyStock, setSafetyStock] = useState('');
  const [csvText, setCsvText] = useState('');
  const [editingSafetyStock, setEditingSafetyStock] = useState(null); // { id, value }
  const [search, setSearch] = useState('');
  const fileRef = useRef(null);

  const customFields = fields.filter(f => !f.builtin);
  const allFields = fields;
  const categoryField = customFields.find(isCategoryField);
  const normalizeCustomValues = (custom = {}) => {
    const next = { ...custom };
    if (categoryField) next[categoryField.id] = normalizeItemCategory(next[categoryField.id]);
    return next;
  };

  // 重置表单
  const resetForm = () => {
    const emptyCustom = {};
    customFields.forEach(f => emptyCustom[f.id] = isCategoryField(f) ? '试剂' : '');
    setForm({ name: '', code: '', brand: '', custom: emptyCustom });
    setQty903('');
    setQty908('');
    setSafetyStock('');
  };

  const openAdd = () => { resetForm(); setEditingReagent(null); setShowAdd(true); };
  const openEdit = (r) => {
    const custom = { ...r.custom };
    customFields.forEach(f => { if (!(f.id in custom)) custom[f.id] = isCategoryField(f) ? '试剂' : ''; });
    if (categoryField) custom[categoryField.id] = normalizeItemCategory(custom[categoryField.id]);
    setForm({ name: r.name, code: r.code, brand: r.brand, custom });
    // 回显当前库存数量和安全库存
    const inv903 = inventory.find(inv => inv.reagent_id === r.id && inv.location === '903');
    const inv908 = inventory.find(inv => inv.reagent_id === r.id && inv.location === '908');
    setQty903(inv903 ? String(inv903.current_quantity) : '');
    setQty908(inv908 ? String(inv908.current_quantity) : '');
    setSafetyStock(r.safety_stock ? String(r.safety_stock) : '');
    setEditingReagent(r);
    setShowAdd(true);
  };

  // 自动补全简写代码：输入纯字母时自动分配下一个编号
  const autoCompleteCode = (prefix) => {
    const prefixUpper = prefix.toUpperCase();
    const samePrefix = reagents.filter(r => r.code.toUpperCase().startsWith(prefixUpper));
    if (samePrefix.length === 0) return prefixUpper + '01';
    const numbers = samePrefix.map(r => {
      const match = r.code.toUpperCase().match(new RegExp('^' + prefixUpper + '(\\d+)$'));
      return match ? parseInt(match[1], 10) : 0;
    }).filter(n => n > 0);
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextNum = maxNum + 1;
    return prefixUpper + String(nextNum).padStart(2, '0');
  };

  const handleCodeBlur = () => {
    const val = form.code.trim();
    if (!val) return;
    // 如果输入是纯字母（如 Y），自动补全为下一个编号
    if (/^[A-Za-z]+$/.test(val)) {
      const completed = autoCompleteCode(val);
      setForm({ ...form, code: completed });
    }
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.code.trim()) return alert('试剂名称和简写代码必填');
    const codeUpper = form.code.trim().toUpperCase();
    const codeExists = reagents.some(r => r.code.toLowerCase() === codeUpper.toLowerCase() && r.id !== editingReagent?.id);
    if (codeExists) return alert('简写代码已存在，请更换');

    const ss = safetyStock.trim() === '' ? 0 : parseInt(safetyStock, 10);
    const safetyStockValue = isNaN(ss) ? 0 : Math.max(0, ss);
    const savedCustom = normalizeCustomValues(form.custom);
    let targetReagentId;

    if (editingReagent) {
      // 编辑试剂信息
      onReagentsChange(reagents.map(r => r.id === editingReagent.id ? {
        ...r, name: form.name.trim(), code: codeUpper, brand: form.brand.trim(),
        custom: savedCustom, safety_stock: safetyStockValue
      } : r));
      targetReagentId = editingReagent.id;

      // 数量变更走 onInventoryItemChange（自动记日志）
      const q903 = qty903.trim() === '' ? null : parseInt(qty903, 10);
      if (q903 !== null && !isNaN(q903)) {
        const existing = inventory.find(inv => inv.reagent_id === targetReagentId && inv.location === '903');
        if (existing && existing.current_quantity !== q903) {
          onInventoryItemChange(existing.id, q903, null, { note: '管理员修改库存' });
        } else if (!existing) {
          const newInvId = Math.max(...inventory.map(i => i.id), 0) + 1;
          onInventoryChange([...inventory, {
            id: newInvId, reagent_id: targetReagentId, location: '903',
            shelf_position: '待分配', purchase_order: '手动录入', current_quantity: q903
          }]);
        }
      }
      const q908 = qty908.trim() === '' ? null : parseInt(qty908, 10);
      if (q908 !== null && !isNaN(q908)) {
        const existing = inventory.find(inv => inv.reagent_id === targetReagentId && inv.location === '908');
        if (existing && existing.current_quantity !== q908) {
          onInventoryItemChange(existing.id, q908, null, { note: '管理员修改库存' });
        } else if (!existing) {
          const newInvId = Math.max(...inventory.map(i => i.id), 0) + 1;
          onInventoryChange([...inventory, {
            id: newInvId, reagent_id: targetReagentId, location: '908',
            shelf_position: '待分配', purchase_order: '手动录入', current_quantity: q908
          }]);
        }
      }
    } else {
      // 新增试剂
      const newId = Math.max(...reagents.map(r => r.id), 0) + 1;
      onReagentsChange([...reagents, {
        id: newId, name: form.name.trim(), code: codeUpper, brand: form.brand.trim() || '未标注',
        custom: savedCustom, safety_stock: safetyStockValue
      }]);
      targetReagentId = newId;

      // 创建初始库存记录（不记日志，因为是初始化）
      let nextInventory = [...inventory];
      nextInventory.push({
        id: Math.max(...nextInventory.map(i => i.id), 0) + 1, reagent_id: newId, location: '908',
        shelf_position: '待分配', purchase_order: '手动录入', current_quantity: 0
      });
      const q903 = qty903.trim() === '' ? null : parseInt(qty903, 10);
      if (q903 !== null && !isNaN(q903)) {
        nextInventory.push({
          id: Math.max(...nextInventory.map(i => i.id), 0) + 1, reagent_id: newId, location: '903',
          shelf_position: '待分配', purchase_order: '手动录入', current_quantity: q903
        });
      }
      const q908 = qty908.trim() === '' ? null : parseInt(qty908, 10);
      if (q908 !== null && !isNaN(q908)) {
        nextInventory.push({
          id: Math.max(...nextInventory.map(i => i.id), 0) + 1, reagent_id: newId, location: '908',
          shelf_position: '待分配', purchase_order: '手动录入', current_quantity: q908
        });
      }
      onInventoryChange(nextInventory);
    }

    setShowAdd(false);
  };

  const handleDelete = (id) => {
    if (!confirm('确定删除该试剂？关联的库存记录也将被移除。')) return;
    onReagentsChange(reagents.filter(r => r.id !== id));
    onInventoryChange(inventory.filter(inv => inv.reagent_id !== id));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = new Uint8Array(ev.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          if (json.length < 2) return alert('Excel文件为空或格式不正确');
          // 转换为 CSV 文本格式，复用现有导入逻辑
          const csv = json.map(row => row.map(cell => {
            const str = String(cell ?? '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
          }).join(',')).join('\n');
          setCsvText(csv);
        } catch (err) {
          alert('Excel解析失败：' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => setCsvText(ev.target.result);
      reader.readAsText(file);
    }
  };

  const handleImportCSV = () => {
    if (!csvText.trim()) return alert('请先上传或粘贴CSV内容');
    const rows = window.utils.parseCSV(csvText);
    if (rows.length === 0) return alert('CSV格式错误或为空');

    // 构建字段映射：CSV列名 -> 字段id
    const csvHeaders = Object.keys(rows[0]);
    const normalizeHeader = (value) => String(value || '').trim().replace(/\s+/g, '').replace(/[()（）]/g, '').toLowerCase();
    const findHeader = (aliases) => csvHeaders.find(h => aliases.some(alias => normalizeHeader(h) === normalizeHeader(alias)));
    const readCell = (row, header) => header ? String(row[header] ?? '').trim() : '';
    const parseNonNegativeInt = (value) => {
      const raw = String(value ?? '').trim();
      if (!raw) return 0;
      const n = Number.parseFloat(raw.replace(/,/g, ''));
      return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    };
    const parseOptionalNonNegativeInt = (value) => {
      const raw = String(value ?? '').trim();
      if (!raw) return null;
      const n = Number.parseFloat(raw.replace(/,/g, ''));
      return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
    };
    const fieldMap = {};
    allFields.forEach(f => {
      // 优先匹配label，再匹配id
      const matched = findHeader([f.label, f.id]);
      if (matched) fieldMap[matched] = f.id;
    });
    const getRowCustomValues = (row, { includeDefaults = false } = {}) => {
      const custom = {};
      customFields.forEach(f => {
        const matchedHeader = csvHeaders.find(h => fieldMap[h] === f.id);
        if (matchedHeader) {
          const value = String(row[matchedHeader] ?? '').trim();
          if (isCategoryField(f)) {
            custom[f.id] = normalizeItemCategory(value);
          } else if (value !== '') {
            custom[f.id] = value;
          }
        } else if (includeDefaults && isCategoryField(f)) {
          custom[f.id] = '试剂';
        }
      });
      return custom;
    };

    const nameHeader = findHeader(['试剂名称', 'name']);
    const codeHeader = findHeader(['简写代码', '简写', 'code']);
    const brandHeader = findHeader(['品牌', 'brand']);
    const safetyStockHeader = findHeader(['安全库存', '安全库存预警线', '库存预警线', '预警线', '安全线', 'safety_stock', 'safety stock']);

    // 数量列别名映射
    const qty903Header = findHeader(['903数量', '903']);
    const qty908Header = findHeader(['908数量', '908']);
    // 位置列别名映射："位置"默认给903，"908位置"专门给908
    const positionHeader = findHeader(['位置', 'shelf_position', 'location_detail']);
    const position908Header = findHeader(['908位置', '位置_908', 'shelf_position_908']);

    let added = 0, updated = 0, skipped = 0;
    let nextReagentId = Math.max(...reagents.map(r => r.id), 0) + 1;
    let nextInvId = Math.max(...inventory.map(i => i.id), 0) + 1;
    const newReagents = [...reagents];
    const newInventory = [...inventory];

    rows.forEach(row => {
      let name = readCell(row, nameHeader);
      let code = readCell(row, codeHeader).toUpperCase();
      const brand = readCell(row, brandHeader) || '未标注';
      const safetyStockValue = safetyStockHeader ? parseNonNegativeInt(row[safetyStockHeader]) : 0;
      if (!name) { skipped++; return; }
      // 简写代码为空时，按首字母自动生成
      if (!code) {
        // 跳过开头数字/标点/空格/字母，找第一个中文字符；无中文则取第一个字母
        let prefix = 'X';
        const chineseMatch = name.match(/[\u4e00-\u9fa5]/);
        const firstLetterMatch = name.match(/[a-zA-Z]/);
        const targetChar = chineseMatch ? chineseMatch[0] : (firstLetterMatch ? firstLetterMatch[0] : '');

        if (targetChar) {
          if (/[a-zA-Z]/.test(targetChar)) {
            prefix = targetChar.toUpperCase();
          } else {
            // 常见字直接映射（最可靠）
            const directMap = {
              '阿': 'A', '氨': 'A', '埃': 'A', '艾': 'A', '吖': 'A', '阿拉': 'A',
              '冰': 'B', '丙': 'B', '苯': 'B', '半': 'B', '白': 'B', '变': 'B',
              '草': 'C', '醋': 'C', '醇': 'C', '次': 'C', '残': 'C', '促': 'C',
              '搭': 'D', '碘': 'D', '淀': 'D', '多': 'D', '二': 'E', '丹': 'D',
              '额': 'E', '恩': 'E',
              '发': 'F', '芬': 'F', '分': 'F', '辅': 'F', '反': 'F', '复': 'F',
              '甘': 'G', '谷': 'G', '硅': 'G', '高': 'G', '果': 'G', '肝': 'G', '甘': 'G',
              '哈': 'H', '核': 'H', '红': 'H', '还': 'H', '海': 'H', '环': 'H', '琥': 'H',
              '肌': 'J', '己': 'J', '碱': 'J', '酒': 'J', '枸': 'J', '甲': 'J', '结': 'J',
              '考': 'K', '抗': 'K', '咔': 'K', '克': 'K',
              '垃': 'L', '亮': 'L', '离': 'L', '氯': 'L', '磷': 'L', '硫': 'L', '乳': 'R', '亮': 'L',
              '妈': 'M', '麦': 'M', '棉': 'M', '钼': 'M', '锰': 'M', '镁': 'M', '吗': 'M', '吗': 'M',
              '拿': 'N', '尼': 'N', '钠': 'N', '尿': 'N', '柠': 'N', '农': 'N', '萘': 'N',
              '哦': 'O', '呕': 'O',
              '啪': 'P', '葡': 'P', '嘌': 'P', '偏': 'P', '硼': 'P', '脯': 'P', '嘌': 'P',
              '期': 'Q', '羟': 'Q', '氢': 'Q', '青': 'Q', '琼': 'Q', '曲': 'Q',
              '然': 'R', '乳': 'R', '软': 'R', '溶': 'R', '肉': 'R',
              '撒': 'S', '色': 'S', '丝': 'S', '山': 'S', '三': 'S', '鼠': 'S', '水': 'S', '松': 'S',
              '他': 'T', '酞': 'T', '糖': 'T', '天': 'T', '铁': 'T', '脱': 'T', '碳': 'T', '吐': 'T',
              '挖': 'W', '维': 'W', '戊': 'W', '无': 'W', '微': 'W',
              '西': 'X', '纤': 'X', '腺': 'X', '硝': 'X', '锌': 'X', '溴': 'X', '血': 'X',
              '压': 'Y', '盐': 'Y', '洋': 'Y', '氧': 'Y', '乙': 'Y', '异': 'Y', '亚': 'Y', '油': 'Y', '叶': 'Y',
              '咋': 'Z', '重': 'Z', '中': 'Z', '终': 'Z', '组': 'Z', '蔗': 'Z', '正': 'Z', '植': 'Z',
            };
            if (directMap[targetChar]) {
              prefix = directMap[targetChar];
            } else {
              // 生僻字用 localeCompare 兜底
              const boundaries = [
                { char: '啊', initial: 'A' }, { char: '八', initial: 'B' }, { char: '擦', initial: 'C' },
                { char: '搭', initial: 'D' }, { char: '额', initial: 'E' }, { char: '发', initial: 'F' },
                { char: '噶', initial: 'G' }, { char: '哈', initial: 'H' }, { char: '击', initial: 'J' },
                { char: '喀', initial: 'K' }, { char: '垃', initial: 'L' }, { char: '妈', initial: 'M' },
                { char: '拿', initial: 'N' }, { char: '哦', initial: 'O' }, { char: '啪', initial: 'P' },
                { char: '期', initial: 'Q' }, { char: '然', initial: 'R' }, { char: '撒', initial: 'S' },
                { char: '他', initial: 'T' }, { char: '挖', initial: 'W' }, { char: '西', initial: 'X' },
                { char: '压', initial: 'Y' }, { char: '咋', initial: 'Z' }
              ];
              for (let i = boundaries.length - 1; i >= 0; i--) {
                if (targetChar.localeCompare(boundaries[i].char, 'zh-CN') >= 0) {
                  prefix = boundaries[i].initial;
                  break;
                }
              }
            }
          }
        }
        let num = 1;
        while (newReagents.some(r => r.code.toLowerCase() === (prefix + String(num).padStart(2, '0')).toLowerCase())) {
          num++;
        }
        code = prefix + String(num).padStart(2, '0');
      }
      if (!code) { skipped++; return; }
      // 自动编码：如果code是纯字母，自动补全为下一个编号
      if (/^[A-Z]+$/.test(code)) {
        const prefix = code;
        const samePrefix = newReagents.filter(r => r.code.toUpperCase().startsWith(prefix));
        const numbers = samePrefix.map(r => {
          const match = r.code.toUpperCase().match(new RegExp('^' + prefix + '(\\d+)$'));
          return match ? parseInt(match[1], 10) : 0;
        }).filter(n => n > 0);
        const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
        code = prefix + String(maxNum + 1).padStart(2, '0');
      }
      const duplicateIndex = newReagents.findIndex(r => r.code.toLowerCase() === code.toLowerCase());
      if (duplicateIndex >= 0) {
        const customUpdates = getRowCustomValues(row);
        const hasCustomUpdates = Object.keys(customUpdates).length > 0;
        if (safetyStockHeader) {
          newReagents[duplicateIndex] = {
            ...newReagents[duplicateIndex],
            custom: { ...(newReagents[duplicateIndex].custom || {}), ...customUpdates },
            safety_stock: safetyStockValue
          };
          updated++;
        } else if (hasCustomUpdates) {
          newReagents[duplicateIndex] = {
            ...newReagents[duplicateIndex],
            custom: { ...(newReagents[duplicateIndex].custom || {}), ...customUpdates },
          };
          updated++;
        } else {
          skipped++;
        }
        return;
      }

      // 提取自定义字段
      const custom = getRowCustomValues(row, { includeDefaults: true });

      const reagentId = nextReagentId++;
      newReagents.push({ id: reagentId, name, code, brand, custom, safety_stock: safetyStockValue });

      // 读取位置值："位置"列默认给903，"908位置"列专门给908
      const positionValue903 = positionHeader ? (row[positionHeader] || '').trim() : '';
      const positionValue908 = position908Header ? (row[position908Header] || '').trim() : '';
      const shelfPos903 = positionValue903 || '待分配';
      const shelfPos908 = positionValue908 || '待分配';

      // 默认创建 908 0 库存（如果有908位置则使用，否则待分配）
      newInventory.push({ id: nextInvId++, reagent_id: reagentId, location: '908', shelf_position: shelfPos908, purchase_order: 'CSV导入', current_quantity: 0 });

      // 导入数量列
      if (qty903Header) {
        const q = parseOptionalNonNegativeInt(row[qty903Header]);
        if (q !== null) {
          newInventory.push({ id: nextInvId++, reagent_id: reagentId, location: '903', shelf_position: shelfPos903, purchase_order: 'CSV导入', current_quantity: q });
        }
      }
      if (qty908Header) {
        const q = parseOptionalNonNegativeInt(row[qty908Header]);
        if (q !== null) {
          // 覆盖默认的 908 0 库存记录
          const default908 = newInventory.find(inv => inv.reagent_id === reagentId && inv.location === '908' && inv.current_quantity === 0);
          if (default908) {
            default908.current_quantity = q;
          } else {
            newInventory.push({ id: nextInvId++, reagent_id: reagentId, location: '908', shelf_position: shelfPos908, purchase_order: 'CSV导入', current_quantity: q });
          }
        }
      }

      added++;
    });

    if (added > 0 || updated > 0) {
      onReagentsChange(newReagents);
      if (added > 0) {
        onInventoryChange(newInventory);
        // 批量记一条导入日志
        const totalQty = newInventory.reduce((sum, inv) => sum + inv.current_quantity, 0);
        onLogsChange([...logs, {
          id: Date.now() + Math.random(),
          timestamp: new Date().toISOString(),
          operator: '系统导入',
          reagent_code: `共${added}种试剂`,
          location: '903/908',
          change_type: '+',
          change_amount: totalQty,
          note: `CSV批量导入 ${added} 种试剂`
        }]);
      }
      setCsvText('');
      setShowImport(false);
      alert(`成功导入 ${added} 个试剂，更新 ${updated} 个已有试剂信息，跳过 ${skipped} 个（重复且无可更新字段或字段缺失）`);
    } else {
      alert('未导入任何试剂，请检查CSV格式（需包含试剂名称/code列；更新已有试剂需包含安全库存、分类或其他自定义字段）');
    }
  };

  // 字段配置
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const handleAddField = () => {
    const label = newFieldLabel.trim();
    if (!label) return;
    if (customFields.some(f => normalizeFieldLabel(f.label) === normalizeFieldLabel(label))) return alert('该字段名称已存在');
    const newId = 'cf_' + (Math.max(...customFields.map(f => parseInt(f.id.replace('cf_', '')) || 0), 0) + 1);
    onFieldsChange([...fields, { id: newId, label, type: 'text', builtin: false, required: false }]);
    setNewFieldLabel('');
  };
  const handleRemoveField = (fieldId) => {
    const targetField = fields.find(f => f.id === fieldId);
    if (isCategoryField(targetField)) return alert('分类字段用于全局总览筛选，不能删除');
    if (!confirm('删除字段后，所有试剂在该字段上的数据将丢失，确定继续？')) return;
    onFieldsChange(fields.filter(f => f.id !== fieldId));
    // 清理试剂数据中的该字段
    onReagentsChange(reagents.map(r => {
      const custom = { ...r.custom };
      delete custom[fieldId];
      return { ...r, custom };
    }));
  };
  const handleMoveField = (index, direction) => {
    const newFields = [...fields];
    const targetIndex = index + direction;
    if (targetIndex < BUILTIN_FIELDS.length || targetIndex >= newFields.length) return;
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    onFieldsChange(newFields);
  };

  const sampleCSV = (() => {
    const cols = [...allFields.map(f => f.label), '安全库存', '903数量', '908数量', '位置', '908位置'];
    const example = [...allFields.map(f => {
      if (f.id === 'name') return '葡萄糖';
      if (f.id === 'code') return 'P01';
      if (f.id === 'brand') return 'Sigma-Aldrich';
      if (isCategoryField(f)) return '试剂';
      return '';
    }), '20', '12', '45', '实验台A', 'C区-3排'];
    return cols.join(',') + '\n' + example.join(',');
  })();

  const handleDownloadExcelTemplate = () => {
    try {
      const headers = [...allFields.map(f => f.label), '安全库存', '903数量', '908数量', '位置', '908位置'];
      const example = [...allFields.map(f => {
        if (f.id === 'name') return '葡萄糖';
        if (f.id === 'code') return 'P01';
        if (f.id === 'brand') return 'Sigma-Aldrich';
        if (isCategoryField(f)) return '试剂';
        return '';
      }), '20', '12', '45', '实验台A', 'C区-3排'];
      const ws = XLSX.utils.aoa_to_sheet([headers, example]);
      // 设置列宽
      ws['!cols'] = headers.map(() => ({ wch: 18 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '试剂模板');
      XLSX.writeFile(wb, '试剂导入模板.xlsx');
    } catch (err) {
      alert('生成Excel模板失败：' + err.message);
    }
  };

  // 导出当前数据为 Excel
  const handleExportData = () => {
    try {
      const headers = [...allFields.map(f => f.label), '安全库存', '903数量', '908数量', '位置', '908位置'];
      const rows = reagents.sort((a, b) => a.code.localeCompare(b.code)).map(r => {
        const inv903 = inventory.find(inv => inv.reagent_id === r.id && inv.location === '903');
        const inv908 = inventory.find(inv => inv.reagent_id === r.id && inv.location === '908');
        return [
          ...allFields.map(f => {
            if (f.builtin) return r[f.id] || '';
            return r.custom?.[f.id] || '';
          }),
          r.safety_stock || 0,
          inv903 ? inv903.current_quantity : 0,
          inv908 ? inv908.current_quantity : 0,
          inv903 ? inv903.shelf_position : '',
          inv908 ? inv908.shelf_position : '',
        ];
      });
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map(() => ({ wch: 18 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '试剂库存');
      XLSX.writeFile(wb, `试剂库存_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err) {
      alert('导出Excel失败：' + err.message);
    }
  };

  const handleClearAllData = () => {
    if (reagents.length === 0) return alert('当前没有试剂数据');
    if (!confirm(`⚠️ 警告：此操作不可恢复！\n\n确定清除全部 ${reagents.length} 种试剂及其库存、操作记录吗？`)) return;
    onReagentsChange([]);
    onInventoryChange([]);
    onLogsChange([]);
    alert('已全部清除');
  };

  return window.html`
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-bold text-gray-800">试剂基础管理 <span class="text-sm font-normal text-gray-400 ml-2">共 ${reagents.filter(r => {
          const s = search.toLowerCase().trim();
          if (!s) return true;
          const nameMatch = r.name.toLowerCase().includes(s);
          const codeMatch = r.code.toLowerCase().includes(s);
          const brandMatch = (r.brand || '').toLowerCase().includes(s);
          const customMatch = Object.values(r.custom || {}).some(v => String(v).toLowerCase().includes(s));
          return nameMatch || codeMatch || brandMatch || customMatch;
        }).length} 种</span></h2>
        <div class="flex gap-2">
          <button onClick=${() => setShowFieldConfig(true)}
            class="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:border-primary hover:text-primary transition-all text-sm font-medium text-gray-600">
            <span>⚙</span> 字段配置
          </button>
          <button onClick=${handleDownloadExcelTemplate}
            class="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:border-primary hover:text-primary transition-all text-sm font-medium text-gray-600">
            <span>📥</span> Excel模板
          </button>
          <button onClick=${handleExportData}
            class="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:border-primary hover:text-primary transition-all text-sm font-medium text-gray-600">
            <span>📤</span> 导出数据
          </button>
          <button onClick=${handleClearAllData}
            class="flex items-center gap-1.5 px-4 py-2 bg-white border border-red-200 rounded-xl hover:border-red-500 hover:text-red-600 transition-all text-sm font-medium text-gray-600">
            <span>🗑️</span> 清除全部
          </button>
          <button onClick=${() => setShowImport(true)}
            class="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:border-primary hover:text-primary transition-all text-sm font-medium text-gray-600">
            <span>📂</span> 批量导入
          </button>
          <button onClick=${openAdd}
            class="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-blue-800 text-white rounded-xl text-sm font-medium transition-colors shadow-sm">
            <span>＋</span> 新增试剂
          </button>
        </div>
      </div>

      <div class="flex-1 relative mb-4">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔍</span>
        <input type="text" placeholder="搜索试剂名称、简写、品牌或自定义字段..." value=${search}
          onInput=${e => setSearch(e.target.value)}
          class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm" />
      </div>
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200">
                ${allFields.map(f => window.html`<th key=${f.id} class="text-left px-5 py-3.5 font-semibold text-gray-600 ${f.builtin ? '' : 'text-xs'}">${f.label}${f.required ? window.html`<span class="text-danger ml-0.5">*</span>` : null}</th>`)}
                <th class="text-center px-5 py-3.5 font-semibold text-gray-600 text-xs">903数量</th>
                <th class="text-center px-5 py-3.5 font-semibold text-gray-600 text-xs">908数量</th>
                <th class="text-center px-5 py-3.5 font-semibold text-gray-600 text-xs">安全库存</th>
                <th class="text-center px-5 py-3.5 font-semibold text-gray-600 w-24">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${reagents.filter(r => {
                const s = search.toLowerCase().trim();
                if (!s) return true;
                const nameMatch = r.name.toLowerCase().includes(s);
                const codeMatch = r.code.toLowerCase().includes(s);
                const brandMatch = (r.brand || '').toLowerCase().includes(s);
                const customMatch = Object.values(r.custom || {}).some(v => String(v).toLowerCase().includes(s));
                return nameMatch || codeMatch || brandMatch || customMatch;
              }).sort((a, b) => a.code.localeCompare(b.code)).map(r => {
              const inv903 = inventory.find(inv => inv.reagent_id === r.id && inv.location === '903');
              const inv908 = inventory.find(inv => inv.reagent_id === r.id && inv.location === '908');
              return window.html`
                <tr key=${r.id} class="hover:bg-gray-50/50 transition-colors">
                  ${allFields.map(f => window.html`
                    <td key=${f.id} class="px-5 py-4 ${f.builtin ? '' : 'text-gray-500 text-xs'}">
                      ${f.builtin
                        ? (f.id === 'code'
                            ? window.html`<span class="inline-block px-2 py-0.5 bg-secondary/10 text-secondary text-xs font-bold rounded">${r[f.id]}</span>`
                            : window.html`<span class="font-medium text-gray-800">${r[f.id]}</span>`)
                        : (r.custom?.[f.id] || window.html`<span class="text-gray-300">—</span>`)
                      }
                    </td>
                  `)}
                  <td class="px-5 py-4 text-center text-xs font-mono text-gray-600">${inv903 ? inv903.current_quantity : 0}</td>
                  <td class="px-5 py-4 text-center text-xs font-mono text-gray-600">${inv908 ? inv908.current_quantity : 0}</td>
                  <td class="px-5 py-4 text-center">
                    ${editingSafetyStock?.id === r.id
                      ? window.html`<input type="number" min="0" value=${editingSafetyStock.value}
                          onInput=${e => setEditingSafetyStock({ ...editingSafetyStock, value: e.target.value })}
                          onKeyDown=${e => {
                            if (e.key === 'Enter') {
                              const val = parseInt(editingSafetyStock.value, 10);
                              onReagentsChange(reagents.map(rg => rg.id === r.id ? { ...rg, safety_stock: isNaN(val) ? 0 : val } : rg));
                              setEditingSafetyStock(null);
                            }
                            if (e.key === 'Escape') setEditingSafetyStock(null);
                          }}
                          onBlur=${() => {
                            const val = parseInt(editingSafetyStock.value, 10);
                            onReagentsChange(reagents.map(rg => rg.id === r.id ? { ...rg, safety_stock: isNaN(val) ? 0 : val } : rg));
                            setEditingSafetyStock(null);
                          }}
                          class="w-16 px-2 py-1 text-xs text-center border border-primary rounded focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                          autoFocus />`
                      : window.html`<span class="cursor-pointer hover:text-primary hover:underline text-xs font-mono ${r.safety_stock > 0 ? 'text-gray-700 font-medium' : 'text-gray-300'}" onClick=${() => setEditingSafetyStock({ id: r.id, value: String(r.safety_stock || 0) })}>${r.safety_stock || 0}</span>`
                    }
                  </td>
                  <td class="px-5 py-4 text-center">
                    <button onClick=${() => openEdit(r)} class="text-gray-400 hover:text-primary transition-colors text-sm mr-3" title="编辑">✏</button>
                    <button onClick=${() => handleDelete(r.id)} class="text-gray-400 hover:text-danger transition-colors text-sm" title="删除">🗑</button>
                  </td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      </div>
      </div>

      ${showAdd ? window.html`
        <div class="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick=${e => e.stopPropagation()}>
            <h3 class="text-lg font-bold text-gray-800 mb-4">${editingReagent ? '编辑试剂' : '新增试剂'}</h3>
            <div class="space-y-3">
              ${allFields.map(f => window.html`
                <div key=${f.id}>
                  <label class="block text-xs font-medium text-gray-500 mb-1">${f.label}${f.required ? window.html`<span class="text-danger ml-0.5">*</span>` : null}</label>
                  ${f.builtin ? window.html`
                    <input value=${form[f.id]}
                      onInput=${e => setForm({...form, [f.id]: e.target.value})}
                      onBlur=${f.id === 'code' ? handleCodeBlur : undefined}
                      class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-primary text-sm ${f.id === 'code' ? 'font-mono uppercase' : ''}"
                      placeholder=${f.id === 'code' ? '如：P01 或只填字母如 Y' : f.id === 'name' ? '如：葡萄糖' : ''} />
                  ` : isCategoryField(f) ? window.html`
                    <select value=${normalizeItemCategory(form.custom?.[f.id])}
                      onChange=${e => setForm({...form, custom: {...form.custom, [f.id]: e.target.value}})}
                      class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-primary text-sm bg-white">
                      <option value="试剂">试剂</option>
                      <option value="耗材">耗材</option>
                    </select>
                  ` : window.html`
                    <input value=${form.custom?.[f.id] || ''}
                      onInput=${e => setForm({...form, custom: {...form.custom, [f.id]: e.target.value}})}
                      class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-primary text-sm"
                      placeholder="可选" />
                  `}
                </div>
              `)}
              <div class="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100">
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1">903数量</label>
                  <input type="number" min="0" value=${qty903}
                    onInput=${e => setQty903(e.target.value)}
                    class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-primary text-sm font-mono"
                    placeholder="不填则不修改" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1">908数量</label>
                  <input type="number" min="0" value=${qty908}
                    onInput=${e => setQty908(e.target.value)}
                    class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-primary text-sm font-mono"
                    placeholder="不填则不修改" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1">安全库存 <span class="text-gray-300">(预警线)</span></label>
                  <input type="number" min="0" value=${safetyStock}
                    onInput=${e => setSafetyStock(e.target.value)}
                    class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-primary text-sm font-mono"
                    placeholder="0=不预警" />
                </div>
              </div>
            </div>
            <div class="flex gap-3 mt-6">
              <button onClick=${() => setShowAdd(false)} class="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors">取消</button>
              <button onClick=${handleSave} class="flex-1 py-2.5 rounded-xl bg-primary hover:bg-blue-800 text-white text-sm font-medium transition-colors shadow-sm">${editingReagent ? '保存修改' : '确认添加'}</button>
            </div>
          </div>
        </div>
      ` : null}

      ${showImport ? window.html`
        <div class="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6" onClick=${e => e.stopPropagation()}>
            <h3 class="text-lg font-bold text-gray-800 mb-2">批量导入试剂</h3>
            <p class="text-xs text-gray-500 mb-4">支持 CSV 和 Excel(.xlsx) 文件。列名自动匹配字段：${allFields.map(f => f.label).join('、')}、安全库存、903数量、908数量。重复code会更新安全库存、分类等已提供字段。</p>
            <div class="mb-3">
              <input type="file" accept=".csv,.xlsx,.xls" ref=${fileRef} onChange=${handleFileUpload} class="hidden" />
              <button onClick=${() => fileRef.current?.click()}
                class="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary hover:text-primary text-gray-500 text-sm font-medium transition-colors">
                📁 点击上传 CSV / Excel 文件
              </button>
            </div>
            <textarea value=${csvText} onInput=${e => setCsvText(e.target.value)}
              placeholder=${'或者在此粘贴CSV内容...\n' + sampleCSV}
              class="w-full h-40 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-primary text-xs font-mono resize-none" />
            <div class="flex gap-3 mt-4">
              <button onClick=${() => setShowImport(false)} class="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors">取消</button>
              <button onClick=${handleImportCSV} class="flex-1 py-2.5 rounded-xl bg-accent hover:bg-green-700 text-white text-sm font-medium transition-colors shadow-sm">确认导入</button>
            </div>
          </div>
        </div>
      ` : null}

      ${showFieldConfig ? window.html`
        <div class="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick=${e => e.stopPropagation()}>
            <h3 class="text-lg font-bold text-gray-800 mb-4">字段配置</h3>
            <p class="text-xs text-gray-500 mb-4">以下为基础字段（不可修改）：${BUILTIN_FIELDS.map(f => f.label).join('、')}</p>
                
            <div class="space-y-2 mb-4">
              ${customFields.map((f, idx) => window.html`
                <div key=${f.id} class="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                  <span class="flex-1 text-sm text-gray-700">${f.label}${isCategoryField(f) ? window.html`<span class="ml-2 text-[10px] text-gray-400">固定</span>` : null}</span>
                  <div class="flex gap-1">
                    <button onClick=${() => handleMoveField(BUILTIN_FIELDS.length + idx, -1)} disabled=${BUILTIN_FIELDS.length + idx <= BUILTIN_FIELDS.length}
                      class="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-primary hover:bg-white disabled:opacity-30 text-xs">↑</button>
                    <button onClick=${() => handleMoveField(BUILTIN_FIELDS.length + idx, 1)} disabled=${BUILTIN_FIELDS.length + idx >= fields.length - 1}
                      class="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-primary hover:bg-white disabled:opacity-30 text-xs">↓</button>
                    <button onClick=${() => handleRemoveField(f.id)} disabled=${isCategoryField(f)}
                      class="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-danger hover:bg-white disabled:opacity-30 disabled:hover:text-gray-400 text-xs">✕</button>
                  </div>
                </div>
              `)}
              ${customFields.length === 0 ? window.html`<p class="text-xs text-gray-400 text-center py-2">暂无自定义字段</p>` : null}
            </div>

            <div class="flex gap-2 mb-6">
              <input value=${newFieldLabel} onInput=${e => setNewFieldLabel(e.target.value)}
                onKeyDown=${e => e.key === 'Enter' && handleAddField()}
                class="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-primary text-sm"
                placeholder="新字段名称，如：CAS号" />
              <button onClick=${handleAddField}
                class="px-4 py-2 bg-primary hover:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors">添加</button>
            </div>

            <button onClick=${() => setShowFieldConfig(false)}
              class="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors">关闭</button>
          </div>
        </div>
      ` : null}
    </div>
  `;
}

// ==================== 位置视图 ====================
