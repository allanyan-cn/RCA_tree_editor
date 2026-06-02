import cytoscape from 'cytoscape';
import elk from 'cytoscape-elk';
import './style.css';

cytoscape.use(elk);

const createNode = (overrides = {}) => ({
  node_id: crypto.randomUUID(),
  node_name: '新建指标',
  business_code: '',
  parent_id: null,
  node_type: 'DIRECT',
  calculation_rule: '+',
  meta_data: {
    table_name: '',
    field_name: '',
    time_field: '',
    time_grain: 'DAILY',
    join_keys: '',
    extra_conditions: '',
  },
  business_context: {
    impact_description: '',
    metric_unit: '',
    drift_threshold: {
      mom_threshold: '0.05',
      yoy_threshold: '0.05',
      trigger_logic: 'OR',
    },
  },
  ...overrides,
});

const icons = {
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  select: '<svg viewBox="0 0 24 24"><path d="M5 8V5h3M16 5h3v3M19 16v3h-3M8 19H5v-3"/><path d="M9 9h6v6H9z"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg>',
  layout: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="6" height="6" rx="1"/><rect x="14" y="15" width="6" height="6" rx="1"/><path d="M7 9v3h10v3"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14"/></svg>',
  upload: '<svg viewBox="0 0 24 24"><path d="M12 15V3m0 0 4 4m-4-4-4 4M5 19h14"/></svg>',
};

document.querySelector('#app').innerHTML = `
  <header class="topbar">
    <div class="brand">
      <div class="logo">R</div>
      <div><h1>RCA Tree Studio</h1><p>Root Cause Analysis Editor</p></div>
    </div>
    <div class="header-actions">
      <button class="button ghost" id="importBtn">${icons.upload}<span>导入</span></button>
      <button class="button primary" id="exportBtn">${icons.download}<span>导出 JSON</span></button>
      <input type="file" id="fileInput" accept=".json,application/json" hidden />
    </div>
  </header>
  <main class="workspace">
    <aside class="sidebar">
      <div class="side-heading">编辑工具</div>
      <button class="tool" id="addBtn">${icons.plus}<span>新增节点</span></button>
      <button class="tool" id="boxSelectBtn">${icons.select}<span>框选节点</span></button>
      <button class="tool" id="connectBtn">${icons.link}<span>连接节点</span></button>
      <button class="tool" id="layoutBtn">${icons.layout}<span>自动布局</span></button>
      <button class="tool danger" id="deleteBtn">${icons.trash}<span>删除节点</span></button>
      <div class="tips">
        <strong>操作提示</strong>
        <p>点击节点可编辑属性</p>
        <p>进入框选模式后拖动选择区域</p>
        <p>连接时依次选择父、子节点</p>
      </div>
    </aside>
    <section class="canvas-wrap">
      <div class="canvas-header">
        <div><h2>RCA 拓扑图</h2><p>构建指标间的归因关系</p></div>
        <div class="canvas-tools">
          <span class="mode-badge" id="modeBadge">浏览模式</span>
          <button class="mini-btn" id="zoomOut">−</button>
          <button class="mini-btn" id="fitBtn">适应</button>
          <button class="mini-btn" id="zoomIn">+</button>
        </div>
      </div>
      <div id="cy"></div>
      <div class="legend">
        <span><i class="dot root"></i>根节点</span>
        <span><i class="dot direct"></i>直接因素</span>
        <span><i class="dot indirect"></i>间接因素</span>
      </div>
    </section>
    <aside class="properties">
      <div class="properties-header">
        <div><h2>节点属性</h2><p id="propertySubtitle">选择一个节点以编辑属性</p></div>
        <span class="status-dot"></span>
      </div>
      <div id="propertyPanel" class="property-panel empty">
        <div class="empty-state">
          <div class="empty-icon">${icons.plus}</div>
          <h3>暂无选中节点</h3>
          <p>在画布中点击一个节点，或使用左侧工具新增指标节点</p>
        </div>
      </div>
    </aside>
  </main>
  <div id="toast" class="toast"></div>
`;

const toElements = (sourceNodes) => [
  ...sourceNodes.map((node) => ({ group: 'nodes', data: { id: node.node_id, ...node } })),
  ...sourceNodes
    .filter((node) => node.parent_id)
    .map((node) => ({
      group: 'edges',
      data: {
        id: `edge-${node.parent_id}-${node.node_id}`,
        source: node.parent_id,
        target: node.node_id,
        node_type: node.node_type,
        label: node.calculation_rule,
      },
    })),
];

