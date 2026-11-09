import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

MODULE = Path(__file__).resolve().parents[1] / "scripts/dev.py"
spec = importlib.util.spec_from_file_location("organiza_dev", MODULE)
dev = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dev)


class DevelopmentRunnerTests(unittest.TestCase):
    def test_style_changes_are_live_only_for_known_dictionaries(self):
        self.assertEqual(dev.change_kind({"desktop/Styles/Tokens.xaml"}), "styles")
        self.assertEqual(dev.change_kind({"desktop/Styles/Palette.xaml", "desktop/Styles/Controls.xaml"}), "styles")
        self.assertEqual(dev.change_kind({"desktop/MainWindow.xaml"}), "restart")
        self.assertEqual(dev.change_kind({"desktop/Styles/Tokens.xaml", "desktop/Pages/MainWindow.Overview.cs"}), "restart")

    def test_engine_changes_require_a_new_process(self):
        self.assertEqual(dev.change_kind({"src/main/organizer.cjs"}), "restart")
        self.assertEqual(dev.change_kind({"src/native/worker.ps1"}), "restart")

    def test_scanner_ignores_outputs_and_tests_and_detects_same_size_edits(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            source = root / "desktop/Pages/Page.cs"
            source.parent.mkdir(parents=True)
            source.write_text("first")
            for child in ("obj/generated.cs", "bin/old.cs", "Checks/Test.cs", "runtime/file.cs"):
                path = root / "desktop" / child
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("ignored")
            before = dev.scan(root)
            self.assertEqual(set(before), {"desktop/Pages/Page.cs"})
            source.write_text("other")
            self.assertEqual(dev.changed(before, dev.scan(root)), {"desktop/Pages/Page.cs"})

    def test_removed_files_are_changes(self):
        self.assertEqual(dev.changed({"page.cs": "old"}, {}), {"page.cs"})

    def test_atomic_json_can_be_read_and_replaced(self):
        with tempfile.TemporaryDirectory() as name:
            target = Path(name) / "control/command.json"
            dev.atomic_json(target, {"command": "styles", "id": "one"})
            dev.atomic_json(target, {"command": "stop", "id": "two"})
            self.assertEqual(dev.read_json(target), {"command": "stop", "id": "two"})
            self.assertFalse(target.with_suffix(".json.tmp").exists())

    def test_incomplete_json_is_ignored_until_next_poll(self):
        with tempfile.TemporaryDirectory() as name:
            target = Path(name) / "command.json"
            target.write_text('{"id":')
            self.assertEqual(dev.read_json(target), {})


if __name__ == "__main__":
    unittest.main()
