import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from '@babel/parser';

// Read exported JavaScript as syntax only. Never execute publisher code to obtain its tables.
function walk(node, visit, stopAtFunctions = false) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const child of node) walk(child, visit, stopAtFunctions); return; }
  if (!node.type) return;
  visit(node);
  if (stopAtFunctions && /Function|Method/.test(node.type)) return;
  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'comments', 'leadingComments', 'trailingComments', 'innerComments', 'tokens'].includes(key)) continue;
    if (value && typeof value === 'object') walk(value, visit, stopAtFunctions);
  }
}

function memberName(node, aliases = new Map()) {
  let name;
  if (node?.type === 'Identifier') name = node.name;
  else if (node?.type === 'ThisExpression') name = 'this';
  else if (node?.type === 'MemberExpression') {
    const owner = memberName(node.object, aliases);
    const property = node.computed ? node.property.value : node.property.name;
    if (owner && typeof property !== 'undefined') name = `${owner}.${property}`;
  }
  return aliases.get(name) || name;
}

function runtimeTables(code, file) {
  const ast = parse(code, { sourceType: 'unambiguous' });
  let format, table, expressions = [];
  walk(ast, node => {
    if (node.type !== 'AssignmentExpression') return;
    const name = memberName(node.left);
    if (name === 'cr.getObjectRefTable' || name === 'self.C3_GetObjectRefTable' || name === 'globalThis.C3_GetObjectRefTable') {
      const fn = node.right;
      const returned = fn.body?.type === 'ArrayExpression' ? fn.body : fn.body?.body?.find(n => n.type === 'ReturnStatement')?.argument;
      if (returned?.type === 'ArrayExpression') {
        format = name === 'cr.getObjectRefTable' ? 'construct2-export' : 'construct3-export';
        table = returned;
      }
    }
    if (/^(?:self|globalThis)\.C3_ExpressionFuncs$/.test(name || '') && node.right.type === 'ArrayExpression') {
      expressions = node.right.elements.map((fn, index) => ({ index, source: fn ? code.slice(fn.start, fn.end) : null, line: fn?.loc.start.line }));
    }
  });
  // Modern C3 exports can split compiled expressions into c3runtime.js while
  // keeping the reference table in the adjacent objRefTable.js.
  if (!table) return expressions.length ? { format: null, expressions } : null;
  const definitions = new Map();
  function scope(nodes, inherited = new Map()) {
    const aliases = new Map(inherited), children = [];
    // Constructor prototype aliases are assigned after ACE definitions in C2 exports.
    for (let pass = 0; pass < 3; pass++) walk(nodes, node => {
      if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
        const value = memberName(node.init, aliases);
        if (value) aliases.set(node.id.name, value);
      }
      if (node.type === 'AssignmentExpression' && node.right.type === 'NewExpression') {
        const target = memberName(node.left, aliases), ctor = memberName(node.right.callee, aliases);
        if (target && ctor) aliases.set(`${ctor}.prototype`, target);
      }
    }, true);
    walk(nodes, node => {
      if (node.type === 'AssignmentExpression' && /FunctionExpression|ArrowFunctionExpression/.test(node.right.type)) {
        const name = memberName(node.left, aliases);
        if (name) definitions.set(name, { sourceFile: file, line: node.right.loc.start.line, endLine: node.right.loc.end.line, source: code.slice(node.right.start, node.right.end), ast: node.right });
      }
      if (/Function|Method/.test(node.type)) children.push(node);
    }, true);
    for (const child of children) scope(child.body?.type === 'BlockStatement' ? child.body.body : child.body, aliases);
  }
  scope(ast.program.body);
  const references = table.elements.map((node, index) => {
    const name = memberName(node);
    const def = definitions.get(name);
    const definition = def ? { sourceFile: def.sourceFile, line: def.line, endLine: def.endLine, source: def.source } : null;
    return { index, name: name || null, raw: node ? code.slice(node.start, node.end) : null, sourceFile: file, line: node?.loc.start.line, definition };
  });
  const behaviorProperties = {};
  for (const ref of references.filter(r => /^(?:cr\.behaviors\.|C3\.Behaviors\.)[^.]+$/.test(r.name || ''))) {
    const def = definitions.get(`${ref.name}.prototype.Instance.prototype.onCreate`);
    if (!def) continue;
    const reads = [];
    walk(def.ast.body, node => {
      if (node.type !== 'AssignmentExpression' || !memberName(node.left)?.startsWith('this.')) return;
      walk(node.right, value => {
        if (value.type === 'MemberExpression' && memberName(value.object) === 'this.properties' && Number.isInteger(value.property.value)) {
          reads.push({ index: value.property.value, field: memberName(node.left).slice(5), readExpression: code.slice(node.right.start, node.right.end), line: node.loc.start.line });
        }
      });
    });
    behaviorProperties[ref.name] = { sourceFile: file, line: def.line, reads, initializer: def.source };
  }
  return { format, references, expressions, behaviorProperties };
}

