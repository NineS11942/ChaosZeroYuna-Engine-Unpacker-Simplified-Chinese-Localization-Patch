#!/usr/bin/env python3
"""
data.pack 完整重建 — KO→ZHT 替换版
从 KO text.db 提取文本 → 应用 TSV 中文翻译 → 加密后放入 ZHT 的位置

流程:
  1. 从 data.pack 提取全部 68,915 个文件条目
  2. 定位 text/ko/text.db → 解密 → 解析 → 应用 TSV → 重建 → 加密
  3. 将重建后的加密数据替换到 text/zht/text.db 条目的 value 中
  4. KO 保持不变
  5. 重建外层 PLPcK + Pack XOR + 多卷写出
"""
import struct, os, sys, time, random
import numpy as np

# ═══════════════════════════════════════════════════════════════════════
# 配置 — 使用前请根据自己的环境修改以下路径
# ═══════════════════════════════════════════════════════════════════════

# 游戏数据包目录：包含 data.pack / data.pack~1 / data.pack~2 / data.pack~3 四个分卷文件
# 通常位于游戏安装目录下 bin\appdata\cznlive\
PACK_DIR    = r"F:\Games\ChaosZeroNightmare\bin\appdata\cznlive"

# 输出目录：重建后的 data.pack 文件将写入此目录（会自动创建）
OUTPUT_DIR  = r"F:\anti 汉化\kaesi\bin_full_rebuild"

# TSV 翻译文件：包含中文翻译的制表符分隔文件（第1列=文本ID，第2列=中文翻译）
# 此文件由翻译流程生成，约 8MB / 10 万条翻译
TSV_PATH    = r"G:\keasi\text_ko_text.tsv"

# 游戏内文本数据库的索引键名（不要修改）
KO_DB_KEY   = b'text/ko/text.db'    # 韩文原文文本数据库
ZHT_DB_KEY  = b'text/zht/text.db'   # 繁体中文文本数据库（汉化目标位置）

# 单个分卷文件的最大大小（1 GB），与游戏原始分卷大小一致（不要修改）
VOLUME_SIZE = 1073741824  # 1 GB per volume

T2S_MODE = False


# ═══════════════════════════════════════════════════════════════════════
# 密钥与加密
# ═══════════════════════════════════════════════════════════════════════
def generate_pack_xor_key():
    seed = 150812
    key = bytearray(129)
    for i in range(129):
        seed = (seed * 1103515245) & 0xFFFFFFFF
        key[i] = (seed >> 16) & 0xFF
    return bytes(key)

PACK_XOR_KEY = generate_pack_xor_key()

INNER_XOR_KEY = bytes([
    0x91, 0xae, 0x4e, 0xd4, 0x64, 0x4f, 0x58, 0x51, 0x62, 0xec, 0x1b, 0xd5, 0xef, 0x24, 0xad, 0xdb,
    0xaf, 0x83, 0x82, 0x42, 0xae, 0xf5, 0x1e, 0x97, 0x80, 0x4b, 0x13, 0x4f, 0xfd, 0x8c, 0xe5, 0xbb,
    0x4f, 0x6e, 0x3e, 0x64, 0x51, 0x14, 0x7c, 0xdf, 0x56, 0xc3, 0x18, 0xe5, 0xe9, 0x64, 0xc9, 0x99,
    0xc0, 0xd9, 0x5c, 0xc8, 0x60, 0x82, 0x2e, 0x6b, 0x41, 0x8b, 0xe4, 0x65, 0xd7, 0x9a, 0x03, 0x6d,
    0xbf, 0x67, 0xab, 0x3d, 0xa7, 0x2a, 0xb1, 0x02, 0x3a, 0x45, 0x61, 0xf4, 0x44, 0xe5, 0xce, 0x85,
    0x8d, 0x23, 0xea, 0x10, 0xfe, 0xb4, 0x89, 0x91, 0x51, 0xad, 0x7e, 0x43, 0xff, 0x3e, 0x24, 0x19,
    0xa9, 0x7b, 0x4d, 0xd3, 0xaf, 0x4e, 0xf5, 0xc8, 0x29, 0xe5, 0xaf, 0x4a, 0xce, 0x94, 0x36, 0xf6,
    0xb6, 0xb6, 0x38, 0x2e, 0x9d, 0xfd, 0x26, 0x64, 0x20, 0x99, 0x01, 0x1a, 0x48, 0x99, 0x08, 0x9c,
    0x9d, 0x4b, 0x9f, 0x80, 0xbb, 0xb0, 0x0a, 0x4c, 0xc7, 0x32, 0x55, 0xce, 0x1f, 0x78, 0x64, 0x6e,
    0x91, 0xc9, 0xc1, 0x23, 0x13, 0xf5, 0xd8, 0x40, 0xdc, 0x51, 0x45, 0x70, 0x10, 0xd3, 0x7d, 0x19,
    0x61, 0x5b, 0xb6, 0x98, 0x88, 0xb4, 0x2b, 0x19, 0xe7, 0x49, 0xf9, 0x93, 0xc0, 0x03, 0x37, 0xe9,
    0x33, 0x2f, 0x89, 0xb3, 0x20, 0xc1, 0x73, 0xa5, 0x65, 0x38, 0x48, 0x78, 0x87, 0x98, 0xa7, 0x71,
    0x73, 0x9e, 0x72, 0xdb, 0xc8, 0x4c, 0x79, 0x46, 0x59, 0x71, 0x49, 0xbd, 0xda, 0xe4, 0xe3, 0xbd,
    0x1a, 0x17, 0x85, 0x6c, 0x85, 0xa5, 0x55, 0xcf, 0xa2, 0x4f, 0x63, 0x52, 0xd0, 0x05, 0x93, 0x3b,
    0x50, 0x04, 0x2b, 0xe0, 0xba, 0x4c, 0x70, 0x8d, 0xe8, 0xeb, 0xb5, 0x20, 0x59, 0xb2, 0x05, 0x9c,
    0x9b, 0xfe, 0x90, 0xd8, 0x92, 0x3d, 0xf7, 0x4b, 0x43, 0x91, 0x1b, 0xbc, 0x00, 0xbb, 0x6b, 0xfa,
])

