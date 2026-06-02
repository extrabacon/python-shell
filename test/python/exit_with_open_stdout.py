import subprocess
import sys


subprocess.Popen(
    [sys.executable, "-c", "import time; time.sleep(1)"],
    stdout=sys.stdout,
    stderr=sys.stderr,
)
