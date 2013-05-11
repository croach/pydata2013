import sys
import subprocess
import math


def screensize():
    """Returns the dimensions of the screen

    Returns:
    a tuple, of the format (rows, columns), representing the dimensions of the
    screen
    """
    rows, cols = subprocess.check_output(['stty', 'size']).strip().split()
    return (int(rows), int(cols))


def progress_bar(i):
    """Prints a progress bar for the ith value.
    """
    # The offset is the size needed to display the bounding square brackets,
    # the percentage, and a little bit of padding (e.g., [###...] 3%)
    offset = 10
    rows, cols = screensize()
    # Try to display 1 hash mark for each percent complete if the screen width
    # allows, otherwise, adjust the progress bar's width accordingly
    progress_bar_width = 100 if cols > (100 + offset) else (cols - offset)
    # Calculate the current progress (i.e., the number of hash marks to show)
    # based on the adjusted progress bar width the current ith value
    progress = int(math.ceil(i * (progress_bar_width/100.0)))
    # Draw the new progress bar, overwriting the previous one
    progress_bar = '\r[%-' + str(progress_bar_width) + 's] %3d%%'
    sys.stdout.write(progress_bar % ('#'*progress, i))
    sys.stdout.flush()

if __name__ == '__main__':
    import time
    for i in range(100):
        time.sleep(0.05)
        progress_bar(i+1)