_PACK_XOR_NP = np.frombuffer(PACK_XOR_KEY, dtype=np.uint8)
_INNER_XOR_NP = np.frombuffer(INNER_XOR_KEY, dtype=np.uint8)

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

def inner_xor_crypt(data, base_offset):
    return _fast_xor(data, _INNER_XOR_NP, base_offset)

def find_inner_xor_offset(data_head):
    for boff in range(256):
        d5 = bytes([data_head[i] ^ INNER_XOR_KEY[(i + boff) % 256] for i in range(min(5, len(data_head)))])
        if d5 == b'PLPcK':
            return boff
    return None

def pack_xor_crypt(data, file_offset):
    return _fast_xor(data, _PACK_XOR_NP, file_offset)

# ═══════════════════════════════════════════════════════════════════════
# 哈希函数
# ═══════════════════════════════════════════════════════════════════════
def cdbm_hash(key_bytes):
    h = 0
    for b in key_bytes:
        ch = b + 32 if 65 <= b <= 90 else b
        h = (ch + 43 * h) & 0xFFFFFFFF
    return h

# ═══════════════════════════════════════════════════════════════════════
# 多卷 Pack 读取器
# ═══════════════════════════════════════════════════════════════════════
class MultiVolumePack:
    def __init__(self, base_dir):
        self.volumes = []
        pack_base = os.path.join(base_dir, "data.pack")
        if not os.path.exists(pack_base):
            raise FileNotFoundError(f"data.pack not found in {base_dir}")
        sz = os.path.getsize(pack_base)
        self.volumes.append((pack_base, 0, sz))
        cumulative = sz
        n = 1
        while True:
            vpath = f"{pack_base}~{n}"
            if not os.path.exists(vpath): break
            sz = os.path.getsize(vpath)
            self.volumes.append((vpath, cumulative, sz))
            cumulative += sz
            n += 1
        self.total_size = cumulative
        self._handles = {}

    def _get_handle(self, vol_idx):
        if vol_idx not in self._handles:
            self._handles[vol_idx] = open(self.volumes[vol_idx][0], 'rb')
        return self._handles[vol_idx]

    def read_raw(self, global_offset, size):
        result = bytearray()
        remaining = size
        offset = global_offset
        for i, (path, start, vol_size) in enumerate(self.volumes):
            if offset >= start + vol_size: continue
            if offset < start: continue
            local_off = offset - start
            can_read = min(remaining, vol_size - local_off)
            fh = self._get_handle(i)
            fh.seek(local_off)
            data = fh.read(can_read)
            if len(data) < can_read:
                raise IOError(f"Short read at vol {i}")
            result.extend(data)
            remaining -= len(data)
            offset += len(data)
            if remaining <= 0: break
        if remaining > 0:
            raise IOError(f"Could not read {size} bytes at offset {global_offset}")
        return bytes(result)

    def read_xor(self, global_offset, size):
        raw = self.read_raw(global_offset, size)
        return _fast_xor(raw, _PACK_XOR_NP, global_offset)

    def close(self):
        for fh in self._handles.values(): fh.close()
        self._handles.clear()

# ═══════════════════════════════════════════════════════════════════════
# 数据结构
# ═══════════════════════════════════════════════════════════════════════
class PackEntry:
    __slots__ = ['key', 'value', 'flags', 'meta']
    def __init__(self, key, value, flags, meta=b''):
        self.key = key; self.value = value; self.flags = flags; self.meta = meta

class TextEntry:
    __slots__ = ['key_bytes', 'value_bytes', 'flags', 'is_meta']
    def __init__(self, key_bytes, value_bytes, flags):
        self.key_bytes = key_bytes; self.value_bytes = value_bytes
        self.flags = flags; self.is_meta = key_bytes.startswith(b'\t')

