import signal
import time


signal.signal(signal.SIGTERM, lambda signum, frame: None)

while True:
    time.sleep(0.05)
