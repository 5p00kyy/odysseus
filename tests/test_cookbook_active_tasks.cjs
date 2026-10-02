const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(process.argv[2], 'utf8');
const tasks = ['ready', 'running', 'queued', 'loading', 'warming', 'starting', 'done', 'stopped', 'error'].map(status => ({type: 'serve', status}));
const context = vm.createContext({tasks, _downloadOutputLooksActive: () => false});
const helper = source.indexOf('function _isTaskRuntimeActive(');
if (helper >= 0) vm.runInContext(source.slice(helper, source.indexOf('\n}\n', helper) + 2), context);
const start = source.indexOf('const activeCount = tasks.filter(');
const end = source.indexOf(').length;', start) + ').length;'.length;
const count = vm.runInContext(`${source.slice(start, end)} activeCount`, context);
assert.equal(count, 6, 'Ready and initializing model servers count as active, not just running/queued');
for (const status of ['ready', 'loading', 'warming', 'starting', 'running']) {
  context.task = {status};
  assert(vm.runInContext('_isTaskRuntimeActive(task)', context));
}
for (const status of ['queued', 'done', 'stopped', 'error']) {
  context.task = {status};
  assert(!vm.runInContext('_isTaskRuntimeActive(task)', context));
}
assert(source.includes('_taskServerKey(t) === host && _isTaskRuntimeActive(t)'), 'Stop all must include ready servers');
console.log('PASS: active count and Stop all include ready/initializing servers without treating finished tasks as live');
