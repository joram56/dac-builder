"""Read simple Lua table literals (``_G.name = { ... }``) out of addon_game_mode.lua."""
import re

_TOKEN = re.compile(
    r"""--\[\[.*?\]\]|--[^\n]*|\s+|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|(-?\d+(?:\.\d+)?)|([A-Za-z_][\w.]*)|(\[|\]|\{|\}|=|,|;)""",
    re.S,
)


def _tokens(text):
    for m in _TOKEN.finditer(text):
        dq, sq, num, ident, punct = m.groups()
        if dq is not None or sq is not None:
            yield ("str", dq if dq is not None else sq)
        elif num is not None:
            yield ("num", float(num) if "." in num else int(num))
        elif ident is not None:
            yield ("id", ident)
        elif punct is not None:
            yield ("p", punct)


class _Parser:
    def __init__(self, text):
        self.toks = list(_tokens(text))
        self.i = 0

    def peek(self, k=0):
        return self.toks[self.i + k] if self.i + k < len(self.toks) else (None, None)

    def take(self):
        t = self.toks[self.i]
        self.i += 1
        return t

    def value(self):
        kind, v = self.take()
        if kind == "p" and v == "{":
            return self.table()
        if kind == "id":
            return {"true": True, "false": False, "nil": None}.get(v, ("ref", v))
        return v

    def table(self):
        items, keyed, n = {}, False, 1
        while True:
            kind, v = self.peek()
            if kind == "p" and v == "}":
                self.take()
                break
            if kind == "p" and v in ",;":
                self.take()
                continue
            if kind == "p" and v == "[":
                self.take()
                key = self.value()
                self.take()  # ]
                self.take()  # =
                items[key] = self.value()
                keyed = True
            elif kind == "id" and self.peek(1) == ("p", "="):
                self.take()
                self.take()
                items[v] = self.value()
                keyed = True
            else:
                items[n] = self.value()
                n += 1
        if not keyed and all(isinstance(k, int) for k in items):
            return [items[k] for k in sorted(items)]
        return items


def find_table(source, name):
    """Return the parsed literal assigned to ``_G.<name>`` (first occurrence)."""
    m = re.search(r"_G\." + re.escape(name) + r"\s*=\s*\{", source)
    if not m:
        raise KeyError(name)
    start = m.end() - 1
    depth, i = 0, start
    in_str = None
    while i < len(source):
        c = source[i]
        if in_str:
            if c == "\\":
                i += 1
            elif c == in_str:
                in_str = None
        elif c in "\"'":
            in_str = c
        elif source.startswith("--", i):
            i = source.index("\n", i)
            continue
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                break
        i += 1
    p = _Parser(source[start + 1 : i + 1])
    return p.table()
