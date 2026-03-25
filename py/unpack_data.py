#!/usr/bin/env python3
r"""
data.pack Full Unpacker — ChaosZero Nightmare (Yuna/Cocos2d-x Engine)

Features:
  - Split volume support (data.pack, data.pack~1, ~2, ...)
  - Numpy-accelerated XOR decryption (outer Pack XOR + inner DB XOR)
  - PLPcK index parsing with hash chain traversal
  - Auto-detect inner XOR base_offset for .db files
  - Progress bar and statistics

Usage:
  python unpack_data.py                          # unpack to default output dir
  python unpack_data.py -o G:\keasi\unpacked     # custom output dir
  python unpack_data.py --list                   # list files without extracting
  python unpack_data.py --filter "text/"         # only extract files matching filter
"""
import struct, os, sys, time, argparse
import numpy as np

# ═══════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════
GAME_DIR = r'F:\Games\ChaosZeroNightmare\bin\appdata\cznlive'
DEFAULT_OUT = r'g:\keasi\unpacked'

# ═══════════════════════════════════════════════════════════════════════
# XOR Keys
# ═══════════════════════════════════════════════════════════════════════

def generate_pack_xor_key():
    """Generate 129-byte Pack XOR key via LCG (seed=150812)."""
    seed = 150812
    key = bytearray(129)
    for i in range(129):
        seed = (seed * 1103515245) & 0xFFFFFFFF
        key[i] = (seed >> 16) & 0xFF
    return bytes(key)

PACK_XOR_KEY = generate_pack_xor_key()
PACK_XOR_KEY_NP = np.frombuffer(PACK_XOR_KEY, dtype=np.uint8)  # 129 bytes

INNER_XOR_KEY = bytes([
    0x91,0xae,0x4e,0xd4,0x64,0x4f,0x58,0x51,0x62,0xec,0x1b,0xd5,0xef,0x24,0xad,0xdb,
    0xaf,0x83,0x82,0x42,0xae,0xf5,0x1e,0x97,0x80,0x4b,0x13,0x4f,0xfd,0x8c,0xe5,0xbb,
    0x4f,0x6e,0x3e,0x64,0x51,0x14,0x7c,0xdf,0x56,0xc3,0x18,0xe5,0xe9,0x64,0xc9,0x99,
    0xc0,0xd9,0x5c,0xc8,0x60,0x82,0x2e,0x6b,0x41,0x8b,0xe4,0x65,0xd7,0x9a,0x03,0x6d,
    0xbf,0x67,0xab,0x3d,0xa7,0x2a,0xb1,0x02,0x3a,0x45,0x61,0xf4,0x44,0xe5,0xce,0x85,
    0x8d,0x23,0xea,0x10,0xfe,0xb4,0x89,0x91,0x51,0xad,0x7e,0x43,0xff,0x3e,0x24,0x19,
    0xa9,0x7b,0x4d,0xd3,0xaf,0x4e,0xf5,0xc8,0x29,0xe5,0xaf,0x4a,0xce,0x94,0x36,0xf6,
    0xb6,0xb6,0x38,0x2e,0x9d,0xfd,0x26,0x64,0x20,0x99,0x01,0x1a,0x48,0x99,0x08,0x9c,
    0x9d,0x4b,0x9f,0x80,0xbb,0xb0,0x0a,0x4c,0xc7,0x32,0x55,0xce,0x1f,0x78,0x64,0x6e,
    0x91,0xc9,0xc1,0x23,0x13,0xf5,0xd8,0x40,0xdc,0x51,0x45,0x70,0x10,0xd3,0x7d,0x19,
    0x61,0x5b,0xb6,0x98,0x88,0xb4,0x2b,0x19,0xe7,0x49,0xf9,0x93,0xc0,0x03,0x37,0xe9,
    0x33,0x2f,0x89,0xb3,0x20,0xc1,0x73,0xa5,0x65,0x38,0x48,0x78,0x87,0x98,0xa7,0x71,
    0x73,0x9e,0x72,0xdb,0xc8,0x4c,0x79,0x46,0x59,0x71,0x49,0xbd,0xda,0xe4,0xe3,0xbd,
    0x1a,0x17,0x85,0x6c,0x85,0xa5,0x55,0xcf,0xa2,0x4f,0x63,0x52,0xd0,0x05,0x93,0x3b,
    0x50,0x04,0x2b,0xe0,0xba,0x4c,0x70,0x8d,0xe8,0xeb,0xb5,0x20,0x59,0xb2,0x05,0x9c,
    0x9b,0xfe,0x90,0xd8,0x92,0x3d,0xf7,0x4b,0x43,0x91,0x1b,0xbc,0x00,0xbb,0x6b,0xfa,
])
INNER_XOR_KEY_NP = np.frombuffer(INNER_XOR_KEY, dtype=np.uint8)  # 256 bytes

