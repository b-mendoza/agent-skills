#!/usr/bin/env python3
"""Usage: python3 -I validate-settlement.py PID [PID ...]

For owned shell producers only. Read-only liveness check; never cancels work.
Exit 0 if all PIDs are gone, 1 if any is live/unverifiable or input is invalid.
For runtime agents use the runtime's terminal-result/cancellation confirmation.
"""
import os
import sys


def main():
    if len(sys.argv) < 2:
        raise ValueError(__doc__.splitlines()[0])
    for value in sys.argv[1:]:
        pid = int(value)
        if pid <= 0:
            raise ValueError("PID must be positive")
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            continue
        except PermissionError:
            raise ValueError("producer termination cannot be verified: " + value)
        raise ValueError("producer still live: " + value)
    print("SETTLEMENT: PASS")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError) as error:
        print("SETTLEMENT: BLOCKED " + str(error), file=sys.stderr)
        sys.exit(1)
