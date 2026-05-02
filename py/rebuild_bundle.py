#!/usr/bin/env python3
"""
rebuild_bundle.py — 从文件夹重建 bundle.pack

从 Bundel 文件夹收集所有文件，构建 PLPcK 容器 + Pack XOR 加密，写出 bundle.pack。
支持两种模式:
  1. --from-original: 先从原始 bundle.pack 提取条目，用文件夹中的同名文件覆盖 value，保留原始 hash_count 和结构
  2. 默认模式: 纯从文件夹构建，hash_count 从原始 bundle.pack 读取（或手动指定）

用法:
  python rebuild_bundle.py                              # 默认: 从文件夹构建
  python rebuild_bundle.py --from-original              # 安全模式: 基于原始 pack 替换
  python rebuild_bundle.py --hash-count 1024            # 自定义 hash_count
  python rebuild_bundle.py --dry-run                    # 只扫描不写入
"""
import struct, os, sys, time, argparse
import numpy as np

# ═══════════════════════════════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════════════════════════════

# 原始 bundle.pack 路径（用于读取 header / hash_count）
ORIGINAL_BUNDLE = r"F:\Games\ChaosZeroNightmare\bin\bundle.pack"

# 输入：解包后的文件夹
INPUT_DIR = r"G:\keasi\Bundel"

# 输出：重建后的 bundle.pack
OUTPUT_PATH = r"G:\keasi\bundle_rebuilt.pack"

# ═══════════════════════════════════════════════════════════════════════
# Pack XOR 密钥（与 data.pack 完全相同）
# ═══════════════════════════════════════════════════════════════════════
def generate_pack_xor_key():
    seed = 150812
    key = bytearray(129)
    for i in range(129):
        seed = (seed * 1103515245) & 0xFFFFFFFF
        key[i] = (seed >> 16) & 0xFF
    return bytes(key)

PACK_XOR_KEY = generate_pack_xor_key()
_PACK_XOR_NP = np.frombuffer(PACK_XOR_KEY, dtype=np.uint8)

def _fast_xor(data: bytes, key_np: np.ndarray, offset: int) -> bytes:
    n = len(data)
    if n == 0: return data
    arr = np.frombuffer(data, dtype=np.uint8).copy()
    key_len = len(key_np)
    start_phase = offset % key_len
    repeats = (n + start_phase + key_len - 1) // key_len + 1
    key_stream = np.tile(key_np, repeats)[start_phase:start_phase + n]
    arr ^= key_stream
    return arr.tobytes()

def pack_xor_encrypt(data: bytes, file_offset: int) -> bytes:
    return _fast_xor(data, _PACK_XOR_NP, file_offset)

def pack_xor_decrypt(data: bytes, file_offset: int) -> bytes:
    return _fast_xor(data, _PACK_XOR_NP, file_offset)

# ═══════════════════════════════════════════════════════════════════════
# PLPcK 哈希函数（与 data.pack 完全相同）
# ═══════════════════════════════════════════════════════════════════════
def cdbm_hash(key_bytes: bytes) -> int:
    h = 0
    for b in key_bytes:
        ch = b + 32 if 65 <= b <= 90 else b
        h = (ch + 43 * h) & 0xFFFFFFFF
    return h

# ═══════════════════════════════════════════════════════════════════════
# 从原始 bundle.pack 读取 header 信息
# ═══════════════════════════════════════════════════════════════════════
def read_original_header(bundle_path):
    """读取原始 bundle.pack 的 38B header + 5B version，返回 (header_38, ver_5, hash_count)"""
    with open(bundle_path, 'rb') as f:
        raw_header = f.read(43)
    dec = pack_xor_decrypt(raw_header, 0)
    magic = dec[:5]
    if magic != b'PLPcK':
        raise ValueError(f"原始 bundle.pack 不是 PLPcK 格式! Magic: {magic}")
    hash_count = struct.unpack_from('<I', dec, 21)[0]
    header_38 = dec[:38]
    ver_5 = dec[38:43]
    return header_38, ver_5, hash_count

