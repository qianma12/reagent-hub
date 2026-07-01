/**
 * [v1.0.0] 位置视图 + Navbar
 * 改动记录：
 * - 新增：Navbar 待采购入口（🛒）
 * - 新增：903 实验室布局方案A（6冰箱+5实验台）
 * - 新增：布局自动迁移（旧格式→新格式）
 * - 新增：恢复默认布局按钮
 */
const { useState, useMemo, useCallback, useEffect, useRef } = window.PreactHooks;

const LAB_903_MAP_ITEMS = [
  { id: 'biosafety', name: '生物安全柜', type: '安全设备', kind: 'landmark', box: [1, 1, 10, 18] },
  { id: 'F1', name: '4℃冰箱 1', type: '冷藏设备', kind: 'storage', box: [1.2, 21, 6.2, 8.2] },
  { id: 'F2', name: '4℃冰箱 2', type: '冷藏设备', kind: 'storage', box: [1.2, 30, 6.2, 8.2] },
  { id: 'F3', name: '4℃冰箱 3', type: '冷藏设备', kind: 'storage', box: [1.2, 39, 6.2, 8.2] },
  { id: 'F4', name: '4℃冰箱 4', type: '冷藏设备', kind: 'storage', box: [1.2, 48, 6.2, 8.2] },
  { id: 'F5', name: '−20℃冰箱', type: '冷冻设备', kind: 'storage', box: [1.2, 57.5, 6.2, 10.2] },
  { id: 'F6', name: '−80℃冰箱', type: '深低温设备', kind: 'storage', box: [1.2, 69, 8, 13.5] },
  { id: 'nitrogen', name: '液氮罐', type: '低温设备', kind: 'landmark', box: [1.2, 84, 5, 5.4] },
  { id: 'waste', name: '垃圾区', type: '空间地标', kind: 'landmark', box: [1.2, 91, 7.3, 7] },
  { id: 'door1', name: '门1', type: '次入口', kind: 'door', box: [11, 93, 8.5, 5.5] },
  { id: 'seatedA', name: '坐式摇床', type: '实验设备', kind: 'landmark', box: [20.2, 7, 12, 9] },
  { id: 'A', name: '实验台 A', type: '存储实验台', kind: 'storage', box: [20.2, 16.8, 12, 46] },
  { id: 'sinkA', name: '水池', type: '空间地标', kind: 'sink', box: [20.2, 62.9, 12, 7.6] },
  { id: 'standing1', name: '立式摇床', type: '实验设备', kind: 'landmark', box: [18, 71.3, 7, 10.5] },
  { id: 'standing2', name: '立式摇床', type: '实验设备', kind: 'landmark', box: [25.6, 71.3, 7, 10.5] },
  { id: 'B', name: '实验台 B', type: '存储实验台', kind: 'storage', box: [42, 7, 12, 54] },
  { id: 'seatedB', name: '坐式摇床', type: '实验设备', kind: 'landmark', box: [42, 61.8, 12, 8] },
  { id: 'C', name: '实验台 C', type: '存储实验台', kind: 'storage', box: [63.5, 7, 12, 54] },
  { id: 'sinkC', name: '水池', type: '空间地标', kind: 'sink', box: [63.5, 61.5, 12, 8] },
  { id: 'hood', name: '通风橱', type: '安全设备', kind: 'landmark', box: [87, 5, 11.5, 10.5] },
  { id: 'D', name: '实验台 D', type: '存储实验台', kind: 'storage', box: [87, 16, 11.5, 54.5] },
  { id: 'sinkD', name: '水池', type: '空间地标', kind: 'sink', box: [89.8, 72, 8.7, 8.5] },
  { id: 'autoclave', name: '灭菌锅', type: '实验设备', kind: 'landmark', box: [89.8, 82, 8.7, 16] },
  { id: 'E', name: '实验台 E', type: '存储实验台', kind: 'storage', box: [22.5, 84.5, 46.5, 13.5] },
  { id: 'oven', name: '烘箱', type: '实验设备', kind: 'landmark', box: [70, 84.5, 8.5, 13.5] },
  { id: 'door2', name: '门2', type: '常用入口', kind: 'door', box: [79.5, 93, 8.5, 5.5] },
];