# ═══════════════════════════════════════════════════════════════════════
# STEP 1: 提取全部文件
# ═══════════════════════════════════════════════════════════════════════
def extract_all_files(pack_dir):
    pack = MultiVolumePack(pack_dir)
    print(f"  Pack: {len(pack.volumes)} 卷, 总计 {pack.total_size:,} 字节 ({pack.total_size/1024**3:.2f} GB)")

    hdr = pack.read_xor(0, 38)
    assert hdr[:5] == b'PLPcK'
    hash_count = struct.unpack_from('<I', hdr, 21)[0]
    print(f"  hash_count = {hash_count:,}")

    ver5 = pack.read_xor(38, 5)
    assert ver5[4] == 1
    assert struct.unpack_from('<I', ver5, 0)[0] == 5 * (hash_count + 1)

    ht_data = pack.read_xor(43, hash_count * 5)

    entries = []
    last_report = time.time()

    for bi in range(hash_count):
        now = time.time()
        if now - last_report > 5:
            print(f"  ... 扫描桶 {bi:,}/{hash_count:,} ({bi*100//hash_count}%, {len(entries):,} 条目)")
            last_report = now

        off5 = bi * 5
        ptr_hi = ht_data[off5]
        ptr_lo = struct.unpack_from('<I', ht_data[off5+1:off5+5])[0]
        file_offset = ptr_lo + (ptr_hi << 32)
        if file_offset == 0: continue

        chain_offset = file_offset
        safety = 0
        while chain_offset > 0 and chain_offset + 15 <= pack.total_size and safety < 1000:
            safety += 1
            chunk_hdr = pack.read_xor(chain_offset, 15)
            data_size   = struct.unpack_from('<I', chunk_hdr, 0)[0]
            flags       = chunk_hdr[4]
            key_length  = chunk_hdr[5]
            value_size  = struct.unpack_from('<I', chunk_hdr, 6)[0]
            next_hi     = chunk_hdr[10]
            next_lo     = struct.unpack_from('<I', chunk_hdr, 11)[0]
            next_ptr    = next_lo + (next_hi << 32)

            if data_size == 0 or key_length == 0: break
            if data_size > 200_000_000:
                print(f"  ⚠ 跳过异常 chunk @ 0x{chain_offset:X}: data_size={data_size}")
                break

            meta_size = data_size - key_length - value_size - 15
            if meta_size < 0: meta_size = 0
            total_read = key_length + value_size + meta_size
            kv_data = pack.read_xor(chain_offset + 15, total_read)
            key_data = kv_data[:key_length]
            value_data = kv_data[key_length:key_length + value_size]
            meta_data = kv_data[key_length + value_size:] if meta_size > 0 else b''

            entries.append(PackEntry(key_data, value_data, flags, meta_data))

            if next_ptr == 0 or next_ptr == chain_offset: break
            chain_offset = next_ptr

    pack.close()
    print(f"  提取完成: {len(entries):,} 个文件条目")
    return entries, hdr, ver5, hash_count