# ═══════════════════════════════════════════════════════════════════════
# Numpy-accelerated XOR
# ═══════════════════════════════════════════════════════════════════════

def np_xor_decrypt(data: bytes, offset: int, key_np: np.ndarray) -> bytes:
    """
    XOR decrypt `data` using a cyclic key starting at `offset`.
    Uses numpy for vectorized operations — ~50x faster than pure Python for large data.
    """
    n = len(data)
    if n == 0:
        return b''
    key_len = len(key_np)
    data_np = np.frombuffer(data, dtype=np.uint8)
    
    # Build the key stream: key[(offset + i) % key_len] for i in 0..n-1
    # Tile the key enough times, then slice with correct phase
    phase = offset % key_len
    # How many full key cycles + remainder
    total = phase + n
    repeats = (total // key_len) + 1
    tiled = np.tile(key_np, repeats)
    key_stream = tiled[phase:phase + n]
    
    result = np.bitwise_xor(data_np, key_stream)
    return result.tobytes()

def pack_xor_decrypt(data: bytes, offset: int) -> bytes:
    """Decrypt data from pack using 129-byte Pack XOR key (numpy)."""
    return np_xor_decrypt(data, offset, PACK_XOR_KEY_NP)

def inner_xor_decrypt(data: bytes, base_offset: int) -> bytes:
    """Decrypt .db file content using 256-byte Inner XOR key (numpy)."""
    return np_xor_decrypt(data, base_offset, INNER_XOR_KEY_NP)

def find_inner_xor_offset(data_head: bytes) -> int | None:
    """Brute-force the inner XOR base_offset by checking for PLPcK magic."""
    target = b'PLPcK'
    for boff in range(256):
        match = True
        for i in range(min(5, len(data_head))):
            if (data_head[i] ^ INNER_XOR_KEY[( i + boff) % 256]) != target[i]:
                match = False
                break
        if match:
            return boff
    return None

# ═══════════════════════════════════════════════════════════════════════
# Multi-Volume Pack Reader
# ═══════════════════════════════════════════════════════════════════════

class MultiVolumePack:
    """
    Reads split-volume pack files as a single continuous byte stream.
    Volumes: data.pack (vol 0), data.pack~1, data.pack~2, ...
    Ignores: data.pack.pack* (backups)
    """
    def __init__(self, base_dir: str):
        self.volumes = []  # [(path, cumulative_start, size), ...]
        pack_base = os.path.join(base_dir, "data.pack")
        if not os.path.exists(pack_base):
            raise FileNotFoundError(f"data.pack not found in {base_dir}")
        
        sz = os.path.getsize(pack_base)
        self.volumes.append((pack_base, 0, sz))
        cumulative = sz
        n = 1
        while True:
            vpath = f"{pack_base}~{n}"
            if not os.path.exists(vpath):
                break
            sz = os.path.getsize(vpath)
            self.volumes.append((vpath, cumulative, sz))
            cumulative += sz
            n += 1
        self.total_size = cumulative
        self._handles: dict[int, object] = {}
    
    def _get_handle(self, vi: int):
        if vi not in self._handles:
            self._handles[vi] = open(self.volumes[vi][0], 'rb')
        return self._handles[vi]
    
    def read_raw(self, offset: int, size: int) -> bytes:
        """Read raw bytes at global offset, spanning volumes as needed."""
        result = bytearray()
        remaining = size
        cur = offset
        for i, (path, vol_start, vol_size) in enumerate(self.volumes):
            vol_end = vol_start + vol_size
            if cur >= vol_end:
                continue
            if cur < vol_start:
                continue
            local_off = cur - vol_start
            can_read = min(remaining, vol_size - local_off)
            fh = self._get_handle(i)
            fh.seek(local_off)
            chunk = fh.read(can_read)
            result.extend(chunk)
            remaining -= len(chunk)
            cur += len(chunk)
            if remaining <= 0:
                break
        return bytes(result)
    
    def read_xor(self, offset: int, size: int) -> bytes:
        """Read and Pack-XOR-decrypt bytes at global offset."""
        raw = self.read_raw(offset, size)
        return pack_xor_decrypt(raw, offset)
    
    def close(self):
        for fh in self._handles.values():
            fh.close()
        self._handles.clear()
    
    def __enter__(self):
        return self
    
    def __exit__(self, *args):
        self.close()

# ═══════════════════════════════════════════════════════════════════════
# PLPcK Parser
# ═══════════════════════════════════════════════════════════════════════

def parse_plpck_header(pack: MultiVolumePack):
    """Parse the 38-byte PLPcK header and return metadata dict."""
    hdr = pack.read_xor(0, 38)
    magic = hdr[:5]
    if magic != b'PLPcK':
        raise ValueError(f"Invalid PLPcK magic: {magic!r}")
    
    # Header layout (38 bytes):
    # [0:5]   magic "PLPcK"
    # [5]     version?
    # [6:8]   header_size (uint16 LE)
    # [8:12]  ?
    # [12:16] ?
    # [16:20] ?
    # [20]    ?
    # [21:25] hash_count (uint32 LE) — number of hash table buckets
    # [25:29] file_size (uint32 LE) — or some size field
    # [29:33] ?
    # [33:38] ?
    
    header_size = struct.unpack_from('<H', hdr, 6)[0]
    hash_count = struct.unpack_from('<I', hdr, 21)[0]
    file_size_field = struct.unpack_from('<I', hdr, 25)[0]
    
    return {
        'magic': magic,
        'header_size': header_size,
        'hash_count': hash_count,
        'file_size_field': file_size_field,
        'raw': hdr,
    }

def collect_all_entries(pack: MultiVolumePack, hash_count: int):
    """
    Walk the entire hash table and all chains to collect every file entry.
    
    Chunk header (15 bytes):
      [0:4]   data_size (uint32 LE) — total data bytes after this header
      [4]     flags
      [5]     key_length — how many bytes of data[] are the filename/key
      [6:10]  value_size (uint32 LE) — payload size (data_size - key_length typically)
      [10]    next_ptr_high (byte)
      [11:15] next_ptr_low (uint32 LE)
      next_ptr = next_ptr_low + (next_ptr_high << 32)
    
    Data layout: [key_bytes (key_length)] [value_bytes (data_size - key_length)]
    
    Returns list of dicts with keys:
      filename, data_offset, data_size, key_length, value_size, 
      content_offset, content_size
    """
    # Read version record (5 bytes after header)
    # Then hash table
    ht_offset = 43  # 38 (header) + 5 (version record)
    ht_size = hash_count * 5
    ht_data = pack.read_xor(ht_offset, ht_size)
    
    entries = []
    seen_offsets = set()
    
    for bucket_idx in range(hash_count):
        off5 = bucket_idx * 5
        high = ht_data[off5]
        low = struct.unpack_from('<I', ht_data, off5 + 1)[0]
        chain_offset = low + (high << 32)
        
        if chain_offset == 0:
            continue
        
        safety = 0
        while chain_offset > 0 and chain_offset + 15 <= pack.total_size and safety < 500:
            safety += 1
            
            if chain_offset in seen_offsets:
                break  # avoid cycles
            seen_offsets.add(chain_offset)
            
            chunk_hdr = pack.read_xor(chain_offset, 15)
            data_size = struct.unpack_from('<I', chunk_hdr, 0)[0]
            flags = chunk_hdr[4]
            key_length = chunk_hdr[5]
            value_size = struct.unpack_from('<I', chunk_hdr, 6)[0]
            next_high = chunk_hdr[10]
            next_low = struct.unpack_from('<I', chunk_hdr, 11)[0]
            next_ptr = next_low + (next_high << 32)
            
            if data_size > 0 and key_length > 0 and data_size < 200_000_000:
                # Read just the key (filename)
                key_data = pack.read_xor(chain_offset + 15, min(key_length, 512))
                
                # Decode filename — it's UTF-8, paths use forward slashes
                try:
                    filename = key_data[:key_length].decode('utf-8')
                except UnicodeDecodeError:
                    filename = key_data[:key_length].decode('latin-1')
                
                content_offset = chain_offset + 15 + key_length
                content_size = value_size  # use header's value_size, not data_size - key_length
                
                entries.append({
                    'filename': filename,
                    'chunk_offset': chain_offset,
                    'data_offset': chain_offset + 15,
                    'data_size': data_size,
                    'key_length': key_length,
                    'value_size': value_size,
                    'content_offset': content_offset,
                    'content_size': content_size,
                    'flags': flags,
                })
            
            if next_ptr == 0 or next_ptr == chain_offset:
                break
            chain_offset = next_ptr
    
    return entries

# ═══════════════════════════════════════════════════════════════════════
# Extraction Logic
# ═══════════════════════════════════════════════════════════════════════

def extract_file(pack: MultiVolumePack, entry: dict, out_dir: str, decrypt_db: bool = True):
    """
    Extract a single file from the pack.
    For .db/.dblang files, also applies inner XOR decryption.
    """
    filename = entry['filename']
    content_offset = entry['content_offset']
    content_size = entry['content_size']
    
    if content_size <= 0:
        return False
    
    # Build output path
    out_path = os.path.join(out_dir, filename.replace('/', os.sep))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    
    # Read content in chunks (for large files spanning volumes)
    CHUNK_SIZE = 16 * 1024 * 1024  # 16 MB
    
    # For small files, read all at once
    if content_size <= CHUNK_SIZE:
        content = pack.read_xor(content_offset, content_size)
        
        # Inner XOR for .db files
        if decrypt_db and (filename.endswith('.db') or filename.endswith('.dblang') or '.dblang.' in filename):
            base_off = find_inner_xor_offset(content[:64])
            if base_off is not None:
                content = inner_xor_decrypt(content, base_off)
        
        with open(out_path, 'wb') as f:
            f.write(content)
    else:
        # Large file: stream in chunks
        # For .db files that need inner XOR, we need the base_offset from the first few bytes
        inner_base = None
        if decrypt_db and (filename.endswith('.db') or filename.endswith('.dblang') or '.dblang.' in filename):
            head = pack.read_xor(content_offset, min(64, content_size))
            inner_base = find_inner_xor_offset(head)
        
        with open(out_path, 'wb') as f:
            written = 0
            while written < content_size:
                chunk_sz = min(CHUNK_SIZE, content_size - written)
                chunk = pack.read_xor(content_offset + written, chunk_sz)
                
                if inner_base is not None:
                    chunk = inner_xor_decrypt(chunk, (inner_base + written) % 256)
                
                f.write(chunk)
                written += len(chunk)
    
    return True

# ═══════════════════════════════════════════════════════════════════════
# Progress Display
# ═══════════════════════════════════════════════════════════════════════

def format_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024*1024):.1f} MB"
    else:
        return f"{size_bytes / (1024*1024*1024):.2f} GB"

