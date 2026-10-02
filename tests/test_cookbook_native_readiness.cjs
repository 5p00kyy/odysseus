const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(process.argv[2], 'utf8');
const start = source.indexOf('function _serveOutputLooksReady(');
assert(start >= 0);
const end = source.indexOf('\n}\n', start) + 2;
const context = vm.createContext({});
vm.runInContext(source.slice(start, end), context);
function ready(output) {
  context.task = {type: 'serve', output};
  return vm.runInContext('_serveOutputLooksReady(task)', context);
}
assert(ready('3.35 W Wrong type supplied [json.exception.type_error.302]\n3.37 I slot print_timing: id 0 | eval time = 722 ms'), 'Native generation is ready despite a nonfatal request warning');
assert(ready('main: server is listening on http://0.0.0.0:8001'));
assert(ready('slot      release: id 0 | stop processing: n_tokens = 337'));
assert(!ready('Wrong type supplied [json.exception.type_error.302]'));
assert(!ready('llama_model_load: loading model'));
assert(!ready('slot print_timing: eval time = 100 ms\n=== process exited with code -9 ==='), 'Old activity must not hide a later exit');
assert(ready('=== process exited with code 127 ===\nmain: server is listening on http://0.0.0.0:8001'));
console.log('PASS: native startup and generation are recognized; warnings or loading alone are not ready');
