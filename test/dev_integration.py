"""Targeted Windows/WSL development-loop smoke, using a disposable copy of the project."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("organiza_dev", ROOT / "scripts/dev.py")
dev = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dev)


def wait(predicate, timeout=90):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = predicate()
        if result:
            return result
        time.sleep(.2)
    raise TimeoutError("A transição de desenvolvimento não foi concluída.")


def run(args):
    fixture = Path(tempfile.mkdtemp(prefix="organiza-dev-integration-"))
    log = fixture / "supervisor.log"
    process = None
    count = 0

    def check(value, message):
        nonlocal count
        if not value:
            raise AssertionError(message)
        count += 1
        print("PASS: " + message, flush=True)

    try:
        shutil.copytree(ROOT / "desktop", fixture / "desktop", ignore=shutil.ignore_patterns("bin", "obj", "runtime", "Checks"))
        shutil.copytree(ROOT / "scripts", fixture / "scripts", ignore=shutil.ignore_patterns("__pycache__"))
        for name in ("main", "engine", "native"):
            shutil.copytree(ROOT / "src" / name, fixture / "src" / name)
        runtime = fixture / "desktop/runtime"
        runtime.mkdir()
        os.link(ROOT / "desktop/runtime/node.exe", runtime / "node.exe")
        shutil.copy2(ROOT / "desktop/runtime/LICENSE-Node.txt", runtime / "LICENSE-Node.txt")
        command = ["python3", str(fixture / "scripts/dev.py"), "--root", str(fixture), "--dotnet", str(args.dotnet), "--nuget-cache", str(args.nuget_cache), "--hidden"]
        with log.open("w") as output:
            process = subprocess.Popen(command, stdout=output, stderr=subprocess.STDOUT)
        session_file = fixture / ".dev/session.json"
        def opened():
            if process.poll() is not None:
                raise RuntimeError("O supervisor encerrou antes de abrir o aplicativo.")
            return dev.read_json(session_file)
        first = wait(opened)
        control = Path(first["control"])
        first_pid = first["ready"]["pid"]
        check(first_pid > 0 and first["ready"]["status"]["page"] == "Overview", "Windows opens the Debug app under the WSL supervisor")
        profile = dev.read_json(fixture / ".dev/profile/config.json")
        check(len(profile["folders"]) == 3, "Development creates three example folders in its own persistent profile")
        check(all(".dev" in folder["path"] for folder in profile["folders"]), "Example paths stay inside the disposable project")
        tokens = fixture / "desktop/Styles/Tokens.xaml"
        original = tokens.read_text()
        tokens.write_text(original.replace('x:Key="FontPageTitle">34', 'x:Key="FontPageTitle">36'))
        reply = wait(lambda: (value if (value := dev.read_json(control / "reply.json")).get("status", {}).get("titleSize") == 36 else None))
        check(reply["ok"] and reply["status"]["pid"] == first_pid, "Editing a style updates the real window without a process restart")
        previous_id = reply["id"]
        tokens.write_text("<ResourceDictionary invalid")
        failed = wait(lambda: (value if (value := dev.read_json(control / "reply.json")).get("id") not in (None, previous_id) else None))
        check(not failed["ok"] and failed["status"]["titleSize"] == 36 and failed["status"]["pid"] == first_pid, "Malformed XAML preserves the last working interface and process")
        tokens.write_text(original)
        restored = wait(lambda: (value if (value := dev.read_json(control / "reply.json")).get("status", {}).get("titleSize") == 34 else None))
        check(restored["ok"], "Correcting XAML resumes live updates without relaunching")
        page = fixture / "desktop/Pages/MainWindow.Overview.cs"
        code = page.read_text()
        updated = code.replace("Suas pastas, sob controle.", "Prévia em desenvolvimento.")
        page.write_text(updated)
        second = wait(lambda: (value if (value := dev.read_json(session_file)).get("revision") not in (None, first["revision"]) else None))
        check(second["ready"]["pid"] != first_pid and second["ready"]["status"]["subtitle"] == "Prévia em desenvolvimento.", "C# changes rebuild incrementally and appear after a cooperative restart")
        check((fixture / ".dev/profile/window-state.json").exists() and len(dev.read_json(fixture / ".dev/profile/config.json")["folders"]) == 3, "Restart preserves the development profile and writes the view state")
        page.write_text(updated + "\nthis is invalid C#;\n")
        wait(lambda: "Alteração não aplicada." in log.read_text())
        identity = uuid.uuid4().hex
        dev.atomic_json(control / "command.json", {"id": identity, "command": "status", "revision": second["revision"]})
        status = wait(lambda: (value if (value := dev.read_json(control / "reply.json")).get("id") == identity else None))
        check(status["ok"] and status["status"]["pid"] == second["ready"]["pid"], "A compiler error leaves the last successful window running")
        check("TAP version" not in log.read_text(), "The development loop does not run the full test suite")
        process.send_signal(signal.SIGTERM)
        process.wait(timeout=30)
        check(process.returncode == 0, "Stopping the supervisor closes the app cooperatively")
        print(f"{count} development integration checks passed. Fixture: {fixture}", flush=True)
        destination = ROOT / "outputs/development-validation"
        destination.mkdir(exist_ok=True)
        shutil.copy2(log, destination / "integration.log")
    except Exception:
        print(log.read_text() if log.exists() else "Sem log do supervisor.", flush=True)
        print("Fixture preservada: " + str(fixture), flush=True)
        raise
    finally:
        if process is not None and process.poll() is None:
            process.send_signal(signal.SIGTERM)
            try:
                process.wait(timeout=30)
            except subprocess.TimeoutExpired:
                print("Aguardando fechar o editor/tarefa no aplicativo de teste. Sem encerramento forçado.", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dotnet", type=Path, required=True)
    parser.add_argument("--nuget-cache", type=Path, required=True)
    run(parser.parse_args())