# ═══════════════════════════════════════════════════════════════════════
# STEP 2: KO text.db → 解析 + TSV 替换 → 重建 → 塞入 ZHT 槽位
# ═══════════════════════════════════════════════════════════════════════
def process_ko_to_zht(entries, tsv_path):
    """
    读 KO text.db → 解密 → 解析内层 PLPcK → 应用 TSV → 重建 → 加密
    → 替换 ZHT text.db 条目的 value
    KO 条目本身保持不变
    """
    # 找 KO 和 ZHT
    ko_idx = zht_idx = None
    for i, e in enumerate(entries):
        if e.key == KO_DB_KEY: ko_idx = i
        if e.key == ZHT_DB_KEY: zht_idx = i
    
    if ko_idx is None:
        print(f"  ❌ 未找到 {KO_DB_KEY.decode()}")
        sys.exit(1)
    if zht_idx is None:
        print(f"  ❌ 未找到 {ZHT_DB_KEY.decode()}")
        sys.exit(1)
    
    print(f"  ✅ KO entry[{ko_idx}]: value={len(entries[ko_idx].value):,} B")
    print(f"  ✅ ZHT entry[{zht_idx}]: value={len(entries[zht_idx].value):,} B")

    # 2.1 解密 KO 内层
    ko_raw = entries[ko_idx].value
    ko_inner_off = find_inner_xor_offset(ko_raw[:64])
    if ko_inner_off is None:
        print("  ❌ KO Inner XOR offset 检测失败!")
        sys.exit(1)
    print(f"  KO Inner XOR offset = {ko_inner_off}")

    ko_decrypted = inner_xor_crypt(ko_raw, ko_inner_off)
    assert ko_decrypted[:5] == b'PLPcK', f"KO 解密失败: {ko_decrypted[:5].hex()}"
    print(f"  ✅ KO 解密成功, 大小 = {len(ko_decrypted):,}")

    # 2.2 解析内层 PLPcK
    inner_hash_count = struct.unpack_from('<I', ko_decrypted, 21)[0]
    inner_header_38 = ko_decrypted[:38]
    inner_ver_5 = ko_decrypted[38:43]
    print(f"  内层 hash_count = {inner_hash_count:,}")

    ht_start = 43
    text_buckets = {}
    total_parsed = 0

    for bi in range(inner_hash_count):
        off = ht_start + bi * 5
        oh = ko_decrypted[off]
        ol = struct.unpack_from('<I', ko_decrypted, off + 1)[0]
        fo = ol + (oh << 32)
        if fo == 0: continue

        chain = fo
        bucket_list = []
        safety = 0
        while chain > 0 and chain + 15 <= len(ko_decrypted) and safety < 5000:
            safety += 1
            ds = struct.unpack_from('<I', ko_decrypted, chain)[0]
            flags = ko_decrypted[chain + 4]
            kl = ko_decrypted[chain + 5]
            vs = struct.unpack_from('<I', ko_decrypted, chain + 6)[0]
            nh = ko_decrypted[chain + 10]
            nl = struct.unpack_from('<I', ko_decrypted, chain + 11)[0]
            cnext = nl + (nh << 32)

            if ds == 0 or kl == 0: break

            cdata_off = chain + 15
            key_bytes = ko_decrypted[cdata_off:cdata_off + kl]
            value_bytes = ko_decrypted[cdata_off + kl:cdata_off + kl + vs]

            bucket_list.append(TextEntry(key_bytes, value_bytes, flags))
            total_parsed += 1

            if cnext == 0 or cnext == chain: break
            chain = cnext

        if bucket_list:
            text_buckets[bi] = bucket_list

    print(f"  内层解析: {total_parsed:,} 条目, {len(text_buckets):,} 非空桶")

    # 2.3 加载 TSV
    tsv_map = {}
    with open(tsv_path, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f):
            if i == 0: continue  # skip header
            parts = line.rstrip('\n').split('\t', 1)
            if len(parts) >= 2:
                tsv_map[parts[0]] = parts[1]
    print(f"  TSV 加载: {len(tsv_map):,} 条")

    # 2.4 替换
    replaced = 0; kept = 0; meta_count = 0
    for bi, tent_list in text_buckets.items():
        for tent in tent_list:
            if tent.is_meta:
                meta_count += 1
                continue

            val = tent.value_bytes
            n1 = val.find(b'\x00')
            if n1 < 0:
                kept += 1
                continue

            text_id_bytes = val[:n1]
            rest = val[n1+1:]
            n2 = rest.find(b'\x00')
            trailing = rest[n2:] if n2 >= 0 else b''

            try:
                text_id_str = text_id_bytes.decode('utf-8')
            except:
                kept += 1
                continue

            if text_id_str in tsv_map:
                new_text = tsv_map[text_id_str].encode('utf-8')
                tent.value_bytes = text_id_bytes + b'\x00' + new_text + trailing
                replaced += 1
            else:
                kept += 1

    print(f"  替换: {replaced:,}, 保留原文: {kept:,}, 元数据: {meta_count:,}")

    # 2.5 重建内层 PLPcK
    inner_chunks_start = 43 + inner_hash_count * 5
    new_ht = bytearray(inner_hash_count * 5)
    inner_chunk_buf = bytearray()

    for bi in sorted(text_buckets.keys()):
        tent_list = text_buckets[bi]
        first_offset = inner_chunks_start + len(inner_chunk_buf)

        ht_off = bi * 5
        new_ht[ht_off] = (first_offset >> 32) & 0xFF
        struct.pack_into('<I', new_ht, ht_off + 1, first_offset & 0xFFFFFFFF)

        for i, tent in enumerate(tent_list):
            kd = tent.key_bytes
            vd = tent.value_bytes
            kl = len(kd); vs = len(vd)
            ds = kl + vs + 15

            current = inner_chunks_start + len(inner_chunk_buf)
            next_off = (current + 15 + kl + vs) if i < len(tent_list) - 1 else 0

            hdr = bytearray(15)
            struct.pack_into('<I', hdr, 0, ds)
            hdr[4] = tent.flags
            hdr[5] = kl & 0xFF
            struct.pack_into('<I', hdr, 6, vs)
            hdr[10] = (next_off >> 32) & 0xFF
            struct.pack_into('<I', hdr, 11, next_off & 0xFFFFFFFF)

            inner_chunk_buf.extend(hdr)
            inner_chunk_buf.extend(kd)
            inner_chunk_buf.extend(vd)

    new_inner_plpck = bytearray()
    new_inner_plpck.extend(inner_header_38)
    new_inner_plpck.extend(inner_ver_5)
    new_inner_plpck.extend(new_ht)
    new_inner_plpck.extend(inner_chunk_buf)

    assert new_inner_plpck[:5] == b'PLPcK'
    print(f"  重建内层 PLPcK: {len(new_inner_plpck):,} 字节")
    print(f"  原始 KO 大小: {len(ko_decrypted):,}, 差异: {len(new_inner_plpck) - len(ko_decrypted):+,}")

    # 2.6 Inner XOR 加密 — 用 new_size % 256 !!
    new_inner_offset = len(new_inner_plpck) % 256
    print(f"  Inner XOR: 新偏移 = {new_inner_offset} (size={len(new_inner_plpck)} % 256)")
    encrypted_inner = inner_xor_crypt(bytes(new_inner_plpck), new_inner_offset)
    
    # roundtrip 验证
    test_rt = inner_xor_crypt(encrypted_inner[:5], new_inner_offset)
    assert test_rt == b'PLPcK', "Inner XOR roundtrip 失败!"

    # 2.7 替换 ZHT 条目的 value
    old_zht_size = len(entries[zht_idx].value)
    entries[zht_idx].value = encrypted_inner
    print(f"  ✅ ZHT 条目已替换: {old_zht_size:,} → {len(encrypted_inner):,} 字节")
    print(f"  ✅ KO 条目保持不变: {len(entries[ko_idx].value):,} 字节")

    return replaced


