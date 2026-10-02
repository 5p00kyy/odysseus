"""Native llama.cpp readiness must survive startup scrolling out of the pane."""
import ast
from pathlib import Path
import unittest

SOURCE = Path(__file__).resolve().parents[1] / 'routes' / 'cookbook_helpers.py'
module = ast.parse(SOURCE.read_text())
function = next(node for node in module.body if isinstance(node, ast.FunctionDef) and node.name == '_parse_serve_phase')
namespace = {}
exec(compile(ast.Module(body=[function], type_ignores=[]), str(SOURCE), 'exec'), namespace)
parse_phase = namespace['_parse_serve_phase']


class NativeLlamaPhaseTests(unittest.TestCase):
    def test_native_runtime_activity_overrides_nonfatal_request_warning(self):
        snapshot = ('3.35.425.133 W Wrong type supplied for parameter tool_choice, using default value: '
                    '[json.exception.type_error.302] type must be string, but is object\n'
                    '3.37.919.258 I slot print_timing: id 0 | task 133 | eval time = 722.69 ms / 35 tokens\n'
                    '3.37.919.286 I slot print_timing: id 0 | task 133 | draft acceptance = 1.00000\n')
        self.assertEqual(parse_phase(snapshot).get('status'), 'ready')

    def test_native_listening_marker_is_ready(self):
        self.assertEqual(parse_phase('main: server is listening on http://0.0.0.0:8001').get('status'), 'ready')

    def test_warning_alone_does_not_prove_readiness(self):
        self.assertNotEqual(parse_phase('Wrong type supplied [json.exception.type_error.302]').get('status'), 'ready')

    def test_download_is_not_a_serving_phase(self):
        self.assertEqual(parse_phase('slot print_timing: eval time = 100 ms', 'download'), {})

    def test_exit_after_native_generation_is_not_ready(self):
        self.assertNotEqual(parse_phase('slot print_timing: eval time = 100 ms\n=== process exited with code -9 ===').get('status'), 'ready')

    def test_restarted_native_server_after_old_exit_is_ready(self):
        self.assertEqual(parse_phase('=== process exited with code 127 ===\nmain: server is listening on http://0.0.0.0:8001').get('status'), 'ready')


if __name__ == '__main__':
    unittest.main()