export function LayoutView({ reagents, inventory, layouts, onLayoutsChange }) {
  const [activeLocation, setActiveLocation] = useState('903');
  const [viewMode, setViewMode] = useState('overview'); // 'overview' | 'device'
  const [selectedItem, setSelectedItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState([]);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [hoveredDevice, setHoveredDevice] = useState(null);
  const [showCellDetail, setShowCellDetail] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorType, setEditorType] = useState('');
  const [editorData, setEditorData] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [draggingDrawerId, setDraggingDrawerId] = useState(null);
  const [draggingShelfRow, setDraggingShelfRow] = useState(null);
  const [innerDragging, setInnerDragging] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isUndoing, setIsUndoing] = useState(false);
  const canvasRef = useRef(null);

  const layout = layouts[activeLocation] || { type: 'lab', workbenches: [] };

  // 包装 onLayoutsChange，记录历史
  const pushLayoutChange = useCallback((newLayouts) => {
    if (isUndoing) {
      onLayoutsChange(newLayouts);
      return;
    }
    setHistory(prev => {
      const next = prev.slice(0, historyIndex + 1);
      next.push(JSON.parse(JSON.stringify(newLayouts)));
      while (next.length > 50) { next.shift(); }
      return next;
    });
    setHistoryIndex(prev => {
      const nextIdx = prev + 1;
      return nextIdx >= 50 ? 49 : nextIdx;
    });
    onLayoutsChange(newLayouts);
  }, [onLayoutsChange, historyIndex, isUndoing]);

  // 撤销/重做快捷键
  useEffect(() => {
    const handleKey = (e) => {
      if (!isEditing) return;
      const isUndo = (e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey;
      const isRedo = (e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey));
      if (isUndo) {
        e.preventDefault();
        setHistoryIndex(prev => {
          const newIdx = prev - 1;
          if (newIdx < 0) return prev;
          setIsUndoing(true);
          const state = history[newIdx];
          if (state) onLayoutsChange(state);
          requestAnimationFrame(() => setIsUndoing(false));
          return newIdx;
        });
      } else if (isRedo) {
        e.preventDefault();
        setHistoryIndex(prev => {
          const newIdx = prev + 1;
          if (newIdx >= history.length) return prev;
          setIsUndoing(true);
          const state = history[newIdx];
          if (state) onLayoutsChange(state);
          requestAnimationFrame(() => setIsUndoing(false));
          return newIdx;
        });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isEditing, history, onLayoutsChange]);

  const getInventoryAt = useCallback((position) => {
    return inventory
      .filter(inv => inv.location === activeLocation && inv.shelf_position === position)
      .map(inv => ({ ...inv, reagent: reagents.find(r => r.id === inv.reagent_id) }))
      .filter(inv => inv.reagent);
  }, [inventory, activeLocation, reagents]);

  const getTotalAt = useCallback((position) => {
    return getInventoryAt(position).reduce((sum, inv) => sum + inv.current_quantity, 0);
  }, [getInventoryAt]);

  const getStatus = useCallback((position) => {
    const total = getTotalAt(position);
    if (total === 0) return 'empty';
    if (total < 5) return 'low';
    return 'ok';
  }, [getTotalAt]);

  const openEditor = (type, data, parentId) => {
    setEditorType(type);
    setEditorData({ type, data: data || {}, parentId });
    setShowEditor(true);
  };

  const saveEditor = (data) => {
    const newLayout = JSON.parse(JSON.stringify(layout));
    if (editorType === 'workbench') {
      const idx = newLayout.workbenches.findIndex(w => w.id === data.id);
      if (idx >= 0) newLayout.workbenches[idx] = data;
      else {
        const cat = data.category || 'workbench';
        const defaults = {
          workbench: { x: 5, y: 5, w: 50, h: 20 },
          fridge: { x: 5, y: 5, w: 20, h: 30 },
          'shelf-unit': { x: 5, y: 5, w: 25, h: 35 },
          'cabinet-unit': { x: 5, y: 5, w: 35, h: 25 },
        };
        newLayout.workbenches.push({
          ...data,
          id: 'wb_' + Date.now(),
          position: { ...defaults[cat] }
        });
      }
    } else if (editorType === 'drawer') {
      const wb = newLayout.workbenches.find(w => w.id === editorData.parentId);
      if (wb) {
        const idx = wb.drawers.findIndex(d => d.id === data.id);
        if (idx >= 0) wb.drawers[idx] = data;
        else { wb.drawers.push({ ...data, id: 'dw_' + Date.now() }); delete wb.innerLayout; }
      }
    } else if (editorType === 'zone') {
      const idx = newLayout.zones.findIndex(z => z.id === data.id);
      if (idx >= 0) newLayout.zones[idx] = data;
      else newLayout.zones.push({ ...data, id: 'zn_' + Date.now() });
    } else if (editorType === 'rack') {
      const zone = newLayout.zones.find(z => z.id === editorData.parentId);
      if (zone) {
        const idx = zone.racks.findIndex(r => r.id === data.id);
        if (idx >= 0) zone.racks[idx] = data;
        else zone.racks.push({ ...data, id: 'rk_' + Date.now() });
      }
    } else if (editorType === 'cabinet') {
      const zone = newLayout.zones.find(z => z.id === editorData.parentId);
      if (zone) {
        const idx = zone.cabinets.findIndex(c => c.id === data.id);
        if (idx >= 0) zone.cabinets[idx] = data;
        else zone.cabinets.push({ ...data, id: 'cb_' + Date.now() });
      }
    }
    pushLayoutChange({ ...layouts, [activeLocation]: newLayout });
    setShowEditor(false);
  };

  const deleteItem = (type, id, parentId) => {
    if (!confirm('确定删除？')) return;
    const newLayout = JSON.parse(JSON.stringify(layout));
    if (type === 'workbench') {
      newLayout.workbenches = newLayout.workbenches.filter(w => w.id !== id);
    } else if (type === 'drawer') {
      const wb = newLayout.workbenches.find(w => w.id === parentId);
      if (wb) { wb.drawers = wb.drawers.filter(d => d.id !== id); delete wb.innerLayout; }
    } else if (type === 'zone') {
      newLayout.zones = newLayout.zones.filter(z => z.id !== id);
    } else if (type === 'rack') {
      const zone = newLayout.zones.find(z => z.id === parentId);
      if (zone) zone.racks = zone.racks.filter(r => r.id !== id);
    } else if (type === 'cabinet') {
      const zone = newLayout.zones.find(z => z.id === parentId);
      if (zone) zone.cabinets = zone.cabinets.filter(c => c.id !== id);
    }
    pushLayoutChange({ ...layouts, [activeLocation]: newLayout });
  };

  const resetLayout = () => {
    if (!confirm('确定重置为默认布局？当前位置视图将恢复为方案A（6冰箱+5实验台）。')) return;
    const defaults = window.INITIAL_LAYOUTS?.[activeLocation];
    if (!defaults) {
      alert('未找到默认布局配置');
      return;
    }
    onLayoutsChange({ ...layouts, [activeLocation]: JSON.parse(JSON.stringify(defaults)) });
  };

  // ---- Search ----
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchMatches([]); return; }
    const q = searchQuery.trim().toLowerCase();
    const matches = [];
    for (const inv of inventory) {
      if (inv.location !== activeLocation) continue;
      if (inv.current_quantity <= 0) continue;
      const reagent = reagents.find(r => r.id === inv.reagent_id);
      if (!reagent) continue;
      if (reagent.name.toLowerCase().includes(q) || reagent.code.toLowerCase().includes(q) ||
          (reagent.brand || '').toLowerCase().includes(q) || inv.shelf_position.toLowerCase().includes(q)) {
        matches.push({ inv, reagent, position: inv.shelf_position });
      }
    }
    setSearchMatches(matches);
  }, [searchQuery, inventory, reagents, activeLocation]);

  const findPositionInOverview = useCallback((position) => {
    if (layout.type === 'lab') {
      for (const wb of layout.workbenches) {
        const rowOrder = wb.shelf.rowOrder || Array.from({ length: wb.shelf.rows }, (_, i) => i);
        for (let displayIdx = 0; displayIdx < rowOrder.length; displayIdx++) {
          const physicalRow = rowOrder[displayIdx];
          const label = window.utils.getShelfLabel(wb.shelf, physicalRow, 0);
          if (label === position) {
            const innerLayout = window.utils.getDefaultInnerLayout(wb);
            const shelf = innerLayout.shelves.find(s => s.row === physicalRow);
            if (shelf && wb.position) {
              return {
                item: wb,
                rect: {
                  left: wb.position.x + shelf.x * wb.position.w / 100,
                  top: wb.position.y + shelf.y * wb.position.h / 100,
                  width: shelf.w * wb.position.w / 100,
                  height: shelf.h * wb.position.h / 100,
                }
              };
            }
            return { item: wb, rect: null };
          }
        }
        for (const drawer of wb.drawers) {
          if (drawer.prefix === position) {
            const innerLayout = window.utils.getDefaultInnerLayout(wb);
            const d = innerLayout.drawers.find(dw => dw.id === drawer.id);
            if (d && wb.position) {
              return {
                item: wb,
                rect: {
                  left: wb.position.x + d.x * wb.position.w / 100,
                  top: wb.position.y + d.y * wb.position.h / 100,
                  width: d.w * wb.position.w / 100,
                  height: d.h * wb.position.h / 100,
                }
              };
            }
            return { item: wb, rect: null };
          }
        }
      }
    } else {
      for (const zone of layout.zones) {
        for (const rack of zone.racks) {
          const rowOrder = rack.rowOrder || Array.from({ length: rack.rows }, (_, i) => i);
          for (let displayIdx = 0; displayIdx < rowOrder.length; displayIdx++) {
            const physicalRow = rowOrder[displayIdx];
            const label = window.utils.getShelfLabel(rack, physicalRow, 0);
            if (label === position) return { item: zone, rect: null };
          }
        }
        for (const cabinet of zone.cabinets) {
          if (cabinet.prefix === position) return { item: zone, rect: null };
        }
      }
    }
    const compatibleCell = window.utils.findCellByPosition(layout, position);
    if (compatibleCell?.workbench) return { item: compatibleCell.workbench, rect: null };
    if (compatibleCell?.zone) return { item: compatibleCell.zone, rect: null };
    return null;
  }, [layout]);

  const searchDots = useMemo(() => {
    const dots = [];
    const seenPositions = new Set();
    for (const match of searchMatches) {
      if (seenPositions.has(match.position)) continue;
      seenPositions.add(match.position);
      const loc = findPositionInOverview(match.position);
      if (loc && loc.rect) {
        dots.push({
          left: loc.rect.left + loc.rect.width / 2,
          top: loc.rect.top + loc.rect.height / 2,
          item: loc.item,
          position: match.position,
          reagent: match.reagent
        });
      }
    }
    return dots;
  }, [searchMatches, findPositionInOverview]);

  const matchedDeviceIds = useMemo(() => {
    const ids = new Set();
    for (const dot of searchDots) ids.add(dot.item.id);
    return ids;
  }, [searchDots]);

  const getPositionsForItem = useCallback((item) => {
    const positions = [];
    if (!item) return positions;
    if (layout.type === 'lab') {
      const rowOrder = item.shelf.rowOrder || Array.from({ length: item.shelf.rows }, (_, i) => i);
      for (const physicalRow of rowOrder) {
        for (let c = 0; c < item.shelf.cols; c++) {
          positions.push(window.utils.getShelfLabel(item.shelf, physicalRow, c));
        }
      }
      item.drawers.forEach(drawer => positions.push(drawer.prefix));
    } else {
      item.racks.forEach(rack => {
        const rowOrder = rack.rowOrder || Array.from({ length: rack.rows }, (_, i) => i);
        for (const physicalRow of rowOrder) {
          for (let c = 0; c < rack.cols; c++) {
            positions.push(window.utils.getShelfLabel(rack, physicalRow, c));
          }
        }
      });
      item.cabinets.forEach(cabinet => positions.push(cabinet.prefix));
    }
    return positions;
  }, [layout]);

  const deviceSummaries = useMemo(() => {
    const summaries = new Map();
    if (layout.type !== 'lab') return summaries;
    for (const item of layout.workbenches) {
      const positions = new Set(getPositionsForItem(item));
      const deviceInventory = inventory.filter(inv =>
        inv.location === activeLocation &&
        (positions.has(inv.shelf_position) ||
          window.utils.findCellByPosition(layout, inv.shelf_position)?.workbench?.id === item.id) &&
        inv.current_quantity > 0
      );
      summaries.set(item.id, {
        types: new Set(deviceInventory.map(inv => inv.reagent_id)).size,
        units: deviceInventory.reduce((sum, inv) => sum + inv.current_quantity, 0),
      });
    }
    return summaries;
  }, [layout, inventory, activeLocation, getPositionsForItem]);

  const searchDestinations = useMemo(() => {
    const destinations = new Map();
    for (const match of searchMatches) {
      const located = findPositionInOverview(match.position);
      if (!located?.item) continue;
      const current = destinations.get(located.item.id) || {
        item: located.item,
        quantity: 0,
        reagentNames: new Set(),
      };
      current.quantity += match.inv.current_quantity;
      current.reagentNames.add(match.reagent.name);
      destinations.set(located.item.id, current);
    }
    return destinations;
  }, [searchMatches, findPositionInOverview]);

  const searchOutcome = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query || searchDestinations.size > 0) return null;
    const matchingReagents = reagents.filter(reagent =>
      reagent.name.toLowerCase().includes(query) ||
      reagent.code.toLowerCase().includes(query) ||
      (reagent.brand || '').toLowerCase().includes(query)
    );
    if (matchingReagents.length === 0) return { type: 'not-found' };
    const matchingIds = new Set(matchingReagents.map(reagent => reagent.id));
    const reserveQuantity = inventory
      .filter(inv => inv.location === '908' && matchingIds.has(inv.reagent_id))
      .reduce((sum, inv) => sum + inv.current_quantity, 0);
    return reserveQuantity > 0
      ? { type: 'reserve', quantity: reserveQuantity }
      : { type: 'empty' };
  }, [searchQuery, searchDestinations, reagents, inventory]);

  const inventoryContainsSearchMatch = useCallback((invs) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return false;
    return invs.some(inv =>
      inv.reagent.name.toLowerCase().includes(query) ||
      inv.reagent.code.toLowerCase().includes(query) ||
      (inv.reagent.brand || '').toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // ---- Dragging (canvas) ----
  const handleCanvasMouseDown = (e, item, action) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setDragging({
      itemId: item.id, action,
      startX: e.clientX, startY: e.clientY,
      itemX: item.position?.x || 0, itemY: item.position?.y || 0,
      itemW: item.position?.w || 50, itemH: item.position?.h || 30,
      containerW: rect.width, containerH: rect.height,
      rotation: item.position?.rotation || 0,
    });
  };

  const rotateItem = (item) => {
    const newLayout = JSON.parse(JSON.stringify(layout));
    const items = newLayout.type === 'lab' ? newLayout.workbenches : newLayout.zones;
    const target = items.find(i => i.id === item.id);
    if (!target) return;
    if (!target.position) target.position = { x: 5, y: 5, w: 40, h: 30 };
    const currentRotation = target.position.rotation || 0;
    const w = target.position.w || 40;
    const h = target.position.h || 30;
    target.position.rotation = (currentRotation + 90) % 360;
    target.position.w = h;
    target.position.h = w;
    pushLayoutChange({ ...layouts, [activeLocation]: newLayout });
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e) => {
      const { itemId, action, startX, startY, itemX, itemY, itemW, itemH, containerW, containerH, rotation } = dragging;
      const dx = ((e.clientX - startX) / containerW) * 100;
      const dy = ((e.clientY - startY) / containerH) * 100;
      const newLayout = JSON.parse(JSON.stringify(layout));
      const items = newLayout.type === 'lab' ? newLayout.workbenches : newLayout.zones;
      const item = items.find(i => i.id === itemId);
      if (!item) return;
      if (!item.position) item.position = { x: 5, y: 5, w: 40, h: 30 };
      const rot = rotation || 0;
      const angle = rot * Math.PI / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rdx = dx * cos + dy * sin;
      const rdy = -dx * sin + dy * cos;
      if (action === 'move') {
        item.position.x = Math.max(0, Math.min(100 - item.position.w, itemX + dx));
        item.position.y = Math.max(0, Math.min(100 - item.position.h, itemY + dy));
      } else if (action === 'resize') {
        if (rot === 0 || rot === 90) {
          item.position.w = Math.max(15, Math.min(100 - item.position.x, itemW + rdx));
          item.position.h = Math.max(15, Math.min(100 - item.position.y, itemH + rdy));
        } else if (rot === 180) {
          item.position.w = Math.max(15, Math.min(100 - item.position.x, itemW - rdx));
          item.position.h = Math.max(15, Math.min(100 - item.position.y, itemH - rdy));
          item.position.x = Math.max(0, Math.min(100 - item.position.w, itemX + rdx));
          item.position.y = Math.max(0, Math.min(100 - item.position.y, itemY + rdy));
        } else if (rot === 270) {
          item.position.w = Math.max(15, Math.min(100 - item.position.x, itemW - rdx));
          item.position.h = Math.max(15, Math.min(100 - item.position.y, itemH + rdy));
          item.position.x = Math.max(0, Math.min(100 - item.position.w, itemX + rdx));
        }
      }
      pushLayoutChange({ ...layouts, [activeLocation]: newLayout });
    };
    const handleUp = () => setDragging(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [dragging]);

  // ---- Inner dragging ----
  const handleInnerMouseDown = (e, wbId, itemType, itemId, action) => {
    e.preventDefault(); e.stopPropagation();
    const cardEl = e.currentTarget.closest('.workbench-card');
    if (!cardEl) return;
    const rect = cardEl.getBoundingClientRect();
    const wb = layout.workbenches.find(w => w.id === wbId);
    if (!wb) return;
    const innerLayout = window.utils.getDefaultInnerLayout(wb);
    let item;
    if (itemType === 'shelf') item = innerLayout.shelves.find(s => s.row === itemId);
    else item = innerLayout.drawers.find(d => d.id === itemId);
    if (!item) return;
    setInnerDragging({
      wbId, itemType, itemId, action,
      startX: e.clientX, startY: e.clientY,
      itemX: item.x, itemY: item.y, itemW: item.w, itemH: item.h,
      containerW: rect.width, containerH: rect.height,
    });
  };

  useEffect(() => {
    if (!innerDragging) return;
    const handleMove = (e) => {
      const { wbId, itemType, itemId, action, startX, startY, itemX, itemY, itemW, itemH, containerW, containerH } = innerDragging;
      const dx = ((e.clientX - startX) / containerW) * 100;
      const dy = ((e.clientY - startY) / containerH) * 100;
      const newLayout = JSON.parse(JSON.stringify(layout));
      const targetWb = newLayout.workbenches.find(w => w.id === wbId);
      if (!targetWb) return;
      const innerLayout = window.utils.getDefaultInnerLayout(targetWb);
      if (itemType === 'shelf') {
        const shelfItem = innerLayout.shelves.find(s => s.row === itemId);
        if (!shelfItem) return;
        if (action === 'move') {
          shelfItem.x = Math.max(0, Math.min(98 - shelfItem.w, itemX + dx));
          shelfItem.y = Math.max(0, Math.min(98 - shelfItem.h, itemY + dy));
        } else if (action === 'resize') {
          shelfItem.w = Math.max(5, Math.min(100 - shelfItem.x, itemW + dx));
          shelfItem.h = Math.max(5, Math.min(100 - shelfItem.y, itemH + dy));
        }
      } else {
        const drawerItem = innerLayout.drawers.find(d => d.id === itemId);
        if (!drawerItem) return;
        if (action === 'move') {
          drawerItem.x = Math.max(0, Math.min(98 - drawerItem.w, itemX + dx));
          drawerItem.y = Math.max(0, Math.min(98 - drawerItem.h, itemY + dy));
        } else if (action === 'resize') {
          drawerItem.w = Math.max(5, Math.min(100 - drawerItem.x, itemW + dx));
          drawerItem.h = Math.max(5, Math.min(100 - drawerItem.y, itemH + dy));
        }
      }
      targetWb.innerLayout = innerLayout;
      pushLayoutChange({ ...layouts, [activeLocation]: newLayout });
    };
    const handleUp = () => setInnerDragging(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [innerDragging]);

  // ---- Render helpers ----
  const renderWorkbenchMini = (wb) => {
    const cat = wb.category || 'workbench';
    if (cat === 'fridge') {
      // 冰箱俯视图：蓝色简洁长方形
      const isVertical = (wb.position?.w || 40) < (wb.position?.h || 30);
      return window.html`
        <div class="relative w-full h-full">
          <svg viewBox="0 0 ${isVertical ? 60 : 100} ${isVertical ? 100 : 60}" preserveAspectRatio="xMidYMid meet" class="w-full h-full">
            <!-- 主体顶面 -->
            <rect x="2" y="2" width="${isVertical ? 56 : 96}" height="${isVertical ? 96 : 56}" rx="3" fill="#dbeafe" stroke="#3b82f6" stroke-width="1.5"/>
            <!-- 内部浅色区 -->
            <rect x="5" y="5" width="${isVertical ? 50 : 90}" height="${isVertical ? 90 : 50}" rx="1" fill="#ffffff"/>
            <!-- 底部深色线（正面边缘） -->
            <line x1="2" y1="${isVertical ? 98 : 58}" x2="${isVertical ? 58 : 98}" y2="${isVertical ? 98 : 58}" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span class="text-[9px] font-bold text-blue-700">❄</span>
          </div>
        </div>
      `;
    }
    if (cat === 'shelf-unit') {
      // 货架俯视图：暖黄长方形，四角立柱
      return window.html`
        <div class="relative w-full h-full">
          <svg viewBox="0 0 140 100" preserveAspectRatio="xMidYMid meet" class="w-full h-full">
            <!-- 主体顶面 -->
            <rect x="2" y="2" width="136" height="96" rx="4" fill="#fffbeb" stroke="#f59e0b" stroke-width="2"/>
            <!-- 内部浅色区 -->
            <rect x="6" y="6" width="128" height="88" rx="2" fill="#fffdf7"/>
            <!-- 四角立柱 -->
            <rect x="4" y="4" width="8" height="8" rx="2" fill="#fbbf24" stroke="#f59e0b" stroke-width="1"/>
            <rect x="128" y="4" width="8" height="8" rx="2" fill="#fbbf24" stroke="#f59e0b" stroke-width="1"/>
            <rect x="4" y="88" width="8" height="8" rx="2" fill="#fbbf24" stroke="#f59e0b" stroke-width="1"/>
            <rect x="128" y="88" width="8" height="8" rx="2" fill="#fbbf24" stroke="#f59e0b" stroke-width="1"/>
          </svg>
          <span class="absolute bottom-1 right-2 text-[9px] font-bold text-amber-600 opacity-0 hover:opacity-100 transition-opacity">${wb.name}</span>
        </div>
      `;
    }
    if (cat === 'cabinet-unit') {
      // 货柜俯视图：灰白简洁长方形
      return window.html`
        <div class="relative w-full h-full">
          <svg viewBox="0 0 100 80" preserveAspectRatio="xMidYMid meet" class="w-full h-full">
            <!-- 主体顶面 -->
            <rect x="2" y="2" width="96" height="76" rx="4" fill="#f1f5f9" stroke="#94a3b8" stroke-width="2"/>
            <!-- 内部浅色区 -->
            <rect x="6" y="6" width="88" height="68" rx="2" fill="#f8fafc"/>
            <!-- 前方边缘线 -->
            <line x1="2" y1="78" x2="98" y2="78" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span class="absolute bottom-1 right-2 text-[9px] font-bold text-slate-500 opacity-0 hover:opacity-100 transition-opacity">${wb.name}</span>
        </div>
      `;
    }
    // 实验台俯视图：方案A - 纯白填充 + 深灰边框
    const isVertical = (wb.position?.w || 40) < (wb.position?.h || 30);
    return window.html`
      <div class="relative w-full h-full">
        <svg viewBox="0 0 ${isVertical ? 60 : 200} ${isVertical ? 200 : 60}" preserveAspectRatio="xMidYMid meet" class="w-full h-full">
          <!-- 主体顶面：纯白 + 深灰边框 -->
          <rect x="2" y="2" width="${isVertical ? 56 : 196}" height="${isVertical ? 196 : 56}" rx="4" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>
          <!-- 内部浅色区 -->
          <rect x="5" y="5" width="${isVertical ? 50 : 190}" height="${isVertical ? 190 : 50}" rx="2" fill="#f8fafc"/>
        </svg>
        <!-- 设备名称，始终显示在中心 -->
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span class="text-[10px] font-bold text-slate-500" style=${isVertical ? 'writing-mode:vertical-rl' : ''}>${wb.name}</span>
        </div>
      </div>
    `;
  };

  const renderZoneMini = (zone) => {
    const positions = [];
    zone.racks.forEach(rack => {
      const rowOrder = rack.rowOrder || Array.from({ length: rack.rows }, (_, i) => i);
      for (let displayIdx = 0; displayIdx < rowOrder.length; displayIdx++) {
        const physicalRow = rowOrder[displayIdx];
        for (let c = 0; c < rack.cols; c++) positions.push(window.utils.getShelfLabel(rack, physicalRow, c));
      }
    });
    zone.cabinets.forEach(c => positions.push(c.prefix));
    const totalItems = positions.reduce((sum, pos) => sum + getTotalAt(pos), 0);
    // 仓库区域俯视图：浅绿色长方形，内部 subtle 区域划分
    return window.html`
      <div class="relative w-full h-full">
        <svg viewBox="0 0 100 80" preserveAspectRatio="xMidYMid meet" class="w-full h-full">
          <!-- 主体顶面 -->
          <rect x="2" y="2" width="96" height="76" rx="4" fill="#f0fdf4" stroke="#86efac" stroke-width="2"/>
          <!-- 内部浅色区 -->
          <rect x="6" y="6" width="88" height="68" rx="2" fill="#dcfce7"/>
          <!-- 内部区域划分虚线（subtle） -->
          <line x1="50" y1="6" x2="50" y2="74" stroke="#86efac" stroke-width="1" stroke-dasharray="3,3" opacity="0.4"/>
          <line x1="6" y1="40" x2="94" y2="40" stroke="#86efac" stroke-width="1" stroke-dasharray="3,3" opacity="0.4"/>
        </svg>
        <span class="absolute bottom-1 right-2 text-[9px] font-bold text-green-700/50">${zone.name}</span>
        ${totalItems > 0 && window.html`<span class="absolute top-1.5 left-1.5 text-[9px] text-green-600/50 font-medium">${totalItems}瓶</span>`}
      </div>
    `;
  };

  const renderShelfGrid = (shelf, type, parentWbId, draggable) => {
    const rowOrder = shelf.rowOrder || Array.from({ length: shelf.rows }, (_, i) => i);
    return window.html`
      <div class="space-y-2">
        ${rowOrder.map((physicalRow, displayIndex) => {
          const label = window.utils.getShelfLabel(shelf, physicalRow, 0);
          const invs = getInventoryAt(label);
          const total = invs.reduce((s, i) => s + i.current_quantity, 0);
          const status = total === 0 ? 'empty' : total < 5 ? 'low' : 'ok';
          const bg = status === 'empty' ? 'bg-gray-100 border-gray-200' : status === 'low' ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300';
          const text = status === 'empty' ? 'text-gray-400' : status === 'low' ? 'text-red-600' : 'text-green-700';
          const isSearchMatch = inventoryContainsSearchMatch(invs);
          return window.html`
            <div key=${displayIndex}
              draggable=${draggable}
              onDragStart=${() => setDraggingShelfRow({ wbId: parentWbId, displayIndex })}
              onDragOver=${e => e.preventDefault()}
              onDrop=${e => {
                e.preventDefault();
                if (!draggingShelfRow || draggingShelfRow.wbId !== parentWbId || draggingShelfRow.displayIndex === displayIndex) { setDraggingShelfRow(null); return; }
                const newLayout = JSON.parse(JSON.stringify(layout));
                const targetWb = newLayout.workbenches.find(w => w.id === parentWbId);
                if (!targetWb) return;
                const currentRowOrder = targetWb.shelf.rowOrder || Array.from({ length: targetWb.shelf.rows }, (_, i) => i);
                const fromIdx = draggingShelfRow.displayIndex;
                const toIdx = displayIndex;
                const newRowOrder = [...currentRowOrder];
                [newRowOrder[fromIdx], newRowOrder[toIdx]] = [newRowOrder[toIdx], newRowOrder[fromIdx]];
                targetWb.shelf = { ...targetWb.shelf, rowOrder: newRowOrder };
                pushLayoutChange({ ...layouts, [activeLocation]: newLayout });
                setDraggingShelfRow(null);
              }}
              class="flex gap-2 ${draggable ? 'cursor-move' : ''}">
              <div
                class="flex-1 min-h-[48px] rounded-lg border-2 ${isSearchMatch ? 'bg-blue-50 border-blue-500 ring-4 ring-blue-100' : bg} flex flex-col items-center justify-center cursor-pointer hover:brightness-95 transition-all"
                onClick=${() => setShowCellDetail({ label, invs, total })}
                onMouseEnter=${e => setHoveredCell({ label, invs, total, x: e.clientX, y: e.clientY })}
                onMouseLeave=${() => setHoveredCell(null)}>
                <span class="text-[9px] text-gray-400 font-mono">${label}</span>
                ${isSearchMatch && window.html`<span class="text-[10px] font-bold text-blue-700 mt-0.5">搜索命中</span>`}
                ${total > 0 && window.html`<span class="text-sm font-bold ${text}">${total}</span>`}
              </div>
            </div>
          `;
        })}
      </div>
    `;
  };

  const renderDrawer = (drawer, parentId, type) => {
    const invs = getInventoryAt(drawer.prefix);
    const total = invs.reduce((s, i) => s + i.current_quantity, 0);
    const status = total === 0 ? 'empty' : total < 5 ? 'low' : 'ok';
    const bg = status === 'empty' ? 'bg-gray-100 border-gray-300' : status === 'low' ? 'bg-red-50 border-red-400' : 'bg-green-50 border-green-400';
    const text = status === 'empty' ? 'text-gray-400' : status === 'low' ? 'text-red-600' : 'text-green-700';
    return window.html`
      <div
        class="flex-1 min-h-[80px] rounded-lg border-2 ${bg} flex flex-col items-center justify-center cursor-pointer hover:brightness-95 transition-all relative"
        style=${{ borderRadius: type === 'drawer' ? '4px 4px 12px 12px' : '4px' }}
        onClick=${() => setShowCellDetail({ label: drawer.prefix, invs, total })}
        onMouseEnter=${e => setHoveredCell({ label: drawer.prefix, invs, total, x: e.clientX, y: e.clientY })}
        onMouseLeave=${() => setHoveredCell(null)}>
        ${isEditing && window.html`
          <div class="absolute top-1 right-1 flex gap-1">
            <button onClick=${e => { e.stopPropagation(); openEditor(type === 'drawer' ? 'drawer' : 'cabinet', drawer, parentId); }} class="text-[10px] text-gray-400 hover:text-primary">✏</button>
            <button onClick=${e => { e.stopPropagation(); deleteItem(type === 'drawer' ? 'drawer' : 'cabinet', drawer.id, parentId); }} class="text-[10px] text-gray-400 hover:text-danger">✕</button>
          </div>
        `}
        <span class="text-xs font-medium text-gray-600">${drawer.name}</span>
        <span class="text-[9px] text-gray-400 font-mono">${drawer.prefix}</span>
        ${total > 0 ? window.html`<span class="text-sm font-bold ${text} mt-1">${total}</span>` : window.html`<span class="text-xs text-gray-300 mt-1">空</span>`}
      </div>
    `;
  };

  // ---- Device Floor Plan (full-screen inner layout) ----
  const renderDeviceFloorPlan = (wb) => {
    const innerLayout = window.utils.getDefaultInnerLayout(wb);
    const cat = wb.category || 'workbench';
    const showShelves = cat !== 'cabinet-unit';
    const showDrawers = cat === 'workbench' || cat === 'cabinet-unit';
    return window.html`
      <div class="fade-in">
        <div class="mb-4 flex items-center gap-2 text-sm text-gray-500">
          <span class="px-2 py-1 bg-gray-100 rounded-md font-mono text-xs">${cat === 'fridge' ? '❄ 冰箱' : cat === 'shelf-unit' ? '📚 货架' : cat === 'cabinet-unit' ? '🗄 货柜' : '🔬 实验台'}</span>
          <span>架子 ${wb.shelf.rows}层</span>
          ${showDrawers && window.html`<span>| 抽屉 ${wb.drawers.length}个</span>`}
        </div>
        ${showShelves && window.html`
          <div class="mb-6">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-semibold text-gray-500">🗄 架子</h3>
              ${isEditing && window.html`<button onClick=${() => openEditor('workbench', wb)} class="text-xs text-primary hover:underline">编辑架子</button>`}
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              ${renderShelfGrid(wb.shelf, 'shelf', wb.id, isEditing)}
            </div>
          </div>
        `}
        ${cat === 'workbench' && window.html`
          <div class="mb-6 px-4">
            <div class="h-4 bg-gradient-to-b from-gray-200 to-gray-300 rounded-sm border border-gray-300 shadow-inner"></div>
            <div class="text-center text-[10px] text-gray-400 mt-1">— 工作台面 —</div>
          </div>
        `}
        ${showDrawers && window.html`
          <div>
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-semibold text-gray-500">🗄 ${cat === 'cabinet-unit' ? '柜门' : '抽屉'}</h3>
              ${isEditing && window.html`<button onClick=${() => openEditor('drawer', null, wb.id)} class="text-xs text-primary hover:underline">+ 添加${cat === 'cabinet-unit' ? '柜门' : '抽屉'}</button>`}
            </div>
            <div class="flex gap-3">
              ${wb.drawers.map(drawer => {
                const invs = getInventoryAt(drawer.prefix);
                const total = invs.reduce((s, i) => s + i.current_quantity, 0);
                const status = total === 0 ? 'empty' : total < 5 ? 'low' : 'ok';
                const bg = status === 'empty' ? 'bg-gray-100 border-gray-300' : status === 'low' ? 'bg-red-50 border-red-400' : 'bg-green-50 border-green-400';
                const text = status === 'empty' ? 'text-gray-400' : status === 'low' ? 'text-red-600' : 'text-green-700';
                const isSearchMatch = inventoryContainsSearchMatch(invs);
                return window.html`
                  <div key=${drawer.id}
                    draggable=${isEditing}
                    onDragStart=${() => setDraggingDrawerId(drawer.id)}
                    onDragOver=${e => e.preventDefault()}
                    onDrop=${e => {
                      e.preventDefault();
                      if (!draggingDrawerId || draggingDrawerId === drawer.id) { setDraggingDrawerId(null); return; }
                      const newLayout = JSON.parse(JSON.stringify(layout));
                      const targetWb = newLayout.workbenches.find(w => w.id === wb.id);
                      if (!targetWb) return;
                      const fromIdx = targetWb.drawers.findIndex(d => d.id === draggingDrawerId);
                      const toIdx = targetWb.drawers.findIndex(d => d.id === drawer.id);
                      if (fromIdx < 0 || toIdx < 0) return;
                      const [removed] = targetWb.drawers.splice(fromIdx, 1);
                      targetWb.drawers.splice(toIdx, 0, removed);
                      pushLayoutChange({ ...layouts, [activeLocation]: newLayout });
                      setDraggingDrawerId(null);
                    }}
                    class="flex-1 min-h-[80px] rounded-lg border-2 ${isSearchMatch ? 'bg-blue-50 border-blue-500 ring-4 ring-blue-100' : bg} flex flex-col items-center justify-center ${isEditing ? 'cursor-move' : 'cursor-pointer hover:brightness-95'} transition-all relative"
                    style=${{ borderRadius: cat === 'cabinet-unit' ? '4px' : '4px 4px 12px 12px' }}
                    onClick=${() => !isEditing && setShowCellDetail({ label: drawer.prefix, invs, total })}>
                    ${isEditing && window.html`
                      <div class="absolute top-1 right-1 flex gap-1">
                        <button onClick=${e => { e.stopPropagation(); openEditor('drawer', drawer, wb.id); }} class="text-[10px] text-gray-400 hover:text-primary">✏</button>
                        <button onClick=${e => { e.stopPropagation(); deleteItem('drawer', drawer.id, wb.id); }} class="text-[10px] text-gray-400 hover:text-danger">✕</button>
                      </div>
                    `}
                    <span class="text-xs font-medium text-gray-600">${drawer.name}</span>
                    <span class="text-[9px] text-gray-400 font-mono">${drawer.prefix}</span>
                    ${isSearchMatch && window.html`<span class="text-[10px] font-bold text-blue-700 mt-1">搜索命中</span>`}
                    ${total > 0 ? window.html`<span class="text-sm font-bold ${text} mt-1">${total}</span>` : window.html`<span class="text-xs text-gray-300 mt-1">空</span>`}
                  </div>
                `;
              })}
            </div>
          </div>
        `}
      </div>
    `;
  };

  const renderZoneDetail = (zone) => {
    return window.html`
      <div class="fade-in">
        <div class="mb-4 flex items-center gap-2 text-sm text-gray-500">
          <span class="px-2 py-1 bg-gray-100 rounded-md font-mono text-xs">📦 仓库区域</span>
        </div>
        ${zone.racks.map(rack => window.html`
          <div key=${rack.id} class="mb-6">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-semibold text-gray-500">${rack.name}</h3>
              ${isEditing && window.html`<button onClick=${() => openEditor('rack', rack, zone.id)} class="text-xs text-primary hover:underline">编辑</button>`}
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              ${renderShelfGrid(rack, 'rack', null, false)}
            </div>
          </div>
        `)}
        ${zone.cabinets.length > 0 && window.html`
          <div>
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-semibold text-gray-500">🗄 货柜</h3>
              ${isEditing && window.html`<button onClick=${() => openEditor('cabinet', null, zone.id)} class="text-xs text-primary hover:underline">+ 添加货柜</button>`}
            </div>
            <div class="flex gap-3">
              ${zone.cabinets.map(cabinet => renderDrawer(cabinet, zone.id, 'cabinet'))}
            </div>
          </div>
        `}
      </div>
    `;
  };

  const render903Map = () => {
    const storageById = new Map(layout.workbenches.map(item => [item.id, item]));
    const hasSearch = Boolean(searchQuery.trim());
    const itemStyle = (mapItem) => {
      const [x, y, w, h] = mapItem.box;
      return { left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` };
    };
    const outcomeText = searchOutcome?.type === 'reserve'
      ? `903 暂无库存；908 仓库有 ${searchOutcome.quantity} 个。`
      : searchOutcome?.type === 'empty'
        ? '当前无库存。'
        : searchOutcome?.type === 'not-found'
          ? '未找到该试剂。'
          : '';

    return window.html`
      <div key="overview-903">
        ${outcomeText && window.html`
          <div class="mb-3 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 text-sm">
            ${outcomeText}
          </div>
        `}
        <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div class="relative w-full min-h-[620px] rounded-xl overflow-hidden"
            style=${{
              aspectRatio: '1.82 / 1',
              backgroundColor: '#f8fafb',
              backgroundImage: 'linear-gradient(rgba(224,231,237,.42) 1px, transparent 1px), linear-gradient(90deg, rgba(224,231,237,.42) 1px, transparent 1px)',
              backgroundSize: '28px 28px'
            }}>
            <div class="absolute inset-3 rounded-lg border-2 border-slate-300 pointer-events-none"></div>
            ${LAB_903_MAP_ITEMS.map(mapItem => {
              const storageItem = mapItem.kind === 'storage' ? storageById.get(mapItem.id) : null;
              const destination = storageItem ? searchDestinations.get(storageItem.id) : null;
              const isMatched = Boolean(destination);
              const isMuted = hasSearch && !isMatched;
              const isFridge = storageItem?.category === 'fridge';
              const isStorage = mapItem.kind === 'storage';
              const isSink = mapItem.kind === 'sink';
              const isDoor = mapItem.kind === 'door';
              const baseAppearance = isStorage
                ? isFridge
                  ? 'border-2 border-blue-500 bg-blue-50 text-slate-800'
                  : 'border-2 border-slate-500 bg-amber-50/40 text-slate-800'
                : isSink
                  ? 'border border-cyan-400 bg-cyan-50 text-slate-500'
                  : isDoor
                    ? 'border border-dashed border-slate-400 bg-white text-slate-500'
                    : 'border border-slate-300 bg-slate-100 text-slate-500';
              return window.html`
                <div key=${mapItem.id}
                  class="absolute rounded-lg flex items-center justify-center text-center overflow-hidden transition-all duration-200
                    ${baseAppearance}
                    ${isStorage ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg' : 'cursor-default'}
                    ${isMuted ? 'opacity-35 saturate-50' : ''}
                    ${isMatched ? 'z-20 ring-[3px] ring-blue-600 ring-offset-[3px] shadow-xl shadow-blue-200' : 'z-[2]'}"
                  style=${itemStyle(mapItem)}
                  onClick=${() => {
                    if (!storageItem) return;
                    setSelectedItem(storageItem);
                    setViewMode('device');
                    setIsEditing(false);
                  }}
                  onMouseEnter=${e => {
                    if (!storageItem) return;
                    const summary = deviceSummaries.get(storageItem.id) || { types: 0, units: 0 };
                    setHoveredDevice({ ...summary, name: mapItem.name, x: e.clientX, y: e.clientY });
                  }}
                  onMouseMove=${e => {
                    if (!storageItem) return;
                    setHoveredDevice(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev);
                  }}
                  onMouseLeave=${() => storageItem && setHoveredDevice(null)}>
                  <div class=${isMatched ? 'opacity-15' : ''}>
                    <div class="font-bold leading-tight ${isStorage ? 'text-sm' : 'text-xs'}">${mapItem.name}</div>
                    <div class="mt-1 text-[10px] opacity-65">${mapItem.type}</div>
                  </div>
                  ${isMatched && window.html`
                    <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 min-w-max max-w-[170px] px-2.5 py-2 rounded-lg bg-blue-600 text-white text-[11px] font-bold leading-tight shadow-lg">
                      ${Array.from(destination.reagentNames).join('、')} ×${destination.quantity}
                    </div>
                  `}
                </div>
              `;
            })}
            <div class="absolute right-[11.8%] bottom-[1.2%] z-20 flex items-center gap-1 text-[11px] font-bold text-blue-700 pointer-events-none">
              <span class="text-lg">↑</span><span>你从这里进入</span>
            </div>
          </div>
          <div class="flex justify-end gap-4 mt-3 px-2 py-2 text-[11px] text-slate-500">
            <span class="flex items-center gap-1.5"><i class="w-4 h-3 rounded border-2 border-slate-500 bg-white"></i>可点击存储区</span>
            <span class="flex items-center gap-1.5"><i class="w-4 h-3 rounded border border-slate-300 bg-slate-100"></i>空间地标</span>
            <span class="flex items-center gap-1.5"><i class="w-4 h-3 rounded border-2 border-blue-600 bg-blue-50"></i>搜索命中</span>
          </div>
        </div>
      </div>
    `;
  };

  // ---- Overview Canvas (main bird's eye view) ----
  const renderOverviewCanvas = () => {
    if (activeLocation === '903') return render903Map();
    const items = layout.type === 'lab' ? layout.workbenches : layout.zones;
    return window.html`
      <div key=${`overview-${activeLocation}`} class="relative">
        <div ref=${canvasRef} class="relative w-full rounded-xl border border-gray-200 overflow-hidden select-none"
          style=${{ height: '600px', background: '#f8fafc' }}>
          ${items.map(item => {
            const positions = [];
            if (layout.type === 'lab') {
              const rowOrder = item.shelf.rowOrder || Array.from({ length: item.shelf.rows }, (_, i) => i);
              for (let displayIdx = 0; displayIdx < rowOrder.length; displayIdx++) {
                const physicalRow = rowOrder[displayIdx];
                for (let c = 0; c < item.shelf.cols; c++) positions.push(window.utils.getShelfLabel(item.shelf, physicalRow, c));
              }
              item.drawers.forEach(d => positions.push(d.prefix));
            } else {
              item.racks.forEach(rack => {
                const rowOrder = rack.rowOrder || Array.from({ length: rack.rows }, (_, i) => i);
                for (let displayIdx = 0; displayIdx < rowOrder.length; displayIdx++) {
                  const physicalRow = rowOrder[displayIdx];
                  for (let c = 0; c < rack.cols; c++) positions.push(window.utils.getShelfLabel(rack, physicalRow, c));
                }
              });
              item.cabinets.forEach(c => positions.push(c.prefix));
            }
            const totalTypes = positions.filter(pos => getTotalAt(pos) > 0).length;
            const totalItems = positions.reduce((sum, pos) => sum + getTotalAt(pos), 0);
            const hasLow = positions.some(pos => getStatus(pos) === 'low');
            const hasStock = positions.some(pos => getStatus(pos) === 'ok');
            const isMatched = matchedDeviceIds.has(item.id);
            const borderColor = isMatched ? 'border-amber-400' : hasLow ? 'border-red-300' : hasStock ? 'border-green-300' : 'border-gray-200';
            const bgColor = isMatched ? 'bg-amber-50' : hasLow ? 'bg-red-50' : hasStock ? 'bg-green-50' : 'bg-gray-50';
            const cat = layout.type === 'lab' ? (item.category || 'workbench') : 'zone';
            const catLabel = cat === 'fridge' ? '❄' : cat === 'shelf-unit' ? '📚' : cat === 'cabinet-unit' ? '🗄' : cat === 'zone' ? '📦' : '🔬';
            const rotation = item.position?.rotation || 0;
            return window.html`
              <div key=${item.id}
                class="absolute ${isMatched ? 'ring-2 ring-amber-400 ring-offset-2 z-10' : ''} ${isEditing ? 'cursor-move' : 'cursor-pointer'} transition-all select-none"
                style=${{ left: (item.position?.x || 5) + '%', top: (item.position?.y || 5) + '%', width: (item.position?.w || 40) + '%', height: (item.position?.h || 30) + '%', transform: `rotate(${rotation}deg)`, transformOrigin: 'center center' }}
                onMouseDown=${e => isEditing && handleCanvasMouseDown(e, item, 'move')}
                onDblClick=${() => { setSelectedItem(item); setViewMode('device'); setIsEditing(false); }}>
                ${layout.type === 'lab' ? renderWorkbenchMini(item) : renderZoneMini(item)}
                ${isEditing && window.html`
                  <div class="absolute top-1 right-1 flex gap-1 z-20 pointer-events-auto">
                    <button onClick=${e => { e.stopPropagation(); rotateItem(item); }} class="w-6 h-6 bg-white/90 backdrop-blur rounded shadow text-xs text-gray-600 hover:text-primary flex items-center justify-center border border-gray-100" title="旋转90°">↻</button>
                    <button onClick=${e => { e.stopPropagation(); openEditor(layout.type === 'lab' ? 'workbench' : 'zone', item); }} class="w-6 h-6 bg-white/90 backdrop-blur rounded shadow text-xs text-gray-600 hover:text-primary flex items-center justify-center border border-gray-100">✏</button>
                    <button onClick=${e => { e.stopPropagation(); deleteItem(layout.type === 'lab' ? 'workbench' : 'zone', item.id); }} class="w-6 h-6 bg-white/90 backdrop-blur rounded shadow text-xs text-gray-600 hover:text-danger flex items-center justify-center border border-gray-100">✕</button>
                  </div>
                  <div class="absolute bottom-1 right-1 z-20 pointer-events-auto">
                    <div class="w-5 h-5 cursor-se-resize flex items-center justify-center hover:bg-white/50 rounded-tl-lg"
                      onMouseDown=${e => handleCanvasMouseDown(e, item, 'resize')}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 9L9 1M9 1H3M9 1V7" stroke="#94a3b8" stroke-width="1.5"/></svg>
                    </div>
                  </div>
                `}
              </div>
            `;
          })}
          <!-- Search highlight red dots -->
          ${searchDots.map((dot, idx) => window.html`
            <div key=${'dot-' + idx}
              class="absolute w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-lg pointer-events-none z-20 animate-pulse"
              style=${{ left: `calc(${dot.left}% - 6px)`, top: `calc(${dot.top}% - 6px)` }}
              title="${dot.reagent.name} @ ${dot.position}">
            </div>
          `)}
        </div>
        ${searchMatches.length > 0 && window.html`
          <div class="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-sm">
            <span class="text-amber-600 font-medium">找到 ${searchMatches.length} 个匹配</span>
            <span class="text-amber-400">|</span>
            <span class="text-amber-500 text-xs">高亮显示在俯视图中</span>
          </div>
        `}
      </div>
    `;
  };

  return window.html`
    <div class="fade-in">
      <!-- Header: Location selector + Search -->
      <div class="flex flex-col gap-4 mb-4">
        <div class="flex items-center gap-3">
          <div class="flex bg-white rounded-xl p-1 border border-gray-200 shadow-sm">
            ${['903', '908'].map(loc => window.html`
              <button key=${loc} onClick=${() => { setActiveLocation(loc); setViewMode('overview'); setSelectedItem(null); setSearchQuery(''); setIsEditing(false); }}
                class="px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeLocation === loc ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}">
                ${loc}
              </button>
            `)}
          </div>
          <div class="flex-1"></div>
          ${viewMode === 'overview' && activeLocation !== '903' && window.html`
            <button onClick=${() => setIsEditing(!isEditing)}
              class="flex items-center gap-1.5 px-4 py-2 ${isEditing ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:text-primary'} rounded-xl text-sm font-medium transition-all shadow-sm">
              <span>✏</span> ${isEditing ? '完成编辑' : '编辑布局'}
            </button>
            <button onClick=${resetLayout}
              class="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-600 hover:text-red-500 rounded-xl text-sm font-medium transition-all shadow-sm"
              title="恢复为默认方案A布局">
              <span>↺</span> 恢复默认布局
            </button>
          `}
          ${viewMode === 'device' && activeLocation !== '903' && window.html`
            <button onClick=${() => setIsEditing(!isEditing)}
              class="flex items-center gap-1.5 px-4 py-2 ${isEditing ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:text-primary'} rounded-xl text-sm font-medium transition-all shadow-sm">
              <span>✏</span> ${isEditing ? '完成编辑' : '编辑布局'}
            </button>
          `}
        </div>
        ${viewMode === 'overview' && activeLocation === '903' && window.html`
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-xl font-bold text-slate-800">903 实验室地图</h2>
              <span class="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">↑ 从门2方向查看</span>
            </div>
            <p class="mt-1 text-sm text-slate-500">搜索试剂可定位到冰箱或实验台；点击存储区域查看具体格位。</p>
          </div>
        `}
        ${viewMode === 'overview' && window.html`
          <div class="relative">
            <input type="text" value=${searchQuery} onInput=${e => setSearchQuery(e.target.value)}
              placeholder="🔍 搜索试剂名称、编码或位置..."
              class="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:outline-none focus:border-primary focus:ring-4 focus:ring-blue-50 text-sm shadow-sm" />
            ${searchQuery && window.html`
              <button onClick=${() => setSearchQuery('')} class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
            `}
          </div>
        `}
      </div>

      ${isEditing && viewMode === 'overview' && activeLocation !== '903' && window.html`
        <div class="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p class="text-sm text-blue-800 font-medium mb-1">画布编辑模式</p>
          <p class="text-xs text-blue-600">拖拽卡片移动位置，拖拽右下角手柄调整大小。双击设备进入平面图。</p>
          <div class="flex gap-2 mt-2">
            <button onClick=${() => openEditor(layout.type === 'lab' ? 'workbench' : 'zone', null)}
              class="px-4 py-2 bg-primary hover:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">＋ 添加${layout.type === 'lab' ? '设备' : '区域'}</button>
            <button onClick=${resetLayout}
              class="px-4 py-2 bg-white border border-gray-200 text-gray-600 hover:text-primary rounded-lg text-sm font-medium transition-colors">重置布局</button>
          </div>
        </div>
      `}

      ${viewMode === 'overview' && renderOverviewCanvas()}

      ${viewMode === 'device' && selectedItem && window.html`
        <div class="fade-in">
          <div class="flex items-center gap-3 mb-4">
            <button onClick=${() => { setViewMode('overview'); setSelectedItem(null); }}
              class="flex items-center gap-1 text-gray-500 hover:text-primary text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">← 返回总览</button>
            <h2 class="text-lg font-bold text-gray-800">${activeLocation === '903' ? (LAB_903_MAP_ITEMS.find(item => item.id === selectedItem.id)?.name || selectedItem.name) : selectedItem.name}</h2>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            ${layout.type === 'lab' ? renderDeviceFloorPlan(selectedItem) : renderZoneDetail(selectedItem)}
          </div>
        </div>
      `}

      ${hoveredDevice && window.html`
        <div class="fixed z-50 pointer-events-none"
          style=${{ left: Math.min((hoveredDevice.x || 0) + 15, window.innerWidth - 245) + 'px', top: Math.min((hoveredDevice.y || 0) + 15, window.innerHeight - 150) + 'px' }}>
          <div class="w-[220px] bg-slate-800 text-white rounded-xl shadow-2xl px-4 py-3 text-xs">
            <div class="font-bold text-sm mb-2">${hoveredDevice.name}</div>
            <div class="grid grid-cols-2 gap-3">
              <div class="text-slate-300">试剂种类<div class="text-white text-lg font-bold mt-0.5">${hoveredDevice.types}</div></div>
              <div class="text-slate-300">库存单位<div class="text-white text-lg font-bold mt-0.5">${hoveredDevice.units}</div></div>
            </div>
            <div class="mt-2 text-blue-200">点击查看具体格位 →</div>
          </div>
        </div>
      `}

      ${hoveredCell && window.html`
        <div class="fixed z-50 pointer-events-none" style=${{ left: (hoveredCell.x || 0) + 15 + 'px', top: (hoveredCell.y || 0) + 'px' }}>
          <div class="bg-gray-900 text-white rounded-lg shadow-xl px-3 py-2 text-xs max-w-xs">
            <div class="font-bold text-gray-300 mb-1">${hoveredCell.label}</div>
            ${hoveredCell.total === 0 ? window.html`<div class="text-gray-400">空位</div>` : window.html`
              <div class="space-y-1">
                ${hoveredCell.invs.map(item => window.html`
                  <div key=${item.id} class="flex items-center gap-2">
                    <span class="text-[10px] px-1 rounded bg-white/20">${item.reagent.code}</span>
                    <span class="truncate">${item.reagent.name}</span>
                    <span class="font-bold ml-auto">×${item.current_quantity}</span>
                  </div>
                `)}
              </div>
            `}
          </div>
        </div>
      `}

      ${showCellDetail && window.html`
        <div class="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5" onClick=${e => e.stopPropagation()}>
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-bold text-gray-800">${showCellDetail.label}</h3>
              <button onClick=${() => setShowCellDetail(null)} class="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            ${showCellDetail.total === 0 ? window.html`
              <div class="text-center py-8 text-gray-400">
                <div class="text-4xl mb-2">📭</div>
                <p>该位置暂无试剂</p>
              </div>
            ` : window.html`
              <div class="space-y-3">
                ${showCellDetail.invs.map(item => window.html`
                  <div key=${item.id} class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">${item.reagent.code}</div>
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-gray-800 text-sm truncate">${item.reagent.name}</div>
                      <div class="text-xs text-gray-400">${item.reagent.brand}</div>
                    </div>
                    <div class="text-right">
                      <div class="text-lg font-bold text-primary">${item.current_quantity}</div>
                      <div class="text-[10px] text-gray-400">${item.purchase_order}</div>
                    </div>
                  </div>
                `)}
              </div>
            `}
            <button onClick=${() => setShowCellDetail(null)} class="w-full mt-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors">关闭</button>
          </div>
        </div>
      `}

      ${showEditor && window.html`<${LayoutEditor} config=${editorData} onSave=${saveEditor} onCancel=${() => setShowEditor(false)} />`}
    </div>
  `;
}


export function LayoutEditor({ config, onSave, onCancel }) {
  const { type, data, parentId } = config;
  const isNew = !data.id;
  const [form, setForm] = useState(() => {
    if (type === 'workbench') return {
      id: data.id || '', name: data.name || '',
      category: data.category || 'workbench',
      style: data.style || { bg: '#F8FAFC', border: '#CBD5E0', surface: '#F1F5F9' },
      shelf: data.shelf || { rows: 1, cols: 1, prefix: '' },
      drawers: data.drawers || [],
      drawerCount: (data.drawers || []).length
    };
    if (type === 'drawer') return {
      id: data.id || '', name: data.name || '', prefix: data.prefix || '',
      style: data.style || { bg: '#E2E8F0', border: '#94A3B8' }
    };
    if (type === 'zone') return {
      id: data.id || '', name: data.name || '',
      style: data.style || { bg: '#F1F5F9', border: '#CBD5E0' },
      racks: data.racks || [], cabinets: data.cabinets || []
    };
    if (type === 'rack') return {
      id: data.id || '', name: data.name || '', rows: data.rows || 4, cols: data.cols || 1, prefix: data.prefix || ''
    };
    if (type === 'cabinet') return {
      id: data.id || '', name: data.name || '', prefix: data.prefix || '',
      style: data.style || { bg: '#E2E8F0', border: '#94A3B8' }
    };
    return {};
  });

  const handleSave = () => {
    if (type === 'workbench') {
      if (!form.name.trim() || !form.shelf.prefix.trim()) return alert('名称和架子编码前缀必填');
      let newShelf = { ...form.shelf, prefix: form.shelf.prefix.trim().toUpperCase(), cols: 1 };
      // 层数改变时重置 rowOrder
      if (newShelf.rows !== (data.shelf?.rows || 1)) {
        newShelf.rowOrder = Array.from({ length: newShelf.rows }, (_, i) => i);
      } else if (data.shelf?.rowOrder) {
        newShelf.rowOrder = data.shelf.rowOrder;
      }
      // 根据 category 决定是否有抽屉
      const cat = form.category || 'workbench';
      const canHaveDrawers = cat === 'workbench' || cat === 'cabinet-unit';
      const prefix = form.shelf.prefix.trim().toUpperCase();
      let drawers = [...(form.drawers || [])];
      const targetCount = canHaveDrawers ? Math.max(0, Math.min(10, Number(form.drawerCount) || 0)) : 0;
      if (targetCount > drawers.length) {
        for (let i = drawers.length; i < targetCount; i++) {
          drawers.push({
            id: `${prefix}-D${i + 1}`,
            name: `抽屉${i + 1}`,
            prefix: `${prefix}-D${i + 1}`,
            style: { bg: '#E2E8F0', border: '#94A3B8' }
          });
        }
      } else if (targetCount < drawers.length) {
        drawers = drawers.slice(0, targetCount);
      }
      const { drawerCount, innerLayout: _il, ...restForm } = form;
      const preserveInnerLayout = (data.shelf?.rows || 1) === newShelf.rows && (data.drawers?.length || 0) === drawers.length;
      const result = { ...restForm, name: form.name.trim(), shelf: newShelf, drawers };
      if (preserveInnerLayout && data.innerLayout) {
        result.innerLayout = data.innerLayout;
      }
      onSave(result);
    } else if (type === 'drawer') {
      if (!form.name.trim() || !form.prefix.trim()) return alert('名称和编码前缀必填');
      onSave({ ...form, name: form.name.trim(), prefix: form.prefix.trim().toUpperCase() });
    } else if (type === 'zone') {
      if (!form.name.trim()) return alert('区域名称必填');
      onSave({ ...form, name: form.name.trim() });
    } else if (type === 'rack') {
      if (!form.name.trim() || !form.prefix.trim()) return alert('名称和编码前缀必填');
      let newForm = { ...form, name: form.name.trim(), prefix: form.prefix.trim().toUpperCase(), cols: 1 };
      if (newForm.rows !== (data.rows || 4)) {
        newForm.rowOrder = Array.from({ length: newForm.rows }, (_, i) => i);
      } else if (data.rowOrder) {
        newForm.rowOrder = data.rowOrder;
      }
      onSave(newForm);
    } else if (type === 'cabinet') {
      if (!form.name.trim() || !form.prefix.trim()) return alert('名称和编码前缀必填');
      onSave({ ...form, name: form.name.trim(), prefix: form.prefix.trim().toUpperCase() });
    }
  };

  const titles = { workbench: '实验台', drawer: '抽屉', zone: '区域', rack: '货架', cabinet: '货柜' };

  return window.html`
    <div class="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick=${e => e.stopPropagation()}>
        <h3 class="text-lg font-bold text-gray-800 mb-4">${isNew ? '添加' : '编辑'}${titles[type]}</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">名称 *</label>
            <input value=${form.name || ''} onInput=${e => setForm({...form, name: e.target.value})}
              class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-primary text-sm" placeholder="如：实验台A" />
          </div>
          ${type === 'workbench' && window.html`
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">设备类型</label>
              <select value=${form.category || 'workbench'} onChange=${e => setForm({...form, category: e.target.value})}
                class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-primary text-sm bg-white">
                <option value="workbench">🔬 实验台</option>
                <option value="fridge">❄ 冰箱</option>
                <option value="shelf-unit">📚 货架</option>
                <option value="cabinet-unit">🗄 货柜</option>
              </select>
            </div>
          `}
          ${(type === 'workbench' || type === 'rack') && window.html`
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">编码前缀 *</label>
                <input value=${form.shelf?.prefix || form.prefix || ''}
                  onInput=${e => type === 'workbench' ? setForm({...form, shelf: {...form.shelf, prefix: e.target.value}}) : setForm({...form, prefix: e.target.value})}
                  class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-primary text-sm font-mono uppercase" placeholder="如：A" />
              </div>
              <div></div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">架子层数</label>
                <input type="number" min="1" max="10" value=${form.shelf?.rows || form.rows || 1}
                  onInput=${e => type === 'workbench' ? setForm({...form, shelf: {...form.shelf, rows: Number(e.target.value)}}) : setForm({...form, rows: Number(e.target.value)})}
                  class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-primary text-sm" />
              </div>
              ${type === 'workbench' && (form.category || 'workbench') !== 'fridge' && (form.category || 'workbench') !== 'shelf-unit' && window.html`
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1">抽屉数量</label>
                  <input type="number" min="0" max="10" value=${form.drawerCount || 0}
                    onInput=${e => setForm({...form, drawerCount: Number(e.target.value)})}
                    class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-primary text-sm" />
                </div>
              `}
              ${type === 'rack' && window.html`<div></div>`}
            </div>
          `}
          ${(type === 'drawer' || type === 'cabinet') && window.html`
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">编码前缀 *</label>
              <input value=${form.prefix || ''} onInput=${e => setForm({...form, prefix: e.target.value})}
                class="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-primary text-sm font-mono uppercase" placeholder="如：A-D1" />
            </div>
          `}
          ${(type === 'workbench' || type === 'rack') && window.html`
            <div class="p-2 bg-gray-50 rounded-lg">
              <p class="text-[10px] text-gray-500">编码预览：</p>
              <div class="text-[10px] text-gray-400 font-mono mt-1">
                ${Array.from({length: Math.min(6, form.shelf?.rows || form.rows || 3)}).map((_, r) => window.html`
                  <span key=${r} class="mr-3">${window.utils.getShelfLabel({ prefix: (form.shelf?.prefix || form.prefix || '?').toUpperCase(), rows: form.shelf?.rows || form.rows || 3, cols: 1 }, r, 0)}</span>
                `)}
                ${(form.shelf?.rows || form.rows || 3) > 6 && window.html`<span class="text-gray-300">...</span>`}
              </div>
            </div>
          `}
        </div>
        <div class="flex gap-3 mt-6">
          <button onClick=${onCancel} class="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors">取消</button>
          <button onClick=${handleSave} class="flex-1 py-2.5 rounded-xl bg-primary hover:bg-blue-800 text-white text-sm font-medium transition-colors shadow-sm">保存</button>
        </div>
      </div>
    </div>
  `;
}

// ==================== 顶部导航 ====================

export function Navbar({ activeView, onChange, syncStatus, onSync, operator, onOperatorClick, syncPath, onPathClick }) {
  const views = [
    { id: 'aggregate', label: '全局总览', icon: '📊' },
    { id: 'segmented', label: '分仓明细', icon: '🏭' },
    { id: 'purchase', label: '待采购', icon: '🛒' },
    { id: 'layout', label: '位置视图', icon: '🗺' },
    { id: 'logs', label: '操作记录', icon: '🕐' },
    { id: 'reagents', label: '试剂管理', icon: '🧪' },
  ];
  const syncColors = {
    idle: 'bg-white/10 text-white/80 hover:bg-white/20',
    syncing: 'bg-yellow-500/20 text-yellow-300',
    synced: 'bg-green-500/20 text-green-300',
    error: 'bg-red-500/20 text-red-300',
  };
  const syncLabels = {
    idle: '☁ 同步',
    syncing: '⟳ 同步中',
    synced: '✓ 已同步',
    error: '✕ 同步失败',
  };
  return window.html`
    <nav class="bg-primary text-white shadow-lg sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-4 sm:px-6">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center backdrop-blur-sm text-lg">🧪</div>
            <div>
              <h1 class="font-bold text-base tracking-tight">Synaura Reagent</h1>
              <p class="text-[10px] text-white/60 -mt-0.5">Reagent Inventory System v1.2.0</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1 bg-white/10 rounded-xl p-1">
              ${views.map(v => window.html`
                <button key=${v.id} onClick=${() => onChange(v.id)}
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeView === v.id ? 'bg-white text-primary shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'}">
                  <span>${v.icon}</span><span class="hidden sm:inline">${v.label}</span>
                </button>
              `)}
            </div>
            ${syncPath && window.html`
              <button onClick=${onPathClick}
                class="hidden lg:flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/10 transition-all max-w-[200px] truncate"
                title="点击修改同步路径: ${syncPath}">
                📁 <span class="truncate">${syncPath.replace(/.*\//, '')}</span>
              </button>
            `}
            ${operator && window.html`
              <button onClick=${onOperatorClick}
                class="px-3 py-1.5 rounded-xl text-sm font-medium transition-all bg-white/10 text-white/80 hover:bg-white/20"
                title="点击更换操作人">
                👤 ${operator}
              </button>
            `}
            ${onSync && window.html`
              <button onClick=${onSync} disabled=${syncStatus === 'syncing'}
                class="px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${syncColors[syncStatus] || syncColors.idle}">
                ${syncLabels[syncStatus] || syncLabels.idle}
              </button>
            `}
          </div>
        </div>
      </div>
    </nav>
  `;
}

// ==================== 坚果云同步模块（引用全局） ====================
const NutstoreSync = window.NutstoreSync;

// ==================== 主应用 ====================