# ═══════════════════════════════════════════════════════════════════════
# STEP 2b: ZHT text.db → 自动利用 OpenCC 转换为 ZHS → 重建
# ═══════════════════════════════════════════════════════════════════════
def process_zht_to_zhs(entries, tsv_path=None):
    """
    读 ZHT text.db → 解密 → 解析内层 PLPcK → 使用 opencc 或本地 TSV 转换为简体中文 → 重建 → 加密
    → 替换 ZHT text.db 条目的 value
    """
    use_tsv = False
    converter = None
    tsv_map = {}
    
    if tsv_path and os.path.exists(tsv_path):
        import csv
        with open(tsv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f, delimiter='\t')
            for row in reader:
                if len(row) >= 2:
                    tsv_map[row[0]] = row[1]
        use_tsv = True
        print(f"  ✅ 使用本地 TSV 文件: {tsv_path}, 加载了 {len(tsv_map):,} 条数据")
    else:
        import opencc
        converter = opencc.OpenCC('t2s')
        print("  ✅ 使用 OpenCC 动态转换")
    
    # 找 ZHT
    zht_idx = None
    for i, e in enumerate(entries):
        if e.key == ZHT_DB_KEY: zht_idx = i
    
    if zht_idx is None:
        print(f"  ❌ 未找到 {ZHT_DB_KEY.decode()}")
        sys.exit(1)
    
    print(f"  ✅ ZHT entry[{zht_idx}]: value={len(entries[zht_idx].value):,} B")

    # 1. 解密 ZHT 内层
    zht_raw = entries[zht_idx].value
    zht_inner_off = find_inner_xor_offset(zht_raw[:64])
    if zht_inner_off is None:
        print("  ❌ ZHT Inner XOR offset 检测失败!")
        sys.exit(1)
    print(f"  ZHT Inner XOR offset = {zht_inner_off}")

    zht_decrypted = inner_xor_crypt(zht_raw, zht_inner_off)
    assert zht_decrypted[:5] == b'PLPcK', f"ZHT 解密失败: {zht_decrypted[:5].hex()}"
    print(f"  ✅ ZHT 解密成功, 大小 = {len(zht_decrypted):,}")

    # 2. 解析内层 PLPcK
    inner_hash_count = struct.unpack_from('<I', zht_decrypted, 21)[0]
    inner_header_38 = zht_decrypted[:38]
    inner_ver_5 = zht_decrypted[38:43]
    
    ht_start = 43
    text_buckets = {}
    total_parsed = 0

    for bi in range(inner_hash_count):
        off = ht_start + bi * 5
        oh = zht_decrypted[off]
        ol = struct.unpack_from('<I', zht_decrypted, off + 1)[0]
        fo = ol + (oh << 32)
        if fo == 0: continue

        chain = fo
        bucket_list = []
        safety = 0
        while chain > 0 and chain + 15 <= len(zht_decrypted) and safety < 5000:
            safety += 1
            ds = struct.unpack_from('<I', zht_decrypted, chain)[0]
            flags = zht_decrypted[chain + 4]
            kl = zht_decrypted[chain + 5]
            vs = struct.unpack_from('<I', zht_decrypted, chain + 6)[0]
            nh = zht_decrypted[chain + 10]
            nl = struct.unpack_from('<I', zht_decrypted, chain + 11)[0]
            cnext = nl + (nh << 32)

            if ds == 0 or kl == 0: break

            cdata_off = chain + 15
            key_bytes = zht_decrypted[cdata_off:cdata_off + kl]
            value_bytes = zht_decrypted[cdata_off + kl:cdata_off + kl + vs]

            bucket_list.append(TextEntry(key_bytes, value_bytes, flags))
            total_parsed += 1

            if cnext == 0 or cnext == chain: break
            chain = cnext

        if bucket_list:
            text_buckets[bi] = bucket_list

    print(f"  内层解析: {total_parsed:,} 条目, {len(text_buckets):,} 非空桶")

    # 3. 转换
    replaced = 0; kept = 0; meta_count = 0
    for bi, tent_list in text_buckets.items():
        for tent in tent_list:
            if tent.is_meta:
                meta_count += 1
                continue

            val = tent.value_bytes
            n1 = val.find(b'\x00')
            if n1 < 0:
                kept += 1
                continue

            text_id_bytes = val[:n1]
            rest = val[n1+1:]
            n2 = rest.find(b'\x00')
            trailing = rest[n2:] if n2 >= 0 else b''

            try:
                if n2 >= 0:
                    text_content_bytes = rest[:n2]
                else:
                    text_content_bytes = rest
                    
                text_content_str = text_content_bytes.decode('utf-8')
                
                if use_tsv:
                    try:
                        text_id_str = text_id_bytes.decode('utf-8')
                    except:
                        kept += 1
                        continue

                    if text_id_str in tsv_map:
                        new_text_str = tsv_map[text_id_str]
                    else:
                        kept += 1
                        continue
                else:
                    new_text_str = converter.convert(text_content_str)
                    
                new_text = new_text_str.encode('utf-8')
                tent.value_bytes = text_id_bytes + b'\x00' + new_text + trailing
                replaced += 1
            except:
                kept += 1
                continue

    print(f"  转换: {replaced:,}, 保持原样(解析失败): {kept:,}, 元数据: {meta_count:,}")

    # 4. 重建内层 PLPcK
    inner_chunks_start = 43 + inner_hash_count * 5
    new_ht = bytearray(inner_hash_count * 5)
    inner_chunk_buf = bytearray()

    for bi in sorted(text_buckets.keys()):
        tent_list = text_buckets[bi]
        first_offset = inner_chunks_start + len(inner_chunk_buf)

        ht_off = bi * 5
        new_ht[ht_off] = (first_offset >> 32) & 0xFF
        struct.pack_into('<I', new_ht, ht_off + 1, first_offset & 0xFFFFFFFF)

        for i, tent in enumerate(tent_list):
            kd = tent.key_bytes
            vd = tent.value_bytes
            kl = len(kd); vs = len(vd)
            ds = kl + vs + 15

            current = inner_chunks_start + len(inner_chunk_buf)
            next_off = (current + 15 + kl + vs) if i < len(tent_list) - 1 else 0

            hdr = bytearray(15)
            struct.pack_into('<I', hdr, 0, ds)
            hdr[4] = tent.flags
            hdr[5] = kl & 0xFF
            struct.pack_into('<I', hdr, 6, vs)
            hdr[10] = (next_off >> 32) & 0xFF
            struct.pack_into('<I', hdr, 11, next_off & 0xFFFFFFFF)

            inner_chunk_buf.extend(hdr)
            inner_chunk_buf.extend(kd)
            inner_chunk_buf.extend(vd)

    new_inner_plpck = bytearray()
    new_inner_plpck.extend(inner_header_38)
    new_inner_plpck.extend(inner_ver_5)
    new_inner_plpck.extend(new_ht)
    new_inner_plpck.extend(inner_chunk_buf)

    assert new_inner_plpck[:5] == b'PLPcK'
    print(f"  重建内层 PLPcK: {len(new_inner_plpck):,} 字节")

    # 5. Inner XOR 加密
    new_inner_offset = len(new_inner_plpck) % 256
    encrypted_inner = inner_xor_crypt(bytes(new_inner_plpck), new_inner_offset)

    # 6. 替换 ZHT 条目的 value
    entries[zht_idx].value = encrypted_inner
    print(f"  ✅ ZHT 条目已替换: {len(zht_raw):,} → {len(encrypted_inner):,} 字节")

    return replaced