const cy = cytoscape({
  container: document.querySelector('#cy'),
  elements: [],
  boxSelectionEnabled: true,
  selectionType: 'additive',
  wheelSensitivity: 0.25,
  style: [
    {
      selector: 'node',
      style: {
        label: 'data(node_name)',
        'text-wrap': 'wrap',
        'text-max-width': 130,
        'font-size': 13,
        'font-weight': 600,
        color: '#344052',
        'text-valign': 'center',
        'text-halign': 'center',
        width: 148,
        height: 50,
        shape: 'round-rectangle',
        'background-color': '#fff',
        'border-width': 1.5,
        'border-color': '#cad3df',
        'overlay-opacity': 0,
      },
    },
    {
      selector: 'node[node_type = "INDIRECT"]',
      style: { 'border-style': 'dashed', 'border-color': '#f2a950', 'background-color': '#fffbf3' },
    },
    {
      selector: 'node[parent_id = null]',
      style: { 'background-color': '#e8f3ff', 'border-color': '#438ce1', color: '#1261ae', 'font-weight': 700 },
    },
    {
      selector: 'node:selected',
      style: { 'border-width': 3, 'border-color': '#2476d7', 'shadow-blur': 14, 'shadow-color': '#6aa9ed', 'shadow-opacity': 0.38 },
    },
    {
      selector: 'edge',
      style: {
        width: 1.7,
        'line-color': '#a6b3c2',
        'target-arrow-color': '#a6b3c2',
        'target-arrow-shape': 'triangle',
        'curve-style': 'straight',
        label: 'data(label)',
        'font-size': 11,
        color: '#6c7888',
        'text-background-color': '#f7f9fc',
        'text-background-opacity': 1,
        'text-background-padding': 3,
      },
    },
    {
      selector: 'edge[node_type = "INDIRECT"]',
      style: { 'line-style': 'dashed', 'line-color': '#e5a64e', 'target-arrow-color': '#e5a64e' },
    },
    {
      selector: 'edge.connect-source',
      style: { 'line-color': '#2476d7', 'target-arrow-color': '#2476d7' },
    },
  ],
});

let connectMode = false;
let boxSelectMode = false;
let connectSource = null;
let selectedNodeId = null;

let layoutRunning = false;

const layoutGraph = () => {
  const graphNodes = cy.nodes();
  if (!graphNodes.length || layoutRunning) return;

  layoutRunning = true;
  const denseGraph = graphNodes.length > 16;
  const layout = cy.layout({
    name: 'elk',
    elk: {
      algorithm: 'layered',
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': denseGraph ? '34' : '52',
      'elk.layered.spacing.nodeNodeBetweenLayers': denseGraph ? '76' : '96',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.unnecessaryBendpoints': 'true',
    },
    animate: true,
    animationDuration: 520,
    fit: true,
    padding: 58,
    stop: () => {
      layoutRunning = false;
    },
  });
  layout.run();
};

const loadExampleTree = async () => {
  try {
    const response = await fetch('/data/example-rca-tree.json');
    if (!response.ok) throw new Error('Failed to load example tree');
    const exampleNodes = await response.json();
    if (!Array.isArray(exampleNodes)) throw new Error('Invalid example tree');
    cy.add(toElements(exampleNodes));
    layoutGraph();
  } catch {
    toast('示例 RCA 树加载失败，可导入 JSON 或新建节点');
  }
};

loadExampleTree();

const getNodeData = (id) => cy.getElementById(id).data();
const setMode = (enabled) => {
  setBoxSelectMode(false);
  connectMode = enabled;
  connectSource = null;
  document.querySelector('#connectBtn').classList.toggle('active', enabled);
  const badge = document.querySelector('#modeBadge');
  badge.textContent = enabled ? '连接模式：请选择父节点' : '浏览模式';
  badge.classList.toggle('connecting', enabled);
};

const setBoxSelectMode = (enabled) => {
  boxSelectMode = enabled;
  cy.userPanningEnabled(!enabled);
  document.querySelector('#boxSelectBtn').classList.toggle('active', enabled);
  const badge = document.querySelector('#modeBadge');
  badge.textContent = enabled ? '框选模式：拖动选择区域' : connectMode ? badge.textContent : '浏览模式';
  badge.classList.toggle('selecting', enabled);
};

const toast = (message) => {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
};

const field = ({ label, path, value = '', type = 'text', options, hint, readonly = false, wide = false }) => `
  <label class="field ${wide ? 'wide' : ''}">
    <span>${label}</span>
    ${options
      ? `<select data-path="${path}">${options.map((option) => `<option value="${option}" ${option === value ? 'selected' : ''}>${option}</option>`).join('')}</select>`
      : type === 'textarea'
        ? `<textarea data-path="${path}" rows="3" placeholder="${hint || ''}">${value || ''}</textarea>`
        : `<input data-path="${path}" value="${value ?? ''}" type="${type}" placeholder="${hint || ''}" ${readonly ? 'readonly' : ''}/>`}
  </label>
`;