# ═══════════════════════════════════════════════════════════════════════
# 从原始 bundle.pack 提取全部条目
# ═══════════════════════════════════════════════════════════════════════
def extract_entries_from_pack(bundle_path):
    """从原始 bundle.pack 提取全部 PackEntry + 尾部数据"""
    with open(bundle_path, 'rb') as f:
        raw_all = f.read()
    total_size = len(raw_all)

    # 解密整个文件（bundle.pack 通常只有几十MB，可以一次性处理）
    dec_all = pack_xor_decrypt(raw_all, 0)

    magic = dec_all[:5]
    assert magic == b'PLPcK', f"不是 PLPcK: {magic}"
    hash_count = struct.unpack_from('<I', dec_all, 21)[0]
    header_38 = dec_all[:38]
    ver_5 = dec_all[38:43]

    # 读哈希表
    ht_start = 43
    entries = []
    seen = set()
    max_end = ht_start + hash_count * 5  # 记录 chunk 数据的最大结束位置

    for bi in range(hash_count):
        off = ht_start + bi * 5
        ptr_hi = dec_all[off]
        ptr_lo = struct.unpack_from('<I', dec_all, off + 1)[0]
        chain = ptr_lo + (ptr_hi << 32)
        if chain == 0:
            continue

        safety = 0
        while chain > 0 and chain + 15 <= total_size and safety < 1000:
            safety += 1
            if chain in seen:
                break
            seen.add(chain)

            data_size = struct.unpack_from('<I', dec_all, chain)[0]
            flags = dec_all[chain + 4]
            key_length = dec_all[chain + 5]
            value_size = struct.unpack_from('<I', dec_all, chain + 6)[0]
            next_hi = dec_all[chain + 10]
            next_lo = struct.unpack_from('<I', dec_all, chain + 11)[0]
            next_ptr = next_lo + (next_hi << 32)

            if data_size == 0 or key_length == 0:
                break

            cdata_off = chain + 15
            key_data = dec_all[cdata_off:cdata_off + key_length]
            value_data = dec_all[cdata_off + key_length:cdata_off + key_length + value_size]

            # 检查是否有 meta
            meta_size = data_size - key_length - value_size - 15
            meta_data = b''
            if meta_size > 0:
                meta_data = dec_all[cdata_off + key_length + value_size:cdata_off + key_length + value_size + meta_size]

            # 追踪 chunk 数据区域的最大结束位置
            chunk_end = chain + 15 + key_length + value_size + max(0, meta_size)
            if chunk_end > max_end:
                max_end = chunk_end

            entries.append({
                'key': key_data,
                'value': value_data,
                'flags': flags,
                'meta': meta_data,
            })

            if next_ptr == 0 or next_ptr == chain:
                break
            chain = next_ptr

    # 提取尾部数据（chunk 结束后到文件末尾的填充）
    trailing_data = dec_all[max_end:] if max_end < total_size else b''
    if trailing_data:
        print(f"  ℹ 发现 {len(trailing_data)} 字节尾部填充数据")

    return entries, header_38, ver_5, hash_count, trailing_data

# ═══════════════════════════════════════════════════════════════════════
# 从文件夹收集文件
# ═══════════════════════════════════════════════════════════════════════
def collect_files_from_folder(folder_path):
    """递归扫描文件夹，返回 (相对路径key, 文件内容) 列表"""
    file_list = []
    folder_path = os.path.normpath(folder_path)
    for root, dirs, files in os.walk(folder_path):
        for fname in files:
            full_path = os.path.join(root, fname)
            rel_path = os.path.relpath(full_path, folder_path)
            # PLPcK 内部统一用正斜杠
            key = rel_path.replace('\\', '/')
            with open(full_path, 'rb') as f:
                content = f.read()
            file_list.append((key, content))
    return file_list

