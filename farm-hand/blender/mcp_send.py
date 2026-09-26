"""Send Python to the running Blender through the Blender MCP addon's socket (localhost:9876), the same
command the MCP server uses (type "execute_code"). Usage: python mcp_send.py script.py"""
import json
import socket
import sys


def send(code, port=9876, timeout=180):
    with socket.create_connection(("localhost", port), timeout=timeout) as s:
        s.sendall(json.dumps({"type": "execute_code", "params": {"code": code}}).encode())
        buf = b""
        while True:
            chunk = s.recv(65536)
            if not chunk:
                break
            buf += chunk
            try:
                return json.loads(buf.decode())
            except json.JSONDecodeError:
                continue
    return json.loads(buf.decode())


if __name__ == "__main__":
    print(json.dumps(send(open(sys.argv[1], encoding="utf-8").read()), indent=1)[:4000])
