import sys
import subprocess
import math


def screensize():
    """Returns a tuple representing the dimensions of the screen"""
    rows, cols = subprocess.check_output(['stty', 'size']).strip().split()
    return (int(rows), int(cols))


def progress_bar(i):
    """Prints a progress bar for the ith value.
    """
    rows, cols = screensize()
    progress_bar_width = 100 if cols > 110 else (cols - 10)
    delta = progress_bar_width/100.0
    progress = int(math.ceil(i * delta))
    progress_bar = '\r[%-' + str(progress_bar_width) + 's] %3d%%'
    sys.stdout.write(progress_bar % ('#'*progress, i))
    sys.stdout.flush()

if __name__ == '__main__':
    import time
    for i in range(100):
        time.sleep(0.05)
        progress_bar(i+1)