const renderProperties = (id) => {
  const panel = document.querySelector('#propertyPanel');
  const subtitle = document.querySelector('#propertySubtitle');
  if (!id || cy.getElementById(id).empty()) {
    selectedNodeId = null;
    subtitle.textContent = '选择一个节点以编辑属性';
    panel.className = 'property-panel empty';
    panel.innerHTML = `<div class="empty-state"><div class="empty-icon">${icons.plus}</div><h3>暂无选中节点</h3><p>在画布中点击一个节点，或使用左侧工具新增指标节点</p></div>`;
    return;
  }
  selectedNodeId = id;
  const n = getNodeData(id);
  subtitle.textContent = n.node_name;
  panel.className = 'property-panel';
  panel.innerHTML = `
    <section class="form-section">
      <h3>基础信息</h3>
      ${field({ label: '节点 ID', path: 'node_id', value: n.node_id, readonly: true, wide: true })}
      ${field({ label: '节点名称', path: 'node_name', value: n.node_name, wide: true })}
      ${field({ label: '业务代码', path: 'business_code', value: n.business_code, hint: '可选' })}
      ${field({ label: '父节点 ID', path: 'parent_id', value: n.parent_id, readonly: true })}
      ${field({ label: '节点类型', path: 'node_type', value: n.node_type, options: ['DIRECT', 'INDIRECT'] })}
      ${field({ label: '计算规则', path: 'calculation_rule', value: n.calculation_rule, options: n.node_type === 'DIRECT' ? ['+', '-', '*', '/'] : ['Positive', 'Negative'] })}
    </section>
    <section class="form-section">
      <h3>数据元信息</h3>
      ${field({ label: '表名', path: 'meta_data.table_name', value: n.meta_data.table_name })}
      ${field({ label: '字段名 / 表达式', path: 'meta_data.field_name', value: n.meta_data.field_name, hint: '例：SUM(revenue)' })}
      ${field({ label: '时间分区字段', path: 'meta_data.time_field', value: n.meta_data.time_field })}
      ${field({ label: '数据更新粒度', path: 'meta_data.time_grain', value: n.meta_data.time_grain, options: ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] })}
      ${field({ label: '关联键 / 维度字段', path: 'meta_data.join_keys', value: n.meta_data.join_keys, hint: '例：bank_code, branch_code', wide: true })}
      ${field({ label: '额外过滤条件', path: 'meta_data.extra_conditions', value: n.meta_data.extra_conditions, type: 'textarea', hint: "例：currency_code = 'HKD'", wide: true })}
    </section>
    <section class="form-section">
      <h3>业务上下文</h3>
      ${field({ label: '影响说明', path: 'business_context.impact_description', value: n.business_context.impact_description, type: 'textarea', wide: true })}
      ${field({ label: '指标单位', path: 'business_context.metric_unit', value: n.business_context.metric_unit, hint: '例：元、%、个' })}
      ${field({ label: '环比阈值', path: 'business_context.drift_threshold.mom_threshold', value: n.business_context.drift_threshold.mom_threshold, type: 'number' })}
      ${field({ label: '同比阈值', path: 'business_context.drift_threshold.yoy_threshold', value: n.business_context.drift_threshold.yoy_threshold, type: 'number' })}
      ${field({ label: '触发逻辑', path: 'business_context.drift_threshold.trigger_logic', value: n.business_context.drift_threshold.trigger_logic, options: ['OR', 'AND'] })}
    </section>
  `;

  panel.querySelectorAll('[data-path]').forEach((input) => {
    input.addEventListener('input', (event) => updateNodeData(n.node_id, event.target.dataset.path, event.target.value));
  });
};