def progress_bar(current, total, width=40, prefix='', suffix=''):
    pct = current / total if total > 0 else 0
    filled = int(width * pct)
    bar = '#' * filled + '-' * (width - filled)
    sys.stdout.write(f'\r  {prefix}|{bar}| {pct*100:.1f}% ({current}/{total}) {suffix}')
    sys.stdout.flush()

# ═══════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description='ChaosZero Nightmare data.pack Unpacker')
    parser.add_argument('-d', '--dir', default=GAME_DIR,
                        help=f'Pack directory (default: {GAME_DIR})')
    parser.add_argument('-o', '--output', default=DEFAULT_OUT,
                        help=f'Output directory (default: {DEFAULT_OUT})')
    parser.add_argument('--list', action='store_true',
                        help='List files without extracting')
    parser.add_argument('--filter', default='',
                        help='Filter: only extract files whose path contains this string')
    parser.add_argument('--no-inner-xor', action='store_true',
                        help='Skip inner XOR decryption for .db files')
    parser.add_argument('--list-file', default='',
                        help='Save file list to this path (TSV: filename, size)')
    args = parser.parse_args()
    
    print("=" * 70)
    print("  ChaosZero Nightmare - data.pack Unpacker")
    print("  PLPcK format + Split Volumes + Numpy XOR")
    print("=" * 70)
    
    # ── Open pack ──
    with MultiVolumePack(args.dir) as pack:
        print(f"\n  Pack directory:  {args.dir}")
        print(f"  Volumes:         {len(pack.volumes)}")
        for i, (p, s, sz) in enumerate(pack.volumes):
            print(f"    [{i}] {os.path.basename(p):20s}  offset=0x{s:010X}  size={format_size(sz)}")
        print(f"  Total size:      {format_size(pack.total_size)}")
        
        # ── Parse PLPcK header ──
        print(f"\n  Parsing PLPcK header...")
        header = parse_plpck_header(pack)
        print(f"  Magic:           {header['magic']}")
        print(f"  Hash buckets:    {header['hash_count']:,}")
        print(f"  File size field: {header['file_size_field']:,}")
        
        # ── Collect all entries ──
        print(f"\n  Scanning hash table ({header['hash_count']:,} buckets)...")
        t0 = time.perf_counter()
        entries = collect_all_entries(pack, header['hash_count'])
        t1 = time.perf_counter()
        print(f"  Found {len(entries):,} files in {t1-t0:.2f}s")
        
        # Statistics
        total_content = sum(e['content_size'] for e in entries)
        db_files = [e for e in entries if e['filename'].endswith('.db') or '.dblang.' in e['filename']]
        print(f"  Total content:   {format_size(total_content)}")
        print(f"  DB files:        {len(db_files)}")
        
        # File type breakdown
        ext_stats: dict[str, tuple[int, int]] = {}  # ext -> (count, total_size)
        for e in entries:
            fn = e['filename']
            dot = fn.rfind('.')
            ext = fn[dot:] if dot >= 0 else '(no ext)'
            c, s = ext_stats.get(ext, (0, 0))
            ext_stats[ext] = (c + 1, s + e['content_size'])
        
        print(f"\n  File type breakdown:")
        for ext, (c, s) in sorted(ext_stats.items(), key=lambda x: -x[1][1])[:15]:
            print(f"    {ext:25s}  {c:6,} files  {format_size(s):>10s}")
        if len(ext_stats) > 15:
            print(f"    ... and {len(ext_stats) - 15} more types")
        
        # ── Apply filter ──
        if args.filter:
            filtered = [e for e in entries if args.filter in e['filename']]
            print(f"\n  Filter '{args.filter}': {len(filtered):,} / {len(entries):,} files match")
            entries_to_process = filtered
        else:
            entries_to_process = entries
        
        # ── Save file list ──
        if args.list_file:
            with open(args.list_file, 'w', encoding='utf-8') as f:
                f.write("filename\tsize\n")
                for e in entries:
                    f.write(f"{e['filename']}\t{e['content_size']}\n")
            print(f"\n  File list saved: {args.list_file}")
        
        # ── List mode ──
        if args.list:
            print(f"\n{'-' * 70}")
            print(f"  {'Size':>12s}  Filename")
            print(f"{'-' * 70}")
            for e in entries_to_process:
                print(f"  {format_size(e['content_size']):>12s}  {e['filename']}")
            print(f"{'-' * 70}")
            print(f"  {len(entries_to_process):,} files listed")
            return
        
        # ── Extract ──
        out_dir = args.output
        os.makedirs(out_dir, exist_ok=True)
        decrypt_db = not args.no_inner_xor
        
        print(f"\n  Output:          {out_dir}")
        print(f"  Inner XOR:       {'enabled' if decrypt_db else 'disabled'}")
        print(f"  Extracting {len(entries_to_process):,} files...\n")
        
        t_start = time.perf_counter()
        extracted = 0
        failed = 0
        skipped = 0
        bytes_written = 0
        
        for i, entry in enumerate(entries_to_process):
            try:
                if extract_file(pack, entry, out_dir, decrypt_db):
                    extracted += 1
                    bytes_written += entry['content_size']
                else:
                    skipped += 1
            except Exception as ex:
                failed += 1
                if failed <= 10:
                    print(f"\n  ERROR extracting {entry['filename']}: {ex}")
            
            # Progress every 200 files
            if (i + 1) % 200 == 0 or i == len(entries_to_process) - 1:
                elapsed = time.perf_counter() - t_start
                speed = bytes_written / elapsed if elapsed > 0 else 0
                progress_bar(i + 1, len(entries_to_process),
                            suffix=f'{format_size(bytes_written)} @ {format_size(int(speed))}/s  ')
        
        t_end = time.perf_counter()
        elapsed = t_end - t_start
        
        print(f"\n\n{'=' * 70}")
        print(f"  Extraction Complete!")
        print(f"  Extracted:  {extracted:,} files")
        print(f"  Skipped:    {skipped:,} (empty)")
        print(f"  Failed:     {failed:,}")
        print(f"  Written:    {format_size(bytes_written)}")
        print(f"  Time:       {elapsed:.1f}s")
        if elapsed > 0:
            print(f"  Speed:      {format_size(int(bytes_written / elapsed))}/s")
        print(f"  Output:     {out_dir}")
        print(f"{'=' * 70}")

if __name__ == '__main__':
    main()