# ═══════════════════════════════════════════════════════════════════════
# 构建 PLPcK + Pack XOR 加密 → 写出 bundle.pack
# ═══════════════════════════════════════════════════════════════════════
def build_bundle(entries, header_38, ver_5, hash_count, output_path, trailing_data=b''):
    """
    entries: list of dict with keys: key(bytes), value(bytes), flags(int), meta(bytes)
    trailing_data: 原始文件末尾的填充数据（可选）
    """
    print(f"  hash_count = {hash_count:,}, 条目数 = {len(entries):,}")

    # Pass 1: 分桶 + 预计算偏移
    buckets = {}
    for i, entry in enumerate(entries):
        bucket = cdbm_hash(entry['key']) % hash_count
        buckets.setdefault(bucket, []).append(i)

    non_empty = len(buckets)
    max_chain = max(len(v) for v in buckets.values()) if buckets else 0
    print(f"  非空桶: {non_empty:,}, 最长链: {max_chain}")

    fixed_area = 38 + 5 + hash_count * 5
    hash_table = bytearray(hash_count * 5)
    chunk_plan = []  # (entry_index, expected_offset, next_offset)
    running_offset = fixed_area

    for bi in sorted(buckets.keys()):
        entry_indices = buckets[bi]
        first_offset = running_offset

        ht_off = bi * 5
        hash_table[ht_off] = (first_offset >> 32) & 0xFF
        struct.pack_into('<I', hash_table, ht_off + 1, first_offset & 0xFFFFFFFF)

        for ci, ei in enumerate(entry_indices):
            entry = entries[ei]
            chunk_total = 15 + len(entry['key']) + len(entry['value']) + len(entry['meta'])
            current = running_offset
            next_off = (current + chunk_total) if ci < len(entry_indices) - 1 else 0
            chunk_plan.append((ei, current, next_off))
            running_offset += chunk_total

    total_size = running_offset + len(trailing_data)
    print(f"  预计总大小: {total_size:,} 字节 ({total_size / 1024 / 1024:.1f} MB)")
    if trailing_data:
        print(f"  包含 {len(trailing_data)} 字节尾部填充")

    # Pass 2: 组装明文
    print(f"  组装明文数据...")
    plaintext = bytearray()
    plaintext.extend(header_38)
    plaintext.extend(ver_5)
    plaintext.extend(hash_table)

    for plan_idx, (ei, expected_offset, next_off) in enumerate(chunk_plan):
        assert len(plaintext) == expected_offset, \
            f"偏移不匹配: {len(plaintext)} != {expected_offset}"

        entry = entries[ei]
        kd = entry['key']
        vd = entry['value']
        md = entry['meta']
        kl = len(kd); vs = len(vd); ms = len(md)

        hdr = bytearray(15)
        struct.pack_into('<I', hdr, 0, kl + vs + 15 + ms)
        hdr[4] = entry['flags']
        hdr[5] = kl & 0xFF
        struct.pack_into('<I', hdr, 6, vs)
        hdr[10] = (next_off >> 32) & 0xFF
        struct.pack_into('<I', hdr, 11, next_off & 0xFFFFFFFF)

        plaintext.extend(hdr)
        plaintext.extend(kd)
        plaintext.extend(vd)
        if ms > 0:
            plaintext.extend(md)

    # 追加尾部填充
    if trailing_data:
        plaintext.extend(trailing_data)

    assert len(plaintext) == total_size

    # Pass 3: Pack XOR 加密
    print(f"  Pack XOR 加密...")
    encrypted = pack_xor_encrypt(bytes(plaintext), 0)

    # 验证: 解密头部检查 PLPcK
    verify_head = pack_xor_decrypt(encrypted[:5], 0)
    assert verify_head == b'PLPcK', f"加密验证失败: {verify_head}"

    # Pass 4: 写出
    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
    with open(output_path, 'wb') as f:
        f.write(encrypted)

    print(f"  ✅ 写入完成: {output_path}")
    print(f"     大小: {len(encrypted):,} 字节 ({len(encrypted)/1024/1024:.1f} MB)")

    return total_size