# ═══════════════════════════════════════════════════════════════════════
# STEP 3: 流式重建 + 多卷写出
# ═══════════════════════════════════════════════════════════════════════
class StreamingPackWriter:
    def __init__(self, output_dir, volume_size=VOLUME_SIZE):
        self.output_dir = output_dir
        self.volume_size = volume_size
        self.global_offset = 0
        self.current_vol = 0
        self.current_vol_written = 0
        self._fh = None
        os.makedirs(output_dir, exist_ok=True)

    def _open_volume(self, vol_idx):
        if self._fh: self._fh.close()
        name = "data.pack" if vol_idx == 0 else f"data.pack~{vol_idx}"
        path = os.path.join(self.output_dir, name)
        self._fh = open(path, 'wb')
        self.current_vol = vol_idx
        self.current_vol_written = 0

    def write_encrypted(self, plaintext: bytes):
        remaining = len(plaintext); pos = 0
        while remaining > 0:
            if self._fh is None or self.current_vol_written >= self.volume_size:
                self._open_volume(self.global_offset // self.volume_size)
            can_write = min(remaining, self.volume_size - self.current_vol_written)
            chunk = plaintext[pos:pos + can_write]
            encrypted = pack_xor_crypt(chunk, self.global_offset)
            self._fh.write(encrypted)
            self.global_offset += can_write
            self.current_vol_written += can_write
            pos += can_write
            remaining -= can_write

    def close(self):
        if self._fh: self._fh.close(); self._fh = None
        return self.global_offset


def rebuild_and_write(entries, orig_header, orig_ver5, hash_count, output_dir):
    print(f"  hash_count = {hash_count:,}, 条目数 = {len(entries):,}")

    # Pass 1: 分桶 + 预计算位置
    buckets = {}
    for i, entry in enumerate(entries):
        bucket = cdbm_hash(entry.key) % hash_count
        buckets.setdefault(bucket, []).append(i)

    print(f"  非空桶: {len(buckets):,}, 最长链: {max(len(v) for v in buckets.values())}")

    fixed_area = 38 + 5 + hash_count * 5
    hash_table = bytearray(hash_count * 5)
    chunk_plan = []
    running_offset = fixed_area

    for bi in sorted(buckets.keys()):
        entry_indices = buckets[bi]
        first_offset = running_offset
        ht_off = bi * 5
        hash_table[ht_off] = (first_offset >> 32) & 0xFF
        struct.pack_into('<I', hash_table, ht_off + 1, first_offset & 0xFFFFFFFF)

        for ci, ei in enumerate(entry_indices):
            entry = entries[ei]
            chunk_total = 15 + len(entry.key) + len(entry.value) + len(entry.meta)
            current = running_offset
            next_off = (current + chunk_total) if ci < len(entry_indices) - 1 else 0
            chunk_plan.append((ei, current, next_off))
            running_offset += chunk_total

    total_size = running_offset
    print(f"  预计总大小: {total_size:,} 字节 ({total_size / 1024**3:.2f} GB)")

    # Pass 2: 流式写入
    print(f"  开始流式写入...")
    writer = StreamingPackWriter(output_dir)
    writer.write_encrypted(bytes(orig_header))
    writer.write_encrypted(orig_ver5)
    writer.write_encrypted(bytes(hash_table))

    last_report = time.time()
    written_chunks = 0

    for plan_idx, (ei, expected_offset, next_off) in enumerate(chunk_plan):
        assert writer.global_offset == expected_offset, \
            f"偏移不匹配: {writer.global_offset} != {expected_offset}"

        entry = entries[ei]
        kl = len(entry.key); vs = len(entry.value); ms = len(entry.meta)

        hdr = bytearray(15)
        struct.pack_into('<I', hdr, 0, kl + vs + 15 + ms)
        hdr[4] = entry.flags
        hdr[5] = kl & 0xFF
        struct.pack_into('<I', hdr, 6, vs)
        hdr[10] = (next_off >> 32) & 0xFF
        struct.pack_into('<I', hdr, 11, next_off & 0xFFFFFFFF)

        writer.write_encrypted(bytes(hdr))
        writer.write_encrypted(entry.key)
        writer.write_encrypted(entry.value)
        if ms > 0:
            writer.write_encrypted(entry.meta)

        written_chunks += 1
        now = time.time()
        if now - last_report > 5:
            pct = written_chunks / len(chunk_plan) * 100
            print(f"  ... {written_chunks:,}/{len(chunk_plan):,} ({pct:.1f}%), {writer.global_offset:,} bytes")
            last_report = now

    final_size = writer.close()
    assert final_size == total_size
    print(f"  ✅ 写入完成: {final_size:,} 字节, {written_chunks:,} chunks")

    for f_name in sorted(os.listdir(output_dir)):
        f_path = os.path.join(output_dir, f_name)
        if os.path.isfile(f_path) and f_name.startswith('data.pack'):
            print(f"    {f_name}: {os.path.getsize(f_path):,} bytes")

    return total_size


# ═══════════════════════════════════════════════════════════════════════
# STEP 4: 验证
# ═══════════════════════════════════════════════════════════════════════
def verify_pack(output_dir, entries):
    pack = MultiVolumePack(output_dir)
    hdr = pack.read_xor(0, 38)
    assert hdr[:5] == b'PLPcK'
    hash_count = struct.unpack_from('<I', hdr, 21)[0]
    print(f"  ✅ PLPcK valid, hash_count={hash_count:,}")

    ver5 = pack.read_xor(38, 5)
    assert ver5[4] == 1
    print(f"  ✅ 版本记录正确")

    ht_data = pack.read_xor(43, hash_count * 5)
    total = 0
    for bi in range(hash_count):
        off5 = bi * 5
        fo = struct.unpack_from('<I', ht_data[off5+1:off5+5])[0] + (ht_data[off5] << 32)
        if fo == 0: continue
        chain = fo; safety = 0
        while chain > 0 and chain + 15 <= pack.total_size and safety < 1000:
            safety += 1
            ch = pack.read_xor(chain, 15)
            ds = struct.unpack_from('<I', ch, 0)[0]
            if ds == 0 or ch[5] == 0: break
            total += 1
            np_ = struct.unpack_from('<I', ch, 11)[0] + (ch[10] << 32)
            if np_ == 0 or np_ == chain: break
            chain = np_

    ok = total == len(entries)
    print(f"  {'✅' if ok else '❌'} 条目数: {total:,} / {len(entries):,}")

    # 验证 ZHT text.db
    zht_bucket = cdbm_hash(ZHT_DB_KEY) % hash_count
    off5 = zht_bucket * 5
    chain = struct.unpack_from('<I', ht_data[off5+1:off5+5])[0] + (ht_data[off5] << 32)
    found = False
    while chain > 0 and chain + 15 <= pack.total_size:
        ch = pack.read_xor(chain, 15)
        kl = ch[5]; vs = struct.unpack_from('<I', ch, 6)[0]
        key = pack.read_xor(chain + 15, kl)
        if key == ZHT_DB_KEY:
            content = pack.read_xor(chain + 15 + kl, min(64, vs))
            boff = find_inner_xor_offset(content)
            if boff is not None:
                test_dec = inner_xor_crypt(content[:5], boff)
                if test_dec == b'PLPcK':
                    print(f"  ✅ text/zht/text.db: Inner XOR offset={boff}, PLPcK valid, size={vs:,}")
                    found = True
            break
        np_ = struct.unpack_from('<I', ch, 11)[0] + (ch[10] << 32)
        if np_ == 0 or np_ == chain: break
        chain = np_

    if not found:
        print(f"  ❌ text/zht/text.db 验证失败!")

    # 随机采样
    sample_indices = random.sample(range(len(entries)), min(100, len(entries)))
    matches = 0
    for idx in sample_indices:
        orig = entries[idx]
        bucket = cdbm_hash(orig.key) % hash_count
        off5 = bucket * 5
        chain = struct.unpack_from('<I', ht_data[off5+1:off5+5])[0] + (ht_data[off5] << 32)
        while chain > 0 and chain + 15 <= pack.total_size:
            ch = pack.read_xor(chain, 15)
            kl = ch[5]; vs = struct.unpack_from('<I', ch, 6)[0]
            key = pack.read_xor(chain + 15, kl)
            if key == orig.key:
                val = pack.read_xor(chain + 15 + kl, vs)
                if val == orig.value: matches += 1
                break
            np_ = struct.unpack_from('<I', ch, 11)[0] + (ch[10] << 32)
            if np_ == 0 or np_ == chain: break
            chain = np_

    print(f"  ✅ 采样验证: {matches}/{len(sample_indices)} 匹配")

    pack.close()
    return ok


# ═══════════════════════════════════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════════════════════════════════
def main():
    t0 = time.time()

    print("=" * 70)
    print("Step 1: 从 data.pack 提取全部文件")
    print("=" * 70)
    entries, orig_header, orig_ver5, hash_count = extract_all_files(PACK_DIR)

    print("\n" + "=" * 70)
    if T2S_MODE:
        if getattr(sys.modules[__name__], 'LOCAL_ZHT_MODE', False):
            print("Step 2: ZHT text.db → 本地 TSV 替换为 ZHS → 重建")
            print("=" * 70)
            zht_tsv_path = os.path.join(SCRIPT_DIR, "text_zht_text(纯繁转简).tsv")
            replaced = process_zht_to_zhs(entries, tsv_path=zht_tsv_path)
        else:
            print("Step 2: ZHT text.db → OpenCC 转换为 ZHS → 重建")
            print("=" * 70)
            replaced = process_zht_to_zhs(entries)
    else:
        print("Step 2: KO text.db → TSV 翻译 → 重建 → 替换 ZHT 槽位")
        print("=" * 70)
        replaced = process_ko_to_zht(entries, TSV_PATH)

    print("\n" + "=" * 70)
    print("Step 3: 流式重建外层 PLPcK + Pack XOR + 多卷写出")
    print("=" * 70)
    total_size = rebuild_and_write(entries, orig_header, orig_ver5, hash_count, OUTPUT_DIR)

    print("\n" + "=" * 70)
    print("Step 4: 验证")
    print("=" * 70)
    ok = verify_pack(OUTPUT_DIR, entries)

    elapsed = time.time() - t0
    print("\n" + "=" * 70)
    print(f"{'✅' if ok else '⚠'} 完成! 耗时 {elapsed:.1f}s")
    print(f"  输出: {OUTPUT_DIR}")
    print(f"  替换文本: {replaced:,} 条")
    print(f"  总大小: {total_size:,} bytes ({total_size/1024**3:.2f} GB)")
    print(f"  策略: KO text.db + TSV → 加密 → 替换到 ZHT 位置")
    print("=" * 70)

if __name__ == '__main__':
    main()
