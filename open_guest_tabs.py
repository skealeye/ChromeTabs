import subprocess
import sys
import os
from shutil import which

def find_chrome():
    #Find Chrome exec on os 
    chrome_cmds = ["google-chrome", "chrome", "chromium", "chromium-browser"]
    for cmd in chrome_cmds:
        if which(cmd):
            return cmd

    if os.name == "nt":
        possible_paths = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
        ]
        for p in possible_paths:
            if os.path.exists(p):
                return p
                
    raise FileNotFoundError("Chrome executable not found.")


def open_chrome_guest_tabs(count, url):
    chrome = find_chrome()

    # First tab: open new window in guest mode
    args = [chrome, "--guest", "--new-window", url]
    subprocess.Popen(args)

    # Additional tabs
    for _ in range(count - 1):
        subprocess.Popen([chrome, url])


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python open_guest_tabs.py <num_tabs> <url>")
        sys.exit(1)

    num_tabs = int(sys.argv[1])
    website = sys.argv[2]

    open_chrome_guest_tabs(num_tabs, website)
    print(f"Opened {num_tabs} tabs in a single Guest Chrome window at {website}")