# ═══════════════════════════════════════════════════════════════════════
# 验证
# ═══════════════════════════════════════════════════════════════════════
def verify_bundle(output_path, expected_entries):
    print(f"  验证 {output_path}...")
    with open(output_path, 'rb') as f:
        raw = f.read()

    dec = pack_xor_decrypt(raw[:43], 0)
    assert dec[:5] == b'PLPcK', f"PLPcK magic 不匹配: {dec[:5]}"
    hash_count = struct.unpack_from('<I', dec, 21)[0]
    print(f"  ✅ PLPcK valid, hash_count = {hash_count:,}")

    # 遍历计数
    ht_data = pack_xor_decrypt(raw[43:43 + hash_count * 5], 43)
    total = 0
    for bi in range(hash_count):
        off5 = bi * 5
        fo = struct.unpack_from('<I', ht_data, off5 + 1)[0] + (ht_data[off5] << 32)
        if fo == 0:
            continue
        chain = fo
        safety = 0
        while chain > 0 and chain + 15 <= len(raw) and safety < 1000:
            safety += 1
            ch = pack_xor_decrypt(raw[chain:chain + 15], chain)
            ds = struct.unpack_from('<I', ch, 0)[0]
            if ds == 0 or ch[5] == 0:
                break
            total += 1
            np_ = struct.unpack_from('<I', ch, 11)[0] + (ch[10] << 32)
            if np_ == 0 or np_ == chain:
                break
            chain = np_

    ok = total == len(expected_entries)
    print(f"  {'✅' if ok else '❌'} 条目数: {total} / {len(expected_entries)}")

    # 抽样验证几个文件
    import random
    sample_indices = random.sample(range(len(expected_entries)), min(20, len(expected_entries)))
    matches = 0
    for idx in sample_indices:
        orig = expected_entries[idx]
        bucket = cdbm_hash(orig['key']) % hash_count
        off5 = bucket * 5
        chain = struct.unpack_from('<I', ht_data, off5 + 1)[0] + (ht_data[off5] << 32)
        while chain > 0 and chain + 15 <= len(raw):
            ch = pack_xor_decrypt(raw[chain:chain + 15], chain)
            kl = ch[5]
            vs = struct.unpack_from('<I', ch, 6)[0]
            key = pack_xor_decrypt(raw[chain + 15:chain + 15 + kl], chain + 15)
            if key == orig['key']:
                val = pack_xor_decrypt(raw[chain + 15 + kl:chain + 15 + kl + vs], chain + 15 + kl)
                if val == orig['value']:
                    matches += 1
                else:
                    try:
                        kn = key.decode('utf-8', errors='replace')
                    except:
                        kn = key.hex()
                    print(f"  ⚠ value 不匹配: {kn}")
                break
            np_ = struct.unpack_from('<I', ch, 11)[0] + (ch[10] << 32)
            if np_ == 0 or np_ == chain:
                break
            chain = np_

    print(f"  ✅ 采样验证: {matches}/{len(sample_indices)} 匹配")
    return ok

