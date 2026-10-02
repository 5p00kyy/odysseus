const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(process.argv[2], 'utf8');

function actionBody(action) {
  const needle = `el.querySelector('.cookbook-task-action-${action}').addEventListener('click', async () => {`;
  const start = source.indexOf(needle);
  assert(start >= 0, `missing ${action} handler`);
  const end = source.indexOf('\n    });', start);
  return source.slice(start + needle.length, end);
}

async function run(action, replies) {
  const events = [];
  const task = {sessionId: 'serve-fixture', type: 'serve', status: 'running', payload: {repo_id: 'fixture/model'}};
  const badge = {};
  const el = {dataset: {status: 'running'}, _abort: {abort: () => {}},
    querySelector: selector => selector.includes('status') ? badge : null};
  const context = vm.createContext({el, task,
    _updateTask: (_, update) => {Object.assign(task, update); events.push('update');},
    _ollamaUnloadCommand: () => '',
    _tmuxGracefulKill: () => 'kill fixture', _tmuxCmd: () => 'probe fixture',
    _endpointUrlForTask: () => 'http://fixture/v1',
    _removeEndpointByUrl: () => events.push('endpoint-removed'),
    _refreshModelsAfterEndpointChange: () => {},
    _animateOutThenRemove: () => events.push('card-removed'),
    _renderRunningTab: () => {},
    uiModule: {showToast: () => events.push('toast')},
    fetch: async (_, options) => {
      const command = options && JSON.parse(options.body).command;
      if (!command) return {ok: true, json: async () => []};
      events.push(command);
      const reply = replies.shift();
      if (reply instanceof Error) throw reply;
      assert(reply, 'unexpected shell request');
      return {ok: reply.ok !== false, json: async () => {
        if (reply.jsonError) throw new Error('invalid response');
        return reply.body === undefined ? {exit_code: reply.exit_code} : reply.body;
      }};
    },
  });
  const helperStart = source.indexOf('async function _stopTaskSessionVerified(');
  if (helperStart >= 0) {
    const helperEnd = source.indexOf('\n}\n', helperStart) + 2;
    vm.runInContext(source.slice(helperStart, helperEnd), context);
  }
  await vm.runInContext(`(async () => {${actionBody(action)}\n})()`, context);
  return {events, task};
}

(async () => {
  for (const action of ['stop', 'kill']) {
    const alive = await run(action, [{exit_code: 0}, {exit_code: 0}]);
    assert(!alive.events.includes('card-removed'), `${action}: live server must not disappear`);
    assert(!alive.events.includes('endpoint-removed'), `${action}: live endpoint must remain`);
    assert(!alive.task._userStopped, `${action}: failed stop must remain pollable`);
    for (const reply of [{ok: false}, {exit_code: 255}, {body: {}}, {jsonError: true}, new Error('transport unavailable')]) {
      const unknown = await run(action, [{exit_code: 0}, reply]);
      assert(!unknown.events.includes('card-removed'), `${action}: unknown liveness must not disappear`);
      assert(!unknown.events.includes('endpoint-removed'), `${action}: unknown endpoint must remain`);
    }
    const failed = await run(action, [{ok: false}]);
    assert(!failed.events.includes('card-removed'), `${action}: failed command must retain card`);
    const stopped = await run(action, [{exit_code: 0}, {exit_code: 1}]);
    assert(stopped.events.includes('card-removed'), `${action}: verified stop should clear card`);
    assert(stopped.events.indexOf('endpoint-removed') > stopped.events.indexOf('probe fixture'), `${action}: endpoint removal must follow verification`);
  }
  console.log('PASS: Stop and Kill preserve live/unknown tasks and endpoints; removal requires confirmed absence');
})().catch(error => {console.error(error); process.exitCode = 1;});
