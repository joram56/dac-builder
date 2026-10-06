"""Minimal Valve KeyValues parser (handles // comments, unquoted tokens, duplicate keys)."""
import re

_TOKEN = re.compile(r'"((?:[^"\\]|\\.)*)"|(\{)|(\})|//[^\n]*|\s+|([^\s{}"]+)', re.S)


def parse(text):
    """Parse KV text into nested dicts. For duplicate keys the last value wins."""
    root = {}
    stack = [root]
    key = None
    for m in _TOKEN.finditer(text):
        string, open_brace, close_brace, bare = m.groups()
        if string is None and bare is not None:
            string = bare
        if string is not None:
            if key is None:
                key = string
            else:
                stack[-1][key] = string
                key = None
        elif open_brace:
            child = {}
            stack[-1][key] = child
            stack.append(child)
            key = None
        elif close_brace:
            if len(stack) > 1:
                stack.pop()
            key = None
    return root


def load(path):
    with open(path, encoding="utf-8-sig") as f:
        return parse(f.read())