# ═══════════════════════════════════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(description='从文件夹重建 bundle.pack')
    parser.add_argument('--input', default=INPUT_DIR, help='输入文件夹路径')
    parser.add_argument('--output', default=OUTPUT_PATH, help='输出 bundle.pack 路径')
    parser.add_argument('--original', default=ORIGINAL_BUNDLE, help='原始 bundle.pack 路径')
    parser.add_argument('--hash-count', type=int, default=0, help='自定义 hash_count（0=从原始pack读取）')
    parser.add_argument('--from-original', action='store_true',
                        help='安全模式: 从原始 pack 提取条目，只替换文件夹中存在的文件')
    parser.add_argument('--dry-run', action='store_true', help='只扫描不写入')
    parser.add_argument('--no-verify', action='store_true', help='跳过验证')
    args = parser.parse_args()

    t0 = time.time()

    print("=" * 70)
    print("  bundle.pack 重建工具 — ChaosZero Nightmare")
    print("=" * 70)

    # ─── 读取原始 header ───
    if os.path.exists(args.original):
        print(f"\n  读取原始 bundle.pack header...")
        header_38, ver_5, orig_hash_count = read_original_header(args.original)
        print(f"  ✅ 原始 hash_count = {orig_hash_count:,}")
    else:
        print(f"\n  ⚠ 原始 bundle.pack 不存在: {args.original}")
        header_38 = None
        ver_5 = None
        orig_hash_count = 0

    hash_count = args.hash_count if args.hash_count > 0 else orig_hash_count
    if hash_count == 0:
        print("  ❌ 无法确定 hash_count! 请用 --hash-count 指定，或提供原始 bundle.pack")
        sys.exit(1)

    # ─── 模式选择 ───
    if args.from_original:
        # 安全模式：从原始 pack 提取，替换文件夹中的文件
        print(f"\n{'='*70}")
        print(f"  模式: 安全替换 (从原始 pack 提取 → 用文件夹覆盖)")
        print(f"{'='*70}")

        print(f"\n  Step 1: 从原始 bundle.pack 提取全部条目...")
        pack_entries, header_38, ver_5, hash_count, trailing_data = extract_entries_from_pack(args.original)
        print(f"  ✅ 提取 {len(pack_entries):,} 个条目")

        print(f"\n  Step 2: 扫描文件夹 {args.input}...")
        folder_files = collect_files_from_folder(args.input)
        print(f"  ✅ 文件夹中 {len(folder_files):,} 个文件")

        # 建立文件夹文件的 key → content 映射
        folder_map = {key.encode('utf-8'): content for key, content in folder_files}

        # 替换
        replaced = 0
        for entry in pack_entries:
            if entry['key'] in folder_map:
                old_size = len(entry['value'])
                entry['value'] = folder_map[entry['key']]
                new_size = len(entry['value'])
                try:
                    kn = entry['key'].decode('utf-8')
                except:
                    kn = entry['key'].hex()
                if old_size != new_size:
                    print(f"    替换: {kn} ({old_size:,} → {new_size:,} 字节)")
                else:
                    print(f"    替换: {kn} ({new_size:,} 字节, 大小不变)")
                replaced += 1

        # 检查文件夹中有但 pack 中没有的文件
        pack_keys = {e['key'] for e in pack_entries}
        for key_bytes in folder_map:
            if key_bytes not in pack_keys:
                try:
                    kn = key_bytes.decode('utf-8')
                except:
                    kn = key_bytes.hex()
                print(f"    ⚠ 新增文件（不在原始pack中）: {kn}")
                pack_entries.append({
                    'key': key_bytes,
                    'value': folder_map[key_bytes],
                    'flags': 2,
                    'meta': b'',
                })

        print(f"\n  ✅ 替换 {replaced} 个文件")
        entries = pack_entries
        # trailing_data 已在 extract_entries_from_pack 中获取
        # trailing_data 已设置
    else:
        trailing_data = b''  # 纯文件夹模式无尾部数据
        # 纯文件夹模式
        print(f"\n{'='*70}")
        print(f"  模式: 从文件夹完整构建")
        print(f"{'='*70}")

        print(f"\n  Step 1: 扫描文件夹 {args.input}...")
        folder_files = collect_files_from_folder(args.input)
        print(f"  ✅ 文件夹中 {len(folder_files):,} 个文件")

        # 排除 .vscode 等非游戏文件
        skip_prefixes = ['.vscode/', '.git/', '__pycache__/']
        filtered = []
        skipped = 0
        for key, content in folder_files:
            if any(key.startswith(p) or ('/' + p) in key for p in skip_prefixes):
                skipped += 1
                continue
            filtered.append((key, content))
        if skipped:
            print(f"  跳过 {skipped} 个非游戏文件")

        print(f"\n  文件列表:")
        total_bytes = 0
        for key, content in sorted(filtered):
            sz = len(content)
            total_bytes += sz
            unit = 'B'
            szf = float(sz)
            if szf > 1024: szf, unit = szf/1024, 'KB'
            if szf > 1024: szf, unit = szf/1024, 'MB'
            print(f"    {szf:>8.1f} {unit:2s}  {key}")
        print(f"  总计: {len(filtered)} 个文件, {total_bytes:,} 字节")

        # 构建 header（如果没有原始的就自己造一个）
        if header_38 is None:
            print(f"\n  ⚠ 没有原始 header，构建默认 PLPcK header (hash_count={hash_count})")
            header_38 = bytearray(38)
            header_38[0:5] = b'PLPcK'
            struct.pack_into('<H', header_38, 6, 38)  # header_size
            struct.pack_into('<I', header_38, 21, hash_count)

            ver_5 = bytearray(5)
            struct.pack_into('<I', ver_5, 0, 5 * (hash_count + 1))
            ver_5[4] = 1

        entries = []
        for key, content in filtered:
            entries.append({
                'key': key.encode('utf-8'),
                'value': content,
                'flags': 2,
                'meta': b'',
            })

    if args.dry_run:
        print(f"\n  [DRY RUN] 不写入，退出")
        return

    # ─── 构建 ───
    print(f"\n{'='*70}")
    print(f"  构建 bundle.pack")
    print(f"{'='*70}")
    total_size = build_bundle(entries, header_38, ver_5, hash_count, args.output, trailing_data)

    # ─── 验证 ───
    if not args.no_verify:
        print(f"\n{'='*70}")
        print(f"  验证")
        print(f"{'='*70}")
        verify_bundle(args.output, entries)

    elapsed = time.time() - t0
    print(f"\n{'='*70}")
    print(f"  ✅ 完成! 耗时 {elapsed:.1f}s")
    print(f"  输出: {args.output}")
    print(f"  大小: {total_size:,} 字节 ({total_size/1024/1024:.1f} MB)")
    print(f"  条目: {len(entries):,} 个文件")
    print(f"{'='*70}")


if __name__ == '__main__':
    main()
