"""Regression guards for vLLM NVFP4/modelopt Cookbook serve profiles.

The browser modules depend on DOM globals, so these tests verify the source-level
contracts that keep generated vLLM commands and diagnostics aligned.
"""

from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
COOKBOOK_JS = ROOT / "static/js/cookbook.js"
SERVE_JS = ROOT / "static/js/cookbookServe.js"
DIAG_JS = ROOT / "static/js/cookbook-diagnosis.js"
ROUTES = ROOT / "routes/cookbook_routes.py"
RUNNING_JS = ROOT / "static/js/cookbookRunning.js"


def test_qwen36_nvfp4_profile_adds_essential_vllm_flags_only():
    source = COOKBOOK_JS.read_text(encoding="utf-8")

    assert "isQwen35Family" in source
    assert "qwen36" in source
    assert "isModelOptNvfp4" in source
    for flag in (
        "--quantization modelopt",
        "--trust-remote-code",
        "--language-model-only",
        "--generation-config vllm",
        "--reasoning-parser qwen3",
    ):
        assert flag in source
    assert "addOptFlag('--attention-backend TRITON_ATTN')" not in source
    assert "addOptFlag('--disable-custom-all-reduce')" not in source
    assert "opts.defaults.vllm_kv_cache_dtype" not in source
    assert "opts.defaults.max_batched_tokens" not in source


def test_vllm_builder_and_panel_support_max_batched_tokens():
    cookbook = COOKBOOK_JS.read_text(encoding="utf-8")
    serve = SERVE_JS.read_text(encoding="utf-8")
    running = RUNNING_JS.read_text(encoding="utf-8")

    assert "max_batched_tokens" in cookbook
    assert "--max-num-batched-tokens" in cookbook
    assert 'data-field="max_batched_tokens"' in serve
    assert "--max-num-batched-tokens" in serve
    assert "max_batched_tokens" in running


def test_vllm_launch_warns_when_selected_gpu_memory_is_busy():
    source = SERVE_JS.read_text(encoding="utf-8")

    assert "GPU memory already in use" in source
    assert "serveState.gpu_mem" in source
    assert "g.free_mb / g.total_mb" in source


def test_flashinfer_fp4_compile_diagnosis_and_limited_parallelism():
    diag = DIAG_JS.read_text(encoding="utf-8")
    routes = ROUTES.read_text(encoding="utf-8")

    assert "fp4_gemm_cutlass" in diag
    assert "FlashInfer/CUTLASS FP4" in diag
    assert "fp4_gemm_cutlass" in routes
    assert 'export MAX_JOBS="${MAX_JOBS:-1}"' in routes
    assert 'export CMAKE_BUILD_PARALLEL_LEVEL="${CMAKE_BUILD_PARALLEL_LEVEL:-1}"' in routes


def test_cookbook_auto_registration_preserves_served_model_name():
    routes = ROUTES.read_text(encoding="utf-8")

    assert "--served-model-name" in routes
    assert "pinned_models" in routes
    assert "_merge_pinned" in routes