const renderSelection = () => {
  const selected = cy.$('node:selected');
  if (selected.length === 1) {
    renderProperties(selected.id());
    return;
  }
  if (selected.length > 1) {
    selectedNodeId = null;
    document.querySelector('#propertySubtitle').textContent = `已选择 ${selected.length} 个节点`;
    const panel = document.querySelector('#propertyPanel');
    panel.className = 'property-panel empty';
    panel.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${icons.select}</div>
        <h3>已选择 ${selected.length} 个节点</h3>
        <p>可使用左侧删除按钮批量删除节点，或点击单个节点继续编辑属性</p>
      </div>
    `;
    return;
  }
  renderProperties(null);
};

const updateNodeData = (id, path, value) => {
  const node = cy.getElementById(id);
  const data = node.data();
  const keys = path.split('.');
  let target = data;
  keys.slice(0, -1).forEach((key) => { target = target[key]; });
  target[keys.at(-1)] = value;
  node.data(data);
  if (path === 'node_name') document.querySelector('#propertySubtitle').textContent = value;
  if (path === 'node_type') {
    const edge = node.incomers('edge');
    edge.data('node_type', value);
    const rule = value === 'DIRECT' ? '+' : 'Positive';
    node.data('calculation_rule', rule);
    edge.data('label', rule);
    renderProperties(id);
  }
  if (path === 'calculation_rule') node.incomers('edge').data('label', value);
};

const addNode = () => {
  const data = createNode();
  cy.add({ group: 'nodes', data: { id: data.node_id, ...data }, position: { x: cy.width() / 2, y: cy.height() / 2 } });
  cy.elements().unselect();
  cy.getElementById(data.node_id).select();
  renderProperties(data.node_id);
  toast('已新增节点，请填写属性并连接父节点');
};

const wouldCreateCycle = (source, target) => source.id() === target.id() || target.successors().contains(source);
const connectNodes = (source, target) => {
  if (target.data('parent_id')) {
    toast('一个节点只能有一个父节点');
    return false;
  }
  if (wouldCreateCycle(source, target)) {
    toast('无法连接：该操作会形成循环');
    return false;
  }
  target.data('parent_id', source.id());
  cy.add({
    group: 'edges',
    data: {
      id: `edge-${source.id()}-${target.id()}`,
      source: source.id(),
      target: target.id(),
      node_type: target.data('node_type'),
      label: target.data('calculation_rule'),
    },
  });
  renderProperties(target.id());
  layoutGraph();
  toast('节点连接成功');
  return true;
};

cy.on('tap', 'node', (event) => {
  const node = event.target;
  if (!boxSelectMode) {
    cy.nodes(':selected').not(node).unselect();
  }
  renderProperties(node.id());
  if (!connectMode) return;
  if (!connectSource) {
    connectSource = node;
    node.addClass('connect-source');
    document.querySelector('#modeBadge').textContent = '连接模式：请选择子节点';
    toast(`已选择父节点：${node.data('node_name')}`);
    return;
  }
  connectNodes(connectSource, node);
  connectSource.removeClass('connect-source');
  setMode(false);
});

cy.on('tap', (event) => {
  if (event.target === cy && !boxSelectMode) renderProperties(null);
});

cy.on('select unselect boxend', () => renderSelection());

document.querySelector('#addBtn').addEventListener('click', addNode);
document.querySelector('#boxSelectBtn').addEventListener('click', () => {
  if (connectMode) setMode(false);
  setBoxSelectMode(!boxSelectMode);
});
document.querySelector('#connectBtn').addEventListener('click', () => setMode(!connectMode));
document.querySelector('#layoutBtn').addEventListener('click', layoutGraph);
document.querySelector('#fitBtn').addEventListener('click', () => cy.fit(undefined, 42));
document.querySelector('#zoomIn').addEventListener('click', () => cy.zoom({ level: cy.zoom() * 1.15, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }));
document.querySelector('#zoomOut').addEventListener('click', () => cy.zoom({ level: cy.zoom() / 1.15, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }));
document.querySelector('#deleteBtn').addEventListener('click', () => {
  const selected = cy.$('node:selected');
  if (!selected.length) return toast('请先选择要删除的节点');
  selected.forEach((node) => node.outgoers('node').forEach((child) => child.data('parent_id', null)));
  selected.remove();
  renderProperties(null);
  toast('已删除选中节点');
});

const exportData = () => {
  const data = cy.nodes().map((node) => {
    const { id, ...rest } = node.data();
    return rest;
  });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'rca-tree.json';
  link.click();
  URL.revokeObjectURL(url);
};

document.querySelector('#exportBtn').addEventListener('click', exportData);
document.querySelector('#importBtn').addEventListener('click', () => document.querySelector('#fileInput').click());
document.querySelector('#fileInput').addEventListener('change', async (event) => {
  try {
    const imported = JSON.parse(await event.target.files[0].text());
    if (!Array.isArray(imported)) throw new Error('Invalid format');
    cy.elements().remove();
    cy.add(toElements(imported));
    layoutGraph();
    renderProperties(null);
    toast('导入成功');
  } catch {
    toast('导入失败，请检查 JSON 文件格式');
  }
  event.target.value = '';
});
