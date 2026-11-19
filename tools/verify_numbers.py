"""
核对视频中出现的所有数字（纯 Python 标准库，无需第三方依赖）。
运行: python3 tools/verify_numbers.py
"""
from decimal import Decimal, getcontext
import math

getcontext().prec = 80
LOG10_3 = Decimal(3).ln() / Decimal(10).ln()

t3 = 3 ** 27                      # 3↑↑3
print("3↑↑3 =", f"{t3:,}")
print("  数到它所需年数(每秒一个):", t3 / (365.25 * 24 * 3600))

# 3↑↑4 = 3^(3↑↑3)
e = Decimal(t3) * LOG10_3         # log10(3↑↑4)
digits4 = int(e) + 1
print("3↑↑4 位数 =", f"{digits4:,}")
frac = e - int(e)
lead = (Decimal(10) ** frac)
print("3↑↑4 开头 =", str(lead)[:20])
print("3↑↑4 结尾 =", str(pow(3, t3, 10 ** 20)).zfill(20))
print("  每位 1mm 的长度(km):", digits4 / 1e6, " 地月距离倍数:", digits4 / 1e6 / 384400)

# 3↑↑5 位数 ≈ 3↑↑4 * log10(3)  -> log10(位数) = log10(3↑↑4) + log10(log10 3)
lg = e + LOG10_3.ln() / Decimal(10).ln()
print("log10(3↑↑5 的位数) ≈", str(lg)[:20])

# 普朗克体积 & 可观测宇宙
lp = 1.616255e-35
R = 4.40e26
Vu = 4 / 3 * math.pi * R ** 3
print("宇宙体积/普朗克体积 ≈ 10^%.2f" % math.log10(Vu / lp ** 3))

# 全息上限: 半径 10 cm 的球
A = 4 * math.pi * 0.1 ** 2
bits = A / (4 * lp ** 2 * math.log(2))
print("10cm 球全息上限 ≈ %.2e bit" % bits)

# 3↑↑↑3 的塔: 每层 1 cm
print("塔高(km):", t3 / 1e5, " / 日地距离:", t3 / 1e5 / 1.496e8)


# ---- 葛立恒数的末尾数字 ----
# G = 3↑↑k (k 极大). 对足够高的塔，3↑↑n mod 10^d 不再随 n 变化。
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


def tower_mod(height, m):
    """3↑↑height mod m（广义欧拉定理）"""
    if m == 1:
        return 0
    if height == 1:
        return 3 % m
    ph = phi(m)
    ex = tower_mod(height - 1, ph)
    return pow(3, ex + ph, m)   # 指数远大于 log2(m)，可加 ph


D = 60
prev = None
for h in range(5, 200):
    v = tower_mod(h, 10 ** D)
    if v == prev:
        print(f"塔高 {h} 起末 {D} 位稳定")
        break
    prev = v
print("G 的末尾 %d 位: ...%s" % (D, str(v).zfill(D)))
