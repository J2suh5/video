"""
生成 src/data.js：3↑↑4 的真实开头/结尾数字、葛立恒数的末尾数字。
运行: python3 tools/gen_data.py
"""
from decimal import Decimal, getcontext
import sys, os

sys.setrecursionlimit(10000)
N = 4096
getcontext().prec = N + 60
t3 = 3 ** 27
e = Decimal(t3) * (Decimal(3).ln() / Decimal(10).ln())
frac = e - int(e)
head = str(Decimal(10) ** frac).replace('.', '')[:N]
tail = str(pow(3, t3, 10 ** N)).zfill(N)


def phi(n):
    r, m, p = n, n, 2
    while p * p <= m:
        if m % p == 0:
            while m % p == 0:
                m //= p
            r -= r // p
        p += 1
    if m > 1:
        r -= r // m
    return r


def tower_mod(h, m):
    if m == 1:
        return 0
    if h == 1:
        return 3 % m
    ph = phi(m)
    return pow(3, tower_mod(h - 1, ph) + ph, m)


D = 100
g_tail = str(tower_mod(D + 20, 10 ** D)).zfill(D)
assert g_tail == str(tower_mod(D + 40, 10 ** D)).zfill(D)

out = os.path.join(os.path.dirname(__file__), '..', 'src', 'data.js')
with open(out, 'w') as f:
    f.write('// 由 tools/gen_data.py 生成，请勿手改\n')
    f.write('window.GDATA = {\n')
    f.write(f'  head: "{head}",\n')   # 3↑↑4 的前 4096 位
    f.write(f'  tail: "{tail}",\n')   # 3↑↑4 的后 4096 位
    f.write(f'  gTail: "{g_tail}"\n')  # 葛立恒数的后 100 位
    f.write('};\n')
print(head[:30], '...', tail[-30:])
print('G tail:', g_tail)