export async function analyzeConstruct(captureRoot, files) {
  const output = path.join(captureRoot, 'analysis', 'construct');
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  const warnings = [];
  const warn = (kind, message, sourcePath, raw) => warnings.push({ kind, message, sourcePath, raw });
  let runtime, runtimeFile, runtimeCode, expressionSource;
  const expressionSources = [];
  for (const file of files.filter(f => /(?:^|\/)(?:c[23]runtime|c3main|objRefTable)(?:\.min)?\.js$/i.test(f.relative))) {
    try {
      const code = await readFile(file.full, 'utf8');
      const tables = runtimeTables(code, file.relative);
      if (tables?.expressions.length) expressionSources.push({ tables, file: file.relative, code });
      if (!runtime && tables?.format) { runtime = tables; runtimeFile = file.relative; runtimeCode = code; }
    } catch (error) { warn('runtime', error.message, file.relative); }
  }
  if (runtime?.format === 'construct3-export' && !runtime.expressions.length) {
    const adjacent = expressionSources.filter(s => path.posix.dirname(s.file) === path.posix.dirname(runtimeFile));
    if (adjacent.length === 1) {
      expressionSource = adjacent[0];
      runtime.expressions = expressionSource.tables.expressions;
    } else if (adjacent.length > 1) warn('runtime', '同一发布目录存在多个表达式表，无法确定对应关系。', runtimeFile);
  }
  if (!runtime) warn('runtime', '未找到可静态读取的 Construct 对象引用表；此构建暂不支持事件解码。');
  const isC3 = runtime?.format === 'construct3-export';
  let data, dataFile, dataText;
  // Stay beside the selected native runtime, excluding another game or a portal's project data.
  const runtimeDirectory = runtimeFile ? path.posix.dirname(runtimeFile).replace(/\/scripts$/, '') : null;
  const candidates = files.filter(f => /(?:^|\/)data\.(?:js|json)$/i.test(f.relative) && (!runtimeDirectory || path.posix.dirname(f.relative) === runtimeDirectory));
  for (const file of candidates) {
    try {
      const text = await readFile(file.full, 'utf8');
      const parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
      if (Array.isArray(parsed.project)) { data = parsed.project; dataFile = file.relative; dataText = text; break; }
    } catch (error) { warn('project', `无法读取项目数据：${error.message}`, file.relative); }
  }
  if (!data) warn('project', '缺少可读取的项目数据 data.js / data.json。');
  const counts = { objectReferences: runtime?.references.length || 0, methodBodies: runtime?.references.filter(r => r.definition).length || 0, objectTypes: 0, families: 0, layouts: 0, numericLayouts: 0, eventSheets: 0, eventBlocks: 0, groups: 0, eventVariables: 0, conditions: 0, actions: 0, expressions: 0 };
  const summary = { status: 'partial', format: runtime?.format || 'unsupported', counts, warnings, files: { summary: 'construct/summary.json' }, sources: [] };
  const fingerprint = (file, source) => ({ file, sha256: createHash('sha256').update(source).digest('hex') });
  if (runtime) summary.sources.push(fingerprint(runtimeFile, runtimeCode));
  if (expressionSource) summary.sources.push(fingerprint(expressionSource.file, expressionSource.code));
  if (data) summary.sources.push(fingerprint(dataFile, dataText));
  if (!runtime || !data) { await writeFile(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2)); return summary; }
  function validEventTree(events, depth = 0) {
    return depth < 256 && Array.isArray(events) && events.every(e => Array.isArray(e) &&
      (![0, 3].includes(e[0]) || (Array.isArray(e[6]) && e[6].every(Array.isArray) && Array.isArray(e[7]) && e[7].every(Array.isArray) && (!e[8] || validEventTree(e[8], depth + 1)))));
  }
  if (![2, 3, 4, 5, 6].every(i => Array.isArray(data[i])) || !data[6].every(s => Array.isArray(s) && validEventTree(s[1]))) {
    warn('schema', '项目模型不符合已支持的 Construct 导出数组结构。', '/project');
    await writeFile(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2)); return summary;
  }
  const lookupRef = (index, sourcePath) => {
    if (typeof index === 'string') return index;
    const ref = runtime.references[index];
    if (!ref?.name) { warn('reference', `无法解析对象引用 ${index}`, sourcePath, index); return `unresolved_ref_${index}`; }
    return ref.name;
  };
  const objects = data[3].map((raw, index) => {
    const sourcePath = `/project/3/${index}`;
    if (!Array.isArray(raw) || !Array.isArray(raw[3]) || !Array.isArray(raw[8])) {
      warn('object', '不支持的对象类型模型', sourcePath, raw);
      return { index, name: `Object#${index}`, behaviors: [], variables: [], sourcePath, raw };
    }
    return { index, name: raw[0] || `Object#${index}`, plugin: lookupRef(raw[1], `${sourcePath}/1`), family: !!raw[2], sid: raw[11],
      variables: raw[3].map((v, i) => isC3 ? { index: i, sid: v[0], type: v[1], name: v[2] || `instanceVar[${i}]` } : { index: i, sid: v, name: `instanceVar[${i}]`, nameRecovered: false }),
      behaviors: raw[8].map((b, i) => ({ index: i, name: b[0], runtime: lookupRef(b[1], `${sourcePath}/8/${i}/1`), sid: b[2] })),
      members: [], families: [], animations: raw[7], sourcePath, raw };
  });
  function object(index, sourcePath) {
    if (index === -1) return { index: -1, name: 'System' };
    if (index === -2) return { index: -2, name: 'Function' };
    const obj = objects[index];
    if (!obj) warn('object-reference', `对象索引 ${index} 不存在`, sourcePath, index);
    return { index, name: obj?.name || `Object#${index}` };
  }
  for (const [i, raw] of data[4].entries()) {
    const family = objects[raw[0]];
    if (!family?.family || raw.slice(1).some(index => !objects[index])) { warn('family', '对象族成员数据无效', `/project/4/${i}`, raw); continue; }
    family.members = raw.slice(1).map(index => object(index));
    for (const member of family.members) objects[member.index].families.push(object(raw[0]));
  }
  const varsBySid = new Map();
  function collectVariables(events) {
    for (const e of events) {
      if (e[0] === 1) varsBySid.set(e[6], e[1]);
      if ([0, 3].includes(e[0])) collectVariables(e[8] || []);
    }
  }
  for (const s of data[6]) collectVariables(s[1] || []);
  const eventVar = value => isC3 ? varsBySid.get(value) || `eventVar#${value}` : String(value);
  const methodText = (name, obj, behavior) => `${obj.name}${behavior ? `.${behavior}` : ''}.${name.split('.').at(-1)}`;
  function expression(m, sourcePath) {
    counts.expressions++;
    if (!Array.isArray(m)) { warn('expression', '表达式不是数组', sourcePath, m); return '<unknown-expression>'; }
    const op = m[0];
    if (isC3) {
      const compiled = runtime.expressions[op];
      if (!compiled?.source) warn('expression', `C3 编译表达式 ${op} 缺少函数体`, sourcePath, m);
      return `expression#${op}(${m.slice(1).map((n, i) => c3Node(n, `${sourcePath}/${i + 1}`)).join(', ')})`;
    }
    if ([0, 1, 2].includes(op)) return JSON.stringify(m[1]);
    if (op === 3) return `(-${expression(m[1], `${sourcePath}/1`)})`;
    const binary = { 4: '+', 5: '-', 6: '*', 7: '/', 8: '%', 9: '**', 10: '&', 11: '|', 12: '=', 13: '!=', 14: '<', 15: '<=', 16: '>', 17: '>=' };
    if (binary[op]) return `(${expression(m[1], `${sourcePath}/1`)} ${binary[op]} ${expression(m[2], `${sourcePath}/2`)})`;
    if (op === 18) return `(${expression(m[1], `${sourcePath}/1`)} ? ${expression(m[2], `${sourcePath}/2`)} : ${expression(m[3], `${sourcePath}/3`)})`;
    if (op === 23) return String(m[1]);
    if ([19, 20, 22].includes(op)) {
      const refIndex = op === 19 ? 1 : op === 20 ? 2 : 3;
      const argsIndex = op === 19 ? 2 : op === 20 ? 5 : 6;
      const obj = object(op === 19 ? -1 : m[1], sourcePath);
      const instance = op === 20 ? m[4] : op === 22 ? m[5] : null;
      const selected = instance ? { ...obj, name: `${obj.name}[${expression(instance, `${sourcePath}/${argsIndex - 1}`)}]` } : obj;
      const name = lookupRef(m[refIndex], `${sourcePath}/${refIndex}`);
      return `${methodText(name, selected, op === 22 ? m[2] : null)}(${(m[argsIndex] || []).map((e, i) => expression(e, `${sourcePath}/${argsIndex}/${i}`)).join(', ')})`;
    }
    if (op === 21) {
      const obj = object(m[1], sourcePath);
      const selector = m[3] ? `[${expression(m[3], `${sourcePath}/3`)}]` : '';
      return `${obj.name}${selector}.instanceVar[${m[4]}]`;
    }
    warn('expression', `不支持的 C2 表达式 opcode ${op}`, sourcePath, m);
    return `<unknown-expression:${JSON.stringify(m)}>`;
  }
  function c3Node(n, sourcePath) {
    if (!Array.isArray(n)) { warn('expression-node', '不支持的 C3 表达式节点', sourcePath, n); return JSON.stringify(n); }
    if (n[0] === 3) return eventVar(n[1]);
    if (n[0] === 4) return methodText(lookupRef(n[1], sourcePath), object(-1));
    if (n[0] === 2) return `${object(n[1], sourcePath).name}.instanceVar[${n[3]}]`;
    if (n[0] === 1) return methodText(lookupRef(n[2], sourcePath), object(n[1], sourcePath));
    if (n[0] === 0) return methodText(lookupRef(n[3], sourcePath), object(n[1], sourcePath), n[2]);
    if (n[0] === 5) return `Function.${n[1]}`;
    warn('expression-node', '不支持的 C3 表达式节点', sourcePath, n); return JSON.stringify(n);
  }
  function parameter(m, sourcePath, owner) {
    const result = { type: m?.[0], text: '', sourcePath, raw: m };
    if (!Array.isArray(m)) { warn('parameter', '参数不是数组', sourcePath, m); return result; }
    const type = m[0], value = m[1];
    if ([0, 1, 5, 7, 14].includes(type)) {
      result.text = expression(value, `${sourcePath}/1`);
      if (isC3) result.expressionFunction = runtime.expressions[value?.[0]];
    } else if (type === 4) { result.object = object(value, sourcePath); result.text = result.object.name; }
    else if (type === 11) result.text = eventVar(value);
    else if (type === 8) result.text = ['=', '!=', '<', '<=', '>', '>='][value] || `comparison(${value})`;
    else if (type === 3) result.text = `combo(${value})`;
    else if (type === 9) result.text = `key(${value})`;
    else if (type === 10) result.text = `${owner?.name || 'pickedObject'}.instanceVar[${value}]`;
    else if (type === 13) result.text = m.slice(1).map((p, i) => parameter(p, `${sourcePath}/${i + 1}`, owner).text).join(', ');
    else if ([2, 6, 12, 16, 17, 18, 20].includes(type)) result.text = JSON.stringify(value);
    else { warn('parameter', `不支持的参数类型 ${type}`, sourcePath, m); result.text = JSON.stringify(m); }
    return result;
  }
  function ace(raw, sourcePath, condition) {
    counts[condition ? 'conditions' : 'actions']++;
    const obj = object(raw[0], `${sourcePath}/0`);
    const method = lookupRef(raw[1], `${sourcePath}/1`);
    const paramIdx = condition ? 9 : (isC3 ? 6 : 5);
    const paramRaw = Array.isArray(raw[paramIdx]) ? raw[paramIdx] : [];
    const parameters = paramRaw.map((p, i) => parameter(p, `${sourcePath}/${paramIdx}/${i}`, obj));
    return { object: obj, method, behavior: raw[2], sid: raw[condition ? 7 : 3],
      ...(condition ? { trigger: raw[3] > 0, triggerCode: raw[3], looping: !!raw[4], inverted: !!raw[5], static: !!raw[6] } : { returnType: raw[4] }),
      parameters, text: `${condition && raw[5] ? 'NOT ' : ''}${methodText(method, obj, raw[2])}(${parameters.map(p => p.text).join(', ')})`, sourcePath, raw };
  }
  function event(raw, sourcePath, nested = false) {
    if (raw[0] === 1) { counts.eventVariables++; return { kind: 'variable', name: raw[1], type: raw[2], initial: raw[3], static: !!raw[4], constant: !!raw[5], global: !nested, sid: raw[6], sourcePath, raw }; }
    if (raw[0] === 2) return { kind: 'include', name: raw[1], sourcePath, raw };
    if (raw[0] === 5) { counts.eventBlocks++; return { kind: 'script', scriptIndex: raw[1], sid: raw[2], sourcePath, raw }; }
    const hasExportNumber = !Array.isArray(raw[5]) && Array.isArray(raw[6]) && Array.isArray(raw[7]);
    const condIdx = hasExportNumber ? 6 : 5;
    const actIdx = hasExportNumber ? 7 : 6;
    const childIdx = hasExportNumber ? 8 : 7;
    if (![0, 3, 4, 6].includes(raw[0]) || !Array.isArray(raw[condIdx]) || !Array.isArray(raw[actIdx])) {
      warn('event', `不支持的事件类型 ${raw[0]}`, sourcePath, raw); return { kind: 'unknown', sourcePath, raw };
    }
    counts.eventBlocks++;
    if (raw[0] === 3) counts.groups++;
    const isGroup = raw[0] === 3;
    const isFunction = raw[0] === 4 || raw[0] === 6;
    const kind = isGroup ? 'group' : isFunction ? 'function' : 'event';
    const name = isGroup ? raw[1]?.[1] : raw[0] === 4 ? raw[1]?.[0] : raw[0] === 6 ? raw[1]?.[1] : (Array.isArray(raw[1]) ? raw[1]?.[1] : undefined);
    return { kind, name, activeOnStart: isGroup ? !!raw[1]?.[0] : undefined,
      or: !!raw[2], sid: raw[4], exportNumber: hasExportNumber ? raw[5] : undefined,
      conditions: raw[condIdx].map((c, i) => ace(c, `${sourcePath}/${condIdx}/${i}`, true)),
      actions: raw[actIdx].map((a, i) => ace(a, `${sourcePath}/${actIdx}/${i}`, false)),
      children: (raw[childIdx] || []).map((e, i) => event(e, `${sourcePath}/${childIdx}/${i}`, true)), sourcePath, raw };
  }
  function instance(raw, sourcePath) {
    const obj = object(raw[1], sourcePath), type = objects[raw[1]], wm = raw[0];
    const behaviors = type ? [...type.families.flatMap(f => objects[f.index].behaviors), ...type.behaviors] : [];
    const behaviorData = raw[4] || [];
    if (behaviorData.length !== behaviors.length) warn('instance-behaviors', '实例行为参数与行为类型数量不一致', sourcePath, raw);
    return { object: obj, uid: raw[2], variables: raw[3], pluginProperties: raw[5],
      world: Array.isArray(wm) && wm.length >= 10 ? { x: wm[0], y: wm[1], z: wm[2], width: wm[3], height: wm[4], angle: wm[6], opacity: isC3 ? wm[7]?.[3] : wm[7], originX: wm[8], originY: wm[9] } : null,
      behaviors: behaviorData.map((properties, i) => ({ ...behaviors[i], properties, propertyReads: (runtime.behaviorProperties[behaviors[i]?.runtime]?.reads || []).map(r => ({ ...r, rawValue: properties[r.index] })) })), sourcePath, raw };
  }
  const layouts = data[5].map((raw, i) => {
    const sourcePath = `/project/5/${i}`;
    const layersIndex = Array.isArray(raw[9]) ? 9 : (Array.isArray(raw[8]) ? 8 : 6);
    const nonWorldIndex = layersIndex + 1;
    if (!Array.isArray(raw[layersIndex])) { warn('layout', '不支持的布局结构', sourcePath, raw); return { name: raw[0], sourcePath, raw, layers: [] }; }
    return { name: raw[0], width: raw[1], height: raw[2], unboundedScrolling: !!raw[3],
      eventSheet: isC3 ? (typeof raw[7] === 'string' ? raw[7] : raw[6]) : raw[4],
      sid: isC3 ? (typeof raw[8] === 'number' ? raw[8] : raw[7]) : raw[5],
      layers: raw[layersIndex].map((l, j) => ({ name: l[0], index: l[1], sid: l[2], visible: !!l[3], parallaxX: l[6], parallaxY: l[7],
        instances: (l[14] || []).map((inst, k) => instance(inst, `${sourcePath}/${layersIndex}/${j}/14/${k}`)) })),
      nonWorldInstances: (raw[nonWorldIndex] || []).map((inst, j) => instance(inst, `${sourcePath}/${nonWorldIndex}/${j}`)), sourcePath, raw };
  });
  const eventSheets = data[6].map((s, i) => ({ name: s[0], events: s[1].map((e, j) => event(e, `/project/6/${i}/1/${j}`)), sourcePath: `/project/6/${i}` }));
  Object.assign(counts, { objectTypes: objects.length, families: objects.filter(o => o.family).length, layouts: layouts.length, numericLayouts: layouts.filter(l => /^\d+$/.test(l.name) && Number(l.name) > 0).length, eventSheets: eventSheets.length });
  const project = { format: runtime.format, name: data[0], firstLayout: data[1], viewport: { width: data[10], height: data[11] }, sources: summary.sources, objects, layouts, eventSheets, expressionFunctions: runtime.expressions, behaviorProperties: runtime.behaviorProperties };
  const eventsText = ['# Construct 事件解码', '', `项目：${project.name}；格式：${runtime.format}。`, '', '保留导出顺序、子事件、OR、取反、触发条件及对象筛选目标。动作作用于引擎当前选中对象；此文件是静态解码，不代表实机行为验证或原始编辑器工程恢复。combo(n) 保留选项编号，instanceVar[n] 表示原名未恢复。C3 expression#n 的原始函数见 project.json 的 expressionFunctions，节点按参数顺序绑定。', ''];
  function renderEvents(events, depth = 0) {
    const indent = '  '.repeat(depth);
    for (const e of events) {
      if (e.kind === 'variable') eventsText.push(`${indent}- ${e.global ? 'GLOBAL' : 'LOCAL'} ${e.name} = ${JSON.stringify(e.initial)} [sid=${e.sid}]`);
      else if (e.kind === 'include') eventsText.push(`${indent}- INCLUDE ${JSON.stringify(e.name)}`);
      else {
        eventsText.push(`${indent}- ${e.kind === 'group' ? `GROUP ${JSON.stringify(e.name)} (active=${e.activeOnStart})` : `EVENT ${e.exportNumber ?? ''}`} [sid=${e.sid}]`, `${indent}  SOURCE ${e.sourcePath}`);
        if (e.conditions?.length) eventsText.push(`${indent}  IF (${e.or ? 'OR' : 'AND'}):`);
        for (const c of e.conditions || []) eventsText.push(`${indent}    ${c.text}${c.trigger ? ' [trigger]' : ''}${c.looping ? ' [loop]' : ''}`);
        for (const a of e.actions || []) eventsText.push(`${indent}  DO ${a.text}`);
        renderEvents(e.children || [], depth + 1);
      }
    }
  }
  for (const s of eventSheets) { eventsText.push(`## ${s.name}`, '', '```text'); renderEvents(s.events); eventsText.push('```', ''); }
  summary.status = warnings.length ? 'partial' : 'decoded';
  summary.files = { project: 'construct/project.json', references: 'construct/object-references.json', events: 'construct/events.md', summary: 'construct/summary.json' };
  await writeFile(path.join(output, 'project.json'), JSON.stringify(project, null, 2));
  await writeFile(path.join(output, 'object-references.json'), JSON.stringify(runtime.references, null, 2));
  await writeFile(path.join(output, 'events.md'), eventsText.join('\n'));
  await writeFile(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
  return summary;
}
